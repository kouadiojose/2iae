// Module « CRM des étudiants » (vie scolaire et direction).
//
// Le compte d'un étudiant (utilisateurs) reste la source de vérité pour
// l'identité de connexion, la classe et le campus. Le CRM y ajoute :
// - le dossier administratif (état civil, famille, statut de scolarité) ;
// - les pièces du dossier (reçues au guichet, ou déposées par l'étudiant) ;
// - le suivi (journal typé dans « suivis ») et les relances à échéance ;
// - la scolarité : frais par classe, échéancier de chaque étudiant,
//   versements avec reçu numéroté, jamais effacés (annulation tracée) ;
// - le lien avec le pipeline des préinscrits du site 2iae.com (leadId).
//
// Montants en francs CFA entiers. Dates « jour » en chaînes AAAA-MM-JJ
// (heure d'Abidjan = UTC), horodatages en ISO.
import { serial, text, integer, timestamp, jsonb, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, classes, fichiers } from "./base";
import type { CompteCree } from "./ext-pilotage";

// ── Référentiels ───────────────────────────────────────────────────────────

export const STATUTS_SCOLARITE = ["inscrit", "suspendu", "abandon", "diplome", "transfere"] as const;
export type StatutScolarite = (typeof STATUTS_SCOLARITE)[number];
export const LIBELLES_STATUTS_SCOLARITE: Record<StatutScolarite, string> = {
  inscrit: "Inscrit",
  suspendu: "Suspendu",
  abandon: "Abandon",
  diplome: "Diplômé",
  transfere: "Transféré",
};

export const LIENS_RESPONSABLE = ["pere", "mere", "tuteur", "autre"] as const;
export type LienResponsable = (typeof LIENS_RESPONSABLE)[number];
export const LIBELLES_LIENS_RESPONSABLE: Record<LienResponsable, string> = {
  pere: "Père",
  mere: "Mère",
  tuteur: "Tuteur ou tutrice",
  autre: "Autre",
};

/** Parent, tuteur ou personne à prévenir. */
export type Responsable = {
  nom: string;
  lien: LienResponsable;
  telephone: string | null;
  email: string | null;
  profession: string | null;
  /** Contact principal : celui qu'on appelle en premier (relances, paiements). */
  principal: boolean;
};

export const TYPES_PIECES = ["extrait_naissance", "photo", "piece_identite", "diplome", "bulletins", "certificat_medical", "autre"] as const;
export type TypePiece = (typeof TYPES_PIECES)[number];
export const LIBELLES_PIECES: Record<TypePiece, string> = {
  extrait_naissance: "Extrait d'acte de naissance",
  photo: "Photo d'identité",
  piece_identite: "Pièce d'identité (CNI, passeport, attestation)",
  diplome: "Dernier diplôme ou attestation (BEPC, BAC…)",
  bulletins: "Bulletins de notes de l'année précédente",
  certificat_medical: "Certificat médical",
  autre: "Autre pièce",
};
/** Le dossier est complet quand ces pièces sont toutes reçues (validées). */
export const PIECES_REQUISES: TypePiece[] = ["extrait_naissance", "photo", "piece_identite", "diplome", "bulletins"];

/** a_verifier : déposée par l'étudiant, à contrôler · recue : validée par l'équipe · refusee : à refaire. */
export const STATUTS_PIECE = ["a_verifier", "recue", "refusee"] as const;
export type StatutPiece = (typeof STATUTS_PIECE)[number];

export const TYPES_SUIVI = ["note", "appel", "whatsapp", "sms", "rendez_vous", "email", "famille"] as const;
export type TypeSuivi = (typeof TYPES_SUIVI)[number];
export const LIBELLES_TYPES_SUIVI: Record<TypeSuivi, string> = {
  note: "Note",
  appel: "Appel",
  whatsapp: "WhatsApp",
  sms: "SMS",
  rendez_vous: "Rendez-vous",
  email: "E-mail",
  famille: "Échange avec la famille",
};

