// Indicateurs du tableau « Engagement et participation » (chantier C8) :
// GET /api/pilotage/engagement (server/routes/pilotage-engagement.ts) et les
// chiffres corrigés du tableau de pilotage (/api/pilotage/tableau, admin.ts).
//
// Principes (campus/ENGAGEMENT.md, amendement de José du 8 octobre 2026) :
// - une requête agrégée par bloc, toujours limitée au périmètre de la personne
//   (perimetreSites) et au filtre demandé (campus, classe) ;
// - aucune donnée nominative d'étudiant, aucun taux sous EFFECTIF_MINIMUM ;
// - présence aux directs en TROIS états (presence.ts) : « inconnu » (salle non
//   émargée) n'est jamais une absence ;
// - les séances se rangent à leur date RÉELLE (sqlAttendus, admin.ts) : la
//   séance #26, datée du 14 octobre et tenue le 7, ne fausse plus rien ;
// - un « jour d'apprentissage » demande une action d'apprentissage (sqlActes) ;
//   ouvrir le campus (activite_jours) se compte à part, jamais à sa place ;
// - les tables des autres chantiers (C1 révision, C2 objectif, C3 envois,
//   C4 relances, C5 progression) se lisent en SQL brut après lisible() : absentes,
//   leur bloc vaut null (« pas encore mesuré »), jamais 0 % ni erreur 500 ;
// - le résultat est gardé 10 minutes en mémoire.
import { AsyncLocalStorage } from "node:async_hooks";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { sqlAttendus, sqlDevoirsAttendus, SQL_DUREE_REFERENCE, SQL_INCIDENT_SALLE } from "../routes/admin";
import { sqlEtatPresence, sqlSalleEmargee, type EtatPresence } from "./presence";
import { tableExiste } from "./tables";
import { DEBUT_EXPERIENCE, rappelEntrainementAutorise } from "./tirage";
import { corrigerQuestion } from "../evaluations-outils";
import { ajouterJours, ecartJours, jourLocal, lundiDe, semaineIso, type Jour } from "@shared/engagement/calendrier";
import {
  EFFECTIF_MINIMUM,
  SEMAINES_COHORTES,
  SEMAINES_HISTORIQUE,
  SUIVI_MINUTES,
  SUIVI_PART,
  type Actifs,
  type BlocDirects,
  type BlocRappels,
  type BlocRegularite,
  type BlocTravail,
  type CleTravail,
  type CohorteRetour,
  type CopiesFormateur,
  type EmargementCampus,
  type EngagementPilotage,
  type JourActivite,
  type LigneEntonnoir,
  type LigneEnvois,
  type LigneTravail,
  type Part,
  type QuestionRatee,
  type RepartitionPlateformes,
  type SeanceEntonnoir,
  type SeanceMalDatee,
  type SemaineApprentissage,
  type TroisEtats,
} from "@shared/engagement/indicateurs";
import type { QuestionQuiz } from "@shared/schema";

export type Perimetre = number[] | null;
export type FiltreEngagement = { jours: number; siteId: number | null; classeId: number | null };

const JOUR_MS = 86_400_000;
/** Tableau d'entiers PostgreSQL passé en un seul paramètre (« = ANY(…) »). */
const entiers = (ids: number[]) => sql`${`{${ids.map((i) => Math.trunc(i)).join(",")}}`}::int[]`;
const iso = (d: Date | string) => new Date(d).toISOString();
const jourSql = (j: Jour) => sql`${j}::date`;

// ── Lectures sans compilation JIT ──────────────────────────────────────────

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const lecteur = new AsyncLocalStorage<Transaction>();
/** La connexion des lectures en cours : la transaction de sansJit, sinon le pool. */
const ex = () => lecteur.getStore() ?? db;

/**
 * Les requêtes agrégées du tableau (sous-requêtes corrélées sur des CTE)
 * trompent l'estimation de PostgreSQL, qui passerait près d'une seconde à les
 * compiler (JIT) pour quelques millisecondes d'exécution. Elles passent donc
 * dans une transaction en lecture seule, JIT coupé, sur une seule connexion.
 */
async function sansJit<T>(f: () => Promise<T>): Promise<T> {
  if (lecteur.getStore()) return f();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    await tx.execute(sql`SET LOCAL jit = off`);
    return lecteur.run(tx, f);
  });
}

// ── Briques de calcul ──────────────────────────────────────────────────────

/** Une part « n sur sur », masquée sous l'effectif minimum (seul l'effectif reste). */
export function part(n: number, sur: number): Part {
  if (sur < EFFECTIF_MINIMUM) return { n: null, sur, taux: null };
  return { n, sur, taux: Math.round((n / sur) * 100) };
}

export function troisEtats(presents: number, absents: number, inconnus: number): TroisEtats {
  const total = presents + absents + inconnus;
  const connus = presents + absents;
  return {
    presents,
    absents,
    inconnus,
    total,
    tauxConnu: connus >= EFFECTIF_MINIMUM ? Math.round((presents / connus) * 100) : null,
    partInconnue: total >= EFFECTIF_MINIMUM ? Math.round((inconnus / total) * 100) : null,
  };
}

/**
 * « A suivi » le direct en ligne : au moins 30 minutes, ou la moitié de la durée
 * de référence si la séance est plus courte (alias « s » = campus.seances).
 */
const sqlMinutesSuivi = () =>
  sql`LEAST(${SUIVI_MINUTES}, GREATEST(1, ceil((${SQL_DUREE_REFERENCE})::float8 * ${SUIVI_PART}::float8)))::int`;

// ── Lecture prudente des tables des autres chantiers ───────────────────────

const DUREE_COLONNES_MS = 10 * 60_000;
const colonnesConnues = new Map<string, { colonnes: Map<string, string>; le: number }>();

/** Colonnes (nom → type) d'une table du schéma campus, gardées 10 minutes comme tableExiste. */
async function colonnesDe(table: string): Promise<Map<string, string>> {
  const connu = colonnesConnues.get(table);
  if (connu && Date.now() - connu.le < DUREE_COLONNES_MS) return connu.colonnes;
  const r = await db.execute<{ nom: string; type: string }>(sql`
    SELECT column_name AS nom, data_type AS type FROM information_schema.columns
    WHERE table_schema = 'campus' AND table_name = ${table}`);
  const colonnes = new Map(r.rows.map((l) => [l.nom, l.type]));
  colonnesConnues.set(table, { colonnes, le: Date.now() });
  return colonnes;
}

/**
 * La table d'un autre chantier existe-t-elle avec ces colonnes ? Absente ou
 * différente du plan : le bloc qui la lit est masqué au lieu de planter.
 */
export async function lisible(table: string, colonnes: string[]): Promise<boolean> {
  if (!(await tableExiste(table))) return false;
  const c = await colonnesDe(table);
  return colonnes.every((x) => c.has(x));
}

/** Exécute une lecture facultative : une erreur SQL (table d'un chantier qui a changé) donne null, signalé dans les journaux. */
async function facultatif<T>(nom: string, f: () => Promise<T>): Promise<T | null> {
  try {
    // Dans une transaction, un point de sauvegarde : l'erreur n'interrompt pas les lectures suivantes.
    const courante = lecteur.getStore();
    return courante ? await courante.transaction((sp) => lecteur.run(sp, f)) : await f();
  } catch (e) {
    console.error(`[engagement] bloc « ${nom} » non mesuré :`, (e as Error).message);
    return null;
  }
}

// ── Population, actions d'apprentissage, jours de cours ────────────────────

/**
 * Étudiants actifs du périmètre et du filtre, avec leur fuseau (Abidjan par
 * défaut ; un fuseau mal saisi retombe sur Abidjan, comme calendrier.ts).
 * Corps du CTE « pop » : uid, site_id, classe_id, cree_le, derniere_connexion,
 * fz, inscrit_le (jour local de création du compte).
 */
export function sqlPopulation(sites: Perimetre, siteId: number | null = null, classeId: number | null = null): SQL {
  const conds: SQL[] = [sql`u.role = 'etudiant'`, sql`u.actif`];
  if (sites) conds.push(sql`u.site_id = ANY(${entiers(sites)})`);
  if (siteId) conds.push(sql`u.site_id = ${siteId}`);
  if (classeId) conds.push(sql`u.classe_id = ${classeId}`);
  return sql`
    SELECT u.id AS uid, u.site_id, u.classe_id, u.cree_le, u.derniere_connexion, z.fz,
      (u.cree_le AT TIME ZONE z.fz)::date AS inscrit_le
    FROM campus.utilisateurs u
    CROSS JOIN LATERAL (
      SELECT CASE WHEN u.fuseau IS NULL THEN 'Africa/Abidjan'
        ELSE COALESCE((SELECT tz.name FROM pg_timezone_names tz WHERE tz.name = u.fuseau), 'Africa/Abidjan') END AS fz
    ) z
    WHERE ${sql.join(conds, sql` AND `)}`;
}

/** Tables facultatives lisibles pour les actions d'apprentissage (C1, C2). */
type Facultatives = { revision: boolean; reviseHorodate: boolean; coursComplets: boolean; objectifs: boolean };

