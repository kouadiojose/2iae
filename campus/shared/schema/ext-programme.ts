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
import { seances, type FournisseurVisio, type StatutSeance } from "./live";

// ── Tables ─────────────────────────────────────────────────────────────────

export const STATUTS_SESSION = ["brouillon", "publiee", "archivee"] as const;
export type StatutSession = (typeof STATUTS_SESSION)[number];

export const TYPES_CRENEAU = ["cours", "seminaire", "evenement"] as const;
export type TypeCreneau = (typeof TYPES_CRENEAU)[number];

export const LIBELLES_TYPES_CRENEAU: Record<TypeCreneau, string> = {
  cours: "Cours",
  seminaire: "Séminaire",
  evenement: "Événement",
};

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
  /** Première publication. */
  publieeLe: timestamp("publiee_le", { withTimezone: true }),
  /**
   * Dernière génération des séances (« Publier » ou « Mettre à jour les
   * séances »). Une session modifiée après (majLe plus récent) a des
   * changements qui ne sont pas encore répercutés sur les séances du direct.
   */
  synchroniseeLe: timestamp("synchronisee_le", { withTimezone: true }),
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
    /** Cours du campus (attendu pour « cours ») : ses séances live sont créées à la publication. */
    coursId: integer("cours_id").references(() => cours.id, { onDelete: "set null" }),
    /** Libellé affiché quand il n'y a pas de cours (« Séminaire »), ou pour préciser un cours. */
    titre: text("titre").notNull().default(""),
    /** Intervenant (compte formateur) : son nom, son titre et sa photo viennent de son profil. */
    intervenantId: integer("intervenant_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    /**
     * Nom imprimé de l'intervenant (« M. Kouadio José ») ; vide : prénom et nom
     * de son compte. Permet aussi de nommer un intervenant qui n'a pas encore
     * de compte (il ne pourra alors pas ouvrir sa classe en direct).
     */
    intervenantNom: text("intervenant_nom").notNull().default(""),
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
  // Deux « Publier » simultanés ne créent jamais deux fois la même séance.
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
    creeParId: integer("cree_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exceptions_programme_session_idx").on(t.sessionId, t.date)],
);

export type SessionProgramme = typeof sessionsProgramme.$inferSelect;
export type CreneauProgramme = typeof creneauxProgramme.$inferSelect;
export type ExceptionProgramme = typeof exceptionsProgramme.$inferSelect;

// ── Contrats d'API ─────────────────────────────────────────────────────────
// Consommés par le site public du campus, l'espace étudiant et formateur, et
// par 2iae.com (GET /api/public/programme). Les noms existants ne changent
// pas ; les champs marqués « ajout v2 » sont venus s'ajouter.

export type IntervenantDto = {
  id: number;
  /** Nom tel qu'affiché et imprimé (« M. Kouadio José ») : le nom saisi sur le créneau, sinon prénom et nom du compte. */
  nom: string;
  prenom: string;
  nomFamille: string;
  /** Titre du profil (« Consultant canadien »). */
  titre: string | null;
  /** Ville, seulement si le formateur a consenti à être présenté sur le site. */
  localisation: string | null;
  /** Photo, seulement si le formateur a consenti à être présenté sur le site. */
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
  /** Ajout v2 : nom imprimé de l'intervenant, même sans compte (« M. Konaté ») ; vide s'il n'y en a pas. */
  intervenantNom: string;
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

export type StatutOccurrence = "prevue" | "annulee" | "en_direct" | "terminee";

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
  statut: StatutOccurrence;
  /** Ajout v2 : session d'origine. */
  sessionId: number;
  /** Ajout v2 : 1 = lundi … 7 = dimanche. */
  jour: number;
  /** Ajout v2 */
  type: TypeCreneau;
  /** Ajout v2 : couleur du cours (hex), null sans cours. */
  couleur: string | null;
  /** Ajout v2 : code du cours (« IA-101 »), null sans cours. */
  coursCode: string | null;
  /** Ajout v2 : mention imprimée (« Consultant canadien »). */
  mention: string;
  /** Ajout v2 : compte de l'intervenant (pour mettre en valeur les créneaux d'un formateur). */
  intervenantId: number | null;
  /** Ajout v2 : motif d'annulation (exception ou séance annulée). */
  motif: string | null;
};

