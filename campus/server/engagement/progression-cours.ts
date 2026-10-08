// Progression honnête d'un étudiant dans ses cours (chantier C2), partagée
// par l'accueil (server/routes/accueil.ts) et « Mes cours » (routes/cours.ts) :
//
//   (leçons terminées + séances suivies ou rattrapées)
//   / (leçons publiées + séances comptées)
//
// Une séance compte si elle a été tenue, que l'étudiant y était attendu
// (sqlAttendus, même règle que le pilotage) et que sa présence est connue
// (présent ou absent, server/engagement/presence.ts) ou qu'il l'a rattrapée.
// Une présence « inconnue » (salle non émargée) ne compte jamais contre lui :
// elle sort du calcul, sauf s'il a rattrapé la séance. Rien ne s'affiche
// quand le total vaut 0 (pourcentage null).
//
// « Rattrapée » (sqlSeanceRattrapee) sert aussi au rattrapage de l'objectif du
// jour. Il faut un vrai travail, jamais une simple ouverture : replay regardé
// au moins REPLAY_MINUTES (même règle que les points du registre, C5), cours
// complet travaillé (quiz d'entraînement terminé, 3 fiches retournées ou un
// exercice fait, suivis_cours_complets de C1), ou au moins 3 cartes de révision
// de cette séance (tables de C1). Lire « À retenir » ne rattrape pas une séance.
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { sqlAttendus } from "../routes/admin";
import { REPLAY_MINUTES } from "./bareme";
import { sqlEtatPresence } from "./presence";
import { tableExiste } from "./tables";
import { calculerPourcentage, type ProgressionCours } from "@shared/engagement/objectif";

// ── Tables des autres chantiers, lues seulement si elles ont les colonnes attendues ──

const DUREE_MS = 10 * 60_000;
const colonnesConnues = new Map<string, { colonnes: Set<string>; le: number }>();

/**
 * Vrai si la table campus.<nom> existe et porte toutes ces colonnes. Les
 * tables des autres chantiers ne se lisent qu'à travers la base
 * (campus/ENGAGEMENT.md) : si l'une manque ou n'a pas la forme attendue, le
 * bloc qui en dépend se tait au lieu de casser l'accueil. Gardé 10 minutes.
 */
export async function tableUtilisable(nom: string, colonnes: string[]): Promise<boolean> {
  if (!(await tableExiste(nom))) return false;
  let connu = colonnesConnues.get(nom);
  if (!connu || Date.now() - connu.le >= DUREE_MS) {
    const r = await db.execute<{ c: string }>(
      sql`SELECT column_name AS c FROM information_schema.columns WHERE table_schema = 'campus' AND table_name = ${nom}`,
    );
    connu = { colonnes: new Set(r.rows.map((l) => l.c)), le: Date.now() };
    colonnesConnues.set(nom, connu);
  }
  return colonnes.every((c) => connu.colonnes.has(c));
}

/** Traces de révision de C1 disponibles dans la base. */
export type TracesRevision = { suivis: boolean; cartes: boolean };
const SANS_TRACES: TracesRevision = { suivis: false, cartes: false };

export async function tracesRevision(): Promise<TracesRevision> {
  const [suivis, cartes, reponses] = await Promise.all([
    tableUtilisable("suivis_cours_complets", ["utilisateur_id", "seance_id", "quiz_meilleur", "fiches_vues", "exercices_faits"]),
    tableUtilisable("cartes_revision", ["id", "seance_id"]),
    tableUtilisable("reponses_revision", ["utilisateur_id", "carte_id"]),
  ]);
  return { suivis, cartes: cartes && reponses };
}

/** Table ou colonne absente (42P01, 42703) : une table d'un autre chantier a changé depuis la dernière vérification. */
export const estAbsence = (e: unknown) => ["42P01", "42703"].includes((e as { code?: string } | null)?.code ?? "");

/**
 * Lecture d'une table d'un autre chantier qui ne doit jamais casser l'accueil :
 * si la table ou une colonne manque, on oublie ce qu'on en savait et on rend
 * le repli (le bloc se tait).
 */
export async function lireOuTaire<T>(lecture: () => Promise<T>, repli: T): Promise<T> {
  try {
    return await lecture();
  } catch (e) {
    if (!estAbsence(e)) throw e;
    colonnesConnues.clear();
    console.warn("[engagement C2] table d'un autre chantier illisible, bloc masqué :", (e as Error).message);
    return repli;
  }
}

/** Requête qui lit les traces de C1 si elles sont là : refaite sans elles si l'une a disparu. */
export async function avecTraces<T>(lecture: (traces: TracesRevision) => Promise<T>): Promise<T> {
  const traces = await tracesRevision();
  if (!traces.suivis && !traces.cartes) return lecture(SANS_TRACES);
  try {
    return await lecture(traces);
  } catch (e) {
    if (!estAbsence(e)) throw e;
    colonnesConnues.clear();
    console.warn("[engagement C2] traces de révision illisibles, calcul sans elles :", (e as Error).message);
    return lecture(SANS_TRACES);
  }
}