async function facultatives(): Promise<Facultatives> {
  const [revision, reviseHorodate, coursComplets, objectifs] = await Promise.all([
    lisible("reponses_revision", ["utilisateur_id", "jour"]),
    lisible("reponses_revision", ["utilisateur_id", "repondu_le"]),
    lisible("suivis_cours_complets", ["utilisateur_id", "ouvert_le", "revu_le"]),
    lisible("objectifs_jours", ["utilisateur_id", "jour", "valide_le"]),
  ]);
  return { revision, reviseHorodate, coursComplets, objectifs };
}

/**
 * Actions d'apprentissage des étudiants du CTE « pop » depuis « depuis » :
 * (uid, t, jour, type), t étant l'instant (null quand seul le jour est connu)
 * et jour le jour local de l'étudiant. Ce qui compte, et rien d'autre :
 *   presence       émargé ou pointé présent en salle, ou suivi en ligne au moins
 *                  30 minutes (ou la moitié d'une séance plus courte) ;
 *   copie          copie rendue par l'étudiant (pas une copie papier déposée
 *                  par la vie scolaire) ;
 *   interrogation  tentative terminée, ou commencée avec au moins une réponse ;
 *   lecon          leçon terminée ;
 *   replay         replay d'une séance ouvert ;
 *   participation  question, vote, réponse à un sondage, message ou main levée
 *                  pendant un direct ;
 *   revision, cours_complet, objectif : quand les tables de C1 et C2 existent.
 * Ouvrir le campus, lire une annonce, écrire un message privé ou parler à
 * l'assistant ne sont pas des actions d'apprentissage.
 */
async function sqlActes(depuis: Date): Promise<SQL> {
  const d = sql`${iso(depuis)}::timestamptz`;
  const f = await facultatives();
  const horodate = (source: SQL, t: SQL, type: string, where: SQL) =>
    sql`SELECT p.uid, ${t} AS t, (${t} AT TIME ZONE p.fz)::date AS jour, ${type}::text AS type FROM ${source} WHERE ${t} >= ${d} AND ${where}`;
  const branches: SQL[] = [
    horodate(
      sql`campus.presences pr JOIN pop p ON p.uid = pr.utilisateur_id JOIN campus.seances s ON s.id = pr.seance_id`,
      sql`s.demarree_le`,
      "presence",
      sql`NULLIF(pr.justification, '') IS NULL AND (pr.mode = 'salle' OR pr.minutes >= ${sqlMinutesSuivi()})`,
    ),
    horodate(
      sql`campus.rendus r JOIN pop p ON p.uid = r.etudiant_id`,
      sql`r.rendu_le`,
      "copie",
      sql`r.statut IN ('rendu', 'corrige') AND r.depose_par_id IS NULL`,
    ),
    horodate(
      sql`campus.tentatives_quiz tq JOIN pop p ON p.uid = tq.etudiant_id`,
      sql`COALESCE(tq.fin_le, tq.debut_le)`,
      "interrogation",
      sql`(tq.fin_le IS NOT NULL OR tq.reponses <> '{}'::jsonb)`,
    ),
    horodate(sql`campus.progressions pg JOIN pop p ON p.uid = pg.utilisateur_id`, sql`pg.terminee_le`, "lecon", sql`true`),
    horodate(
      sql`campus.vues_replay vr CROSS JOIN LATERAL (VALUES (vr.premiere_vue), (vr.derniere_vue)) AS vv(t) JOIN pop p ON p.uid = vr.utilisateur_id`,
      sql`vv.t`,
      "replay",
      sql`true`,
    ),
    horodate(sql`campus.questions_live ql JOIN pop p ON p.uid = ql.auteur_id`, sql`ql.cree_le`, "participation", sql`true`),
    horodate(
      sql`campus.votes_questions vq JOIN campus.questions_live qv ON qv.id = vq.question_id JOIN pop p ON p.uid = vq.utilisateur_id`,
      sql`qv.cree_le`,
      "participation",
      sql`true`,
    ),
    horodate(
      sql`campus.reponses_sondages rs JOIN campus.sondages so ON so.id = rs.sondage_id JOIN pop p ON p.uid = rs.utilisateur_id`,
      sql`so.ouvert_le`,
      "participation",
      sql`true`,
    ),
    horodate(sql`campus.messages_live ml JOIN pop p ON p.uid = ml.auteur_id`, sql`ml.cree_le`, "participation", sql`true`),
    horodate(sql`campus.mains_levees mn JOIN pop p ON p.uid = mn.utilisateur_id`, sql`mn.levee_le`, "participation", sql`NOT mn.pour_salle`),
  ];
  if (f.revision) {
    // C1 : le jour retenu par la révision elle-même (hors ligne, il peut précéder la réception).
    branches.push(sql`
      SELECT p.uid, ${f.reviseHorodate ? sql`rr.repondu_le` : sql`NULL::timestamptz`} AS t, (rr.jour)::date AS jour, 'revision'::text AS type
      FROM campus.reponses_revision rr JOIN pop p ON p.uid = rr.utilisateur_id
      WHERE (rr.jour)::date >= (${d} AT TIME ZONE p.fz)::date`);
  }
  if (f.coursComplets) {
    branches.push(
      horodate(
        sql`campus.suivis_cours_complets sc CROSS JOIN LATERAL (VALUES (sc.ouvert_le), (sc.revu_le)) AS sv(t) JOIN pop p ON p.uid = sc.utilisateur_id`,
        sql`sv.t`,
        "cours_complet",
        sql`sv.t IS NOT NULL`,
      ),
    );
  }
  if (f.objectifs) {
    branches.push(sql`
      SELECT p.uid, oj.valide_le AS t, (oj.jour)::date AS jour, 'objectif'::text AS type
      FROM campus.objectifs_jours oj JOIN pop p ON p.uid = oj.utilisateur_id
      WHERE oj.valide_le IS NOT NULL AND oj.valide_le >= ${d}`);
  }
  return sql.join(branches, sql` UNION ALL `);
}

/** Jours de cours : (uid, jour) où au moins une séance de ses cours a été tenue (date réelle, séances en cours comprises). */
function sqlJoursCours(depuis: Date, sites: Perimetre): SQL {
  return sql`SELECT DISTINCT a.uid, (a.debut AT TIME ZONE p.fz)::date AS jour
    FROM (${sqlAttendus({ depuis, sites, inclureEnCours: true })}) a JOIN pop p ON p.uid = a.uid`;
}

/** Premier jour enregistré dans activite_jours (début de la mesure jour par jour), tous campus confondus. */
async function mesureDepuis(): Promise<Jour | null> {
  const r = await ex().execute<{ jour: string | null }>(sql`SELECT min(jour)::text AS jour FROM campus.activite_jours`);
  return r.rows[0]?.jour ?? null;
}

// ── 1. Téléphone et régularité ─────────────────────────────────────────────

type BrutRegularite = {
  actifs: { a: number; aa: number; s: number; sa: number; m: number; ma: number };
  courbe: { jour: string; ouverts: number; ac: number; asc: number; attendus: number; inscrits: number }[] | null;
  semaines: { lundi: string; inscrits: number; mediane: number | null; moyenne: number | null; au1: number; au3: number }[] | null;
  cohortes: { lundi: string; inscrits: number; venus: number; e1: number; r1: number; e7: number; r7: number; premier_min: string | null }[] | null;
  plateformes: Record<string, number> | null;
  revenus: number;
  effectif: number;
};

