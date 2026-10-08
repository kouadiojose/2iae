// Coupe des campus et des classes (chantier C5), recalculée toutes les
// 15 minutes. On compare des TAUX, jamais des totaux (Riviera 99 étudiants,
// Yamoussoukro 15) et jamais des étudiants : un petit campus très actif passe
// devant un grand campus peu actif, et tout repart à zéro chaque lundi.
//
// Semaine ISO du lundi 0 h au dimanche 24 h, heure d'Abidjan. Une semaine
// terminée reste ouverte 48 h de plus (DELAI_BILAN_HEURES, jusqu'au mercredi
// 1 h) : une révision faite hors ligne le dimanche et reçue le lundi ou le
// mardi compte encore pour elle. Elle est alors recalculée, puis figée une
// seule fois (fige_le) après un dernier passage du registre, avec ses
// trophées ; la cloche les annonce une seule fois aux classes et aux campus
// primés, sans rappel sur le téléphone.
//
// Par campus, et par classe d'au moins 5 inscrits actifs (une classe plus
// petite reste hors classement mais compte pour son campus) :
//   - participation : part des inscrits qui ont fait des actes d'au moins deux
//     familles différentes dans la semaine (plus difficile à gonfler que les points) ;
//   - présence aux directs des salles ÉMARGÉES (décision D1, sqlSalleEmargee
//     du socle) : une séance dont la salle d'un campus n'est pas émargée est
//     neutre pour ce campus (amendement de José), une séance touchée par un
//     incident de salle aussi ; une présence « inconnue » ne compte jamais ;
//   - taux de la Coupe (classement principal) : la participation, mêlée à la
//     présence (un tiers) quand au moins une salle a été émargée, sans jamais
//     descendre sous la participation : émarger ne fait jamais perdre un
//     campus, la présence ne peut que faire monter son taux ;
//   - points moyens (plafonnés par étudiant), part d'assidus (3 jours actifs),
//     progression sur la semaine précédente, prise au même moment tant que la
//     semaine est en cours (un mardi midi contre un mardi midi), complète
//     ensuite.
// Rangs : à 0 %, aucun (personne n'est « 1er » à 0 %, personne n'est dernier).
// Ligues des classes : 1re année, 2e année, licences et certificats. Un campus
// sans inscrit est masqué (M'Batto : « bientôt »). La toute première semaine
// de la Coupe est une semaine d'essai : affichée, sans aucun trophée.
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { planifier } from "../taches";
import { notifier } from "../notifications";
import { sqlAttendus, sqlClasseA, SQL_INCIDENT_SALLE } from "../routes/admin";
import { sqlSalleEmargee } from "./presence";
import { passerRegistre, rattrapageTermine } from "./registre";
import { DELAI_BILAN_HEURES, mettreAJourSemaines } from "./semaines";
import { attribuerBadges } from "./badges";
import { COUPE } from "./bareme";
import { ajouterJours, jourLocal, lundiDe, semaineIso, FUSEAU_PAR_DEFAUT, type Jour, type SemaineIso } from "@shared/engagement/calendrier";
import { FAMILLE_DU_TYPE, ligueDuNiveau, type Famille, type Ligue, type PorteeCoupe, type Trophee } from "@shared/engagement/progression";
import { t } from "@shared/textes/progression";

const VERROU_COUPE = 51_031_002;
const JOUR_MS = 86_400_000;

type Executeur = Pick<typeof db, "execute">;

export type LigneCoupe = {
  portee: PorteeCoupe;
  cibleId: number;
  ligue: "campus" | Ligue;
  nom: string;
  inscrits: number;
  participants: number;
  assidus: number;
  tauxParticipation: number;
  pointsMoyens: number;
  partAssidus: number;
  presenceDirect: number | null;
  seancesEmargees: number;
  score: number;
  actes: Partial<Record<Famille, number>>;
  progression: number | null;
  rang: number | null;
  trophees: Trophee[];
  /** Campus de la ligne (le campus lui-même, ou celui de la classe) : périmètre de la vie scolaire. */
  siteId?: number | null;
};

