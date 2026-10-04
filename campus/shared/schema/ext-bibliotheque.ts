// Contrats de la bibliothèque virtuelle (client ↔ serveur). Fichier sans
// tables Drizzle : le client peut l'importer sans alourdir le téléphone.
import type { FicheLivre, LivrePropose, DiapositiveExpose } from "./ia";
import type { QuestionRevision } from "./ext-ia";

export type NiveauLivre = LivrePropose["niveau"];

export const LIBELLES_NIVEAUX: Record<NiveauLivre, string> = {
  debutant: "Pour débuter",
  intermediaire: "Pour approfondir",
  avance: "Pour aller loin",
};

/** Catalogues publics où un livre a été retrouvé. */
export type SourceLivre = "bnf" | "open_library";

export const LIBELLES_SOURCES: Record<SourceLivre, string> = {
  bnf: "Bibliothèque nationale de France",
  open_library: "Open Library",
};

export type LivreDto = {
  id: number;
  titre: string;
  auteurs: string;
  annee: number | null;
  editeur: string | null;
  isbn: string | null;
  langue: string | null;
  pages: number | null;
  couvertureUrl: string | null;
  lienCatalogue: string | null;
  /** null : non retrouvé dans un catalogue public (à vérifier). */
  source: SourceLivre | null;
  ficheDisponible: boolean;
};

export type LivreProposeDto = LivreDto & { pourquoi: string; niveau: NiveauLivre; verifie: boolean };

export type RechercheBiblioDto = {
  id: number;
  sujet: string;
  conseil: string;
  livres: LivreProposeDto[];
  creeLe: string;
};

export type NoteBiblioDto = { id: number; contenu: string; creeLe: string };

export type ExposeResumeDto = { id: number; livreId: number; livreTitre: string; sujet: string; creeLe: string };

export type ExposeDto = ExposeResumeDto & {
  contenu: string;
  /** null pour un exposé ancien (sans PowerPoint). */
  diapositives: DiapositiveExpose[] | null;
  bibliographie: string[];
  /** Auteur de l'exposé (page de titre du PowerPoint). */
  auteur: string;
};

/** GET /api/bibliotheque/livres/:id */
export type LivreDetailDto = {
  livre: LivreDto;
  fiche: FicheLivre | null;
  notes: NoteBiblioDto[];
  /** Conversation « Interroger le livre » de la personne (la plus récente). */
  conversationId: number | null;
  exposes: ExposeResumeDto[];
};

/** GET /api/bibliotheque : l'espace de la personne. */
export type MaBibliothequeDto = {
  recherches: { id: number; sujet: string; nbLivres: number; creeLe: string }[];
  exposes: ExposeResumeDto[];
  /** Livres consultés récemment (fiche ouverte, questions, notes). */
  livres: LivreDto[];
  /** Livres les plus étudiés sur le campus (fiches déjà prêtes). */
  populaires: LivreDto[];
};

/** POST /api/bibliotheque/livres/:id/quiz */
export type QuizLivreDto = { questions: QuestionRevision[] };

/** GET /api/bibliotheque/activite (formateurs, équipe) : ce que font les étudiants. */
export type ActiviteBiblioDto = {
  lignes: {
    type: "recherche" | "expose";
    id: number;
    le: string;
    etudiant: { id: number; prenom: string; nom: string; classe: string | null; site: string | null };
    sujet: string;
    /** Titres des livres (recherche) ou du livre (exposé). */
    livres: string[];
  }[];
};