async function blocRegularite(f: FiltreEngagement, sites: Perimetre, aujourdhui: Jour, debut: Jour, mesure: Jour | null): Promise<BlocRegularite> {
  const lundiCourant = lundiDe(aujourdhui);
  const lundi0 = ajouterJours(lundiCourant, -7 * SEMAINES_HISTORIQUE);
  const lundiCohortes = ajouterJours(lundiCourant, -7 * (SEMAINES_COHORTES - 1));
  const debutActes = [debut, ajouterJours(aujourdhui, -29), lundi0, lundiCohortes].sort()[0];
  const depuis = new Date(`${debutActes}T00:00:00Z`);
  // Jours vus « depuis toujours » pour « revenus » : 400 jours (la conservation de l'activité).
  const depuisToujours = new Date(Date.now() - 400 * JOUR_MS);
  const auj = jourSql(aujourdhui);
  const r = await ex().execute<{ brut: BrutRegularite }>(sql`
    WITH pop AS MATERIALIZED (${sqlPopulation(sites, f.siteId, f.classeId)}),
    actes_tout AS MATERIALIZED (${await sqlActes(depuisToujours)}),
    appr AS MATERIALIZED (SELECT DISTINCT uid, jour FROM actes_tout WHERE jour >= ${jourSql(debutActes)}),
    ouv AS MATERIALIZED (
      SELECT a.utilisateur_id AS uid, a.jour, a.plateforme FROM campus.activite_jours a JOIN pop p ON p.uid = a.utilisateur_id
      WHERE a.jour >= ${jourSql(debutActes)}),
    vus AS MATERIALIZED (
      SELECT uid, jour FROM appr
      UNION SELECT uid, jour FROM ouv
      UNION SELECT p.uid, (p.derniere_connexion AT TIME ZONE p.fz)::date FROM pop p WHERE p.derniere_connexion IS NOT NULL),
    cj AS MATERIALIZED (${sqlJoursCours(depuis, sites)}),
    jours AS (SELECT generate_series(${jourSql(debut)}, ${auj}, interval '1 day')::date AS jour),
    semaines AS (SELECT generate_series(${jourSql(lundi0)}, ${jourSql(lundiCourant)}, interval '7 days')::date AS lundi),
    pe AS (
      SELECT s.lundi, p.uid, (SELECT count(*) FROM appr x WHERE x.uid = p.uid AND x.jour >= s.lundi AND x.jour < s.lundi + 7)::int AS jours
      FROM semaines s JOIN pop p ON p.inscrit_le < s.lundi),
    coh AS (
      SELECT p.uid, date_trunc('week', p.inscrit_le)::date AS lundi,
        (SELECT min(v.jour) FROM vus v WHERE v.uid = p.uid AND v.jour >= p.inscrit_le) AS premier
      FROM pop p WHERE p.inscrit_le >= ${jourSql(lundiCohortes)})
    SELECT json_build_object(
      'effectif', (SELECT count(*) FROM pop),
      'actifs', json_build_object(
        'a', (SELECT count(DISTINCT uid) FROM vus WHERE jour = ${auj}),
        'aa', (SELECT count(DISTINCT uid) FROM appr WHERE jour = ${auj}),
        's', (SELECT count(DISTINCT uid) FROM vus WHERE jour > ${auj} - 7 AND jour <= ${auj}),
        'sa', (SELECT count(DISTINCT uid) FROM appr WHERE jour > ${auj} - 7 AND jour <= ${auj}),
        'm', (SELECT count(DISTINCT uid) FROM vus WHERE jour > ${auj} - 30 AND jour <= ${auj}),
        'ma', (SELECT count(DISTINCT uid) FROM appr WHERE jour > ${auj} - 30 AND jour <= ${auj})),
      'courbe', (SELECT json_agg(json_build_object(
          'jour', j.jour::text,
          'ouverts', (SELECT count(*) FROM (SELECT uid FROM ouv o WHERE o.jour = j.jour UNION SELECT uid FROM appr x WHERE x.jour = j.jour) z),
          'ac', (SELECT count(*) FROM appr x WHERE x.jour = j.jour AND EXISTS (SELECT 1 FROM cj WHERE cj.uid = x.uid AND cj.jour = j.jour)),
          'asc', (SELECT count(*) FROM appr x WHERE x.jour = j.jour AND NOT EXISTS (SELECT 1 FROM cj WHERE cj.uid = x.uid AND cj.jour = j.jour)),
          'attendus', (SELECT count(*) FROM cj WHERE cj.jour = j.jour),
          'inscrits', (SELECT count(*) FROM pop p WHERE p.inscrit_le <= j.jour)
        ) ORDER BY j.jour) FROM jours j),
      'semaines', (SELECT json_agg(w ORDER BY w.lundi) FROM (
          SELECT lundi::text AS lundi, count(*)::int AS inscrits,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY jours) AS mediane, avg(jours)::float8 AS moyenne,
            count(*) FILTER (WHERE jours >= 1)::int AS au1, count(*) FILTER (WHERE jours >= 3)::int AS au3
          FROM pe GROUP BY lundi) w),
      'cohortes', (SELECT json_agg(c ORDER BY c.lundi) FROM (
          SELECT lundi::text AS lundi, count(*)::int AS inscrits, count(premier)::int AS venus,
            count(*) FILTER (WHERE premier + 1 < ${auj})::int AS e1,
            count(*) FILTER (WHERE premier + 1 < ${auj} AND EXISTS (SELECT 1 FROM vus v WHERE v.uid = coh.uid AND v.jour = coh.premier + 1))::int AS r1,
            count(*) FILTER (WHERE premier + 13 < ${auj})::int AS e7,
            count(*) FILTER (WHERE premier + 13 < ${auj} AND EXISTS (
              SELECT 1 FROM vus v WHERE v.uid = coh.uid AND v.jour BETWEEN coh.premier + 7 AND coh.premier + 13))::int AS r7,
            min(premier)::text AS premier_min
          FROM coh GROUP BY lundi) c),
      'plateformes', (SELECT json_object_agg(cle, n) FROM (
          SELECT COALESCE(plateforme, 'inconnue') AS cle, count(*)::int AS n FROM ouv WHERE jour >= ${jourSql(debut)} GROUP BY 1) pf),
      'revenus', (SELECT count(*) FROM (
          SELECT t.uid FROM (SELECT uid, jour FROM actes_tout
            UNION SELECT a.utilisateur_id, a.jour FROM campus.activite_jours a JOIN pop p ON p.uid = a.utilisateur_id
            UNION SELECT p.uid, (p.derniere_connexion AT TIME ZONE p.fz)::date FROM pop p WHERE p.derniere_connexion IS NOT NULL) t
          GROUP BY t.uid HAVING count(*) >= 2) rv)
    ) AS brut`);
  const b = r.rows[0].brut;
  const n = b.effectif;
  const actifs = (o: number, a: number): Actifs => ({ ouverture: o, apprentissage: a });
  const courbe: JourActivite[] = (b.courbe ?? []).map((l) => ({
    jour: l.jour,
    ouverts: mesure && l.jour >= mesure ? l.ouverts : null,
    apprenantsCours: l.ac,
    apprenantsSansCours: l.asc,
    attendusCours: l.attendus,
    inscrits: l.inscrits,
  }));
  // Jours complets seulement (aujourd'hui n'est pas fini) : part des jours-étudiants avec une action.
  const complets = courbe.filter((l) => l.jour < aujourdhui);
  const somme = (g: (l: JourActivite) => number) => complets.reduce((s, l) => s + g(l), 0);
  const parLundi = new Map((b.semaines ?? []).map((s) => [s.lundi, s]));
  const semaines: SemaineApprentissage[] = [];
  for (let lundi = lundi0; lundi <= lundiCourant; lundi = ajouterJours(lundi, 7)) {
    const s = parLundi.get(lundi);
    const inscrits = s?.inscrits ?? 0;
    const assez = inscrits >= EFFECTIF_MINIMUM;
    semaines.push({
      semaine: semaineIso(lundi),
      lundi,
      enCours: lundi === lundiCourant,
      inscrits,
      mediane: assez && s?.mediane !== null && s?.mediane !== undefined ? Math.round(s.mediane * 10) / 10 : null,
      moyenne: assez && s?.moyenne !== null && s?.moyenne !== undefined ? Math.round(s.moyenne * 10) / 10 : null,
      auMoins1: part(s?.au1 ?? 0, inscrits),
      auMoins3: part(s?.au3 ?? 0, inscrits),
    });
  }
  // Les semaines d'avant les premières inscriptions ne disent rien : elles ne sont pas montrées.
  const premiere = semaines.findIndex((s) => s.inscrits > 0);
  if (premiere > 0) semaines.splice(0, Math.min(premiere, semaines.length - 1));
  const cohortes: CohorteRetour[] = (b.cohortes ?? []).map((c) => ({
    semaine: semaineIso(c.lundi),
    lundi: c.lundi,
    inscrits: c.inscrits,
    venus: c.venus,
    j1: part(c.r1, c.e1),
    j7: part(c.r7, c.e7),
    partielle: !mesure || (c.premier_min !== null && c.premier_min < mesure),
  }));
  const pf = b.plateformes ?? {};
  const plateformes: RepartitionPlateformes = {
    android_app: pf.android_app ?? 0,
    installee: pf.installee ?? 0,
    mobile: pf.mobile ?? 0,
    ordinateur: pf.ordinateur ?? 0,
    inconnue: pf.inconnue ?? 0,
    total: Object.values(pf).reduce((s, x) => s + x, 0),
  };
  return {
    aujourdhui: actifs(b.actifs.a, b.actifs.aa),
    j7: actifs(b.actifs.s, b.actifs.sa),
    j30: actifs(b.actifs.m, b.actifs.ma),
    courbe,
    joursSansCours: part(
      somme((l) => l.apprenantsSansCours),
      somme((l) => Math.max(0, l.inscrits - l.attendusCours)),
    ),
    joursCours: part(
      somme((l) => l.apprenantsCours),
      somme((l) => l.attendusCours),
    ),
    semaines,
    cohortes,
    plateformes,
    revenus: part(b.revenus, n),
  };
}

// ── 2. Directs : entonnoir, trois états, salles émargées ───────────────────

type LigneDirect = {
  seance_id: number;
  site_id: number | null;
  classe_id: number | null;
  uid: number;
  statut: string;
  etat: EtatPresence | null;
  en_salle: boolean;
  en_ligne: boolean;
  a_suivi: boolean;
  au_seuil: boolean;
  participe: boolean;
  salle_emargee: boolean;
  incident: boolean;
  replay_vu: boolean;
};

/**
 * Une ligne par (séance tenue et finie, étudiant attendu) du périmètre, avec
 * son état de présence en trois états et l'entonnoir. Classe : celle de
 * l'étudiant au moment de la séance (sqlAttendus).
 */
