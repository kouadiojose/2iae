// Circuit des corrigés (chantier K1 de la correction automatique, décision de José du 8 octobre 2026).
// À écrire par le chantier K1 : rédaction des corrigés manquants (routine du soir), message du jour au
// formateur, validation (routes server/routes/corriges.ts), validation tacite au bout de 24 h, rappel.
// Les signatures ci-dessous sont appelées par server/routes/travaux-ia.ts : les garder.
import type { IssueEtude } from "./etude-cours";

/** Devoirs dont le campus doit rédiger le corrigé (statut « en_preparation »), au plus « limite ». */
export async function corrigesAPreparer(_limite: number): Promise<number[]> {
  return [];
}

/** Rédige (ou reprend, réponse de la routine reçue) le corrigé d'un devoir. */
export async function preparerCorrige(_devoirId: number): Promise<IssueEtude> {
  return "rien";
}
