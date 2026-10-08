// Rappel d'entraînement du jour (chantier C4), et ce que partagent les
// relances : réglage de la direction, actes d'apprentissage, envoi d'un rappel,
// retours sous 48 h, purge.
//
// Toutes les 5 minutes, pour chaque étudiant : au plus un rappel par jour, à
// son heure (choisie, sinon habituelle, sinon 19 h ; jamais après 20 h 30),
// seulement s'il n'a pas encore travaillé ce jour-là et qu'aucun direct de
// ses cours n'est en cours. Le sujet est le premier qui s'applique : devoir dû
// dans les 30 h (sauf s'il vient d'être annoncé ou rappelé), séance où il
// n'a pas été compté présent (absent, jamais « inconnu ») avec cours
// complet prêt, cartes dues, objectif du jour, objectif de la semaine, cours
// complet récent pas encore ouvert. La décision elle-même est une fonction
// pure (deciderRappel, shared/engagement/relances.ts) ; ici, les faits et l'écriture.
//
// Chaque décision laisse une ligne dans relances_engagement (la contrainte
// unique utilisateur, jour, motif, canal fait qu'un rappel ne part qu'une fois,
// même si la tâche passe deux fois ou tourne sur deux instances). En mode
// « essai » (par défaut), la ligne est écrite en « simulation » et rien ne part.
//
// Les tables des autres chantiers (révision, objectif du jour, progression)
// sont lues en SQL brut après tableExiste ; une table absente ou différente de
// ce qu'on attend retire seulement ce sujet, jamais le rappel.
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { planifier } from "../taches";
import { notifier, pushDisponible, jourAbidjan, type NouvelleNotification } from "../notifications";
import { sqlAttendus, SQL_DUREE_REFERENCE } from "../routes/admin";
import { tableExiste } from "./tables";
import { sqlDevoirProposable } from "./proposables";
import { sqlEtatPresence } from "./presence";
import { avecTraces, sqlSeanceRattrapee } from "./progression-cours";
import { rappelEntrainementAutorise } from "./tirage";
import { ajouterJours, ecartJours, jourLocal, minutesLocales, semaineIso, type Jour } from "@shared/engagement/calendrier";
import {
  choisirVariante,
  deciderRappel,
  heureEffective,
  mediane,
  joursOuvresSansActe,
  CONSERVATION_RELANCES_JOURS,
  EMAILS_PAR_JOUR_DEFAUT,
  MOTIFS_DECROCHEUR,
  REPETITIONS_LIEN,
  DECROCHAGE,
  type ModeEmails,
  type ModeRelances,
  type StatutRelance,
  type SujetRappel,
} from "@shared/engagement/relances";
import { SUIVI_MINUTES, SUIVI_PART } from "@shared/engagement/indicateurs";
import { t, variantesDe, type CleRelances } from "@shared/textes/relances";
import { formaterDate } from "@shared/textes";
import { relancesEngagement } from "@shared/schema";

const MINUTE = 60_000;
const JOUR_MS = 86_400_000;

// ── Petits outils SQL ──────────────────────────────────────────────────────

/** Tableau d'entiers PostgreSQL en un seul paramètre. */
export const entiers = (ids: number[]) => sql`${`{${ids.map((i) => Math.trunc(i)).join(",")}}`}::int[]`;
/** Tableau de textes simples (jours, semaines : chiffres, tirets et « W » seulement). */
export const textesSimples = (valeurs: string[]) => {
  for (const v of valeurs) if (!/^[0-9A-Za-z-]+$/.test(v)) throw new Error(`textesSimples : valeur refusée « ${v} »`);
  return sql`${`{${valeurs.join(",")}}`}::text[]`;
};
/** Horodatage reçu de db.execute (texte « 2026-10-08 19:00:00+00 ») ou Date. */
export const versDate = (x: string | Date | null | undefined): Date | null => (x ? new Date(x) : null);
const iso = (d: Date | number) => new Date(d).toISOString();

/** Cours d'un étudiant (alias « u ») : sa classe ou une inscription, comme idsCoursAccessibles. */
export const sqlCoursDe = (coursId: SQL) => sql`(${coursId} IN (SELECT cc.cours_id FROM campus.cours_classes cc WHERE cc.classe_id = u.classe_id)
  OR ${coursId} IN (SELECT i.cours_id FROM campus.inscriptions i WHERE i.utilisateur_id = u.id))`;

// ── Réglage de la direction ────────────────────────────────────────────────

export type ReglageGlobal = {
  mode: ModeRelances;
  rappelsMode: ModeRelances;
  emailsMode: ModeEmails;
  emailsParJour: number;
  majLe: Date | null;
  majPar: number | null;
};
const REGLAGE_DEFAUT: ReglageGlobal = { mode: "essai", rappelsMode: "essai", emailsMode: "essai", emailsParJour: EMAILS_PAR_JOUR_DEFAUT, majLe: null, majPar: null };
let reglageEnMemoire: { r: ReglageGlobal; le: number } | null = null;

/** Réglage de la direction (une seule ligne, id = 1) ; sans ligne : tout en essai, 40 e-mails par jour. Gardé 30 s. */
export async function lireReglage(): Promise<ReglageGlobal> {
  if (reglageEnMemoire && Date.now() - reglageEnMemoire.le < 30_000) return reglageEnMemoire.r;
  const r = await db.execute<{ mode: ModeRelances; rappels_mode: ModeRelances; emails_mode: ModeEmails; emails_par_jour: number; maj_le: string; maj_par: number | null }>(
    sql`SELECT mode, rappels_mode, emails_mode, emails_par_jour, maj_le, maj_par FROM campus.reglage_relances WHERE id = 1`,
  );
  const l = r.rows[0];
  const reglage: ReglageGlobal = l
    ? { mode: l.mode, rappelsMode: l.rappels_mode, emailsMode: l.emails_mode, emailsParJour: l.emails_par_jour, majLe: versDate(l.maj_le), majPar: l.maj_par }
    : REGLAGE_DEFAUT;
  reglageEnMemoire = { r: reglage, le: Date.now() };
  return reglage;
}
export const oublierReglage = () => void (reglageEnMemoire = null);

// ── Actes d'apprentissage ──────────────────────────────────────────────────
// Ce qui compte, avec les mêmes seuils que le tableau Engagement (C8) et la
// Coupe (C5) : copie rendue par l'étudiant (pas une copie papier déposée par
// la vie scolaire), QCM avec au moins une réponse (l'ouvrir ne suffit pas),
// présence en salle (émargé ou pointé présent) ou direct suivi en ligne au
// moins 30 minutes (ou la moitié d'une séance plus courte : une minute de
// direct ne suffit pas), leçon terminée, replay ou cours complet ouvert, et,
// quand leurs tables existent, réponse de révision (C1), cours complet suivi
// (C1), objectif du jour validé (C2). Une simple ouverture du campus, un
// message ou une question à l'assistant ne comptent pas.

