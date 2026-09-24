// Assistant pédagogique (Claude) : conversations des étudiants et des
// formateurs, et consommation quotidienne pour maîtriser le coût.
import { serial, text, integer, boolean, timestamp, primaryKey, index, date } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import { cours, lecons } from "./cours";
import { devoirs } from "./evaluations";

export const conversationsIa = campusSchema.table(
  "conversations_ia",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    coursId: integer("cours_id").references(() => cours.id, { onDelete: "set null" }),
    /** Leçon depuis laquelle la conversation a été ouverte (l'assistant sait ce que l'étudiant lit). */
    leconId: integer("lecon_id").references(() => lecons.id, { onDelete: "set null" }),
    /**
     * Devoir depuis lequel la conversation a été ouverte : le mode tuteur
     * (indices, jamais la réponse) reste actif pour toute la conversation.
     */
    devoirId: integer("devoir_id").references(() => devoirs.id, { onDelete: "set null" }),
    titre: text("titre").notNull().default("Nouvelle conversation"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_ia_utilisateur_idx").on(t.utilisateurId)],
);

export const messagesIa = campusSchema.table(
  "messages_ia",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull().references(() => conversationsIa.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    contenu: text("contenu").notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_ia_conversation_idx").on(t.conversationId)],
);

/** Nombre de requêtes et de jetons consommés par jour et par personne. */
export const usageIa = campusSchema.table(
  "usage_ia",
  {
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    jour: date("jour").notNull(),
    requetes: integer("requetes").notNull().default(0),
    jetonsEntree: integer("jetons_entree").notNull().default(0),
    jetonsSortie: integer("jetons_sortie").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.jour] })],
);

export type ConversationIa = typeof conversationsIa.$inferSelect;
export type MessageIa = typeof messagesIa.$inferSelect;

/** Fiches de révision (« l'essentiel en 5 points ») générées par l'IA, relues par le formateur. */
export const fichesRevision = campusSchema.table(
  "fiches_revision",
  {
    id: serial("id").primaryKey(),
    coursId: integer("cours_id").notNull().references(() => cours.id, { onDelete: "cascade" }),
    leconId: integer("lecon_id"),
    seanceId: integer("seance_id"),
    titre: text("titre").notNull(),
    contenu: text("contenu").notNull(),
    /** Visible des étudiants une fois validée par le formateur. */
    validee: boolean("validee").notNull().default(false),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fiches_cours_idx").on(t.coursId)],
);

export type FicheRevision = typeof fichesRevision.$inferSelect;
