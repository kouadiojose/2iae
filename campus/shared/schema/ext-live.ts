// Tables et types propres au module « live » (classe en direct), ajoutés
// pendant sa construction. Les types *Dto décrivent ce que l'API envoie au
// client (dates en chaînes ISO) : serveur et client partagent ainsi le même
// contrat.
import { serial, text, integer, timestamp, jsonb, primaryKey, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import { seances, questionsLive, type EtapePlan, type FournisseurVisio, type StatutSeance, type ModePresence } from "./live";
import type { EnCours } from "../api";

/** Rappels déjà envoyés (24 h et 15 min avant) : garantit un seul envoi par séance. */
export const rappelsLive = campusSchema.table(
  "rappels_live",
  {
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    type: text("type").$type<"24h" | "15min">().notNull(),
    envoyeLe: timestamp("envoye_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.seanceId, t.type] })],
);

/** « Signaler » une question du live (modération) : une fois par personne. */
export const signalementsQuestions = campusSchema.table(
  "signalements_questions",
  {
    questionId: integer("question_id").notNull().references(() => questionsLive.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.utilisateurId] })],
);

export const TYPES_EVENEMENT_SEANCE = ["demarrage", "fin", "annulation", "plan_b", "diapo", "parole", "parole_fin", "incident", "incident_resolu"] as const;
export type TypeEvenementSeance = (typeof TYPES_EVENEMENT_SEANCE)[number];

/**
 * Fil horodaté de la séance : changements de diapo (rattrapage, replay),
 * prises de parole (« pas encore parlé », temps de parole), Plan B,
 * incidents de salle. Sert au bilan.
 */
export const evenementsSeances = campusSchema.table(
  "evenements_seances",
  {
    id: serial("id").primaryKey(),
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    type: text("type").$type<TypeEvenementSeance>().notNull(),
    donnees: jsonb("donnees").$type<Record<string, unknown>>().notNull().default({}),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evenements_seances_idx").on(t.seanceId, t.creeLe)],
);

/** « Revu en replay » : suivi à part, ne vaut jamais présence (CONCEPTION §9.7). */
export const vuesReplay = campusSchema.table(
  "vues_replay",
  {
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    premiereVue: timestamp("premiere_vue", { withTimezone: true }).notNull().defaultNow(),
    derniereVue: timestamp("derniere_vue", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.seanceId, t.utilisateurId] })],
);

// ── Contrats d'API du module live ──────────────────────────────────────────

/** Rôle de la personne dans une séance. */
export type RoleSeance = "formateur" | "etudiant" | "salle" | "equipe";

/** Façon de suivre le live : vidéo, radio (son + diapos) ou compagnon (dans la salle). */
export type ModeSuivi = "video" | "radio" | "compagnon";

/** Statuts de présence (CONCEPTION §9.7). */
export type StatutPresence = "salle" | "en_ligne" | "retard" | "partiel" | "absent" | "justifie" | "incident";

export type SiteLive = { id: number; nom: string; nomCourt: string; salleConference: string; ordre: number };

export type DiapoDto = { index: number; fichierId: number; url: string };

export type SeanceDetailDto = {
  id: number;
  coursId: number;
  coursCode: string;
  coursTitre: string;
  coursCouleur: string;
  titre: string;
  description: string;
  debut: string;
  dureeMinutes: number;
  statut: StatutSeance;
  fournisseur: FournisseurVisio;
  /** Lien de la visio externe (fournisseur « externe »). */
  lienExterne: string | null;
  /** Lien de secours préparé (formateur et équipe seulement). */
  lienSecours: string | null;
  /** Plan B déclenché : le lien est alors visible par tous. */
  planB: string | null;
  plan: EtapePlan[];
  demarreeLe: string | null;
  termineeLe: string | null;
  motifAnnulation: string | null;
  diapos: DiapoDto[];
  diapoCourante: number;
  proposeSurSite: boolean;
  publierSurSite: boolean;
  replayDisponible: boolean;
  resumeValide: boolean;
  formateur: { id: number; prenom: string; nom: string; localisation: string | null; photoUrl: string | null } | null;
  monRole: RoleSeance;
  /**
   * Préparer, modifier, dupliquer : formateur du cours, direction, vie scolaire
   * d'un cours propre à son campus. Faux pour la vie scolaire d'un campus sur
   * un cours partagé : elle suit le bilan et la présence de son site.
   */
  peutModifier: boolean;
  monSite: SiteLive | null;
  maPresence: { mode: ModePresence; minutes: number; emargeQr: boolean; statut: StatutPresence } | null;
  sites: SiteLive[];
  iaDisponible: boolean;
  /** Le serveur sait transformer un PDF en images (pdftoppm présent). */
  pdfAccepte: boolean;
  /** Fournisseurs utilisables sur ce serveur (choix à la création). */
  fournisseursDisponibles: FournisseurVisio[];
};

