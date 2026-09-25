// Vie scolaire et direction : tableau de pilotage, « à contacter », comptes,
// import depuis Excel, fiches de connexion, classes, campus, planning des
// lives, présences, site 2iae.com, dossier étudiant, relevé parent, budget IA.
//
// Règles du module :
// - toutes les routes /api/pilotage exigent la direction ou la vie scolaire ;
// - perimetreSites(u) s'applique PARTOUT : la vie scolaire d'un campus ne voit
//   et ne modifie que son campus (les formateurs, sans campus, sont communs au
//   groupe ; les comptes de la direction ne sont gérés que par la direction) ;
// - une ressource hors périmètre répond 404 : on ne révèle pas qu'elle existe ;
// - les actions sensibles vont au journal ;
// - seule route publique : GET /api/releve/:jeton (relevé pour les parents),
//   qui ne renvoie que le strict nécessaire.
import type { Express, RequestHandler } from "express";
import crypto from "crypto";
import { z } from "zod";
import { and, asc, desc, eq, gte, ilike, inArray, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { config } from "../config";
import {
  exigerRole,
  moi,
  perimetreSites,
  hacher,
  codeProvisoire,
  motDePasseProvisoire,
  DUREE_CODE_PROVISOIRE_MS,
  normaliserTelephone,
  fermerAutresSessions,
  oublierUtilisateur,
} from "../auth";
import { creerJeton, lienActivation, reinitialiserCode } from "../activation";
import { route, valider, idParam, ErreurHttp, introuvable, interdit, invalide } from "../http";
import { prevenirSite } from "../site";
import { iaDisponible } from "../ia";
import { lireVitrine, oublierVitrine } from "./public";
import {
  ROLES,
  utilisateurs,
  sites,
  classes,
  suivis,
  journal,
  cours,
  coursClasses,
  seances,
  presences,
  effectifsSalles,
  annonces,
  evenements,
  usageIa,
  SEUIL_PRESENCE_EN_LIGNE,
  RETARD_MINUTES,
  PRIX_IA,
  STATUTS_PRESENCE_PILOTAGE,
  LIBELLES_PRESENCE_PILOTAGE,
  comptePresent,
  type Role,
  type Utilisateur,
  type StatutPresencePilotage,
  type IndicateursCampus,
  type TableauPilotage,
  type TypeRaisonContact,
  type RaisonContact,
  type AContacter,
  type ListeAContacter,
  type EtudiantResume,
  type CompteLigne,
  type PageComptes,
  type CodeRemis,
  type CompteCree,
  type LigneImport,
  type ApercuImport,
  type FicheConnexion,
  type LotFiches,
  type ClasseLigne,
  type SiteLigne,
  type ReferencesPilotage,
  type FormateurOption,
  type SeancePlanning,
  type ConflitSalle,
  type PlanningSemaine,
  type ResumePresences,
  type SeancePresenceLigne,
  type ListePresences,
  type PresenceEtudiant,
  type PresencesCampus,
  type PresencesSeance,
  type LignePresenceEtudiant,
  type PresencesDEtudiant,
  type ElementSite,
  type EtatSite,
  type TypePublication,
  type MoyenneCours,
  type DevoirDossier,
  type DossierEtudiant,
  type ReleveCree,
  type ReleveParent,
  type ConsommationIa,
  type BudgetIa,
} from "@shared/schema";

// ── Outils communs ─────────────────────────────────────────────────────────

const P = "/api/pilotage";
const EQUIPE = exigerRole("admin", "vie_scolaire");
/** Réservé à la direction (vouvoiement : la personne est forcément de l'équipe). */
const DIRECTION: RequestHandler = (req, res, next) => {
  if (!req.utilisateur) return res.status(401).json({ message: "Connectez-vous pour continuer." });
  if (req.utilisateur.role !== "admin") return res.status(403).json({ message: "Réservé à la direction." });
  next();
};

type Perimetre = number[] | null;

const JOUR_MS = 86_400_000;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const pourcent = (n: number, sur: number) => (sur > 0 ? Math.round((n / sur) * 100) : null);
const arrondi1 = (n: number) => Math.round(n * 10) / 10;

/** Tableau d'entiers PostgreSQL passé en un seul paramètre (« = ANY(…) »). */
const entiers = (ids: number[]) => sql`${`{${ids.map((i) => Math.trunc(i)).join(",")}}`}::int[]`;

const fmtJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });
const fmtJourCourt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Abidjan" });
const jour = (d: Date | string) => fmtJour.format(new Date(d));
const jourCourt = (d: Date | string) => fmtJourCourt.format(new Date(d));

async function journaliser(u: Pick<Utilisateur, "id">, action: string, details: Record<string, unknown> = {}) {
  await db.insert(journal).values({ utilisateurId: u.id, action, details });
}

/** Numéro pour wa.me : un numéro ivoirien (10 chiffres) reçoit l'indicatif 225. */
function numeroWhatsApp(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const n = normaliserTelephone(tel);
  if (n.length === 10) return `225${n}`;
  if (n.length >= 11 && n.length <= 15) return n; // déjà international (France, etc.)
  return null;
}

/** Lien WhatsApp avec un message prêt ; sans numéro, WhatsApp demande à qui l'envoyer. */
function lienWhatsApp(tel: string | null | undefined, texte: string): string {
  return `https://wa.me/${numeroWhatsApp(tel) ?? ""}?text=${encodeURIComponent(texte)}`;
}

/** « Bonjour Aya, c'est la vie scolaire du campus Yopougon (2IAE). » */
const entreeMessage = (prenom: string, site: string | null) =>
  `Bonjour ${prenom}, c'est la vie scolaire ${site ? `du campus ${site} ` : ""}(2IAE).`;

/** Enlève accents, casse et ponctuation : « Prénom(s) » → « prenoms ». */
const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const ACCENTS = "áàâäãåéèêëíìîïóòôöõúùûüýÿçñ";
const SANS_ACCENTS = "aaaaaaeeeeiiiiooooouuuuyycn";
/** Minuscules sans accents (côté serveur) : « Koné » → « kone ». */
const sansAccents = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
/** Même transformation en SQL, sans extension PostgreSQL. */
const sqlSansAccents = (x: SQL) => sql`translate(lower(${x}), ${ACCENTS}, ${SANS_ACCENTS})`;

