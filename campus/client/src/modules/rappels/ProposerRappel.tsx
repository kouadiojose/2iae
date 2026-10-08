// Proposition d'activer les rappels au bon moment (chantier C3) : à la sortie
// d'un direct (C6), sous le reçu d'un devoir rendu (C3), à la fin d'une
// révision (C1). Posé vide par le socle commun (C0) ; chaque appelant
// l'enveloppe dans une LimiteSilencieuse.
export type MomentRappel = "live" | "rendu" | "revision";

export function ProposerRappel(_props: { moment: MomentRappel }) {
  return null;
}