type SourceActe = { nom: string; table?: string; uid: string; t: string; de: string; condition?: string; conditionSql?: SQL };
const SOURCES_DE_BASE: SourceActe[] = [
  { nom: "rendus", uid: "etudiant_id", t: "rendu_le", de: "campus.rendus", condition: "statut IN ('rendu', 'corrige') AND rendu_le IS NOT NULL AND depose_par_id IS NULL" },
  {
    nom: "tentatives_quiz",
    uid: "etudiant_id",
    t: "COALESCE(fin_le, debut_le)",
    de: "campus.tentatives_quiz",
    condition: `EXISTS (SELECT 1 FROM jsonb_each(reponses) e WHERE e.value NOT IN ('[]'::jsonb, 'null'::jsonb, '""'::jsonb, '{}'::jsonb))`,
  },
  {
    nom: "presences",
    uid: "pr.utilisateur_id",
    t: "CASE WHEN pr.mode = 'salle' THEN COALESCE(pr.arrivee_salle_le, pr.arrivee_le) ELSE pr.derniere_activite END",
    de: "campus.presences pr JOIN campus.seances s ON s.id = pr.seance_id",
    condition: "NULLIF(pr.justification, '') IS NULL",
    conditionSql: sql`(pr.mode = 'salle' OR pr.minutes >= LEAST(${SUIVI_MINUTES}::int, GREATEST(1, ceil((${SQL_DUREE_REFERENCE})::float8 * ${SUIVI_PART}::float8))::int))`,
  },
  { nom: "progressions", uid: "utilisateur_id", t: "terminee_le", de: "campus.progressions" },
  { nom: "vues_replay", uid: "utilisateur_id", t: "derniere_vue", de: "campus.vues_replay" },
];
const SOURCES_FACULTATIVES: SourceActe[] = [
  { nom: "reponses_revision", table: "reponses_revision", uid: "utilisateur_id", t: "repondu_le", de: "campus.reponses_revision" },
  { nom: "suivis_cours_complets", table: "suivis_cours_complets", uid: "utilisateur_id", t: "GREATEST(ouvert_le, revu_le)", de: "campus.suivis_cours_complets" },
  { nom: "objectifs_jours", table: "objectifs_jours", uid: "utilisateur_id", t: "valide_le", de: "campus.objectifs_jours", condition: "valide_le IS NOT NULL" },
];

let sourcesEnMemoire: { liste: SourceActe[]; le: number } | null = null;
const sourcesSignalees = new Set<string>();

/** Sources en service : celles de base, plus les tables des autres chantiers qui existent et se lisent comme prévu. */
async function sourcesActes(): Promise<SourceActe[]> {
  if (sourcesEnMemoire && Date.now() - sourcesEnMemoire.le < 10 * MINUTE) return sourcesEnMemoire.liste;
  const liste = [...SOURCES_DE_BASE];
  for (const s of SOURCES_FACULTATIVES) {
    if (!s.table || !(await tableExiste(s.table))) continue;
    try {
      await db.execute(sql.raw(`SELECT ${s.uid} AS uid, ${s.t} AS t FROM ${s.de} LIMIT 0`));
      liste.push(s);
    } catch (e) {
      if (!sourcesSignalees.has(s.nom)) {
        sourcesSignalees.add(s.nom);
        console.warn(`[relances] source d'actes « ${s.nom} » ignorée :`, (e as Error).message);
      }
    }
  }
  sourcesEnMemoire = { liste, le: Date.now() };
  return liste;
}

/**
 * Actes d'apprentissage (uid, t) postérieurs à « depuis », pour une liste
 * d'étudiants (uids) ou un étudiant désigné par une expression SQL (uid, dans
 * une sous-requête corrélée). Chaque branche filtre elle-même : les index des
 * tables servent.
 */
export async function sqlActes(o: { depuis: SQL; uids?: number[]; uid?: SQL; jusqua?: SQL }): Promise<SQL> {
  const branches = (await sourcesActes()).map((s) => {
    const filtre: SQL[] = [sql`${sql.raw(`(${s.t})`)} > ${o.depuis}`];
    if (o.jusqua) filtre.push(sql`${sql.raw(`(${s.t})`)} <= ${o.jusqua}`);
    if (s.condition) filtre.push(sql.raw(`(${s.condition})`));
    if (s.conditionSql) filtre.push(s.conditionSql);
    if (o.uids) filtre.push(sql`${sql.raw(s.uid)} = ANY(${entiers(o.uids)})`);
    if (o.uid) filtre.push(sql`${sql.raw(s.uid)} = ${o.uid}`);
    return sql`SELECT ${sql.raw(s.uid)} AS uid, ${sql.raw(s.t)} AS t FROM ${sql.raw(s.de)} WHERE ${sql.join(filtre, sql` AND `)}`;
  });
  return sql.join(branches, sql` UNION ALL `);
}

/** Dernier acte d'apprentissage de chaque étudiant sur les « jours » derniers jours (absent : aucun). */
export async function derniersActes(uids: number[], jours = 60, maintenant = Date.now()): Promise<Map<number, Date>> {
  const m = new Map<number, Date>();
  if (!uids.length) return m;
  const actes = await sqlActes({ depuis: sql`${iso(maintenant - jours * JOUR_MS)}::timestamptz`, uids });
  const r = await db.execute<{ uid: number; t: string }>(sql`SELECT uid, max(t) AS t FROM (${actes}) a GROUP BY uid`);
  for (const l of r.rows) if (l.t) m.set(l.uid, new Date(l.t));
  return m;
}

/** Décalage du fuseau à cet instant, en minutes (Toronto en été : −240). */
export function decalageMinutes(fuseau: string | null, maintenant: number): number {
  const jour = jourLocal(maintenant, fuseau);
  const [a, mo, j] = jour.split("-").map(Number);
  const local = Date.UTC(a, mo - 1, j) + minutesLocales(maintenant, fuseau) * MINUTE;
  return Math.round((local - Math.floor(maintenant / MINUTE) * MINUTE) / MINUTE);
}

const habitudes = new Map<number, { jour: Jour; minutes: number | null }>();

/**
 * Heure habituelle de travail (minutes, heure locale) : médiane des heures de
 * ses actes d'apprentissage sur 14 jours. Calculée une fois par jour et par
 * étudiant, en une requête pour tous ceux qui en manquent.
 */
