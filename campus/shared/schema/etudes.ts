// Études gardées en mémoire : le dossier d'un livre lu en entier, le cours
// complet tiré d'un enregistrement (et sa transcription), et les réponses déjà
// données sur un livre, réutilisées sans rappeler l'IA. On étudie une fois ;
// tous les étudiants en profitent ensuite.
import { serial, text, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import { livres } from "./ia";
import { seances } from "./live";
import type { DossierCours, DossierLivre, StatutEtude } from "./ext-etudes";

export const etudesLivres = campusSchema.table("etudes_livres", {
  livreId: integer("livre_id")
    .primaryKey()
    .references(() => livres.id, { onDelete: "cascade" }),
  statut: text("statut").$type<StatutEtude>().notNull(),
  etape: text("etape"),
  progression: integer("progression").notNull().default(0),
  dossier: jsonb("dossier").$type<DossierLivre>(),
  caracteres: integer("caracteres"),
  coutMicro: integer("cout_micro").notNull().default(0),
  demandePar: integer("demande_par").references(() => utilisateurs.id, { onDelete: "set null" }),
  /** Lectures lancées (relances comprises) : au-delà de trois échecs, plus de relance. */
  essais: integer("essais").notNull().default(0),
  message: text("message"),
  debut: timestamp("debut", { withTimezone: true }).notNull().defaultNow(),
  fin: timestamp("fin", { withTimezone: true }),
});

export const etudesSeances = campusSchema.table("etudes_seances", {
  seanceId: integer("seance_id")
    .primaryKey()
    .references(() => seances.id, { onDelete: "cascade" }),
  statut: text("statut").$type<StatutEtude>().notNull(),
  etape: text("etape"),
  progression: integer("progression").notNull().default(0),
  dossier: jsonb("dossier").$type<DossierCours>(),
  coutMicro: integer("cout_micro").notNull().default(0),
  /** Préparations lancées : après trois échecs, la tâche n'y revient plus (« Refaire » remet à zéro). */
  essais: integer("essais").notNull().default(0),
  message: text("message"),
  debut: timestamp("debut", { withTimezone: true }).notNull().defaultNow(),
  fin: timestamp("fin", { withTimezone: true }),
});

/** Devoirs créés par le campus à partir du cours complet d'une séance (une seule fois, même si le cours est refait). */
export const devoirsSeances = campusSchema.table("devoirs_seances", {
  seanceId: integer("seance_id")
    .primaryKey()
    .references(() => seances.id, { onDelete: "cascade" }),
  devoirIds: jsonb("devoir_ids").$type<number[]>().notNull().default([]),
  /** Corrigés réservés au formateur (par identifiant de devoir), donnés à l'aide à la correction. */
  corriges: jsonb("corriges").$type<Record<string, string>>().notNull().default({}),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Transcription d'un enregistrement (un par morceau de replay), faite par le service de Daily. */
export const transcriptionsReplays = campusSchema.table(
  "transcriptions_replays",
  {
    enregistrementId: text("enregistrement_id").primaryKey(),
    seanceId: integer("seance_id")
      .notNull()
      .references(() => seances.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull().default(1),
    /** Secondes entre le début du replay et le début de ce morceau. */
    decalageSecondes: integer("decalage_secondes").notNull().default(0),
    travailId: text("travail_id"),
    statut: text("statut").$type<"soumise" | "terminee" | "erreur">().notNull(),
    essais: integer("essais").notNull().default(0),
    message: text("message"),
    debut: timestamp("debut", { withTimezone: true }).notNull().defaultNow(),
    fin: timestamp("fin", { withTimezone: true }),
  },
  (t) => [index("transcriptions_replays_seance_idx").on(t.seanceId)],
);

/** Réponses déjà données à une première question sur un livre étudié (mêmes mots : même réponse, sans IA). */
export const reponsesLivres = campusSchema.table(
  "reponses_livres",
  {
    id: serial("id").primaryKey(),
    livreId: integer("livre_id")
      .notNull()
      .references(() => livres.id, { onDelete: "cascade" }),
    cle: text("cle").notNull(),
    question: text("question").notNull(),
    reponse: text("reponse").notNull(),
    utilisations: integer("utilisations").notNull().default(0),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reponses_livres_cle_idx").on(t.livreId, t.cle)],
);
