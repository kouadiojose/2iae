// Module « programme » : l'emploi du temps officiel, saisi dans le
// back-office et répercuté partout (site public du campus, espace étudiant
// et formateur, 2iae.com).
//
// Une SESSION est une période (« Première session », du 28 septembre au
// 10 octobre 2026) destinée à des classes (« Tronc commun 1BTS / 2BTS »).
// Ses CRÉNEAUX sont hebdomadaires (lundi 08:30–12:30, Initiation à l'IA,
// M. Kouadio José). À la publication, chaque créneau lié à un cours engendre
// les séances live de chaque semaine de la session ; la table
// seancesCreneaux garde le lien pour les mettre à jour ensuite. Un créneau
// sans cours (séminaire) s'affiche dans la grille sans créer de séance.
//
// Les heures sont celles d'Abidjan (GMT, pas d'heure d'été) : « 08:30 ».
// Les dates voyagent en « AAAA-MM-JJ » (jour civil, sans fuseau).
import { serial, text, integer, timestamp, date, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, classes } from "./base";
import { cours } from "./cours";
import { seances, type FournisseurVisio } from "./live";

// ── Tables ─────────────────────────────────────────────────────────────────

export const STATUTS_SESSION = ["brouillon", "publiee", "archivee"] as const;
export type StatutSession = (typeof STATUTS_SESSION)[number];

export const TYPES_CRENEAU = ["cours", "seminaire", "evenement"] as const;
export type TypeCreneau = (typeof TYPES_CRENEAU)[number];

