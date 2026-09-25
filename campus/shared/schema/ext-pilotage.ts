// Module « pilotage » (vie scolaire et direction).
//
// Le pilotage lit les tables des autres domaines (comptes, séances,
// présences, devoirs, notes, IA) et n'écrit que dans celles du socle qui lui
// reviennent : utilisateurs, classes, sites, suivis, journal, présences
// (justifications) et le jeton du relevé parent (utilisateurs.jetonReleve).
// Ses trois tables à lui : les lots d'import (rejouer un import dont la
// réponse s'est perdue) et l'historique des changements de classe.
//
// Ce fichier porte les règles communes (présence à 70 %, prix de l'IA) et les
// contrats d'API du module, partagés par le serveur et le client. Les dates
// voyagent en chaînes ISO.
import { serial, text, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, classes, type Role } from "./base";
import type { StatutSeance, FournisseurVisio } from "./live";
import type { Vitrine } from "../api";

// ── Tables ─────────────────────────────────────────────────────────────────

/**
 * Lot d'import (POST /api/pilotage/import/valider), identifié par le
 * navigateur. Si la réponse se perd (4G), relancer le même lot ne crée aucun
 * doublon : les comptes déjà créés reçoivent une nouvelle fiche.
 */
export const lotsImport = campusSchema.table("lots_import", {
  id: text("id").primaryKey(),
  auteurId: integer("auteur_id")
    .notNull()
    .references(() => utilisateurs.id, { onDelete: "cascade" }),
  /** Le navigateur a bien reçu les fiches (sinon : « Refaire les fiches » sur la page d'import). */
  remisLe: timestamp("remis_le", { withTimezone: true }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Comptes créés par chaque lot d'import. */
export const comptesLotsImport = campusSchema.table(
  "comptes_lots_import",
  {
    lotId: text("lot_id")
      .notNull()
      .references(() => lotsImport.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.lotId, t.utilisateurId] }), index("comptes_lots_import_utilisateur_idx").on(t.utilisateurId)],
);

/**
 * Changements de classe d'un étudiant (PATCH des comptes) : « dans cette
 * classe depuis telle date ». Un étudiant n'est attendu qu'aux séances (et
 * devoirs) de la classe où il était à ce moment-là : arrivé en cours d'année,
 * il n'est pas absent aux séances passées de sa nouvelle classe, et ses
 * séances dans l'ancienne classe restent à son dossier. Sans ligne ici : sa
 * classe actuelle, depuis la création du compte.
 */
export const passagesClasses = campusSchema.table(
  "passages_classes",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    /** null : pas de classe (compte qui n'était pas encore étudiant). */
    classeId: integer("classe_id").references(() => classes.id, { onDelete: "set null" }),
    depuis: timestamp("depuis", { withTimezone: true }).notNull(),
  },
  (t) => [index("passages_classes_utilisateur_idx").on(t.utilisateurId, t.depuis)],
);

// ── Règles ─────────────────────────────────────────────────────────────────

/** Présent en ligne à partir de 70 % de la durée de la séance (CONCEPTION §9.7). */
export const SEUIL_PRESENCE_EN_LIGNE = 0.7;

/** Au-delà de 15 minutes après le début, l'arrivée en salle compte comme un retard. */
export const RETARD_MINUTES = 15;

/** Prix de claude-opus-5, en dollars par million de jetons. */
export const PRIX_IA = { entree: 5, sortie: 25 } as const;

/** Un franc CFA vaut environ 1/600 de dollar : sert seulement à donner un ordre de grandeur. */
export const FCFA_PAR_DOLLAR = 600;

/**
 * Statut d'un étudiant attendu à une séance tenue (démarrée), décidé dans le
 * même ordre que le module live (statutPresence) : absence justifiée d'abord ;
 * en salle, émargé (QR ou code) ou pointé PRÉSENT par le responsable ; présent
 * en ligne (≥ 70 % de la durée tenue) ; incident de sa salle (personne n'est
 * compté absent) ; partiel (en ligne < 70 %) ; absent. Un étudiant pointé
 * « absent » garde ses minutes en ligne : il est en ligne, partiel ou absent.
 * Le taux de présence vaut présents / (attendus − justifiés − incidents).
 */