const cle = (portee: PorteeCoupe, id: number) => `${portee}:${id}`;
const arrondi1 = (n: number) => Math.round(n * 10) / 10;
const part = (n: number, sur: number) => (sur > 0 ? (n / sur) * 100 : 0);

/** Lundi 0 h (heure d'Abidjan, GMT toute l'année) d'une semaine, en instant. */
export const debutDeSemaine = (lundi: Jour) => new Date(`${lundi}T00:00:00Z`);
/** Lundi de la semaine en cours à Abidjan : la semaine bascule à 0 h. */
export const lundiEnCours = (maintenant = new Date()) => lundiDe(jourLocal(maintenant, FUSEAU_PAR_DEFAUT));
/**
 * La semaine précédente est-elle encore en clôture ? Du lundi 0 h au mercredi
 * 1 h : ses révisions faites hors ligne peuvent encore arriver, elle n'est pas
 * figée et ses trophées ne sont pas encore attribués.
 */
export const semainePrecedenteEnCloture = (maintenant = new Date()) =>
  maintenant.getTime() < debutDeSemaine(lundiEnCours(maintenant)).getTime() + DELAI_BILAN_HEURES * 3_600_000;

/** Famille d'un type d'activité, en SQL (même table que FAMILLE_DU_TYPE). */
export function sqlFamille(type: SQL): SQL {
  const cas = Object.entries(FAMILLE_DU_TYPE).map(([ty, f]) => `WHEN '${ty}' THEN '${f}'`).join(" ");
  return sql`(CASE ${type} ${sql.raw(cas)} ELSE 'autre' END)`;
}

// ── Calcul d'une semaine ───────────────────────────────────────────────────

/**
 * Chiffres bruts d'une semaine, par campus et par classe (sans rang ni
 * trophée). « jusqua » : la semaine arrêtée à cet instant (actes faits avant,
 * séances commencées avant, inscrits à ce moment), pour comparer une semaine
 * en cours à la précédente prise au même moment.
 */
