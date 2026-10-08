// Tables du chantier C8 (tableau « Engagement et participation ») :
// activite_jours (migration 0027_activite_jours.sql, posée en 0026 sur la
// branche du chantier). Posé vide par le socle commun (C0) et déjà exporté par
// index.ts ; les types d'échange vivent dans shared/engagement/indicateurs.ts.
//
// Une ligne par personne et par jour local (utilisateurs.fuseau, Abidjan par
// défaut) où elle a ouvert le campus : derniere_connexion est réécrite à chaque
// passage, elle ne garde aucun historique. Écrite par chargerUtilisateur
// (server/auth.ts → server/engagement/activite.ts) au plus une fois par heure,
// sans attente. Ouvrir le campus n'est PAS apprendre : les actions
// d'apprentissage se lisent dans leurs propres tables (présences, copies,
// interrogations…). Conservation : 400 jours.
import { integer, smallint, text, date, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, sites, classes } from "./base";
import type { Plateforme } from "../engagement/indicateurs";

export const activiteJours = campusSchema.table(
  "activite_jours",
  {
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    /** Jour local « AAAA-MM-JJ » (calendrier commun : shared/engagement/calendrier.ts). */
    jour: date("jour", { mode: "string" }).notNull(),
    premiereLe: timestamp("premiere_le", { withTimezone: true }).notNull().defaultNow(),
    /** Dernier passage compté (l'heure de la dernière augmentation de « heures »). */
    derniereLe: timestamp("derniere_le", { withTimezone: true }).notNull().defaultNow(),
    /** Passages espacés d'au moins une heure dans la journée (1 à 24). */
    heures: smallint("heures").notNull().default(1),
    /** La plus « téléphone » vue ce jour-là : android_app > installee > mobile > ordinateur ; nulle si inconnue. */
    plateforme: text("plateforme").$type<Plateforme>(),
    /** Campus et classe de la personne ce jour-là (facultatifs, ENGAGEMENT.md § 4). */
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    classeId: integer("classe_id").references(() => classes.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.jour] }), index("activite_jours_jour_idx").on(t.jour)],
);

export type ActiviteJour = typeof activiteJours.$inferSelect;