/** Lundi 00 h (heure d'Abidjan = UTC) de la semaine qui contient cette date. */
function lundiDe(brut: unknown): Date {
  let d = new Date();
  if (typeof brut === "string" && brut) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(brut)) throw invalide("Semaine invalide (format attendu : 2026-09-28).");
    d = new Date(`${brut}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) throw invalide("Semaine invalide (format attendu : 2026-09-28).");
  }
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

// ── Périmètre ──────────────────────────────────────────────────────────────

/** La personne peut-elle gérer ce compte ? */
function peutGerer(u: Utilisateur, cible: Pick<Utilisateur, "role" | "siteId">): boolean {
  if (u.role === "admin") return true;
  if (cible.role === "admin") return false;
  const p = perimetreSites(u);
  if (!p) return true;
  if (cible.role === "formateur") return true; // les formateurs n'ont pas de campus
  return cible.siteId !== null && p.includes(cible.siteId);
}

/** Compte géré par la personne, sinon 404 (on ne révèle pas qu'il existe). */
async function compteGere(u: Utilisateur, id: number): Promise<Utilisateur> {
  const [c] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, id));
  if (!c || !peutGerer(u, c)) throw introuvable("Compte");
  return c;
}

/** Étudiant du périmètre, sinon 404. */
async function etudiantGere(u: Utilisateur, id: number): Promise<Utilisateur> {
  const c = await compteGere(u, id);
  if (c.role !== "etudiant") throw introuvable("Étudiant");
  return c;
}

/** Condition « le site est dans le périmètre » sur une colonne (aucune pour la direction). */
function surSites(colonne: typeof utilisateurs.siteId | typeof classes.siteId | typeof sites.id, p: Perimetre): SQL | undefined {
  return p ? inArray(colonne, p) : undefined;
}

/** Classe du périmètre, sinon 404. */
async function classeGeree(u: Utilisateur, id: number) {
  const [c] = await db.select().from(classes).where(eq(classes.id, id));
  const p = perimetreSites(u);
  if (!c || (p && !p.includes(c.siteId))) throw introuvable("Classe");
  return c;
}

/** Vérifie qu'un campus existe et appartient au périmètre. */
async function siteGere(u: Utilisateur, id: number) {
  const [s] = await db.select().from(sites).where(eq(sites.id, id));
  const p = perimetreSites(u);
  if (!s || (p && !p.includes(s.id))) throw interdit("Ce campus n'est pas dans votre périmètre.");
  return s;
}

// ── Présences : une seule règle, écrite une fois (CONCEPTION §9.7) ─────────

type FiltreAttendus = {
  seanceId?: number;
  etudiantId?: number;
  depuis?: Date;
  jusqua?: Date;
  sites: Perimetre;
  /** Séances commencées mais pas finies (statuts provisoires). */
  inclureEnCours?: boolean;
  /** Séances à venir (fiche d'une séance pas encore commencée). */
  inclureAVenir?: boolean;
};

/**
 * Une ligne par (séance, étudiant attendu) avec son statut de présence :
 * émargé (QR ou code en salle) · pointé par le responsable · présent en ligne
 * (≥ 70 % de la durée) · absent justifié · incident de salle · partiel ·
 * absent. La durée de référence est la durée prévue, ou la durée réelle si la
 * séance a été plus courte. Un étudiant inscrit après la séance n'y est pas
 * attendu.
 */
function sqlAttendus(f: FiltreAttendus): SQL {
  const conds: SQL[] = [sql`s.statut <> 'annulee'`, sql`c.statut <> 'brouillon'`];
  if (f.seanceId !== undefined) conds.push(sql`s.id = ${f.seanceId}`);
  if (f.etudiantId !== undefined) conds.push(sql`u.id = ${f.etudiantId}`);
  else conds.push(sql`u.actif`);
  if (f.depuis) conds.push(sql`s.debut >= ${f.depuis.toISOString()}::timestamptz`);
  if (f.jusqua) conds.push(sql`s.debut < ${f.jusqua.toISOString()}::timestamptz`);
  if (!f.inclureAVenir) {
    conds.push(f.inclureEnCours ? sql`s.debut <= now()` : sql`s.debut + make_interval(mins => s.duree_minutes) <= now()`);
  }
  if (f.sites) conds.push(sql`u.site_id = ANY(${entiers(f.sites)})`);
  return sql`
    SELECT s.id AS seance_id, s.cours_id, s.debut, s.titre AS seance_titre, c.code AS cours_code,
      u.id AS uid, u.site_id,
      COALESCE(p.minutes, 0)::int AS minutes, p.arrivee_le, p.justification,
      CASE
        WHEN p.emarge_qr THEN 'emarge'
        WHEN p.pointe_par_id IS NOT NULL THEN 'pointe'
        WHEN p.mode = 'salle' THEN 'emarge'
        WHEN p.minutes >= ${SEUIL_PRESENCE_EN_LIGNE}::float8 * d.duree THEN 'en_ligne'
        WHEN p.justification IS NOT NULL THEN 'justifie'
        WHEN e.incident IS NOT NULL THEN 'incident'
        WHEN p.minutes > 0 THEN 'partiel'
        ELSE 'absent'
      END AS statut,
      COALESCE(p.mode = 'salle' AND p.arrivee_le > s.debut + make_interval(mins => ${sql.raw(String(RETARD_MINUTES))}), false) AS retard
    FROM campus.seances s
    JOIN campus.cours c ON c.id = s.cours_id
    CROSS JOIN LATERAL (
      SELECT GREATEST(1, LEAST(s.duree_minutes::float8,
        COALESCE(EXTRACT(EPOCH FROM (s.terminee_le - s.demarree_le))::float8 / 60, s.duree_minutes::float8))) AS duree
    ) d
    JOIN campus.utilisateurs u ON u.role = 'etudiant'
      AND u.cree_le <= s.debut + make_interval(mins => s.duree_minutes)
      AND (u.classe_id IN (SELECT cc.classe_id FROM campus.cours_classes cc WHERE cc.cours_id = s.cours_id)
        OR EXISTS (SELECT 1 FROM campus.inscriptions i WHERE i.cours_id = s.cours_id AND i.utilisateur_id = u.id))
    LEFT JOIN campus.presences p ON p.seance_id = s.id AND p.utilisateur_id = u.id
    LEFT JOIN campus.effectifs_salles e ON e.seance_id = s.id AND e.site_id = u.site_id
    WHERE ${sql.join(conds, sql` AND `)}`;
}

type LigneAttendu = {
  seance_id: number;
  cours_id: number;
  debut: Date;
  seance_titre: string;
  cours_code: string;
  uid: number;
  site_id: number | null;
  minutes: number;
  arrivee_le: Date | null;
  justification: string | null;
  statut: StatutPresencePilotage;
  retard: boolean;
};

/** Colonnes d'agrégat d'un résumé de présences (sur un sous-ensemble de sqlAttendus). */
const COLONNES_RESUME = sql.raw(
  [
    "count(*)::int AS attendus",
    ...STATUTS_PRESENCE_PILOTAGE.map((s) => `count(*) FILTER (WHERE statut = '${s}')::int AS ${s}`),
  ].join(", "),
);

type LigneResume = { attendus: number } & Record<StatutPresencePilotage, number>;

function versResume(l: Partial<LigneResume> | undefined): ResumePresences {
  const r = {
    attendus: l?.attendus ?? 0,
    emarge: l?.emarge ?? 0,
    pointe: l?.pointe ?? 0,
    en_ligne: l?.en_ligne ?? 0,
    justifie: l?.justifie ?? 0,
    incident: l?.incident ?? 0,
    partiel: l?.partiel ?? 0,
    absent: l?.absent ?? 0,
  };
  const presents = r.emarge + r.pointe + r.en_ligne;
  return { ...r, presents, taux: pourcent(presents, r.attendus - r.justifie - r.incident) };
}

/** Résume une liste de lignes déjà chargées. */
function resumeDe(lignes: { statut: StatutPresencePilotage }[]): ResumePresences {
  const compte: Partial<LigneResume> = { attendus: lignes.length };
  for (const s of STATUTS_PRESENCE_PILOTAGE) compte[s] = lignes.filter((l) => l.statut === s).length;
  return versResume(compte);
}

/**
 * Devoirs échus (publiés, d'un cours ouvert) et, pour chaque étudiant
 * attendu, s'il l'a rendu : copie rendue ou corrigée, ou interrogation terminée.
 */
function sqlDevoirsAttendus(f: { depuis: Date; sites: Perimetre; etudiantId?: number }): SQL {
  const conds: SQL[] = [
    sql`d.publie`,
    sql`c.statut <> 'brouillon'`,
    sql`d.date_limite < now()`,
    sql`d.date_limite >= ${f.depuis.toISOString()}::timestamptz`,
    sql`u.cree_le < d.date_limite`,
  ];
  if (f.etudiantId !== undefined) conds.push(sql`u.id = ${f.etudiantId}`);
  else conds.push(sql`u.actif`);
  if (f.sites) conds.push(sql`u.site_id = ANY(${entiers(f.sites)})`);
  return sql`
    SELECT d.id AS devoir_id, d.titre, d.date_limite, d.accepte_retard, c.code AS cours_code, u.id AS uid, u.site_id,
      (EXISTS (SELECT 1 FROM campus.rendus r WHERE r.devoir_id = d.id AND r.etudiant_id = u.id AND r.statut IN ('rendu', 'corrige'))
        OR EXISTS (SELECT 1 FROM campus.tentatives_quiz t WHERE t.devoir_id = d.id AND t.etudiant_id = u.id AND t.fin_le IS NOT NULL)) AS rendu
    FROM campus.devoirs d
    JOIN campus.cours c ON c.id = d.cours_id
    JOIN campus.utilisateurs u ON u.role = 'etudiant'
      AND (u.classe_id IN (SELECT cc.classe_id FROM campus.cours_classes cc WHERE cc.cours_id = d.cours_id)
        OR EXISTS (SELECT 1 FROM campus.inscriptions i WHERE i.cours_id = d.cours_id AND i.utilisateur_id = u.id))
    WHERE ${sql.join(conds, sql` AND `)}`;
}

/**
 * Dernière activité de chaque personne sur le campus. La date de connexion
 * seule ne suffit pas (les sessions durent 90 jours) : on prend aussi la
 * dernière présence à un live, copie rendue, message, leçon terminée,
 * annonce lue, interrogation, conversation avec l'assistant.
 */
const SQL_DERNIERE_ACTIVITE = sql`
  SELECT uid, max(t) AS t FROM (
    SELECT id AS uid, derniere_connexion AS t FROM campus.utilisateurs WHERE role = 'etudiant'
    UNION ALL SELECT utilisateur_id, max(derniere_activite) FROM campus.presences WHERE minutes > 0 OR emarge_qr OR mode = 'salle' GROUP BY 1
    UNION ALL SELECT etudiant_id, max(rendu_le) FROM campus.rendus GROUP BY 1
    UNION ALL SELECT auteur_id, max(cree_le) FROM campus.messages GROUP BY 1
    UNION ALL SELECT utilisateur_id, max(terminee_le) FROM campus.progressions GROUP BY 1
    UNION ALL SELECT utilisateur_id, max(lu_le) FROM campus.lectures_annonces GROUP BY 1
    UNION ALL SELECT etudiant_id, max(debut_le) FROM campus.tentatives_quiz GROUP BY 1
    UNION ALL SELECT utilisateur_id, max(maj_le) FROM campus.conversations_ia GROUP BY 1
  ) x GROUP BY uid`;

async function derniereActivite(ids: number[]): Promise<Map<number, Date>> {
  if (!ids.length) return new Map();
  const r = await db.execute<{ uid: number; t: Date | null }>(
    sql`SELECT a.uid, a.t FROM (${SQL_DERNIERE_ACTIVITE}) a WHERE a.uid = ANY(${entiers(ids)})`,
  );
  const m = new Map<number, Date>();
  for (const l of r.rows) if (l.t) m.set(l.uid, new Date(l.t));
  return m;
}

// ── Notes : moyennes sur 20, pondérées par les coefficients ────────────────

type NoteDevoir = {
  devoir_id: number;
  cours_id: number;
  cours_code: string;
  cours_titre: string;
  titre: string;
  type: "depot" | "quiz";
  date_limite: Date;
  bareme: number;
  coefficient: number;
  statut_rendu: string | null;
  en_retard: boolean | null;
  note_rendu: number | null;
  note_quiz: number | null;
  quiz_fini: boolean;
};

/** Devoirs publiés des cours de l'étudiant, avec sa copie ou sa meilleure interrogation. */
async function devoirsDe(etudiantId: number): Promise<NoteDevoir[]> {
  const r = await db.execute<NoteDevoir>(sql`
    SELECT d.id AS devoir_id, c.id AS cours_id, c.code AS cours_code, c.titre AS cours_titre, d.titre, d.type,
      d.date_limite, d.bareme::float8 AS bareme, d.coefficient::float8 AS coefficient,
      r.statut AS statut_rendu, r.en_retard, r.note::float8 AS note_rendu,
      (SELECT max(t.note)::float8 FROM campus.tentatives_quiz t WHERE t.devoir_id = d.id AND t.etudiant_id = u.id AND t.fin_le IS NOT NULL) AS note_quiz,
      EXISTS (SELECT 1 FROM campus.tentatives_quiz t WHERE t.devoir_id = d.id AND t.etudiant_id = u.id AND t.fin_le IS NOT NULL) AS quiz_fini
    FROM campus.utilisateurs u
    JOIN campus.devoirs d ON d.publie
    JOIN campus.cours c ON c.id = d.cours_id AND c.statut <> 'brouillon'
    LEFT JOIN campus.rendus r ON r.devoir_id = d.id AND r.etudiant_id = u.id
    WHERE u.id = ${etudiantId}
      AND (u.classe_id IN (SELECT cc.classe_id FROM campus.cours_classes cc WHERE cc.cours_id = d.cours_id)
        OR EXISTS (SELECT 1 FROM campus.inscriptions i WHERE i.cours_id = d.cours_id AND i.utilisateur_id = u.id))
    ORDER BY d.date_limite DESC`);
  return r.rows;
}

/** Note retenue pour un devoir : la copie corrigée, sinon la meilleure interrogation terminée. */
function noteRetenue(d: NoteDevoir): number | null {
  if (d.statut_rendu === "corrige" && d.note_rendu !== null) return d.note_rendu;
  if (d.type === "quiz" && d.note_quiz !== null) return d.note_quiz;
  return null;
}

function moyennesDe(devoirs: NoteDevoir[]): { cours: MoyenneCours[]; generale: number | null } {
  const parCours = new Map<number, MoyenneCours & { somme: number; poids: number }>();
  for (const d of devoirs) {
    let c = parCours.get(d.cours_id);
    if (!c) {
      c = { coursId: d.cours_id, code: d.cours_code, titre: d.cours_titre, moyenne: null, notes: 0, somme: 0, poids: 0 };
      parCours.set(d.cours_id, c);
    }
    const n = noteRetenue(d);
    if (n === null || !d.bareme) continue;
    c.somme += (n / d.bareme) * 20 * d.coefficient;
    c.poids += d.coefficient;
    c.notes++;
  }
  const liste = [...parCours.values()].map(({ somme, poids, ...c }) => ({ ...c, moyenne: poids > 0 ? arrondi1(somme / poids) : null }));
  const notees = liste.filter((c) => c.moyenne !== null);
  const generale = notees.length ? arrondi1(notees.reduce((s, c) => s + (c.moyenne ?? 0), 0) / notees.length) : null;
  return { cours: liste.sort((a, b) => a.code.localeCompare(b.code)), generale };
}

// ── À contacter (« Qui décroche ? ») ───────────────────────────────────────

const ORDRE_RAISONS: TypeRaisonContact[] = ["jamais_active", "inactif", "lives_manques", "devoir_non_rendu"];

/** Message WhatsApp prêt, selon la raison principale (tutoiement : il part vers l'étudiant). */
function messageRelance(e: EtudiantResume, raisons: RaisonContact[], devoir?: { titre: string; retard: boolean }): string {
  const debut = entreeMessage(e.prenom, e.site);
  const principale = ORDRE_RAISONS.find((t) => raisons.some((r) => r.type === t));
  switch (principale) {
    case "jamais_active":
      return `${debut} Ton compte du campus numérique t'attend. Passe nous voir pour récupérer ta fiche de connexion, ou réponds-nous ici si tu as un souci.`;
    case "inactif":
      return `${debut} On ne t'a pas vu sur le campus numérique depuis quelques jours. Tout va bien ? Si tu as un souci de téléphone ou de connexion, dis-le-nous : on trouvera une solution.`;
    case "lives_manques":
      return `${debut} Tu as manqué les deux derniers cours en direct. Tout va bien ? Dis-nous si quelque chose t'empêche de suivre (réseau, téléphone, horaires…).`;
    case "devoir_non_rendu":
      return `${debut} Ton devoir « ${devoir?.titre ?? "en cours"} » n'a pas été rendu.${devoir?.retard ? " Tu peux encore le rendre en retard sur le campus." : ""} Besoin d'aide ?`;
    default:
      return debut;
  }
}

async function calculerAContacter(u: Utilisateur): Promise<AContacter[]> {
  const p = perimetreSites(u);
  const maintenant = Date.now();
  const il7j = new Date(maintenant - 7 * JOUR_MS);
  const raisons = new Map<number, RaisonContact[]>();
  const ajouter = (uid: number, r: RaisonContact) => {
    const l = raisons.get(uid) ?? [];
    l.push(r);
    raisons.set(uid, l);
  };
  const devoirManque = new Map<number, { titre: string; retard: boolean }>();

  const etudiants = await db
    .select({
      id: utilisateurs.id,
      prenom: utilisateurs.prenom,
      nom: utilisateurs.nom,
      matricule: utilisateurs.matricule,
      telephone: utilisateurs.telephone,
      siteId: utilisateurs.siteId,
      site: sites.nomCourt,
      classe: classes.nom,
      doitChanger: utilisateurs.doitChangerMotDePasse,
      expireLe: utilisateurs.motDePasseExpireLe,
      derniereConnexion: utilisateurs.derniereConnexion,
      creeLe: utilisateurs.creeLe,
    })
    .from(utilisateurs)
    .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
    .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
    .where(and(eq(utilisateurs.role, "etudiant"), eq(utilisateurs.actif, true), surSites(utilisateurs.siteId, p)));
  const activite = await derniereActivite(etudiants.map((e) => e.id));

  // 1 et 2 : jamais activé après 7 jours · plus vu depuis 7 jours.
  for (const e of etudiants) {
    const jours = Math.floor((maintenant - e.creeLe.getTime()) / JOUR_MS);
    if (e.doitChanger) {
      if (e.creeLe >= il7j) continue;
      const expire = e.expireLe && e.expireLe.getTime() < maintenant;
      ajouter(e.id, {
        type: "jamais_active",
        texte: expire
          ? `Code provisoire expiré le ${jour(e.expireLe!)} : n'a jamais choisi son code secret.`
          : e.derniereConnexion
            ? "A ouvert sa fiche mais n'a pas encore choisi son code secret."
            : `Compte créé il y a ${jours} jours, jamais utilisé.`,
        action: expire ? "Remettre une nouvelle fiche (Nouveau code)" : "Vérifier que la fiche de connexion a bien été remise",
      });
    } else {
      const vu = activite.get(e.id);
      if (!vu || vu < il7j) {
        const depuis = vu ? Math.floor((maintenant - vu.getTime()) / JOUR_MS) : null;
        ajouter(e.id, {
          type: "inactif",
          texte: depuis ? `Plus vu sur le campus depuis ${depuis} jours.` : "Jamais revenu sur le campus depuis son activation.",
          action: "Prendre des nouvelles sur WhatsApp",
        });
      }
    }
  }

  // 3 : les deux derniers lives manqués (absent, sans justification ni incident).
  const lives = await db.execute<{ uid: number; titres: string[]; codes: string[]; absences: number; n: number }>(sql`
    SELECT uid, array_agg(seance_titre ORDER BY debut DESC) AS titres, array_agg(cours_code ORDER BY debut DESC) AS codes,
      count(*) FILTER (WHERE statut = 'absent')::int AS absences, count(*)::int AS n
    FROM (
      SELECT a.*, row_number() OVER (PARTITION BY a.uid ORDER BY a.debut DESC) AS rang
      FROM (${sqlAttendus({ depuis: new Date(maintenant - 60 * JOUR_MS), sites: p })}) a
    ) x
    WHERE rang <= 2
    GROUP BY uid
    HAVING count(*) = 2 AND count(*) FILTER (WHERE statut = 'absent') = 2`);
  for (const l of lives.rows) {
    ajouter(l.uid, {
      type: "lives_manques",
      texte: `Absent aux 2 derniers lives : « ${l.titres[0]} » (${l.codes[0]}) et « ${l.titres[1]} » (${l.codes[1]}).`,
      action: "Appeler pour comprendre (réseau, téléphone, horaires ?)",
    });
  }

  // 4 : devoir échu depuis moins de 30 jours et non rendu.
  const devoirs = await db.execute<{ uid: number; titre: string; cours_code: string; date_limite: Date; accepte_retard: boolean }>(sql`
    SELECT uid, titre, cours_code, date_limite, accepte_retard
    FROM (${sqlDevoirsAttendus({ depuis: new Date(maintenant - 30 * JOUR_MS), sites: p })}) a
    WHERE NOT rendu
    ORDER BY date_limite DESC`);
  const parEtudiant = new Map<number, typeof devoirs.rows>();
  for (const d of devoirs.rows) parEtudiant.set(d.uid, [...(parEtudiant.get(d.uid) ?? []), d]);
  for (const [uid, liste] of parEtudiant) {
    const dernier = liste[0];
    devoirManque.set(uid, { titre: dernier.titre, retard: dernier.accepte_retard });
    ajouter(uid, {
      type: "devoir_non_rendu",
      texte:
        liste.length === 1
          ? `N'a pas rendu « ${dernier.titre} » (${dernier.cours_code}), échu le ${jour(dernier.date_limite)}.`
          : `${liste.length} devoirs non rendus, dont « ${dernier.titre} » (${dernier.cours_code}), échu le ${jour(dernier.date_limite)}.`,
      action: dernier.accepte_retard ? "Relancer : le devoir peut encore être rendu en retard" : "Faire le point avec l'étudiant et son formateur",
    });
  }

  const ids = [...raisons.keys()];
  if (!ids.length) return [];
  const derniersSuivis = await db.execute<{ etudiant_id: number; texte: string; cree_le: Date; auteur: string }>(sql`
    SELECT DISTINCT ON (s.etudiant_id) s.etudiant_id, s.texte, s.cree_le, a.prenom || ' ' || a.nom AS auteur
    FROM campus.suivis s JOIN campus.utilisateurs a ON a.id = s.auteur_id
    WHERE s.etudiant_id = ANY(${entiers(ids)})
    ORDER BY s.etudiant_id, s.cree_le DESC`);
  const suiviDe = new Map(derniersSuivis.rows.map((s) => [s.etudiant_id, s]));
  const infos = new Map(etudiants.map((e) => [e.id, e]));

  const lignes: AContacter[] = [];
  for (const [uid, rs] of raisons) {
    const e = infos.get(uid);
    if (!e) continue;
    rs.sort((a, b) => ORDRE_RAISONS.indexOf(a.type) - ORDRE_RAISONS.indexOf(b.type));
    const etudiant: EtudiantResume = {
      id: e.id,
      prenom: e.prenom,
      nom: e.nom,
      matricule: e.matricule,
      telephone: e.telephone,
      classe: e.classe,
      siteId: e.siteId,
      site: e.site,
    };
    const s = suiviDe.get(uid);
    lignes.push({
      etudiant,
      raisons: rs,
      derniereActivite: iso(activite.get(uid)),
      dernierSuivi: s ? { texte: s.texte, creeLe: iso(s.cree_le)!, auteur: s.auteur } : null,
      whatsapp: numeroWhatsApp(e.telephone) ? lienWhatsApp(e.telephone, messageRelance(etudiant, rs, devoirManque.get(uid))) : null,
    });
  }
  // Les plus préoccupants d'abord : plusieurs raisons, puis lives manqués, puis le reste.
  const poids = (l: AContacter) => l.raisons.length * 10 + (l.raisons.some((r) => r.type === "lives_manques") ? 5 : 0);
  return lignes.sort((a, b) => poids(b) - poids(a) || a.etudiant.nom.localeCompare(b.etudiant.nom));
}