export async function heuresHabituelles(etudiants: { id: number; fuseau: string | null; jour: Jour }[], maintenant = Date.now()): Promise<Map<number, number | null>> {
  const resultat = new Map<number, number | null>();
  const manquants = etudiants.filter((e) => {
    const h = habitudes.get(e.id);
    if (h && h.jour === e.jour) resultat.set(e.id, h.minutes);
    return !(h && h.jour === e.jour);
  });
  if (manquants.length) {
    const actes = await sqlActes({ depuis: sql`${iso(maintenant - 14 * JOUR_MS)}::timestamptz`, uids: manquants.map((e) => e.id) });
    const decalages = manquants.map((e) => decalageMinutes(e.fuseau, maintenant));
    const r = await db.execute<{ uid: number; minutes: number[] }>(sql`
      SELECT a.uid, array_agg((((floor(extract(epoch FROM a.t) / 60)::bigint + o.decalage) % 1440 + 1440) % 1440)::int) AS minutes
      FROM (${actes}) a
      JOIN unnest(${entiers(manquants.map((e) => e.id))}, ${entiers(decalages)}) AS o(uid, decalage) ON o.uid = a.uid
      GROUP BY a.uid`);
    const parUid = new Map(r.rows.map((l) => [l.uid, mediane(l.minutes)]));
    for (const e of manquants) {
      const m = parUid.get(e.id) ?? null;
      habitudes.set(e.id, { jour: e.jour, minutes: m });
      resultat.set(e.id, m);
    }
  }
  return resultat;
}
export const oublierHabitudes = () => habitudes.clear();

/**
 * Jours entiers depuis le dernier acte d'apprentissage, ou depuis la création du compte s'il est
 * plus récent : le nombre dit dans les textes. Les seuils des relances comptent, eux, les jours
 * ouvrés (joursOuvresSansActe, shared/engagement/relances.ts).
 */
export function joursSansActe(dernier: Date | null | undefined, creeLe: Date, maintenant: number): number {
  const reference = Math.max(dernier?.getTime() ?? 0, creeLe.getTime());
  return Math.floor((maintenant - reference) / JOUR_MS);
}

// ── Faits communs ──────────────────────────────────────────────────────────

/** Étudiants qui ont au moins un téléphone abonné aux rappels (et un service d'envoi configuré). */
export async function abonnes(uids: number[]): Promise<Set<number>> {
  if (!uids.length || !pushDisponible()) return new Set();
  const r = await db.execute<{ uid: number }>(sql`SELECT DISTINCT utilisateur_id AS uid FROM campus.abonnements_push WHERE utilisateur_id = ANY(${entiers(uids)})`);
  return new Set(r.rows.map((l) => l.uid));
}

/** Rappels déjà partis aujourd'hui (compteurs_push), au jour local de chacun, comme notifications.ts les compte. */
export async function rappelsDuJour(etudiants: { id: number; fuseau: string | null }[], maintenant = Date.now()): Promise<Map<number, number>> {
  if (!etudiants.length) return new Map();
  const jours = etudiants.map((e) => jourLocal(maintenant, e.fuseau));
  const r = await db.execute<{ uid: number; n: number }>(sql`
    SELECT c.utilisateur_id AS uid, c.nombre AS n FROM campus.compteurs_push c
    JOIN unnest(${entiers(etudiants.map((e) => e.id))}, ${textesSimples(jours)}) AS x(uid, jour) ON x.uid = c.utilisateur_id AND c.jour::text = x.jour`);
  return new Map(r.rows.map((l) => [l.uid, l.n]));
}

/**
 * Pause automatique toujours en cours (le dernier rappel d'entraînement parti était le message
 * « on arrête de t'en envoyer », sans acte d'apprentissage ni réglage touché depuis). « dernierActe »
 * vient de derniersActes, « reglageMajLe » de reglages_engagement.maj_le.
 */
export async function pausesAutomatiques(etudiants: { id: number; dernierActe: Date | null; reglageMajLe: Date | null }[]): Promise<Set<number>> {
  const enPause = new Set<number>();
  if (!etudiants.length) return enPause;
  const r = await db.execute<{ uid: number; statut: StatutRelance; cree_le: string }>(sql`
    SELECT DISTINCT ON (utilisateur_id) utilisateur_id AS uid, statut, cree_le FROM campus.relances_engagement
    WHERE utilisateur_id = ANY(${entiers(etudiants.map((e) => e.id))}) AND motif = 'rappel_du_jour' AND statut IN ('envoye', 'pause_auto')
    ORDER BY utilisateur_id, cree_le DESC`);
  const parUid = new Map(r.rows.map((l) => [l.uid, l]));
  for (const e of etudiants) {
    const l = parUid.get(e.id);
    if (l?.statut !== "pause_auto") continue;
    const le = new Date(l.cree_le);
    if (!(e.dernierActe && e.dernierActe > le) && !(e.reglageMajLe && e.reglageMajLe > le)) enPause.add(e.id);
  }
  return enPause;
}

/** Directs de ses cours en cours, ou qui commencent dans l'heure : pas de rappel d'entraînement à ce moment-là. */
async function livesProches(uids: number[], maintenant: number): Promise<Set<number>> {
  if (!uids.length) return new Set();
  const r = await db.execute<{ uid: number }>(sql`
    SELECT u.id AS uid FROM campus.utilisateurs u
    WHERE u.id = ANY(${entiers(uids)}) AND EXISTS (
      SELECT 1 FROM campus.seances s
      WHERE (s.statut = 'en_direct' OR (s.statut = 'planifiee' AND s.debut BETWEEN ${iso(maintenant)}::timestamptz AND ${iso(maintenant + 60 * MINUTE)}::timestamptz))
        AND ${sqlCoursDe(sql`s.cours_id`)})`);
  return new Set(r.rows.map((l) => l.uid));
}

// ── Textes ─────────────────────────────────────────────────────────────────

const fmtJourSemaine = new Map<string, Intl.DateTimeFormat>();
/** « mercredi » dans le fuseau de la personne. */
export function jourDeLaSemaine(d: Date, fuseau: string | null): string {
  const cle = fuseau || "Africa/Abidjan";
  let f = fmtJourSemaine.get(cle);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: cle });
    } catch {
      f = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "Africa/Abidjan" });
    }
    fmtJourSemaine.set(cle, f);
  }
  return f.format(d);
}

/** Échéance dite simplement : « ce soir à 23h59 », « aujourd'hui à 14h00 », « demain à 08h00 », « jeudi à 23h59 ». */
export function quandEcheance(limite: Date, maintenant: number, fuseau: string | null): string {
  const heure = formaterDate(limite, { style: "heure", fuseau });
  const ecart = ecartJours(jourLocal(maintenant, fuseau), jourLocal(limite, fuseau));
  if (ecart <= 0) return minutesLocales(limite, fuseau) >= 18 * 60 ? `ce soir à ${heure}` : `aujourd'hui à ${heure}`;
  if (ecart === 1) return `demain à ${heure}`;
  return `${jourDeLaSemaine(limite, fuseau)} à ${heure}`;
}

