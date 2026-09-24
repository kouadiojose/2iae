// Tables propres au module « compte ».
//
// Le « devoir d'essai » du premier jour : l'étudiant photographie n'importe
// quelle feuille et reçoit un reçu numéroté, exactement comme pour un vrai
// devoir. Ce n'est ni un devoir ni une note : on garde seulement la trace
// (pour sauter l'étape au prochain passage et pour le suivi d'activation).
import { serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";

export const essaisDepot = campusSchema.table(
  "essais_depot",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    /** Numéro de reçu montré à l'étudiant (« 2IAE-4F7K »). */
    recu: text("recu").notNull().unique(),
    /** Photos envoyées (usage « rendu », propriété de l'étudiant). */
    fichierIds: jsonb("fichier_ids").$type<number[]>().notNull().default([]),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("essais_depot_utilisateur_idx").on(t.utilisateurId)],
);

export type EssaiDepot = typeof essaisDepot.$inferSelect;

/** GET /api/compte/parcours : ce qu'il reste à faire dans le parcours de bienvenue. */
export type ParcoursBienvenue = {
  /** Le code secret personnel est choisi (le code provisoire de la fiche a été remplacé). */
  codeChoisi: boolean;
  charteAcceptee: boolean;
  modeSuiviChoisi: boolean;
  visiteFaite: boolean;
  /** Dernier devoir d'essai (étudiants), null s'il n'a jamais été fait. */
  essai: { recu: string; heure: string } | null;
  /** Longueur minimale du code secret pour ce compte (6 étudiants et salles, 10 personnel). */
  longueurMinimale: number;
};

/** GET /api/compte/contacts-sites : WhatsApp de la vie scolaire de chaque campus (public). */
export type ContactSite = { id: number; nom: string; nomCourt: string; whatsapp: string | null };

/** GET /api/compte/reinitialiser/:jeton : le lien reçu par e-mail est-il encore valable ? */
export type EtatLienReinitialisation = { prenom: string; longueurMinimale: number; codeChiffres: boolean };

/** POST /api/compte/essai-depot */
export type RecuEssai = { recu: string; heure: string };
