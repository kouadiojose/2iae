// Assistant pédagogique (Claude) : conversations des étudiants et des
// formateurs, et consommation quotidienne pour maîtriser le coût.
import { serial, text, integer, boolean, timestamp, primaryKey, index, date, real, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
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
    /** Livre de la bibliothèque interrogé (« Interroger le livre ») : la conversation reste dans la bibliothèque. */
    livreId: integer("livre_id").references((): AnyPgColumn => livres.id, { onDelete: "cascade" }),
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
    /** Coût réel, en millionièmes de dollar, au prix du modèle qui a répondu (cache compris). */
    coutMicro: integer("cout_micro").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.jour] })],
);

/**
 * Réglages de l'IA (une seule ligne, id = 1), modifiables par la direction :
 * budget du mois pour tout le campus, questions par jour et par personne.
 */
export const reglagesIa = campusSchema.table("reglages_ia", {
  id: integer("id").primaryKey().default(1),
  /** Au-delà, l'assistant et la bibliothèque se mettent en pause jusqu'au 1er du mois suivant. */
  budgetMensuelUsd: real("budget_mensuel_usd").notNull().default(100),
  quotaEtudiant: integer("quota_etudiant").notNull().default(20),
  quotaPersonnel: integer("quota_personnel").notNull().default(60),
  /** Alertes déjà envoyées à la direction : { "2026-10": [50, 80] }. */
  alertes: jsonb("alertes").$type<Record<string, number[]>>().notNull().default({}),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
  majParId: integer("maj_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
});

export type ReglagesIa = typeof reglagesIa.$inferSelect;

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

// ═══ Bibliothèque virtuelle ════════════════════════════════════════════════
// L'IA propose des livres pour un sujet ; chacun est vérifié dans des
// catalogues publics (Open Library, Google Books) avant d'être montré. La fiche
// d'un livre est rédigée une fois, puis partagée par tous les étudiants.

/** Résumé structuré d'un livre (d'après les connaissances de l'IA et la description publique). */
export type FicheLivre = {
  resume: string;
  ideesCles: { titre: string; texte: string }[];
  plan: { partie: string; contenu: string }[];
  pourQui: string;
  aRetenir: string;
  /** L'IA connaît-elle bien ce livre ? « faible » : fiche prudente, à vérifier dans le livre. */
  connaissance: "bonne" | "partielle" | "faible";
};

export const livres = campusSchema.table(
  "livres",
  {
    id: serial("id").primaryKey(),
    /** Clé de dédoublonnage : identifiant du catalogue (« ol:/works/OL123W », « gb:abc ») ou titre|auteur normalisés. */
    cle: text("cle").notNull(),
    titre: text("titre").notNull(),
    auteurs: text("auteurs").notNull().default(""),
    annee: integer("annee"),
    editeur: text("editeur"),
    isbn: text("isbn"),
    langue: text("langue"),
    pages: integer("pages"),
    couvertureUrl: text("couverture_url"),
    /** Lien public vers la notice (Open Library, Google Books). */
    lienCatalogue: text("lien_catalogue"),
    /** Description publique du catalogue (sert d'ancrage à la fiche). */
    description: text("description"),
    /** « open_library » | « google_books » | null : non retrouvé dans un catalogue. */
    source: text("source"),
    fiche: jsonb("fiche").$type<FicheLivre>(),
    ficheLe: timestamp("fiche_le", { withTimezone: true }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("livres_cle_idx").on(t.cle)],
);

/** Un livre proposé pour une recherche, avec la raison du choix. */
export type LivrePropose = { livreId: number; pourquoi: string; niveau: "debutant" | "intermediaire" | "avance"; verifie: boolean };

export const recherchesBiblio = campusSchema.table(
  "recherches_biblio",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    sujet: text("sujet").notNull(),
    /** Conseil de l'IA pour aborder le sujet (2-3 phrases). */
    conseil: text("conseil").notNull().default(""),
    resultats: jsonb("resultats").$type<LivrePropose[]>().notNull().default([]),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recherches_biblio_utilisateur_idx").on(t.utilisateurId)],
);

/** Notes de lecture de l'étudiant sur un livre (idées recueillies, réponses gardées), reprises dans l'exposé. */
export const notesBiblio = campusSchema.table(
  "notes_biblio",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    livreId: integer("livre_id").notNull().references(() => livres.id, { onDelete: "cascade" }),
    contenu: text("contenu").notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notes_biblio_utilisateur_idx").on(t.utilisateurId, t.livreId)],
);

/** Exposés préparés avec l'IA à partir d'un livre (plan, diapositives, bibliographie). */
export const exposesBiblio = campusSchema.table(
  "exposes_biblio",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    livreId: integer("livre_id").notNull().references(() => livres.id, { onDelete: "cascade" }),
    sujet: text("sujet").notNull(),
    contenu: text("contenu").notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exposes_biblio_utilisateur_idx").on(t.utilisateurId)],
);

export type Livre = typeof livres.$inferSelect;
export type RechercheBiblio = typeof recherchesBiblio.$inferSelect;
export type NoteBiblio = typeof notesBiblio.$inferSelect;
export type ExposeBiblio = typeof exposesBiblio.$inferSelect;
