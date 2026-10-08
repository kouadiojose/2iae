// Présence d'un étudiant à un direct, en TROIS états (amendement de José du
// 8 octobre 2026, campus/ENGAGEMENT.md). Les étudiants suivent le cours
// ensemble dans la salle de conférence de leur campus, et personne ne les
// émarge encore : ne pas être compté ne prouve pas qu'on était absent.
//
//   present  : émargé en salle (QR ou code), pointé présent par le responsable
//              de salle, ou suivi en ligne jusqu'au seuil (70 % de la durée de
//              référence, même calcul que le live et le pilotage) ;
//   absent   : pas compté, alors que la présence était vérifiable : la salle
//              de son campus a été émargée pour cette séance (règle ci-dessous),
//              il a été pointé absent, son absence est justifiée, ou il n'a pas
//              de campus (il ne peut suivre qu'en ligne) ;
//   inconnu  : salle de son campus non émargée, incident de cette salle, ou
//              séance pas encore tenue. Quelques minutes en ligne sans
//              atteindre le seuil n'y changent rien : il a pu ouvrir le direct
//              sur son téléphone depuis la salle.
//
// Salle émargée (décision de José, D1) : la salle d'un campus ne compte comme
// émargée pour une séance que si AU MOINS 3 étudiants de ce campus y ont émargé
// (QR, code, ou pointés présents par le personnel) ET au moins 25 % des
// étudiants de ce campus attendus à la séance. Un seul scan, ou une poignée
// d'étudiants sur toute une promotion, ne suffit pas : les autres restent
// « inconnu », jamais « absent ».
//
// « inconnu » ne compte JAMAIS comme une absence : ni rattrapage « tu as
// manqué », ni relance, ni « à contacter », ni perte de points ou de série.
// Savoir si l'étudiant était attendu à la séance reste l'affaire de
// l'appelant (sqlAttendus, etudiantsAttendusSeance) : ici, seulement son état.
//
// La règle est écrite UNE fois, en SQL : sqlCaseEtat (les trois états) et
// sqlRegleSalleEmargee (D1). sqlEtatPresence et sqlSalleEmargee les appliquent
// à une séance et un étudiant (ou un campus) ; sqlAttendus (admin.ts) les
// applique en masse, la salle émargée étant comptée une fois par (séance,
// campus). etatPresence et etatsPresence les exécutent pour une séance.
// Tous les chantiers s'en servent et n'en écrivent aucune copie.
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { SQL_DUREE_REFERENCE, SQL_INCIDENT_SALLE, sqlAttenduAuCours, sqlCandidatsDuCours, sqlClasseA } from "../routes/admin";
import { SEUIL_PRESENCE_EN_LIGNE } from "@shared/schema";

export type EtatPresence = "present" | "absent" | "inconnu";
export const ETATS_PRESENCE: readonly EtatPresence[] = ["present", "absent", "inconnu"];

/** D1 : une salle n'est émargée qu'avec au moins 3 émargés de son campus… */
export const SALLE_EMARGES_MINIMUM = 3;
/** … représentant au moins 25 % des étudiants de ce campus attendus à la séance. */
export const SALLE_PART_MINIMUM = 0.25;

/**
 * Règle D1 à partir des deux nombres (expressions SQL entières) : vrai si
 * emarges ≥ 3 et emarges ≥ 25 % de attendus.
 */
export function sqlRegleSalleEmargee(emarges: SQL, attendus: SQL): SQL {
  return sql`(${emarges} >= ${sql.raw(String(SALLE_EMARGES_MINIMUM))}
    AND (${emarges})::float8 >= ${sql.raw(String(SALLE_PART_MINIMUM))}::float8 * (${attendus})::float8)`;
}

/**
 * La ligne de présence « p » de l'étudiant « u » compte comme un émargement
 * de la salle de SON campus : émargé (QR ou code) ou pointé présent dans la
 * salle de son campus, sans absence justifiée. Un émargement dans la salle
 * d'un autre campus le rend présent, mais ne dit rien de la salle du sien.
 * Arguments : alias SQL des tables presences et utilisateurs.
 */
export function sqlEmargeDansSaSalle(p: string, u: string): SQL {
  if (![p, u].every((a) => /^[a-z_][a-z0-9_]*$/i.test(a))) throw new Error("sqlEmargeDansSaSalle : alias SQL invalide");
  const [pp, uu] = [sql.raw(p), sql.raw(u)];
  return sql`(${pp}.mode = 'salle' AND ${pp}.site_id = ${uu}.site_id AND NULLIF(${pp}.justification, '') IS NULL)`;
}

