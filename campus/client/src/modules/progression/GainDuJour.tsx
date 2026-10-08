// Ce que l'étudiant vient de gagner (points, jour actif, badge), affiché à la
// fin d'un acte : sortie d'un direct (C6), objectif du jour validé (C2), fin
// de révision (C1). Rempli par C5 ; posé vide par le socle commun (C0) ;
// chaque appelant l'enveloppe dans une LimiteSilencieuse.
export type MomentGain = "live" | "objectif" | "revision" | "rendu";

export function GainDuJour(_props: { moment: MomentGain }) {
  return null;
}
