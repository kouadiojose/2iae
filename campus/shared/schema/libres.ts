// Portail des bibliothèques libres : index des livres lisibles gratuitement et
// légalement (Project Gutenberg, Internet Archive, OpenStax, Banque mondiale,
// OAPEN). Le serveur le moissonne lui-même (server/libres/moisson.ts) ; les
// étudiants y cherchent sans IA et lisent les livres sur le campus.
import { serial, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { campusSchema } from "./base";
import type { DomaineLibre, FormatLibre, SourceLibre } from "./ext-libres";

export const catalogueLibre = campusSchema.table(
  "catalogue_libre",
  {
    id: serial("id").primaryKey(),
    source: text("source").$type<SourceLibre>().notNull(),
    /** Identifiant chez la source (n° Gutenberg, identifiant Internet Archive, handle…). */
    ident: text("ident").notNull(),
    titre: text("titre").notNull(),
    auteurs: text("auteurs").notNull().default(""),
    annee: integer("annee"),
    /** Code ISO à deux lettres (« fr », « en »). */
    langue: text("langue"),
    sujets: text("sujets").notNull().default(""),
    domaines: text("domaines").array().$type<DomaineLibre[]>().notNull().default(sql`'{}'::text[]`),
    description: text("description"),
    couverture: text("couverture"),
    format: text("format").$type<FormatLibre>().notNull(),
    /** Page du livre sur le site de sa bibliothèque. */
    lien: text("lien").notNull(),
    /** Lien direct du PDF (trouvé à la moisson, ou à la première lecture). */
    pdf: text("pdf"),
    /** Lien du texte brut (Gutenberg, Banque mondiale) ou de la version web à lire (OpenStax). */
    texte: text("texte"),
    licence: text("licence"),
    /** Téléchargements chez la source (classement quand on parcourt un rayon). */
    popularite: integer("popularite").notNull().default(0),
    /** Ouvertures sur le campus (« les plus lus au campus »). */
    lectures: integer("lectures").notNull().default(0),
    /** Titre, auteurs et sujets en minuscules sans accents : la recherche plein texte porte dessus. */
    recherche: text("recherche").notNull(),
    vuLe: timestamp("vu_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("catalogue_libre_source_ident_idx").on(t.source, t.ident),
    index("catalogue_libre_recherche_idx").using("gin", sql`to_tsvector('simple', ${t.recherche})`),
    index("catalogue_libre_domaines_idx").using("gin", t.domaines),
    index("catalogue_libre_popularite_idx").on(t.popularite),
  ],
);

/** Dernière moisson de chaque bibliothèque (progression visible par la direction). */
export const moissonsLibres = campusSchema.table("moissons_libres", {
  source: text("source").$type<SourceLibre>().primaryKey(),
  statut: text("statut").$type<"en_cours" | "terminee" | "erreur">().notNull(),
  nombre: integer("nombre").notNull().default(0),
  debut: timestamp("debut", { withTimezone: true }).notNull().defaultNow(),
  fin: timestamp("fin", { withTimezone: true }),
  message: text("message"),
});

export type LivreLibre = typeof catalogueLibre.$inferSelect;
export type NouveauLivreLibre = typeof catalogueLibre.$inferInsert;
