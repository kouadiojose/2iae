// Règle « devoir proposable » : ce que l'objectif du jour (C2) et les rappels
// d'engagement (C3, C4) ont le droit de POUSSER vers un étudiant.
//
// Un devoir créé par la routine du soir (son identifiant figure dans
// devoirs_seances.devoir_ids, voir devoirs-auto.ts) arrive aux étudiants SANS
// action du formateur (amendement de José du 8 octobre 2026) : il est proposé
// une fois publié et créé depuis 8 h (le lendemain matin). Le formateur peut,
// s'il le veut, le relire (chantier C7, validations_devoirs_auto) :
//   - « valide »   : proposé tout de suite ;
//   - « a_revoir » : jamais proposé (il reste visible dans « Devoirs ») ;
//   - sans décision : la règle du délai.
// Un devoir écrit par un formateur est toujours proposable. La règle ne retire
// rien de la page « Devoirs » : elle ne règle que ce que le campus met en avant.
//
// Seul C7 modifie ce fichier.
import { sql, type SQL } from "drizzle-orm";

/**
 * Délai avant de proposer un devoir automatique que personne n'a validé. La routine du soir les crée vers 21 h :
 * 8 h plus tard, ils arrivent aux étudiants le lendemain matin (les formateurs ne les relisent pas : choix de José).
 */
export const DELAI_DEVOIR_AUTO_HEURES = 8;
/**
 * Question 1 pour José. Vrai : seuls les devoirs automatiques validés par le
 * formateur seraient proposés. José a répondu non (8 octobre 2026) : la
 * relecture reste facultative.
 */
export const VALIDATION_OBLIGATOIRE = false;

function aliasSql(alias: string, fonction: string): SQL {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`${fonction} : alias SQL invalide « ${alias} »`);
  return sql.raw(alias);
}

/**
 * Condition SQL « le devoir a été créé par la routine du soir » (son identifiant
 * figure dans devoirs_seances.devoir_ids), pour un WHERE où « alias » désigne
 * campus.devoirs. Décision D2 (revue de l'engagement) : les copies de ces
 * exercices ne relancent jamais le formateur et ne comptent pas dans ses
 * retards ; il peut les corriger s'il le souhaite (correction facultative).
 */
export function sqlDevoirAutomatique(alias: string): SQL {
  const d = aliasSql(alias, "sqlDevoirAutomatique");
  return sql`EXISTS (SELECT 1 FROM campus.devoirs_seances ds WHERE ds.devoir_ids @> jsonb_build_array(${d}.id))`;
}

/**
 * Condition SQL « le devoir peut être proposé », pour un WHERE où « alias »
 * désigne campus.devoirs (ex. sqlDevoirProposable("d")). Elle ne regarde ni
 * l'ouverture, ni l'échéance, ni le rendu : le chantier appelant s'en charge.
 * Lectures par clé primaire (validations_devoirs_auto) ; devoirs_seances compte
 * une ligne par séance enregistrée.
 */
export function sqlDevoirProposable(alias: string): SQL {
  const d = aliasSql(alias, "sqlDevoirProposable");
  const automatique = sqlDevoirAutomatique(alias);
  const decision = sql`(SELECT v.statut FROM campus.validations_devoirs_auto v WHERE v.devoir_id = ${d}.id)`;
  const delaiEcoule = sql`${d}.cree_le <= now() - make_interval(hours => ${sql.raw(String(DELAI_DEVOIR_AUTO_HEURES))})`;
  const automatiqueProposable = VALIDATION_OBLIGATOIRE
    ? sql`(${d}.publie AND ${decision} IS NOT DISTINCT FROM 'valide')`
    : sql`(${d}.publie AND CASE ${decision} WHEN 'valide' THEN true WHEN 'a_revoir' THEN false ELSE ${delaiEcoule} END)`;
  return sql`(NOT ${automatique} OR ${automatiqueProposable})`;
}
