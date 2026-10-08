// Tables du chantier C2 (objectif du jour) : objectifs_jours (migration
// 0029_objectif_du_jour.sql au plan, numérotée à la suite du journal dans la
// branche du chantier ; l'intégrateur la renumérote à la fusion). Exporté par
// index.ts. Types d'échange : shared/engagement/objectif.ts.
//
// Une ligne par étudiant et par jour local où un objectif lui a été proposé
// (jamais de ligne vide) : les éléments choisis au premier passage, ceux qui
// sont faits (clés, seulement ajoutées), et l'heure où le jour a été validé,
// écrite une seule fois. Lue par C5 (points de l'objectif validé) et C8 (part
// des objectifs validés). Conservée 400 jours.
import { integer, timestamp, jsonb, date, primaryKey, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, sites, classes } from "./base";
import type { ElementObjectif } from "../engagement/objectif";

export const objectifsJours = campusSchema.table(
  "objectifs_jours",
  {
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    /** Jour local de l'étudiant (« AAAA-MM-JJ », shared/engagement/calendrier.ts). */
    jour: date("jour", { mode: "string" }).notNull(),
    /** Les lignes proposées, figées pour la journée (trois au plus). */
    elements: jsonb("elements").$type<ElementObjectif[]>().notNull().default([]),
    /** Clés des lignes faites (« devoir:27 ») : on n'en retire jamais. */
    faits: jsonb("faits").$type<string[]>().notNull().default([]),
    valideLe: timestamp("valide_le", { withTimezone: true }),
    /** Campus et classe de l'étudiant ce jour-là (facultatifs, pour les agrégats). */
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    classeId: integer("classe_id").references(() => classes.id, { onDelete: "set null" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.jour] }), index("objectifs_jours_jour_idx").on(t.jour)],
);

export type ObjectifJour = typeof objectifsJours.$inferSelect;