export async function calculerSemaine(ex: Executeur, lundi: Jour, options: { jusqua?: Date } = {}): Promise<LigneCoupe[]> {
  const debut = debutDeSemaine(lundi);
  const finSemaine = new Date(debut.getTime() + 7 * JOUR_MS);
  const fin = options.jusqua && options.jusqua < finSemaine ? options.jusqua : finSemaine;
  const coupee = fin < finSemaine;
  const semaine = semaineIso(lundi);
  const finSql = sql`${fin.toISOString()}::timestamptz`;
  const avantCoupure = coupee ? sql`AND a.fait_le < ${finSql}` : sql``;
  // Inscrits : étudiants actifs, avec leur classe à la fin de la semaine (passages_classes).
  const ins = sql`SELECT u.id AS uid, u.site_id, h.classe_id FROM campus.utilisateurs u ${sqlClasseA(finSql)}
    WHERE u.role = 'etudiant' AND u.actif AND u.cree_le < ${finSql}`;
  // Requêtes l'une après l'autre : dans une transaction, elles passent par la même connexion.
  const groupes = await ex.execute<{ portee: PorteeCoupe; cible_id: number; inscrits: number; participants: number; assidus: number; points_moyens: number }>(sql`
      WITH ins AS (${ins}),
      act AS (
        SELECT a.utilisateur_id AS uid, sum(a.points)::int AS points, count(DISTINCT a.jour)::int AS jours,
          count(DISTINCT ${sqlFamille(sql`a.type`)})::int AS familles
        FROM campus.activites a WHERE a.semaine = ${semaine} ${avantCoupure} GROUP BY 1
      ),
      par AS (
        SELECT i.site_id, i.classe_id, COALESCE(a.points, 0) AS points, COALESCE(a.jours, 0) AS jours, COALESCE(a.familles, 0) AS familles
        FROM ins i LEFT JOIN act a ON a.uid = i.uid
      )
      SELECT 'campus' AS portee, site_id AS cible_id, count(*)::int AS inscrits,
        count(*) FILTER (WHERE familles >= ${COUPE.famillesParticipation})::int AS participants,
        count(*) FILTER (WHERE jours >= ${COUPE.joursAssidu})::int AS assidus,
        COALESCE(avg(LEAST(points, ${COUPE.plafondPointsEtudiant})), 0)::float8 AS points_moyens
      FROM par WHERE site_id IS NOT NULL GROUP BY site_id
      UNION ALL
      SELECT 'classe', classe_id, count(*)::int,
        count(*) FILTER (WHERE familles >= ${COUPE.famillesParticipation})::int,
        count(*) FILTER (WHERE jours >= ${COUPE.joursAssidu})::int,
        COALESCE(avg(LEAST(points, ${COUPE.plafondPointsEtudiant})), 0)::float8
      FROM par WHERE classe_id IS NOT NULL GROUP BY classe_id`);
  const actes = await ex.execute<{ site_id: number | null; classe_id: number | null; famille: Famille; n: number }>(sql`
      WITH ins AS (${ins})
      SELECT i.site_id, i.classe_id, ${sqlFamille(sql`a.type`)} AS famille, count(*)::int AS n
      FROM campus.activites a JOIN ins i ON i.uid = a.utilisateur_id
      WHERE a.semaine = ${semaine} ${avantCoupure}
      GROUP BY 1, 2, 3`);
  // Présence aux directs : seulement les séances dont la salle du campus est émargée au sens de la
  // décision D1 (sqlSalleEmargee, socle), hors incident de salle ; la règle est évaluée une fois par
  // (séance, campus). Une présence justifiée ou « inconnue » n'entre pas dans le taux.
  const presences = await ex.execute<{ site_id: number | null; classe_id: number | null; g_site: number; presents: number; attendus: number; seances: number }>(sql`
      WITH a AS (${sqlAttendus({ depuis: debut, jusqua: fin, sites: null })}),
      salles AS (
        SELECT x.seance_id, x.site_id FROM (SELECT DISTINCT seance_id, site_id FROM a WHERE site_id IS NOT NULL) x
        WHERE ${sqlSalleEmargee(sql`x.seance_id`, sql`x.site_id`)}
          AND NOT EXISTS (SELECT 1 FROM campus.effectifs_salles e JOIN campus.seances s ON s.id = e.seance_id
            WHERE e.seance_id = x.seance_id AND e.site_id = x.site_id AND ${SQL_INCIDENT_SALLE})
      )
      SELECT a.site_id, a.classe_id, GROUPING(a.site_id)::int AS g_site,
        count(*) FILTER (WHERE a.statut IN ('emarge', 'pointe', 'en_ligne'))::int AS presents,
        count(*)::int AS attendus, count(DISTINCT a.seance_id)::int AS seances
      FROM a JOIN salles sa ON sa.seance_id = a.seance_id AND sa.site_id = a.site_id
      WHERE a.statut NOT IN ('justifie', 'inconnu')
      GROUP BY GROUPING SETS ((a.site_id), (a.classe_id))`);
  const noms = await ex.execute<{ portee: PorteeCoupe; id: number; nom: string; niveau: string | null; ordre: number }>(sql`
      SELECT 'campus' AS portee, id, nom_court AS nom, NULL AS niveau, ordre FROM campus.sites
      UNION ALL SELECT 'classe', id, nom, niveau, 0 FROM campus.classes`);

  const nomDe = new Map(noms.rows.map((n) => [cle(n.portee, n.id), n]));
  const actesDe = new Map<string, Partial<Record<Famille, number>>>();
  const ajouterActes = (k: string, f: Famille, n: number) => {
    const a = actesDe.get(k) ?? {};
    a[f] = (a[f] ?? 0) + n;
    actesDe.set(k, a);
  };
  for (const a of actes.rows) {
    if (a.site_id !== null) ajouterActes(cle("campus", a.site_id), a.famille, a.n);
    if (a.classe_id !== null) ajouterActes(cle("classe", a.classe_id), a.famille, a.n);
  }
  const presenceDe = new Map<string, { presents: number; attendus: number; seances: number }>();
  for (const p of presences.rows) {
    if (p.g_site === 0 && p.site_id !== null) presenceDe.set(cle("campus", p.site_id), p);
    else if (p.g_site === 1 && p.classe_id !== null) presenceDe.set(cle("classe", p.classe_id), p);
  }
  const groupeDe = new Map(groupes.rows.map((g) => [cle(g.portee, g.cible_id), g]));

  // Tous les campus (même sans inscrit : « bientôt »), et les classes qui ont au moins un inscrit.
  const cibles: { portee: PorteeCoupe; id: number }[] = [
    ...noms.rows.filter((n) => n.portee === "campus").sort((a, b) => a.ordre - b.ordre || a.id - b.id).map((n) => ({ portee: "campus" as const, id: n.id })),
    ...groupes.rows.filter((g) => g.portee === "classe" && nomDe.has(cle("classe", g.cible_id))).map((g) => ({ portee: "classe" as const, id: g.cible_id })),
  ];
  return cibles.map(({ portee, id }) => {
    const k = cle(portee, id);
    const g = groupeDe.get(k);
    const n = nomDe.get(k);
    const inscrits = g?.inscrits ?? 0;
    const taux = part(g?.participants ?? 0, inscrits);
    const p = presenceDe.get(k);
    const presence = p && p.attendus > 0 ? part(p.presents, p.attendus) : null;
    // La présence ne peut que faire monter le taux : un campus qui commence à émarger, avec encore peu
    // d'étudiants qui scannent, ne passe jamais derrière celui qui ne fait émarger personne.
    const score = presence === null ? taux : Math.max(taux, (1 - COUPE.poidsPresence) * taux + COUPE.poidsPresence * presence);
    return {
      portee,
      cibleId: id,
      ligue: portee === "campus" ? "campus" : ligueDuNiveau(n?.niveau),
      nom: n?.nom ?? "",
      inscrits,
      participants: g?.participants ?? 0,
      assidus: g?.assidus ?? 0,
      tauxParticipation: arrondi1(taux),
      pointsMoyens: arrondi1(g?.points_moyens ?? 0),
      partAssidus: arrondi1(part(g?.assidus ?? 0, inscrits)),
      presenceDirect: presence === null ? null : arrondi1(presence),
      seancesEmargees: p?.seances ?? 0,
      score: arrondi1(score),
      actes: actesDe.get(k) ?? {},
      progression: null,
      rang: null,
      trophees: [],
    };
  });
}