/**
 * La salle de ce campus a-t-elle été émargée pour cette séance (règle D1) ?
 * Émargés : étudiants de ce campus attendus à la séance et émargés dans sa
 * salle (QR, code ou pointés présents). Attendus : même règle que
 * sqlAttendus (classe d'alors qui suit le cours, ou inscription au cours ;
 * compte actif créé avant la fin de la séance). Arguments : expressions SQL
 * (sql`s.id`, sql`u.site_id`), évaluées dans la requête de l'appelant.
 * Faux sans campus, NULL si la séance n'existe pas. Le dénombrement des
 * attendus n'est fait que si la salle compte déjà au moins 3 émargés de son
 * campus. Pour un grand nombre de lignes, préférer la colonne salle_emargee
 * de sqlAttendus (comptée une fois par séance et campus).
 * Sert aussi à l'indicateur « séances émargées par campus ».
 */
export function sqlSalleEmargee(seanceId: SQL, siteId: SQL): SQL {
  // Les arguments sont lus d'abord (sous-requête arg sans FROM) : les alias internes ne peuvent pas les masquer.
  return sql`(SELECT CASE
      WHEN sx.site_id IS NULL THEN false
      WHEN (SELECT count(*) FROM campus.presences pe JOIN campus.utilisateurs ue ON ue.id = pe.utilisateur_id
          WHERE pe.seance_id = sx.seance_id AND ue.site_id = sx.site_id AND ${sqlEmargeDansSaSalle("pe", "ue")})
        < ${sql.raw(String(SALLE_EMARGES_MINIMUM))} THEN false
      ELSE (
        SELECT ${sqlRegleSalleEmargee(sql`count(*) FILTER (WHERE ${sqlEmargeDansSaSalle("p", "u")})`, sql`count(*)`)}
        FROM (${sqlCandidatsDuCours(sql`sx.cours_id`)}) cand
        JOIN campus.utilisateurs u ON u.id = cand.uid
        ${sqlClasseA(sql`sx.fin`)}
        LEFT JOIN campus.presences p ON p.seance_id = sx.seance_id AND p.utilisateur_id = u.id
        WHERE u.role = 'etudiant' AND u.actif AND u.site_id = sx.site_id AND u.cree_le <= sx.fin
          AND ${sqlAttenduAuCours(sql`sx.cours_id`, sql`sx.fin`)})
    END
    FROM (
      SELECT arg.seance_id, arg.site_id, sse.cours_id,
        COALESCE(sse.demarree_le, sse.debut) + make_interval(mins => sse.duree_minutes) AS fin
      FROM (SELECT (${seanceId})::int AS seance_id, (${siteId})::int AS site_id) arg
      JOIN campus.seances sse ON sse.id = arg.seance_id
    ) sx)`;
}

/** Ce que la règle des trois états lit d'une ligne (séance, étudiant), en expressions SQL booléennes. */
export type ColonnesEtat = {
  /** La séance a été démarrée (demarree_le renseigné). */
  tenue: SQL;
  /** Absence justifiée par la vie scolaire. */
  justifiee: SQL;
  /** Émargé en salle (QR, code) ou pointé présent : mode 'salle'. */
  enSalle: SQL;
  /** En ligne jusqu'au seuil de 70 % de la durée de référence. */
  auSeuil: SQL;
  /** Pointé par le responsable de salle (et ni en salle ni au seuil : pointé absent). */
  pointe: SQL;
  /** L'étudiant n'a pas de campus. */
  sansCampus: SQL;
  /** Incident de la salle de son campus pendant la séance. */
  incident: SQL;
  /** La salle de son campus a été émargée (règle D1). */
  salleEmargee: SQL;
};

/**
 * LA règle des trois états, dans cet ordre (ENGAGEMENT.md § 1), à partir de
 * colonnes déjà lues. Une condition NULL (pas de ligne de présence) ne
 * s'applique pas.
 */
export function sqlCaseEtat(c: ColonnesEtat): SQL {
  return sql`(CASE
      WHEN ${c.tenue} IS NOT TRUE THEN 'inconnu'
      WHEN ${c.justifiee} THEN 'absent'
      WHEN ${c.enSalle} THEN 'present'
      WHEN ${c.auSeuil} THEN 'present'
      WHEN ${c.pointe} THEN 'absent'
      WHEN ${c.sansCampus} THEN 'absent'
      WHEN ${c.incident} THEN 'inconnu'
      WHEN ${c.salleEmargee} THEN 'absent'
      ELSE 'inconnu'
    END)`;
}