async function lignesDirects(depuis: Date, sites: Perimetre, classeId: number | null): Promise<LigneDirect[]> {
  const r = await ex().execute<LigneDirect>(sql`
    SELECT a.seance_id, a.site_id, a.classe_id, a.uid, a.statut,
      ${sqlEtatPresence(sql`a.seance_id`, sql`a.uid`)} AS etat,
      COALESCE(pr.mode = 'salle' AND NULLIF(pr.justification, '') IS NULL, false) AS en_salle,
      COALESCE(pr.mode <> 'salle' AND pr.minutes > 0 AND NULLIF(pr.justification, '') IS NULL, false) AS en_ligne,
      COALESCE(NULLIF(pr.justification, '') IS NULL AND (pr.mode = 'salle' OR pr.minutes >= ${sqlMinutesSuivi()}), false) AS a_suivi,
      a.statut = 'en_ligne' AS au_seuil,
      (EXISTS (SELECT 1 FROM campus.questions_live q WHERE q.seance_id = a.seance_id AND q.auteur_id = a.uid)
        OR EXISTS (SELECT 1 FROM campus.votes_questions vq JOIN campus.questions_live q ON q.id = vq.question_id
          WHERE q.seance_id = a.seance_id AND vq.utilisateur_id = a.uid)
        OR EXISTS (SELECT 1 FROM campus.reponses_sondages rs JOIN campus.sondages so ON so.id = rs.sondage_id
          WHERE so.seance_id = a.seance_id AND rs.utilisateur_id = a.uid)
        OR EXISTS (SELECT 1 FROM campus.messages_live m WHERE m.seance_id = a.seance_id AND m.auteur_id = a.uid)
        OR EXISTS (SELECT 1 FROM campus.mains_levees ml WHERE ml.seance_id = a.seance_id AND ml.utilisateur_id = a.uid AND NOT ml.pour_salle)
      ) AS participe,
      COALESCE(${sqlSalleEmargee(sql`a.seance_id`, sql`a.site_id`)}, false) AS salle_emargee,
      COALESCE(e.seance_id IS NOT NULL AND ${SQL_INCIDENT_SALLE}, false) AS incident,
      EXISTS (SELECT 1 FROM campus.vues_replay v WHERE v.seance_id = a.seance_id AND v.utilisateur_id = a.uid) AS replay_vu
    FROM (${sqlAttendus({ depuis, sites })}) a
    JOIN campus.seances s ON s.id = a.seance_id
    LEFT JOIN campus.presences pr ON pr.seance_id = a.seance_id AND pr.utilisateur_id = a.uid
    LEFT JOIN campus.effectifs_salles e ON e.seance_id = a.seance_id AND e.site_id = a.site_id
    ${classeId ? sql`WHERE a.classe_id = ${classeId}` : sql``}`);
  return r.rows;
}

function ligneEntonnoir(libelle: string, ls: LigneDirect[], salleEmargee: boolean | null = null): LigneEntonnoir {
  const c = (g: (l: LigneDirect) => boolean) => ls.filter(g).length;
  return {
    libelle,
    attendus: ls.length,
    enSalle: c((l) => l.en_salle),
    enLigne: c((l) => l.en_ligne),
    ontSuivi: c((l) => l.a_suivi),
    auSeuil: c((l) => l.au_seuil),
    presents: c((l) => l.en_salle || l.au_seuil),
    absents: c((l) => l.etat === "absent"),
    inconnus: c((l) => l.etat !== "present" && l.etat !== "absent"),
    ontParticipe: c((l) => l.participe),
    salleEmargee,
  };
}

const grouper = <T, K>(ls: T[], cle: (l: T) => K) => {
  const m = new Map<K, T[]>();
  for (const l of ls) m.set(cle(l), [...(m.get(cle(l)) ?? []), l]);
  return m;
};

/** Dates telles que db.execute les rend (chaînes ISO avec le pilote de drizzle) : toujours relues par new Date(). */
type MetaSeance = { id: number; titre: string; code: string; debut: Date | string; demarree_le: Date | string; sondages: number };

async function metaSeances(ids: number[]): Promise<Map<number, MetaSeance>> {
  if (!ids.length) return new Map();
  const r = await ex().execute<MetaSeance>(sql`
    SELECT s.id, s.titre, c.code, s.debut, s.demarree_le,
      (SELECT count(*) FROM campus.sondages so WHERE so.seance_id = s.id AND so.ouvert_le IS NOT NULL)::int AS sondages
    FROM campus.seances s JOIN campus.cours c ON c.id = s.cours_id WHERE s.id = ANY(${entiers(ids)})`);
  return new Map(r.rows.map((l) => [l.id, l]));
}

/** Démarrée un autre jour (heure d'Abidjan) que celui prévu : le cas de la séance #26. */
const estMalDatee = (m: Pick<MetaSeance, "debut" | "demarree_le">) => jourLocal(m.debut) !== jourLocal(m.demarree_le);

async function blocDirects(
  lignes: LigneDirect[],
  meta: Map<number, MetaSeance>,
  nomsSites: Map<number, string>,
  nomsClasses: Map<number, string>,
): Promise<BlocDirects> {
  const parSeance = grouper(lignes, (l) => l.seance_id);
  const seances: SeanceEntonnoir[] = [...parSeance.entries()]
    .map(([id, ls]): SeanceEntonnoir | null => {
      const m = meta.get(id);
      // Séance de moins de 5 attendus dans le groupe : elle compte dans les totaux, sans détail affiché.
      if (!m || ls.length < EFFECTIF_MINIMUM) return null;
      const campus = [...grouper(ls, (l) => l.site_id).entries()]
        .filter(([, lc]) => lc.length >= EFFECTIF_MINIMUM)
        .map(([siteId, lc]) => ligneEntonnoir(siteId ? nomsSites.get(siteId) ?? "?" : "Sans campus", lc, siteId ? lc[0].salle_emargee : null))
        .sort((a, b) => b.attendus - a.attendus);
      const classes = [...grouper(ls, (l) => l.classe_id).entries()]
        .filter(([classeId, lc]) => classeId && lc.length >= EFFECTIF_MINIMUM)
        .map(([classeId, lc]) => ligneEntonnoir(nomsClasses.get(classeId!) ?? "?", lc))
        .sort((a, b) => b.attendus - a.attendus);
      return {
        id,
        titre: m.titre,
        coursCode: m.code,
        prevueLe: iso(m.debut),
        tenueLe: iso(m.demarree_le),
        malDatee: estMalDatee(m),
        sondages: m.sondages,
        total: ligneEntonnoir("Total", ls),
        campus,
        classes,
      };
    })
    .filter((s): s is SeanceEntonnoir => s !== null)
    .sort((a, b) => b.tenueLe.localeCompare(a.tenueLe));

  // Séances émargées par campus : une paire (séance, campus) par séance où le campus avait des attendus.
  const emargement: EmargementCampus[] = [...grouper(lignes.filter((l) => l.site_id !== null), (l) => l.site_id!).entries()]
    .map(([siteId, ls]) => {
      const paires = [...grouper(ls, (l) => l.seance_id).values()];
      const emargees = paires.filter((p) => p[0].salle_emargee).length;
      return {
        siteId,
        site: nomsSites.get(siteId) ?? "?",
        seances: paires.length,
        emargees,
        incidents: paires.filter((p) => p[0].incident).length,
        taux: paires.length ? Math.round((emargees / paires.length) * 100) : null,
        emarges: part(ls.filter((l) => l.en_salle).length, ls.length),
      };
    })
    .sort((a, b) => (a.taux ?? -1) - (b.taux ?? -1) || a.site.localeCompare(b.site));

  const parEtudiant = grouper(lignes, (l) => l.uid);
  return {
    seancesTenues: parSeance.size,
    presence: troisEtats(
      lignes.filter((l) => l.etat === "present").length,
      lignes.filter((l) => l.etat === "absent").length,
      lignes.filter((l) => l.etat !== "present" && l.etat !== "absent").length,
    ),
    ontSuivi: part([...parEtudiant.values()].filter((ls) => ls.some((l) => l.a_suivi)).length, parEtudiant.size),
    emargement,
    // Les 30 dernières suffisent à l'écran (le CSV et la page Présences ont le reste).
    seances: seances.slice(0, 30),
  };
}

// ── 3. Travail entre les cours ─────────────────────────────────────────────

const ORDRE_TRAVAIL: CleTravail[] = ["copies", "interrogations", "qcm_auto", "exercices_auto"];