/** Classée : un campus qui a des inscrits, une classe d'au moins 5 inscrits. */
export const estClassee = (l: Pick<LigneCoupe, "portee" | "inscrits">) => (l.portee === "campus" ? l.inscrits > 0 : l.inscrits >= COUPE.tailleMinClasse);

/**
 * Rangs (par ligue, ex aequo au même rang ; aucun à 0 % : la ligne reste
 * classée, sans être ni « 1er » ni dernier), progression sur les scores
 * « precedents » (semaine précédente, comparable) et trophées (aucun pendant
 * la semaine d'essai).
 */
export function classer(lignes: LigneCoupe[], precedents: Map<string, number>, essai: boolean): LigneCoupe[] {
  const sortie = lignes.map((l) => {
    const avant = precedents.get(cle(l.portee, l.cibleId));
    return { ...l, progression: avant === undefined || !estClassee(l) ? null : arrondi1(l.score - avant), rang: null as number | null, trophees: [] as Trophee[] };
  });
  const parLigue = new Map<string, typeof sortie>();
  for (const l of sortie) if (estClassee(l)) parLigue.set(l.ligue, [...(parLigue.get(l.ligue) ?? []), l]);
  for (const groupe of parLigue.values()) {
    groupe.sort((a, b) => b.score - a.score);
    groupe.forEach((l, i) => (l.rang = l.score <= 0 ? null : i > 0 && groupe[i - 1].score === l.score ? groupe[i - 1].rang : i + 1));
    if (essai) continue;
    const meilleurs = (valeur: (l: LigneCoupe) => number | null, trophee: Trophee) => {
      const valeurs = groupe.map(valeur).filter((v): v is number => v !== null && v > 0);
      if (!valeurs.length) return;
      const max = Math.max(...valeurs);
      for (const l of groupe) if (valeur(l) === max) l.trophees.push(trophee);
    };
    meilleurs((l) => l.score, "participation");
    meilleurs((l) => l.progression, "progression");
    meilleurs((l) => l.presenceDirect, "assiduite");
    for (const l of groupe) if (l.portee === "classe" && l.tauxParticipation >= COUPE.seuilEquipe) l.trophees.push("equipe");
  }
  return sortie;
}

