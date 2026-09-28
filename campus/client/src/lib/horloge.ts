// Beaucoup de téléphones d'entrée de gamme ont une horloge fausse de
// plusieurs minutes : échéances, comptes à rebours et codes d'émargement se
// calculent à l'heure du SERVEUR, estimée à partir de l'en-tête Date.
let decalage = 0; // serveur - téléphone, en ms
const echantillons: number[] = [];

export function noterHeureServeur(enTeteDate: string | null) {
  if (!enTeteDate) return;
  const serveur = new Date(enTeteDate).getTime();
  if (Number.isNaN(serveur)) return;
  // L'en-tête est arrondi à la seconde : on vise le milieu de la seconde.
  echantillons.push(serveur + 500 - Date.now());
  if (echantillons.length > 9) echantillons.shift();
  const tries = [...echantillons].sort((a, b) => a - b);
  decalage = tries[Math.floor(tries.length / 2)];
}

/** Heure actuelle du serveur (ms depuis 1970). */
export const maintenantServeur = () => Date.now() + decalage;

/** Écart (ms) entre l'horloge du téléphone et celle du serveur. */
export const decalageHorloge = () => decalage;