/** « d'hier », « d'aujourd'hui », « de mardi ». */
export function quandCours(le: Date, maintenant: number, fuseau: string | null): string {
  const ecart = ecartJours(jourLocal(le, fuseau), jourLocal(maintenant, fuseau));
  if (ecart <= 0) return "d'aujourd'hui";
  if (ecart === 1) return "d'hier";
  return `de ${jourDeLaSemaine(le, fuseau)}`;
}

/** « 10 questions, environ 8 minutes ». */
export function detailQuiz(questions: number, minutes: number | null): string {
  const q = questions === 1 ? "1 question" : `${questions} questions`;
  const duree = minutes ?? Math.max(3, Math.round(questions * 0.8));
  return `${q}, environ ${duree} minute${duree > 1 ? "s" : ""}`;
}

/** Titre court d'un cours pour un rappel (« Marketing digital ») : pas de code, coupé proprement. */
export const coursCourt = (titre: string) => (titre.length > 42 ? `${titre.slice(0, 40).trimEnd()}…` : titre);

// ── Sujets du rappel ───────────────────────────────────────────────────────

/** Ce que le rappel propose : un texte (famille de variantes), ses variables et un lien. */
export type Proposition = {
  sujet: SujetRappel;
  famille: string;
  v: Record<string, string | number>;
  lien: string;
  type: NouvelleNotification["type"];
};

type EtudiantRappel = { id: number; fuseau: string | null; jour: Jour };

/** Liens déjà proposés au moins 2 fois en 7 jours, par étudiant (pour ne pas répéter le même cours complet). */
async function liensRepetes(uids: number[]): Promise<Map<number, Set<string>>> {
  const m = new Map<number, Set<string>>();
  if (!uids.length) return m;
  const r = await db.execute<{ uid: number; lien: string }>(sql`
    SELECT utilisateur_id AS uid, lien FROM campus.relances_engagement
    WHERE utilisateur_id = ANY(${entiers(uids)}) AND lien IS NOT NULL AND cree_le > now() - make_interval(days => ${REPETITIONS_LIEN.jours})
      AND statut IN ('envoye', 'simulation', 'pause_auto')
    GROUP BY 1, 2 HAVING count(*) >= ${REPETITIONS_LIEN.fois}`);
  for (const l of r.rows) m.set(l.uid, (m.get(l.uid) ?? new Set()).add(l.lien));
  return m;
}

/** Une requête de sujet facultative (table d'un autre chantier) : en cas d'écart de schéma, le sujet est retiré, le rappel reste. */
async function facultatif<T>(nom: string, f: () => Promise<T[]>): Promise<T[]> {
  try {
    return await f();
  } catch (e) {
    if (!sourcesSignalees.has(`sujet:${nom}`)) {
      sourcesSignalees.add(`sujet:${nom}`);
      console.warn(`[relances] sujet « ${nom} » ignoré :`, (e as Error).message);
    }
    return [];
  }
}

/** Un devoir annoncé ou rappelé par les rappels d'échéance (C3) depuis moins de 20 h n'est pas repris par le rappel du jour. */
const HEURES_SANS_REDIRE_DEVOIR = 20;

/**
 * Devoirs proposables, ouverts, dus dans les « heures » prochaines heures et pas encore faits, le
 * plus proche d'abord. « sansRappelRecent » (rappel du jour) écarte ceux que C3 vient d'annoncer
 * ou de rappeler (« Nouveau devoir », veille, jour J) : un même devoir n'est pas redit le même jour.
 */
export async function devoirsDus(uids: number[], heures: number, maintenant: number, { sansRappelRecent = false } = {}) {
  if (!uids.length) return new Map<number, { id: number; titre: string; type: string; limite: Date; dureeMinutes: number | null; cours: string; questions: number }>();
  const r = await db.execute<{ uid: number; id: number; titre: string; type: string; date_limite: string; duree_minutes: number | null; cours: string; questions: number }>(sql`
    SELECT DISTINCT ON (u.id) u.id AS uid, d.id, d.titre, d.type, d.date_limite, d.duree_minutes, c.titre AS cours,
      (SELECT count(*) FROM campus.questions_quiz q WHERE q.devoir_id = d.id)::int AS questions
    FROM campus.utilisateurs u
    JOIN campus.devoirs d ON d.publie AND d.date_limite > ${iso(maintenant)}::timestamptz
      AND d.date_limite <= ${iso(maintenant + heures * 3_600_000)}::timestamptz
      AND (d.ouverture_le IS NULL OR d.ouverture_le <= ${iso(maintenant)}::timestamptz)
    JOIN campus.cours c ON c.id = d.cours_id AND c.statut = 'publie'
    WHERE u.id = ANY(${entiers(uids)}) AND ${sqlCoursDe(sql`d.cours_id`)} AND ${sqlDevoirProposable("d")}
      AND NOT EXISTS (SELECT 1 FROM campus.rendus r WHERE r.devoir_id = d.id AND r.etudiant_id = u.id AND r.statut IN ('rendu', 'corrige'))
      AND NOT EXISTS (SELECT 1 FROM campus.tentatives_quiz tq WHERE tq.devoir_id = d.id AND tq.etudiant_id = u.id AND tq.fin_le IS NOT NULL)
      ${
        sansRappelRecent
          ? sql`AND NOT EXISTS (SELECT 1 FROM campus.rappels_devoirs rd WHERE rd.devoir_id = d.id
              AND rd.envoye_le > ${iso(maintenant - HEURES_SANS_REDIRE_DEVOIR * 3_600_000)}::timestamptz AND rd.envoye_le <= ${iso(maintenant)}::timestamptz)`
          : sql``
      }
    ORDER BY u.id, d.date_limite`);
  return new Map(
    r.rows.map((l) => [l.uid, { id: l.id, titre: l.titre, type: l.type, limite: new Date(l.date_limite), dureeMinutes: l.duree_minutes, cours: l.cours, questions: l.questions }]),
  );
}

