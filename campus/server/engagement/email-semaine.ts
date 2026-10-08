// E-mail du lundi « Ta semaine au campus » (chantier C4), et ce que partagent
// tous les e-mails d'engagement : plafond quotidien, lien de désabonnement
// signé, bouton suivi, en-têtes List-Unsubscribe.
//
// Le lundi entre 6 h 45 et 9 h (heure locale), un e-mail par étudiant et par
// semaine : ce qu'il a fait la semaine passée, les directs et les échéances
// de la semaine qui commence, les cours complets qu'il n'a pas encore ouverts
// et, si la Coupe existe (C5), la participation de sa classe et de son campus. Un seul
// bouton, et « Ne plus recevoir ces e-mails », qui marche sans se connecter.
//
// Plafond : emails_par_jour (40 par défaut) pour tous les e-mails
// d'engagement, car le compte Resend est partagé avec www.2iae.com. L'e-mail
// de la semaine laisse un quart du plafond aux e-mails des décrocheurs (passage
// de 16 h 40) : il ne les bloque jamais. Ce qui dépasse part les jours suivants
// (jusqu'au jeudi), dans la même fenêtre ; ceux qui ne l'ont pas reçu la
// semaine d'avant passent en premier (ce ne sont pas toujours les mêmes qui
// attendent). La Coupe n'y donne aucun rang (décision D5) : seulement la
// participation de sa classe et de son campus, provisoire tant que la semaine
// n'est pas figée.
// En mode « essai » (par défaut), les lignes sont écrites en « simulation »
// et rien ne part. Sans clé Resend, l'envoi est noté « echec », sans plantage.
import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { config } from "../config";
import { planifier } from "../taches";
import { envoyerEmail, gabaritEmail, type ContenuEmail } from "../mail";
import { tableExiste } from "./tables";
import { sqlDevoirProposable } from "./proposables";
import { sqlEtatPresence } from "./presence";
import { COUPE } from "./bareme";
import { coursCompletsAOuvrir, coursCourt, decalageMinutes, entiers, lireReglage, quandEcheance, sqlActes, sqlCoursDe } from "./rappel-du-jour";
import { ajouterJours, jourLocal, lundiDe, semaineIso, type Jour } from "@shared/engagement/calendrier";
import { fenetreEmailSemaine, reserveRelances, type StatutRelance } from "@shared/engagement/relances";
import { t, type CleRelances } from "@shared/textes/relances";
import { formaterDate } from "@shared/textes";
import { relancesEngagement } from "@shared/schema";

const MINUTE = 60_000;

// ── Jetons signés (secret de session déjà en place : aucun nouveau secret) ──

const signer = (texte: string) => createHmac("sha256", config.sessionSecret).update(texte).digest("base64url");
const egaux = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Jeton de désabonnement d'un étudiant : « 63.Hk3… » (identifiant et signature HMAC-SHA256). */
export const jetonDesabonnement = (uid: number) => `${uid}.${signer(`desabonnement|${uid}`).slice(0, 32)}`;

/** Identifiant de l'étudiant si le jeton est authentique, sinon null. */
export function lireJetonDesabonnement(jeton: string): number | null {
  const m = /^(\d{1,10})\.([A-Za-z0-9_-]{32})$/.exec(jeton);
  if (!m) return null;
  const uid = Number(m[1]);
  return egaux(m[2], signer(`desabonnement|${uid}`).slice(0, 32)) ? uid : null;
}

export const lienDesabonnement = (uid: number) => `${config.urlCampus}/api/emails/desabonner/${jetonDesabonnement(uid)}`;

/** Signature du bouton d'un e-mail (on ne marque pas « ouvert » l'e-mail d'un autre en devinant un numéro). */
export const signatureOuverture = (id: number) => signer(`ouverture|${id}`).slice(0, 16);
export const ouvertureValide = (id: number, signature: unknown) => typeof signature === "string" && egaux(signature, signatureOuverture(id));
export const lienOuverture = (id: number) => `${config.urlCampus}/api/relances/e/${id}?j=${signatureOuverture(id)}`;

