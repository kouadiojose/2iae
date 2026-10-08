// Correction automatique des copies (décision de José du 8 octobre 2026), migration 0033_correction_auto.sql.
// Déjà exporté par index.ts. Constantes et types d'échange : shared/engagement/corrections.ts.
//
// Le circuit : chaque devoir à corriger par le campus a un corrigé (corriges_devoirs). Le campus le rédige
// (exercice automatique, devoir d'un formateur sans corrigé) ou le formateur l'écrit ; le formateur reçoit le
// corrigé du jour et le valide ou le modifie. Sans réponse, il est tenu pour bon au bout de 24 h (« tacite »).
// Un corrigé validé ou tacite sert de barème : chaque copie rendue passe par corrections_auto, et la note est
// publiée comme une note de formateur (rendus.origine_note = 'campus'). L'étudiant peut demander une relecture
// (demandes_relecture) ; le formateur peut changer toute note.
import { index, integer, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { campusSchema, utilisateurs } from "./base";
import { devoirs, rendus } from "./evaluations";
import type { EtatCorrection, RaisonARevoir, SourceCorrige, StatutCorrige, StatutRelecture } from "../engagement/corrections";

/**
 * Le corrigé d'un devoir, un seul par devoir. Pour une interrogation (QCM), « contenu » reste vide : les bonnes
 * réponses sont dans questions_quiz, et la ligne ne sert qu'à la validation par le formateur (et au message du
 * jour). « version » augmente à chaque modification : une note du campus garde la version qui l'a produite.
 */
export const corrigesDevoirs = campusSchema.table(
  "corriges_devoirs",
  {
    devoirId: integer("devoir_id")
      .primaryKey()
      .references(() => devoirs.id, { onDelete: "cascade" }),
    /** Corrigé de l'exercice (Markdown) : éléments de réponse attendus, critère par critère si possible. */
    contenu: text("contenu").notNull().default(""),
    source: text("source").$type<SourceCorrige>().notNull().default("campus"),
    statut: text("statut").$type<StatutCorrige>().notNull().default("en_preparation"),
    version: integer("version").notNull().default(1),
    /** Proposé au formateur (message du jour) : départ du délai de 24 h. */
    proposeLe: timestamp("propose_le", { withTimezone: true }),
    /** Sans réponse du formateur, le corrigé est tenu pour bon à cette heure. */
    echeanceLe: timestamp("echeance_le", { withTimezone: true }),
    valideLe: timestamp("valide_le", { withTimezone: true }),
    /** Formateur (ou direction) qui a validé ou modifié ; nul pour une validation tacite. */
    valideParId: integer("valide_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    /** Message du jour envoyé au(x) formateur(s) du cours, puis rappel (un seul). */
    messageEnvoyeLe: timestamp("message_envoye_le", { withTimezone: true }),
    rappelEnvoyeLe: timestamp("rappel_envoye_le", { withTimezone: true }),
    majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("corriges_devoirs_statut_idx").on(t.statut, t.echeanceLe)],
);

/**
 * Suivi de la correction par le campus d'une copie (une ligne par copie de dépôt). « renduLe » et
 * « versionCorrige » disent quelle copie et quel corrigé ont servi : une copie remplacée ou un corrigé modifié
 * remettent la ligne « en_file ». « noteCampus » garde la note du campus quand le formateur la change (écart).
 */
export const correctionsAuto = campusSchema.table(
  "corrections_auto",
  {
    renduId: integer("rendu_id")
      .primaryKey()
      .references(() => rendus.id, { onDelete: "cascade" }),
    devoirId: integer("devoir_id")
      .notNull()
      .references(() => devoirs.id, { onDelete: "cascade" }),
    etat: text("etat").$type<EtatCorrection>().notNull(),
    raison: text("raison").$type<RaisonARevoir>(),
    /** Précision lisible (alerte d'injection, fichiers non lus…), pour le formateur. */
    detail: text("detail"),
    renduLe: timestamp("rendu_le", { withTimezone: true }),
    versionCorrige: integer("version_corrige"),
    /** Demande gardée pour la routine du soir (demandes_ia.id), tant qu'elle attend sa réponse. */
    demandeId: integer("demande_id"),
    tentatives: integer("tentatives").notNull().default(0),
    noteCampus: real("note_campus"),
    majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("corrections_auto_etat_idx").on(t.etat, t.devoirId)],
);

/** Demande de relecture d'une note par l'étudiant (une seule ouverte par copie). */
export const demandesRelecture = campusSchema.table(
  "demandes_relecture",
  {
    id: serial("id").primaryKey(),
    renduId: integer("rendu_id")
      .notNull()
      .references(() => rendus.id, { onDelete: "cascade" }),
    etudiantId: integer("etudiant_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    motif: text("motif").notNull(),
    statut: text("statut").$type<StatutRelecture>().notNull().default("ouverte"),
    noteAvant: real("note_avant"),
    noteApres: real("note_apres"),
    /** Réponse du formateur à l'étudiant (tutoiement). */
    reponse: text("reponse"),
    traiteeParId: integer("traitee_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    traiteeLe: timestamp("traitee_le", { withTimezone: true }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("demandes_relecture_ouverte_idx").on(t.renduId).where(sql`statut = 'ouverte'`), index("demandes_relecture_etudiant_idx").on(t.etudiantId)],
);

export type CorrigeDevoir = typeof corrigesDevoirs.$inferSelect;
export type CorrectionAuto = typeof correctionsAuto.$inferSelect;
export type DemandeRelecture = typeof demandesRelecture.$inferSelect;