/** Cours complets prêts de ses cours (séances tenues depuis « jours » jours), pas encore ouverts, le plus récent d'abord. */
export async function coursCompletsAOuvrir(uids: number[], jours: number, maintenant: number, limite = 1) {
  const m = new Map<number, { seanceId: number; titre: string; le: Date; cours: string }[]>();
  if (!uids.length) return m;
  const suivis = (await tableExiste("suivis_cours_complets"))
    ? sql`AND NOT EXISTS (SELECT 1 FROM campus.suivis_cours_complets sc WHERE sc.seance_id = s.id AND sc.utilisateur_id = u.id)`
    : sql``;
  const requete = (avecSuivis: boolean) =>
    db.execute<{ uid: number; seance_id: number; titre: string; le: string; cours: string; rang: number }>(sql`
      SELECT * FROM (
        SELECT u.id AS uid, s.id AS seance_id, s.titre, s.demarree_le AS le, c.titre AS cours,
          row_number() OVER (PARTITION BY u.id ORDER BY s.demarree_le DESC) AS rang
        FROM campus.utilisateurs u
        JOIN campus.seances s ON s.demarree_le IS NOT NULL AND s.demarree_le >= ${iso(maintenant - jours * JOUR_MS)}::timestamptz
        JOIN campus.cours c ON c.id = s.cours_id AND c.statut = 'publie'
        JOIN campus.etudes_seances es ON es.seance_id = s.id AND es.statut = 'prete'
        WHERE u.id = ANY(${entiers(uids)}) AND ${sqlCoursDe(sql`s.cours_id`)}
          AND NOT EXISTS (SELECT 1 FROM campus.vues_replay v WHERE v.seance_id = s.id AND v.utilisateur_id = u.id)
          ${avecSuivis ? suivis : sql``}
      ) x WHERE rang <= ${limite}`);
  let r;
  try {
    r = await requete(true);
  } catch (e) {
    console.warn("[relances] cours complets : suivis_cours_complets ignoré :", (e as Error).message);
    r = await requete(false);
  }
  for (const l of r.rows) m.set(l.uid, [...(m.get(l.uid) ?? []), { seanceId: l.seance_id, titre: l.titre, le: new Date(l.le), cours: l.cours }]);
  return m;
}

/** Cartes de révision dues aujourd'hui (C1), si ses tables existent. */
export async function cartesDues(etudiants: EtudiantRappel[]): Promise<Map<number, number>> {
  if (!etudiants.length || !(await tableExiste("revisions_etudiants")) || !(await tableExiste("cartes_revision"))) return new Map();
  const lignes = await facultatif("cartes", async () => {
    const r = await db.execute<{ uid: number; n: number }>(sql`
      SELECT re.utilisateur_id AS uid, count(*)::int AS n
      FROM campus.revisions_etudiants re
      JOIN campus.cartes_revision cr ON cr.id = re.carte_id AND cr.active
      JOIN unnest(${entiers(etudiants.map((e) => e.id))}, ${textesSimples(etudiants.map((e) => e.jour))}) AS x(uid, jour) ON x.uid = re.utilisateur_id
      WHERE re.prochaine_le::text <= x.jour
      GROUP BY 1`);
    return r.rows;
  });
  return new Map(lignes.map((l) => [l.uid, l.n]));
}

/** Sujet de chaque étudiant (le premier qui s'applique), en une requête par sujet pour tout le lot. */
async function propositions(etudiants: EtudiantRappel[], maintenant: number): Promise<Map<number, Proposition>> {
  const choix = new Map<number, Proposition>();
  const restants = () => etudiants.filter((e) => !choix.has(e.id));
  const fuseauDe = new Map(etudiants.map((e) => [e.id, e.fuseau]));
  const repetes = await liensRepetes(etudiants.map((e) => e.id));
  const dejaVu = (uid: number, lien: string) => repetes.get(uid)?.has(lien) ?? false;

  // 1. Devoir proposable dû dans les 30 h et pas fait (une échéance ne connaît pas la règle de répétition),
  //    sauf s'il vient d'être annoncé ou rappelé par C3 : on passe alors au sujet suivant.
  for (const [uid, d] of await devoirsDus(restants().map((e) => e.id), 30, maintenant, { sansRappelRecent: true })) {
    const quiz = d.type === "quiz";
    choix.set(uid, {
      sujet: "devoir",
      famille: quiz ? "rappel.devoir.quiz" : "rappel.devoir.depot",
      v: { cours: coursCourt(d.cours), devoir: d.titre, quand: quandEcheance(d.limite, maintenant, fuseauDe.get(uid) ?? null), detail: detailQuiz(d.questions, d.dureeMinutes) },
      lien: `/devoirs/${d.id}`,
      type: "devoir",
    });
  }

  // 2. Séance de ses cours tenue depuis 3 jours au plus, où il était ABSENT (jamais « inconnu »), cours complet prêt, pas rattrapée.
  const ids2 = restants().map((e) => e.id);
  if (ids2.length) {
    // « Rattrapée » = un vrai travail sur la séance (même règle que l'objectif du jour) : une simple ouverture ne suffit pas.
    const lignes = await facultatif("rattrapage", () => avecTraces(async (traces) => {
      const r = await db.execute<{ uid: number; seance_id: number; debut: string; cours: string }>(sql`
        SELECT DISTINCT ON (a.uid) a.uid, a.seance_id, COALESCE(s.demarree_le, a.debut) AS debut, c.titre AS cours
        FROM (${sqlAttendus({ depuis: new Date(maintenant - 4 * JOUR_MS), sites: null })}) a
        JOIN campus.seances s ON s.id = a.seance_id AND s.demarree_le >= ${iso(maintenant - 3 * JOUR_MS)}::timestamptz
        JOIN campus.cours c ON c.id = a.cours_id
        JOIN campus.etudes_seances es ON es.seance_id = a.seance_id AND es.statut = 'prete'
        WHERE a.uid = ANY(${entiers(ids2)})
          AND ${sqlEtatPresence(sql`a.seance_id`, sql`a.uid`)} = 'absent'
          AND NOT ${sqlSeanceRattrapee(sql`a.seance_id`, sql`a.uid`, traces)}
        ORDER BY a.uid, a.debut DESC`);
      return r.rows;
    }));
    for (const l of lignes) {
      const lien = `/mediatheque/cours/${l.seance_id}?depuis=rappel`;
      if (dejaVu(l.uid, lien)) continue;
      choix.set(l.uid, {
        sujet: "rattrapage",
        famille: "rappel.rattrapage",
        v: { cours: coursCourt(l.cours), jour: jourDeLaSemaine(new Date(l.debut), fuseauDe.get(l.uid) ?? null) },
        lien,
        type: "cours",
      });
    }
  }

  // 3. Cartes de révision dues (au moins 2 : une seule carte ne vaut pas un rappel).
  for (const [uid, n] of await cartesDues(restants())) {
    if (n < 2 || dejaVu(uid, "/reviser?depuis=rappel")) continue;
    choix.set(uid, { sujet: "cartes", famille: "rappel.cartes", v: { n, minutes: Math.max(1, Math.round(n * 0.6)) }, lien: "/reviser?depuis=rappel", type: "cours" });
  }

  // 4. Objectif du jour commencé et pas fini (C2) : seulement s'il l'a déjà ouvert aujourd'hui.
  const ids4 = restants();
  if (ids4.length && (await tableExiste("objectifs_jours"))) {
    const lignes = await facultatif("objectif_jour", async () => {
      const r = await db.execute<{ uid: number; total: number; faits: number }>(sql`
        SELECT o.utilisateur_id AS uid,
          CASE WHEN jsonb_typeof(o.elements) = 'array' THEN jsonb_array_length(o.elements) ELSE 0 END AS total,
          CASE WHEN jsonb_typeof(o.faits) = 'array' THEN jsonb_array_length(o.faits) ELSE 0 END AS faits
        FROM campus.objectifs_jours o
        JOIN unnest(${entiers(ids4.map((e) => e.id))}, ${textesSimples(ids4.map((e) => e.jour))}) AS x(uid, jour) ON x.uid = o.utilisateur_id AND o.jour::text = x.jour
        WHERE o.valide_le IS NULL`);
      return r.rows;
    });
    for (const l of lignes) {
      if (l.total <= 0 || l.faits >= l.total) continue;
      choix.set(l.uid, { sujet: "objectif_jour", famille: "rappel.objectif_jour", v: { reste: l.total - l.faits, total: l.total }, lien: "/accueil", type: "cours" });
    }
  }

  // 5. Objectif de la semaine à un jour près (C5).
  const ids5 = restants();
  if (ids5.length && (await tableExiste("objectifs_semaine")) && (await tableExiste("activites"))) {
    const lignes = await facultatif("objectif_semaine", async () => {
      const r = await db.execute<{ uid: number; objectif: number; faits: number }>(sql`
        SELECT x.uid, COALESCE(os.jours, 3)::int AS objectif,
          (SELECT count(DISTINCT a.jour) FROM campus.activites a WHERE a.utilisateur_id = x.uid AND a.semaine::text = x.semaine)::int AS faits
        FROM unnest(${entiers(ids5.map((e) => e.id))}, ${textesSimples(ids5.map((e) => semaineIso(e.jour)))}) AS x(uid, semaine)
        LEFT JOIN campus.objectifs_semaine os ON os.utilisateur_id = x.uid`);
      return r.rows;
    });
    for (const l of lignes) {
      if (l.faits < 1 || l.faits !== l.objectif - 1) continue;
      choix.set(l.uid, { sujet: "objectif_semaine", famille: "rappel.objectif_semaine", v: { faits: l.faits, objectif: l.objectif }, lien: "/progression", type: "cours" });
    }
  }

  // 6. Cours complet récent (7 jours) pas encore ouvert : la révision du lendemain, aussi les jours sans cours.
  for (const [uid, liste] of await coursCompletsAOuvrir(restants().map((e) => e.id), 7, maintenant, 3)) {
    const cc = liste.find((x) => !dejaVu(uid, `/mediatheque/cours/${x.seanceId}?depuis=rappel`));
    if (!cc) continue;
    choix.set(uid, {
      sujet: "cours_complet",
      famille: "rappel.cours_complet",
      v: { cours: coursCourt(cc.cours), quand: quandCours(cc.le, maintenant, fuseauDe.get(uid) ?? null) },
      lien: `/mediatheque/cours/${cc.seanceId}?depuis=rappel`,
      type: "cours",
    });
  }
  return choix;
}