// ── Lecture et écriture ────────────────────────────────────────────────────

type LigneStockee = {
  semaine: string;
  portee: PorteeCoupe;
  cible_id: number;
  ligue: string;
  inscrits: number;
  participants: number;
  taux_participation: number;
  points_moyens: number;
  part_assidus: number;
  progression: number | null;
  presence_direct: number | null;
  seances_emargees: number;
  score: number;
  rang: number | null;
  trophees: Trophee[];
  actes: Partial<Record<Famille, number>>;
  essai: boolean;
  maj_le: Date;
  fige_le: Date | null;
  nom: string | null;
  site_id: number | null;
};

export type ClassementLu = { semaine: SemaineIso; essai: boolean; figee: boolean; majLe: Date | null; lignes: LigneCoupe[] };

/** Classement enregistré d'une semaine, avec les noms des campus et des classes. */
export async function lireClassement(semaine: SemaineIso, ex: Executeur = db): Promise<ClassementLu | null> {
  const r = await ex.execute<LigneStockee>(sql`
    SELECT cs.*, COALESCE(si.nom_court, cl.nom) AS nom, COALESCE(si.id, cl.site_id) AS site_id
    FROM campus.classements_semaine cs
    LEFT JOIN campus.sites si ON cs.portee = 'campus' AND si.id = cs.cible_id
    LEFT JOIN campus.classes cl ON cs.portee = 'classe' AND cl.id = cs.cible_id
    WHERE cs.semaine = ${semaine}
    ORDER BY cs.portee, cs.ligue, cs.rang NULLS LAST, cs.score DESC, COALESCE(si.ordre, 0), cs.cible_id`);
  if (!r.rows.length) return null;
  const lignes: LigneCoupe[] = r.rows.map((l) => ({
    portee: l.portee,
    cibleId: l.cible_id,
    ligue: l.ligue as LigneCoupe["ligue"],
    nom: l.nom ?? "",
    inscrits: l.inscrits,
    participants: l.participants,
    assidus: Math.round((l.part_assidus * l.inscrits) / 100),
    tauxParticipation: l.taux_participation,
    pointsMoyens: l.points_moyens,
    partAssidus: l.part_assidus,
    presenceDirect: l.presence_direct,
    seancesEmargees: l.seances_emargees,
    score: l.score,
    actes: l.actes ?? {},
    progression: l.progression,
    rang: l.rang,
    trophees: l.trophees ?? [],
    siteId: l.site_id,
  }));
  return {
    semaine,
    essai: r.rows.some((l) => l.essai),
    figee: r.rows.every((l) => l.fige_le !== null),
    majLe: r.rows.reduce<Date | null>((m, l) => (!m || l.maj_le > m ? l.maj_le : m), null),
    lignes,
  };
}

/** Scores des lignes classées, pour la progression. */
const scoresDes = (lignes: LigneCoupe[]) => new Map(lignes.filter(estClassee).map((l) => [cle(l.portee, l.cibleId), l.score]));

/** Scores d'une semaine complète, pour la progression : enregistrés, sinon recalculés (sans être écrits). */
async function scoresDe(ex: Executeur, lundi: Jour): Promise<Map<string, number>> {
  const lu = await lireClassement(semaineIso(lundi), ex);
  return scoresDes(lu?.lignes ?? (await calculerSemaine(ex, lundi)));
}

