// Relances des décrocheurs (chantier C4) : un rappel, puis un e-mail, puis
// la vie scolaire. Un passage par jour, entre 16 h 40 et 17 h 10 (heure locale).
//
// Amendement de José (8 octobre 2026) : un décrocheur se définit par
// l'absence d'ACTES D'APPRENTISSAGE (copie, QCM, émargement ou direct suivi,
// leçon, replay ou cours complet, révision, objectif du jour), jamais par des
// absences « inconnues » aux directs. Est donc relancé l'étudiant activé qui
// n'a fait aucun acte depuis 3 jours, alors que ses cours vivent (une séance
// tenue depuis 14 jours ou un devoir autour de cette semaine) : pas de
// relance pendant les vacances. Le motif choisit seulement la prochaine
// action proposée : un devoir encore rendable, deux directs où il était
// ABSENT (salle émargée sans lui, ou pointé absent ; jamais « inconnu »), ou
// le plus utile à faire maintenant. « jamais_active » reste l'affaire d'un humain.
//
// Paliers (deciderDecrocheur, shared/engagement/relances.ts) : 1 rappel au
// 3e jour (priorité « action » pour un devoir, sinon « engagement ») ; 2 un
// e-mail s'il n'a pas de téléphone abonné, 4 jours après un rappel sans effet,
// ou au 7e jour ; 3 « à appeler » après 2 relances sans retour. Au plus une
// relance par jour. Tout s'arrête dès qu'il revient (un acte clôt l'épisode),
// revenu_le note un retour sous 48 h. Aucun groupe témoin pour les décrocheurs.
// En mode « essai » (par défaut), tout est écrit en « simulation », rien ne part.
import { sql } from "drizzle-orm";
import { db } from "../db";
import { planifier } from "../taches";
import { sqlAttendus } from "../routes/admin";
import { sqlDevoirProposable } from "./proposables";
import { sqlEtatPresence } from "./presence";
import {
  abonnes,
  cartesDues,
  coursCompletsAOuvrir,
  coursCourt,
  derniersActes,
  devoirsDus,
  entiers,
  envoyerRappel,
  joursSansActe,
  lireReglage,
  quandEcheance,
  rappelsDuJour,
  sqlCoursDe,
  texteVariante,
  variantesRecentes,
} from "./rappel-du-jour";
import { emailsDuJour, envoyerEmailEngagement, lienOuverture } from "./email-semaine";
import { jourLocal, minutesLocales, type Jour } from "@shared/engagement/calendrier";
import {
  choisirVariante,
  deciderDecrocheur,
  DECROCHAGE,
  FENETRE_DECROCHEURS,
  MOTIFS_DECROCHEUR,
  PLACES_AVANT_ENTRAINEMENT,
  type MotifDecrocheur,
  type RelancePassee,
  type StatutRelance,
  type CanalRelance,
} from "@shared/engagement/relances";
import { t, variantesDe } from "@shared/textes/relances";
import { relancesEngagement } from "@shared/schema";

const MINUTE = 60_000;
const JOUR_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Étudiants déjà examinés aujourd'hui (le passage revient toutes les 5 minutes dans la fenêtre). */
const examines = new Map<number, Jour>();

type Candidat = {
  id: number;
  prenom: string;
  email: string | null;
  emailsActifs: boolean;
  fuseau: string | null;
  siteId: number | null;
  classeId: number | null;
  jour: Jour;
  joursSansActe: number;
  dernierActe: Date | null;
};

/** Ce qu'on propose à un décrocheur : motif, variables des textes, lien. */
type Proposition = { motif: MotifDecrocheur; v: Record<string, string | number>; lien: string };

/** Étudiants dont les cours vivent : une séance tenue depuis 14 jours ou un devoir proposable autour de cette semaine. */
async function coursVivants(ids: number[], maintenant: number): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const r = await db.execute<{ uid: number }>(sql`
    SELECT u.id AS uid FROM campus.utilisateurs u
    WHERE u.id = ANY(${entiers(ids)}) AND (
      EXISTS (SELECT 1 FROM campus.seances s JOIN campus.cours c ON c.id = s.cours_id AND c.statut = 'publie'
        WHERE s.demarree_le >= ${iso(maintenant - 14 * JOUR_MS)}::timestamptz AND ${sqlCoursDe(sql`s.cours_id`)})
      OR EXISTS (SELECT 1 FROM campus.devoirs d JOIN campus.cours c ON c.id = d.cours_id AND c.statut = 'publie'
        WHERE d.publie AND d.date_limite BETWEEN ${iso(maintenant - 7 * JOUR_MS)}::timestamptz AND ${iso(maintenant + 7 * JOUR_MS)}::timestamptz
          AND ${sqlCoursDe(sql`d.cours_id`)} AND ${sqlDevoirProposable("d")}))`);
  return new Set(r.rows.map((l) => l.uid));
}

