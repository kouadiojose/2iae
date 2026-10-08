// Routes du chantier C4 (rappel du jour, e-mail de la semaine et relances).
// Posé vide par le socle commun (C0) et déjà branché dans routes/index.ts.
//
//   GET/PUT /api/rappels/reglages              l'étudiant règle son rappel (page « Mes rappels »)
//   GET/POST /api/emails/desabonner/:jeton     public : lien signé des e-mails, sans connexion
//   GET  /api/relances/e/:id?j=                public : bouton d'un e-mail (marqué ouvert, puis redirection)
//   GET/PUT /api/pilotage/relances-auto/reglages   direction : essai, actif ou en pause ; plafond d'e-mails
//   GET  /api/pilotage/relances-auto?etudiants=    équipe (droit « suivi ») : état des relances, périmètre de ses campus
//   GET  /api/pilotage/relances-auto/a-appeler     équipe (droit « suivi ») : 2 relances sans effet
//
// Le désabonnement et le bouton suivi sont des liens d'e-mail : ils
// répondent par une redirection vers une page du campus (jamais une page HTML
// servie depuis /api : le service worker la garderait comme coquille de l'application).
import type { Express } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { exigerRole, exigerDroit, moi, perimetreSites } from "../auth";
import { route, valider, idParam, invalide } from "../http";
import { DIRECTION, journaliser, lienWhatsApp, entreeMessage } from "./admin";
import { derniersActes, entiers, heuresHabituelles, lireReglage, oublierReglage, versDate } from "../engagement/rappel-du-jour";
import { lireJetonDesabonnement, ouvertureValide } from "../engagement/email-semaine";
import "../engagement/decrocheurs";
import { ajouterJours, jourLocal, type Jour } from "@shared/engagement/calendrier";
import {
  heureChoisieValide,
  heureEffective,
  EMAILS_PAR_JOUR_MAX,
  JOURS_PAUSE,
  MODES_EMAILS,
  MODES_RELANCES,
  MOTIFS_DECROCHEUR,
  type EtatRelanceEtudiant,
  type EtatsRelances,
  type EtudiantAAppeler,
  type LigneRelance,
  type ListeAAppeler,
  type MotifRelance,
  type CanalRelance,
  type StatutRelance,
  type ReglageRelancesDto,
  type ReglagesRappels,
  type CompteStatuts,
} from "@shared/engagement/relances";

const P = "/api/pilotage/relances-auto";
const ETUDIANT = exigerRole("etudiant");

// ── Réglages de l'étudiant ─────────────────────────────────────────────────

async function reglagesDe(uid: number, fuseau: string | null): Promise<ReglagesRappels> {
  const r = await db.execute<{
    heure_rappel: number | null;
    rappels_actifs: boolean | null;
    emails_actifs: boolean | null;
    pause_jusqu_au: string | null;
    maj_le: string | null;
    email: string | null;
    abonne: boolean;
  }>(sql`
    SELECT re.heure_rappel, re.rappels_actifs, re.emails_actifs, re.pause_jusqu_au::text AS pause_jusqu_au, re.maj_le, u.email,
      EXISTS (SELECT 1 FROM campus.abonnements_push a WHERE a.utilisateur_id = u.id) AS abonne
    FROM campus.utilisateurs u LEFT JOIN campus.reglages_engagement re ON re.utilisateur_id = u.id
    WHERE u.id = ${uid}`);
  const l = r.rows[0];
  const jour = jourLocal(Date.now(), fuseau);
  const habituelle = (await heuresHabituelles([{ id: uid, fuseau, jour }])).get(uid) ?? null;
  // Pause automatique : le dernier rappel envoyé était le message de lassitude, sans retour ni réactivation depuis.
  let pauseAutomatique = false;
  const dernier = await db.execute<{ statut: string; cree_le: string }>(sql`
    SELECT statut, cree_le FROM campus.relances_engagement
    WHERE utilisateur_id = ${uid} AND motif = 'rappel_du_jour' AND statut IN ('envoye', 'pause_auto') ORDER BY cree_le DESC LIMIT 1`);
  const d = dernier.rows[0];
  if (d?.statut === "pause_auto") {
    const le = new Date(d.cree_le);
    const acte = (await derniersActes([uid], 60)).get(uid);
    const majLe = versDate(l?.maj_le);
    pauseAutomatique = !(acte && acte > le) && !(majLe && majLe > le);
  }
  const pause = l?.pause_jusqu_au && l.pause_jusqu_au >= jour ? l.pause_jusqu_au : null;
  return {
    heureRappel: l?.heure_rappel ?? null,
    heureAutomatique: heureEffective(null, habituelle),
    rappelsActifs: l?.rappels_actifs ?? true,
    emailsActifs: l?.emails_actifs ?? true,
    pauseJusquAu: pause,
    pauseAutomatique,
    aUneAdresse: Boolean(l?.email?.trim()),
    telephoneAbonne: Boolean(l?.abonne),
  };
}

