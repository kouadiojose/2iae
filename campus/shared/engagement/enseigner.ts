// Côté formateur (chantier C7) : types d'échange, sans drizzle, partagés par
// le serveur (server/routes/enseigner-suivi.ts, server/engagement/formateurs.ts)
// et le client (modules/enseigner-suivi).
//
// Amendement de José (8 octobre 2026) : aucun travail obligatoire pour le
// formateur. « Après la séance » montre ce que le campus a fait pour lui
// (cours complet prêt, QCM et exercice envoyés, combien les ont faits, copies
// à corriger) ; la relecture des devoirs écrits par l'IA reste facultative.
// Décision D2 : les copies des exercices automatiques (routine du soir) ne
// sont jamais « à corriger » pour lui ; il peut les corriger s'il le souhaite
// (« facultatives »), sans rappel ni compte à rebours.

/** Décision facultative du formateur sur un devoir créé par la routine du soir. */
export const STATUTS_VALIDATION = ["valide", "a_revoir"] as const;
export type StatutValidation = (typeof STATUTS_VALIDATION)[number];

/** Où en est le cours complet d'une séance (etudes_seances ; « a_venir » : pas encore commencé). */
export type EtatCoursComplet = "a_venir" | "en_cours" | "prete" | "erreur";

/** Un devoir de la routine du soir, vu depuis « Après la séance » ou la relecture. */
export type DevoirAutoResume = {
  id: number;
  type: "quiz" | "depot";
  titre: string;
  publie: boolean;
  validation: StatutValidation | null;
  /** Le campus le met en avant (objectif du jour, rappels) : règle de server/engagement/proposables.ts. */
  propose: boolean;
  /** Heure à laquelle il le sera, sans décision du formateur (création + délai) ; nul s'il l'est déjà ou ne le sera pas. */
  proposeLe: string | null;
  dateLimite: string;
  bareme: number;
};

export type DevoirAutoApres = DevoirAutoResume & {
  /** Étudiants inscrits au cours (ceux qui l'ont reçu). */
  destinataires: number;
  /** QCM terminés, ou copies rendues. */
  faits: number;
  /** QCM : moyenne des meilleures notes (sur le barème) ; nul sans tentative. */
  moyenne: number | null;
  /** Exercice : copies rendues sans note (correction facultative : l'exercice vient du campus). 0 s'il est corrigé par le campus. */
  aCorriger: number;
  /**
   * Exercice corrigé par le campus (décision du 8 octobre 2026) : copies dont la note est publiée, copies qui
   * attendent la correction du campus, copies qu'il vous laisse revoir. Absent : exercice sans corrigé.
   */
  correction?: { notees: number; enAttente: number; aRevoir: number } | null;
};

/** GET /api/enseigner/apres-seance : la dernière séance tenue et ce que le campus en a fait. */
export type ApresSeanceDto = {
  seance: {
    id: number;
    titre: string;
    coursId: number;
    coursCode: string;
    coursTitre: string;
    debut: string;
    termineeLe: string | null;
  };
  /**
   * Même calcul que le bilan de séance (GET /api/seances/:id/bilan) : attendus
   * et présents (en salle, en ligne au seuil, en retard). « inconnus » : salle
   * de leur campus pas émargée (présence en trois états, jamais une absence).
   */
  presence: { attendus: number; presents: number; inconnus: number };
  participation: { questions: number; sondages: number };
  replay: { pret: boolean; ouvertures: number };
  coursComplet: {
    etat: EtatCoursComplet;
    /** Étudiants qui l'ont ouvert (révision du jour, C1) ; nul : pas encore mesuré. */
    ouvertures: number | null;
    /** Révision de ses cartes (C1) ; nul : pas encore mesuré. */
    revision: {
      etudiants: number;
      reponses: number;
      /** À partir de 5 étudiants sur la carte. */
      plusRatee: { texte: string; tauxErreur: number } | null;
      /** Cartes signalées par les étudiants, ou retirées parce que trop ratées. */
      signalees: number;
    } | null;
  };
  devoirs: DevoirAutoApres[];
};

