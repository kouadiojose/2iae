// Tables du chantier C5 (progression et Coupe) : activites, objectifs_semaine,
// badges_etudiants, classements_semaine (migration 0031_progression_coupe.sql,
// numérotée 0026 dans la branche du chantier : l'intégrateur la range à la
// fusion, campus/ENGAGEMENT.md § 5). Les définitions correspondent exactement
// au SQL écrit à la main. Types d'échange : shared/engagement/progression.ts.
import { serial, text, integer, smallint, real, boolean, timestamp, jsonb, date, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, sites, classes } from "./base";
import type { Famille, PorteeCoupe, ResultatSemaine, Trophee, TypeActivite } from "../engagement/progression";

/**
 * Registre des points : un acte d'apprentissage = une ligne, écrite par
 * server/engagement/registre.ts depuis les tables existantes (présences,
 * copies, interrogations…). La clé (« presence:12:345 ») rend chaque passage
 * idempotent. Jour local et semaine ISO de l'étudiant (calendrier commun) ;
 * classe à la date de l'acte. Lue aussi par d'autres chantiers (C4, C8) :
 * les colonnes ne changent plus de nom une fois fusionnées.
 */
export const activites = campusSchema.table(
  "activites",
  {
    id: serial("id").primaryKey(),
    cle: text("cle").notNull(),
    utilisateurId: integer("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    type: text("type").$type<TypeActivite>().notNull(),
    points: integer("points").notNull(),
    /** Jour local « AAAA-MM-JJ » de l'acte, dans le fuseau de l'étudiant. */
    jour: date("jour", { mode: "string" }).notNull(),
    /** Semaine ISO « 2026-W41 » du jour. */
    semaine: text("semaine").notNull(),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    /** Classe de l'étudiant à la date de l'acte (passages_classes). */
    classeId: integer("classe_id").references(() => classes.id, { onDelete: "set null" }),
    coursId: integer("cours_id"),
    seanceId: integer("seance_id"),
    /** Objet de l'acte : devoir, leçon, question, sondage, carte de révision… */
    objetId: integer("objet_id"),
    /** Moment de l'acte (dépôt, fin de l'interrogation, émargement…). */
    faitLe: timestamp("fait_le", { withTimezone: true }).notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("activites_cle_unique").on(t.cle),
    index("activites_utilisateur_jour_idx").on(t.utilisateurId, t.jour),
    index("activites_semaine_site_idx").on(t.semaine, t.siteId),
    index("activites_semaine_classe_idx").on(t.semaine, t.classeId),
  ],
);

/**
 * Semaines actives de l'étudiant : son objectif (2, 3 ou 5 jours), sa série
 * de semaines réussies et son record, le mois du dernier joker utilisé. La
 * série est mise à jour semaine terminée par semaine terminée
 * (semaine_evaluee : la dernière déjà comptée).
 */
export const objectifsSemaine = campusSchema.table("objectifs_semaine", {
  utilisateurId: integer("utilisateur_id")
    .primaryKey()
    .references(() => utilisateurs.id, { onDelete: "cascade" }),
  jours: smallint("jours").notNull().default(3),
  /** Mois (« 2026-10 ») où le joker a servi : un joker par mois. */
  jokerMois: text("joker_mois"),
  serie: smallint("serie").notNull().default(0),
  record: smallint("record").notNull().default(0),
  semaineEvaluee: text("semaine_evaluee"),
  dernierResultat: text("dernier_resultat").$type<ResultatSemaine>(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Badges obtenus ; vu_le reste vide tant que l'étudiant ne l'a pas vu s'afficher. */
export const badgesEtudiants = campusSchema.table(
  "badges_etudiants",
  {
    utilisateurId: integer("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    badge: text("badge").notNull(),
    obtenuLe: timestamp("obtenu_le", { withTimezone: true }).notNull().defaultNow(),
    vuLe: timestamp("vu_le", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.badge] })],
);

/**
 * Coupe des campus et des classes, semaine par semaine (server/engagement/coupe.ts) :
 * la semaine en cours est recalculée toutes les 15 minutes, la précédente est
 * figée une seule fois le lundi (fige_le). Que des taux et des moyennes,
 * aucune donnée nominative. Lue aussi par d'autres chantiers (C8).
 */
export const classementsSemaine = campusSchema.table(
  "classements_semaine",
  {
    semaine: text("semaine").notNull(),
    portee: text("portee").$type<PorteeCoupe>().notNull(),
    /** sites.id (portée « campus ») ou classes.id (portée « classe »). */
    cibleId: integer("cible_id").notNull(),
    /** « campus », ou la ligue de la classe (annee1, annee2, licences). */
    ligue: text("ligue").notNull(),
    inscrits: integer("inscrits").notNull().default(0),
    participants: integer("participants").notNull().default(0),
    /** Part des inscrits qui ont fait au moins deux types d'actes dans la semaine (0 à 100). */
    tauxParticipation: real("taux_participation").notNull().default(0),
    /** Points moyens par inscrit, plafonnés par étudiant. */
    pointsMoyens: real("points_moyens").notNull().default(0),
    /** Part des inscrits actifs au moins 3 jours (0 à 100). */
    partAssidus: real("part_assidus").notNull().default(0),
    /** Écart de score avec la semaine précédente, en points. */
    progression: real("progression"),
    /** Présence aux directs émargés, hors incidents de salle (0 à 100) ; null : aucune séance émargée. */
    presenceDirect: real("presence_direct"),
    seancesEmargees: integer("seances_emargees").notNull().default(0),
    /** Taux de la Coupe (classement principal). */
    score: real("score").notNull().default(0),
    /** Rang dans la ligue ; null hors classement (classe de moins de 5, campus sans inscrit). */
    rang: integer("rang"),
    trophees: jsonb("trophees").$type<Trophee[]>().notNull().default([]),
    /** Nombre d'actes de la semaine par famille. */
    actes: jsonb("actes").$type<Partial<Record<Famille, number>>>().notNull().default({}),
    /** Semaine d'essai : affichée comme telle, aucun trophée. */
    essai: boolean("essai").notNull().default(false),
    majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
    figeLe: timestamp("fige_le", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.semaine, t.portee, t.cibleId] })],
);

export type Activite = typeof activites.$inferSelect;
export type ObjectifSemaineLigne = typeof objectifsSemaine.$inferSelect;
export type ClassementSemaine = typeof classementsSemaine.$inferSelect;
