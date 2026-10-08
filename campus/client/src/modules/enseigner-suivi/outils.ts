// Petits outils du module « côté formateur » (chantier C7).
import type { Traducteur } from "@shared/textes";
import { selonNombre, type CleEnseigner } from "@shared/textes/enseigner";

const HEURE = 3_600_000;

/** « 3 jours », « 5 heures », « moins d'une heure » : depuis quand une copie attend. */
export function depuis(tx: Traducteur<CleEnseigner>, x: string | number | Date, maintenant = Date.now()): string {
  const ecart = Math.max(0, maintenant - new Date(x).getTime());
  if (ecart < HEURE) return tx("duree.moinsHeure");
  if (ecart < 24 * HEURE) return selonNombre(tx, "duree.heure", Math.floor(ecart / HEURE));
  return selonNombre(tx, "duree.jour", Math.floor(ecart / (24 * HEURE)));
}

/** « 13,5 » : nombre à la française, sans zéros inutiles. */
export const nombreFr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/** Copies passées (« Plus tard ») pendant cette visite : la correction rapide les propose en dernier. */
export const copiesPassees = new Set<number>();

/** Clé de la file de correction : toutes les copies, ou celles d'un devoir (?devoir=). */
export const cleFile = (devoir: number | null) => (devoir ? `/api/enseigner/copies?devoir=${devoir}` : "/api/enseigner/copies");
