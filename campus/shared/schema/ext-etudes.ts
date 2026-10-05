// Contrats des études gardées en mémoire (client ↔ serveur) : le dossier d'un
// livre lu en entier par le campus, et le cours complet tiré de
// l'enregistrement d'une séance. Fichier sans tables Drizzle.

export type StatutEtude = "en_cours" | "prete" | "erreur";

/** Dossier d'étude d'un livre, rédigé après lecture intégrale du texte. */
export type DossierLivre = {
  /** De quoi parle le livre, son auteur, son contexte. */
  presentation: string;
  /** Résumé détaillé (Markdown). */
  resume: string;
  plan: { partie: string; position: string; resume: string }[];
  ideesCles: { titre: string; explication: string; position: string }[];
  concepts: { terme: string; definition: string }[];
  /** Citations recopiées mot pour mot du texte (vérifiées), avec leur place dans le livre. */
  citations: { texte: string; position: string; commentaire: string }[];
  faits: string[];
  /** Liens avec la Côte d'Ivoire et l'Afrique de l'Ouest. */
  afrique: string;
  critique: string[];
  expose: { problematique: string; plan: { partie: string; contenu: string }[]; conseils: string[] };
  groupe: { sujet: string; roles: { role: string; mission: string }[]; debat: string[]; livrable: string };
  revision: { question: string; reponse: string }[];
  pourQui: string;
  aRetenir: string;
};

export type EtudeLivreDto = {
  statut: StatutEtude;
  /** 0 à 100 pendant la lecture. */
  progression: number;
  /** Ce que fait le campus en ce moment (« Lecture du livre », « Rédaction du dossier »). */
  etape: string | null;
  dossier: DossierLivre | null;
  message: string | null;
  fin: string | null;
};

/** Cours complet tiré de l'enregistrement d'une séance (transcription et diapositives). */
export type DossierCours = {
  titre: string;
  /** Objectifs et présentation du cours. */
  introduction: string;
  /** Résumé détaillé (Markdown). */
  resume: string;
  plan: { partie: string; debutSecondes: number; resume: string }[];
  notions: { titre: string; explication: string; exemple: string; debutSecondes: number }[];
  glossaire: { terme: string; definition: string }[];
  exemples: { titre: string; description: string }[];
  quiz: { question: string; options: string[]; bonneReponse: number; explication: string }[];
  exercices: { titre: string; niveau: "facile" | "moyen" | "difficile"; enonce: string; consignes: string[]; corrige: string }[];
  etudeDeCas: { titre: string; contexte: string; questions: string[]; elementsDeReponse: string };
  travailDeGroupe: { sujet: string; roles: { role: string; mission: string }[]; livrable: string };
  fiches: { recto: string; verso: string }[];
  aRetenir: string[];
  pourAllerPlusLoin: string[];
  /** Questions de l'interrogation notée (différentes du quiz d'entraînement) : jamais montrées aux étudiants ici. */
  interrogation?: { question: string; options: string[]; bonneReponse: number; explication: string }[];
  /** Exercice du devoir à rendre, avec son corrigé réservé au formateur : jamais montré aux étudiants ici. */
  devoirPratique?: { titre: string; enonce: string; consignes: string[]; corrige: string };
};

export type CoursCompletDto = {
  seance: { id: number; titre: string; coursId: number; coursCode: string; coursTitre: string; debut: string; formateur: string | null };
  statut: StatutEtude | "a_venir";
  etape: string | null;
  progression: number;
  dossier: DossierCours | null;
  message: string | null;
  /** Le personnel peut relancer la préparation. */
  relancable: boolean;
  /** Devoirs créés à partir de ce cours : QCM noté automatiquement, exercice à rendre. */
  devoirs: { id: number; type: "quiz" | "depot"; titre: string; dateLimite: string }[];
};