/** Le compte existe encore (un lien d'e-mail peut survivre à la suppression du compte). */
const etudiantExiste = async (uid: number) => (await db.execute(sql`SELECT 1 FROM campus.utilisateurs WHERE id = ${uid}`)).rows.length > 0;

/** Écrit les choix donnés (les autres gardent leur valeur) ; maj_le change toujours (lève la pause automatique). */
async function ecrireReglages(uid: number, champs: { heureRappel?: number | null; rappelsActifs?: boolean; emailsActifs?: boolean; pauseJusquAu?: Jour | null }) {
  const has = (k: keyof typeof champs) => Object.prototype.hasOwnProperty.call(champs, k);
  await db.execute(sql`
    INSERT INTO campus.reglages_engagement (utilisateur_id, heure_rappel, rappels_actifs, emails_actifs, pause_jusqu_au, maj_le)
    VALUES (${uid}, ${champs.heureRappel ?? null}, ${champs.rappelsActifs ?? true}, ${champs.emailsActifs ?? true}, ${champs.pauseJusquAu ?? null}::date, now())
    ON CONFLICT (utilisateur_id) DO UPDATE SET
      heure_rappel = ${has("heureRappel") ? sql`EXCLUDED.heure_rappel` : sql`campus.reglages_engagement.heure_rappel`},
      rappels_actifs = ${has("rappelsActifs") ? sql`EXCLUDED.rappels_actifs` : sql`campus.reglages_engagement.rappels_actifs`},
      emails_actifs = ${has("emailsActifs") ? sql`EXCLUDED.emails_actifs` : sql`campus.reglages_engagement.emails_actifs`},
      pause_jusqu_au = ${has("pauseJusquAu") ? sql`EXCLUDED.pause_jusqu_au` : sql`campus.reglages_engagement.pause_jusqu_au`},
      maj_le = now()`);
}

// ── Pilotage ───────────────────────────────────────────────────────────────

type LigneBrute = { id: number; uid: number; jour: string; motif: MotifRelance; canal: CanalRelance; palier: number; statut: StatutRelance; cree_le: string; ouvert_le: string | null; revenu_le: string | null };
const versLigne = (l: LigneBrute): LigneRelance => ({
  id: l.id,
  jour: l.jour,
  motif: l.motif,
  canal: l.canal,
  palier: l.palier,
  statut: l.statut,
  creeLe: new Date(l.cree_le).toISOString(),
  ouvertLe: l.ouvert_le ? new Date(l.ouvert_le).toISOString() : null,
  revenuLe: l.revenu_le ? new Date(l.revenu_le).toISOString() : null,
});

/** Relances des décrocheurs et e-mails de la semaine des étudiants donnés (90 jours, 10 par étudiant), et leur état. */
async function etatsDe(uids: number[]): Promise<Record<number, EtatRelanceEtudiant>> {
  const etats: Record<number, EtatRelanceEtudiant> = {};
  if (!uids.length) return etats;
  const r = await db.execute<LigneBrute & { rang: number }>(sql`
    SELECT * FROM (
      SELECT id, utilisateur_id AS uid, jour::text AS jour, motif, canal, palier, statut, cree_le, ouvert_le, revenu_le,
        row_number() OVER (PARTITION BY utilisateur_id ORDER BY cree_le DESC) AS rang
      FROM campus.relances_engagement
      WHERE utilisateur_id = ANY(${entiers(uids)}) AND motif <> 'rappel_du_jour' AND cree_le > now() - interval '90 days'
    ) x WHERE rang <= 10 ORDER BY uid, cree_le DESC`);
  const actes = await derniersActes(uids, 90);
  for (const uid of uids) etats[uid] = { etat: "aucune", derniere: null, historique: [] };
  for (const l of r.rows) etats[l.uid].historique.push(versLigne(l));
  for (const uid of uids) {
    const e = etats[uid];
    const derniere = e.historique.find((h) => (MOTIFS_DECROCHEUR as readonly string[]).includes(h.motif)) ?? null;
    e.derniere = derniere;
    if (!derniere) continue;
    const acte = actes.get(uid);
    const revenu = Boolean(derniere.revenuLe) || Boolean(acte && acte > new Date(derniere.creeLe));
    e.etat = derniere.palier >= 3 && !revenu ? "a_appeler" : revenu ? "revenu" : "relance";
  }
  return etats;
}

