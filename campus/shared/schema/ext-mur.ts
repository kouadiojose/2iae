// Le mur du cours (José, 15 octobre 2026 : « un blog pour poster mes liens, mes fichiers ») : les messages des
// professeurs d'un cours, lus par les étudiants du cours et par l'espace du campus (server/mur.ts, routes/mur.ts).
// Migration 0037_mur_du_cours.
import { sql } from "drizzle-orm";
import { serial, text, integer, timestamp, jsonb, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, fichiers } from "./base";
import { cours } from "./cours";

export type LienPublication = { url: string; titre: string; youtubeId: string | null };

export const publicationsCours = campusSchema.table(
  "publications_cours",
  {
    id: serial("id").primaryKey(),
    coursId: integer("cours_id").notNull().references(() => cours.id, { onDelete: "cascade" }),
    auteurId: integer("auteur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    texte: text("texte").notNull().default(""),
    liens: jsonb("liens").$type<LienPublication[]>().notNull().default(sql`'[]'::jsonb`),
    /** Clé d'envoi (file hors ligne) : un même envoi rejoué ne crée pas deux messages. */
    cleEnvoi: text("cle_envoi"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("publications_cours_cours_idx").on(t.coursId, t.id), uniqueIndex("publications_cours_cle_idx").on(t.auteurId, t.cleEnvoi)],
);

export const fichiersPublications = campusSchema.table(
  "fichiers_publications",
  {
    publicationId: integer("publication_id").notNull().references(() => publicationsCours.id, { onDelete: "cascade" }),
    fichierId: integer("fichier_id").notNull().references(() => fichiers.id, { onDelete: "cascade" }),
    ordre: integer("ordre").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.publicationId, t.fichierId] }), uniqueIndex("fichiers_publications_fichier_idx").on(t.fichierId)],
);

export type PublicationCours = typeof publicationsCours.$inferSelect;