/** Prochaine action de chaque décrocheur, du plus concret au plus général. */
async function propositions(candidats: Candidat[], maintenant: number): Promise<Map<number, Proposition>> {
  const choix = new Map<number, Proposition>();
  const ids = candidats.map((c) => c.id);
  const fuseauDe = new Map(candidats.map((c) => [c.id, c.fuseau]));
  if (!ids.length) return choix;

  // Un devoir échu depuis 14 jours au plus, encore rendable en retard, pas rendu.
  const devoirs = await db.execute<{ uid: number; id: number; titre: string; cours: string }>(sql`
    SELECT DISTINCT ON (u.id) u.id AS uid, d.id, d.titre, c.titre AS cours
    FROM campus.utilisateurs u
    JOIN campus.devoirs d ON d.publie AND d.accepte_retard AND d.date_limite < ${iso(maintenant)}::timestamptz AND d.date_limite >= ${iso(maintenant - 14 * JOUR_MS)}::timestamptz
    JOIN campus.cours c ON c.id = d.cours_id AND c.statut = 'publie'
    WHERE u.id = ANY(${entiers(ids)}) AND ${sqlCoursDe(sql`d.cours_id`)} AND ${sqlDevoirProposable("d")} AND u.cree_le < d.date_limite
      AND NOT EXISTS (SELECT 1 FROM campus.rendus r WHERE r.devoir_id = d.id AND r.etudiant_id = u.id AND r.statut IN ('rendu', 'corrige'))
      AND NOT EXISTS (SELECT 1 FROM campus.tentatives_quiz tq WHERE tq.devoir_id = d.id AND tq.etudiant_id = u.id AND tq.fin_le IS NOT NULL)
    ORDER BY u.id, d.date_limite DESC`);
  for (const l of devoirs.rows) choix.set(l.uid, { motif: "devoir_non_rendu", v: { devoir: l.titre, cours: coursCourt(l.cours) }, lien: `/devoirs/${l.id}` });

  // Les deux derniers directs où il était attendu : ABSENT aux deux (présence en trois états ; « inconnu » ne compte jamais).
  const restants = ids.filter((id) => !choix.has(id));
  if (restants.length) {
    const lives = await db.execute<{ uid: number; seance_id: number; cours_id: number; cours: string; prete: boolean }>(sql`
      SELECT uid, (array_agg(seance_id ORDER BY debut DESC))[1] AS seance_id, (array_agg(cours_id ORDER BY debut DESC))[1] AS cours_id,
        (array_agg(cours ORDER BY debut DESC))[1] AS cours, bool_or(prete AND rang = 1) AS prete
      FROM (
        SELECT a.uid, a.seance_id, a.cours_id, a.debut, c.titre AS cours,
          ${sqlEtatPresence(sql`a.seance_id`, sql`a.uid`)} AS etat,
          EXISTS (SELECT 1 FROM campus.etudes_seances es WHERE es.seance_id = a.seance_id AND es.statut = 'prete') AS prete,
          row_number() OVER (PARTITION BY a.uid ORDER BY a.debut DESC) AS rang
        FROM (${sqlAttendus({ depuis: new Date(maintenant - 30 * JOUR_MS), sites: null })}) a
        JOIN campus.cours c ON c.id = a.cours_id
        WHERE a.uid = ANY(${entiers(restants)})
      ) x
      WHERE rang <= 2
      GROUP BY uid
      HAVING count(*) = 2 AND count(*) FILTER (WHERE etat = 'absent') = 2`);
    for (const l of lives.rows)
      choix.set(l.uid, {
        motif: "lives_manques",
        v: { cours: coursCourt(l.cours) },
        lien: l.prete ? `/mediatheque/cours/${l.seance_id}?depuis=relance` : `/cours/${l.cours_id}`,
      });
  }

  // Sinon : plus vu. La relance propose la chose la plus utile à faire maintenant.
  const inactifs = candidats.filter((c) => !choix.has(c.id));
  if (inactifs.length) {
    const ids3 = inactifs.map((c) => c.id);
    const [aRendre, aLire, cartes] = await Promise.all([
      devoirsDus(ids3, 7 * 24, maintenant),
      coursCompletsAOuvrir(ids3, 14, maintenant, 1),
      cartesDues(inactifs.map((c) => ({ id: c.id, fuseau: c.fuseau, jour: c.jour }))),
    ]);
    for (const c of inactifs) {
      const v: Record<string, string | number> = { n: c.joursSansActe };
      const d = aRendre.get(c.id);
      const cc = aLire.get(c.id)?.[0];
      const n = cartes.get(c.id) ?? 0;
      let action: string;
      let lien: string;
      if (d) {
        action = t("action.devoir", { registre: "tu", v: { devoir: d.titre, cours: coursCourt(d.cours), quand: quandEcheance(d.limite, maintenant, fuseauDe.get(c.id) ?? null) } });
        lien = `/devoirs/${d.id}`;
      } else if (cc) {
        action = t("action.cours_complet", { registre: "tu", v: { cours: coursCourt(cc.cours) } });
        lien = `/mediatheque/cours/${cc.seanceId}?depuis=relance`;
      } else if (n >= 2) {
        action = t("action.cartes", { registre: "tu", v: { n } });
        lien = "/reviser?depuis=relance";
      } else {
        action = t("action.defaut", { registre: "tu" });
        lien = "/accueil";
      }
      choix.set(c.id, { motif: "inactif", v: { ...v, action }, lien });
    }
  }
  return choix;
}