async function blocTravail(
  f: FiltreEngagement,
  sites: Perimetre,
  debut: Jour,
  aujourdhui: Jour,
  lignes: LigneDirect[],
  effectif: number,
): Promise<BlocTravail> {
  const depuis = new Date(`${debut}T00:00:00Z`);
  const conds: SQL[] = [sql`true`];
  if (f.siteId) conds.push(sql`a.site_id = ${f.siteId}`);
  if (f.classeId) conds.push(sql`a.classe_id = ${f.classeId}`);
  const r = await ex().execute<{ cle: CleTravail; devoirs: number; ouverts: number; attendus: number; commences: number; rendus: number }>(sql`
    SELECT CASE WHEN a.type = 'quiz' THEN (CASE WHEN a.automatique THEN 'qcm_auto' ELSE 'interrogations' END)
      ELSE (CASE WHEN a.automatique THEN 'exercices_auto' ELSE 'copies' END) END AS cle,
      count(DISTINCT a.devoir_id)::int AS devoirs, count(DISTINCT a.devoir_id) FILTER (WHERE a.ouvert)::int AS ouverts,
      count(*)::int AS attendus, count(*) FILTER (WHERE a.commence)::int AS commences, count(*) FILTER (WHERE a.rendu)::int AS rendus
    FROM (${sqlDevoirsAttendus({ depuis, sites, inclureOuverts: true })}) a
    WHERE ${sql.join(conds, sql` AND `)}
    GROUP BY 1`);
  const parCle = new Map(r.rows.map((l) => [l.cle, l]));
  const travaux: LigneTravail[] = ORDRE_TRAVAIL.map((cle) => {
    const l = parCle.get(cle);
    const quiz = cle === "interrogations" || cle === "qcm_auto";
    return {
      cle,
      devoirs: l?.devoirs ?? 0,
      ouverts: l?.ouverts ?? 0,
      attendus: l?.attendus ?? 0,
      commences: quiz ? l?.commences ?? 0 : null,
      rendus: part(l?.rendus ?? 0, l?.attendus ?? 0),
    };
  });
  const absents = lignes.filter((l) => l.etat === "absent");
  const inconnus = lignes.filter((l) => l.etat !== "present" && l.etat !== "absent");

  const pop = sql`WITH pop AS (${sqlPopulation(sites, f.siteId, f.classeId)})`;
  const d = jourSql(debut);
  const auj = jourSql(aujourdhui);

  const revision = (await lisible("reponses_revision", ["utilisateur_id", "jour"]))
    ? await facultatif("révision", async () => {
        const [x] = (
          await ex().execute<{ reviseurs7j: number; reponses: number; reviseurs: number }>(sql`${pop}
            SELECT count(DISTINCT rr.utilisateur_id) FILTER (WHERE (rr.jour)::date > ${auj} - 7)::int AS reviseurs7j,
              count(*)::int AS reponses, count(DISTINCT rr.utilisateur_id)::int AS reviseurs
            FROM campus.reponses_revision rr JOIN pop p ON p.uid = rr.utilisateur_id WHERE (rr.jour)::date >= ${d}`)
        ).rows;
        const boite3 = (await lisible("revisions_etudiants", ["utilisateur_id", "boite"]))
          ? (
              await ex().execute<{ n: number; sur: number }>(sql`${pop}
                SELECT count(*) FILTER (WHERE re.boite >= 3)::int AS n, count(*)::int AS sur
                FROM campus.revisions_etudiants re JOIN pop p ON p.uid = re.utilisateur_id`)
            ).rows[0]
          : null;
        return {
          reviseurs7j: part(x.reviseurs7j, effectif),
          reponsesParReviseur: x.reviseurs >= EFFECTIF_MINIMUM ? Math.round((x.reponses / x.reviseurs) * 10) / 10 : null,
          boite3: boite3 ? part(boite3.n, boite3.sur) : null,
        };
      })
    : null;

  const coursComplets = (await lisible("suivis_cours_complets", ["utilisateur_id", "ouvert_le"]))
    ? await facultatif("cours complets", async () => {
        const [x] = (
          await ex().execute<{ n: number }>(sql`${pop}
            SELECT count(DISTINCT sc.utilisateur_id)::int AS n FROM campus.suivis_cours_complets sc JOIN pop p ON p.uid = sc.utilisateur_id
            WHERE (sc.ouvert_le AT TIME ZONE p.fz)::date >= ${d}`)
        ).rows;
        return part(x.n, effectif);
      })
    : null;

  // Objectif du jour (C2) : validés sur (inscrits × jours ouvrés complets de la période).
  const objectifs = (await lisible("objectifs_jours", ["utilisateur_id", "jour", "valide_le"]))
    ? await facultatif("objectifs", async () => {
        const [x] = (
          await ex().execute<{ n: number; sur: number }>(sql`${pop},
            jours AS (SELECT j::date AS jour FROM generate_series(${d}, ${auj} - 1, interval '1 day') j WHERE EXTRACT(ISODOW FROM j) <= 5)
            SELECT
              (SELECT count(*) FROM campus.objectifs_jours oj JOIN pop p ON p.uid = oj.utilisateur_id
                WHERE oj.valide_le IS NOT NULL AND (oj.jour)::date IN (SELECT jour FROM jours))::int AS n,
              (SELECT count(*) FROM jours j JOIN pop p ON p.inscrit_le <= j.jour)::int AS sur`)
        ).rows;
        return { valides: part(x.n, x.sur) };
      })
    : null;

  // Semaines actives (C5) : la dernière semaine complète a-t-elle atteint l'objectif de jours actifs (3 par défaut) ?
  const semainesActives = (await lisible("activites", ["utilisateur_id", "jour"]))
    ? await facultatif("semaines actives", async () => {
        const lundi = ajouterJours(lundiDe(aujourdhui), -7);
        const avecObjectif = await lisible("objectifs_semaine", ["utilisateur_id", "jours"]);
        const [x] = (
          await ex().execute<{ n: number; sur: number }>(sql`${pop}
            SELECT count(*) FILTER (WHERE (SELECT count(DISTINCT (ac.jour)::date) FROM campus.activites ac
                WHERE ac.utilisateur_id = p.uid AND (ac.jour)::date >= ${jourSql(lundi)} AND (ac.jour)::date < ${jourSql(lundi)} + 7)
              >= ${avecObjectif ? sql`COALESCE((SELECT os.jours FROM campus.objectifs_semaine os WHERE os.utilisateur_id = p.uid), 3)` : sql`3`})::int AS n,
              count(*)::int AS sur
            FROM pop p WHERE p.inscrit_le < ${jourSql(lundi)}`)
        ).rows;
        return part(x.n, x.sur);
      })
    : null;

  // Coupe des campus (C5) : 8 dernières semaines, campus du périmètre.
  const coupe = (await lisible("classements_semaine", ["semaine", "portee", "cible_id", "taux_participation", "rang"]))
    ? await facultatif("coupe", async () => {
        const r2 = await ex().execute<{ semaine: string; cible_id: number; nom: string; taux: number | null; rang: number | null }>(sql`
          SELECT cs.semaine::text AS semaine, cs.cible_id, si.nom_court AS nom, cs.taux_participation::float8 AS taux, cs.rang::int AS rang
          FROM campus.classements_semaine cs JOIN campus.sites si ON si.id = cs.cible_id
          WHERE cs.portee = 'campus' ${sites ? sql`AND cs.cible_id = ANY(${entiers(sites)})` : sql``}
            AND cs.semaine::text >= ${semaineIso(ajouterJours(aujourdhui, -7 * 8))}
          ORDER BY cs.semaine, cs.rang NULLS LAST`);
        return r2.rows.map((l) => ({
          semaine: l.semaine,
          cibleId: l.cible_id,
          nom: l.nom,
          // Le taux de C5 peut être stocké en part (0 à 1) ou en pourcentage : ramené en pourcentage.
          tauxParticipation: l.taux === null ? null : Math.round(l.taux <= 1 ? l.taux * 100 : l.taux),
          rang: l.rang,
        }));
      })
    : null;

  return {
    lignes: travaux,
    replaysAbsents: part(absents.filter((l) => l.replay_vu).length, absents.length),
    replaysInconnus: part(inconnus.filter((l) => l.replay_vu).length, inconnus.length),
    revision,
    coursComplets,
    objectifs,
    semainesActives,
    coupe,
  };
}

// ── 4. Rappels ─────────────────────────────────────────────────────────────

