// Tables du chantier C1 (révision du jour, campus/ENGAGEMENT.md) : la banque
// de cartes tirée des cours complets et des sondages, la boîte de chaque
// étudiant pour chaque carte, ses réponses, le suivi du cours complet et les
// signalements (migration 0028_revision.sql, numérotée à la fusion). Le SQL
// est écrit à la main : ces définitions doivent lui correspondre exactement.
//
// Lues par d'autres chantiers, en SQL, après tableExiste() : cartes_revision,
// reponses_revision, suivis_cours_complets (et revisions_etudiants pour les
// cartes dues). Une carte est proposée en révision si active = true (une carte
// retirée, a_relire = true, a toujours active = false).
import { serial, text, integer, smallint, boolean, timestamp, date, jsonb, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, classes, sites } from "./base";
import { cours } from "./cours";
import { seances } from "./live";
import type { ContenuCarte, GenreCarte, OrigineReponse, SourceCarte } from "../engagement/revision";

/** Une carte de révision : une question du quiz, une fiche mémo, un terme du glossaire ou un sondage corrigé. */
export const cartesRevision = campusSchema.table(
  "cartes_revision",
  {
    id: serial("id").primaryKey(),
    /** sha256(séance | source | texte normalisé) : la même question, réécrite à l'identique, garde sa carte. */
    cle: text("cle").notNull(),
    coursId: integer("cours_id")
      .notNull()
      .references(() => cours.id, { onDelete: "cascade" }),
    seanceId: integer("seance_id")
      .notNull()
      .references(() => seances.id, { onDelete: "cascade" }),
    source: text("source").$type<SourceCarte>().notNull(),
    /** Rang dans le dossier (« question 3 ») ; identifiant du sondage pour un sondage. */
    position: integer("position").notNull().default(0),
    genre: text("genre").$type<GenreCarte>().notNull(),
    contenu: jsonb("contenu").$type<ContenuCarte>().notNull(),
    langue: text("langue").notNull().default("fr"),
    /** Proposée en révision : présente dans le dossier actuel et pas retirée. */
    active: boolean("active").notNull().default(true),
    /** Retirée (3 signalements, ou ratée par 70 % des étudiants) : le formateur la réactive ou la garde retirée. */
    aRelire: boolean("a_relire").notNull().default(false),
    signalements: integer("signalements").notNull().default(0),
    /** Décision du formateur (réactivée ou gardée retirée) : les erreurs d'avant ne comptent plus. */
    relueLe: timestamp("relue_le", { withTimezone: true }),
    /** Dernière fois que la banque l'a vue dans le dossier. */
    majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("cartes_revision_cle_idx").on(t.cle),
    index("cartes_revision_cours_idx").on(t.coursId, t.active),
    index("cartes_revision_seance_idx").on(t.seanceId),
  ],
);

/** Boîte de l'étudiant pour une carte : quand elle revient, combien de bonnes réponses et d'erreurs. */
export const revisionsEtudiants = campusSchema.table(
  "revisions_etudiants",
  {
    utilisateurId: integer("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    carteId: integer("carte_id")
      .notNull()
      .references(() => cartesRevision.id, { onDelete: "cascade" }),
    boite: smallint("boite").notNull().default(1),
    /** Jour local (fuseau de l'étudiant) où la carte revient. */
    prochaineLe: date("prochaine_le", { mode: "string" }).notNull(),
    bonnes: integer("bonnes").notNull().default(0),
    erreurs: integer("erreurs").notNull().default(0),
    derniereLe: timestamp("derniere_le", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.carteId] }), index("revisions_etudiants_prochaine_idx").on(t.utilisateurId, t.prochaineLe)],
);

/** Chaque réponse de révision (une ligne par réponse, jamais deux pour le même envoi). */
export const reponsesRevision = campusSchema.table(
  "reponses_revision",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    carteId: integer("carte_id")
      .notNull()
      .references(() => cartesRevision.id, { onDelete: "cascade" }),
    juste: boolean("juste").notNull(),
    origine: text("origine").$type<OrigineReponse>().notNull(),
    /** Jour local de la réponse (faite hors ligne : le jour où elle a été faite, si elle arrive sous 48 h). */
    jour: date("jour", { mode: "string" }).notNull(),
    reponduLe: timestamp("repondu_le", { withTimezone: true }).notNull(),
    recuLe: timestamp("recu_le", { withTimezone: true }).notNull().defaultNow(),
    cleEnvoi: text("cle_envoi").notNull(),
    /** Classe et campus de l'étudiant au moment de la réponse (défi de la classe, Coupe). */
    classeId: integer("classe_id").references(() => classes.id, { onDelete: "set null" }),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("reponses_revision_envoi_idx").on(t.utilisateurId, t.cleEnvoi),
    index("reponses_revision_jour_idx").on(t.utilisateurId, t.jour),
    index("reponses_revision_carte_idx").on(t.carteId),
    index("reponses_revision_jour_seul_idx").on(t.jour),
  ],
);

/** Suivi du cours complet par l'étudiant : ouvert, revu, meilleur score au quiz, fiches vues, exercices faits. */
export const suivisCoursComplets = campusSchema.table(
  "suivis_cours_complets",
  {
    utilisateurId: integer("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    seanceId: integer("seance_id")
      .notNull()
      .references(() => seances.id, { onDelete: "cascade" }),
    ouvertLe: timestamp("ouvert_le", { withTimezone: true }).notNull().defaultNow(),
    /** Dernière activité dans le cours complet. */
    revuLe: timestamp("revu_le", { withTimezone: true }).notNull().defaultNow(),
    quizMeilleur: smallint("quiz_meilleur"),
    quizTotal: smallint("quiz_total"),
    fichesVues: integer("fiches_vues").notNull().default(0),
    /** { "0": { "etat": "fait", "corrige": true } } : par exercice, « Je l'ai fait » / « J'ai eu du mal » et corrigé vu. */
    exercicesFaits: jsonb("exercices_faits").$type<Record<string, { etat?: "fait" | "difficile"; corrige?: boolean }>>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.seanceId] }), index("suivis_cours_complets_seance_idx").on(t.seanceId)],
);

/** Un signalement par étudiant et par carte (« Signaler une erreur »). */
export const signalementsCartes = campusSchema.table(
  "signalements_cartes",
  {
    carteId: integer("carte_id")
      .notNull()
      .references(() => cartesRevision.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    motif: text("motif").notNull().default(""),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.carteId, t.utilisateurId] })],
);

export type CarteRevision = typeof cartesRevision.$inferSelect;
export type RevisionEtudiant = typeof revisionsEtudiants.$inferSelect;
