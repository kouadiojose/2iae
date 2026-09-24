// Outils du module messages utilisés par d'autres modules (compteurs de la coquille, accueil).
import type { Utilisateur } from "@shared/schema";

/** Nombre de messages non lus de la personne (conversations directes et questions de ses cours). */
export async function compterMessagesNonLus(_u: Utilisateur): Promise<number> {
  return 0; // Implémenté par le module messages.
}