/** Titre et corps d'une variante (« cartes.3 ») de la famille racine « rappel » ou « relance ». */
export function texteVariante(racine: "rappel" | "relance", variante: string, v: Record<string, string | number>) {
  const titre = t(`${racine}.${variante}.titre` as CleRelances, { registre: "tu", v });
  const corps = t(`${racine}.${variante}.corps` as CleRelances, { registre: "tu", v });
  return { titre, corps };
}

/** Dernières variantes employées par chaque étudiant pour un motif (la plus récente d'abord). */
export async function variantesRecentes(uids: number[], motifs: string[]): Promise<Map<number, string[]>> {
  const m = new Map<number, string[]>();
  if (!uids.length) return m;
  const r = await db.execute<{ uid: number; variante: string }>(sql`
    SELECT utilisateur_id AS uid, variante FROM campus.relances_engagement
    WHERE utilisateur_id = ANY(${entiers(uids)}) AND motif IN (${sql.join(motifs.map((x) => sql`${x}`), sql`, `)})
      AND variante IS NOT NULL AND cree_le > now() - interval '60 days'
    ORDER BY cree_le DESC`);
  for (const l of r.rows) m.set(l.uid, [...(m.get(l.uid) ?? []), l.variante]);
  return m;
}

// ── Lassitude ──────────────────────────────────────────────────────────────

/**
 * Pour chaque étudiant : rappels d'entraînement envoyés d'affilée sans être
 * ouverts ni suivis d'un acte le jour même, et pause automatique en cours
 * (dernier message honnête envoyé, pas de retour depuis, rappels pas réactivés).
 * Un rappel que le téléphone n'a jamais reçu (plafond, échec, appareil oublié,
 * plus d'abonnement : envois_push de C3) n'est pas compté comme ignoré.
 * Les actes sont lus en une fois pour tout le lot (pas de sous-requête par ligne).
 */
