// Outils du module évaluations utilisés par d'autres modules.

/**
 * Interrogation (quiz) en cours pour cet étudiant : l'assistant IA se met en
 * pause tant qu'elle n'est pas terminée ou que son temps n'est pas écoulé.
 */
export async function interrogationEnCours(_etudiantId: number): Promise<{ devoirId: number; coursId: number } | null> {
  return null; // Implémenté par le module évaluations.
}