/** Écrit les lignes d'une semaine ; une semaine figée ne bouge plus. Renvoie le nombre de lignes écrites. */
async function ecrire(ex: Executeur, semaine: SemaineIso, lignes: LigneCoupe[], essai: boolean, figer: boolean): Promise<number> {
  const donnees = lignes.map((l) => ({
    semaine,
    portee: l.portee,
    cible_id: l.cibleId,
    ligue: l.ligue,
    inscrits: l.inscrits,
    participants: l.participants,
    taux_participation: l.tauxParticipation,
    points_moyens: l.pointsMoyens,
    part_assidus: l.partAssidus,
    progression: l.progression,
    presence_direct: l.presenceDirect,
    seances_emargees: l.seancesEmargees,
    score: l.score,
    rang: l.rang,
    trophees: l.trophees,
    actes: l.actes,
    essai,
  }));
  const r = await ex.execute(sql`
    INSERT INTO campus.classements_semaine (semaine, portee, cible_id, ligue, inscrits, participants, taux_participation, points_moyens,
      part_assidus, progression, presence_direct, seances_emargees, score, rang, trophees, actes, essai, maj_le, fige_le)
    SELECT x.semaine, x.portee, x.cible_id, x.ligue, x.inscrits, x.participants, x.taux_participation, x.points_moyens,
      x.part_assidus, x.progression, x.presence_direct, x.seances_emargees, x.score, x.rang, x.trophees, x.actes, x.essai, now(),
      ${figer ? sql`now()` : sql`NULL::timestamptz`}
    FROM jsonb_to_recordset(${JSON.stringify(donnees)}::jsonb) AS x(semaine text, portee text, cible_id int, ligue text, inscrits int,
      participants int, taux_participation real, points_moyens real, part_assidus real, progression real, presence_direct real,
      seances_emargees int, score real, rang int, trophees jsonb, actes jsonb, essai boolean)
    ON CONFLICT (semaine, portee, cible_id) DO UPDATE SET ligue = EXCLUDED.ligue, inscrits = EXCLUDED.inscrits,
      participants = EXCLUDED.participants, taux_participation = EXCLUDED.taux_participation, points_moyens = EXCLUDED.points_moyens,
      part_assidus = EXCLUDED.part_assidus, progression = EXCLUDED.progression, presence_direct = EXCLUDED.presence_direct,
      seances_emargees = EXCLUDED.seances_emargees, score = EXCLUDED.score, rang = EXCLUDED.rang, trophees = EXCLUDED.trophees,
      actes = EXCLUDED.actes, essai = EXCLUDED.essai, maj_le = now(), fige_le = EXCLUDED.fige_le
    WHERE campus.classements_semaine.fige_le IS NULL`);
  // Une classe vidée ou supprimée sort du classement de la semaine en cours.
  const gardes = lignes.map((l) => cle(l.portee, l.cibleId));
  await ex.execute(sql`
    DELETE FROM campus.classements_semaine
    WHERE semaine = ${semaine} AND fige_le IS NULL AND NOT (portee || ':' || cible_id = ANY(${`{${gardes.join(",")}}`}::text[]))`);
  return r.rowCount ?? 0;
}

/** Semaine d'essai : elle l'est restée si elle a déjà des lignes ; sinon, c'est la toute première semaine de la Coupe. */
async function estEssai(ex: Executeur, semaine: SemaineIso): Promise<boolean> {
  const r = await ex.execute<{ deja: boolean | null; avant: boolean }>(sql`
    SELECT (SELECT bool_or(essai) FROM campus.classements_semaine WHERE semaine = ${semaine}) AS deja,
      EXISTS (SELECT 1 FROM campus.classements_semaine WHERE semaine < ${semaine}) AS avant`);
  const l = r.rows[0];
  return l?.deja ?? !l?.avant;
}

type SemaineFigee = { semaine: SemaineIso; lundi: Jour; essai: boolean; lignes: LigneCoupe[] };

