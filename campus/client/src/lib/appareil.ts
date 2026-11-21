// Quel genre d'appareil est-ce ? Un écran de salle installé avec le code de 8 caractères, ou un appareil personnel
// (le téléphone d'un étudiant, l'ordinateur d'un formateur). Gardé sur l'appareil, jamais envoyé au serveur : c'est
// un choix de l'interface, la vraie barrière reste le code d'installation (routes/lancement.ts).
const CLE = "campus:appareil";

export type GenreAppareil = "ecran" | "personnel";

export function lireAppareil(): GenreAppareil | null {
  try {
    const v = localStorage.getItem(CLE);
    return v === "ecran" || v === "personnel" ? v : null;
  } catch {
    return null;
  }
}

export function noterAppareil(v: GenreAppareil): void {
  try {
    localStorage.setItem(CLE, v);
  } catch {
    /* navigateur sans stockage : le choix vaut pour la page ouverte seulement */
  }
}

/** Écran tactile de petite taille : un téléphone ou une petite tablette, pas l'ordinateur d'une salle. */
export function ressembleTelephone(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches && Math.min(window.screen.width, window.screen.height) < 820;
  } catch {
    return false;
  }
}
