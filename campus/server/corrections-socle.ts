// Socle de la correction automatique des copies (décision de José du 8 octobre 2026) : ce que partagent le
// circuit des corrigés (server/corriges.ts) et le moteur de correction (server/correction-auto.ts).
// Règles et constantes : shared/engagement/corrections.ts. Tables : shared/schema/corrections.ts.
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { correctionsAuto, corrigesDevoirs, type CorrigeDevoir } from "@shared/schema";
import { DELAI_VALIDATION_CORRIGE_HEURES, HEURE_DEBUT_DELAI, HEURE_FIN_JOURNEE, STATUTS_CORRIGE_UTILISABLES } from "@shared/engagement/corrections";

const HEURE_MS = 3600_000;

/**
 * Heure à laquelle un corrigé proposé à « proposeLe » est tenu pour bon sans réponse du formateur.
 * Abidjan est à GMT toute l'année : l'heure locale est l'heure UTC. Proposé la nuit (après 20 h ou avant 7 h),
 * le délai ne part qu'à 7 h : le formateur a toujours une journée entière pour répondre.
 */
export function echeanceValidation(proposeLe: Date): Date {
  const depart = new Date(proposeLe);
  const h = depart.getUTCHours();
  if (h >= HEURE_FIN_JOURNEE || h < HEURE_DEBUT_DELAI) {
    if (h >= HEURE_FIN_JOURNEE) depart.setUTCDate(depart.getUTCDate() + 1);
    depart.setUTCHours(HEURE_DEBUT_DELAI, 0, 0, 0);
  }
  return new Date(depart.getTime() + DELAI_VALIDATION_CORRIGE_HEURES * HEURE_MS);
}

/** Le corrigé d'un devoir (n'importe quel statut), ou null. */
export async function lireCorrige(devoirId: number): Promise<CorrigeDevoir | null> {
  const [c] = await db.select().from(corrigesDevoirs).where(eq(corrigesDevoirs.devoirId, devoirId));
  return c ?? null;
}

/** Corrigé qui sert de barème (validé par le formateur, ou tacite) ; null tant qu'il n'y en a pas. */
export async function corrigeUtilisable(devoirId: number): Promise<{ contenu: string; version: number; statut: CorrigeDevoir["statut"] } | null> {
  const c = await lireCorrige(devoirId);
  return c && STATUTS_CORRIGE_UTILISABLES.includes(c.statut) ? { contenu: c.contenu, version: c.version, statut: c.statut } : null;
}

/** Expression SQL : le devoir (alias de campus.devoirs) a un corrigé qui sert de barème. */
export function sqlCorrigeUtilisable(alias: string): SQL {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`sqlCorrigeUtilisable : alias SQL invalide « ${alias} »`);
  const d = sql.raw(alias);
  return sql`EXISTS (SELECT 1 FROM campus.corriges_devoirs cdu WHERE cdu.devoir_id = ${d}.id AND cdu.statut IN ('valide', 'tacite'))`;
}

/** Expression SQL : le devoir (alias de campus.devoirs) est corrigé par le campus (il a une ligne de corrigé). */
export function sqlCorrigeParLeCampus(alias: string): SQL {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`sqlCorrigeParLeCampus : alias SQL invalide « ${alias} »`);
  const d = sql.raw(alias);
  return sql`EXISTS (SELECT 1 FROM campus.corriges_devoirs cdc WHERE cdc.devoir_id = ${d}.id)`;
}

/**
 * Le corrigé a changé (version) : les copies dont la note publiée vient du campus, et celles qui attendaient,
 * repartent en correction. Les notes posées par un formateur ne sont jamais touchées. La note du campus déjà
 * publiée reste visible jusqu'à la nouvelle. Renvoie le nombre de copies remises en file.
 */
export async function remettreEnFile(devoirId: number): Promise<number> {
  const lignes = await db.execute<{ rendu_id: number }>(sql`
    SELECT ca.rendu_id FROM campus.corrections_auto ca
    JOIN campus.rendus r ON r.id = ca.rendu_id
    WHERE ca.devoir_id = ${devoirId}
      AND ca.etat IN ('notee', 'erreur', 'en_file')
      AND (r.statut <> 'corrige' OR r.origine_note = 'campus')`);
  const ids = lignes.rows.map((l) => Number(l.rendu_id));
  if (!ids.length) return 0;
  await db
    .update(correctionsAuto)
    .set({ etat: "en_file", raison: null, detail: null, demandeId: null, tentatives: 0, majLe: new Date() })
    .where(and(eq(correctionsAuto.devoirId, devoirId), inArray(correctionsAuto.renduId, ids)));
  return ids.length;
}