/** Fige une semaine terminée et close (une seule fois) : dernier calcul, rangs et trophées définitifs. */
async function figer(ex: Executeur, lundi: Jour): Promise<SemaineFigee | null> {
  const semaine = semaineIso(lundi);
  const deja = await ex.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM campus.classements_semaine WHERE semaine = ${semaine} AND fige_le IS NOT NULL`);
  if ((deja.rows[0]?.n ?? 0) > 0) return null;
  const essai = await estEssai(ex, semaine);
  const lignes = classer(await calculerSemaine(ex, lundi), await scoresDe(ex, ajouterJours(lundi, -7)), essai);
  await ecrire(ex, semaine, lignes, essai, true);
  return { semaine, lundi, essai, lignes };
}

export type BilanCoupe = { semaine: SemaineIso; essai: boolean; figees: SemaineFigee[] };

/**
 * Passage de la Coupe : fige les semaines terminées et closes qui ne le sont
 * pas encore (et comble au plus 8 semaines manquées si le campus était
 * arrêté), recalcule la semaine précédente tant qu'elle est en clôture (lundi
 * et mardi), puis la semaine en cours. Les trophées des semaines figées sont
 * annoncés une fois la transaction validée : une semaine ne se fige qu'une
 * fois, ses trophées ne s'annoncent qu'une fois.
 */
export async function passerCoupe(maintenant = new Date(), options: { annoncer?: boolean } = {}): Promise<BilanCoupe> {
  const lundi = lundiEnCours(maintenant);
  const semaine = semaineIso(lundi);
  const lundiPrecedent = ajouterJours(lundi, -7);
  const cloture = semainePrecedenteEnCloture(maintenant);
  // Avant de figer : un passage du registre qui couvre la semaine précédente, pour que tous ses actes
  // reçus (révisions faites hors ligne comprises) y soient, sans attendre le passage des 5 minutes.
  const aFiger = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM campus.classements_semaine WHERE semaine < ${semaineIso(cloture ? lundiPrecedent : lundi)} AND fige_le IS NULL`);
  if ((aFiger.rows[0]?.n ?? 0) > 0) await passerRegistre({ depuis: debutDeSemaine(lundiPrecedent) });
  const bilan = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${VERROU_COUPE})`);
    const figees: SemaineFigee[] = [];
    const existantes = await tx.execute<{ semaine: string; ouverte: boolean }>(sql`
      SELECT semaine, bool_or(fige_le IS NULL) AS ouverte FROM campus.classements_semaine WHERE semaine < ${semaine} GROUP BY semaine`);
    if (existantes.rows.length) {
      const ouvertes = new Set(existantes.rows.filter((l) => l.ouverte).map((l) => l.semaine));
      const connues = new Set(existantes.rows.map((l) => l.semaine));
      const premiere = [...connues].sort()[0];
      for (let i: number = COUPE.semainesHistorique; i >= 1; i--) {
        const l = ajouterJours(lundi, -7 * i);
        const s = semaineIso(l);
        // Une semaine ouverte, ou une semaine manquée après le début de la Coupe.
        if (!ouvertes.has(s) && (connues.has(s) || s <= premiere)) continue;
        if (i === 1 && cloture) {
          // Semaine tout juste terminée, encore en clôture : recalculée (rien n'est annoncé), figée mercredi.
          const essaiPrecedent = await estEssai(tx, s);
          await ecrire(tx, s, classer(await calculerSemaine(tx, l), await scoresDe(tx, ajouterJours(l, -7)), essaiPrecedent), essaiPrecedent, false);
          continue;
        }
        const f = await figer(tx, l);
        if (f) figees.push(f);
      }
      // Semaine ouverte plus ancienne que la fenêtre (campus arrêté très longtemps) : figée telle quelle.
      for (const s of ouvertes) if (s < semaineIso(ajouterJours(lundi, -7 * COUPE.semainesHistorique)))
        await tx.execute(sql`UPDATE campus.classements_semaine SET fige_le = now(), trophees = '[]'::jsonb WHERE semaine = ${s} AND fige_le IS NULL`);
    }
    const essai = await estEssai(tx, semaine);
    // Semaine entamée : sa progression se compare à la semaine précédente prise au même moment (un
    // mardi midi contre un mardi midi), pas à une semaine complète. Le trophée « Progression » définitif
    // compare deux semaines complètes (figer).
    const auMemeMoment = await calculerSemaine(tx, lundiPrecedent, { jusqua: new Date(maintenant.getTime() - 7 * JOUR_MS) });
    const lignes = classer(await calculerSemaine(tx, lundi), scoresDes(auMemeMoment), essai);
    await ecrire(tx, semaine, lignes, essai, false);
    return { semaine, essai, figees };
  });
  if (options.annoncer !== false) for (const f of bilan.figees) if (!f.essai) await annoncerTrophees(f).catch((e) => console.error("[coupe] annonce :", (e as Error).message));
  return bilan;
}

/** La cloche annonce les trophées aux étudiants des classes et des campus primés (sans rappel sur le téléphone). */
async function annoncerTrophees(f: SemaineFigee): Promise<number> {
  const primes = f.lignes.filter((l) => l.trophees.length);
  if (!primes.length) return 0;
  const sites = primes.filter((l) => l.portee === "campus");
  const classes = primes.filter((l) => l.portee === "classe");
  const ids = (ls: LigneCoupe[]) => `{${ls.map((l) => l.cibleId).join(",")}}`;
  const r = await db.execute<{ id: number; site_id: number | null; classe_id: number | null }>(sql`
    SELECT id, site_id, classe_id FROM campus.utilisateurs
    WHERE role = 'etudiant' AND actif AND (site_id = ANY(${ids(sites)}::int[]) OR classe_id = ANY(${ids(classes)}::int[]))`);
  const numero = Number(f.semaine.slice(-2));
  const libelles = (ts: Trophee[]) => ts.map((x) => t(`trophee.${x}`, { registre: "tu" })).join(", ");
  // Un message par combinaison (classe, campus) : les étudiants qui partagent la même reçoivent le même texte.
  const groupes = new Map<string, { ids: number[]; corps: string }>();
  for (const e of r.rows) {
    const classe = classes.find((c) => c.cibleId === e.classe_id);
    const campus = sites.find((s) => s.cibleId === e.site_id);
    const morceaux: string[] = [];
    if (classe) morceaux.push(t("notif.classe", { registre: "tu", v: { classe: classe.nom, trophees: libelles(classe.trophees) } }));
    if (campus) morceaux.push(t("notif.campus", { registre: "tu", v: { campus: campus.nom, trophees: libelles(campus.trophees) } }));
    if (!morceaux.length) continue;
    const corps = `${morceaux.join(" ")} ${t("notif.merci", { registre: "tu" })}`;
    const g = groupes.get(corps) ?? { ids: [], corps };
    g.ids.push(e.id);
    groupes.set(corps, g);
  }
  for (const g of groupes.values())
    await notifier(g.ids, { type: "systeme", titre: t("notif.titre", { registre: "tu", v: { n: numero } }), corps: g.corps, lien: "/coupe", push: false, priorite: "engagement" });
  return r.rows.length;
}

// ── Tâche planifiée ────────────────────────────────────────────────────────

/** Bilans des semaines terminées (séries) pour tous les étudiants, puis badges des séries. */
async function bilansDesSemaines(maintenant: Date) {
  const r = await db.execute<{ id: number }>(sql`SELECT id FROM campus.utilisateurs WHERE role = 'etudiant' AND actif`);
  const { juges } = await mettreAJourSemaines(r.rows.map((l) => l.id), maintenant);
  if (juges.length) await attribuerBadges(juges);
}

let dernierPassage = 0;
let derniereSemaine: SemaineIso | null = null;

// Toutes les 15 minutes, une fois le registre rattrapé depuis la rentrée (sinon
// une semaine pourrait être figée avant que tous ses actes soient inscrits) ;
// tout de suite après ce rattrapage, et dès 0 h le lundi (la semaine bascule).
// La semaine précédente est figée au premier passage après le mercredi 1 h,
// et les séries jugées dans la foulée (bilansDesSemaines, même délai).
planifier("progression-coupe", 60_000, async () => {
  if (!rattrapageTermine()) return;
  const maintenant = new Date();
  const semaine = semaineIso(lundiEnCours(maintenant));
  if (semaine === derniereSemaine && Date.now() - dernierPassage < 15 * 60_000) return;
  await passerCoupe(maintenant);
  dernierPassage = Date.now();
  derniereSemaine = semaine;
  await bilansDesSemaines(maintenant);
});
