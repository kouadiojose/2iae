// Contrats de la médiathèque des cours (client ↔ serveur) : enregistrements
// des séances terminées et documents des leçons publiées, pour chaque cours
// que la personne peut consulter. Fichier sans tables Drizzle (la colonne
// cours.mediatheque est dans cours.ts).
import type { AccesMediatheque, TypeLecon } from "./cours";

/** Types de leçon dont le fichier joint figure dans la médiathèque. */
export const TYPES_LECON_MEDIATHEQUE = ["pdf", "fichier"] as const satisfies readonly TypeLecon[];

export const LIBELLES_ACCES_MEDIATHEQUE: Record<AccesMediatheque, string> = {
  tous: "Ouverte à tous les étudiants",
  classes: "Réservée aux classes du cours",
};

/** Un enregistrement : le replay d'une séance terminée. */
export type EnregistrementMediathequeDto = {
  seanceId: number;
  titre: string;
  /** Début de la séance (ISO). */
  debut: string;
  dureeSecondes: number | null;
  /** Qui a animé la séance (intervenant de l'emploi du temps, sinon formateur du cours). */
  formateur: string | null;
  vu: boolean;
  /** Pas encore ouvert par la personne, et prêt depuis moins de 14 jours. */
  nouveau: boolean;
  /** Lien de la page du replay. */
  lien: string;
};

/** Un document : le fichier joint à une leçon publiée (PDF ou autre fichier). */
export type DocumentMediathequeDto = {
  leconId: number;
  titre: string;
  /** Numéro affiché de la leçon (« 2.3 »), vide s'il n'est pas connu. */
  numero: string;
  chapitre: string;
  type: (typeof TYPES_LECON_MEDIATHEQUE)[number];
  fichierId: number;
  nom: string | null;
  mime: string | null;
  taille: number | null;
  /** /api/fichiers/:id (contrôle d'accès à chaque lecture). */
  url: string;
};

export type CoursMediathequeDto = {
  id: number;
  code: string;
  titre: string;
  couleur: string;
  formateur: string | null;
  /** Le cours fait partie de mes cours (classe, inscription, cours enseigné). */
  deMaClasse: boolean;
  /** Réglage du cours ; renseigné pour le personnel seulement. */
  acces: AccesMediatheque | null;
  enregistrements: EnregistrementMediathequeDto[];
  documents: DocumentMediathequeDto[];
};

/** GET /api/mediatheque */
export type MediathequeDto = { cours: CoursMediathequeDto[] };

/** PATCH /api/cours/:id/mediatheque */
export type DemandeAccesMediatheque = { mediatheque: AccesMediatheque };
export type ReglageMediathequeDto = { coursId: number; mediatheque: AccesMediatheque; modifiable: boolean };