async function blocRappels(f: FiltreEngagement, sites: Perimetre, debut: Jour, effectif: number, nomsSites: Map<number, string>): Promise<BlocRappels> {
  const pop = sql`WITH pop AS (${sqlPopulation(sites, f.siteId, f.classeId)})`;
  const depuis = sql`${`${debut}T00:00:00Z`}::timestamptz`;
  const colonnesAbo = await colonnesDe("abonnements_push");
  // Essai reçu (C3) : colonne « recu » (booléen ou date) ou, à défaut, « verifie_le ».
  const typeRecu = colonnesAbo.get("recu");
  const essai: SQL | null =
    typeRecu === "boolean"
      ? sql`ap.recu IS TRUE`
      : typeRecu?.startsWith("timestamp")
        ? sql`ap.recu IS NOT NULL`
        : colonnesAbo.has("verifie_le")
          ? sql`ap.verifie_le IS NOT NULL`
          : null;
  const r = await ex().execute<{ site_id: number | null; inscrits: number; abonnes: number; essai: number; email: number }>(sql`${pop}
    SELECT p.site_id, count(*)::int AS inscrits,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM campus.abonnements_push ap WHERE ap.utilisateur_id = p.uid))::int AS abonnes,
      count(*) FILTER (WHERE ${essai ? sql`EXISTS (SELECT 1 FROM campus.abonnements_push ap WHERE ap.utilisateur_id = p.uid AND ${essai})` : sql`false`})::int AS essai,
      count(*) FILTER (WHERE NULLIF(u.email, '') IS NOT NULL)::int AS email
    FROM pop p JOIN campus.utilisateurs u ON u.id = p.uid
    GROUP BY p.site_id`);
  const total = (g: (l: (typeof r.rows)[number]) => number) => r.rows.reduce((s, l) => s + g(l), 0);
  const parMarque = colonnesAbo.has("marque")
    ? await facultatif("marques", async () =>
        (
          await ex().execute<{ marque: string; n: number }>(sql`${pop}
            SELECT COALESCE(NULLIF(initcap(trim(ap.marque)), ''), 'Non précisée') AS marque, count(DISTINCT ap.utilisateur_id)::int AS n
            FROM campus.abonnements_push ap JOIN pop p ON p.uid = ap.utilisateur_id GROUP BY 1 ORDER BY 2 DESC LIMIT 12`)
        ).rows,
      )
    : null;

  const envois = (await lisible("envois_push", ["utilisateur_id", "type", "priorite", "statut", "cree_le", "ouvert_le"]))
    ? await facultatif("envois", async () => {
        const lignes = async (colonne: "priorite" | "type"): Promise<LigneEnvois[]> => {
          const r2 = await ex().execute<{ cle: string | null; total: number; envoyes: number; differes: number; bloques: number; echecs: number; ouverts: number }>(sql`${pop}
            SELECT ep.${sql.raw(colonne)} AS cle, count(*)::int AS total,
              count(*) FILTER (WHERE ep.statut = 'envoye')::int AS envoyes,
              count(*) FILTER (WHERE ep.statut IN ('differe', 'regroupe'))::int AS differes,
              count(*) FILTER (WHERE ep.statut = 'plafond')::int AS bloques,
              count(*) FILTER (WHERE ep.statut IN ('echec', 'expire', 'sans_abonnement'))::int AS echecs,
              count(*) FILTER (WHERE ep.statut = 'envoye' AND ep.ouvert_le IS NOT NULL AND ep.ouvert_le <= ep.cree_le + interval '24 hours')::int AS ouverts
            FROM campus.envois_push ep JOIN pop p ON p.uid = ep.utilisateur_id
            WHERE ep.cree_le >= ${depuis}
            GROUP BY 1 ORDER BY 2 DESC LIMIT 12`);
          return r2.rows.map((l) => ({
            cle: l.cle ?? "?",
            total: l.total,
            envoyes: l.envoyes,
            differes: l.differes,
            bloques: l.bloques,
            echecs: l.echecs,
            ouverts: part(l.ouverts, l.envoyes),
          }));
        };
        return { parPriorite: await lignes("priorite"), parType: await lignes("type") };
      })
    : null;

  const relancesLisibles = await lisible("relances_engagement", ["utilisateur_id", "jour", "motif", "statut", "cree_le", "revenu_le"]);
  // Effet du rappel d'entraînement (C4) : action d'apprentissage dans les 24 h qui suivent l'heure du
  // rappel, les jours avec rappel comparés aux jours tirés au sort sans rappel (statut « temoin »).
  // Le tirage est recalculé (rappelEntrainementAutorise) : une ligne qui le contredit est écartée.
  const effetRappel = relancesLisibles
    ? await facultatif("effet du rappel", async () => {
        const r2 = await ex().execute<{ uid: number; jour: string; statut: string; suivi: boolean }>(sql`${pop},
          actes AS (${await sqlActes(new Date(`${debut}T00:00:00Z`))})
          SELECT re.utilisateur_id AS uid, (re.jour)::date::text AS jour, re.statut,
            EXISTS (SELECT 1 FROM actes x WHERE x.uid = re.utilisateur_id AND (
              (x.t IS NOT NULL AND x.t > re.cree_le AND x.t <= re.cree_le + interval '24 hours')
              OR (x.t IS NULL AND x.jour IN ((re.jour)::date, (re.jour)::date + 1)))) AS suivi
          FROM campus.relances_engagement re JOIN pop p ON p.uid = re.utilisateur_id
          WHERE re.motif = 'rappel_du_jour' AND re.statut IN ('envoye', 'temoin') AND re.cree_le >= ${depuis}
            AND re.cree_le <= now() - interval '24 hours'`);
        const garde = (l: (typeof r2.rows)[number]) =>
          !DEBUT_EXPERIENCE || (l.statut === "temoin") === !rappelEntrainementAutorise(l.uid, l.jour);
        const avec = r2.rows.filter((l) => l.statut === "envoye" && garde(l));
        const sans = r2.rows.filter((l) => l.statut === "temoin" && garde(l));
        if (!avec.length && !sans.length) return null;
        const avecRappel = part(avec.filter((l) => l.suivi).length, avec.length);
        const sansRappel = part(sans.filter((l) => l.suivi).length, sans.length);
        return {
          avecRappel,
          sansRappel,
          ecartPoints: avecRappel.taux !== null && sansRappel.taux !== null ? avecRappel.taux - sansRappel.taux : null,
        };
      })
    : null;

  const relances = relancesLisibles
    ? await facultatif("relances", async () => {
        const [x] = (
          await ex().execute<{ envoyees: number; revenus: number; a_appeler: number }>(sql`${pop}
            SELECT count(*) FILTER (WHERE re.statut = 'envoye')::int AS envoyees,
              count(*) FILTER (WHERE re.statut = 'envoye' AND re.revenu_le IS NOT NULL AND re.revenu_le <= re.cree_le + interval '48 hours')::int AS revenus,
              count(DISTINCT re.utilisateur_id) FILTER (WHERE re.statut = 'a_appeler')::int AS a_appeler
            FROM campus.relances_engagement re JOIN pop p ON p.uid = re.utilisateur_id
            WHERE re.motif IN ('lives_manques', 'inactif', 'devoir_non_rendu') AND re.cree_le >= ${depuis}`)
        ).rows;
        return { envoyees: x.envoyees, revenus48h: part(x.revenus, x.envoyees), aAppeler: x.a_appeler };
      })
    : null;

  return {
    abonnes: part(total((l) => l.abonnes), effectif),
    essaiRecu: essai ? part(total((l) => l.essai), effectif) : null,
    email: part(total((l) => l.email), effectif),
    parCampus: r.rows
      .map((l) => ({
        siteId: l.site_id,
        site: l.site_id ? nomsSites.get(l.site_id) ?? "?" : "Sans campus",
        inscrits: l.inscrits,
        abonnes: part(l.abonnes, l.inscrits),
        email: part(l.email, l.inscrits),
      }))
      .sort((a, b) => b.inscrits - a.inscrits),
    parMarque,
    envois,
    effetRappel,
    relances,
  };
}

// ── 5. Copies en attente par formateur ─────────────────────────────────────

async function copiesParFormateur(f: FiltreEngagement, sites: Perimetre, debut: Jour): Promise<CopiesFormateur[]> {
  const r = await ex().execute<{
    formateur_id: number | null;
    nom: string | null;
    en_attente: number;
    plus_ancienne: number | null;
    au_dela: number;
    delai: number | null;
    corrigees: number;
  }>(sql`
    WITH pop AS (${sqlPopulation(sites, f.siteId, f.classeId)})
    SELECT c.formateur_id, fo.prenom || ' ' || fo.nom AS nom,
      count(*) FILTER (WHERE r.statut = 'rendu')::int AS en_attente,
      floor(EXTRACT(EPOCH FROM now() - min(r.rendu_le) FILTER (WHERE r.statut = 'rendu')) / 86400)::int AS plus_ancienne,
      count(*) FILTER (WHERE r.statut = 'rendu' AND r.rendu_le < now() - interval '72 hours')::int AS au_dela,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM r.corrige_le - r.rendu_le) / 3600)
        FILTER (WHERE r.statut = 'corrige' AND r.corrige_le >= ${`${debut}T00:00:00Z`}::timestamptz) AS delai,
      count(*) FILTER (WHERE r.statut = 'corrige' AND r.corrige_le >= ${`${debut}T00:00:00Z`}::timestamptz)::int AS corrigees
    FROM campus.rendus r
    JOIN pop p ON p.uid = r.etudiant_id
    JOIN campus.devoirs d ON d.id = r.devoir_id AND d.type = 'depot'
    JOIN campus.cours c ON c.id = d.cours_id
    LEFT JOIN campus.utilisateurs fo ON fo.id = c.formateur_id
    WHERE r.rendu_le IS NOT NULL AND r.statut IN ('rendu', 'corrige')
    GROUP BY c.formateur_id, fo.prenom, fo.nom
    HAVING count(*) FILTER (WHERE r.statut = 'rendu') > 0
      OR count(*) FILTER (WHERE r.statut = 'corrige' AND r.corrige_le >= ${`${debut}T00:00:00Z`}::timestamptz) > 0
    ORDER BY 3 DESC, 4 DESC NULLS LAST`);
  return r.rows.map((l) => ({
    formateurId: l.formateur_id,
    nom: l.nom ?? "Sans formateur",
    enAttente: l.en_attente,
    plusAncienneJours: l.plus_ancienne,
    auDela72h: l.au_dela,
    delaiMedianHeures: l.delai === null ? null : Math.round(l.delai),
    corrigees: l.corrigees,
  }));
}

// ── 6. Questions les plus ratées par séance ────────────────────────────────

