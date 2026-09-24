// Socle du campus : sites, classes, comptes et fichiers.
//
// Toutes les tables vivent dans le schéma PostgreSQL « campus » (voir
// drizzle.config.ts) : le campus peut partager la base du site sans
// collision, ou disposer de sa propre base.
import { pgSchema, serial, text, integer, boolean, timestamp, jsonb, json, varchar, index } from "drizzle-orm/pg-core";

export const campusSchema = pgSchema("campus");

export const ROLES = ["etudiant", "formateur", "vie_scolaire", "admin", "salle"] as const;
export type Role = (typeof ROLES)[number];

export const LIBELLES_ROLES: Record<Role, string> = {
  etudiant: "Étudiant",
  formateur: "Formateur",
  vie_scolaire: "Vie scolaire",
  admin: "Direction",
  salle: "Salle de conférence",
};

/** Les cinq sites du groupe, chacun doté d'une salle de conférence connectée. */
export const sites = campusSchema.table("sites", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nom: text("nom").notNull(), // « Abidjan · Yopougon »
  nomCourt: text("nom_court").notNull(), // « Yopougon »
  ville: text("ville").notNull(),
  salleConference: text("salle_conference").notNull(), // « Salle Kédjénou »
  /** Numéro WhatsApp de la vie scolaire du site (bouton « Besoin d'aide ? »), chiffres avec indicatif : 2250700000000. */
  whatsappVieScolaire: text("whatsapp_vie_scolaire"),
  ordre: integer("ordre").notNull().default(0),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Une classe = un groupe d'étudiants d'un site, d'une filière et d'un niveau. */
export const classes = campusSchema.table(
  "classes",
  {
    id: serial("id").primaryKey(),
    nom: text("nom").notNull(), // « BTS Informatique · 2e année »
    siteId: integer("site_id").notNull().references(() => sites.id),
    filiere: text("filiere").notNull(),
    niveau: text("niveau").notNull(), // « BTS 1 », « Licence 3 »…
    anneeScolaire: text("annee_scolaire").notNull(), // « 2026-2027 »
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("classes_site_idx").on(t.siteId)],
);

export type PreferencesUtilisateur = {
  /** Mode données réduites : live en basse définition, images allégées. */
  donneesReduites?: boolean;
  /** Comment l'étudiant suit le plus souvent les cours. */
  modeSuivi?: "salle" | "telephone" | "ordinateur";
  /** Notifications push acceptées. */
  push?: boolean;
  /** Visite guidée terminée. */
  visiteFaite?: boolean;
};

export const utilisateurs = campusSchema.table(
  "utilisateurs",
  {
    id: serial("id").primaryKey(),
    role: text("role").$type<Role>().notNull(),
    prenom: text("prenom").notNull(),
    nom: text("nom").notNull(),
    /** Identifiant principal des étudiants (beaucoup n'ont pas d'e-mail). */
    matricule: text("matricule").unique(),
    email: text("email").unique(),
    /** Pas unique : un téléphone peut être partagé (frères et sœurs, parent). Le matricule fait foi. */
    telephone: text("telephone"),
    motDePasseHash: text("mot_de_passe_hash").notNull(),
    /** Vrai tant que le mot de passe provisoire n'a pas été remplacé. */
    doitChangerMotDePasse: boolean("doit_changer_mot_de_passe").notNull().default(true),
    /** Fin de validité du code provisoire (30 jours après sa remise). */
    motDePasseExpireLe: timestamp("mot_de_passe_expire_le", { withTimezone: true }),
    siteId: integer("site_id").references(() => sites.id),
    classeId: integer("classe_id").references(() => classes.id),
    photoUrl: text("photo_url"),
    // Profil public des formateurs (repris sur le site vitrine)
    slug: text("slug").unique(),
    titre: text("titre"), // « Consultant en intelligence artificielle »
    bio: text("bio"),
    localisation: text("localisation"), // « Paris, France »
    /** Le formateur accepte que sa fiche soit publiée sur www.2iae.com (révocable). */
    consentementSite: boolean("consentement_site").notNull().default(false),
    /** Fiche proposée à la publication, en attente de validation par la direction. */
    proposeSurSite: boolean("propose_sur_site").notNull().default(false),
    /** Formateur annoncé sur www.2iae.com (validé par la direction). */
    publierSurSite: boolean("publier_sur_site").notNull().default(false),
    annonceLe: timestamp("annonce_le", { withTimezone: true }),
    /** Charte d'utilisation (IA, enregistrement des lives, données) acceptée. */
    charteAccepteeLe: timestamp("charte_acceptee_le", { withTimezone: true }),
    preferences: jsonb("preferences").$type<PreferencesUtilisateur>().notNull().default({}),
    /** Jeton personnel du flux d'agenda .ics (abonnement Google Agenda). */
    jetonAgenda: text("jeton_agenda").unique(),
    /** Jeton du relevé partageable aux parents (lien public révocable). */
    jetonReleve: text("jeton_releve").unique(),
    actif: boolean("actif").notNull().default(true),
    derniereConnexion: timestamp("derniere_connexion", { withTimezone: true }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("utilisateurs_classe_idx").on(t.classeId),
    index("utilisateurs_role_idx").on(t.role),
    index("utilisateurs_telephone_idx").on(t.telephone),
  ],
);

/** Jetons de réinitialisation du mot de passe (envoyés par e-mail, usage unique). */
export const reinitialisations = campusSchema.table("reinitialisations", {
  id: serial("id").primaryKey(),
  utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
  jetonHash: text("jeton_hash").notNull().unique(),
  /** activation : QR de la fiche de connexion · reinitialisation : lien « mot de passe oublié ». */
  type: text("type").$type<"activation" | "reinitialisation">().notNull().default("reinitialisation"),
  expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
  utiliseLe: timestamp("utilise_le", { withTimezone: true }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Fichiers déposés (ressources de cours, devoirs rendus, pièces jointes). */
export const fichiers = campusSchema.table("fichiers", {
  id: serial("id").primaryKey(),
  proprietaireId: integer("proprietaire_id").notNull().references(() => utilisateurs.id),
  nomOriginal: text("nom_original").notNull(),
  mime: text("mime").notNull(),
  taille: integer("taille").notNull(),
  /** Clé de stockage (chemin relatif dans UPLOADS_DIR). */
  cle: text("cle").notNull().unique(),
  /** Contexte d'usage, pour les contrôles d'accès : « lecon », « rendu », « message », « avatar »… */
  usage: text("usage").notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Notes de suivi de la vie scolaire sur un étudiant (appel, entretien, parent prévenu…). */
export const suivis = campusSchema.table(
  "suivis",
  {
    id: serial("id").primaryKey(),
    etudiantId: integer("etudiant_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    auteurId: integer("auteur_id").notNull().references(() => utilisateurs.id),
    texte: text("texte").notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suivis_etudiant_idx").on(t.etudiantId)],
);

/** Journal des actions sensibles (connexions, imports, notes modifiées…). */
export const journal = campusSchema.table(
  "journal",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id").references(() => utilisateurs.id),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("journal_date_idx").on(t.creeLe)],
);

export type Site = typeof sites.$inferSelect;
export type Classe = typeof classes.$inferSelect;
export type Utilisateur = typeof utilisateurs.$inferSelect;
export type Fichier = typeof fichiers.$inferSelect;

/** Ce que le client reçoit de l'utilisateur connecté (jamais le hash). */
export type Moi = Omit<Utilisateur, "motDePasseHash" | "jetonAgenda" | "jetonReleve" | "motDePasseExpireLe"> & {
  site: Pick<Site, "id" | "nom" | "nomCourt" | "salleConference" | "whatsappVieScolaire"> | null;
  classe: Pick<Classe, "id" | "nom" | "filiere" | "niveau"> | null;
};


/**
 * Sessions de connexion (connect-pg-simple). Déclarée ici pour que les
 * migrations la créent et que drizzle-kit ne la supprime jamais.
 */
export const sessions = campusSchema.table(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (t) => [index("IDX_session_expire").on(t.expire)],
);