// ── Comptes ────────────────────────────────────────────────────────────────

const colonnesCompte = {
  id: utilisateurs.id,
  role: utilisateurs.role,
  prenom: utilisateurs.prenom,
  nom: utilisateurs.nom,
  matricule: utilisateurs.matricule,
  email: utilisateurs.email,
  telephone: utilisateurs.telephone,
  titre: utilisateurs.titre,
  localisation: utilisateurs.localisation,
  siteId: utilisateurs.siteId,
  site: sites.nomCourt,
  classeId: utilisateurs.classeId,
  classe: classes.nom,
  actif: utilisateurs.actif,
  doitChanger: utilisateurs.doitChangerMotDePasse,
  codeExpireLe: utilisateurs.motDePasseExpireLe,
  derniereConnexion: utilisateurs.derniereConnexion,
  creeLe: utilisateurs.creeLe,
};

type LigneCompteBrute = {
  [K in keyof typeof colonnesCompte]: (typeof colonnesCompte)[K]["_"]["notNull"] extends true
    ? (typeof colonnesCompte)[K]["_"]["data"]
    : (typeof colonnesCompte)[K]["_"]["data"] | null;
};

function versCompte(l: LigneCompteBrute): CompteLigne {
  const { doitChanger, codeExpireLe, derniereConnexion, creeLe, ...reste } = l;
  return {
    ...reste,
    active: !doitChanger,
    codeExpireLe: iso(codeExpireLe),
    derniereConnexion: iso(derniereConnexion),
    creeLe: iso(creeLe)!,
  };
}

function selectionComptes() {
  return db
    .select(colonnesCompte)
    .from(utilisateurs)
    .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
    .leftJoin(classes, eq(classes.id, utilisateurs.classeId));
}

async function compteParId(id: number): Promise<CompteLigne> {
  const [l] = await selectionComptes().where(eq(utilisateurs.id, id));
  if (!l) throw introuvable("Compte");
  return versCompte(l as LigneCompteBrute);
}

/** Condition « comptes visibles » pour la liste. */
function comptesVisibles(u: Utilisateur): SQL | undefined {
  if (u.role === "admin") return undefined;
  const p = perimetreSites(u);
  if (!p) return ne(utilisateurs.role, "admin");
  return and(ne(utilisateurs.role, "admin"), or(inArray(utilisateurs.siteId, p), eq(utilisateurs.role, "formateur")));
}

/** Message qui accompagne un code provisoire (tutoiement pour les étudiants, vouvoiement sinon). */
function messageCode(c: Pick<Utilisateur, "prenom" | "role" | "matricule" | "email">, code: string, lien: string, expireLe: Date): string {
  const identifiant = c.matricule ?? c.email ?? "";
  if (c.role === "etudiant") {
    return [
      `Bonjour ${c.prenom}, voici ton accès au campus numérique 2IAE.`,
      `Identifiant : ${identifiant}`,
      `Code provisoire : ${code}`,
      `Ou ouvre directement ce lien (une seule fois) : ${lien}`,
      `Tu choisiras ensuite ton propre code secret. Valable jusqu'au ${jour(expireLe)}.`,
    ].join("\n");
  }
  return [
    `Bonjour ${c.prenom}, voici votre accès au campus numérique 2IAE.`,
    `Identifiant : ${identifiant}`,
    `Code provisoire : ${code}`,
    `Ou ouvrez directement ce lien (une seule fois) : ${lien}`,
    `Vous choisirez ensuite votre propre code secret (10 caractères au moins). Valable jusqu'au ${jour(expireLe)}.`,
  ].join("\n");
}

const vide = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const texteCourt = (max: number) => z.string().trim().min(1, "à remplir").max(max, "trop long");
const optionnel = <T extends z.ZodTypeAny>(s: T) => z.preprocess(vide, s.nullable()).optional();

const schemaMatricule = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase().replace(/\s+/g, ""))
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9\-/.]{2,29}$/, "matricule illisible (lettres et chiffres, 3 à 30 caractères)"));

const schemaCreationCompte = z.object({
  role: z.enum(ROLES),
  prenom: texteCourt(80),
  nom: texteCourt(80),
  matricule: optionnel(schemaMatricule),
  email: optionnel(z.string().trim().toLowerCase().email("adresse e-mail invalide").max(160)),
  telephone: optionnel(z.string().trim().max(30)),
  siteId: z.number().int().positive().nullable().optional(),
  classeId: z.number().int().positive().nullable().optional(),
  titre: optionnel(z.string().trim().max(120)),
  localisation: optionnel(z.string().trim().max(120)),
});

const schemaModificationCompte = z.object({
  role: z.enum(ROLES).optional(),
  prenom: texteCourt(80).optional(),
  nom: texteCourt(80).optional(),
  matricule: optionnel(schemaMatricule),
  email: optionnel(z.string().trim().toLowerCase().email("adresse e-mail invalide").max(160)),
  telephone: optionnel(z.string().trim().max(30)),
  siteId: z.number().int().positive().nullable().optional(),
  classeId: z.number().int().positive().nullable().optional(),
  titre: optionnel(z.string().trim().max(120)),
  localisation: optionnel(z.string().trim().max(120)),
  actif: z.boolean().optional(),
});

/** Téléphone saisi → chiffres normalisés (sans 225) ; refuse l'illisible. */
function telephoneSaisi(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const n = normaliserTelephone(brut);
  if (n.length < 8 || n.length > 15) throw invalide("Numéro de téléphone illisible (10 chiffres, ex. 07 07 12 34 56).");
  return n;
}

async function verifierUnicite(champs: { matricule?: string | null; email?: string | null }, sauf?: number) {
  if (champs.matricule) {
    const [x] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.matricule, champs.matricule));
    if (x && x.id !== sauf) throw new ErreurHttp(409, `Le matricule ${champs.matricule} a déjà un compte.`);
  }
  if (champs.email) {
    const [x] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.email, champs.email));
    if (x && x.id !== sauf) throw new ErreurHttp(409, "Cette adresse e-mail est déjà utilisée par un autre compte.");
  }
}

// ── Import depuis Excel ou CSV ─────────────────────────────────────────────

type ChampImport = "matricule" | "nomPrenoms" | "nom" | "prenom" | "telephone" | "email" | "classe" | "site";

/** En-têtes reconnus (comparés sans accents, casse ni ponctuation). */
const ENTETES: Record<ChampImport, string[]> = {
  matricule: ["matricule", "mat", "nmatricule", "numeromatricule", "matriculeetudiant", "identifiant"],
  nomPrenoms: ["nometprenoms", "nometprenom", "nomprenoms", "nomprenom", "nomsetprenoms", "nomcomplet", "etudiant", "nometprenomsdeletudiant"],
  nom: ["nom", "noms", "nomdefamille"],
  prenom: ["prenom", "prenoms", "prenomsdeletudiant"],
  telephone: ["telephone", "tel", "portable", "mobile", "contact", "numero", "numerodetelephone", "cellulaire", "whatsapp", "telephoneetudiant", "contactetudiant"],
  email: ["email", "mail", "courriel", "adresseemail", "adressemail", "emailetudiant"],
  classe: ["classe", "classes", "groupe", "classeetudiant"],
  site: ["campus", "site", "ecole", "centre", "etablissement"],
};

const LIBELLES_CHAMPS: Record<ChampImport, string> = {
  matricule: "Matricule",
  nomPrenoms: "Nom et prénoms",
  nom: "Nom",
  prenom: "Prénom(s)",
  telephone: "Téléphone",
  email: "E-mail",
  classe: "Classe",
  site: "Campus",
};

function champDeEntete(entete: string): ChampImport | null {
  const n = normaliser(entete);
  if (!n) return null;
  for (const [champ, motifs] of Object.entries(ENTETES) as [ChampImport, string[]][]) if (motifs.includes(n)) return champ;
  // « Téléphone 1 », « Matricule élève »… mais jamais le téléphone d'un parent.
  if (/parent|tuteur|pere|mere|urgence/.test(n)) return null;
  if (n.startsWith("matricule")) return "matricule";
  if (n.startsWith("prenom")) return "prenom";
  if (n.startsWith("telephone") || n.startsWith("tel")) return "telephone";
  if (n.startsWith("email") || n.startsWith("mail")) return "email";
  return null;
}

/** Découpe une ligne CSV (guillemets « "…" » et « "" » reconnus). */
function decouper(ligne: string, sep: string): string[] {
  const cellules: string[] = [];
  let courante = "";
  let guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const ch = ligne[i];
    if (guillemets) {
      if (ch === '"') {
        if (ligne[i + 1] === '"') {
          courante += '"';
          i++;
        } else guillemets = false;
      } else courante += ch;
    } else if (ch === '"' && courante.trim() === "") guillemets = true;
    else if (ch === sep) {
      cellules.push(courante.trim());
      courante = "";
    } else courante += ch;
  }
  cellules.push(courante.trim());
  return cellules;
}

const espaces = (s: string) => s.replace(/\s+/g, " ").trim();

/** Téléphone d'un fichier : normalisé, avec les pièges d'Excel (zéro initial perdu). */
function telephoneImporte(brut: string): { tel: string | null; avertissement?: string } {
  if (!brut.trim()) return { tel: null };
  if (/e\+/i.test(brut)) return { tel: null, avertissement: "Numéro abîmé par Excel (format « 7,07E+09 ») : ignoré." };
  let n = normaliserTelephone(brut);
  if (n.length === 9 && /^[0-9]/.test(n) && !n.startsWith("0")) {
    n = `0${n}`;
    return { tel: n, avertissement: `Zéro initial remis (Excel l'avait retiré) : ${n}.` };
  }
  if (n.length === 10) return { tel: n };
  if (n.length === 8) return { tel: n, avertissement: "Numéro à 8 chiffres (ancien format) : vérifiez-le." };
  if (n.length >= 11 && n.length <= 15) return { tel: n };
  return { tel: null, avertissement: `Numéro illisible (« ${brut} ») : ignoré.` };
}

type ClasseRef = { id: number; nom: string; siteId: number; site: string; cle: string; cleSansSite: string };
type SiteRef = { id: number; nom: string; nomCourt: string; slug: string };

