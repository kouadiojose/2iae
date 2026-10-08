// Présence d'un étudiant à un direct, en TROIS états (amendement de José du
// 8 octobre 2026, campus/ENGAGEMENT.md). Les étudiants suivent le cours
// ensemble dans la salle de conférence de leur campus, et personne ne les
// émarge encore : ne pas être compté ne prouve pas qu'on était absent.
//
//   present  : émargé en salle (QR ou code), pointé présent par le responsable
//              de salle, ou suivi en ligne jusqu'au seuil (70 % de la durée de
//              référence, même calcul que le live et le pilotage) ;
//   absent   : pas compté, alors que la présence était vérifiable : la salle
//              de son campus a été émargée pour cette séance (au moins un
//              émargé ou un pointage), il a été pointé absent, son absence est
//              justifiée, ou il n'a pas de campus (il ne peut suivre qu'en ligne) ;
//   inconnu  : aucun émargement dans la salle de son campus, un incident de
//              cette salle, ou une séance pas encore tenue. Quelques minutes en
//              ligne sans atteindre le seuil n'y changent rien : il a pu ouvrir
//              le direct sur son téléphone depuis la salle.
//
// « inconnu » ne compte JAMAIS comme une absence : ni rattrapage « tu as
// manqué », ni relance, ni « à contacter », ni perte de points ou de série.
// Savoir si l'étudiant était attendu à la séance reste l'affaire de
// l'appelant (sqlAttendus, etudiantsAttendusSeance) : ici, seulement son état.
//
// La règle est écrite UNE fois, en SQL (sqlEtatPresence) ; etatPresence et
// etatsPresence l'exécutent pour une séance. Tous les chantiers s'en servent.
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { SQL_DUREE_REFERENCE, SQL_INCIDENT_SALLE } from "../routes/admin";
import { SEUIL_PRESENCE_EN_LIGNE } from "@shared/schema";

export type EtatPresence = "present" | "absent" | "inconnu";
export const ETATS_PRESENCE: readonly EtatPresence[] = ["present", "absent", "inconnu"];

/**
 * La salle de ce campus a-t-elle été émargée pour cette séance ? Au moins un
 * étudiant émargé (QR ou code, même venu d'un autre campus) ou pointé par le
 * responsable de salle, présent ou absent. Une absence justifiée par la vie
 * scolaire ne dit rien de la salle. Arguments : expressions SQL (sql`s.id`).
 * Sert aussi à l'indicateur « séances émargées par campus ».
 */
export function sqlSalleEmargee(seanceId: SQL, siteId: SQL): SQL {
  return sql`EXISTS (SELECT 1 FROM campus.presences pe
    WHERE pe.seance_id = ${seanceId} AND pe.site_id = ${siteId}
      AND (pe.mode = 'salle' OR (pe.pointe_par_id IS NOT NULL AND NULLIF(pe.justification, '') IS NULL)))`;
}

/**
 * État de présence ('present' | 'absent' | 'inconnu', colonne text) de
 * l'étudiant à la séance, pour les calculs en masse :
 *   SELECT …, ${sqlEtatPresence(sql`s.id`, sql`u.id`)} AS etat FROM …
 * Les arguments sont évalués dans la requête de l'appelant (ses alias restent
 * valables) ; la sous-requête lit presences, effectifs_salles et seances par
 * leurs clés. NULL si la séance ou l'étudiant n'existe pas.
 */
export function sqlEtatPresence(seanceId: SQL, etudiantId: SQL): SQL {
  return sql`(SELECT CASE
      WHEN s.demarree_le IS NULL THEN 'inconnu'
      WHEN NULLIF(p.justification, '') IS NOT NULL THEN 'absent'
      WHEN p.mode = 'salle' THEN 'present'
      WHEN p.minutes >= GREATEST(1, ceil((${SQL_DUREE_REFERENCE})::float8 * ${SEUIL_PRESENCE_EN_LIGNE}::float8))::int THEN 'present'
      WHEN p.pointe_par_id IS NOT NULL THEN 'absent'
      WHEN u.site_id IS NULL THEN 'absent'
      WHEN ${SQL_INCIDENT_SALLE} THEN 'inconnu'
      WHEN ${sqlSalleEmargee(sql`s.id`, sql`u.site_id`)} THEN 'absent'
      ELSE 'inconnu'
    END
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
  const r = await db.execute<{ uid: number; etat: EtatPresence | null }>(
    sql`SELECT x.uid, ${sqlEtatPresence(sql`${Math.trunc(seanceId)}::int`, sql`x.uid`)} AS etat
        FROM unnest(${`{${ids.join(",")}}`}::int[]) AS x(uid)`,
  );
  for (const l of r.rows) etats.set(l.uid, l.etat ?? "inconnu");
  return etats;
}

/** État de présence d'un étudiant à une séance. */
export async function etatPresence(seanceId: number, etudiantId: number): Promise<EtatPresence> {
  return (await etatsPresence(seanceId, [etudiantId])).get(Math.trunc(etudiantId)) ?? "inconnu";
}
