// Moteur de correction automatique des copies (chantier K2, décision de José du 8 octobre 2026).
// À écrire par le chantier K2 : copies à corriger (corrigé validé ou tacite), lecture des pages (photos, PDF,
// documents), demande à l'IA (routine du soir), contrôle et publication de la note, copies « à revoir ».
// Les signatures ci-dessous sont appelées par server/routes/travaux-ia.ts : les garder.
import type { IssueEtude } from "./etude-cours";

/** Copies à corriger ce tour-ci (corrigé utilisable, copie rendue sans note de formateur), au plus « limite ». */
export async function copiesACorriger(_limite: number): Promise<number[]> {
  return [];
}

/** Corrige une copie (ou garde sa demande pour la routine du soir) ; « prete » quand la note est publiée. */
export async function corrigerCopie(_renduId: number): Promise<IssueEtude> {
  return "rien";
}
