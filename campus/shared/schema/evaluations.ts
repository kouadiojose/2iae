// Devoirs (dépôt de travaux) et interrogations (quiz auto-corrigés),
// rendus des étudiants, corrections et carnet de notes.
import { serial, text, integer, boolean, timestamp, jsonb, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import { cours } from "./cours";

/** depot : l'étudiant rend un texte, des photos ou des fichiers · quiz : interrogation en ligne auto-corrigée. */
export const TYPES_DEVOIR = ["depot", "quiz"] as const;
export type TypeDevoir = (typeof TYPES_DEVOIR)[number];

export type CritereGrille = { critere: string; points: number; description?: string };

export const devoirs = campusSchema.table(
  "devoirs",
  {
    id: serial("id").primaryKey(),
    coursId: integer("cours_id").notNull().references(() => cours.id, { onDelete: "cascade" }),
    auteurId: integer("auteur_id").references(() => utilisateurs.id),
    type: text("type").$type<TypeDevoir>().notNull().default("depot"),
    titre: text("titre").notNull(),
    /** Consigne en Markdown. */
    consigne: text("consigne").notNull().default(""),
    ouvertureLe: timestamp("ouverture_le", { withTimezone: true }),
    dateLimite: timestamp("date_limite", { withTimezone: true }).notNull(),
    /** Note maximale (20 par défaut). */
    bareme: real("bareme").notNull().default(20),
    coefficient: real("coefficient").notNull().default(1),
    accepteRetard: boolean("accepte_retard").notNull().default(true),
    /** Quiz : durée limite en minutes (null = sans chrono). */
    dureeMinutes: integer("duree_minutes"),
    /** Quiz : nombre de tentatives permises. */
    tentativesMax: integer("tentatives_max").notNull().default(1),
    /** Quiz : les corrections détaillées sont visibles après la date limite. */
    correctionVisible: boolean("correction_visible").notNull().default(true),
    /** Grille de correction (aussi utilisée par l'aide à la correction IA). */
    grille: jsonb("grille").$type<CritereGrille[]>().notNull().default([]),
    publie: boolean("publie").notNull().default(true),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("devoirs_cours_idx").on(t.coursId), index("devoirs_limite_idx").on(t.dateLimite)],
);

export const STATUTS_RENDU = ["brouillon", "rendu", "corrige"] as const;
export type StatutRendu = (typeof STATUTS_RENDU)[number];

export const rendus = campusSchema.table(
  "rendus",
  {
    id: serial("id").primaryKey(),
    devoirId: integer("devoir_id").notNull().references(() => devoirs.id, { onDelete: "cascade" }),
    etudiantId: integer("etudiant_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    texte: text("texte").notNull().default(""),
    /** Identifiants des fichiers joints (photos du cahier, PDF…). */
    fichierIds: jsonb("fichier_ids").$type<number[]>().notNull().default([]),
    statut: text("statut").$type<StatutRendu>().notNull().default("brouillon"),
    renduLe: timestamp("rendu_le", { withTimezone: true }),
    enRetard: boolean("en_retard").notNull().default(false),
    note: real("note"),
    /** Détail par critère de la grille. */
    noteDetail: jsonb("note_detail").$type<{ critere: string; points: number; obtenu: number }[]>(),
    commentaire: text("commentaire"),
    /** Reçu de dépôt montré à l'étudiant (« 2IAE-4F7K »). */
    recu: text("recu"),
    /** Le formateur a ouvert la copie (deuxième coche). */
    vuLe: timestamp("vu_le", { withTimezone: true }),
    /** Commentaire vocal du formateur (fichier audio). */
    commentaireAudioId: integer("commentaire_audio_id"),
    /** Correction proposée par l'IA, en attente de validation du formateur. */
    propositionIa: jsonb("proposition_ia").$type<{ note: number; detail: { critere: string; points: number; obtenu: number; justification: string }[]; commentaire: string }>(),
    correcteurId: integer("correcteur_id").references(() => utilisateurs.id),
    corrigeLe: timestamp("corrige_le", { withTimezone: true }),
    majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("rendus_unique").on(t.devoirId, t.etudiantId)],
);

export const TYPES_QUESTION = ["qcm", "choix_multiple", "vrai_faux", "reponse_courte"] as const;
export type TypeQuestion = (typeof TYPES_QUESTION)[number];

export const questionsQuiz = campusSchema.table(
  "questions_quiz",
  {
    id: serial("id").primaryKey(),
    devoirId: integer("devoir_id").notNull().references(() => devoirs.id, { onDelete: "cascade" }),
    type: text("type").$type<TypeQuestion>().notNull().default("qcm"),
    enonce: text("enonce").notNull(),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    /** Index des bonnes options (qcm, choix multiple, vrai/faux) ou réponses acceptées (réponse courte). */
    bonnesReponses: jsonb("bonnes_reponses").$type<(number | string)[]>().notNull().default([]),
    explication: text("explication"),
    points: real("points").notNull().default(1),
    ordre: integer("ordre").notNull().default(0),
  },
  (t) => [index("questions_quiz_devoir_idx").on(t.devoirId)],
);

export const tentativesQuiz = campusSchema.table(
  "tentatives_quiz",
  {
    id: serial("id").primaryKey(),
    devoirId: integer("devoir_id").notNull().references(() => devoirs.id, { onDelete: "cascade" }),
    etudiantId: integer("etudiant_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    debutLe: timestamp("debut_le", { withTimezone: true }).notNull().defaultNow(),
    finLe: timestamp("fin_le", { withTimezone: true }),
    /** questionId → réponse(s) donnée(s). */
    reponses: jsonb("reponses").$type<Record<string, (number | string)[]>>().notNull().default({}),
    score: real("score"),
    /** Score ramené au barème du devoir. */
    note: real("note"),
  },
  (t) => [index("tentatives_devoir_etudiant_idx").on(t.devoirId, t.etudiantId)],
);

export type Devoir = typeof devoirs.$inferSelect;
export type Rendu = typeof rendus.$inferSelect;
export type QuestionQuiz = typeof questionsQuiz.$inferSelect;
export type TentativeQuiz = typeof tentativesQuiz.$inferSelect;
