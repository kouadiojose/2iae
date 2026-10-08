// Présence d'une table du schéma « campus ». Les chantiers du plan
// d'engagement ne se lisent qu'à travers la base : une table d'un autre
// chantier se lit en SQL après tableExiste('nom'), et son bloc est masqué (ou
// « pas encore mesuré ») tant qu'elle n'existe pas (campus/ENGAGEMENT.md).
//
// La réponse est gardée 10 minutes : une nouvelle table n'arrive qu'avec une
// migration, et les migrations passent au démarrage, avant le serveur.
import { sql } from "drizzle-orm";
import { db } from "../db";

const DUREE_MS = 10 * 60_000;
const memoire = new Map<string, { existe: boolean; le: number }>();

/** Vrai si la table campus.<nom> existe (nom sans schéma, ex. « cartes_revision »). */
export async function tableExiste(nom: string): Promise<boolean> {
  if (!/^[a-z_][a-z0-9_]*$/.test(nom)) throw new Error(`tableExiste : nom de table invalide « ${nom} »`);
  const connu = memoire.get(nom);
  if (connu && Date.now() - connu.le < DUREE_MS) return connu.existe;
  const r = await db.execute<{ table: string | null }>(sql`SELECT to_regclass(${`campus.${nom}`}::text)::text AS "table"`);
  const existe = Boolean(r.rows[0]?.table);
  memoire.set(nom, { existe, le: Date.now() });
  return existe;
}
