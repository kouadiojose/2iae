// Règle « devoir proposable » : ce que l'objectif du jour (C2) et les rappels
// d'engagement (C3, C4) ont le droit de POUSSER vers un étudiant.
//
// Un devoir créé par la routine du soir (son identifiant figure dans
// devoirs_seances.devoir_ids, voir devoirs-auto.ts) n'a été relu par personne :
// il n'est proposé qu'une fois publié et créé depuis plus de 24 h, le temps
// que le formateur le voie. Un devoir écrit par un formateur est toujours
// proposable. La règle ne retire rien de la page « Devoirs » : elle ne règle
// que ce que le campus met en avant.
//
// Seul C7 modifie ce fichier ensuite (validation du formateur).
import { sql, type SQL } from "drizzle-orm";

/** Délai avant de proposer un devoir automatique que personne n'a validé. */
export const DELAI_DEVOIR_AUTO_HEURES = 24;
/**
 * Question 1 pour José. Vrai : seuls les devoirs automatiques validés par le
 * formateur seraient proposés (aucun tant que la validation de C7 n'existe pas).
 */
export const VALIDATION_OBLIGATOIRE = false;

/**
 * Condition SQL « le devoir peut être proposé », pour un WHERE où « alias »
 * désigne campus.devoirs (ex. sqlDevoirProposable("d")). Elle ne regarde ni
 * l'ouverture, ni l'échéance, ni le rendu : le chantier appelant s'en charge.
 */
export function sqlDevoirProposable(alias: string): SQL {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`sqlDevoirProposable : alias SQL invalide « ${alias} »`);
  const d = sql.raw(alias);
  const automatique = sql`EXISTS (SELECT 1 FROM campus.devoirs_seances ds WHERE ds.devoir_ids @> jsonb_build_array(${d}.id))`;
  const automatiqueProposable = VALIDATION_OBLIGATOIRE
    ? sql`false`
    : sql`(${d}.publie AND ${d}.cree_le <= now() - make_interval(hours => ${sql.raw(String(DELAI_DEVOIR_AUTO_HEURES))}))`;
  return sql`(NOT ${automatique} OR ${automatiqueProposable})`;
}