// ── Plafond et envoi ───────────────────────────────────────────────────────

/** E-mails d'engagement comptés aujourd'hui (heure d'Abidjan) ; en essai, les simulations comptent aussi. */
export async function emailsDuJour(enEssai: boolean, maintenant = Date.now()): Promise<number> {
  const minuit = new Date(maintenant);
  minuit.setUTCHours(0, 0, 0, 0);
  const statuts = enEssai ? sql`('envoye', 'simulation')` : sql`('envoye')`;
  // Le plafond est commun : les e-mails du corrigé du jour aux formateurs (server/corriges.ts) comptent aussi.
  const r = await db.execute<{ n: number }>(
    sql`SELECT (SELECT count(*)::int FROM campus.relances_engagement WHERE canal = 'email' AND statut IN ${statuts} AND cree_le >= ${minuit.toISOString()}::timestamptz)
      + (SELECT count(*)::int FROM campus.journal WHERE action = 'corriges_du_jour' AND details->>'email' = 'envoye' AND cree_le >= ${minuit.toISOString()}::timestamptz) AS n`,
  );
  return r.rows[0]?.n ?? 0;
}

/**
 * Envoie un e-mail d'engagement déjà inscrit (ligne relances_engagement) :
 * pied de désabonnement, en-têtes List-Unsubscribe, statut mis à jour.
 */