/**
 * Étudiants « à appeler » d'un périmètre : palier 3 atteint depuis 60 jours au
 * plus, et aucun acte d'apprentissage depuis (il serait revenu).
 */
async function etudiantsAAppeler(p: number[] | null) {
  const r = await db.execute<{
    uid: number;
    cree_le: string;
    statut: StatutRelance;
    prenom: string;
    nom: string;
    matricule: string | null;
    telephone: string | null;
    classe: string | null;
    site_id: number | null;
    site: string | null;
  }>(sql`
    SELECT DISTINCT ON (r.utilisateur_id) r.utilisateur_id AS uid, r.cree_le, r.statut,
      u.prenom, u.nom, u.matricule, u.telephone, c.nom AS classe, u.site_id, s.nom_court AS site
    FROM campus.relances_engagement r
    JOIN campus.utilisateurs u ON u.id = r.utilisateur_id AND u.actif AND u.role = 'etudiant'
    LEFT JOIN campus.classes c ON c.id = u.classe_id
    LEFT JOIN campus.sites s ON s.id = u.site_id
    WHERE r.palier = 3 AND r.cree_le > now() - interval '60 days' ${p ? sql`AND u.site_id = ANY(${entiers(p)})` : sql``}
    ORDER BY r.utilisateur_id, r.cree_le DESC`);
  const actes = await derniersActes(
    r.rows.map((l) => l.uid),
    60,
  );
  const restants = r.rows.filter((l) => {
    const acte = actes.get(l.uid);
    return !(acte && acte > new Date(l.cree_le));
  });
  return { restants, actes };
}

const compter = (lignes: { statut: StatutRelance; n: number }[]): CompteStatuts => Object.fromEntries(lignes.map((l) => [l.statut, l.n]));