/** Nombre de cartes différentes d'une séance (révision ou fiches du cours complet) qu'il faut avoir travaillées pour l'avoir rattrapée. */
export const CARTES_RATTRAPAGE = 3;

/**
 * La séance a-t-elle été rattrapée par l'étudiant ? Expression booléenne ;
 * arguments évalués dans la requête de l'appelant (sql`a.seance_id`).
 * Une ouverture (replay demandé, cours complet ouvert, ligne touchée) ne suffit
 * jamais : il faut un acte d'apprentissage.
 */
export function sqlSeanceRattrapee(seanceId: SQL, etudiantId: SQL, traces: TracesRevision): SQL {
  const conditions: SQL[] = [
    // Replay où il est resté ou revenu (même règle que les points « replay » du registre, C5).
    sql`EXISTS (SELECT 1 FROM campus.vues_replay vr WHERE vr.seance_id = ${seanceId} AND vr.utilisateur_id = ${etudiantId}
      AND vr.derniere_vue >= vr.premiere_vue + make_interval(mins => ${REPLAY_MINUTES}::int))`,
  ];
  if (traces.suivis) {
    // Cours complet travaillé : quiz d'entraînement terminé, quelques fiches retournées, ou un exercice fait (ou « difficile »).
    conditions.push(sql`EXISTS (SELECT 1 FROM campus.suivis_cours_complets sc WHERE sc.seance_id = ${seanceId} AND sc.utilisateur_id = ${etudiantId}
      AND (sc.quiz_meilleur IS NOT NULL OR sc.fiches_vues >= ${CARTES_RATTRAPAGE}::int
        OR EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(sc.exercices_faits) = 'object' THEN sc.exercices_faits ELSE '{}'::jsonb END) x
          WHERE jsonb_typeof(x.value) = 'object' AND (x.value -> 'etat') IS NOT NULL)))`);
  }
  if (traces.cartes) {
    conditions.push(sql`(SELECT count(DISTINCT rr.carte_id) FROM campus.reponses_revision rr
      JOIN campus.cartes_revision cr ON cr.id = rr.carte_id
      WHERE cr.seance_id = ${seanceId} AND rr.utilisateur_id = ${etudiantId}) >= ${CARTES_RATTRAPAGE}`);
  }
  return sql`(${sql.join(conditions, sql` OR `)})`;
}

/** Progression de l'étudiant dans chacun de ces cours (tous présents dans la réponse, à 0 au besoin). */
export async function progressionsCours(etudiantId: number, coursIds: number[]): Promise<Map<number, ProgressionCours>> {
  const resultat = new Map<number, ProgressionCours>();
  const ids = [...new Set(coursIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return resultat;
  const tableau = `{${ids.join(",")}}`;

  const [lecons, seances] = await Promise.all([
    db.execute<{ cours_id: number; total: number; terminees: number }>(sql`
      SELECT l.cours_id, count(*)::int AS total, count(p.lecon_id)::int AS terminees
      FROM campus.lecons l
      LEFT JOIN campus.progressions p ON p.lecon_id = l.id AND p.utilisateur_id = ${etudiantId}
      WHERE l.cours_id = ANY(${tableau}::int[]) AND l.publiee
      GROUP BY l.cours_id`),
    avecTraces((traces) =>
      db.execute<{ cours_id: number; suivies: number; comptees: number }>(sql`
      SELECT a.cours_id,
        count(*) FILTER (WHERE x.etat = 'present' OR x.rattrapee)::int AS suivies,
        count(*) FILTER (WHERE x.etat IN ('present', 'absent') OR x.rattrapee)::int AS comptees
      FROM (${sqlAttendus({ etudiantId, sites: null })}) a
      CROSS JOIN LATERAL (
        SELECT ${sqlEtatPresence(sql`a.seance_id`, sql`a.uid`)} AS etat,
          ${sqlSeanceRattrapee(sql`a.seance_id`, sql`a.uid`, traces)} AS rattrapee
        -- OFFSET 0 : l'état est calculé une fois par séance, pas une fois par filtre qui le lit.
        OFFSET 0
      ) x
      WHERE a.cours_id = ANY(${tableau}::int[])
      GROUP BY a.cours_id`),
    ),
  ]);

  const leconsDe = new Map(lecons.rows.map((l) => [l.cours_id, l]));
  const seancesDe = new Map(seances.rows.map((s) => [s.cours_id, s]));
  for (const id of ids) {
    const l = leconsDe.get(id);
    const s = seancesDe.get(id);
    const base = {
      leconsTerminees: l?.terminees ?? 0,
      leconsTotal: l?.total ?? 0,
      seancesSuivies: s?.suivies ?? 0,
      seancesTotal: s?.comptees ?? 0,
    };
    resultat.set(id, { ...base, pourcentage: calculerPourcentage(base) });
  }
  return resultat;
}