export type QuestionDirectDto = {
  id: number;
  texte: string;
  votes: number;
  siteId: number | null;
  /** « Yopougon » (jamais de nom sur l'écran de salle). */
  site: string | null;
  /** « Aya K. », ou null si la question est anonyme pour les camarades. */
  auteur: string | null;
  anonyme: boolean;
  repondue: boolean;
  epinglee: boolean;
  masquee: boolean;
  reponduLe: string | null;
  creeLe: string;
  jaiVote: boolean;
  mienne: boolean;
  /** Formateur et équipe : auteur réel (modération) et signalements. */
  auteurReel?: string;
  signalements?: number;
};

export type MainDirectDto = {
  id: number;
  siteId: number | null;
  site: string | null;
  /** Main levée pour toute la salle (écran ou responsable de salle). */
  pourSalle: boolean;
  /** « Aya K. » (formateur et équipe) ou « Salle Kédjénou ». */
  nom: string;
  leveeLe: string;
  paroleDonneeLe: string | null;
  /** N'a pas encore eu la parole pendant cette séance. */
  pasEncoreParle: boolean;
  utilisateurId?: number;
};

export type ParoleDto = {
  type: "salle" | "etudiant";
  siteId: number | null;
  site: string | null;
  utilisateurId: number | null;
  /** « M'Batto » ou « Un étudiant en ligne · Yopougon » (jamais de nom). */
  libelle: string;
  depuis: string;
};

export type SondageDto = {
  id: number;
  question: string;
  options: string[];
  /** Connue des étudiants seulement une fois le sondage fermé. */
  bonneReponse: number | null;
  explication: string | null;
  ouvert: boolean;
  ouvertLe: string | null;
  fermeLe: string | null;
  parIa: boolean;
  monChoix: number | null;
};

export type ResultatsSondageDto = {
  sondageId: number;
  total: number;
  parOption: number[];
  parSite: { siteId: number | null; site: string; total: number; parOption: number[] }[];
};

export type BarometreSiteDto = { siteId: number | null; site: string; compris: number; perdu: number; lent: number; bravo: number; total: number };

export type CampusDirectDto = {
  siteId: number;
  nom: string;
  nomCourt: string;
  salle: string;
  /** Étudiants émargés dans la salle (code ou pointage). */
  emarges: number;
  /** Étudiants de ce site qui suivent en ligne en ce moment. */
  enLigne: number;
  effectif: number | null;
  prete: boolean;
  incident: string | null;
  /** L'écran de la salle est connecté (le campus « s'allume » sur la carte). */
  salleConnectee: boolean;
  mainLevee: boolean;
};

export type SousTitreDto = { id: number; t: number; texte: string };

/** GET /api/seances/:id/direct — tout l'état du direct en un appel, puis le temps réel prend le relais. */
export type EtatDirectDto = {
  seanceId: number;
  statut: StatutSeance;
  demarreeLe: string | null;
  planB: string | null;
  motifAnnulation: string | null;
  diapo: { index: number; total: number; url: string | null };
  questions: QuestionDirectDto[];
  sondage: SondageDto | null;
  resultats: ResultatsSondageDto | null;
  barometre: BarometreSiteDto[];
  campus: CampusDirectDto[];
  /** Étudiants connectés en ligne (hors salles). */
  enLigne: number;
  parole: ParoleDto | null;
  sousTitres: SousTitreDto[];
  /** Formateur et équipe : toute la file ; salle : sa salle ; étudiant : sa main. */
  mains: MainDirectDto[];
};

export type RejoindreDto = {
  fournisseur: FournisseurVisio;
  url: string | null;
  jeton?: string;
  nomAffiche: string;
  /** Message clair quand la visio n'est pas disponible (repli). */
  message?: string;
};

export type CodeSalleDto = {
  siteId: number;
  site: string;
  salle: string;
  code: string;
  url: string;
  /** QR (SVG) qui contient l'adresse d'émargement avec le code. */
  qrSvg: string;
  /** Millisecondes avant le prochain code. */
  expireDansMs: number;
};

export type EmargementDto = {
  seanceId: number;
  titre: string;
  site: string;
  salle: string;
  heure: string;
  dejaEmarge: boolean;
  /** Émargé dans la salle d'un autre campus que le sien : accepté, signalé à la vie scolaire. */
  horsCampus: boolean;
  /** Campus de rattachement de l'étudiant (« Yopougon »). */
  monSite: string | null;
};

