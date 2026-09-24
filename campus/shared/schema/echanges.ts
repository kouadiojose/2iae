// Échanges : messagerie (étudiant ↔ formateur, salons de cours et de classe),
// annonces de la vie scolaire, notifications, agenda.
import { serial, text, integer, boolean, timestamp, jsonb, primaryKey, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, sites, classes, fichiers } from "./base";
import { cours } from "./cours";

/** direct : deux personnes · cours : salon de tous les inscrits d'un cours · classe : salon d'une classe. */
export const TYPES_CONVERSATION = ["direct", "cours", "classe"] as const;
export type TypeConversation = (typeof TYPES_CONVERSATION)[number];

export const conversations = campusSchema.table(
  "conversations",
  {
    id: serial("id").primaryKey(),
    type: text("type").$type<TypeConversation>().notNull(),
    coursId: integer("cours_id").references(() => cours.id, { onDelete: "cascade" }),
    classeId: integer("classe_id").references(() => classes.id, { onDelete: "cascade" }),
    titre: text("titre"),
    dernierMessageLe: timestamp("dernier_message_le", { withTimezone: true }).notNull().defaultNow(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_cours_idx").on(t.coursId), index("conversations_classe_idx").on(t.classeId)],
);

/** Participants explicites (conversations directes) et curseur de lecture de chacun. */
export const participants = campusSchema.table(
  "participants",
  {
    conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    luJusquA: timestamp("lu_jusqu_a", { withTimezone: true }),
    sourdine: boolean("sourdine").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.utilisateurId] })],
);

export const messages = campusSchema.table(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    auteurId: integer("auteur_id").notNull().references(() => utilisateurs.id),
    texte: text("texte").notNull().default(""),
    fichierId: integer("fichier_id").references(() => fichiers.id),
    /** Message auquel celui-ci répond (fil). */
    reponseAId: integer("reponse_a_id"),
    supprime: boolean("supprime").notNull().default(false),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.creeLe)],
);

/** Qui voit une annonce ou un événement. */
export const CIBLES = ["tous", "site", "classe", "cours"] as const;
export type Cible = (typeof CIBLES)[number];

export const annonces = campusSchema.table(
  "annonces",
  {
    id: serial("id").primaryKey(),
    auteurId: integer("auteur_id").notNull().references(() => utilisateurs.id),
    titre: text("titre").notNull(),
    corps: text("corps").notNull(),
    cible: text("cible").$type<Cible>().notNull().default("tous"),
    siteId: integer("site_id").references(() => sites.id),
    classeId: integer("classe_id").references(() => classes.id),
    coursId: integer("cours_id").references(() => cours.id, { onDelete: "cascade" }),
    importante: boolean("importante").notNull().default(false),
    epinglee: boolean("epinglee").notNull().default(false),
    proposeSurSite: boolean("propose_sur_site").notNull().default(false),
    /** Relayée sur le site vitrine www.2iae.com (validée par la direction). */
    publierSurSite: boolean("publier_sur_site").notNull().default(false),
    publieeLe: timestamp("publiee_le", { withTimezone: true }).notNull().defaultNow(),
    expireLe: timestamp("expire_le", { withTimezone: true }),
  },
  (t) => [index("annonces_date_idx").on(t.publieeLe)],
);

export const lecturesAnnonces = campusSchema.table(
  "lectures_annonces",
  {
    annonceId: integer("annonce_id").notNull().references(() => annonces.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    luLe: timestamp("lu_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.annonceId, t.utilisateurId] })],
);

export const notifications = campusSchema.table(
  "notifications",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    /** live, devoir, note, message, annonce, systeme… */
    type: text("type").notNull(),
    titre: text("titre").notNull(),
    corps: text("corps"),
    lien: text("lien"),
    luLe: timestamp("lu_le", { withTimezone: true }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_utilisateur_idx").on(t.utilisateurId, t.creeLe)],
);

/** Abonnements Web Push (PWA installée sur le téléphone). */
export const abonnementsPush = campusSchema.table("abonnements_push", {
  id: serial("id").primaryKey(),
  utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  cles: jsonb("cles").$type<{ p256dh: string; auth: string }>().notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Événements de la vie scolaire (examens, réunions, journées) — les séances et devoirs ont leur propre table. */
export const evenements = campusSchema.table(
  "evenements",
  {
    id: serial("id").primaryKey(),
    titre: text("titre").notNull(),
    description: text("description").notNull().default(""),
    debut: timestamp("debut", { withTimezone: true }).notNull(),
    fin: timestamp("fin", { withTimezone: true }),
    lieu: text("lieu"),
    cible: text("cible").$type<Cible>().notNull().default("tous"),
    siteId: integer("site_id").references(() => sites.id),
    classeId: integer("classe_id").references(() => classes.id),
    coursId: integer("cours_id").references(() => cours.id, { onDelete: "cascade" }),
    auteurId: integer("auteur_id").references(() => utilisateurs.id),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evenements_debut_idx").on(t.debut)],
);

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Annonce = typeof annonces.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Evenement = typeof evenements.$inferSelect;