export async function lassitude(etudiants: (EtudiantRappel & { reglageMajLe: Date | null })[]) {
  const m = new Map<number, { ignores: number; enPause: boolean }>();
  if (!etudiants.length) return m;
  const ids = etudiants.map((e) => e.id);
  const envois = await tableExiste("envois_push");
  const r = await db.execute<{ id: number; uid: number; jour: string; statut: StatutRelance; cree_le: string; lu_le: string | null; non_recu: boolean }>(sql`
    SELECT r.id, r.utilisateur_id AS uid, r.jour::text AS jour, r.statut, r.cree_le, n.lu_le,
      ${
        envois
          ? sql`(r.notification_id IS NOT NULL AND EXISTS (SELECT 1 FROM campus.envois_push ep WHERE ep.notification_id = r.notification_id)
              AND NOT EXISTS (SELECT 1 FROM campus.envois_push ep WHERE ep.notification_id = r.notification_id AND ep.statut IN ('envoye', 'regroupe', 'differe')))`
          : sql`false`
      } AS non_recu
    FROM (
      SELECT x.*, row_number() OVER (PARTITION BY x.utilisateur_id ORDER BY x.cree_le DESC) AS rang
      FROM campus.relances_engagement x
      WHERE x.utilisateur_id = ANY(${entiers(ids)}) AND x.motif = 'rappel_du_jour' AND x.canal = 'push' AND x.statut IN ('envoye', 'pause_auto')
    ) r
    LEFT JOIN campus.notifications n ON n.id = r.notification_id
    WHERE r.rang <= 6
    ORDER BY r.utilisateur_id, r.cree_le DESC`);
  // Premier acte après chaque ligne, en une requête : les actes du lot depuis la plus ancienne ligne.
  const acteApres = new Map<number, string>();
  if (r.rows.length) {
    const depuis = r.rows.reduce((min, l) => (new Date(l.cree_le) < min ? new Date(l.cree_le) : min), new Date(r.rows[0].cree_le));
    const actes = await sqlActes({ depuis: sql`${iso(depuis.getTime() - 1000)}::timestamptz`, uids: [...new Set(r.rows.map((l) => l.uid))] });
    const a = await db.execute<{ id: number; t: string }>(sql`
      WITH actes AS MATERIALIZED (${actes})
      SELECT x.id, min(a.t) AS t
      FROM campus.relances_engagement x JOIN actes a ON a.uid = x.utilisateur_id AND a.t > x.cree_le
      WHERE x.id = ANY(${entiers(r.rows.map((l) => l.id))})
      GROUP BY x.id`);
    for (const l of a.rows) acteApres.set(l.id, l.t);
  }
  const parUid = new Map<number, typeof r.rows>();
  for (const l of r.rows) parUid.set(l.uid, [...(parUid.get(l.uid) ?? []), l]);
  for (const e of etudiants) {
    const lignes = parUid.get(e.id) ?? [];
    let ignores = 0;
    let enPause = false;
    for (const [i, l] of lignes.entries()) {
      const acte = acteApres.get(l.id) ?? null;
      if (l.statut === "pause_auto") {
        const repris = Boolean(acte) || Boolean(e.reglageMajLe && e.reglageMajLe > new Date(l.cree_le));
        enPause = i === 0 && !repris;
        break;
      }
      const ouvert = Boolean(l.lu_le);
      const actif = acte ? jourLocal(new Date(acte), e.fuseau) === l.jour : false;
      if (ouvert || actif) break;
      if (l.non_recu) continue;
      ignores++;
    }
    m.set(e.id, { ignores, enPause });
  }
  return m;
}

// ── Envoi ──────────────────────────────────────────────────────────────────

/**
 * Envoie un rappel (cloche + téléphone, priorité donnée à C3) et renvoie
 * l'identifiant de la notification créée, pour suivre son ouverture.
 */
export async function envoyerRappel(uid: number, n: { titre: string; corps: string; lien: string; type: NouvelleNotification["type"]; priorite: "engagement" | "action" }): Promise<number | null> {
  const avant = new Date(Date.now() - 1000).toISOString();
  await notifier([uid], { type: n.type, titre: n.titre, corps: n.corps, lien: n.lien, push: true, priorite: n.priorite });
  const r = await db.execute<{ id: number }>(
    sql`SELECT id FROM campus.notifications WHERE utilisateur_id = ${uid} AND titre = ${n.titre} AND cree_le >= ${avant}::timestamptz ORDER BY id DESC LIMIT 1`,
  );
  return r.rows[0]?.id ?? null;
}

// ── Passage du rappel d'entraînement ───────────────────────────────────────

export type BilanPassage = { examines: number; ecrits: Partial<Record<StatutRelance, number>>; attente: number };

/**
 * Un passage : décide et écrit les rappels d'entraînement dus à cet instant.
 * « maintenant » ne sert qu'aux essais (date simulée).
 */
