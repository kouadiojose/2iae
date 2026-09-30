// Inscription de l'équipe administrative : la direction partage un lien, la
// personne remplit sa demande (nom, e-mail, fonction, mot de passe), et la
// direction la valide en choisissant son accès (vie scolaire d'un campus ou
// de tous, ou direction). Rien n'est ouvert avant cette validation.
import { serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, sites, type Role, type Moi } from "./base";

/**
 * equipe : demande validée par la direction (/rejoindre/<jeton>) ;
 * etudiants : l'étudiant crée son compte lui-même, ouvert aussitôt (/inscription/<jeton>).
 */
export const TYPES_LIEN_INSCRIPTION = ["equipe", "etudiants"] as const;
export type TypeLienInscription = (typeof TYPES_LIEN_INSCRIPTION)[number];

export const liensInscription = campusSchema.table("liens_inscription", {
  id: serial("id").primaryKey(),
  /** Morceau secret de l'adresse (/rejoindre/<jeton> ou /inscription/<jeton>), tiré au sort. */
  jeton: text("jeton").notNull().unique(),
  type: text("type").$type<TypeLienInscription>().notNull().default("equipe"),
  /** Lien des étudiants réservé à un campus (null : l'étudiant choisit son campus). */
  siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
  libelle: text("libelle").notNull().default("Équipe administrative"),
  creeParId: integer("cree_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
  revoqueLe: timestamp("revoque_le", { withTimezone: true }),
});

export const STATUTS_DEMANDE_ACCES = ["en_attente", "acceptee", "refusee"] as const;
export type StatutDemandeAcces = (typeof STATUTS_DEMANDE_ACCES)[number];

export const demandesAcces = campusSchema.table(
  "demandes_acces",
  {
    id: serial("id").primaryKey(),
    lienId: integer("lien_id").references(() => liensInscription.id, { onDelete: "set null" }),
    prenom: text("prenom").notNull(),
    nom: text("nom").notNull(),
    email: text("email").notNull(),
    telephone: text("telephone"),
    /** « Comptable », « Directeur des études »… */
    fonction: text("fonction").notNull().default(""),
    /** Campus où la personne travaille (null : siège, tous les campus). */
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    /** Mot de passe choisi à la demande (haché) : il devient celui du compte à la validation. */
    motDePasseHash: text("mot_de_passe_hash").notNull(),
    statut: text("statut").$type<StatutDemandeAcces>().notNull().default("en_attente"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    traiteLe: timestamp("traite_le", { withTimezone: true }),
    traiteParId: integer("traite_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    compteId: integer("compte_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    motif: text("motif"),
  },
  (t) => [index("demandes_acces_statut_idx").on(t.statut, t.creeLe)],
);

export type LienInscriptionDto = { id: number; url: string; libelle: string; creeLe: string; expireLe: string; demandes: number };

export type DemandeAccesDto = {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  fonction: string;
  siteId: number | null;
  site: string | null;
  statut: StatutDemandeAcces;
  creeLe: string;
  traiteLe: string | null;
  traitePar: string | null;
  /** Accès donné à la validation. */
  role: Role | null;
  motif: string | null;
};

export type EquipeInscriptionDto = { liens: LienInscriptionDto[]; demandes: DemandeAccesDto[] };

/** Ce que voit la personne qui ouvre le lien. */
export type InfoLienInscriptionDto = { expireLe: string; sites: { id: number; nomCourt: string }[] };

// ── Inscription des étudiants par lien ─────────────────────────────────────

export type LienEtudiantsDto = {
  id: number;
  url: string;
  libelle: string;
  /** Campus imposé par le lien (null : au choix de l'étudiant). */
  siteId: number | null;
  site: string | null;
  creeLe: string;
  expireLe: string;
  /** Comptes créés avec ce lien. */
  inscrits: number;
  /** Message prêt à envoyer (WhatsApp, groupe de classe). */
  message: string;
};

export type InscriptionEtudiantsDto = { liens: LienEtudiantsDto[]; sites: { id: number; nomCourt: string }[] };

/** GET /api/inscription/:jeton (public) : ce que voit l'étudiant qui ouvre le lien. */
export type InfoInscriptionEtudiantDto = {
  expireLe: string;
  sites: { id: number; nomCourt: string }[];
  /** Classes proposées : l'étudiant choisit sa filière, puis son niveau (1BTS, Licence 2, Certificat…). */
  classes: { id: number; nom: string; siteId: number; filiere: string; niveau: string }[];
  /** Campus imposé par le lien. */
  siteId: number | null;
  longueurMinimale: number;
  emailDisponible: boolean;
};

/** POST /api/inscription/:jeton : compte créé, session ouverte. */
export type InscriptionEtudiantFaite = {
  moi: Moi;
  matricule: string;
  classe: string;
  guide: { adresse: string | null; envoye: boolean };
};