/** Minutes en ligne à atteindre (alias « s » = campus.seances), même calcul que le live. */
export const sqlSeuilMinutes = () => sql`GREATEST(1, ceil((${SQL_DUREE_REFERENCE})::float8 * ${SEUIL_PRESENCE_EN_LIGNE}::float8))::int`;

/** Fonction qui dit si la salle (séance, campus) a été émargée : sqlSalleEmargee par défaut. */
export type SalleEmargee = (seanceId: SQL, siteId: SQL) => SQL;

/**
 * État de présence ('present' | 'absent' | 'inconnu', colonne text) de
 * l'étudiant à la séance, pour les calculs en masse :
 *   SELECT …, ${sqlEtatPresence(sql`s.id`, sql`u.id`)} AS etat FROM …
 * Les arguments sont évalués dans la requête de l'appelant (ses alias restent
 * valables) ; la sous-requête lit presences, effectifs_salles et seances par
 * leurs clés. NULL si la séance ou l'étudiant n'existe pas.
 * salleEmargee : pour lire une salle émargée déjà calculée (etatsPresence).
 */
export function sqlEtatPresence(seanceId: SQL, etudiantId: SQL, salleEmargee: SalleEmargee = sqlSalleEmargee): SQL {
  return sql`(SELECT ${sqlCaseEtat({
    tenue: sql`s.demarree_le IS NOT NULL`,
    justifiee: sql`NULLIF(p.justification, '') IS NOT NULL`,
    enSalle: sql`p.mode = 'salle'`,
    auSeuil: sql`p.minutes >= ${sqlSeuilMinutes()}`,
    pointe: sql`p.pointe_par_id IS NOT NULL`,
    sansCampus: sql`u.site_id IS NULL`,
    incident: SQL_INCIDENT_SALLE,
    salleEmargee: salleEmargee(sql`s.id`, sql`u.site_id`),
  })}
    FROM (SELECT ${seanceId} AS seance_id, ${etudiantId} AS etudiant_id) arg
    JOIN campus.seances s ON s.id = arg.seance_id
    JOIN campus.utilisateurs u ON u.id = arg.etudiant_id
    LEFT JOIN campus.presences p ON p.seance_id = s.id AND p.utilisateur_id = u.id
    LEFT JOIN campus.effectifs_salles e ON e.seance_id = s.id AND e.site_id = u.site_id)`;
}

/** États de présence de plusieurs étudiants à une séance ; « inconnu » pour un identifiant introuvable. */
export async function etatsPresence(seanceId: number, etudiantIds: number[]): Promise<Map<number, EtatPresence>> {
  const ids = [...new Set(etudiantIds.map((i) => Math.trunc(i)))].filter((i) => i > 0);
  const etats = new Map<number, EtatPresence>(ids.map((id) => [id, "inconnu"]));
  if (!ids.length) return etats;
  const seance = sql`${Math.trunc(seanceId)}::int`;
  const tableau = sql`${`{${ids.join(",")}}`}::int[]`;
  // La salle de chaque campus n'est évaluée qu'une fois, pas une fois par étudiant.
  const r = await db.execute<{ uid: number; etat: EtatPresence | null }>(sql`
    WITH salles AS MATERIALIZED (
      SELECT c.site_id, ${sqlSalleEmargee(seance, sql`c.site_id`)} AS emargee
      FROM (SELECT DISTINCT site_id FROM campus.utilisateurs WHERE id = ANY(${tableau}) AND site_id IS NOT NULL) c)
    SELECT x.uid, ${sqlEtatPresence(seance, sql`x.uid`, (_s, site) => sql`(SELECT sa.emargee FROM salles sa WHERE sa.site_id = ${site})`)} AS etat
    FROM unnest(${tableau}) AS x(uid)`);
  for (const l of r.rows) etats.set(l.uid, l.etat ?? "inconnu");
  return etats;
}

/** État de présence d'un étudiant à une séance. */
export async function etatPresence(seanceId: number, etudiantId: number): Promise<EtatPresence> {
  return (await etatsPresence(seanceId, [etudiantId])).get(Math.trunc(etudiantId)) ?? "inconnu";
}