export async function passerRappelsDuJour(maintenant = Date.now()): Promise<BilanPassage> {
  const bilan: BilanPassage = { examines: 0, ecrits: {}, attente: 0 };
  const reglage = await lireReglage();
  if (reglage.rappelsMode === "pause") return bilan;

  const r = await db.execute<{
    id: number;
    fuseau: string | null;
    site_id: number | null;
    classe_id: number | null;
    cree_le: string;
    heure_rappel: number | null;
    rappels_actifs: boolean | null;
    pause_jusqu_au: string | null;
    maj_le: string | null;
  }>(sql`
    SELECT u.id, u.fuseau, u.site_id, u.classe_id, u.cree_le, re.heure_rappel, re.rappels_actifs, re.pause_jusqu_au::text AS pause_jusqu_au, re.maj_le
    FROM campus.utilisateurs u
    LEFT JOIN campus.reglages_engagement re ON re.utilisateur_id = u.id
    WHERE u.role = 'etudiant' AND u.actif AND NOT u.doit_changer_mot_de_passe
      AND (u.classe_id IS NOT NULL OR EXISTS (SELECT 1 FROM campus.inscriptions i WHERE i.utilisateur_id = u.id))`);
  if (!r.rows.length) return bilan;

  // Lignes déjà écrites hier ou aujourd'hui (tous fuseaux) : rappel du jour et relances des décrocheurs.
  const ecrites = await db.execute<{ uid: number; jour: string; motif: string; statut: StatutRelance }>(sql`
    SELECT utilisateur_id AS uid, jour::text AS jour, motif, statut FROM campus.relances_engagement
    WHERE jour >= ${ajouterJours(jourAbidjan(new Date(maintenant)), -1)}::date
      AND motif IN ('rappel_du_jour', ${sql.join(MOTIFS_DECROCHEUR.map((m) => sql`${m}`), sql`, `)})`);
  const rappelFait = new Set(ecrites.rows.filter((l) => l.motif === "rappel_du_jour").map((l) => `${l.uid}|${l.jour}`));
  // Une relance seulement simulée (relances en essai) n'a rien envoyé : elle ne prend pas la place du vrai rappel du jour.
  const relanceFaite = new Set(ecrites.rows.filter((l) => l.motif !== "rappel_du_jour" && l.statut !== "simulation").map((l) => `${l.uid}|${l.jour}`));

  const etudiants = r.rows.map((l) => ({
    id: l.id,
    fuseau: l.fuseau,
    siteId: l.site_id,
    classeId: l.classe_id,
    creeLe: new Date(l.cree_le),
    jour: jourLocal(maintenant, l.fuseau),
    heureChoisie: l.heure_rappel,
    rappelsActifs: l.rappels_actifs ?? true,
    pauseJusquAu: l.pause_jusqu_au,
    reglageMajLe: versDate(l.maj_le),
  }));

  // Premier tri, sans requête : réglages, ligne déjà écrite, heure pas encore venue ou passée.
  const sansChoix = etudiants.filter((e) => e.heureChoisie === null);
  const habituelles = await heuresHabituelles(sansChoix, maintenant);
  const base = (e: (typeof etudiants)[number]) => ({
    maintenant,
    fuseau: e.fuseau,
    mode: reglage.rappelsMode,
    heureChoisie: e.heureChoisie,
    heureHabituelle: habituelles.get(e.id) ?? null,
    rappelsActifs: e.rappelsActifs,
    pauseJusquAu: e.pauseJusquAu,
    jour: e.jour,
    dejaDecide: rappelFait.has(`${e.id}|${e.jour}`),
    relanceAujourdhui: relanceFaite.has(`${e.id}|${e.jour}`),
    acteAujourdhui: false,
    enDecrochage: false,
    liveProche: false,
    enPauseAuto: false,
    sujet: "cours_complet" as SujetRappel,
    autoriseParTirage: true,
    ignoresDeSuite: 0,
    abonne: true,
    rappelsDuJour: 0,
  });
  const lot = etudiants.filter((e) => {
    const d = deciderRappel(base(e));
    if (d.action === "attendre") bilan.attente++;
    return d.action === "ecrire";
  });
  bilan.examines = etudiants.length;
  if (!lot.length) return bilan;
  const ids = lot.map((e) => e.id);

  // Les faits, en quelques requêtes pour tout le lot.
  const minuit = Math.min(...lot.map((e) => maintenant - minutesLocales(maintenant, e.fuseau) * MINUTE));
  const actesDuJour = await sqlActes({ depuis: sql`${iso(minuit - MINUTE)}::timestamptz`, uids: ids });
  const derniers = await db.execute<{ uid: number; t: string }>(sql`SELECT uid, max(t) AS t FROM (${actesDuJour}) a GROUP BY uid`);
  const dernierActe = new Map(derniers.rows.map((l) => [l.uid, new Date(l.t)]));
  const [lives, pauses, joignables, compteurs, sujets, recentes, anciens] = await Promise.all([
    livesProches(ids, maintenant),
    lassitude(lot),
    abonnes(ids),
    rappelsDuJour(lot, maintenant),
    propositions(lot, maintenant),
    variantesRecentes(ids, ["rappel_du_jour"]),
    // Relances actives : un décrocheur reçoit leurs messages, pas le rappel du jour.
    reglage.mode === "actif" ? derniersActes(ids, 60, maintenant) : Promise.resolve(null),
  ]);

  for (const e of lot) {
    const acte = dernierActe.get(e.id);
    const sujet = sujets.get(e.id) ?? null;
    const p = pauses.get(e.id) ?? { ignores: 0, enPause: false };
    const decision = deciderRappel({
      ...base(e),
      acteAujourdhui: Boolean(acte && jourLocal(acte, e.fuseau) === e.jour),
      enDecrochage: anciens ? joursOuvresSansActe(anciens.get(e.id), e.creeLe, maintenant, e.fuseau) >= DECROCHAGE.joursRappel : false,
      liveProche: lives.has(e.id),
      enPauseAuto: p.enPause,
      sujet: sujet?.sujet ?? null,
      autoriseParTirage: rappelEntrainementAutorise(e.id, e.jour),
      ignoresDeSuite: p.ignores,
      abonne: joignables.has(e.id),
      rappelsDuJour: compteurs.get(e.id) ?? 0,
    });
    if (decision.action !== "ecrire" || !sujet) continue;

    const famille = decision.lassitude ? "rappel.lassitude" : sujet.famille;
    const variante = choisirVariante(variantesDe(famille), recentes.get(e.id) ?? []);
    const lien = decision.lassitude ? "/mes-rappels" : sujet.lien;
    const [ligne] = await db
      .insert(relancesEngagement)
      .values({ utilisateurId: e.id, jour: e.jour, motif: "rappel_du_jour", canal: "push", palier: 1, variante, statut: decision.statut, lien, siteId: e.siteId, classeId: e.classeId, creeLe: new Date(maintenant) })
      .onConflictDoNothing()
      .returning({ id: relancesEngagement.id });
    if (!ligne) continue; // un autre passage l'a déjà écrite
    bilan.ecrits[decision.statut] = (bilan.ecrits[decision.statut] ?? 0) + 1;
    if (!decision.envoyer) continue;
    try {
      const { titre, corps } = texteVariante("rappel", variante, sujet.v);
      const notificationId = await envoyerRappel(e.id, { titre, corps, lien, type: decision.lassitude ? "systeme" : sujet.type, priorite: "engagement" });
      await db.execute(sql`UPDATE campus.relances_engagement SET notification_id = ${notificationId} WHERE id = ${ligne.id}`);
    } catch (err) {
      await db.execute(sql`UPDATE campus.relances_engagement SET statut = 'echec' WHERE id = ${ligne.id}`);
      console.error("[relances] rappel du jour :", (err as Error).message);
    }
  }
  return bilan;
}

// ── Retours sous 48 h et purge ─────────────────────────────────────────────

/**
 * Remplit revenu_le : premier acte d'apprentissage dans les 48 h qui suivent chaque ligne (rappel,
 * relance, e-mail, témoin ; pas les reports « quota », réécrits chaque jour). Les actes du lot sont
 * lus en une seule fois puis joints aux lignes : aucune sous-requête par ligne, le coût suit le
 * nombre d'actes récents et non le produit lignes × historique des présences.
 */
export async function noterRetours(maintenant = Date.now()): Promise<number> {
  const enAttente = await db.execute<{ id: number; uid: number; cree_le: string }>(sql`
    SELECT id, utilisateur_id AS uid, cree_le FROM campus.relances_engagement
    WHERE revenu_le IS NULL AND statut <> 'quota' AND cree_le > ${iso(maintenant - 50 * 3_600_000)}::timestamptz AND cree_le <= ${iso(maintenant)}::timestamptz`);
  if (!enAttente.rows.length) return 0;
  const depuis = enAttente.rows.reduce((min, l) => Math.min(min, new Date(l.cree_le).getTime()), maintenant);
  const actes = await sqlActes({ depuis: sql`${iso(depuis - 1000)}::timestamptz`, uids: [...new Set(enAttente.rows.map((l) => l.uid))] });
  const r = await db.execute(sql`
    WITH actes AS MATERIALIZED (${actes}),
    premiers AS (
      SELECT x.id, min(a.t) AS t
      FROM campus.relances_engagement x
      JOIN actes a ON a.uid = x.utilisateur_id AND a.t > x.cree_le AND a.t <= x.cree_le + interval '48 hours'
      WHERE x.id = ANY(${entiers(enAttente.rows.map((l) => l.id))})
      GROUP BY x.id
    )
    UPDATE campus.relances_engagement x SET revenu_le = p.t
    FROM premiers p
    WHERE x.id = p.id AND x.revenu_le IS NULL`);
  return r.rowCount ?? 0;
}

planifier("relances-rappel-du-jour", 5 * MINUTE, async () => {
  await passerRappelsDuJour();
});

planifier("relances-retours", 30 * MINUTE, async () => {
  await noterRetours();
});

// Conservation : 180 jours (ENGAGEMENT.md § 4).
planifier("relances-purge", 24 * 60 * MINUTE, async () => {
  await db.execute(sql`DELETE FROM campus.relances_engagement WHERE cree_le < now() - make_interval(days => ${CONSERVATION_RELANCES_JOURS})`);
});
