// Visuel de secours d'une actualité.
//
// Les pages servaient jusqu'ici un jeu d'images Unsplash indexé sur des
// catégories — « Innovation », « Formation », « Technologie » — qui
// n'existent nulle part dans le site : les rubriques réellement produites
// s'appellent « Admissions », « Distinctions », « Vie du campus »,
// « Cérémonies & Diplômes ». Aucune correspondance ne tombait donc juste, et
// toute actualité sans visuel recevait la photographie générique de repli,
// prise sur un service tiers.
//
// Une école n'a rien à gagner à illustrer ses annonces avec des inconnus
// photographiés en studio pour une banque d'images, et moins encore à
// dépendre d'un serveur extérieur pour les afficher. Le repli est donc unique,
// neutre, et servi par le site lui-même.

/** Visuel de secours servi par le site, jamais par un tiers. */
export const IMAGE_PAR_DEFAUT = "/api/assets/sliders/slider_1756752371617_9cvh4dv1bnj.jpg";

/**
 * Visuel d'une actualité : le sien, ou le repli institutionnel.
 *
 * La rubrique n'entre pas dans le choix : un repli qui varie selon la rubrique
 * finit par rapprocher une image d'un sujet qu'elle ne montre pas, et c'est
 * précisément ce qu'on cherche à éviter.
 */
export function imageActualite(imageUrl: string | null | undefined): string {
  return imageUrl || IMAGE_PAR_DEFAUT;
}