export async function envoyerEmailEngagement(o: { ligneId: number; uid: number; a: string; sujet: string; contenu: ContenuEmail }): Promise<StatutRelance> {
  const lien = lienDesabonnement(o.uid);
  const { html, texte } = gabaritEmail({
    ...o.contenu,
    tutoiement: true,
    desinscription: { raison: t("email.desinscription.raison", { registre: "tu" }), libelle: t("email.desinscription.lien", { registre: "tu" }), lien },
  });
  const parti = await envoyerEmail({
    a: o.a,
    sujet: o.sujet,
    texte,
    html,
    entetes: { "List-Unsubscribe": `<${lien}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  }).catch(() => false);
  const statut: StatutRelance = parti ? "envoye" : "echec";
  await db.execute(sql`UPDATE campus.relances_engagement SET statut = ${statut} WHERE id = ${o.ligneId}`);
  return statut;
}

// ── Contenu de l'e-mail du lundi ───────────────────────────────────────────

/** Instant UTC du début d'un jour local (minuit dans le fuseau). */
export function debutDuJour(jour: Jour, fuseau: string | null): number {
  const [a, m, j] = jour.split("-").map(Number);
  const local = Date.UTC(a, m - 1, j);
  return local - decalageMinutes(fuseau, local) * MINUTE;
}

/** Texte au singulier (clé « ….un ») ou au pluriel selon n. */
const pluriel = (cle: string, n: number) => t((n === 1 ? `${cle}.un` : cle) as CleRelances, { registre: "tu", v: { n } });

/** Une rubrique facultative (table d'un autre chantier) : en cas d'écart de schéma, la ligne disparaît. */
async function facultatif<T>(f: () => Promise<T>, defaut: T): Promise<T> {
  try {
    return await f();
  } catch (e) {
    console.warn("[relances] e-mail de la semaine, rubrique ignorée :", (e as Error).message);
    return defaut;
  }
}

export type EtudiantEmail = { id: number; prenom: string; fuseau: string | null; siteId: number | null; classeId: number | null; site: string | null };

/**
 * Compose l'e-mail « Ta semaine au campus » d'un étudiant pour la semaine qui
 * commence le lundi donné (heure locale). « bouton » : le lien suivi
 * (/api/relances/e/:id) ; l'aperçu des essais passe un lien quelconque.
 */
export async function composerEmailSemaine(e: EtudiantEmail, lundi: Jour, bouton: string, maintenant = Date.now()): Promise<{ sujet: string; contenu: ContenuEmail }> {
  const tu = { registre: "tu" as const };
  const debutPassee = debutDuJour(ajouterJours(lundi, -7), e.fuseau);
  const debutSemaine = debutDuJour(lundi, e.fuseau);
  const finSemaine = debutDuJour(ajouterJours(lundi, 7), e.fuseau);
  const de = new Date(debutPassee).toISOString();
  const a = new Date(debutSemaine).toISOString();

  // La semaine passée.
  const actes = await sqlActes({ depuis: sql`${de}::timestamptz`, jusqua: sql`${a}::timestamptz`, uids: [e.id] });
  const [lignesActes, compte] = await Promise.all([
    db.execute<{ t: string }>(sql`SELECT t FROM (${actes}) x`),
    db.execute<{ rendus: number; quiz: number; replays: number; directs: number }>(sql`
      SELECT
        (SELECT count(*) FROM campus.rendus r WHERE r.etudiant_id = ${e.id} AND r.statut IN ('rendu', 'corrige') AND r.rendu_le >= ${de}::timestamptz AND r.rendu_le < ${a}::timestamptz)::int AS rendus,
        (SELECT count(DISTINCT tq.devoir_id) FROM campus.tentatives_quiz tq WHERE tq.etudiant_id = ${e.id} AND tq.fin_le >= ${de}::timestamptz AND tq.fin_le < ${a}::timestamptz)::int AS quiz,
        (SELECT count(*) FROM campus.vues_replay v WHERE v.utilisateur_id = ${e.id} AND v.derniere_vue >= ${de}::timestamptz AND v.derniere_vue < ${a}::timestamptz)::int AS replays,
        (SELECT count(*) FROM campus.presences p JOIN campus.seances s ON s.id = p.seance_id
          WHERE p.utilisateur_id = ${e.id} AND s.debut >= ${de}::timestamptz AND s.debut < ${a}::timestamptz
            AND ${sqlEtatPresence(sql`s.id`, sql`p.utilisateur_id`)} = 'present')::int AS directs`),
  ]);
  const jours = new Set(lignesActes.rows.map((l) => jourLocal(new Date(l.t), e.fuseau))).size;
  const c = compte.rows[0] ?? { rendus: 0, quiz: 0, replays: 0, directs: 0 };
  const revisions = (await tableExiste("reponses_revision"))
    ? await facultatif(async () => {
        const r = await db.execute<{ n: number }>(
          sql`SELECT count(*)::int AS n FROM campus.reponses_revision WHERE utilisateur_id = ${e.id} AND repondu_le >= ${de}::timestamptz AND repondu_le < ${a}::timestamptz`,
        );
        return r.rows[0]?.n ?? 0;
      }, 0)
    : 0;
  const points = (await tableExiste("activites"))
    ? await facultatif(async () => {
        const r = await db.execute<{ n: number }>(
          sql`SELECT COALESCE(sum(points), 0)::int AS n FROM campus.activites WHERE utilisateur_id = ${e.id} AND semaine::text = ${semaineIso(ajouterJours(lundi, -7))}`,
        );
        return r.rows[0]?.n ?? 0;
      }, 0)
    : 0;
  const passee = [
    jours ? pluriel("email.semaine.ligne.jours", jours) : null,
    c.directs ? pluriel("email.semaine.ligne.directs", c.directs) : null,
    c.rendus ? pluriel("email.semaine.ligne.rendus", c.rendus) : null,
    c.quiz ? pluriel("email.semaine.ligne.quiz", c.quiz) : null,
    c.replays ? pluriel("email.semaine.ligne.replays", c.replays) : null,
    revisions ? pluriel("email.semaine.ligne.revisions", revisions) : null,
    points ? pluriel("email.semaine.ligne.points", points) : null,
  ].filter((x): x is string => Boolean(x));

  // La semaine qui commence : directs, échéances, cours complets à lire.
  const [directs, echeances, aLire] = await Promise.all([
    db.execute<{ debut: string; titre: string; cours: string }>(sql`
      SELECT s.debut, s.titre, c.titre AS cours FROM campus.utilisateurs u
      JOIN campus.seances s ON s.debut >= ${new Date(Math.max(debutSemaine, maintenant - 2 * 3_600_000)).toISOString()}::timestamptz AND s.debut < ${new Date(finSemaine).toISOString()}::timestamptz AND s.statut <> 'annulee'
      JOIN campus.cours c ON c.id = s.cours_id AND c.statut = 'publie'
      WHERE u.id = ${e.id} AND ${sqlCoursDe(sql`s.cours_id`)}
      ORDER BY s.debut LIMIT 6`),
    db.execute<{ titre: string; date_limite: string; cours: string }>(sql`
      SELECT d.titre, d.date_limite, c.titre AS cours FROM campus.utilisateurs u
      JOIN campus.devoirs d ON d.publie AND d.date_limite > ${new Date(maintenant).toISOString()}::timestamptz AND d.date_limite < ${new Date(finSemaine).toISOString()}::timestamptz
      JOIN campus.cours c ON c.id = d.cours_id AND c.statut = 'publie'
      WHERE u.id = ${e.id} AND ${sqlCoursDe(sql`d.cours_id`)} AND ${sqlDevoirProposable("d")}
        AND NOT EXISTS (SELECT 1 FROM campus.rendus r WHERE r.devoir_id = d.id AND r.etudiant_id = u.id AND r.statut IN ('rendu', 'corrige'))
        AND NOT EXISTS (SELECT 1 FROM campus.tentatives_quiz tq WHERE tq.devoir_id = d.id AND tq.etudiant_id = u.id AND tq.fin_le IS NOT NULL)
      ORDER BY d.date_limite LIMIT 5`),
    coursCompletsAOuvrir([e.id], 14, maintenant, 3),
  ]);
  const lignesDirects = directs.rows.map((l) => {
    const d = new Date(l.debut);
    return t("email.semaine.ligne.direct", {
      ...tu,
      v: { jour: formaterDate(d, { style: "jour", fuseau: e.fuseau }), heure: formaterDate(d, { style: "heure", fuseau: e.fuseau }), cours: coursCourt(l.cours), titre: l.titre },
    });
  });
  const lignesEcheances = echeances.rows.map((l) =>
    t("email.semaine.ligne.echeance", { ...tu, v: { devoir: l.titre, cours: coursCourt(l.cours), quand: quandEcheance(new Date(l.date_limite), maintenant, e.fuseau) } }),
  );
  const lignesALire = (aLire.get(e.id) ?? []).map((x) => t("email.semaine.ligne.cours_complet", { ...tu, v: { cours: coursCourt(x.cours), titre: x.titre } }));

  // La Coupe (C5) : participation de sa classe et de son campus la semaine passée. Aucun rang
  // (décision D5 : l'e-mail ne dit jamais à une classe ou à un campus qu'il est dernier) ; un taux
  // seulement s'il n'est pas nul, et pour une classe d'au moins 5 inscrits (en dessous, le taux dirait
  // ce qu'a fait un camarade). Le taux est déjà en pourcentage. Tant que la semaine n'est pas figée
  // (le lundi et le mardi, avant mercredi 1 h), les chiffres sont dits provisoires et aucun « en
  // progrès » n'est annoncé.
  const coupe = (await tableExiste("classements_semaine"))
    ? await facultatif(async () => {
        const semaine = semaineIso(ajouterJours(lundi, -7));
        const r = await db.execute<{ portee: string; inscrits: number; progression: number | null; taux: number | null; figee: boolean }>(sql`
          SELECT c.portee, c.inscrits, c.progression, round(c.taux_participation::numeric)::int AS taux, c.fige_le IS NOT NULL AS figee
          FROM campus.classements_semaine c
          WHERE c.semaine::text = ${semaine} AND ((c.portee = 'classe' AND c.cible_id = ${e.classeId ?? -1}) OR (c.portee = 'campus' AND c.cible_id = ${e.siteId ?? -1}))`);
        const montrees = r.rows
          .filter((l) => (l.taux ?? 0) > 0 && (l.portee === "campus" ? l.inscrits > 0 : l.inscrits >= COUPE.tailleMinClasse))
          .sort((x, y) => (x.portee === "classe" ? -1 : 1) - (y.portee === "classe" ? -1 : 1));
        const lignes = montrees.map((l) => {
          const classe = l.portee === "classe";
          const progres = l.figee && Math.round(Number(l.progression ?? 0)) > 0;
          const cle = classe ? (progres ? "email.semaine.ligne.classe.progres" : "email.semaine.ligne.classe") : progres ? "email.semaine.ligne.campus.progres" : "email.semaine.ligne.campus";
          return t(cle, { ...tu, v: { campus: e.site ?? "", taux: l.taux ?? 0 } });
        });
        if (lignes.length && montrees.some((l) => !l.figee)) lignes.push(t("email.semaine.coupe.provisoire", tu));
        return lignes;
      }, [] as string[])
    : [];

  const sections = [
    { titre: t("email.semaine.section.passee", tu), lignes: passee },
    { titre: t("email.semaine.section.directs", tu), lignes: lignesDirects },
    { titre: t("email.semaine.section.echeances", tu), lignes: lignesEcheances },
    { titre: t("email.semaine.section.cours_complets", tu), lignes: lignesALire },
    { titre: t("email.semaine.section.coupe", tu), lignes: coupe },
  ];
  const intro = jours > 1 ? t("email.semaine.intro.actif", { ...tu, v: { jours } }) : jours === 1 ? t("email.semaine.intro.actif.un", tu) : t("email.semaine.intro.calme", tu);
  const rien = !lignesDirects.length && !lignesEcheances.length && !lignesALire.length;
  const resume = [
    lignesDirects.length ? `${lignesDirects.length} cours en direct` : null,
    lignesEcheances.length ? (lignesEcheances.length === 1 ? "1 devoir à rendre" : `${lignesEcheances.length} devoirs à rendre`) : null,
    !lignesDirects.length && !lignesEcheances.length && lignesALire.length ? (lignesALire.length === 1 ? "1 cours complet à lire" : `${lignesALire.length} cours complets à lire`) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    sujet: resume ? t("email.semaine.sujet", { ...tu, v: { resume } }) : t("email.semaine.sujet.vide", tu),
    contenu: {
      etiquette: t("email.semaine.etiquette", {
        ...tu,
        v: {
          du: formaterDate(new Date(debutSemaine + 12 * 3_600_000), { style: "court", fuseau: e.fuseau }),
          au: formaterDate(new Date(finSemaine - 12 * 3_600_000), { style: "court", fuseau: e.fuseau }),
        },
      }),
      titre: t("email.semaine.titre", { ...tu, v: { prenom: e.prenom.trim() } }),
      apercu: t("email.semaine.apercu", tu),
      paragraphes: [intro, ...(rien ? [t("email.semaine.rien", tu)] : [])],
      sections,
      bouton: { libelle: t("email.semaine.bouton", tu), lien: bouton },
      apresBouton: [t("email.semaine.apres", tu)],
    },
  };
}

// ── Passage de l'e-mail du lundi ───────────────────────────────────────────

/**
 * Étudiants destinataires : comptes activés, adresse connue, e-mails acceptés, inscrits à au moins
 * un cours. Ceux qui l'ont reçu le moins récemment d'abord (jamais reçu en tête) : quand le plafond
 * ne suffit pas, ce ne sont pas toujours les mêmes qui attendent.
 */
async function destinataires(): Promise<(EtudiantEmail & { email: string })[]> {
  const r = await db.execute<{ id: number; prenom: string; email: string; fuseau: string | null; site_id: number | null; classe_id: number | null; site: string | null }>(sql`
    SELECT u.id, u.prenom, u.email, u.fuseau, u.site_id, u.classe_id, s.nom_court AS site
    FROM campus.utilisateurs u
    LEFT JOIN campus.sites s ON s.id = u.site_id
    LEFT JOIN campus.reglages_engagement re ON re.utilisateur_id = u.id
    WHERE u.role = 'etudiant' AND u.actif AND NOT u.doit_changer_mot_de_passe
      AND NULLIF(u.email, '') IS NOT NULL AND COALESCE(re.emails_actifs, true)
      AND (u.classe_id IS NOT NULL OR EXISTS (SELECT 1 FROM campus.inscriptions i WHERE i.utilisateur_id = u.id))
    ORDER BY (SELECT max(r.cree_le) FROM campus.relances_engagement r
        WHERE r.utilisateur_id = u.id AND r.motif = 'semaine' AND r.statut IN ('envoye', 'simulation')) ASC NULLS FIRST, u.id`);
  return r.rows.map((l) => ({ id: l.id, prenom: l.prenom, email: l.email, fuseau: l.fuseau, siteId: l.site_id, classeId: l.classe_id, site: l.site }));
}

export type BilanEmails = Partial<Record<StatutRelance, number>>;

/**
 * Un passage : envoie (ou simule) les e-mails de la semaine dus à cet instant,
 * dans la limite du plafond du jour. « maintenant » ne sert qu'aux essais.
 */
export async function passerEmailsSemaine(maintenant = Date.now()): Promise<BilanEmails> {
  const bilan: BilanEmails = {};
  const reglage = await lireReglage();
  const enEssai = reglage.emailsMode === "essai";
  const tous = (await destinataires()).map((d) => {
    const jour = jourLocal(maintenant, d.fuseau);
    return { ...d, jour, lundi: lundiDe(jour) };
  });
  const dans = tous.filter((d) => fenetreEmailSemaine(maintenant, d.fuseau, d.jour, d.lundi));
  if (!dans.length) return bilan;

  // Déjà traités cette semaine (envoyé, simulé, injoignable ou en échec : une seule tentative par semaine ; « quota » se retente).
  const faits = await db.execute<{ uid: number; jour: string }>(sql`
    SELECT utilisateur_id AS uid, jour::text AS jour FROM campus.relances_engagement
    WHERE motif = 'semaine' AND statut <> 'quota' AND jour >= ${ajouterJours(lundiDe(jourLocal(maintenant, null)), -1)}::date AND utilisateur_id = ANY(${entiers(dans.map((d) => d.id))})`);
  const lundiParId = new Map(dans.map((d) => [d.id, d.lundi]));
  const dejaFaits = new Set(faits.rows.filter((f) => f.jour >= (lundiParId.get(f.uid) ?? "9999")).map((f) => f.uid));
  // Une part du plafond reste aux e-mails des décrocheurs, qui passent l'après-midi.
  let restants = reglage.emailsParJour - reserveRelances(reglage.emailsParJour) - (await emailsDuJour(enEssai, maintenant));

  for (const d of dans) {
    if (dejaFaits.has(d.id)) continue;
    const statut: StatutRelance = restants <= 0 ? "quota" : enEssai ? "simulation" : "echec";
    const [ligne] = await db
      .insert(relancesEngagement)
      .values({ utilisateurId: d.id, jour: d.jour, motif: "semaine", canal: "email", palier: 1, statut, lien: "/accueil", siteId: d.siteId, classeId: d.classeId, creeLe: new Date(maintenant) })
      .onConflictDoNothing()
      .returning({ id: relancesEngagement.id });
    if (!ligne) continue;
    if (statut === "quota") {
      bilan.quota = (bilan.quota ?? 0) + 1;
      continue;
    }
    restants--;
    if (enEssai) {
      bilan.simulation = (bilan.simulation ?? 0) + 1;
      continue;
    }
    try {
      const { sujet, contenu } = await composerEmailSemaine(d, d.lundi, lienOuverture(ligne.id), maintenant);
      const fin = await envoyerEmailEngagement({ ligneId: ligne.id, uid: d.id, a: d.email, sujet, contenu });
      bilan[fin] = (bilan[fin] ?? 0) + 1;
    } catch (err) {
      bilan.echec = (bilan.echec ?? 0) + 1;
      console.error("[relances] e-mail de la semaine :", (err as Error).message);
    }
  }
  return bilan;
}

planifier("relances-email-semaine", 10 * MINUTE, async () => {
  await passerEmailsSemaine();
});