async function questionsRatees(f: FiltreEngagement, sites: Perimetre, debut: Jour, meta: Map<number, MetaSeance>): Promise<QuestionRatee[]> {
  const depuis = sql`${`${debut}T00:00:00Z`}::timestamptz`;
  const pop = sql`WITH pop AS (${sqlPopulation(sites, f.siteId, f.classeId)})`;
  // Interrogations liées à une séance (routine du soir) : chaque réponse corrigée comme l'interrogation elle-même.
  const r = await ex().execute<{
    seance_id: number;
    titre: string;
    code: string;
    question_id: number;
    enonce: string;
    type: QuestionQuiz["type"];
    bonnes_reponses: QuestionQuiz["bonnesReponses"];
    points: number;
    reponse: (number | string)[] | null;
  }>(sql`${pop}
    SELECT ds.seance_id, s.titre, c.code, q.id AS question_id, q.enonce, q.type, q.bonnes_reponses, q.points::float8 AS points,
      tq.reponses -> q.id::text AS reponse
    FROM campus.devoirs_seances ds
    JOIN campus.seances s ON s.id = ds.seance_id
    JOIN campus.cours c ON c.id = s.cours_id
    JOIN campus.devoirs d ON ds.devoir_ids @> jsonb_build_array(d.id) AND d.type = 'quiz'
    JOIN campus.questions_quiz q ON q.devoir_id = d.id
    JOIN campus.tentatives_quiz tq ON tq.devoir_id = d.id AND tq.fin_le IS NOT NULL AND tq.fin_le >= ${depuis}
    JOIN pop p ON p.uid = tq.etudiant_id`);
  const stats = new Map<number, QuestionRatee & { erreurs: number }>();
  for (const l of r.rows) {
    let s = stats.get(l.question_id);
    if (!s) {
      s = { seanceId: l.seance_id, seanceTitre: l.titre, coursCode: l.code, enonce: l.enonce, reponses: 0, erreurs: 0, tauxErreur: 0, origine: "interrogation" };
      stats.set(l.question_id, s);
    }
    s.reponses++;
    if (!corrigerQuestion({ type: l.type, bonnesReponses: l.bonnes_reponses, points: l.points }, l.reponse).juste) s.erreurs++;
  }
  // Cartes de révision (C1), si leurs tables existent.
  if ((await lisible("reponses_revision", ["carte_id", "juste", "utilisateur_id", "jour"])) && (await lisible("cartes_revision", ["id", "seance_id", "contenu"]))) {
    const cartes = await facultatif("cartes ratées", async () =>
      (
        await ex().execute<{ carte_id: number; seance_id: number; titre: string; code: string; enonce: string; reponses: number; erreurs: number }>(sql`${pop}
          SELECT cr.id AS carte_id, cr.seance_id, s.titre, c.code,
            COALESCE(cr.contenu->>'question', cr.contenu->>'enonce', cr.contenu->>'recto', cr.contenu->>'terme', 'Carte n° ' || cr.id) AS enonce,
            count(*)::int AS reponses, count(*) FILTER (WHERE NOT rr.juste)::int AS erreurs
          FROM campus.reponses_revision rr
          JOIN pop p ON p.uid = rr.utilisateur_id
          JOIN campus.cartes_revision cr ON cr.id = rr.carte_id
          JOIN campus.seances s ON s.id = cr.seance_id
          JOIN campus.cours c ON c.id = s.cours_id
          WHERE (rr.jour)::date >= ${jourSql(debut)}
          GROUP BY cr.id, cr.seance_id, s.titre, c.code, cr.contenu`)
      ).rows,
    );
    for (const l of cartes ?? [])
      stats.set(-l.carte_id, {
        seanceId: l.seance_id,
        seanceTitre: l.titre,
        coursCode: l.code,
        enonce: l.enonce,
        reponses: l.reponses,
        erreurs: l.erreurs,
        tauxErreur: 0,
        origine: "revision",
      });
  }
  // Au moins 5 réponses, et plus d'une sur trois fausse ; 3 au plus par séance, les séances les plus récentes d'abord.
  const retenues = [...stats.values()]
    .filter((s) => s.reponses >= EFFECTIF_MINIMUM && s.erreurs / s.reponses > 1 / 3)
    .map((s) => ({ ...s, tauxErreur: Math.round((s.erreurs / s.reponses) * 100) }));
  const parSeance = grouper(retenues, (s) => s.seanceId);
  const recence = (id: number) => {
    const m = meta.get(id);
    return m ? new Date(m.demarree_le).getTime() : 0;
  };
  return [...parSeance.entries()]
    .sort((a, b) => recence(b[0]) - recence(a[0]))
    .slice(0, 8)
    .flatMap(([, qs]) => qs.sort((a, b) => b.tauxErreur - a.tauxErreur).slice(0, 3))
    .map(({ erreurs: _e, ...q }) => q);
}

// ── Assemblage, cache ──────────────────────────────────────────────────────

const DUREE_CACHE_MS = 10 * 60_000;
const cache = new Map<string, { le: number; promesse: Promise<EngagementPilotage> }>();
setInterval(() => {
  const limite = Date.now() - DUREE_CACHE_MS;
  for (const [cle, c] of cache) if (c.le < limite) cache.delete(cle);
}, DUREE_CACHE_MS).unref();

/** Noms des campus et des classes, pour les libellés (aucune donnée d'étudiant). */
async function noms(): Promise<{ sites: Map<number, string>; classes: Map<number, string> }> {
  const [s, c] = await Promise.all([
    ex().execute<{ id: number; nom: string }>(sql`SELECT id, nom_court AS nom FROM campus.sites`),
    ex().execute<{ id: number; nom: string }>(sql`SELECT id, nom FROM campus.classes`),
  ]);
  return { sites: new Map(s.rows.map((l) => [l.id, l.nom])), classes: new Map(c.rows.map((l) => [l.id, l.nom])) };
}

/**
 * Tous les indicateurs de la page, pour ce périmètre et ce filtre. Gardés
 * 10 minutes (frais = vrai : recalcul demandé par la personne).
 */
export function indicateursEngagement(
  sites: Perimetre,
  perimetre: EngagementPilotage["perimetre"],
  f: FiltreEngagement,
  frais = false,
): Promise<EngagementPilotage> {
  const cle = JSON.stringify([sites, f.jours, f.siteId, f.classeId]);
  const connu = cache.get(cle);
  if (!frais && connu && Date.now() - connu.le < DUREE_CACHE_MS) return connu.promesse;
  const promesse = sansJit(() => calculer(sites, perimetre, f));
  cache.set(cle, { le: Date.now(), promesse });
  // Un calcul qui échoue n'est pas gardé : la visite suivante recommence.
  promesse.catch(() => cache.get(cle)?.promesse === promesse && cache.delete(cle));
  return promesse;
}

async function calculer(sites: Perimetre, perimetre: EngagementPilotage["perimetre"], f: FiltreEngagement): Promise<EngagementPilotage> {
  const debutCalcul = Date.now();
  const aujourdhui = jourLocal(new Date());
  const debut = ajouterJours(aujourdhui, -(f.jours - 1));
  const [{ effectif }] = (
    await ex().execute<{ effectif: number }>(sql`SELECT count(*)::int AS effectif FROM (${sqlPopulation(sites, f.siteId, f.classeId)}) p`)
  ).rows;
  const base: EngagementPilotage = {
    perimetre,
    filtre: f,
    effectif,
    effectifTropPetit: effectif < EFFECTIF_MINIMUM,
    aujourdhui,
    debut,
    mesureDepuis: await mesureDepuis(),
    regularite: null,
    directs: null,
    travail: null,
    rappels: null,
    copies: [],
    seancesMalDatees: [],
    questionsRatees: [],
    genereLe: new Date().toISOString(),
    calculMs: 0,
  };
  // Une classe de 3 étudiants n'affiche rien : ni taux, ni décompte qui les désignerait.
  if (base.effectifTropPetit) return { ...base, calculMs: Date.now() - debutCalcul };

  const { sites: nomsSites, classes: nomsClasses } = await noms();
  // Les requêtes passent l'une après l'autre : le calcul n'occupe jamais plus d'une connexion de la base.
  const regularite = await blocRegularite(f, sites, aujourdhui, debut, base.mesureDepuis);
  const perimetreDirects = f.siteId ? [f.siteId] : sites;
  const lignes = await lignesDirects(new Date(`${debut}T00:00:00Z`), perimetreDirects, f.classeId);
  const meta = await metaSeances([...new Set(lignes.map((l) => l.seance_id))]);
  const directs = await blocDirects(lignes, meta, nomsSites, nomsClasses);
  const travail = await blocTravail(f, perimetreDirects, debut, aujourdhui, lignes, effectif);
  const rappels = await blocRappels(f, sites, debut, effectif, nomsSites);
  const copies = await copiesParFormateur(f, sites, debut);
  const seancesMalDatees: SeanceMalDatee[] = [...meta.values()]
    .filter(estMalDatee)
    .map((m) => ({
      id: m.id,
      titre: m.titre,
      coursCode: m.code,
      prevueLe: iso(m.debut),
      tenueLe: iso(m.demarree_le),
      ecartJours: ecartJours(jourLocal(m.demarree_le), jourLocal(m.debut)),
    }))
    .sort((a, b) => b.tenueLe.localeCompare(a.tenueLe));
  const ratees = await questionsRatees(f, sites, debut, meta);
  return {
    ...base,
    regularite,
    directs,
    travail,
    rappels,
    copies,
    seancesMalDatees,
    questionsRatees: ratees,
    calculMs: Date.now() - debutCalcul,
  };
}