export const sessionsProgramme = campusSchema.table("sessions_programme", {
  id: serial("id").primaryKey(),
  /** « 2026-2027 » */
  anneeAcademique: text("annee_academique").notNull(),
  /** « Première session » */
  titre: text("titre").notNull(),
  /** Public visé tel qu'imprimé : « Tronc commun · 1BTS / 2BTS ». */
  public: text("public").notNull().default(""),
  debut: date("debut", { mode: "string" }).notNull(),
  fin: date("fin", { mode: "string" }).notNull(),
  /** Pause commune affichée sur toute la largeur de la grille (« 12:30 »–« 13:30 »), facultative. */
  pauseDebut: text("pause_debut"),
  pauseFin: text("pause_fin"),
  /** Mention libre sous la grille. */
  note: text("note").notNull().default(""),
  /** Signature imprimée : « Le service des études ». */
  signataire: text("signataire").notNull().default("Le service des études"),
  statut: text("statut").$type<StatutSession>().notNull().default("brouillon"),
  publieeLe: timestamp("publiee_le", { withTimezone: true }),
  creeParId: integer("cree_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Classes destinataires d'une session (les cours de ses créneaux leur sont rattachés à la publication). */
export const sessionsClasses = campusSchema.table(
  "sessions_classes",
  {
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessionsProgramme.id, { onDelete: "cascade" }),
    classeId: integer("classe_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.classeId] })],
);

export const creneauxProgramme = campusSchema.table(
  "creneaux_programme",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessionsProgramme.id, { onDelete: "cascade" }),
    /** 1 = lundi … 7 = dimanche (ISO). */
    jour: integer("jour").notNull(),
    /** « 08:30 », heure d'Abidjan. */
    heureDebut: text("heure_debut").notNull(),
    heureFin: text("heure_fin").notNull(),
    type: text("type").$type<TypeCreneau>().notNull().default("cours"),
    /** Cours du campus (obligatoire pour « cours ») : ses séances live sont créées à la publication. */
    coursId: integer("cours_id").references(() => cours.id, { onDelete: "set null" }),
    /** Libellé affiché quand il n'y a pas de cours (« Séminaire »), ou pour préciser un cours. */
    titre: text("titre").notNull().default(""),
    /** Intervenant (compte formateur) : son nom, son titre et sa photo viennent de son profil. */
    intervenantId: integer("intervenant_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    /** Mention imprimée sous le nom (« Consultant canadien ») ; vide : le titre du profil. */
    mention: text("mention").notNull().default(""),
    /** Visio des séances créées ; null : le fournisseur par défaut du campus. */
    fournisseur: text("fournisseur").$type<FournisseurVisio>(),
    ordre: integer("ordre").notNull().default(0),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("creneaux_programme_session_idx").on(t.sessionId, t.jour)],
);

/** Séance live engendrée par un créneau, pour une date donnée. */
export const seancesCreneaux = campusSchema.table(
  "seances_creneaux",
  {
    seanceId: integer("seance_id")
      .primaryKey()
      .references(() => seances.id, { onDelete: "cascade" }),
    creneauId: integer("creneau_id")
      .notNull()
      .references(() => creneauxProgramme.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
  },
  (t) => [uniqueIndex("seances_creneaux_unique").on(t.creneauId, t.date)],
);

/** Dates sans cours (jour férié, séance annulée) : la publication ne les recrée pas. */
export const exceptionsProgramme = campusSchema.table(
  "exceptions_programme",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessionsProgramme.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    /** null : toute la journée. */
    creneauId: integer("creneau_id").references(() => creneauxProgramme.id, { onDelete: "cascade" }),
    motif: text("motif").notNull().default(""),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exceptions_programme_session_idx").on(t.sessionId, t.date)],
);

// ── Contrats d'API ─────────────────────────────────────────────────────────

export type IntervenantDto = {
  id: number;
  nom: string; // « M. Kouadio José » tel qu'affiché
  prenom: string;
  nomFamille: string;
  /** Titre du profil (« Consultant canadien »). */
  titre: string | null;
  localisation: string | null;
  photoUrl: string | null;
  /** Fiche publique /formateurs/:slug, si le formateur a consenti à être présenté. */
  slug: string | null;
};

export type CreneauDto = {
  id: number;
  jour: number;
  heureDebut: string;
  heureFin: string;
  type: TypeCreneau;
  /** Libellé principal : titre du cours, sinon le titre du créneau. */
  libelle: string;
  cours: { id: number; code: string; titre: string; slug: string; couleur: string } | null;
  intervenant: IntervenantDto | null;
  /** Mention imprimée (mention du créneau, sinon titre du profil). */
  mention: string;
  fournisseur: FournisseurVisio | null;
};

export type SessionDto = {
  id: number;
  anneeAcademique: string;
  titre: string;
  public: string;
  debut: string;
  fin: string;
  pause: { debut: string; fin: string } | null;
  note: string;
  signataire: string;
  statut: StatutSession;
  publieeLe: string | null;
  classes: { id: number; nom: string; siteId: number; site: string }[];
  creneaux: CreneauDto[];
  exceptions: { id: number; date: string; creneauId: number | null; motif: string }[];
};

/** Occurrence datée d'un créneau (grille de la semaine, prochaines séances). */
export type OccurrenceDto = {
  date: string; // « 2026-09-28 »
  creneauId: number;
  debut: string; // ISO
  fin: string; // ISO
  libelle: string;
  intervenant: string | null;
  /** Séance live créée pour cette date (lien /live/:id), si elle existe. */
  seanceId: number | null;
  statut: "prevue" | "annulee" | "en_direct" | "terminee";
};

/**
 * GET /api/public/programme — sessions publiées en cours et à venir (et la
 * dernière terminée), sans rien de nominatif sur les étudiants. Consommé par
 * le site public du campus et par 2iae.com.
 */
export type ProgrammePublicDto = {
  sessions: SessionDto[];
  /** Les 10 prochaines occurrences, toutes sessions confondues. */
  prochaines: OccurrenceDto[];
  genereLe: string;
};

/** GET /api/programme — sessions publiées qui concernent la personne connectée (ses classes, ses cours). */
export type MonProgrammeDto = ProgrammePublicDto;

/** POST /api/pilotage/programme/sessions/:id/publier — bilan de la génération des séances. */
export type BilanPublication = {
  seancesCreees: number;
  seancesMisesAJour: number;
  seancesAnnulees: number;
  /** Créneaux « cours » sans cours choisi : rien n'est créé pour eux. */
  creneauxIgnores: number;
  avertissements: string[];
};