/** Ajout v2 : les occurrences d'une semaine (du lundi au dimanche). */
export type SemaineProgrammeDto = {
  /** Lundi de la semaine, « 2026-09-28 ». */
  debut: string;
  /** Dimanche de la semaine. */
  fin: string;
  /** « cette-semaine » : la semaine en cours ; « a-venir » : la prochaine semaine qui a des cours (la session n'a pas commencé). */
  nature: "cette-semaine" | "a-venir";
  occurrences: OccurrenceDto[];
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
  /** Ajout v2 : jour d'Abidjan au moment de la réponse (« 2026-09-28 »). */
  aujourdhui: string;
  /** Ajout v2 : la semaine en cours (ou la première semaine à venir), null s'il n'y a rien. */
  semaine: SemaineProgrammeDto | null;
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
  /** Ajout v2 : séances déjà à jour (rien à faire). */
  seancesInchangees: number;
  /** Ajout v2 : première publication de la session. */
  premiere: boolean;
  /** Ajout v2 : personnes prévenues (une notification chacune). */
  etudiantsPrevenus: number;
  intervenantsPrevenus: number;
};

// ── Back-office (/pilotage/programme) ──────────────────────────────────────

/** GET /api/pilotage/programme/sessions : une carte par session. */
export type SessionResumeDto = {
  id: number;
  anneeAcademique: string;
  titre: string;
  public: string;
  debut: string;
  fin: string;
  statut: StatutSession;
  publieeLe: string | null;
  nbCreneaux: number;
  nbClasses: number;
  nbSeances: number;
  prochaine: OccurrenceDto | null;
  /** Publiée, mais modifiée depuis la dernière génération des séances. */
  aRepercuter: boolean;
  /** La personne peut la modifier (vie scolaire : toutes ses classes sont dans son campus). */
  modifiable: boolean;
};

/** Créneau tel que l'éditeur le montre : valeurs résolues et valeurs saisies. */
export type CreneauEditionDto = CreneauDto & {
  titreSaisi: string;
  mentionSaisie: string;
  intervenantNomSaisi: string;
  /** Séances déjà créées pour ce créneau (toutes dates). */
  nbSeances: number;
};

/** GET /api/pilotage/programme/sessions/:id */
export type SessionEditionDto = Omit<SessionDto, "creneaux"> & {
  creneaux: CreneauEditionDto[];
  synchroniseeLe: string | null;
  majLe: string;
  aRepercuter: boolean;
  modifiable: boolean;
  nbSeances: number;
  /** Points à vérifier avant de publier (créneau sans cours, pause qui chevauche un créneau…). */
  avertissements: string[];
};

/** Deux créneaux du même jour qui se chevauchent (409 tant que la personne n'a pas confirmé). */
export type ChevauchementDto = { id: number; jour: number; heureDebut: string; heureFin: string; libelle: string };

/** GET /api/pilotage/programme/options : de quoi remplir l'éditeur. */
export type OptionsProgrammeDto = {
  cours: { id: number; code: string; titre: string; couleur: string; statut: string; formateurId: number | null; formateur: string | null }[];
  formateurs: { id: number; prenom: string; nom: string; titre: string | null; localisation: string | null; active: boolean }[];
  sites: {
    id: number;
    nom: string;
    nomCourt: string;
    modifiable: boolean;
    classes: { id: number; nom: string; niveau: string; filiere: string; anneeScolaire: string; effectif: number; troncCommun: boolean }[];
  }[];
  fournisseurs: FournisseurVisio[];
  fournisseurParDefaut: FournisseurVisio;
  /** Seule la direction crée les comptes des formateurs. */
  peutCreerFormateur: boolean;
  toutLeGroupe: boolean;
};

/** Correspondance statut de séance → statut d'occurrence. */
export function statutOccurrenceDeSeance(s: StatutSeance): StatutOccurrence {
  if (s === "planifiee") return "prevue";
  return s;
}
