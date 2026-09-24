// Cours, chapitres (modules), leçons et progression des étudiants.
import { serial, text, integer, boolean, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, classes, fichiers } from "./base";

export const STATUTS_COURS = ["brouillon", "publie", "archive"] as const;
export type StatutCours = (typeof STATUTS_COURS)[number];

export const cours = campusSchema.table(
  "cours",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // « IA-101 »
    slug: text("slug").notNull().unique(),
    titre: text("titre").notNull(),
    description: text("description").notNull().default(""),
    /** Ce que l'étudiant saura faire à la fin (une ligne par objectif). */
    objectifs: text("objectifs").notNull().default(""),
    imageUrl: text("image_url"),
    /** Couleur d'accent de la carte du cours (hex). */
    couleur: text("couleur").notNull().default("#E4793A"),
    formateurId: integer("formateur_id").references(() => utilisateurs.id),
    statut: text("statut").$type<StatutCours>().notNull().default("brouillon"),
    dateDebut: timestamp("date_debut", { withTimezone: true }),
    dateFin: timestamp("date_fin", { withTimezone: true }),
    /** Proposé à la publication par le formateur, en attente de la direction. */
    proposeSurSite: boolean("propose_sur_site").notNull().default(false),
    /** Annonce du cours sur le site vitrine www.2iae.com (validée par la direction). */
    publierSurSite: boolean("publier_sur_site").notNull().default(false),
    /** Phrase d'accroche pour le site (sinon : début de la description). */
    accrocheSite: text("accroche_site"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cours_formateur_idx").on(t.formateurId)],
);

/** Classes qui suivent un cours (un cours peut réunir plusieurs campus). */
export const coursClasses = campusSchema.table(
  "cours_classes",
  {
    coursId: integer("cours_id").notNull().references(() => cours.id, { onDelete: "cascade" }),
    classeId: integer("classe_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.coursId, t.classeId] })],
);

/** Inscriptions individuelles, en plus des classes (auditeurs, rattrapages). */
export const inscriptions = campusSchema.table(
  "inscriptions",
  {
    coursId: integer("cours_id").notNull().references(() => cours.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.coursId, t.utilisateurId] })],
);

/** Co-formateurs d'un cours (en plus du formateur principal). */
export const coursFormateurs = campusSchema.table(
  "cours_formateurs",
  {
    coursId: integer("cours_id").notNull().references(() => cours.id, { onDelete: "cascade" }),
    formateurId: integer("formateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.coursId, t.formateurId] })],
);

export const modules = campusSchema.table(
  "modules",
  {
    id: serial("id").primaryKey(),
    coursId: integer("cours_id").notNull().references(() => cours.id, { onDelete: "cascade" }),
    titre: text("titre").notNull(),
    ordre: integer("ordre").notNull().default(0),
  },
  (t) => [index("modules_cours_idx").on(t.coursId)],
);

export const TYPES_LECON = ["texte", "video", "pdf", "lien", "fichier"] as const;
export type TypeLecon = (typeof TYPES_LECON)[number];

export const lecons = campusSchema.table(
  "lecons",
  {
    id: serial("id").primaryKey(),
    moduleId: integer("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
    coursId: integer("cours_id").notNull().references(() => cours.id, { onDelete: "cascade" }),
    titre: text("titre").notNull(),
    type: text("type").$type<TypeLecon>().notNull().default("texte"),
    /** Contenu en Markdown (sert aussi de base de connaissance à l'assistant IA). */
    contenu: text("contenu").notNull().default(""),
    url: text("url"), // vidéo YouTube, lien externe…
    fichierId: integer("fichier_id").references(() => fichiers.id),
    dureeMinutes: integer("duree_minutes"),
    ordre: integer("ordre").notNull().default(0),
    publiee: boolean("publiee").notNull().default(true),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lecons_module_idx").on(t.moduleId), index("lecons_cours_idx").on(t.coursId)],
);

export const progressions = campusSchema.table(
  "progressions",
  {
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    leconId: integer("lecon_id").notNull().references(() => lecons.id, { onDelete: "cascade" }),
    termineeLe: timestamp("terminee_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.leconId] })],
);

export type Cours = typeof cours.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type Lecon = typeof lecons.$inferSelect;