export const MOYENS_PAIEMENT = ["especes", "wave", "orange_money", "mtn_money", "moov_money", "virement", "cheque", "autre"] as const;
export type MoyenPaiement = (typeof MOYENS_PAIEMENT)[number];
export const LIBELLES_MOYENS_PAIEMENT: Record<MoyenPaiement, string> = {
  especes: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  mtn_money: "MTN Mobile Money",
  moov_money: "Moov Money",
  virement: "Virement bancaire",
  cheque: "Chèque",
  autre: "Autre",
};

/** Une ligne d'échéancier : « 1re tranche, 31 octobre, 150 000 F ». */
export type LigneEcheancier = { libelle: string; date: string | null; montant: number };

// ── Tables ─────────────────────────────────────────────────────────────────

/** Dossier administratif d'un étudiant (une ligne par étudiant, créée à la première saisie). */
export const dossiersEtudiants = campusSchema.table(
  "dossiers_etudiants",
  {
    etudiantId: integer("etudiant_id")
      .primaryKey()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    sexe: text("sexe").$type<"F" | "M">(),
    dateNaissance: date("date_naissance", { mode: "string" }),
    lieuNaissance: text("lieu_naissance"),
    nationalite: text("nationalite"),
    /** Commune, quartier. */
    adresse: text("adresse"),
    /** Numéro WhatsApp s'il diffère du téléphone du compte. */
    whatsapp: text("whatsapp"),
    statut: text("statut").$type<StatutScolarite>().notNull().default("inscrit"),
    statutLe: timestamp("statut_le", { withTimezone: true }),
    dateInscription: date("date_inscription", { mode: "string" }),
    responsables: jsonb("responsables").$type<Responsable[]>().notNull().default([]),
    origine: text("origine").$type<"saisie" | "import" | "site">().notNull().default("saisie"),
    /** Identifiant du préinscrit dans le pipeline du site 2iae.com. */
    leadId: text("lead_id").unique(),
    remarques: text("remarques"),
    modifieLe: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dossiers_etudiants_statut_idx").on(t.statut)],
);

/** Pièces du dossier : reçues au guichet (sans fichier) ou scannées, ou déposées par l'étudiant. */
export const piecesDossier = campusSchema.table(
  "pieces_dossier",
  {
    id: serial("id").primaryKey(),
    etudiantId: integer("etudiant_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    type: text("type").$type<TypePiece>().notNull(),
    /** Intitulé libre pour « autre ». */
    libelle: text("libelle"),
    fichierId: integer("fichier_id").references(() => fichiers.id, { onDelete: "set null" }),
    statut: text("statut").$type<StatutPiece>().notNull().default("recue"),
    /** Motif d'un refus, ou précision (« original vu, copie gardée »). */
    note: text("note"),
    ajouteeParId: integer("ajoutee_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    verifieeParId: integer("verifiee_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    verifieeLe: timestamp("verifiee_le", { withTimezone: true }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pieces_dossier_etudiant_idx").on(t.etudiantId), index("pieces_dossier_statut_idx").on(t.statut)],
);

/** Relances à faire : « rappeler le père pour la 2e tranche », avant telle date. */
export const tachesSuivi = campusSchema.table(
  "taches_suivi",
  {
    id: serial("id").primaryKey(),
    etudiantId: integer("etudiant_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    titre: text("titre").notNull(),
    echeance: date("echeance", { mode: "string" }).notNull(),
    responsableId: integer("responsable_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeParId: integer("cree_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    faiteLe: timestamp("faite_le", { withTimezone: true }),
    faiteParId: integer("faite_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("taches_suivi_etudiant_idx").on(t.etudiantId), index("taches_suivi_ouvertes_idx").on(t.faiteLe, t.echeance)],
);

/** Frais d'une classe pour son année : l'échéancier modèle, copié à chaque étudiant inscrit. */
export const fraisClasses = campusSchema.table("frais_classes", {
  classeId: integer("classe_id")
    .primaryKey()
    .references(() => classes.id, { onDelete: "cascade" }),
  echeancier: jsonb("echeancier").$type<LigneEcheancier[]>().notNull().default([]),
  modifieLe: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow(),
  modifieParId: integer("modifie_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
});

/** Échéancier d'un étudiant (frais) et ses remises (bourse, fratrie…). */
export const echeancesEtudiants = campusSchema.table(
  "echeances_etudiants",
  {
    id: serial("id").primaryKey(),
    etudiantId: integer("etudiant_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    anneeScolaire: text("annee_scolaire").notNull(),
    type: text("type").$type<"frais" | "remise">().notNull().default("frais"),
    libelle: text("libelle").notNull(),
    /** Toujours positif ; une remise se soustrait. */
    montant: integer("montant").notNull(),
    dateLimite: date("date_limite", { mode: "string" }),
    creeParId: integer("cree_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("echeances_etudiants_etudiant_idx").on(t.etudiantId, t.anneeScolaire)],
);

/**
 * Versements encaissés. Jamais supprimés : une erreur s'annule (motif,
 * auteur, date) et le reçu garde son numéro. Le compte de l'étudiant ne peut
 * pas être supprimé tant qu'il a des versements (clé étrangère sans cascade).
 */
export const versements = campusSchema.table(
  "versements",
  {
    id: serial("id").primaryKey(),
    /** « REC-2026-00042 » : numéro de reçu, suivi par année civile. */
    numero: text("numero").notNull(),
    etudiantId: integer("etudiant_id")
      .notNull()
      .references(() => utilisateurs.id),
    anneeScolaire: text("annee_scolaire").notNull(),
    montant: integer("montant").notNull(),
    moyen: text("moyen").$type<MoyenPaiement>().notNull(),
    /** Référence de la transaction (Wave, Orange Money…), numéro de chèque. */
    reference: text("reference"),
    dateVersement: date("date_versement", { mode: "string" }).notNull(),
    note: text("note"),
    encaisseParId: integer("encaisse_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    annuleLe: timestamp("annule_le", { withTimezone: true }),
    annuleParId: integer("annule_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    motifAnnulation: text("motif_annulation"),
  },
  (t) => [
    uniqueIndex("versements_numero_unique").on(t.numero),
    index("versements_etudiant_idx").on(t.etudiantId),
    index("versements_date_idx").on(t.dateVersement),
  ],
);

export type DossierEtudiantLigne = typeof dossiersEtudiants.$inferSelect;
export type PieceDossierLigne = typeof piecesDossier.$inferSelect;
export type EcheanceEtudiantLigne = typeof echeancesEtudiants.$inferSelect;
export type VersementLigneBrute = typeof versements.$inferSelect;

// ── Contrats d'API ─────────────────────────────────────────────────────────

/** Où en est l'étudiant de ses paiements (null : aucun échéancier). */
export type SituationFinanciere = {
  anneeScolaire: string;
  /** Frais − remises. */
  du: number;
  /** Versements non annulés. */
  paye: number;
  reste: number;
  /** Échéances passées pas encore couvertes. */
  retard: number;
  /** Prochaine échéance pas encore couverte. */
  prochaine: { libelle: string; date: string | null; reste: number } | null;
};

export type EtudiantCrmLigne = {
  id: number;
  prenom: string;
  nom: string;
  matricule: string | null;
  telephone: string | null;
  photoUrl: string | null;
  classeId: number | null;
  classe: string | null;
  siteId: number | null;
  site: string | null;
  statut: StatutScolarite;
  origine: "saisie" | "import" | "site";
  /** Compte désactivé. */
  actif: boolean;
  /** Code secret personnel choisi (le code de la fiche a été remplacé). */
  compteActive: boolean;
  derniereConnexion: string | null;
  pieces: { recues: number; requises: number; aVerifier: number };
  finances: SituationFinanciere | null;
  tachesOuvertes: number;
  /** Une relance ouverte a dépassé son échéance. */
  tacheEnRetard: boolean;
  creeLe: string;
};

export const FILTRES_CRM = ["incomplets", "a_verifier", "retard", "non_actives", "relances", "sans_frais"] as const;
export type FiltreCrm = (typeof FILTRES_CRM)[number];

/** GET /api/pilotage/etudiants */
export type PageEtudiantsCrm = {
  lignes: EtudiantCrmLigne[];
  total: number;
  page: number;
  parPage: number;
  /** Sur tout le périmètre (campus et classe filtrés), pas seulement la page. */
  indicateurs: {
    etudiants: number;
    comptesActives: number;
    dossiersIncomplets: number;
    piecesAVerifier: number;
    enRetard: number;
    montantRetard: number;
    relancesDuJour: number;
    sansFrais: number;
  };
};

/** POST /api/pilotage/etudiants : inscription complète en une fois. */
export type NouvelEtudiant = {
  prenom: string;
  nom: string;
  /** Vide : proposé par le serveur (« 26TC0042 »). */
  matricule?: string | null;
  classeId: number;
  telephone?: string | null;
  email?: string | null;
  sexe?: "F" | "M" | null;
  dateNaissance?: string | null;
  lieuNaissance?: string | null;
  nationalite?: string | null;
  adresse?: string | null;
  whatsapp?: string | null;
  dateInscription?: string | null;
  responsables?: Responsable[];
  remarques?: string | null;
  /** Pièces remises au guichet le jour de l'inscription. */
  piecesRecues?: TypePiece[];
  /** Copier l'échéancier de la classe (par défaut : oui, s'il existe). */
  appliquerFrais?: boolean;
  premierVersement?: { montant: number; moyen: MoyenPaiement; reference?: string | null; dateVersement?: string | null } | null;
  /** Préinscrit du site 2iae.com transformé en étudiant. */
  leadId?: string | null;
};

/** Réponse de POST /api/pilotage/etudiants. */
export type EtudiantCree = CompteCree & { etudiantId: number; matricule: string; versementId: number | null };

/** GET /api/pilotage/etudiants/matricule?classe=ID */
export type MatriculePropose = { matricule: string };

export type PieceDossier = {
  /** null : pièce requise pas encore reçue. */
  id: number | null;
  type: TypePiece;
  libelle: string;
  requise: boolean;
  statut: StatutPiece | "manquante";
  note: string | null;
  fichier: { id: number; nom: string; url: string } | null;
  ajouteePar: string | null;
  creeLe: string | null;
};

export type SuiviCrm = { id: number; type: TypeSuivi; texte: string; auteur: string; creeLe: string };

export type TacheSuivi = {
  id: number;
  etudiantId: number;
  titre: string;
  echeance: string;
  responsable: { id: number; nom: string } | null;
  creePar: string | null;
  faiteLe: string | null;
  faitePar: string | null;
  enRetard: boolean;
  creeLe: string;
};

export type EcheanceEtat = {
  id: number;
  type: "frais" | "remise";
  libelle: string;
  montant: number;
  /** Montant après les remises (qui s'imputent sur les dernières échéances). */
  net: number;
  dateLimite: string | null;
  /** Part couverte par les versements (dans l'ordre des échéances). */
  couvert: number;
  etat: "payee" | "partielle" | "en_retard" | "a_venir" | "remise";
};

export type VersementCrm = {
  id: number;
  numero: string;
  montant: number;
  moyen: MoyenPaiement;
  reference: string | null;
  dateVersement: string;
  note: string | null;
  encaissePar: string | null;
  creeLe: string;
  annule: { le: string; par: string | null; motif: string | null } | null;
};

export type ScolariteEtudiant = {
  anneeScolaire: string | null;
  echeances: EcheanceEtat[];
  versements: VersementCrm[];
  situation: SituationFinanciere | null;
  /** Échéancier modèle de sa classe actuelle (null : pas de frais saisis pour la classe). */
  fraisClasse: LigneEcheancier[] | null;
};

export type IdentiteCrm = {
  sexe: "F" | "M" | null;
  dateNaissance: string | null;
  lieuNaissance: string | null;
  nationalite: string | null;
  adresse: string | null;
  whatsapp: string | null;
  statut: StatutScolarite;
  statutLe: string | null;
  dateInscription: string | null;
  origine: "saisie" | "import" | "site";
  leadId: string | null;
  remarques: string | null;
  responsables: Responsable[];
};

/** GET /api/pilotage/etudiants/:id/crm (le reste du dossier : GET /api/pilotage/etudiants/:id). */
export type DossierCrm = {
  identite: IdentiteCrm;
  pieces: PieceDossier[];
  suivis: SuiviCrm[];
  taches: TacheSuivi[];
  scolarite: ScolariteEtudiant;
  /** Personnes de l'équipe à qui confier une relance. */
  equipe: { id: number; nom: string }[];
  /** Liens WhatsApp prêts (étudiant, responsables), null sans numéro. */
  contacts: { libelle: string; telephone: string; whatsapp: string | null }[];
};

/** GET /api/pilotage/relances */
export type ListeRelances = {
  enRetard: (TacheSuivi & { etudiant: { id: number; prenom: string; nom: string; classe: string | null } })[];
  aujourdhui: (TacheSuivi & { etudiant: { id: number; prenom: string; nom: string; classe: string | null } })[];
  aVenir: (TacheSuivi & { etudiant: { id: number; prenom: string; nom: string; classe: string | null } })[];
  faitesRecemment: (TacheSuivi & { etudiant: { id: number; prenom: string; nom: string; classe: string | null } })[];
};

export type FraisClasseLigne = {
  classeId: number;
  classe: string;
  siteId: number;
  site: string;
  anneeScolaire: string;
  effectif: number;
  echeancier: LigneEcheancier[];
  total: number;
  /** Étudiants de la classe sans échéancier pour l'année de la classe. */
  sansEcheancier: number;
  modifieLe: string | null;
};

/** GET /api/pilotage/frais-classes */
export type ListeFraisClasses = { classes: FraisClasseLigne[] };

export type LigneRetard = {
  etudiant: { id: number; prenom: string; nom: string; matricule: string | null };
  classe: string | null;
  site: string | null;
  retard: number;
  reste: number;
  dernierVersement: string | null;
  /** Lien WhatsApp (responsable principal, sinon l'étudiant) avec un message poli prêt. */
  whatsapp: string | null;
  contact: string | null;
};

/** GET /api/pilotage/scolarite */
export type TableauScolarite = {
  indicateurs: {
    attendu: number;
    encaisse: number;
    reste: number;
    retard: number;
    etudiantsEnRetard: number;
    encaisseJour: number;
    encaisseMois: number;
    etudiantsSansEcheancier: number;
  };
  parMoyen: { moyen: MoyenPaiement; montant: number; nombre: number }[];
  retards: LigneRetard[];
  derniersVersements: (VersementCrm & { etudiant: { id: number; prenom: string; nom: string; matricule: string | null }; classe: string | null })[];
};

/** GET /api/pilotage/versements/:id/recu et GET /api/mon-dossier/versements/:id/recu */
export type RecuPaiement = {
  numero: string;
  dateVersement: string;
  montant: number;
  montantEnLettres: string;
  moyen: MoyenPaiement;
  reference: string | null;
  etudiant: { prenom: string; nom: string; matricule: string | null };
  classe: string | null;
  site: string | null;
  anneeScolaire: string;
  encaissePar: string | null;
  /** Situation juste après ce versement (versements valides jusqu'à celui-ci inclus). */
  apres: { du: number; paye: number; reste: number } | null;
  annule: { le: string; motif: string | null } | null;
  emisLe: string;
};

/** Préinscrit du pipeline du site 2iae.com. */
export type PreinscritSite = {
  id: string;
  nom: string | null;
  telephone: string | null;
  email: string | null;
  campus: string | null;
  filiere: string | null;
  etape: string;
  source: string;
  notes: string | null;
  creeLe: string | null;
  /** Déjà transformé en étudiant du campus. */
  etudiant: { id: number; prenom: string; nom: string; matricule: string | null } | null;
};

/** GET /api/pilotage/preinscrits */
export type ListePreinscrits = {
  /** La passerelle répond (secret et adresse du site configurés, site à jour). */
  branche: boolean;
  message: string | null;
  preinscrits: PreinscritSite[];
};

/** GET /api/mon-dossier (l'étudiant, sur son propre dossier). */
export type MonDossier = {
  identite: {
    prenom: string;
    nom: string;
    matricule: string | null;
    classe: string | null;
    site: string | null;
    statut: StatutScolarite;
    dateInscription: string | null;
  };
  pieces: PieceDossier[];
  scolarite: ScolariteEtudiant;
  /** Lien WhatsApp vers la vie scolaire du campus (questions sur un paiement). */
  whatsappVieScolaire: string | null;
};