export type ResumeEnseigner = {
  /** Nul : aucune séance tenue ces trois dernières semaines. */
  apres: ApresSeanceDto | null;
  /**
   * aCorriger, plusAncienne : copies des devoirs du formateur seulement.
   * facultatives : copies des exercices automatiques sans note (correction facultative, jamais rappelée).
   * aPublier : notes posées et pas encore envoyées, tous devoirs confondus.
   */
  copies: { aCorriger: number; aPublier: number; plusAncienne: string | null; facultatives: number };
  /** Correction automatique (8 octobre 2026) : corrigés à valider, copies à revoir, relectures demandées. */
  corriges?: { aValider: number; prochaineEcheance: string | null; aRevoir: number; relectures: number };
  /** Devoirs de la routine du soir que le formateur n'a pas regardés (relecture facultative). */
  aRelire: number;
};

// ── Relecture facultative (GET /api/enseigner/a-relire) ─────────────────────

export type QuestionARelire = { id: number; enonce: string; options: string[]; bonnes: number[]; explication: string | null };

export type DevoirARelire = DevoirAutoResume & {
  coursCode: string;
  seanceId: number;
  seanceTitre: string;
  creeLe: string;
  questions: QuestionARelire[];
  /** Exercice : début de la consigne. */
  consigne: string | null;
};

export type ARelireDto = { devoirs: DevoirARelire[] };

/** POST /api/enseigner/devoirs-auto/:id/validation — statut nul : revenir à la règle par défaut. */
export type CorpsValidation = { statut: StatutValidation | null; remarque?: string | null };

// ── Correction rapide (/corriger) ───────────────────────────────────────────

export type CopieEnAttente = {
  renduId: number;
  devoirId: number;
  devoirTitre: string;
  coursCode: string;
  bareme: number;
  /** Le devoir a une grille : la correction détaillée reste possible sur la page des copies. */
  avecGrille: boolean;
  etudiant: { id: number; prenom: string; nom: string; site: string | null };
  renduLe: string;
  enRetard: boolean;
  propositionIa: boolean;
  /** Exercice créé par la routine du soir : correction facultative. */
  automatique: boolean;
};

export type GroupeCopies = {
  devoirId: number;
  devoirTitre: string;
  coursCode: string;
  aCorriger: number;
  aPublier: number;
  plusAncienne: string | null;
  /** Exercice créé par la routine du soir : correction facultative. */
  automatique: boolean;
};

/**
 * GET /api/enseigner/copies[?devoir=] : les copies rendues sans note, celles
 * des devoirs du formateur d'abord (les plus anciennes en premier), puis celles
 * des exercices automatiques (facultatives).
 */
export type CopiesEnAttenteDto = {
  copies: CopieEnAttente[];
  devoirs: GroupeCopies[];
  /** Copies des devoirs du formateur. */
  totalACorriger: number;
  /** Copies des exercices automatiques (correction facultative). */
  totalFacultatives: number;
  totalAPublier: number;
  iaDisponible: boolean;
  /** Notes que cette personne a envoyées aujourd'hui (heure d'Abidjan). */
  envoyeesAujourdhui: number;
};

/** Notes proposées d'un toucher, selon le barème (20 → 5, 8, 10, 12, 14, 16, 18, 20). */
export function notesRapides(bareme: number): number[] {
  const parts = [0.25, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  return [...new Set(parts.map((p) => Math.round(bareme * p * 4) / 4))];
}

// ── Travail de groupe du cours complet ──────────────────────────────────────

/** GET /api/seances/:id/travail-de-groupe */
export type TravailDeGroupeDto = {
  devoirId: number | null;
  publie: boolean;
  /** Formateur : l'éditeur (brouillon) ou les copies ; étudiant : le devoir à rendre. */
  lien: string | null;
  /** Formateur du cours ou direction, cours complet prêt et pas encore de devoir. */
  peutCreer: boolean;
  dateLimite: string | null;
  /** Formateur : copies rendues. */
  rendus: number | null;
  /** Étudiant : sa copie, une fois rendue. */
  monRendu: { recu: string | null; renduLe: string | null } | null;
};
