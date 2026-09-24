// Module « cours » : la dernière leçon ouverte par chaque étudiant (pour
// « Reprendre où j'en étais »), puis les contrats d'API du module (lecture
// étudiante, édition formateur). Les dates voyagent en chaînes ISO.
import { integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import { cours, lecons, type StatutCours, type TypeLecon } from "./cours";
import type { StatutSeance } from "./live";

/**
 * Dernière leçon ouverte par un étudiant dans un cours. Une ligne par
 * (étudiant, cours), remplacée à chaque ouverture : c'est elle qui alimente
 * le bouton « Reprendre » de la page du cours.
 */
export const lecturesCours = campusSchema.table(
  "lectures_cours",
  {
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    coursId: integer("cours_id").notNull().references(() => cours.id, { onDelete: "cascade" }),
    leconId: integer("lecon_id").notNull().references(() => lecons.id, { onDelete: "cascade" }),
    lueLe: timestamp("lue_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.coursId] }), index("lectures_cours_lecon_idx").on(t.leconId)],
);

// ── Contrats d'API du module ───────────────────────────────────────────────

/** Formateur tel qu'il apparaît sur un cours (« Karim Diallo · depuis Lyon »). */
export type FormateurDuCours = {
  id: number;
  prenom: string;
  nom: string;
  titre: string | null;
  localisation: string | null;
  /** Ville seule, tirée de la localisation (« Lyon, France » → « Lyon »). */
  ville: string | null;
  photoUrl: string | null;
};

/** Prochaine séance live d'un cours (ou celle en cours). */
export type SeanceDuCours = {
  id: number;
  titre: string;
  debut: string;
  dureeMinutes: number;
  statut: StatutSeance;
};

/** GET /api/cours — un élément de la liste « Mes cours ». */
export type CoursResume = {
  id: number;
  code: string;
  slug: string;
  titre: string;
  couleur: string;
  imageUrl: string | null;
  statut: StatutCours;
  dateDebut: string | null;
  dateFin: string | null;
  formateur: FormateurDuCours | null;
  /** Leçons publiées. */
  nbLecons: number;
  /** Étudiant : leçons publiées terminées ; null pour les autres rôles. */
  nbTerminees: number | null;
  /** Étudiant : pourcentage de leçons publiées terminées (0 à 100) ; null sinon. */
  progression: number | null;
  prochaineSeance: SeanceDuCours | null;
  /** La personne enseigne ce cours (formateur du cours ou équipe). */
  enseignant: boolean;
  /** Enseignant : leçons encore en brouillon (0 pour les étudiants). */
  nbBrouillons: number;
  nbClasses: number;
  /** Enseignant : étudiants inscrits (null pour les étudiants). */
  nbEtudiants: number | null;
  proposeSurSite: boolean;
  publierSurSite: boolean;
};

export type LeconDuProgramme = {
  id: number;
  titre: string;
  type: TypeLecon;
  dureeMinutes: number | null;
  ordre: number;
  publiee: boolean;
  /** Terminée par moi (toujours faux pour le personnel). */
  terminee: boolean;
  /** Numéro affiché et cité par l'assistant : « 2.3 ». */
  numero: string;
  aFichier: boolean;
};

export type ChapitreDuCours = {
  id: number;
  titre: string;
  ordre: number;
  /** Position affichée (1, 2, 3…). */
  numero: number;
  lecons: LeconDuProgramme[];
};

export type ClasseDuCours = {
  id: number;
  nom: string;
  niveau: string;
  filiere: string;
  siteId: number;
  site: string;
};

export type SiteDuCours = { id: number; nomCourt: string; ville: string; salleConference: string };

/** GET /api/cours/:id */
export type CoursDetail = {
  id: number;
  code: string;
  slug: string;
  titre: string;
  description: string;
  objectifs: string;
  couleur: string;
  imageUrl: string | null;
  statut: StatutCours;
  dateDebut: string | null;
  dateFin: string | null;
  proposeSurSite: boolean;
  publierSurSite: boolean;
  accrocheSite: string | null;
  formateur: FormateurDuCours | null;
  coFormateurs: FormateurDuCours[];
  classes: ClasseDuCours[];
  sites: SiteDuCours[];
  chapitres: ChapitreDuCours[];
  enseignant: boolean;
  /** Étudiant uniquement. */
  progression: { terminees: number; total: number; pourcentage: number } | null;
  /** Étudiant : leçon où reprendre (dernière ouverte non terminée, sinon la première non terminée). */
  reprendre: { leconId: number; titre: string; numero: string; commence: boolean } | null;
  prochaineSeance: SeanceDuCours | null;
  /** Enseignant : nombre d'étudiants inscrits. */
  nbEtudiants: number | null;
};

export type FichierDeLecon = { id: number; nom: string; mime: string; taille: number; url: string };

export type LeconVoisine = { id: number; titre: string; numero: string };

/** GET /api/cours/:id/lecons/:leconId */
export type LeconDetail = {
  id: number;
  coursId: number;
  coursCode: string;
  coursTitre: string;
  couleur: string;
  chapitre: { id: number; titre: string; numero: number };
  numero: string;
  titre: string;
  type: TypeLecon;
  contenu: string;
  url: string | null;
  dureeMinutes: number | null;
  publiee: boolean;
  terminee: boolean;
  fichier: FichierDeLecon | null;
  precedente: LeconVoisine | null;
  suivante: LeconVoisine | null;
  /** Rang de la leçon parmi les leçons visibles (« Leçon 3 sur 12 »). */
  rang: number;
  total: number;
  enseignant: boolean;
};

/** POST/DELETE /api/lecons/:id/terminee */
export type ReponseTerminee = {
  terminee: boolean;
  progression: { terminees: number; total: number; pourcentage: number };
  suivante: LeconVoisine | null;
};

/** GET /api/cours/options — de quoi remplir l'éditeur (classes par site, formateurs). */
export type OptionsEditionCours = {
  sites: {
    id: number;
    nom: string;
    nomCourt: string;
    /** La personne peut cocher les classes de ce site (vie scolaire : son site seulement). */
    modifiable: boolean;
    classes: { id: number; nom: string; niveau: string; filiere: string; effectif: number }[];
  }[];
  /** Équipe seulement : formateurs à qui confier un cours. */
  formateurs: { id: number; prenom: string; nom: string; localisation: string | null }[] | null;
  /** La personne peut publier directement sur 2iae.com (direction). */
  peutPublierSurSite: boolean;
  /** La personne peut changer le formateur principal (équipe). */
  peutChangerFormateur: boolean;
  /** L'assistant IA est configuré (sinon : bouton « Proposer une accroche » désactivé). */
  iaDisponible: boolean;
};