export function enregistrerRelancesAuto(app: Express) {
  // ── L'étudiant ───────────────────────────────────────────────────────────

  app.get(
    "/api/rappels/reglages",
    ETUDIANT,
    route(async (req, res) => {
      const u = moi(req);
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(await reglagesDe(u.id, u.fuseau));
    }),
  );

  app.put(
    "/api/rappels/reglages",
    ETUDIANT,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(
        z
          .object({
            heureRappel: z.union([z.null(), z.number().refine(heureChoisieValide, "heure entre 7 h et 20 h 30, par quart d'heure")]).optional(),
            rappelsActifs: z.boolean().optional(),
            emailsActifs: z.boolean().optional(),
            pause: z.boolean().optional(),
          })
          .strict(),
        req.body ?? {},
      );
      const jour = jourLocal(Date.now(), u.fuseau);
      await ecrireReglages(u.id, {
        ...(d.heureRappel !== undefined ? { heureRappel: d.heureRappel } : {}),
        ...(d.rappelsActifs !== undefined ? { rappelsActifs: d.rappelsActifs } : {}),
        ...(d.emailsActifs !== undefined ? { emailsActifs: d.emailsActifs } : {}),
        ...(d.pause !== undefined ? { pauseJusquAu: d.pause ? ajouterJours(jour, JOURS_PAUSE - 1) : null } : {}),
      });
      res.json(await reglagesDe(u.id, u.fuseau));
    }),
  );

  // ── Liens des e-mails (publics, sans connexion) ──────────────────────────

  // Un geste depuis l'e-mail : le désabonnement est fait, la page du campus le confirme et propose de revenir.
  app.get(
    "/api/emails/desabonner/:jeton",
    route(async (req, res) => {
      const jeton = String(req.params.jeton);
      const uid = lireJetonDesabonnement(jeton);
      if (!uid || !(await etudiantExiste(uid))) return res.redirect(303, "/desabonnement?etat=invalide");
      await ecrireReglages(uid, { emailsActifs: false });
      res.redirect(303, `/desabonnement?etat=fait&j=${encodeURIComponent(jeton)}`);
    }),
  );

  // Désabonnement en un geste depuis la messagerie (List-Unsubscribe-Post, RFC 8058), ou choix de la page du campus.
  app.post(
    "/api/emails/desabonner/:jeton",
    route(async (req, res) => {
      const uid = lireJetonDesabonnement(String(req.params.jeton));
      if (!uid || !(await etudiantExiste(uid))) throw invalide("Lien de désabonnement invalide.");
      const reabonner = (req.body as { action?: unknown } | undefined)?.action === "reabonner";
      await ecrireReglages(uid, { emailsActifs: reabonner });
      res.json({ etat: reabonner ? "reabonne" : "fait" });
    }),
  );

  // Bouton d'un e-mail : marqué ouvert (s'il est authentique), puis la page proposée.
  app.get(
    "/api/relances/e/:id(\\d+)",
    route(async (req, res) => {
      const id = idParam(req);
      let destination = "/accueil";
      if (ouvertureValide(id, req.query.j)) {
        const r = await db.execute<{ lien: string | null }>(
          sql`UPDATE campus.relances_engagement SET ouvert_le = COALESCE(ouvert_le, now()) WHERE id = ${id} AND canal = 'email' RETURNING lien`,
        );
        const lien = r.rows[0]?.lien;
        if (lien && /^\/(?!\/)[\w\-/?=&.%]*$/.test(lien)) destination = lien;
      }
      res.setHeader("Cache-Control", "no-store");
      res.redirect(302, destination);
    }),
  );

  // ── Pilotage ─────────────────────────────────────────────────────────────

  app.get(
    `${P}/reglages`,
    DIRECTION,
    route(async (_req, res) => {
      const r = await lireReglage();
      const qui = r.majPar
        ? (await db.execute<{ nom: string }>(sql`SELECT prenom || ' ' || nom AS nom FROM campus.utilisateurs WHERE id = ${r.majPar}`)).rows[0]?.nom ?? null
        : null;
      const parGroupe = await db.execute<{ groupe: string; statut: StatutRelance; n: number }>(sql`
        SELECT CASE WHEN motif = 'rappel_du_jour' THEN 'rappels' WHEN motif = 'semaine' THEN 'semaine' ELSE 'relances' END AS groupe, statut, count(*)::int AS n
        FROM campus.relances_engagement WHERE cree_le > now() - interval '7 days' GROUP BY 1, 2`);
      const groupe = (g: string) => compter(parGroupe.rows.filter((l) => l.groupe === g));
      const chiffres = await db.execute<{ emails: number; revenus: number; comptees: number }>(sql`
        SELECT
          (SELECT count(*) FROM campus.relances_engagement WHERE canal = 'email' AND statut = 'envoye' AND cree_le >= date_trunc('day', now()))::int AS emails,
          count(*) FILTER (WHERE revenu_le IS NOT NULL)::int AS revenus,
          count(*)::int AS comptees
        FROM campus.relances_engagement
        WHERE motif IN ('inactif', 'devoir_non_rendu', 'lives_manques') AND palier < 3 AND statut IN ('envoye', 'simulation') AND cree_le > now() - interval '7 days'`);
      const aAppeler = (await etudiantsAAppeler(null)).restants.length;
      const c = chiffres.rows[0];
      const dto: ReglageRelancesDto = {
        mode: r.mode,
        rappelsMode: r.rappelsMode,
        emailsMode: r.emailsMode,
        emailsParJour: r.emailsParJour,
        majLe: r.majLe?.toISOString() ?? null,
        majPar: qui,
        bilan: {
          rappels: groupe("rappels"),
          relances: groupe("relances"),
          emailsSemaine: groupe("semaine"),
          emailsAujourdhui: c?.emails ?? 0,
          revenus: c?.revenus ?? 0,
          relancesComptees: c?.comptees ?? 0,
          aAppeler,
        },
      };
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(dto);
    }),
  );

  app.put(
    `${P}/reglages`,
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(
        z
          .object({
            mode: z.enum(MODES_RELANCES).optional(),
            rappelsMode: z.enum(MODES_RELANCES).optional(),
            emailsMode: z.enum(MODES_EMAILS).optional(),
            emailsParJour: z.number().int().min(0).max(EMAILS_PAR_JOUR_MAX).optional(),
          })
          .strict(),
        req.body ?? {},
      );
      const a = await lireReglage();
      const n = { mode: d.mode ?? a.mode, rappelsMode: d.rappelsMode ?? a.rappelsMode, emailsMode: d.emailsMode ?? a.emailsMode, emailsParJour: d.emailsParJour ?? a.emailsParJour };
      await db.execute(sql`
        INSERT INTO campus.reglage_relances (id, mode, rappels_mode, emails_mode, emails_par_jour, maj_par, maj_le)
        VALUES (1, ${n.mode}, ${n.rappelsMode}, ${n.emailsMode}, ${n.emailsParJour}, ${u.id}, now())
        ON CONFLICT (id) DO UPDATE SET mode = EXCLUDED.mode, rappels_mode = EXCLUDED.rappels_mode, emails_mode = EXCLUDED.emails_mode,
          emails_par_jour = EXCLUDED.emails_par_jour, maj_par = EXCLUDED.maj_par, maj_le = now()`);
      oublierReglage();
      await journaliser(u, "relances_reglage", { avant: { mode: a.mode, rappelsMode: a.rappelsMode, emailsMode: a.emailsMode, emailsParJour: a.emailsParJour }, apres: n });
      res.json({ ok: true });
    }),
  );

  // État des relances des étudiants affichés (une page de « Qui décroche ? »), dans le périmètre de la personne.
  app.get(
    P,
    exigerDroit("suivi"),
    route(async (req, res) => {
      const u = moi(req);
      const { etudiants } = valider(z.object({ etudiants: z.string().max(1200).default("") }), req.query);
      const demandes = [...new Set(etudiants.split(",").map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 100);
      const p = perimetreSites(u);
      const permis = demandes.length
        ? (
            await db.execute<{ id: number }>(sql`
              SELECT id FROM campus.utilisateurs WHERE id = ANY(${entiers(demandes)}) AND role = 'etudiant'
                ${p ? sql`AND site_id = ANY(${entiers(p)})` : sql``}`)
          ).rows.map((l) => l.id)
        : [];
      const r = await lireReglage();
      const dto: EtatsRelances = { mode: r.mode, rappelsMode: r.rappelsMode, emailsMode: r.emailsMode, etudiants: await etatsDe(permis) };
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(dto);
    }),
  );

  // « À appeler » : palier 3 atteint et pas de retour depuis. La vie scolaire prend le relais.
  app.get(
    `${P}/a-appeler`,
    exigerDroit("suivi"),
    route(async (req, res) => {
      const { restants, actes } = await etudiantsAAppeler(perimetreSites(moi(req)));
      const etats = await etatsDe(restants.map((l) => l.uid));
      const reglage = await lireReglage();
      const lignes: EtudiantAAppeler[] = restants
        .map((l) => ({
          etudiant: { id: l.uid, prenom: l.prenom, nom: l.nom, matricule: l.matricule, telephone: l.telephone, classe: l.classe, siteId: l.site_id, site: l.site },
          depuis: new Date(l.cree_le).toISOString(),
          dernierActe: actes.get(l.uid)?.toISOString() ?? null,
          essai: l.statut === "simulation",
          whatsapp: l.telephone
            ? lienWhatsApp(
                l.telephone,
                `${entreeMessage(l.prenom, l.site)} On ne t'a pas vu sur le campus numérique depuis quelques jours. Tout va bien ? Si quelque chose t'empêche de suivre (réseau, téléphone, code secret), dis-le-nous : on trouvera une solution.`,
              )
            : null,
          etat: etats[l.uid],
        }))
        .sort((a, b) => a.depuis.localeCompare(b.depuis));
      const dto: ListeAAppeler = { mode: reglage.mode, rappelsMode: reglage.rappelsMode, emailsMode: reglage.emailsMode, lignes };
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(dto);
    }),
  );
}