export type LignePresenceDto = {
  utilisateurId: number;
  prenom: string;
  nom: string;
  matricule: string | null;
  /** Campus où la présence a été prise (salle d'émargement), sinon le campus de l'étudiant. */
  siteId: number | null;
  /** Campus de rattachement de l'étudiant. */
  siteInscription: number | null;
  statut: StatutPresence;
  minutes: number;
  mode: ModePresence | null;
  emargeQr: boolean;
  pointe: boolean;
  justification: string | null;
  arriveeLe: string | null;
  /** Heure d'arrivée dans la salle (émargement), qui fait foi pour le retard. */
  arriveeSalleLe: string | null;
  /** Émargé dans la salle d'un autre campus que le sien (à confirmer par la vie scolaire). */
  horsCampus: boolean;
};

export type BilanSiteDto = {
  siteId: number | null;
  site: string;
  inscrits: number;
  enSalle: number;
  enLigne: number;
  retard: number;
  partiel: number;
  absents: number;
  justifies: number;
  incident: number;
  effectifDeclare: number | null;
  /** Écart entre l'effectif déclaré et les émargés (signalé). */
  ecart: number | null;
  /** Incident en cours, ou incident résolu qui a touché la séance (« … · résolu »). */
  incidentSalle: string | null;
  /** Émargés dans cette salle alors qu'ils sont rattachés à un autre campus. */
  horsCampus: number;
};

export type BilanDto = {
  seanceId: number;
  titre: string;
  statut: StatutSeance;
  debut: string;
  demarreeLe: string | null;
  termineeLe: string | null;
  dureeMinutes: number;
  /**
   * La séance a réellement été démarrée. Une séance jamais démarrée (annulée,
   * « Séance non tenue ») ne compte ni présents ni absents.
   */
  tenue: boolean;
  /** Seuil de présence en ligne (70 % de la durée). */
  seuilMinutes: number;
  sites: BilanSiteDto[];
  totaux: { inscrits: number; presents: number; taux: number };
  questionsNonTraitees: QuestionDirectDto[];
  questionsTotal: number;
  sondages: (SondageDto & { resultats: ResultatsSondageDto })[];
  barometre: BarometreSiteDto[];
  planB: string | null;
  evenements: { type: TypeEvenementSeance; creeLe: string; libelle: string }[];
  fiche: { contenu: string | null; valide: boolean; parIa: boolean; le: string | null };
};

export type RattrapageDto = {
  depuis: string;
  minutesManquees: number;
  sousTitres: SousTitreDto[];
  questions: QuestionDirectDto[];
  diapos: { index: number; url: string | null; t: string }[];
  sondages: SondageDto[];
};

export type ReplayDto = {
  seance: { id: number; titre: string; coursId: number; coursCode: string; coursTitre: string; debut: string; dureeMinutes: number; statut: StatutSeance; formateur: string | null };
  video: { disponible: boolean; source: "daily" | "lien" | null; dureeSecondes: number | null; poidsEstimeMo: number | null };
  fiche: { contenu: string; le: string | null } | null;
  /** Formateur : brouillon non validé. */
  brouillon: { contenu: string; parIa: boolean } | null;
  transcription: SousTitreDto[];
  questions: QuestionDirectDto[];
  diapos: DiapoDto[];
};


/**
 * Événements temps réel du module live qui portent l'état utile, pour que
 * personne n'ait à relire l'API au même moment que tout le monde.
 */
/** « live » (canal personnel) : démarrage, fin ou annulation d'une séance. */
export type EvenementLiveDto = {
  seanceId: number;
  statut: StatutSeance;
  /** État complet de GET /api/live/en-cours pour la personne ; absent : relire (avec un délai aléatoire). */
  enCours?: EnCours;
};

/** « live:mains » (canal personnel) : l'état de SA main (étudiant) ou de celle de sa salle (écran de salle). */
export type EvenementMainsDto = { seanceId: number; mains: MainDirectDto[] };

/** « mains » (canal de la séance) : seulement le compteur, utile à tous. */
export type CompteurMainsDto = { total: number };

/** POST /api/seances/:id/presence — battement de présence (un par minute). */
export type BattementPresenceDto =
  | { compte: false; raison: "hors_direct" | "flux_ferme" }
  | {
      compte: true;
      mode: ModePresence;
      suivi: ModeSuivi;
      /** Minutes distinctes suivies. */
      minutes: number;
      seuil: number;
      statut: StatutPresence;
      /**
       * Heure (serveur) du battement précédent quand il date de plus de 2 min :
       * le client demande « Voici ce que tu as raté » depuis cette heure-là.
       */
      absenceDepuis: string | null;
    };