export const STATUTS_PRESENCE_PILOTAGE = ["emarge", "pointe", "en_ligne", "justifie", "incident", "partiel", "absent"] as const;
export type StatutPresencePilotage = (typeof STATUTS_PRESENCE_PILOTAGE)[number];

export const LIBELLES_PRESENCE_PILOTAGE: Record<StatutPresencePilotage, string> = {
  emarge: "Émargé en salle",
  pointe: "Pointé en salle",
  en_ligne: "Présent en ligne",
  justifie: "Absence justifiée",
  incident: "Incident de salle",
  partiel: "Partiel",
  absent: "Absent",
};

export const comptePresent = (s: StatutPresencePilotage) => s === "emarge" || s === "pointe" || s === "en_ligne";

/**
 * Taux de présence, UNE définition pour tout le campus (pilotage, bilan de
 * séance du live) : présents / (attendus − justifiés − incidents de salle),
 * arrondi au pour cent ; null quand il ne reste personne à compter.
 */
export function tauxPresence(r: { presents: number; attendus: number; justifies: number; incidents: number }): number | null {
  const base = r.attendus - r.justifies - r.incidents;
  return base > 0 ? Math.round((r.presents / base) * 100) : null;
}

// ── Tableau de pilotage ────────────────────────────────────────────────────

export type IndicateursCampus = {
  /** null : total du groupe (ou du périmètre). */
  siteId: number | null;
  nom: string;
  etudiants: number;
  actives: number;
  /** % des comptes activés (code secret choisi). */
  tauxActivation: number | null;
  /** Étudiants vus sur le campus ces 7 derniers jours. */
  actifs7j: number;
  /** % de présence aux lives tenus des 30 derniers jours (justifiés et incidents exclus). */
  presence30j: number | null;
  /** % de devoirs rendus parmi ceux échus depuis 30 jours. */
  devoirsRendus: number | null;
  aContacter: number;
};

/** GET /api/pilotage/tableau */
export type TableauPilotage = {
  perimetre: { tout: boolean; site: string | null };
  total: IndicateursCampus;
  campus: IndicateursCampus[];
  genereLe: string;
};

// ── À contacter ────────────────────────────────────────────────────────────

export type TypeRaisonContact = "jamais_active" | "inactif" | "lives_manques" | "devoir_non_rendu";

export const LIBELLES_RAISONS: Record<TypeRaisonContact, string> = {
  jamais_active: "Jamais activé",
  inactif: "Plus vu depuis 7 jours",
  lives_manques: "2 lives manqués",
  devoir_non_rendu: "Devoir non rendu",
};

export type RaisonContact = {
  type: TypeRaisonContact;
  /** « Compte créé il y a 12 jours, fiche jamais utilisée. » */
  texte: string;
  /** Ce qu'il faut faire : « Lui remettre une nouvelle fiche ». */
  action: string;
};

export type EtudiantResume = {
  id: number;
  prenom: string;
  nom: string;
  matricule: string | null;
  telephone: string | null;
  classe: string | null;
  siteId: number | null;
  site: string | null;
};

export type AContacter = {
  etudiant: EtudiantResume;
  raisons: RaisonContact[];
  derniereActivite: string | null;
  dernierSuivi: { texte: string; creeLe: string; auteur: string } | null;
  /** Lien wa.me avec un message prêt (null si le numéro manque). */
  whatsapp: string | null;
};

/**
 * GET /api/pilotage/a-contacter?raison=&site=&q=&page=&parPage= : filtré et
 * paginé par le serveur (1 000 étudiants, c'est près d'1 Mo en une fois).
 */
export type ListeAContacter = {
  /** Lignes qui passent tous les filtres (pagination). */
  total: number;
  /** Même chose sans le filtre de raison (onglet « Tous »). */
  tous: number;
  /** Par raison, sans le filtre de raison (compteurs des onglets). */
  parRaison: Record<TypeRaisonContact, number>;
  lignes: AContacter[];
  page: number;
  parPage: number;
};