/** E-mail du palier 2, au tutoiement : deux phrases, une aide, un bouton suivi. */
function contenuEmailRelance(c: Candidat, p: Proposition, bouton: string) {
  const tu = { registre: "tu" as const };
  const v = { ...p.v, prenom: c.prenom.trim() };
  return {
    sujet: t(`email.relance.${p.motif}.sujet`, { ...tu, v }),
    contenu: {
      etiquette: t("email.relance.etiquette", tu),
      titre: t("email.relance.titre", { ...tu, v }),
      paragraphes: [t(`email.relance.${p.motif}.p1`, { ...tu, v }), t(`email.relance.${p.motif}.p2`, { ...tu, v }), t("email.relance.aide", tu)],
      bouton: { libelle: t("email.relance.bouton", tu), lien: bouton },
    },
  };
}

export type BilanDecrocheurs = { candidats: number; ecrits: Partial<Record<StatutRelance, number>>; paliers: Record<1 | 2 | 3, number> };

/**
 * Un passage : relance (ou simule) les décrocheurs dont c'est l'heure.
 * « forcer » ignore la fenêtre de 16 h 40 et la mémoire du jour (essais).
 */
export async function passerDecrocheurs(maintenant = Date.now(), { forcer = false } = {}): Promise<BilanDecrocheurs> {
  const bilan: BilanDecrocheurs = { candidats: 0, ecrits: {}, paliers: { 1: 0, 2: 0, 3: 0 } };
  const reglage = await lireReglage();
  if (reglage.mode === "pause") return bilan;

  const r = await db.execute<{ id: number; prenom: string; email: string | null; fuseau: string | null; site_id: number | null; classe_id: number | null; cree_le: string; emails_actifs: boolean | null }>(sql`
    SELECT u.id, u.prenom, u.email, u.fuseau, u.site_id, u.classe_id, u.cree_le, re.emails_actifs
    FROM campus.utilisateurs u
    LEFT JOIN campus.reglages_engagement re ON re.utilisateur_id = u.id
    WHERE u.role = 'etudiant' AND u.actif AND NOT u.doit_changer_mot_de_passe
      AND (u.classe_id IS NOT NULL OR EXISTS (SELECT 1 FROM campus.inscriptions i WHERE i.utilisateur_id = u.id))`);
  const dansFenetre = r.rows.filter((l) => {
    const jour = jourLocal(maintenant, l.fuseau);
    if (!forcer && examines.get(l.id) === jour) return false;
    const m = minutesLocales(maintenant, l.fuseau);
    return forcer || (m >= FENETRE_DECROCHEURS.debut && m <= FENETRE_DECROCHEURS.fin);
  });
  if (!dansFenetre.length) return bilan;

  const actes = await derniersActes(
    dansFenetre.map((l) => l.id),
    60,
    maintenant,
  );
  let candidats: Candidat[] = dansFenetre
    .map((l) => {
      const dernier = actes.get(l.id) ?? null;
      return {
        id: l.id,
        prenom: l.prenom,
        email: l.email?.trim() || null,
        emailsActifs: l.emails_actifs ?? true,
        fuseau: l.fuseau,
        siteId: l.site_id,
        classeId: l.classe_id,
        jour: jourLocal(maintenant, l.fuseau),
        joursSansActe: joursSansActe(dernier, new Date(l.cree_le), maintenant),
        dernierActe: dernier,
      };
    })
    .filter((c) => c.joursSansActe >= DECROCHAGE.joursRappel);
  for (const l of dansFenetre) examines.set(l.id, jourLocal(maintenant, l.fuseau));
  const vivants = await coursVivants(
    candidats.map((c) => c.id),
    maintenant,
  );
  candidats = candidats.filter((c) => vivants.has(c.id));
  bilan.candidats = candidats.length;
  if (!candidats.length) return bilan;
  const ids = candidats.map((c) => c.id);

  // Relances de l'épisode en cours : depuis le dernier acte (ou sur 60 jours s'il n'y en a pas).
  const passees = await db.execute<{ uid: number; jour: string; palier: number; canal: CanalRelance; statut: StatutRelance; cree_le: string }>(sql`
    SELECT utilisateur_id AS uid, jour::text AS jour, palier, canal, statut, cree_le FROM campus.relances_engagement
    WHERE utilisateur_id = ANY(${entiers(ids)}) AND motif IN (${sql.join(
      MOTIFS_DECROCHEUR.map((m) => sql`${m}`),
      sql`, `,
    )}) AND cree_le > ${iso(maintenant - 60 * JOUR_MS)}::timestamptz
    ORDER BY cree_le`);
  const episodes = new Map<number, RelancePassee[]>();
  const dernierActeDe = new Map(candidats.map((c) => [c.id, c.dernierActe]));
  for (const l of passees.rows) {
    const acte = dernierActeDe.get(l.uid);
    if (acte && new Date(l.cree_le) <= acte) continue;
    episodes.set(l.uid, [...(episodes.get(l.uid) ?? []), { jour: l.jour, palier: l.palier, canal: l.canal, statut: l.statut }]);
  }

  const [joignables, compteurs, choix, recentes] = await Promise.all([
    abonnes(ids),
    rappelsDuJour(ids, maintenant),
    propositions(candidats, maintenant),
    variantesRecentes(ids, [...MOTIFS_DECROCHEUR]),
  ]);
  const enEssai = reglage.mode === "essai" || reglage.emailsMode === "essai";
  let emailsRestants = reglage.emailsParJour - (await emailsDuJour(enEssai, maintenant));

  for (const c of candidats) {
    const p = choix.get(c.id);
    if (!p) continue;
    const decision = deciderDecrocheur({
      aujourdhui: c.jour,
      mode: reglage.mode,
      emailsMode: reglage.emailsMode,
      joursSansActe: c.joursSansActe,
      episode: episodes.get(c.id) ?? [],
      abonne: joignables.has(c.id),
      joignableParEmail: Boolean(c.email) && c.emailsActifs,
      emailsRestants,
      plafondRappel: (compteurs.get(c.id) ?? 0) >= (p.motif === "devoir_non_rendu" ? PLACES_AVANT_ENTRAINEMENT + 1 : PLACES_AVANT_ENTRAINEMENT),
    });
    if (decision.action !== "ecrire") continue;
    const variante = decision.canal === "push" ? choisirVariante(variantesDe(`relance.${p.motif}`), recentes.get(c.id) ?? []) : `${decision.canal}.${p.motif}`;
    const [ligne] = await db
      .insert(relancesEngagement)
      .values({
        utilisateurId: c.id,
        jour: c.jour,
        motif: p.motif,
        canal: decision.canal,
        palier: decision.palier,
        variante,
        statut: decision.envoyer && decision.canal === "email" ? "echec" : decision.statut,
        lien: p.lien,
        siteId: c.siteId,
        classeId: c.classeId,
        creeLe: new Date(maintenant),
      })
      .onConflictDoNothing()
      .returning({ id: relancesEngagement.id });
    if (!ligne) continue;
    bilan.paliers[decision.palier]++;
    let statut = decision.statut;
    if (decision.envoyer && decision.canal === "push") {
      try {
        const { titre, corps } = texteVariante("relance", variante, p.v);
        const notificationId = await envoyerRappel(c.id, {
          titre,
          corps,
          lien: p.lien,
          type: p.motif === "devoir_non_rendu" ? "devoir" : "cours",
          priorite: p.motif === "devoir_non_rendu" ? "action" : "engagement",
        });
        await db.execute(sql`UPDATE campus.relances_engagement SET notification_id = ${notificationId} WHERE id = ${ligne.id}`);
      } catch (err) {
        statut = "echec";
        await db.execute(sql`UPDATE campus.relances_engagement SET statut = 'echec' WHERE id = ${ligne.id}`);
        console.error("[relances] décrocheur, rappel :", (err as Error).message);
      }
    } else if (decision.envoyer && decision.canal === "email" && c.email) {
      emailsRestants--;
      try {
        const { sujet, contenu } = contenuEmailRelance(c, p, lienOuverture(ligne.id));
        statut = await envoyerEmailEngagement({ ligneId: ligne.id, uid: c.id, a: c.email, sujet, contenu });
      } catch (err) {
        statut = "echec";
        console.error("[relances] décrocheur, e-mail :", (err as Error).message);
      }
    } else if (decision.canal === "email" && decision.statut === "simulation") {
      emailsRestants--;
    }
    bilan.ecrits[statut] = (bilan.ecrits[statut] ?? 0) + 1;
  }
  return bilan;
}

planifier("relances-decrocheurs", 5 * MINUTE, async () => {
  await passerDecrocheurs();
});

/** Pour les essais : la mémoire du jour (un même processus rejoue le passage). */
export const oublierExamines = () => examines.clear();
