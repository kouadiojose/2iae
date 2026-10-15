// L'espace du professeur dans un cours (José, 15 octobre 2026) : contrats partagés entre server/routes/espace-prof.ts et
// les pages du professeur (client/src/modules/accueil : blocs du cours, « Mes documents », « Vidéos et examens »,
// « Créer un examen »). Tout le reste (séances, ressources, devoirs, corrigés, copies) passe par les routes existantes.

/** GET /api/enseigner/mon-cours/:id/resume : ce que disent les gros blocs d'un cours. */
export type ResumeCoursProfDto = {
  coursId: number;
  /** « 1BTS · 2BTS · 5 campus » ; "" sans classe. */
  classes: string;
  /** La séance du moment (en direct, sinon la prochaine prévue pas finie). */
  seance: { id: number; debut: string; statut: "planifiee" | "en_direct" | "terminee" | "annulee" } | null;
  /** Nom de l'intervenant de la séance du moment quand ce n'est pas la personne (cours à plusieurs professeurs). */
  intervenant: string | null;
  /** Ce qui est prêt pour la séance du moment (null sans séance). */
  documents: { diapos: number; videos: number; documents: number } | null;
  mur: { total: number; dernierLe: string | null };
  /** Séances terminées avec un replay, et cours résumés prêts. */
  videos: { replays: number; resumes: number };
  /** Examens et devoirs du cours ; à relire : brouillons et QCM préparés par l'IA, copies « à revoir ». */
  examens: { total: number; aRelire: number };
};

export type SeanceVideoDto = {
  id: number;
  titre: string;
  debut: string;
  /** Le replay se regarde (/replays/:id). */
  replay: boolean;
  /** Cours résumé tiré de l'enregistrement : prêt, en préparation, en échec, ou rien. */
  resume: "prete" | "en_cours" | "erreur" | null;
};

export type EtatExamen = "brouillon" | "ouvert" | "a_venir" | "fini";

export type ExamenProfDto = {
  id: number;
  titre: string;
  type: "depot" | "quiz";
  dateLimite: string;
  ouvertureLe: string | null;
  publie: boolean;
  etat: EtatExamen;
  /** Préparé par l'IA après une séance (devoirs-auto). */
  parIa: boolean;
  questions: number;
  copies: number;
  notees: number;
  /** Copies rendues sans note. */
  aCorriger: number;
  /** Copies que le campus n'a pas pu noter seul (à relire par le professeur). */
  aRevoir: number;
  /** Critères de correction (corrigé) : écrits par le professeur, proposés par le campus, ou absents. */
  criteres: "professeur" | "a_valider" | "en_preparation" | "absents";
};

/** GET /api/enseigner/mon-cours/:id/videos-examens */
export type VideosExamensDto = {
  seances: SeanceVideoDto[];
  examens: ExamenProfDto[];
  /** L'IA peut proposer des questions maintenant. */
  iaDisponible: boolean;
};

/** POST /api/enseigner/mon-cours/:id/examen/proposer { type, nombre } */
export type PropositionExamenDto =
  | { type: "depot"; questions: string[]; criteres: string }
  | {
      type: "quiz";
      qcm: { enonce: string; options: string[]; bonne: number; explication: string }[];
    };
