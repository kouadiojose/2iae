// Devoir donné en direct depuis le Studio (demande de José du 12 octobre 2026). Règles pures, sans dépendance,
// communes au Studio (texte indicatif du titre) et au serveur (titre réel) : les deux disent la même chose.

/** Consigne d'un devoir donné en direct : au plus 2 000 caractères (le formulaire du Studio est court). */
export const CONSIGNE_DIRECT_MAX = 2000;
/** Titre tiré de la consigne : au plus 60 caractères. */
export const TITRE_DIRECT_MAX = 60;

/** Marques Markdown de début de ligne : titres, citations, puces, numéros. */
const DEBUT_LIGNE = /^\s*(?:#{1,6}\s+|>\s*|[-*+•]\s+|\d+[.)]\s+)+/;

/**
 * Titre tiré de la consigne : première phrase (jusqu'au premier « . », « ! », « ? » ou retour à la ligne), sans
 * marques Markdown (#, *, _, >, `, puces), espaces resserrés, au plus 60 caractères (coupé au dernier mot entier,
 * suivi de « … »), majuscule en tête. Une première ligne qui annonce la suite (« Par groupe : », « Exercice 2 ») ne
 * dit rien : on prend la première ligne d'au moins trois mots qui ne finit pas par « : ». Chaîne vide si moins de
 * 2 caractères restent.
 */
export function titreDeConsigne(consigne: string): string {
  // Lignes vides et marques de début de ligne (titres, citations, puces, numéros) retirées d'abord.
  const lignes = consigne
    .split(/\r?\n/)
    .map((l) => l.replace(DEBUT_LIGNE, "").trim())
    .filter((l) => l.length > 0);
  const parlante = (l: string) => !/:\s*$/.test(l) && l.replace(/[*_`#>]/g, "").trim().split(/\s+/).length >= 3;
  const premiere = (lignes.find(parlante) ?? lignes[0] ?? "").replace(/\s*:\s*$/, "");
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
  phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  return phrase.length >= 2 ? phrase : "";
}

/** Texte sans marques Markdown, espaces resserrés, en minuscules : pour comparer un titre et une consigne. */
const aplatir = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.replace(DEBUT_LIGNE, ""))
    .join(" ")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Le titre ne fait que répéter le début de la consigne (titre déduit, entier, sans « … ») : la carte et la vue de
 * réponse de l'étudiant ne l'affichent pas au-dessus de la consigne (deux à trois lignes gagnées sur un téléphone).
 * « Début » : les 200 premiers caractères (le titre déduit peut venir de la deuxième ligne, après « Par groupe : »).
 */
export function titreRepete(titre: string, consigne: string): boolean {
  if (titre.trim().endsWith("…")) return false;
  const t = aplatir(titre).replace(/[.!?…:]+$/, "").trim();
  return t.length >= 2 && aplatir(consigne).slice(0, 200).includes(t);
}

/**
 * La consigne sur une seule ligne de texte (marques Markdown retirées, lignes jointes) : aperçu replié de la carte de
 * l'étudiant. La consigne entière (Markdown) s'affiche quand il la déplie, et dans la vue de réponse.
 */
export function consigneEnLigne(consigne: string): string {
  return consigne
    .split(/\r?\n/)
    .map((l) => l.replace(DEBUT_LIGNE, "").replace(/[*_`#>]/g, "").trim())
    .filter(Boolean)
    .join(" · ")
    .replace(/\s+/g, " ")
    .replace(/: ·/g, ":");
}
