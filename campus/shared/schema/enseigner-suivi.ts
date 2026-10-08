// Tables du chantier C7 (côté formateur), migration 0030_suivi_formateurs.sql
// (numérotée 0026 tant que la branche est seule : l'intégrateur la range).
// Déjà exporté par index.ts. Types d'échange : shared/engagement/enseigner.ts.
import { integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import { devoirs } from "./evaluations";
import { seances } from "./live";
import type { StatutValidation } from "../engagement/enseigner";

/**
 * Décision facultative du formateur sur un devoir créé par la routine du soir
 * (devoirs_seances.devoir_ids) : « valide » le fait proposer tout de suite,
 * « a_revoir » le retire de ce que le campus met en avant (objectif du jour,
 * rappels). Sans ligne, la règle par défaut s'applique (server/engagement/proposables.ts).
 * Lue par proposables.ts : colonnes figées une fois fusionnées.
 */
export const validationsDevoirsAuto = campusSchema.table("validations_devoirs_auto", {
  devoirId: integer("devoir_id")
    .primaryKey()
    .references(() => devoirs.id, { onDelete: "cascade" }),
  statut: text("statut").$type<StatutValidation>().notNull(),
  parId: integer("par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
  le: timestamp("le", { withTimezone: true }).notNull().defaultNow(),
  remarque: text("remarque"),
});

/** Devoir de dépôt ouvert à partir du travail de groupe du cours complet d'une séance (un seul par séance). */
export const travauxGroupeDevoirs = campusSchema.table(
  "travaux_groupe_devoirs",
  {
    seanceId: integer("seance_id")
      .primaryKey()
      .references(() => seances.id, { onDelete: "cascade" }),
    devoirId: integer("devoir_id")
      .notNull()
      .references(() => devoirs.id, { onDelete: "cascade" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("travaux_groupe_devoirs_devoir_idx").on(t.devoirId)],
);

export type ValidationDevoirAuto = typeof validationsDevoirsAuto.$inferSelect;
export type TravailGroupeDevoir = typeof travauxGroupeDevoirs.$inferSelect;
