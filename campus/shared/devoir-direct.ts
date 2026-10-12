// Devoir donné en direct depuis le Studio (demande de José du 12 octobre 2026). Règles pures, sans dépendance,
// communes au Studio (texte indicatif du titre) et au serveur (titre réel) : les deux disent la même chose.

/** Consigne d'un devoir donné en direct : au plus 2 000 caractères (le formulaire du Studio est court). */
export const CONSIGNE_DIRECT_MAX = 2000;
/** Titre tiré de la consigne : au plus 60 caractères. */
export const TITRE_DIRECT_MAX = 60;

/**
 * Titre tiré de la consigne : première phrase (jusqu'au premier « . », « ! », « ? » ou retour à la ligne), sans
 * marques Markdown (#, *, _, >, `, puces), espaces resserrés, au plus 60 caractères (coupé au dernier mot entier,
 * suivi de « … »). Chaîne vide si moins de 2 caractères restent.
 */
export function titreDeConsigne(consigne: string): string {
  // Lignes vides et marques de début de ligne (titres, citations, puces, numéros) retirées d'abord.
  const lignes = consigne
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+•]\s+|\d+[.)]\s+)+/, "").trim())
    .filter((l) => l.length > 0);
  const premiere = lignes[0] ?? "";
  // Première phrase : jusqu'au premier signe de fin (le signe lui-même n'est pas gardé, sauf « ? » et « ! »).
  const fin = premiere.search(/[.!?]/);
  let phrase = fin >= 0 ? premiere.slice(0, premiere[fin] === "." ? fin : fin + 1) : premiere;
  phrase = phrase
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+([?!])$/, " $1");
  if (phrase.length > TITRE_DIRECT_MAX) {
    const coupe = phrase.slice(0, TITRE_DIRECT_MAX - 1);
    const espace = coupe.lastIndexOf(" ");
    phrase = `${(espace >= 20 ? coupe.slice(0, espace) : coupe).replace(/[\s,;:]+$/, "")}…`;
  }
  return phrase.length >= 2 ? phrase : "";
}
