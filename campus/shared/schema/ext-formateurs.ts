// Inscription des formateurs par un lien personnel : la direction crée un
// lien pour un formateur (/inscription-formateur/<jeton>), à usage unique.
// Le formateur y entre lui-même son nom, son e-mail, son téléphone, son
// titre et son mot de passe : son compte est créé aussitôt (ou, si la
// direction avait déjà créé sa fiche, complété), il est connecté, et il
// reçoit par e-mail le guide pas à pas du formateur.
//
// Pourquoi sans validation, à la différence de l'équipe administrative ? Le
// lien est nominatif et ne sert qu'une fois : il vaut l'invitation elle-même.
// Un lien qui a servi, expiré ou été désactivé ne crée plus rien.
import { serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, type Moi } from "./base";

export const liensFormateurs = campusSchema.table(
  "liens_formateurs",
  {
    id: serial("id").primaryKey(),
    /** Morceau secret de l'adresse (/inscription-formateur/<jeton>), tiré au sort. */
    jeton: text("jeton").notNull().unique(),
    /** Nom prévu par la direction (pré-rempli dans le formulaire, modifiable par le formateur). */
    prenom: text("prenom").notNull().default(""),
    nom: text("nom").notNull().default(""),
    /** Fiche formateur déjà créée par la direction (emploi du temps) : le lien la complète au lieu d'en créer une autre. */
    compteId: integer("compte_id").references(() => utilisateurs.id, { onDelete: "cascade" }),
    creeParId: integer("cree_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
    revoqueLe: timestamp("revoque_le", { withTimezone: true }),
    /** Le formateur a créé son compte avec ce lien : il ne sert plus. */
    utiliseLe: timestamp("utilise_le", { withTimezone: true }),
    /** Le compte créé (ou complété) avec ce lien. */
    compteCreeId: integer("compte_cree_id").references(() => utilisateurs.id, { onDelete: "set null" }),
  },
  (t) => [index("liens_formateurs_cree_idx").on(t.creeLe)],
);

export type StatutLienFormateur = "actif" | "utilise" | "expire" | "desactive";

export type LienFormateurDto = {
  id: number;
  url: string;
  /** « Claude Trépanier », ou vide si la direction n'a pas mis de nom. */
  pour: string;
  /** Fiche existante que le lien complète. */
  compteId: number | null;
  statut: StatutLienFormateur;
  creeLe: string;
  expireLe: string;
  utiliseLe: string | null;
  /** Nom et e-mail donnés par le formateur en créant son compte. */
  compteCree: { id: number; nom: string; email: string | null } | null;
  /** Texte prêt à envoyer (WhatsApp, SMS, e-mail). */
  message: string;
};

export type LiensFormateursDto = {
  liens: LienFormateurDto[];
  /** Fiches de formateurs pas encore activées : un lien peut les compléter. */
  fichesAActiver: { id: number; nom: string; titre: string | null }[];
  emailDisponible: boolean;
};

/** Ce que voit le formateur qui ouvre son lien. */
export type InfoLienFormateurDto = {
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  titre: string | null;
  localisation: string | null;
  expireLe: string;
  /** Sa fiche existe déjà (il figure dans l'emploi du temps) : il la complète. */
  ficheExistante: boolean;
  /** Longueur minimale du mot de passe. */
  minimumMotDePasse: number;
};

/** Réponse à l'inscription : le compte est créé et la session ouverte. */
export type InscriptionFormateurFaite = {
  prenom: string;
  email: string;
  /** Le guide est parti par e-mail. */
  guideEnvoye: boolean;
  guideUrl: string;
  /** La personne connectée (session ouverte par l'inscription). */
  moi: Moi;
};