// ── Comptes ────────────────────────────────────────────────────────────────

export type CompteLigne = {
  id: number;
  role: Role;
  prenom: string;
  nom: string;
  matricule: string | null;
  email: string | null;
  telephone: string | null;
  titre: string | null;
  localisation: string | null;
  siteId: number | null;
  site: string | null;
  classeId: number | null;
  classe: string | null;
  actif: boolean;
  /** Code secret personnel choisi (le code provisoire de la fiche a été remplacé). */
  active: boolean;
  codeExpireLe: string | null;
  derniereConnexion: string | null;
  creeLe: string;
};

/** GET /api/pilotage/comptes */
export type PageComptes = { lignes: CompteLigne[]; total: number; page: number; parPage: number };

/** Code montré UNE seule fois (création, nouveau code, fiches). */
export type CodeRemis = {
  code: string;
  lien: string;
  /** Lien wa.me avec le message prêt (vers le numéro de la personne, sinon au choix). */
  whatsapp: string;
  expireLe: string;
};

/** POST /api/pilotage/comptes */
export type CompteCree = CodeRemis & { compte: CompteLigne };

// ── Import ─────────────────────────────────────────────────────────────────

export type LigneImport = {
  /** Numéro de la ligne dans le texte collé (en-têtes = 1). */
  numero: number;
  matricule: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
  classeId: number | null;
  classe: string | null;
  siteId: number | null;
  site: string | null;
  /** Bloquant : la ligne ne sera pas créée. */
  erreurs: string[];
  /** Pour information : la ligne sera créée. */
  avertissements: string[];
};

/** POST /api/pilotage/import/apercu */
export type ApercuImport = {
  separateur: "tabulation" | "point-virgule" | "virgule";
  colonnes: { entete: string; champ: string | null }[];
  lignes: LigneImport[];
  valides: number;
  enErreur: number;
};

/** Une fiche de connexion à imprimer. */
export type FicheConnexion = {
  id: number;
  prenom: string;
  nom: string;
  role: Role;
  /** Ce que la personne tape pour se connecter : matricule, sinon e-mail. */
  identifiant: string;
  classe: string | null;
  site: string | null;
  code: string;
  lien: string;
  expireLe: string;
};

/** POST /api/pilotage/import/valider, POST /api/pilotage/fiches, POST /api/pilotage/import/lots/:id/fiches */
export type LotFiches = {
  fiches: FicheConnexion[];
  /** Fiches : désactivés, hors périmètre ou soi-même. Import : comptes du lot déjà activés (pas de nouvelle fiche). */
  ignores: number;
  /** Import : identifiant du lot (le relancer ne crée aucun doublon). */
  lotId?: string;
  /** Import relancé : comptes déjà créés par ce lot, qui reçoivent une nouvelle fiche. */
  repris?: number;
};

/** Étapes d'un travail long (import, fiches), pour la barre de progression. */
export type EtapeTravail = "verification" | "codes" | "enregistrement" | "liens" | "termine";

export const LIBELLES_ETAPES_TRAVAIL: Record<EtapeTravail, string> = {
  verification: "Vérification des lignes",
  codes: "Sécurisation des codes",
  enregistrement: "Enregistrement des comptes",
  liens: "Préparation des QR d'activation",
  termine: "C'est prêt",
};

/** GET /api/pilotage/progression/:id (le navigateur choisit l'identifiant et l'envoie avec sa demande). */
export type ProgressionTravail = { etape: EtapeTravail; faits: number; total: number; fini: boolean };

/** GET /api/pilotage/import/lots : imports dont les fiches n'ont jamais été reçues (réponse perdue). */
export type LotImportEnAttente = { id: string; creeLe: string; comptes: number; nonActives: number };

// ── Classes et sites ───────────────────────────────────────────────────────

export type ClasseLigne = {
  id: number;
  nom: string;
  siteId: number;
  site: string;
  filiere: string;
  niveau: string;
  anneeScolaire: string;
  etudiants: number;
  actives: number;
  cours: number;
};