async function referencesImport(u: Utilisateur): Promise<{ classes: ClasseRef[]; sites: SiteRef[]; tousSites: SiteRef[] }> {
  const p = perimetreSites(u);
  const tousSites = await db.select({ id: sites.id, nom: sites.nom, nomCourt: sites.nomCourt, slug: sites.slug }).from(sites);
  const lignes = await db.select({ id: classes.id, nom: classes.nom, siteId: classes.siteId }).from(classes).where(surSites(classes.siteId, p));
  const nomSite = new Map(tousSites.map((s) => [s.id, s.nomCourt]));
  return {
    tousSites,
    sites: tousSites.filter((s) => !p || p.includes(s.id)),
    classes: lignes.map((c) => {
      const site = nomSite.get(c.siteId) ?? "";
      // « BTS GC 1 · Yopougon » se retrouve aussi sous « BTS GC 1 » quand le campus est précisé à part.
      const sansSite = c.nom.replace(new RegExp(`\\s*[·\\-–|,]\\s*${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "");
      return { id: c.id, nom: c.nom, siteId: c.siteId, site, cle: normaliser(c.nom), cleSansSite: normaliser(sansSite) };
    }),
  };
}

function trouverSite(brut: string, refs: SiteRef[]): SiteRef[] {
  const n = normaliser(brut);
  if (!n) return [];
  const exacts = refs.filter((s) => [s.nomCourt, s.slug, s.nom].some((x) => normaliser(x) === n));
  if (exacts.length) return exacts;
  return refs.filter((s) => n.includes(normaliser(s.nomCourt)) || n.includes(normaliser(s.slug)));
}

/**
 * Contrôles communs à l'aperçu et à la validation : doublons dans le lot,
 * matricules et e-mails déjà pris. Modifie les lignes en place.
 */
async function controlerLot(u: Utilisateur, lignes: LigneImport[]) {
  const vus = new Map<string, number>();
  const emailsVus = new Set<string>();
  for (const l of lignes) {
    if (!l.matricule) continue;
    const premiere = vus.get(l.matricule);
    if (premiere !== undefined) l.erreurs.push(`Matricule en double : déjà ligne ${premiere}.`);
    else vus.set(l.matricule, l.numero);
    if (l.email) {
      if (emailsVus.has(l.email)) {
        l.avertissements.push("E-mail déjà présent dans le lot : ignoré.");
        l.email = null;
      } else emailsVus.add(l.email);
    }
  }
  const matricules = [...vus.keys()];
  if (matricules.length) {
    const existants = await db
      .select({ matricule: utilisateurs.matricule, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role, siteId: utilisateurs.siteId })
      .from(utilisateurs)
      .where(inArray(utilisateurs.matricule, matricules));
    const deja = new Map(existants.map((e) => [e.matricule, e]));
    for (const l of lignes) {
      const e = deja.get(l.matricule);
      if (!e) continue;
      // Hors périmètre, on ne dit pas à qui il appartient.
      l.erreurs.push(peutGerer(u, e) ? `Ce matricule a déjà un compte (${e.prenom} ${e.nom}).` : "Ce matricule a déjà un compte.");
    }
  }
  const emails = lignes.map((l) => l.email).filter((e): e is string => Boolean(e));
  if (emails.length) {
    const pris = new Set(
      (await db.select({ email: utilisateurs.email }).from(utilisateurs).where(inArray(utilisateurs.email, emails))).map((e) => e.email),
    );
    for (const l of lignes) {
      if (l.email && pris.has(l.email)) {
        l.avertissements.push("E-mail déjà utilisé par un autre compte : ignoré.");
        l.email = null;
      }
    }
  }
}

const MAX_LIGNES_IMPORT = 1500;

// ── Relevé parent ──────────────────────────────────────────────────────────

const lienReleve = (jeton: string) => `${config.urlCampus}/releve/${jeton}`;

function messageReleve(e: Pick<Utilisateur, "prenom" | "nom">, classe: string | null, site: string | null, lien: string) {
  // « BTS GC · Yopougon » dit déjà le campus : on ne le répète pas.
  const contexte = [classe, site && !(classe ?? "").includes(site) ? `campus ${site}` : null].filter(Boolean).join(", ");
  return [
    `Bonjour, voici le relevé de ${e.prenom} ${e.nom}${contexte ? ` (${contexte})` : ""} au campus numérique 2IAE :`,
    lien,
    "Vous y trouverez ses moyennes et sa présence aux cours en direct. La vie scolaire reste à votre écoute pour toute question.",
  ].join("\n");
}

/** Une consultation au journal par heure et par lien au plus (pas de journal inondé). */
const consultationsNotees = new Map<string, number>();
setInterval(() => {
  const limite = Date.now() - 3_600_000;
  for (const [cle, t] of consultationsNotees) if (t < limite) consultationsNotees.delete(cle);
}, 3_600_000).unref();

// ── IA ─────────────────────────────────────────────────────────────────────

const cout = (entree: number, sortie: number) => Math.round(((entree / 1e6) * PRIX_IA.entree + (sortie / 1e6) * PRIX_IA.sortie) * 100) / 100;

// ═══════════════════════════════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════════════════════════════

export function enregistrerAdmin(app: Express) {
  // ── Tableau de pilotage ──────────────────────────────────────────────────

  app.get(
    `${P}/tableau`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const p = perimetreSites(u);
      const maintenant = Date.now();
      const listeSites = await db.select().from(sites).where(surSites(sites.id, p)).orderBy(asc(sites.ordre));

      const comptes = await db.execute<{ site_id: number | null; etudiants: number; actives: number; actifs7j: number }>(sql`
        SELECT u.site_id, count(*)::int AS etudiants,
          count(*) FILTER (WHERE NOT u.doit_changer_mot_de_passe)::int AS actives,
          count(*) FILTER (WHERE act.t >= now() - interval '7 days')::int AS actifs7j
        FROM campus.utilisateurs u
        LEFT JOIN (${SQL_DERNIERE_ACTIVITE}) act ON act.uid = u.id
        WHERE u.role = 'etudiant' AND u.actif ${p ? sql`AND u.site_id = ANY(${entiers(p)})` : sql``}
        GROUP BY u.site_id`);
      const presencesParSite = await db.execute<LigneResume & { site_id: number | null }>(sql`
        SELECT site_id, ${COLONNES_RESUME}
        FROM (${sqlAttendus({ depuis: new Date(maintenant - 30 * JOUR_MS), sites: p })}) a
        GROUP BY site_id`);
      const devoirsParSite = await db.execute<{ site_id: number | null; attendus: number; rendus: number }>(sql`
        SELECT site_id, count(*)::int AS attendus, count(*) FILTER (WHERE rendu)::int AS rendus
        FROM (${sqlDevoirsAttendus({ depuis: new Date(maintenant - 30 * JOUR_MS), sites: p })}) a
        GROUP BY site_id`);
      const aContacter = await calculerAContacter(u);

      const indicateurs = (siteId: number | null | "tous", nom: string): IndicateursCampus => {
        const garde = <T extends { site_id: number | null }>(l: T) => siteId === "tous" || l.site_id === siteId;
        const c = comptes.rows.filter(garde);
        const pr = presencesParSite.rows.filter(garde);
        const dv = devoirsParSite.rows.filter(garde);
        const somme = <T,>(l: T[], f: (x: T) => number) => l.reduce((s, x) => s + f(x), 0);
        const etudiants = somme(c, (x) => x.etudiants);
        const actives = somme(c, (x) => x.actives);
        const resume: Partial<LigneResume> = { attendus: somme(pr, (x) => x.attendus) };
        for (const s of STATUTS_PRESENCE_PILOTAGE) resume[s] = somme(pr, (x) => x[s]);
        return {
          siteId: siteId === "tous" ? null : siteId,
          nom,
          etudiants,
          actives,
          tauxActivation: pourcent(actives, etudiants),
          actifs7j: somme(c, (x) => x.actifs7j),
          presence30j: versResume(resume).taux,
          devoirsRendus: pourcent(
            somme(dv, (x) => x.rendus),
            somme(dv, (x) => x.attendus),
          ),
          aContacter: aContacter.filter((l) => siteId === "tous" || l.etudiant.siteId === siteId).length,
        };
      };

      const monSite = p && listeSites.length === 1 ? listeSites[0].nomCourt : null;
      const tableau: TableauPilotage = {
        perimetre: { tout: !p, site: monSite },
        total: indicateurs("tous", p ? `Campus ${monSite ?? ""}`.trim() : "Tout le groupe"),
        campus: listeSites.map((s) => indicateurs(s.id, s.nomCourt)),
        genereLe: new Date().toISOString(),
      };
      res.json(tableau);
    }),
  );

  app.get(
    `${P}/a-contacter`,
    EQUIPE,
    route(async (req, res) => {
      const lignes = await calculerAContacter(moi(req));
      const parRaison = Object.fromEntries(ORDRE_RAISONS.map((t) => [t, lignes.filter((l) => l.raisons.some((r) => r.type === t)).length])) as Record<
        TypeRaisonContact,
        number
      >;
      const liste: ListeAContacter = { total: lignes.length, parRaison, lignes };
      res.json(liste);
    }),
  );

  // ── Références pour les sélecteurs ───────────────────────────────────────

  app.get(
    `${P}/references`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const p = perimetreSites(u);
      const listeSites = await db.select().from(sites).where(surSites(sites.id, p)).orderBy(asc(sites.ordre));
      const listeClasses = await db
        .select({ id: classes.id, nom: classes.nom, siteId: classes.siteId })
        .from(classes)
        .where(surSites(classes.siteId, p))
        .orderBy(asc(classes.nom));
      const refs: ReferencesPilotage = {
        sites: listeSites.map(
          (s): SiteLigne => ({
            id: s.id,
            nom: s.nom,
            nomCourt: s.nomCourt,
            ville: s.ville,
            salleConference: s.salleConference,
            whatsappVieScolaire: s.whatsappVieScolaire,
          }),
        ),
        classes: listeClasses,
        toutLeGroupe: !p,
        estDirection: u.role === "admin",
      };
      res.json(refs);
    }),
  );

  app.get(
    `${P}/cours-formateurs`,
    EQUIPE,
    route(async (_req, res) => {
      const liste: FormateurOption[] = await db
        .select({
          id: utilisateurs.id,
          prenom: utilisateurs.prenom,
          nom: utilisateurs.nom,
          titre: utilisateurs.titre,
          localisation: utilisateurs.localisation,
          actif: utilisateurs.actif,
        })
        .from(utilisateurs)
        .where(eq(utilisateurs.role, "formateur"))
        .orderBy(desc(utilisateurs.actif), asc(utilisateurs.nom), asc(utilisateurs.prenom));
      res.json(liste);
    }),
  );

  // ── Comptes ──────────────────────────────────────────────────────────────

  app.get(
    `${P}/comptes`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const f = valider(
        z.object({
          role: z.enum(ROLES).optional(),
          site: z.coerce.number().int().positive().optional(),
          classe: z.coerce.number().int().positive().optional(),
          q: z.string().trim().max(80).optional(),
          etat: z.enum(["actifs", "desactives", "non_actives", "actives"]).optional(),
          page: z.coerce.number().int().min(1).default(1),
          parPage: z.coerce.number().int().min(1).max(500).default(25),
        }),
        req.query,
      );
      const conds: (SQL | undefined)[] = [comptesVisibles(u)];
      if (f.role) conds.push(eq(utilisateurs.role, f.role));
      if (f.site) conds.push(eq(utilisateurs.siteId, f.site));
      if (f.classe) conds.push(eq(utilisateurs.classeId, f.classe));
      if (f.etat === "actifs") conds.push(eq(utilisateurs.actif, true));
      if (f.etat === "desactives") conds.push(eq(utilisateurs.actif, false));
      if (f.etat === "non_actives") conds.push(and(eq(utilisateurs.actif, true), eq(utilisateurs.doitChangerMotDePasse, true)));
      if (f.etat === "actives") conds.push(and(eq(utilisateurs.actif, true), eq(utilisateurs.doitChangerMotDePasse, false)));
      if (f.q) {
        // « kone » retrouve « Koné » : comparaison sans accents ni majuscules.
        const motif = `%${sansAccents(f.q).replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
        const chiffres = f.q.replace(/\D/g, "");
        conds.push(
          or(
            sql`${sqlSansAccents(sql`${utilisateurs.prenom} || ' ' || ${utilisateurs.nom}`)} LIKE ${motif}`,
            sql`${sqlSansAccents(sql`${utilisateurs.nom} || ' ' || ${utilisateurs.prenom}`)} LIKE ${motif}`,
            ilike(utilisateurs.matricule, motif),
            ilike(utilisateurs.email, motif),
            chiffres.length >= 4 ? ilike(utilisateurs.telephone, `%${normaliserTelephone(chiffres)}%`) : undefined,
          ),
        );
      }
      const filtre = and(...conds);
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(utilisateurs)
        .where(filtre);
      const lignes = await selectionComptes()
        .where(filtre)
        .orderBy(sql`case ${utilisateurs.role} when 'etudiant' then 1 when 'formateur' then 2 when 'vie_scolaire' then 3 when 'salle' then 4 else 5 end`, asc(utilisateurs.nom), asc(utilisateurs.prenom))
        .limit(f.parPage)
        .offset((f.page - 1) * f.parPage);
      const page: PageComptes = { lignes: lignes.map((l) => versCompte(l as LigneCompteBrute)), total, page: f.page, parPage: f.parPage };
      res.json(page);
    }),
  );

  app.get(
    `${P}/comptes/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const c = await compteGere(moi(req), idParam(req));
      res.json(await compteParId(c.id));
    }),
  );

  app.post(
    `${P}/comptes`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(schemaCreationCompte, req.body);
      const p = perimetreSites(u);

      if (d.role === "admin" && u.role !== "admin") throw interdit("Seule la direction crée les comptes de la direction.");
      let siteId: number | null = null;
      let classeId: number | null = null;
      if (d.role === "etudiant") {
        if (!d.matricule) throw invalide("Le matricule est obligatoire pour un étudiant (il sert d'identifiant).");
        if (!d.classeId) throw invalide("Choisissez la classe de l'étudiant.");
        const classe = await classeGeree(u, d.classeId);
        classeId = classe.id;
        siteId = classe.siteId;
      } else {
        if (!d.email) throw invalide("L'adresse e-mail est obligatoire pour le personnel (elle sert d'identifiant).");
        if (d.role === "vie_scolaire" || d.role === "salle") {
          const voulu = d.siteId ?? (p?.length === 1 ? p[0] : null);
          if (!voulu) throw invalide(d.role === "salle" ? "Choisissez le campus de cette salle." : "Choisissez le campus de ce compte vie scolaire.");
          siteId = (await siteGere(u, voulu)).id;
        }
        // Formateurs et direction : pas de campus (ils travaillent pour tout le groupe).
      }
      const telephone = telephoneSaisi(d.telephone);
      await verifierUnicite({ matricule: d.matricule, email: d.email });

      const code = d.role === "etudiant" ? codeProvisoire() : motDePasseProvisoire();
      const expireLe = new Date(Date.now() + DUREE_CODE_PROVISOIRE_MS);
      const [cree] = await db
        .insert(utilisateurs)
        .values({
          role: d.role,
          prenom: espaces(d.prenom),
          nom: espaces(d.nom),
          matricule: d.matricule ?? null,
          email: d.email ?? null,
          telephone,
          motDePasseHash: await hacher(code),
          doitChangerMotDePasse: true,
          motDePasseExpireLe: expireLe,
          siteId,
          classeId,
          titre: d.role === "formateur" ? (d.titre ?? null) : null,
          localisation: d.role === "formateur" ? (d.localisation ?? null) : null,
        })
        .returning();
      const jeton = await creerJeton(cree.id, "activation");
      const lien = lienActivation(jeton);
      await journaliser(u, "compte_cree", { compteId: cree.id, role: cree.role, siteId });
      const reponse: CompteCree = {
        compte: await compteParId(cree.id),
        code,
        lien,
        whatsapp: lienWhatsApp(telephone, messageCode(cree, code, lien, expireLe)),
        expireLe: expireLe.toISOString(),
      };
      res.status(201).json(reponse);
    }),
  );

  app.patch(
    `${P}/comptes/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const avant = await compteGere(u, idParam(req));
      const d = valider(schemaModificationCompte, req.body);
      const p = perimetreSites(u);
      const maj: Partial<typeof utilisateurs.$inferInsert> = {};

      const role: Role = d.role ?? avant.role;
      if (d.role !== undefined && d.role !== avant.role) {
        if (u.role !== "admin") throw interdit("Seule la direction peut changer le rôle d'un compte.");
        if (avant.id === u.id) throw interdit("Vous ne pouvez pas changer votre propre rôle.");
        maj.role = d.role;
      }
      if (d.prenom !== undefined) maj.prenom = espaces(d.prenom);
      if (d.nom !== undefined) maj.nom = espaces(d.nom);
      if (d.matricule !== undefined) maj.matricule = d.matricule;
      if (d.email !== undefined) maj.email = d.email;
      if (d.telephone !== undefined) maj.telephone = telephoneSaisi(d.telephone);
      if (d.titre !== undefined) maj.titre = d.titre;
      if (d.localisation !== undefined) maj.localisation = d.localisation;

      // Classe et campus selon le rôle (celui d'après la modification).
      if (role === "etudiant") {
        const classeVoulue = d.classeId !== undefined ? d.classeId : avant.classeId;
        if (!classeVoulue) throw invalide("Un étudiant doit appartenir à une classe.");
        if (classeVoulue !== avant.classeId || maj.role) {
          const classe = await classeGeree(u, classeVoulue);
          maj.classeId = classe.id;
          maj.siteId = classe.siteId;
        }
      } else if (role === "vie_scolaire" || role === "salle") {
        if (d.siteId !== undefined || maj.role) {
          const voulu = d.siteId ?? avant.siteId;
          if (!voulu) throw invalide("Choisissez le campus de ce compte.");
          maj.siteId = (await siteGere(u, voulu)).id;
        }
        if (avant.classeId) maj.classeId = null;
      } else {
        if (avant.siteId !== null || d.siteId) maj.siteId = null;
        if (avant.classeId !== null) maj.classeId = null;
      }
      // Un compte qu'on déplace doit rester dans le périmètre de la vie scolaire.
      if (p && maj.siteId !== undefined && maj.siteId !== null && !p.includes(maj.siteId)) throw interdit("Ce campus n'est pas dans votre périmètre.");

      if (d.actif !== undefined && d.actif !== avant.actif) {
        if (avant.id === u.id) throw interdit("Vous ne pouvez pas désactiver votre propre compte.");
        maj.actif = d.actif;
      }
      if (role !== "etudiant" && d.email === null && avant.email) throw invalide("Le personnel se connecte avec son e-mail : il ne peut pas être vide.");
      if (role === "etudiant" && d.matricule === null && avant.matricule) throw invalide("Le matricule d'un étudiant ne peut pas être vide.");
      await verifierUnicite({ matricule: maj.matricule, email: maj.email }, avant.id);

      if (!Object.keys(maj).length) return res.json(await compteParId(avant.id));
      await db.update(utilisateurs).set(maj).where(eq(utilisateurs.id, avant.id));
      oublierUtilisateur(avant.id);
      if (maj.actif === false) await fermerAutresSessions(avant.id);
      const action = maj.actif === false ? "compte_desactive" : maj.actif === true ? "compte_reactive" : maj.role ? "role_change" : "compte_modifie";
      await journaliser(u, action, { compteId: avant.id, champs: Object.keys(maj), ...(maj.role ? { de: avant.role, vers: maj.role } : {}) });
      res.json(await compteParId(avant.id));
    }),
  );

  app.post(
    `${P}/comptes/:id(\\d+)/nouveau-code`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const c = await compteGere(u, idParam(req));
      if (c.id === u.id) throw invalide("Pour changer votre propre code, passez par votre profil.");
      if (!c.actif) throw invalide("Ce compte est désactivé : réactivez-le d'abord.");
      const { code, lien } = await reinitialiserCode(c.id, u.id);
      const expireLe = new Date(Date.now() + DUREE_CODE_PROVISOIRE_MS);
      const reponse: CodeRemis = { code, lien, whatsapp: lienWhatsApp(c.telephone, messageCode(c, code, lien, expireLe)), expireLe: expireLe.toISOString() };
      res.json(reponse);
    }),
  );

  // ── Import ───────────────────────────────────────────────────────────────

  app.post(
    `${P}/import/apercu`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { texte, classeId: classeParDefaut } = valider(
        z.object({
          texte: z.string().max(600_000, "texte trop long : importez par morceaux de 1 500 lignes"),
          classeId: z.number().int().positive().nullable().optional(),
        }),
        req.body,
      );
      const brutes = texte.replace(/\r\n?/g, "\n").split("\n");
      const indexEntete = brutes.findIndex((l) => l.trim() !== "");
      if (indexEntete < 0) throw invalide("Collez d'abord le tableau (avec sa ligne d'en-têtes).");
      const premiere = brutes[indexEntete];
      const sep = premiere.includes("\t") ? "\t" : (premiere.match(/;/g)?.length ?? 0) >= (premiere.match(/,/g)?.length ?? 0) ? ";" : ",";
      const entetes = decouper(premiere, sep);
      const champs = entetes.map(champDeEntete);
      const colonne = (c: ChampImport) => champs.indexOf(c);
      if (colonne("matricule") < 0) {
        throw invalide("Je ne trouve pas la colonne « Matricule ». Collez le tableau avec sa ligne d'en-têtes (Matricule, Nom, Prénoms, Téléphone, Classe…).");
      }
      if (colonne("nom") < 0 && colonne("nomPrenoms") < 0) throw invalide("Je ne trouve pas la colonne « Nom » (ou « Nom et prénoms »).");
      const refs = await referencesImport(u);
      const defaut = classeParDefaut ? refs.classes.find((c) => c.id === classeParDefaut) : undefined;
      if (classeParDefaut && !defaut) throw introuvable("Classe");

      const lignes: LigneImport[] = [];
      for (let i = indexEntete + 1; i < brutes.length; i++) {
        if (!brutes[i].trim()) continue;
        const cellules = decouper(brutes[i], sep);
        if (cellules.every((c) => !c)) continue;
        if (lignes.length >= MAX_LIGNES_IMPORT) throw invalide(`Plus de ${MAX_LIGNES_IMPORT} lignes : importez par morceaux.`);
        const val = (c: ChampImport) => (colonne(c) >= 0 ? espaces(cellules[colonne(c)] ?? "") : "");
        const l: LigneImport = {
          numero: i + 1,
          matricule: val("matricule").toUpperCase().replace(/\s+/g, ""),
          nom: val("nom"),
          prenom: val("prenom"),
          telephone: null,
          email: null,
          classeId: null,
          classe: null,
          siteId: null,
          site: null,
          erreurs: [],
          avertissements: [],
        };
        if (colonne("nomPrenoms") >= 0 && (!l.nom || !l.prenom)) {
          const [nom, ...prenoms] = val("nomPrenoms").split(" ");
          l.nom ||= nom ?? "";
          l.prenom ||= prenoms.join(" ");
        }
        if (!l.matricule) l.erreurs.push("Matricule manquant.");
        else if (!/^[A-Z0-9][A-Z0-9\-/.]{2,29}$/.test(l.matricule)) l.erreurs.push(`Matricule illisible : « ${l.matricule} ».`);
        if (!l.nom) l.erreurs.push("Nom manquant.");
        if (!l.prenom) l.erreurs.push("Prénom manquant.");

        const tel = telephoneImporte(val("telephone"));
        l.telephone = tel.tel;
        if (tel.avertissement) l.avertissements.push(tel.avertissement);
        const email = val("email").toLowerCase();
        if (email) {
          if (z.string().email().safeParse(email).success) l.email = email;
          else l.avertissements.push(`E-mail illisible (« ${email} ») : ignoré.`);
        }

        // Campus puis classe.
        const siteBrut = val("site");
        let siteRetenu: SiteRef | undefined;
        let siteEnErreur = false;
        if (siteBrut) {
          const candidats = trouverSite(siteBrut, refs.tousSites);
          siteEnErreur = true;
          if (candidats.length !== 1) l.erreurs.push(`Campus inconnu : « ${siteBrut} ».`);
          else if (!refs.sites.some((s) => s.id === candidats[0].id)) l.erreurs.push(`Le campus ${candidats[0].nomCourt} n'est pas dans votre périmètre.`);
          else {
            siteRetenu = candidats[0];
            siteEnErreur = false;
          }
        }
        const classeBrute = val("classe");
        let classe: ClasseRef | undefined;
        if (siteEnErreur) {
          // Campus refusé : on ne devine pas la classe.
        } else if (classeBrute) {
          const n = normaliser(classeBrute);
          let candidats = refs.classes.filter((c) => c.cle === n || c.cleSansSite === n);
          if (siteRetenu) candidats = candidats.filter((c) => c.siteId === siteRetenu!.id);
          if (candidats.length === 1) classe = candidats[0];
          else if (candidats.length > 1) l.erreurs.push(`Classe « ${classeBrute} » présente sur plusieurs campus : ajoutez une colonne Campus.`);
          else l.erreurs.push(`Classe inconnue : « ${classeBrute} ». Créez-la d'abord dans « Classes ».`);
        } else if (defaut) {
          classe = defaut;
          if (siteRetenu && siteRetenu.id !== defaut.siteId) l.erreurs.push(`La classe choisie n'est pas au campus ${siteRetenu.nomCourt}.`);
        } else {
          l.erreurs.push("Classe manquante : choisissez une classe pour tout le lot, ou ajoutez une colonne Classe.");
        }
        if (classe) {
          l.classeId = classe.id;
          l.classe = classe.nom;
          l.siteId = classe.siteId;
          l.site = classe.site;
        }
        lignes.push(l);
      }
      if (!lignes.length) throw invalide("Aucune ligne sous les en-têtes : collez aussi les étudiants.");
      await controlerLot(u, lignes);

      const apercu: ApercuImport = {
        separateur: sep === "\t" ? "tabulation" : sep === ";" ? "point-virgule" : "virgule",
        colonnes: entetes.map((e, i) => ({ entete: e, champ: champs[i] ? LIBELLES_CHAMPS[champs[i]!] : null })),
        lignes,
        valides: lignes.filter((l) => !l.erreurs.length).length,
        enErreur: lignes.filter((l) => l.erreurs.length).length,
      };
      res.json(apercu);
    }),
  );

  app.post(
    `${P}/import/valider`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { lignes: recues } = valider(
        z.object({
          lignes: z
            .array(
              z.object({
                numero: z.number().int().optional(),
                matricule: schemaMatricule,
                nom: texteCourt(80),
                prenom: texteCourt(80),
                telephone: optionnel(z.string().trim().max(30)),
                email: optionnel(z.string().trim().toLowerCase().email().max(160)),
                classeId: z.number().int().positive(),
              }),
            )
            .min(1, "aucune ligne à créer")
            .max(MAX_LIGNES_IMPORT),
        }),
        req.body,
      );
      // On ne fait jamais confiance à l'aperçu : tout est revérifié ici.
      const refs = await referencesImport(u);
      const lignes: LigneImport[] = recues.map((r, i) => {
        const classe = refs.classes.find((c) => c.id === r.classeId);
        const tel = r.telephone ? normaliserTelephone(r.telephone) : null;
        return {
          numero: r.numero ?? i + 2,
          matricule: r.matricule,
          nom: espaces(r.nom),
          prenom: espaces(r.prenom),
          telephone: tel && tel.length >= 8 && tel.length <= 15 ? tel : null,
          email: r.email ?? null,
          classeId: classe?.id ?? null,
          classe: classe?.nom ?? null,
          siteId: classe?.siteId ?? null,
          site: classe?.site ?? null,
          erreurs: classe ? [] : ["Classe inconnue ou hors de votre périmètre."],
          avertissements: [],
        };
      });
      await controlerLot(u, lignes);
      const enErreur = lignes.filter((l) => l.erreurs.length);
      if (enErreur.length) {
        throw new ErreurHttp(
          409,
          `${enErreur.length} ligne${enErreur.length > 1 ? "s ont" : " a"} une erreur. Ligne ${enErreur[0].numero} : ${enErreur[0].erreurs[0]} Refaites l'aperçu.`,
          enErreur.map((l) => ({ numero: l.numero, erreurs: l.erreurs })),
        );
      }

      const expireLe = new Date(Date.now() + DUREE_CODE_PROVISOIRE_MS);
      const codes = lignes.map(() => codeProvisoire());
      const hashs: string[] = [];
      for (const c of codes) hashs.push(await hacher(c));
      const crees = await db.transaction(async (tx) =>
        tx
          .insert(utilisateurs)
          .values(
            lignes.map((l, i) => ({
              role: "etudiant" as const,
              prenom: l.prenom,
              nom: l.nom,
              matricule: l.matricule,
              email: l.email,
              telephone: l.telephone,
              motDePasseHash: hashs[i],
              doitChangerMotDePasse: true,
              motDePasseExpireLe: expireLe,
              siteId: l.siteId,
              classeId: l.classeId,
            })),
          )
          .returning({ id: utilisateurs.id, matricule: utilisateurs.matricule }),
      );
      const idDe = new Map(crees.map((c) => [c.matricule, c.id]));
      const fiches: FicheConnexion[] = [];
      for (const [i, l] of lignes.entries()) {
        const id = idDe.get(l.matricule)!;
        const jeton = await creerJeton(id, "activation");
        fiches.push({
          id,
          prenom: l.prenom,
          nom: l.nom,
          role: "etudiant",
          identifiant: l.matricule,
          classe: l.classe,
          site: l.site,
          code: codes[i],
          lien: lienActivation(jeton),
          expireLe: expireLe.toISOString(),
        });
      }
      await journaliser(u, "import_comptes", { nombre: fiches.length, classes: [...new Set(lignes.map((l) => l.classeId))] });
      const lot: LotFiches = { fiches, ignores: 0 };
      res.status(201).json(lot);
    }),
  );

  // ── Fiches de connexion ──────────────────────────────────────────────────

  app.post(
    `${P}/fiches`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { utilisateurIds } = valider(z.object({ utilisateurIds: z.array(z.number().int().positive()).min(1, "aucun compte choisi").max(400) }), req.body);
      const demandes = [...new Set(utilisateurIds)];
      const trouves = await selectionComptes().where(and(inArray(utilisateurs.id, demandes), eq(utilisateurs.actif, true), comptesVisibles(u)));
      const gerables = trouves.filter((c) => c.id !== u.id && peutGerer(u, { role: c.role, siteId: c.siteId }));
      const expireLe = new Date(Date.now() + DUREE_CODE_PROVISOIRE_MS);
      const fiches: FicheConnexion[] = [];
      for (const c of gerables) {
        const { code, lien } = await reinitialiserCode(c.id, u.id);
        fiches.push({
          id: c.id,
          prenom: c.prenom,
          nom: c.nom,
          role: c.role,
          identifiant: c.matricule ?? c.email ?? "",
          classe: c.classe,
          site: c.site,
          code,
          lien,
          expireLe: expireLe.toISOString(),
        });
      }
      fiches.sort((a, b) => (a.classe ?? "").localeCompare(b.classe ?? "") || a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
      await journaliser(u, "fiches_imprimees", { nombre: fiches.length });
      const lot: LotFiches = { fiches, ignores: demandes.length - fiches.length };
      res.json(lot);
    }),
  );

  // ── Classes ──────────────────────────────────────────────────────────────

  const schemaClasse = z.object({
    nom: texteCourt(120),
    siteId: z.number().int().positive(),
    filiere: texteCourt(120),
    niveau: texteCourt(60),
    anneeScolaire: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/, "année scolaire au format 2026-2027"),
  });

  app.get(
    `${P}/classes`,
    EQUIPE,
    route(async (req, res) => {
      const p = perimetreSites(moi(req));
      const lignes = await db.execute<ClasseLigne>(sql`
        SELECT cl.id, cl.nom, cl.site_id AS "siteId", s.nom_court AS site, cl.filiere, cl.niveau, cl.annee_scolaire AS "anneeScolaire",
          (SELECT count(*)::int FROM campus.utilisateurs u WHERE u.classe_id = cl.id AND u.role = 'etudiant' AND u.actif) AS etudiants,
          (SELECT count(*)::int FROM campus.utilisateurs u WHERE u.classe_id = cl.id AND u.role = 'etudiant' AND u.actif AND NOT u.doit_changer_mot_de_passe) AS actives,
          (SELECT count(*)::int FROM campus.cours_classes cc WHERE cc.classe_id = cl.id) AS cours
        FROM campus.classes cl JOIN campus.sites s ON s.id = cl.site_id
        ${p ? sql`WHERE cl.site_id = ANY(${entiers(p)})` : sql``}
        ORDER BY s.ordre, cl.nom`);
      res.json(lignes.rows);
    }),
  );

  app.post(
    `${P}/classes`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(schemaClasse, req.body);
      await siteGere(u, d.siteId);
      const [c] = await db.insert(classes).values({ ...d, nom: espaces(d.nom) }).returning();
      await journaliser(u, "classe_creee", { classeId: c.id, nom: c.nom });
      res.status(201).json(c);
    }),
  );

  app.patch(
    `${P}/classes/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const avant = await classeGeree(u, idParam(req));
      const d = valider(schemaClasse.partial(), req.body);
      if (d.siteId !== undefined && d.siteId !== avant.siteId) {
        await siteGere(u, d.siteId);
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(utilisateurs)
          .where(eq(utilisateurs.classeId, avant.id));
        if (n) throw new ErreurHttp(409, "Cette classe a déjà des étudiants : on ne peut plus la changer de campus.");
      }
      const [c] = await db
        .update(classes)
        .set({ ...d, ...(d.nom ? { nom: espaces(d.nom) } : {}) })
        .where(eq(classes.id, avant.id))
        .returning();
      await journaliser(u, "classe_modifiee", { classeId: c.id, champs: Object.keys(d) });
      res.json(c);
    }),
  );

  app.delete(
    `${P}/classes/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const c = await classeGeree(u, idParam(req));
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(utilisateurs)
        .where(eq(utilisateurs.classeId, c.id));
      if (n) throw new ErreurHttp(409, `Cette classe compte encore ${n} compte${n > 1 ? "s" : ""} : déplacez-les d'abord dans une autre classe.`);
      const [a] = await db.select({ n: sql<number>`count(*)::int` }).from(annonces).where(eq(annonces.classeId, c.id));
      const [e] = await db.select({ n: sql<number>`count(*)::int` }).from(evenements).where(eq(evenements.classeId, c.id));
      if (a.n || e.n) throw new ErreurHttp(409, "Des annonces ou des événements visent encore cette classe : retirez-les d'abord.");
      await db.delete(classes).where(eq(classes.id, c.id));
      await journaliser(u, "classe_supprimee", { classeId: c.id, nom: c.nom });
      res.json({ ok: true });
    }),
  );

  // ── Campus (salle de conférence, WhatsApp de la vie scolaire) ────────────

  app.patch(
    `${P}/sites/:id(\\d+)`,
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const d = valider(
        z.object({
          salleConference: texteCourt(80).optional(),
          whatsappVieScolaire: optionnel(z.string().trim().max(30)),
        }),
        req.body,
      );
      const [avant] = await db.select().from(sites).where(eq(sites.id, id));
      if (!avant) throw introuvable("Campus");
      const maj: Partial<typeof sites.$inferInsert> = {};
      if (d.salleConference !== undefined) maj.salleConference = espaces(d.salleConference);
      if (d.whatsappVieScolaire !== undefined) {
        if (d.whatsappVieScolaire === null) maj.whatsappVieScolaire = null;
        else {
          const n = numeroWhatsApp(d.whatsappVieScolaire);
          if (!n) throw invalide("Numéro WhatsApp illisible (10 chiffres, ex. 07 47 72 67 29).");
          maj.whatsappVieScolaire = n;
        }
      }
      if (!Object.keys(maj).length) return res.json(avant);
      const [s] = await db.update(sites).set(maj).where(eq(sites.id, id)).returning();
      await journaliser(u, "site_modifie", { siteId: id, champs: Object.keys(maj) });
      res.json(s);
    }),
  );

  // ── Planning des lives ───────────────────────────────────────────────────

  app.get(
    `${P}/planning`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const p = perimetreSites(u);
      const debut = lundiDe(req.query.semaine);
      const fin = new Date(debut.getTime() + 7 * JOUR_MS);
      const lignes = await db
        .select({
          s: seances,
          code: cours.code,
          coursTitre: cours.titre,
          couleur: cours.couleur,
          formateurPrenom: utilisateurs.prenom,
          formateurNom: utilisateurs.nom,
        })
        .from(seances)
        .innerJoin(cours, eq(cours.id, seances.coursId))
        .leftJoin(utilisateurs, eq(utilisateurs.id, cours.formateurId))
        .where(and(gte(seances.debut, debut), lt(seances.debut, fin)))
        .orderBy(asc(seances.debut));
      const coursIds = [...new Set(lignes.map((l) => l.s.coursId))];
      const classesDesCours = coursIds.length
        ? await db
            .select({ coursId: coursClasses.coursId, nom: classes.nom, siteId: classes.siteId, site: sites.nomCourt, ordre: sites.ordre })
            .from(coursClasses)
            .innerJoin(classes, eq(classes.id, coursClasses.classeId))
            .innerJoin(sites, eq(sites.id, classes.siteId))
            .where(inArray(coursClasses.coursId, coursIds))
        : [];

      let liste: SeancePlanning[] = lignes.map(({ s, code, coursTitre, couleur, formateurPrenom, formateurNom }) => {
        const cl = classesDesCours.filter((c) => c.coursId === s.coursId);
        const sitesVus = new Map<number, { id: number; nomCourt: string; ordre: number }>();
        for (const c of cl) sitesVus.set(c.siteId, { id: c.siteId, nomCourt: c.site, ordre: c.ordre });
        return {
          id: s.id,
          titre: s.titre,
          coursId: s.coursId,
          coursCode: code,
          coursTitre,
          couleur,
          debut: s.debut.toISOString(),
          fin: new Date(s.debut.getTime() + s.dureeMinutes * 60_000).toISOString(),
          dureeMinutes: s.dureeMinutes,
          statut: s.statut,
          fournisseur: s.fournisseur,
          motifAnnulation: s.motifAnnulation,
          formateur: formateurPrenom ? `${formateurPrenom} ${formateurNom}` : null,
          sites: [...sitesVus.values()].sort((a, b) => a.ordre - b.ordre).map(({ id, nomCourt }) => ({ id, nomCourt })),
          classes: cl.map((c) => c.nom),
          conflits: [],
        };
      });
      // La vie scolaire d'un campus voit les séances qui concernent sa salle.
      if (p) liste = liste.filter((s) => s.sites.some((x) => p.includes(x.id)));

      // Conflits : deux séances qui se chevauchent dans une même salle de conférence.
      const conflits: ConflitSalle[] = [];
      const actives = liste.filter((s) => s.statut !== "annulee");
      for (let i = 0; i < actives.length; i++) {
        for (let j = i + 1; j < actives.length; j++) {
          const a = actives[i];
          const b = actives[j];
          if (!(a.debut < b.fin && b.debut < a.fin)) continue;
          const communs = a.sites.filter((x) => b.sites.some((y) => y.id === x.id) && (!p || p.includes(x.id)));
          if (!communs.length) continue;
          conflits.push({ a: a.id, b: b.id, sites: communs.map((x) => x.nomCourt) });
          a.conflits.push(b.id);
          b.conflits.push(a.id);
        }
      }
      const planning: PlanningSemaine = { debut: debut.toISOString(), fin: fin.toISOString(), seances: liste, conflits };
      res.json(planning);
    }),
  );

  // ── Présences ────────────────────────────────────────────────────────────

  /** Séance concernant le périmètre (une de ses classes est sur un campus géré), sinon 404. */
  async function seanceGeree(u: Utilisateur, id: number) {
    const [l] = await db
      .select({ s: seances, code: cours.code, coursTitre: cours.titre, formateurPrenom: utilisateurs.prenom, formateurNom: utilisateurs.nom })
      .from(seances)
      .innerJoin(cours, eq(cours.id, seances.coursId))
      .leftJoin(utilisateurs, eq(utilisateurs.id, cours.formateurId))
      .where(eq(seances.id, id));
    if (!l) throw introuvable("Séance");
    const p = perimetreSites(u);
    if (p) {
      const [concerne] = await db.execute<{ x: number }>(sql`
        SELECT 1 AS x FROM campus.cours_classes cc JOIN campus.classes cl ON cl.id = cc.classe_id
        WHERE cc.cours_id = ${l.s.coursId} AND cl.site_id = ANY(${entiers(p)})
        UNION ALL
        SELECT 1 FROM campus.inscriptions i JOIN campus.utilisateurs e ON e.id = i.utilisateur_id
        WHERE i.cours_id = ${l.s.coursId} AND e.site_id = ANY(${entiers(p)})
        LIMIT 1`).then((r) => r.rows);
      if (!concerne) throw introuvable("Séance");
    }
    return l;
  }

  app.get(
    `${P}/presences`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const p = perimetreSites(u);
      const debut = lundiDe(req.query.semaine);
      const fin = new Date(debut.getTime() + 7 * JOUR_MS);
      const resumes = await db.execute<LigneResume & { seance_id: number; titre: string; cours_code: string; debut: Date }>(sql`
        SELECT seance_id, min(seance_titre) AS titre, min(cours_code) AS cours_code, min(debut) AS debut, ${COLONNES_RESUME}
        FROM (${sqlAttendus({ depuis: debut, jusqua: fin, sites: p, inclureEnCours: true })}) a
        GROUP BY seance_id
        ORDER BY min(debut) DESC`);
      const statuts = resumes.rows.length
        ? await db
            .select({ id: seances.id, statut: seances.statut })
            .from(seances)
            .where(inArray(seances.id, resumes.rows.map((r) => r.seance_id)))
        : [];
      const statutDe = new Map(statuts.map((s) => [s.id, s.statut]));
      const liste: ListePresences = {
        debut: debut.toISOString(),
        fin: fin.toISOString(),
        seances: resumes.rows.map(
          (r): SeancePresenceLigne => ({
            id: r.seance_id,
            titre: r.titre,
            coursCode: r.cours_code,
            debut: iso(r.debut)!,
            statut: statutDe.get(r.seance_id) ?? "terminee",
            resume: versResume(r),
          }),
        ),
      };
      res.json(liste);
    }),
  );

  /** Lignes nominatives d'une séance, dans le périmètre. */
  async function presencesDeSeance(u: Utilisateur, seanceId: number) {
    const p = perimetreSites(u);
    const r = await db.execute<LigneAttendu & { prenom: string; nom: string; matricule: string | null; classe: string | null; site: string | null; site_ordre: number | null }>(sql`
      SELECT a.*, e.prenom, e.nom, e.matricule, cl.nom AS classe, st.nom_court AS site, st.ordre AS site_ordre
      FROM (${sqlAttendus({ seanceId, sites: p, inclureAVenir: true })}) a
      JOIN campus.utilisateurs e ON e.id = a.uid
      LEFT JOIN campus.classes cl ON cl.id = e.classe_id
      LEFT JOIN campus.sites st ON st.id = a.site_id
      ORDER BY st.ordre NULLS LAST, e.nom, e.prenom`);
    return r.rows;
  }

  app.get(
    `${P}/presences/seance/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { s, code, coursTitre, formateurPrenom, formateurNom } = await seanceGeree(u, idParam(req));
      const p = perimetreSites(u);
      const lignes = await presencesDeSeance(u, s.id);
      const effectifs = await db.select().from(effectifsSalles).where(eq(effectifsSalles.seanceId, s.id));
      const listeSites = await db.select().from(sites).where(surSites(sites.id, p)).orderBy(asc(sites.ordre));

      const reelle = s.demarreeLe && s.termineeLe ? (s.termineeLe.getTime() - s.demarreeLe.getTime()) / 60_000 : s.dureeMinutes;
      const dureeReference = Math.max(1, Math.round(Math.min(s.dureeMinutes, reelle)));
      const parSite = new Map<number | null, typeof lignes>();
      for (const l of lignes) parSite.set(l.site_id, [...(parSite.get(l.site_id) ?? []), l]);
      // Les campus sans étudiant attendu mais avec une salle déclarée apparaissent aussi.
      for (const e of effectifs) if (!parSite.has(e.siteId) && (!p || p.includes(e.siteId))) parSite.set(e.siteId, []);

      const campus: PresencesCampus[] = [...parSite.entries()]
        .map(([siteId, ls]): PresencesCampus => {
          const eff = effectifs.find((e) => e.siteId === siteId);
          const resume = resumeDe(ls);
          const enSalle = resume.emarge + resume.pointe;
          return {
            ...resume,
            siteId,
            site: listeSites.find((x) => x.id === siteId)?.nomCourt ?? ls[0]?.site ?? "Sans campus",
            effectifDeclare: eff ? eff.nombre : null,
            salle: eff ? { prete: eff.prete, incident: eff.incident } : null,
            ecart: eff && eff.nombre ? enSalle - eff.nombre : null,
            etudiants: ls.map(
              (l): PresenceEtudiant => ({
                id: l.uid,
                prenom: l.prenom,
                nom: l.nom,
                matricule: l.matricule,
                classe: l.classe,
                statut: l.statut,
                minutes: l.minutes,
                arriveeLe: comptePresent(l.statut) ? iso(l.arrivee_le) : null,
                retard: l.retard,
                justification: l.justification,
              }),
            ),
          };
        })
        .sort((a, b) => (listeSites.findIndex((x) => x.id === a.siteId) + 99) % 99 - (listeSites.findIndex((x) => x.id === b.siteId) + 99) % 99);

      const reponse: PresencesSeance = {
        seance: {
          id: s.id,
          titre: s.titre,
          coursId: s.coursId,
          coursCode: code,
          coursTitre,
          debut: s.debut.toISOString(),
          dureeMinutes: s.dureeMinutes,
          statut: s.statut,
          formateur: formateurPrenom ? `${formateurPrenom} ${formateurNom}` : null,
        },
        dureeReference,
        seuil: SEUIL_PRESENCE_EN_LIGNE,
        aVenir: s.debut.getTime() > Date.now(),
        total: resumeDe(lignes),
        campus,
      };
      res.json(reponse);
    }),
  );

  app.get(
    `${P}/presences/seance/:id(\\d+)/export`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { s, code } = await seanceGeree(u, idParam(req));
      const lignes = await presencesDeSeance(u, s.id);
      const heureAbidjan = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
      const cellule = (v: string | number | null) => {
        const t = v === null ? "" : String(v);
        return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
      };
      const contenu = [
        ["Campus", "Matricule", "Nom", "Prénom", "Classe", "Statut", "Retard", "Minutes en ligne", "Arrivée (Abidjan)", "Justification"].join(";"),
        ...lignes.map((l) =>
          [
            l.site,
            l.matricule,
            l.nom,
            l.prenom,
            l.classe,
            LIBELLES_PRESENCE_PILOTAGE[l.statut],
            l.retard ? "oui" : "",
            l.minutes,
            l.arrivee_le && comptePresent(l.statut) ? heureAbidjan.format(new Date(l.arrivee_le)) : "",
            l.justification,
          ]
            .map(cellule)
            .join(";"),
        ),
      ].join("\r\n");
      await journaliser(u, "export_presences", { seanceId: s.id, lignes: lignes.length });
      const nom = `presences-${code}-${s.debut.toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${nom}"`);
      res.setHeader("Cache-Control", "no-store");
      // BOM : Excel reconnaît l'UTF-8 et affiche correctement les accents.
      res.send(`﻿${contenu}`);
    }),
  );

  app.get(
    `${P}/presences/etudiant/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      const r = await db.execute<LigneAttendu>(sql`
        SELECT * FROM (${sqlAttendus({ etudiantId: e.id, depuis: new Date(Date.now() - 365 * JOUR_MS), sites: null, inclureEnCours: true })}) a
        ORDER BY debut DESC`);
      const [info] = await db
        .select({ classe: classes.nom, site: sites.nomCourt })
        .from(utilisateurs)
        .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
        .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
        .where(eq(utilisateurs.id, e.id));
      const reponse: PresencesDEtudiant = {
        etudiant: {
          id: e.id,
          prenom: e.prenom,
          nom: e.nom,
          matricule: e.matricule,
          telephone: e.telephone,
          classe: info?.classe ?? null,
          siteId: e.siteId,
          site: info?.site ?? null,
        },
        resume: resumeDe(r.rows),
        seances: r.rows.map(versLignePresence),
      };
      res.json(reponse);
    }),
  );

  app.post(
    `${P}/presences/justifier`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(
        z.object({
          seanceId: z.number().int().positive(),
          etudiantId: z.number().int().positive(),
          justification: z.preprocess(vide, z.string().trim().max(300, "justification trop longue (300 caractères)").nullable()),
        }),
        req.body,
      );
      const e = await etudiantGere(u, d.etudiantId);
      const { s } = await seanceGeree(u, d.seanceId);
      if (s.debut.getTime() > Date.now()) throw invalide("Cette séance n'a pas encore eu lieu.");
      const [attendu] = await db.execute<LigneAttendu>(sqlAttendus({ seanceId: s.id, etudiantId: e.id, sites: null, inclureEnCours: true })).then((r) => r.rows);
      if (!attendu) throw invalide("Cet étudiant n'était pas attendu à cette séance.");
      await db
        .insert(presences)
        // Ligne créée pour un absent : ni arrivée ni activité réelles (on date à l'heure de la séance
        // pour ne pas fausser « vu sur le campus »).
        .values({ seanceId: s.id, utilisateurId: e.id, siteId: e.siteId, mode: "en_ligne", minutes: 0, justification: d.justification, arriveeLe: s.debut, derniereActivite: s.debut })
        .onConflictDoUpdate({ target: [presences.seanceId, presences.utilisateurId], set: { justification: d.justification } });
      await journaliser(u, "absence_justifiee", { seanceId: s.id, etudiantId: e.id, retiree: d.justification === null });
      const [apres] = await db.execute<LigneAttendu>(sqlAttendus({ seanceId: s.id, etudiantId: e.id, sites: null, inclureEnCours: true })).then((r) => r.rows);
      res.json({ statut: apres?.statut ?? "absent", justification: d.justification });
    }),
  );

  // ── Site 2iae.com ────────────────────────────────────────────────────────

  app.get(
    `${P}/site`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const maintenant = new Date();
      const elements: ElementSite[] = [];

      const listeCours = await db
        .select({ c: cours, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
        .from(cours)
        .leftJoin(utilisateurs, eq(utilisateurs.id, cours.formateurId))
        .where(and(ne(cours.statut, "archive"), or(eq(cours.statut, "publie"), eq(cours.proposeSurSite, true), eq(cours.publierSurSite, true))))
        .orderBy(asc(cours.code));
      for (const { c, prenom, nom } of listeCours) {
        elements.push({
          type: "cours",
          id: c.id,
          titre: c.titre,
          sousTitre: [c.code, prenom ? `${prenom} ${nom}` : null].filter(Boolean).join(" · "),
          texte: c.accrocheSite || c.description.split(/(?<=[.!?])\s/)[0] || null,
          couleur: c.couleur,
          imageUrl: c.imageUrl,
          date: iso(c.dateDebut),
          propose: c.proposeSurSite,
          publie: c.publierSurSite,
          consentement: null,
          bloque: c.statut !== "publie" ? "Cours encore en brouillon sur le campus." : null,
          lienCampus: `/cours/${c.id}`,
        });
      }

      const formateurs = await db
        .select()
        .from(utilisateurs)
        .where(
          and(
            eq(utilisateurs.role, "formateur"),
            or(eq(utilisateurs.consentementSite, true), eq(utilisateurs.proposeSurSite, true), eq(utilisateurs.publierSurSite, true)),
          ),
        )
        .orderBy(asc(utilisateurs.nom));
      for (const f of formateurs) {
        elements.push({
          type: "formateur",
          id: f.id,
          titre: `${f.prenom} ${f.nom}`,
          sousTitre: [f.titre, f.localisation].filter(Boolean).join(" · ") || null,
          texte: f.bio,
          couleur: null,
          imageUrl: f.photoUrl,
          date: iso(f.annonceLe),
          propose: f.proposeSurSite,
          publie: f.publierSurSite,
          consentement: f.consentementSite,
          bloque: !f.actif ? "Compte désactivé." : !f.consentementSite ? "Pas encore d'accord du formateur : il se donne dans son profil." : null,
          lienCampus: null,
        });
      }

      const lives = await db
        .select({ s: seances, code: cours.code, couleur: cours.couleur, coursStatut: cours.statut })
        .from(seances)
        .innerJoin(cours, eq(cours.id, seances.coursId))
        .where(
          and(
            ne(seances.statut, "annulee"),
            or(
              and(sql`${seances.debut} + make_interval(mins => ${seances.dureeMinutes}) > now()`, lt(seances.debut, new Date(maintenant.getTime() + 14 * JOUR_MS))),
              eq(seances.publierSurSite, true),
              eq(seances.proposeSurSite, true),
            ),
            gte(seances.debut, new Date(maintenant.getTime() - 7 * JOUR_MS)),
          ),
        )
        .orderBy(asc(seances.debut));
      for (const { s, code, couleur, coursStatut } of lives) {
        const passe = s.debut.getTime() + s.dureeMinutes * 60_000 < maintenant.getTime() || s.statut === "terminee";
        elements.push({
          type: "seance",
          id: s.id,
          titre: s.titre,
          sousTitre: code,
          texte: s.description || null,
          couleur,
          imageUrl: null,
          date: s.debut.toISOString(),
          propose: s.proposeSurSite,
          publie: s.publierSurSite,
          consentement: null,
          bloque: passe ? "Live passé : il a disparu seul du site." : coursStatut !== "publie" ? "Le cours est encore en brouillon." : null,
          lienCampus: `/live/${s.id}`,
        });
      }

      const listeAnnonces = await db
        .select()
        .from(annonces)
        .where(and(or(eq(annonces.proposeSurSite, true), eq(annonces.publierSurSite, true))))
        .orderBy(desc(annonces.publieeLe))
        .limit(40);
      for (const a of listeAnnonces) {
        const expiree = Boolean(a.expireLe && a.expireLe < maintenant);
        elements.push({
          type: "annonce",
          id: a.id,
          titre: a.titre,
          sousTitre: null,
          texte: a.corps.slice(0, 280),
          couleur: null,
          imageUrl: null,
          date: a.publieeLe.toISOString(),
          propose: a.proposeSurSite,
          publie: a.publierSurSite,
          consentement: null,
          bloque: expiree ? "Annonce expirée : elle n'apparaît plus." : null,
          lienCampus: "/annonces",
        });
      }

      const etat: EtatSite = {
        elements,
        webhookConfigure: Boolean(config.webhookSite && config.secretSite),
        urlSite: config.urlSite,
        // Exactement ce que GET /api/public/vitrine renvoie au site (module vitrine).
        apercu: await lireVitrine(),
        peutPublier: u.role === "admin",
      };
      res.json(etat);
    }),
  );

  app.post(
    `${P}/site/publier`,
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(
        z.object({ type: z.enum(["cours", "formateur", "seance", "annonce"]), id: z.number().int().positive(), publier: z.boolean() }),
        req.body,
      );
      const type: TypePublication = d.type;
      if (type === "cours") {
        const [c] = await db.select().from(cours).where(eq(cours.id, d.id));
        if (!c) throw introuvable("Cours");
        if (d.publier && c.statut !== "publie") throw invalide("Ce cours est encore en brouillon sur le campus : ouvrez-le d'abord aux étudiants.");
        await db.update(cours).set({ publierSurSite: d.publier, proposeSurSite: false, majLe: new Date() }).where(eq(cours.id, c.id));
      } else if (type === "formateur") {
        const [f] = await db.select().from(utilisateurs).where(and(eq(utilisateurs.id, d.id), eq(utilisateurs.role, "formateur")));
        if (!f) throw introuvable("Formateur");
        if (d.publier && !f.consentementSite) throw new ErreurHttp(409, "Ce formateur n'a pas donné son accord pour être présenté sur 2iae.com.");
        if (d.publier && !f.actif) throw invalide("Ce compte est désactivé.");
        await db
          .update(utilisateurs)
          .set({ publierSurSite: d.publier, proposeSurSite: false, ...(d.publier && !f.annonceLe ? { annonceLe: new Date() } : {}) })
          .where(eq(utilisateurs.id, f.id));
        oublierUtilisateur(f.id);
      } else if (type === "seance") {
        const [s] = await db.select().from(seances).where(eq(seances.id, d.id));
        if (!s) throw introuvable("Séance");
        const passe = s.debut.getTime() + s.dureeMinutes * 60_000 < Date.now() || s.statut === "terminee" || s.statut === "annulee";
        if (d.publier && passe) throw invalide("Ce live est passé ou annulé : il ne peut plus être annoncé.");
        await db.update(seances).set({ publierSurSite: d.publier, proposeSurSite: false }).where(eq(seances.id, s.id));
      } else {
        const [a] = await db.select().from(annonces).where(eq(annonces.id, d.id));
        if (!a) throw introuvable("Annonce");
        await db.update(annonces).set({ publierSurSite: d.publier, proposeSurSite: false }).where(eq(annonces.id, a.id));
      }
      oublierVitrine(); // l'aperçu et la vitrine publique reflètent aussitôt le changement
      prevenirSite(`${type} ${d.publier ? "publié" : "retiré"}`);
      await journaliser(u, "publication_site", { type, id: d.id, publier: d.publier });
      res.json({ ok: true, publie: d.publier });
    }),
  );

  app.post(
    `${P}/site/prevenir`,
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const configure = Boolean(config.webhookSite && config.secretSite);
      oublierVitrine();
      prevenirSite("demande de la direction");
      await journaliser(u, "site_prevenu", { configure });
      res.json({ configure });
    }),
  );

  // ── Dossier étudiant ─────────────────────────────────────────────────────

  app.get(
    `${P}/etudiants/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      const [info] = await db
        .select({ classe: classes.nom, annee: classes.anneeScolaire, site: sites.nomCourt })
        .from(utilisateurs)
        .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
        .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
        .where(eq(utilisateurs.id, e.id));
      const resumeEtudiant: EtudiantResume = {
        id: e.id,
        prenom: e.prenom,
        nom: e.nom,
        matricule: e.matricule,
        telephone: e.telephone,
        classe: info?.classe ?? null,
        siteId: e.siteId,
        site: info?.site ?? null,
      };

      const presencesEtudiant = await db.execute<LigneAttendu>(sql`
        SELECT * FROM (${sqlAttendus({ etudiantId: e.id, depuis: new Date(Date.now() - 365 * JOUR_MS), sites: null, inclureEnCours: true })}) a
        ORDER BY debut DESC`);
      const devoirs = await devoirsDe(e.id);
      const maintenant = Date.now();
      const listeDevoirs: DevoirDossier[] = devoirs.slice(0, 60).map((d) => {
        const n = noteRetenue(d);
        const echu = new Date(d.date_limite).getTime() < maintenant;
        let etat: DevoirDossier["etat"];
        if (n !== null) etat = "corrige";
        else if (d.statut_rendu === "rendu" || d.statut_rendu === "corrige" || d.quiz_fini) etat = d.en_retard ? "en_retard" : "rendu";
        else etat = echu ? "non_rendu" : "a_venir";
        return { id: d.devoir_id, titre: d.titre, coursCode: d.cours_code, type: d.type, dateLimite: iso(d.date_limite)!, etat, note: n, bareme: d.bareme };
      });
      const listeSuivis = await db
        .select({ id: suivis.id, texte: suivis.texte, creeLe: suivis.creeLe, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
        .from(suivis)
        .innerJoin(utilisateurs, eq(utilisateurs.id, suivis.auteurId))
        .where(eq(suivis.etudiantId, e.id))
        .orderBy(desc(suivis.creeLe));
      const activite = await derniereActivite([e.id]);

      let releve: DossierEtudiant["releve"] = null;
      if (e.jetonReleve) {
        const [stats] = await db.execute<{ consultations: number; partage_le: Date | null }>(sql`
          SELECT
            (SELECT count(*)::int FROM campus.journal WHERE action = 'releve_consulte' AND details->>'etudiantId' = ${String(e.id)}
              AND cree_le >= COALESCE((SELECT max(cree_le) FROM campus.journal WHERE action = 'releve_partage' AND details->>'etudiantId' = ${String(e.id)}), '-infinity')) AS consultations,
            (SELECT max(cree_le) FROM campus.journal WHERE action = 'releve_partage' AND details->>'etudiantId' = ${String(e.id)}) AS partage_le`).then((r) => r.rows);
        const lien = lienReleve(e.jetonReleve);
        releve = {
          lien,
          whatsapp: lienWhatsApp(null, messageReleve(e, info?.classe ?? null, info?.site ?? null, lien)),
          consultations: stats?.consultations ?? 0,
          partageLe: iso(stats?.partage_le),
        };
      }

      const dossier: DossierEtudiant = {
        etudiant: { ...resumeEtudiant, email: e.email, photoUrl: e.photoUrl, actif: e.actif, creeLe: e.creeLe.toISOString(), anneeScolaire: info?.annee ?? null },
        activation: { active: !e.doitChangerMotDePasse, codeExpireLe: iso(e.motDePasseExpireLe), charteAccepteeLe: iso(e.charteAccepteeLe) },
        derniereConnexion: iso(e.derniereConnexion),
        derniereActivite: iso(activite.get(e.id)),
        presences: { resume: resumeDe(presencesEtudiant.rows), seances: presencesEtudiant.rows.slice(0, 40).map(versLignePresence) },
        devoirs: listeDevoirs,
        notes: moyennesDe(devoirs),
        suivis: listeSuivis.map((s) => ({ id: s.id, texte: s.texte, auteur: `${s.prenom} ${s.nom}`, creeLe: s.creeLe.toISOString() })),
        releve,
        whatsapp: numeroWhatsApp(e.telephone) ? lienWhatsApp(e.telephone, entreeMessage(e.prenom, info?.site ?? null)) : null,
      };
      res.json(dossier);
    }),
  );

  app.post(
    `${P}/etudiants/:id(\\d+)/suivis`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      const { texte } = valider(z.object({ texte: z.string().trim().min(2, "écrivez quelques mots").max(2000, "note trop longue (2 000 caractères)") }), req.body);
      const [s] = await db.insert(suivis).values({ etudiantId: e.id, auteurId: u.id, texte }).returning();
      res.status(201).json({ id: s.id, texte: s.texte, auteur: `${u.prenom} ${u.nom}`, creeLe: s.creeLe.toISOString() });
    }),
  );

  app.post(
    `${P}/etudiants/:id(\\d+)/releve`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      if (!e.actif) throw invalide("Ce compte est désactivé : pas de relevé à partager.");
      // 128 bits aléatoires : impossible à deviner ; un nouveau lien remplace l'ancien.
      const jeton = crypto.randomBytes(16).toString("base64url");
      await db.update(utilisateurs).set({ jetonReleve: jeton }).where(eq(utilisateurs.id, e.id));
      oublierUtilisateur(e.id);
      await journaliser(u, "releve_partage", { etudiantId: e.id });
      const [info] = await db
        .select({ classe: classes.nom, site: sites.nomCourt })
        .from(utilisateurs)
        .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
        .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
        .where(eq(utilisateurs.id, e.id));
      const lien = lienReleve(jeton);
      const reponse: ReleveCree = { lien, whatsapp: lienWhatsApp(null, messageReleve(e, info?.classe ?? null, info?.site ?? null, lien)) };
      res.status(201).json(reponse);
    }),
  );

  app.delete(
    `${P}/etudiants/:id(\\d+)/releve`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      await db.update(utilisateurs).set({ jetonReleve: null }).where(eq(utilisateurs.id, e.id));
      oublierUtilisateur(e.id);
      await journaliser(u, "releve_revoque", { etudiantId: e.id });
      res.json({ ok: true });
    }),
  );

  // ── Relevé parent (public, sans connexion) ───────────────────────────────

  app.get(
    "/api/releve/:jeton",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      const jeton = String(req.params.jeton);
      const indisponible = () => new ErreurHttp(404, "Ce relevé n'est plus disponible. Demandez un nouveau lien à la vie scolaire du campus.");
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(jeton)) throw indisponible();
      const [e] = await db
        .select({
          id: utilisateurs.id,
          prenom: utilisateurs.prenom,
          nom: utilisateurs.nom,
          classe: classes.nom,
          annee: classes.anneeScolaire,
          site: sites.nomCourt,
        })
        .from(utilisateurs)
        .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
        .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
        .where(and(eq(utilisateurs.jetonReleve, jeton), eq(utilisateurs.role, "etudiant"), eq(utilisateurs.actif, true)));
      if (!e) throw indisponible();

      const notes = moyennesDe(await devoirsDe(e.id));
      const lignes = await db
        .execute<LigneAttendu>(sqlAttendus({ etudiantId: e.id, depuis: new Date(Date.now() - 365 * JOUR_MS), sites: null }))
        .then((r) => r.rows);
      const resume = resumeDe(lignes);

      if (!consultationsNotees.has(jeton)) {
        consultationsNotees.set(jeton, Date.now());
        await db.insert(journal).values({ utilisateurId: null, action: "releve_consulte", details: { etudiantId: e.id } });
      }
      const releve: ReleveParent = {
        etudiant: { prenom: e.prenom, nom: e.nom },
        classe: e.classe,
        campus: e.site,
        anneeScolaire: e.annee,
        moyennes: notes.cours.map(({ code, titre, moyenne, notes: n }) => ({ code, titre, moyenne, notes: n })),
        moyenneGenerale: notes.generale,
        presence: { taux: resume.taux, seances: resume.attendus, presents: resume.presents, justifiees: resume.justifie },
        date: new Date().toISOString(),
      };
      res.json(releve);
    }),
  );

  // ── Budget IA ────────────────────────────────────────────────────────────

  app.get(
    `${P}/ia`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const p = perimetreSites(u);
      const aujourdHui = new Date();
      aujourdHui.setUTCHours(0, 0, 0, 0);
      const debut = new Date(aujourdHui.getTime() - 29 * JOUR_MS);
      const debutJour = debut.toISOString().slice(0, 10);
      const filtre = and(gte(usageIa.jour, debutJour), p ? inArray(utilisateurs.siteId, p) : undefined);
      const somme = {
        requetes: sql<number>`COALESCE(sum(${usageIa.requetes}), 0)::int`,
        jetonsEntree: sql<number>`COALESCE(sum(${usageIa.jetonsEntree}), 0)::float8`,
        jetonsSortie: sql<number>`COALESCE(sum(${usageIa.jetonsSortie}), 0)::float8`,
      };
      const avecCout = <T extends { jetonsEntree: number; jetonsSortie: number }>(l: T): T & { cout: number } => ({
        ...l,
        cout: cout(l.jetonsEntree, l.jetonsSortie),
      });

      const jours = await db
        .select({ jour: usageIa.jour, ...somme })
        .from(usageIa)
        .innerJoin(utilisateurs, eq(utilisateurs.id, usageIa.utilisateurId))
        .where(filtre)
        .groupBy(usageIa.jour);
      const parJourMap = new Map(jours.map((j) => [j.jour, j]));
      const parJour = Array.from({ length: 30 }, (_, i) => {
        const j = new Date(debut.getTime() + i * JOUR_MS).toISOString().slice(0, 10);
        const l = parJourMap.get(j);
        return avecCout({ jour: j, requetes: l?.requetes ?? 0, jetonsEntree: l?.jetonsEntree ?? 0, jetonsSortie: l?.jetonsSortie ?? 0 });
      });

      const personnes = await db
        .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role, site: sites.nomCourt, ...somme })
        .from(usageIa)
        .innerJoin(utilisateurs, eq(utilisateurs.id, usageIa.utilisateurId))
        .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
        .where(filtre)
        .groupBy(utilisateurs.id, sites.nomCourt)
        .orderBy(desc(sql`sum(${usageIa.jetonsEntree}) * ${PRIX_IA.entree} + sum(${usageIa.jetonsSortie}) * ${PRIX_IA.sortie}`))
        .limit(10);
      const roles = await db
        .select({ role: utilisateurs.role, ...somme })
        .from(usageIa)
        .innerJoin(utilisateurs, eq(utilisateurs.id, usageIa.utilisateurId))
        .where(filtre)
        .groupBy(utilisateurs.role);

      const total: ConsommationIa = avecCout({
        requetes: parJour.reduce((s, j) => s + j.requetes, 0),
        jetonsEntree: parJour.reduce((s, j) => s + j.jetonsEntree, 0),
        jetonsSortie: parJour.reduce((s, j) => s + j.jetonsSortie, 0),
      });
      const budget: BudgetIa = {
        iaDisponible: iaDisponible(),
        modele: config.ia.modele,
        quotaJour: config.ia.quotaJour,
        prix: PRIX_IA,
        total,
        parJour,
        parPersonne: personnes.map(avecCout),
        parRole: roles.map(avecCout).sort((a, b) => b.cout - a.cout),
      };
      res.json(budget);
    }),
  );
}

function versLignePresence(l: LigneAttendu): LignePresenceEtudiant {
  return {
    seanceId: l.seance_id,
    titre: l.seance_titre,
    coursCode: l.cours_code,
    debut: iso(l.debut)!,
    statut: l.statut,
    minutes: l.minutes,
    retard: l.retard,
    justification: l.justification,
  };
}

