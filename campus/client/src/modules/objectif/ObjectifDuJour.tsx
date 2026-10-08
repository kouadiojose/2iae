// Emplacement de l'objectif du jour sur l'accueil étudiant (chantier C2),
// posé par le socle commun (C0), sous une LimiteSilencieuse :
//   - variante « grande » : à la place de la carte « À jour », qui reste le
//     repli tant qu'il n'y a pas d'objectif à montrer ;
//   - variante « ligne » : sous la carte « À faire maintenant ».
// En attendant C2 : le repli, ou rien.
import type { ReactNode } from "react";

export function ObjectifDuJour({ repli }: { variante: "grande" | "ligne"; repli?: ReactNode }) {
  return repli ? <>{repli}</> : null;
}