export type SiteLigne = {
  id: number;
  nom: string;
  nomCourt: string;
  ville: string;
  salleConference: string;
  whatsappVieScolaire: string | null;
};

/** GET /api/pilotage/references : de quoi remplir les sélecteurs (dans le périmètre). */
export type ReferencesPilotage = {
  sites: SiteLigne[];
  classes: { id: number; nom: string; siteId: number }[];
  /** La personne voit tout le groupe (direction, ou vie scolaire sans site). */
  toutLeGroupe: boolean;
  estDirection: boolean;
};

export type FormateurOption = { id: number; prenom: string; nom: string; titre: string | null; localisation: string | null; actif: boolean };

// ── Cours (vue du pilotage) ────────────────────────────────────────────────

/** GET /api/pilotage/cours : les cours avec formateur, classes et campus. */
export type CoursPilotage = {
  id: number;
  code: string;
  titre: string;
  couleur: string;
  statut: string;
  formateurId: number | null;
  formateur: string | null;
  classes: { id: number; nom: string; siteId: number }[];
  etudiants: number;
  prochaineSeance: string | null;
  proposeSurSite: boolean;
  publierSurSite: boolean;
};

// ── Planning ───────────────────────────────────────────────────────────────

export type SeancePlanning = {
  id: number;
  titre: string;
  coursId: number;
  coursCode: string;
  coursTitre: string;
  couleur: string;
  debut: string;
  fin: string;
  dureeMinutes: number;
  statut: StatutSeance;
  fournisseur: FournisseurVisio;
  motifAnnulation: string | null;
  formateur: string | null;
  sites: { id: number; nomCourt: string }[];
  classes: string[];
  /** Séances qui occupent la même salle de conférence au même moment. */
  conflits: number[];
};

export type ConflitSalle = { a: number; b: number; sites: string[] };

/** GET /api/pilotage/planning?semaine=AAAA-MM-JJ (lundi) */
export type PlanningSemaine = { debut: string; fin: string; seances: SeancePlanning[]; conflits: ConflitSalle[] };

// ── Présences ──────────────────────────────────────────────────────────────

export type ResumePresences = {
  attendus: number;
  emarge: number;
  pointe: number;
  en_ligne: number;
  justifie: number;
  incident: number;
  partiel: number;
  absent: number;
  presents: number;
  /** Présents / (attendus − justifiés − incidents), en %. */
  taux: number | null;
};

export type SeancePresenceLigne = {
  id: number;
  titre: string;
  coursCode: string;
  debut: string;
  statut: StatutSeance;
  resume: ResumePresences;
};

/** GET /api/pilotage/presences?semaine=… : séances passées (ou en cours) de la semaine. */
export type ListePresences = { debut: string; fin: string; seances: SeancePresenceLigne[] };

export type PresenceEtudiant = {
  id: number;
  prenom: string;
  nom: string;
  matricule: string | null;
  classe: string | null;
  statut: StatutPresencePilotage;
  minutes: number;
  arriveeLe: string | null;
  retard: boolean;
  justification: string | null;
};

export type PresencesCampus = ResumePresences & {
  siteId: number | null;
  site: string;
  /** Effectif déclaré par le responsable de salle. */
  effectifDeclare: number | null;
  salle: { prete: boolean; incident: string | null } | null;
  /** Écart entre les présents en salle validés et l'effectif déclaré. */
  ecart: number | null;
  etudiants: PresenceEtudiant[];
};

/** GET /api/pilotage/presences/seance/:id */
export type PresencesSeance = {
  seance: { id: number; titre: string; coursId: number; coursCode: string; coursTitre: string; debut: string; dureeMinutes: number; statut: StatutSeance; formateur: string | null };
  /** Durée qui sert au calcul des 70 % (durée réelle si la séance a eu lieu). */
  dureeReference: number;
  seuil: number;
  /** Minutes en ligne à atteindre pour être présent (même calcul que le live). */
  seuilMinutes: number;
  aVenir: boolean;
  /** Heure passée mais jamais démarrée : personne n'y est compté absent. */
  nonTenue: boolean;
  total: ResumePresences;
  campus: PresencesCampus[];
};

