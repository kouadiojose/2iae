// Les deux manuels illustrés du campus (demande de José du 9 octobre 2026 : « simple, beaucoup d'images,
// disponibles sur leur espace »). Ce sont des PDF statiques de client/public/guides/, publics comme les
// guides : ils s'ouvrent sans être connecté, depuis la page de connexion comme depuis le campus. Le service
// worker ne les garde jamais (client/public/sw.js : ouvrir un PDF passe par la règle des pages, qui ne garde
// que du HTML ; aucune autre règle ne vise /guides/) : rien de lourd sur le téléphone sans que la personne le
// demande (sauf « Télécharger le manuel », qui le range dans les téléchargements du téléphone). Tous les textes :
// shared/textes/manuels.ts. Le serveur joint les mêmes fichiers à l'e-mail de bienvenue (server/guide-bienvenue.ts)
// et en donne le lien (server/mail.ts, guideFormateurUrl).
//
// Un manuel refait : remplacer le PDF et sa couverture (JPEG de 300 px de large, moins de 60 Ko), puis
// mettre à jour ici le nombre de pages et le poids (pdfinfo, en Mo décimaux comme sur les téléphones), écrit
// comme sur la couverture du manuel des étudiants. Petits forfaits : viser 2,5 Mo au plus (captures vers
// 300 ppi en JPEG qualité 70, pas d'ombre floue ni de dégradé, que Chromium transforme en images).
import type { Role } from "@shared/schema";

export type Manuel = {
  id: "etudiants" | "formateurs";
  pdf: string;
  couverture: string;
  pages: number;
  /** Poids affiché, en Mo comme les vidéos du campus (pour les petits forfaits). */
  poids: string;
};

export const MANUELS = {
  etudiants: { id: "etudiants", pdf: "/guides/manuel-etudiants.pdf", couverture: "/guides/manuel-etudiants.jpg", pages: 25, poids: "2,3 Mo" },
  formateurs: { id: "formateurs", pdf: "/guides/manuel-formateurs.pdf", couverture: "/guides/manuel-formateurs.jpg", pages: 26, poids: "2,5 Mo" },
} as const satisfies Record<Manuel["id"], Manuel>;

/**
 * Le manuel de chacun : l'étudiant et le formateur ont le leur ; la vie scolaire et la direction, qui
 * aident les uns et les autres, ont les deux ; une salle de conférence n'en a pas.
 */
export function manuelsDuRole(role: Role): Manuel[] {
  if (role === "etudiant") return [MANUELS.etudiants];
  if (role === "formateur") return [MANUELS.formateurs];
  if (role === "admin" || role === "vie_scolaire") return [MANUELS.etudiants, MANUELS.formateurs];
  return [];
}