// ── Export CSV par classe ──────────────────────────────────────────────────

export type LigneExportClasse = {
  site: string;
  classe: string;
  inscrits: number;
  ouverts7j: number | null;
  apprenants7j: number | null;
  medianeSemaine: number | null;
  presents: number | null;
  absents: number | null;
  inconnus: number | null;
  presenceConnue: number | null;
  copiesALaDate: number | null;
  qcmAutoTermines: number | null;
};

/**
 * Une ligne par classe du périmètre (classe actuelle des étudiants), sans
 * aucun nom d'étudiant ; sous EFFECTIF_MINIMUM inscrits, seuls le nom de la
 * classe et l'effectif sont donnés.
 */
export function exportParClasse(sites: Perimetre, f: FiltreEngagement): Promise<LigneExportClasse[]> {
  return sansJit(() => calculerExport(sites, f));
}

async function calculerExport(sites: Perimetre, f: FiltreEngagement): Promise<LigneExportClasse[]> {
  const aujourdhui = jourLocal(new Date());
  const debut = ajouterJours(aujourdhui, -(f.jours - 1));
  const depuis = new Date(`${debut}T00:00:00Z`);
  const lundi = ajouterJours(lundiDe(aujourdhui), -7);
  const auj = jourSql(aujourdhui);
  const perimetreDirects = f.siteId ? [f.siteId] : sites;
  const r = await ex().execute<{
    classe_id: number;
    classe: string;
    site: string;
    inscrits: number;
    ouverts7j: number;
    apprenants7j: number;
    mediane: number | null;
  }>(sql`
    WITH pop AS MATERIALIZED (${sqlPopulation(sites, f.siteId, f.classeId)}),
    actes AS MATERIALIZED (${await sqlActes(new Date(Date.now() - 31 * JOUR_MS))}),
    appr AS MATERIALIZED (SELECT DISTINCT uid, jour FROM actes),
    vus AS (SELECT uid, jour FROM appr UNION SELECT a.utilisateur_id, a.jour FROM campus.activite_jours a JOIN pop p ON p.uid = a.utilisateur_id
      UNION SELECT p.uid, (p.derniere_connexion AT TIME ZONE p.fz)::date FROM pop p WHERE p.derniere_connexion IS NOT NULL)
    SELECT cl.id AS classe_id, cl.nom AS classe, si.nom_court AS site, count(p.uid)::int AS inscrits,
      count(p.uid) FILTER (WHERE EXISTS (SELECT 1 FROM vus v WHERE v.uid = p.uid AND v.jour > ${auj} - 7))::int AS ouverts7j,
      count(p.uid) FILTER (WHERE EXISTS (SELECT 1 FROM appr x WHERE x.uid = p.uid AND x.jour > ${auj} - 7))::int AS apprenants7j,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY (SELECT count(*) FROM appr x WHERE x.uid = p.uid AND x.jour >= ${jourSql(lundi)} AND x.jour < ${jourSql(lundi)} + 7))
        FILTER (WHERE p.inscrit_le < ${jourSql(lundi)}) AS mediane
    FROM pop p JOIN campus.classes cl ON cl.id = p.classe_id JOIN campus.sites si ON si.id = cl.site_id
    GROUP BY cl.id, cl.nom, si.nom_court, si.ordre
    ORDER BY si.ordre, cl.nom`);
  const lignes = await lignesDirects(depuis, perimetreDirects, f.classeId);
  // Présence par classe ACTUELLE (comme les autres colonnes du fichier).
  const classeActuelle = new Map(
    (await ex().execute<{ uid: number; classe_id: number | null }>(sql`SELECT uid, classe_id FROM (${sqlPopulation(sites, f.siteId, f.classeId)}) p`)).rows.map((l) => [l.uid, l.classe_id]),
  );
  const presences = grouper(lignes, (l) => classeActuelle.get(l.uid) ?? null);
  const devoirs = await ex().execute<{ uid: number; rendu: boolean; type: string; automatique: boolean }>(sql`
    SELECT a.uid, a.rendu, a.type, a.automatique FROM (${sqlDevoirsAttendus({ depuis, sites: perimetreDirects, inclureOuverts: true })}) a`);
  const parClasseDevoirs = grouper(devoirs.rows, (l) => classeActuelle.get(l.uid) ?? null);
  return r.rows.map((l) => {
    const assez = l.inscrits >= EFFECTIF_MINIMUM;
    const ps = presences.get(l.classe_id) ?? [];
    const etats = troisEtats(
      ps.filter((x) => x.etat === "present").length,
      ps.filter((x) => x.etat === "absent").length,
      ps.filter((x) => x.etat !== "present" && x.etat !== "absent").length,
    );
    const dv = parClasseDevoirs.get(l.classe_id) ?? [];
    const copies = dv.filter((x) => x.type === "depot" && !x.automatique);
    const qcm = dv.filter((x) => x.type === "quiz" && x.automatique);
    return {
      site: l.site,
      classe: l.classe,
      inscrits: l.inscrits,
      ouverts7j: assez ? l.ouverts7j : null,
      apprenants7j: assez ? l.apprenants7j : null,
      medianeSemaine: assez && l.mediane !== null ? Math.round(l.mediane * 10) / 10 : null,
      presents: assez ? etats.presents : null,
      absents: assez ? etats.absents : null,
      inconnus: assez ? etats.inconnus : null,
      presenceConnue: assez ? etats.tauxConnu : null,
      copiesALaDate: assez ? part(copies.filter((x) => x.rendu).length, copies.length).taux : null,
      qcmAutoTermines: assez ? part(qcm.filter((x) => x.rendu).length, qcm.length).taux : null,
    };
  });
}

// ── Tableau de pilotage (/pilotage) ────────────────────────────────────────

export type ChiffresSite = {
  site_id: number | null;
  actifs_aujourdhui: number;
  apprenants_aujourdhui: number;
  revenus: number;
  etudiants: number;
};

/**
 * Par campus du périmètre : actifs aujourd'hui (ouverture et action
 * d'apprentissage) et « revenus » (vus au moins deux jours différents).
 */
export function chiffresTableau(sites: Perimetre): Promise<ChiffresSite[]> {
  return sansJit(() => calculerChiffresTableau(sites));
}

async function calculerChiffresTableau(sites: Perimetre): Promise<ChiffresSite[]> {
  const aujourdhui = jourLocal(new Date());
  const auj = jourSql(aujourdhui);
  const r = await ex().execute<ChiffresSite>(sql`
    WITH pop AS MATERIALIZED (${sqlPopulation(sites)}),
    actes AS MATERIALIZED (${await sqlActes(new Date(Date.now() - 400 * JOUR_MS))}),
    vus AS MATERIALIZED (
      SELECT DISTINCT uid, jour FROM actes
      UNION SELECT a.utilisateur_id, a.jour FROM campus.activite_jours a JOIN pop p ON p.uid = a.utilisateur_id
      UNION SELECT p.uid, (p.derniere_connexion AT TIME ZONE p.fz)::date FROM pop p WHERE p.derniere_connexion IS NOT NULL)
    SELECT p.site_id, count(*)::int AS etudiants,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM vus v WHERE v.uid = p.uid AND v.jour = ${auj}))::int AS actifs_aujourdhui,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM actes x WHERE x.uid = p.uid AND x.jour = ${auj}))::int AS apprenants_aujourdhui,
      count(*) FILTER (WHERE (SELECT count(*) FROM vus v WHERE v.uid = p.uid) >= 2)::int AS revenus
    FROM pop p GROUP BY p.site_id`);
  return r.rows;
}

export type PresenceSite = { site_id: number | null; presents: number; absents: number; inconnus: number; suivis: number; avec_direct: number; seances: number; emargees: number };

/** Présence aux directs de la période par campus, en trois états, et séances dont la salle du campus a été émargée. */
export async function presencesTableau(sites: Perimetre, depuis: Date): Promise<PresenceSite[]> {
  const lignes = await sansJit(() => lignesDirects(depuis, sites, null));
  return [...grouper(lignes, (l) => l.site_id).entries()].map(([siteId, ls]) => {
    const parEtudiant = [...grouper(ls, (l) => l.uid).values()];
    const paires = [...grouper(ls, (l) => l.seance_id).values()];
    return {
      site_id: siteId,
      presents: ls.filter((l) => l.etat === "present").length,
      absents: ls.filter((l) => l.etat === "absent").length,
      inconnus: ls.filter((l) => l.etat !== "present" && l.etat !== "absent").length,
      suivis: parEtudiant.filter((x) => x.some((l) => l.a_suivi)).length,
      avec_direct: parEtudiant.length,
      seances: siteId ? paires.length : 0,
      emargees: siteId ? paires.filter((p) => p[0].salle_emargee).length : 0,
    };
  });
}