export type LignePresenceEtudiant = {
  seanceId: number;
  titre: string;
  coursCode: string;
  debut: string;
  statut: StatutPresencePilotage;
  minutes: number;
  retard: boolean;
  justification: string | null;
};

/** GET /api/pilotage/presences/etudiant/:id */
export type PresencesDEtudiant = {
  etudiant: EtudiantResume;
  resume: ResumePresences;
  seances: LignePresenceEtudiant[];
};

// ── Site 2iae.com ──────────────────────────────────────────────────────────

export type TypePublication = "cours" | "formateur" | "seance" | "annonce";

export type ElementSite = {
  type: TypePublication;
  id: number;
  titre: string;
  sousTitre: string | null;
  texte: string | null;
  couleur: string | null;
  imageUrl: string | null;
  date: string | null;
  propose: boolean;
  publie: boolean;
  /** Formateur : a donné son accord pour être présenté sur le site (révocable). */
  consentement: boolean | null;
  /** Pourquoi on ne peut pas publier (formateur sans accord, live passé…). */
  bloque: string | null;
  lienCampus: string | null;
};

/** GET /api/pilotage/site */
export type EtatSite = {
  elements: ElementSite[];
  webhookConfigure: boolean;
  urlSite: string;
  /** Ce que la vitrine publique renvoie au site en ce moment. */
  apercu: Vitrine;
  peutPublier: boolean;
};

// ── Dossier étudiant et relevé ─────────────────────────────────────────────

export type MoyenneCours = { coursId: number; code: string; titre: string; moyenne: number | null; notes: number };

export type DevoirDossier = {
  id: number;
  titre: string;
  coursCode: string;
  type: "depot" | "quiz";
  dateLimite: string;
  /** a_venir, rendu, en_retard (rendu après l'échéance), non_rendu, corrige */
  etat: "a_venir" | "rendu" | "en_retard" | "non_rendu" | "corrige";
  note: number | null;
  bareme: number;
};

/** GET /api/pilotage/etudiants/:id */
export type DossierEtudiant = {
  etudiant: EtudiantResume & { email: string | null; photoUrl: string | null; actif: boolean; creeLe: string; anneeScolaire: string | null };
  activation: { active: boolean; codeExpireLe: string | null; charteAccepteeLe: string | null };
  derniereConnexion: string | null;
  derniereActivite: string | null;
  presences: { resume: ResumePresences; seances: LignePresenceEtudiant[] };
  devoirs: DevoirDossier[];
  notes: { cours: MoyenneCours[]; generale: number | null };
  suivis: { id: number; texte: string; auteur: string; creeLe: string }[];
  releve: { lien: string; whatsapp: string; consultations: number; partageLe: string | null } | null;
  whatsapp: string | null;
};

/** POST /api/pilotage/etudiants/:id/releve */
export type ReleveCree = { lien: string; whatsapp: string };

/** GET /api/releve/:jeton — public, sans connexion : le strict nécessaire pour un parent. */
export type ReleveParent = {
  etudiant: { prenom: string; nom: string };
  classe: string | null;
  campus: string | null;
  anneeScolaire: string | null;
  moyennes: { code: string; titre: string; moyenne: number | null; notes: number }[];
  moyenneGenerale: number | null;
  presence: { taux: number | null; seances: number; presents: number; justifiees: number };
  date: string;
};

// ── Budget IA ──────────────────────────────────────────────────────────────

export type ConsommationIa = { requetes: number; jetonsEntree: number; jetonsSortie: number; cout: number };

/** GET /api/pilotage/ia */
export type BudgetIa = {
  iaDisponible: boolean;
  modele: string;
  quotaJour: number;
  prix: typeof PRIX_IA;
  total: ConsommationIa;
  parJour: (ConsommationIa & { jour: string })[];
  parPersonne: (ConsommationIa & { id: number; prenom: string; nom: string; role: Role; site: string | null })[];
  parRole: (ConsommationIa & { role: Role })[];
};
