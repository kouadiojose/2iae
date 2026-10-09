// Tables et types propres au module « live » (classe en direct), ajoutés
// pendant sa construction. Les types *Dto décrivent ce que l'API envoie au
// client (dates en chaînes ISO) : serveur et client partagent ainsi le même
// contrat.
import { serial, text, integer, bigint, timestamp, jsonb, primaryKey, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import { seances, questionsLive, type EtapePlan, type FournisseurVisio, type StatutSeance, type ModePresence, type DispositionScene, type ModeChat, type ProjectionVideo, type TypeRessource, type ZoneCopie, type RotationCopie } from "./live";
import type { EnCours } from "../api";

/** Rappels déjà envoyés (24 h et 15 min avant) : garantit un seul envoi par séance. */
export const rappelsLive = campusSchema.table(
  "rappels_live",
  {
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    type: text("type").$type<"24h" | "jour" | "15min">().notNull(),
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

export const TYPES_EVENEMENT_SEANCE = ["demarrage", "fin", "annulation", "plan_b", "diapo", "parole", "parole_fin", "incident", "incident_resolu", "remise_a_venir", "groupes_ouverts", "groupes_fermes", "invite", "copie", "copie_fin"] as const;
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

/**
 * « Revu en replay » : suivi à part, ne vaut jamais présence (CONCEPTION §9.7). Les formateurs y sont aussi
 * (le « Nouveau » de leurs Enregistrements) : un décompte d'étudiants filtre sur le rôle.
 */
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

/**
 * Morceaux de l'enregistrement Daily d'une séance, dans l'ordre, quand le
 * replay en compte plusieurs (enregistrement relancé après une erreur, classe
 * rouverte après une coupure) : rien n'est perdu. Le premier morceau est
 * aussi seances.enregistrement_id ; replay_duree_secondes est leur somme.
 */
export const morceauxReplay = campusSchema.table(
  "morceaux_replay",
  {
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    enregistrementId: text("enregistrement_id").notNull(),
    debut: timestamp("debut", { withTimezone: true }).notNull(),
    dureeSecondes: integer("duree_secondes").notNull(),
  },
  (t) => [primaryKey({ columns: [t.seanceId, t.numero] })],
);

/**
 * Copie d'un enregistrement Daily dans le bucket des replays (Railway). Une
 * ligne par enregistrement (un cours coupé en morceaux en a plusieurs). Tant
 * qu'elle manque, le replay se lit chez Daily.
 */
export const replaysStockes = campusSchema.table(
  "replays_stockes",
  {
    enregistrementId: text("enregistrement_id").primaryKey(),
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    /** Clé de l'objet dans le bucket. */
    cle: text("cle").notNull(),
    tailleOctets: bigint("taille_octets", { mode: "number" }).notNull(),
    archiveLe: timestamp("archive_le", { withTimezone: true }).notNull().defaultNow(),
    /** La copie Daily a été effacée (après le délai de sécurité). */
    dailySupprimeLe: timestamp("daily_supprime_le", { withTimezone: true }),
  },
  (t) => [index("replays_stockes_seance_idx").on(t.seanceId)],
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

/** Ressource d'une séance : lien (YouTube ou autre) ou fichier déposé (vidéo, PDF, document). */
export type RessourceSeanceDto = {
  id: number;
  type: TypeRessource;
  titre: string;
  /** youtube et lien : l'adresse ; video et fichier : /api/fichiers/:id. */
  url: string;
  youtubeId: string | null;
  /** Fichier déposé : nom d'origine, type et poids (octets). */
  nom: string | null;
  mime: string | null;
  taille: number | null;
};

/** Vidéo projetée dans les salles (position à l'instant horodatage, horloge du serveur), avec sa ressource. */
export type ProjectionDto = ProjectionVideo & { ressource: RessourceSeanceDto };

// ── Copies d'étudiants montrées à la classe pendant le direct ──────────────

/**
 * Page d'une copie projetée, telle que la reçoit toute la classe : aucun nom (sauf choix du formateur),
 * aucune note, aucun identifiant de copie ni de fichier. L'image se lit à « url », valable tant que cette
 * page est à l'écran (410 ensuite).
 */
export type CopieProjeteeDto = {
  cle: string;
  /** /api/seances/:id/projection/contenu/:cle */
  url: string;
  source: "copie" | "corrige";
  devoirId: number;
  contenu: "image" | "texte" | "markdown";
  etiquette: string;
  devoirTitre: string;
  numero: number;
  total: number;
  zone: ZoneCopie;
  rotation: RotationCopie;
  nomVisible: boolean;
  enteteMasque: boolean;
  enteteDisponible: boolean;
  horodatage: number;
};

/** Corps de POST /api/seances/:id/projection/copie. */
export type CorpsProjectionCopie =
  | { source: "copie"; renduId: number; page: string; nomVisible?: boolean; enteteMasque?: boolean; rotation?: RotationCopie; confirmerOuvert?: boolean }
  | { source: "corrige"; devoirId: number; page: string };

/** Corps de PATCH /api/seances/:id/projection/copie : page (numéro absolu) et réglages. */
export type ReglageCopieDto = Partial<{ numero: number; zone: ZoneCopie; rotation: RotationCopie; nomVisible: boolean; enteteMasque: boolean }>;

/** Un moment montré à la classe pendant le cours, repéré dans le replay (secondes depuis le démarrage). */
export type MomentReplayDto = { t: number; libelle: string; dureeSecondes: number | null };

export type RaisonCorrigeRetenu = "absent" | "non_valide" | "avant_limite" | "retards" | "notes";
export type CorrigeDuDirectDto = { montrable: true; pages: number } | { montrable: false; raison: RaisonCorrigeRetenu; n?: number };

export type DevoirDuDirectDto = {
  id: number;
  titre: string;
  type: "depot" | "quiz";
  dateLimite: string;
  accepteRetard: boolean;
  /** Copies rendues, dans le périmètre de la personne. */
  copiesRendues: number;
  /** Inscrits, dans le périmètre de la personne. */
  inscrits: number;
  /** Étudiants de toute la classe qui peuvent encore rendre ou remplacer leur copie. */
  peuventEncoreRendre: number;
  etat: "projetable" | "ouvert" | "retards" | "quiz" | "vide";
  corrige: CorrigeDuDirectDto | null;
};
export type ListeDevoirsDuDirectDto = { coursCode: string; devoirs: DevoirDuDirectDto[]; suggestion: number | null };

export type CopieDuDirectDto = {
  renduId: number;
  prenom: string;
  /** « K. » */
  initiale: string;
  site: string | null;
  renduLe: string;
  enRetard: boolean;
  resume: { texte: boolean; photos: number; pdf: number; documents: number; videos: number; sons: number; autres: number };
};
export type ListeCopiesDuDirectDto = { devoir: DevoirDuDirectDto; copies: CopieDuDirectDto[] };

export type PageCopieDto = {
  /** « t1 », « f418 », « f418p3 », « c1 » */
  page: string;
  numero: number;
  /** « Texte saisi, page 1 sur 2 », « Photo 1 », « PDF 1, page 3 sur 5 » */
  libelle: string;
  contenu: "image" | "texte" | "markdown";
  /** Orientation EXIF quand pdftoppm manque, sinon 0. */
  rotation: RotationCopie;
  enteteDisponible: boolean;
  enteteParDefaut: boolean;
};
export type RaisonNonProjetable = "video" | "audio" | "heic" | "pdf" | "document" | "zip" | "format" | "erreur" | "taille" | "indisponible";
export type NonProjetableDto = { libelle: string; raison: RaisonNonProjetable; fichierId: number | null };
export type PlanCopieDto = {
  source: "copie" | "corrige";
  renduId: number | null;
  devoirId: number;
  version: string;
  /** « Awa K. » (animateur seulement). */
  nomCourt: string | null;
  pages: PageCopieDto[];
  nonProjetables: NonProjetableDto[];
  pagesEnTrop: number;
  /** Un document Office est en cours de conversion. */
  enPreparation: boolean;
};
export type PlanCorrigeDto = PlanCopieDto & { montrable: CorrigeDuDirectDto };

/** Ce que l'animateur sait en plus de la classe (surligner la copie projetée). */
export type ProjectionCopieAnimateurDto = { source: "copie" | "corrige"; devoirId: number; renduId: number | null; page: string; numero: number; total: number; parId: number };

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
  /** Liens et fichiers déposés par le formateur, dans son ordre. */
  ressources: RessourceSeanceDto[];
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
  /** Voir les devoirs et les copies du cours dans le Studio, et en montrer une à la classe (formateur du cours, direction, vie scolaire avec « notes »). */
  peutMontrerCopies: boolean;
  monSite: SiteLive | null;
  maPresence: { mode: ModePresence; minutes: number; emargeQr: boolean; statut: StatutPresence } | null;
  sites: SiteLive[];
  iaDisponible: boolean;
  /** Le serveur sait transformer un PDF en images (pdftoppm présent). */
  pdfAccepte: boolean;
  /** Le serveur sait transformer un PowerPoint (.pptx, .ppt, .odp) en images (LibreOffice présent). */
  presentationAcceptee: boolean;
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

/** Un message de la discussion du live (de la classe, privé, ou d'un groupe de travail). */
export type MessageLiveDto = {
  id: number;
  seanceId: number;
  /** Discussion d'un groupe de travail (null : discussion de la classe). */
  groupeId: number | null;
  /** « Aya K. », « José Kouadio », « Salle de conférence · Yopougon » ; écran de salle : « Un étudiant ». */
  auteur: string;
  role: "etudiant" | "formateur" | "salle" | "equipe";
  siteId: number | null;
  /** « Yopougon ». */
  site: string | null;
  texte: string;
  fichier: { id: number; nom: string; mime: string; taille: number; url: string } | null;
  creeLe: string;
  /** Pour reconnaître ses propres messages (on peut retirer les siens). */
  auteurId: number;
  /** Masqué par le formateur (visible seulement du formateur et de l'équipe, grisé). */
  masque: boolean;
  /** Message privé : son destinataire (« José Kouadio »), sinon null. */
  destinataireId: number | null;
  destinataire: string | null;
  /** Épinglé en haut de la discussion par le formateur. */
  epingle: boolean;
  reactions: { emoji: string; n: number }[];
  /** Mes réactions à ce message. */
  mesReactions: string[];
};

// ── Travail en groupes (salles séparées) ─────────────────────────────────

/** Une personne dans un groupe : un étudiant (« Aya K. ») ou une salle de campus entière. */
export type MembreGroupeDto = { id: number; nom: string; role: "etudiant" | "salle"; siteId: number | null; site: string | null };

export type GroupeTravailDto = {
  id: number;
  numero: number;
  nom: string;
  /** Formateur et équipe : tous les membres ; participant : ceux de son groupe seulement. */
  membres: MembreGroupeDto[];
  nbMembres: number;
  aideDemandeeLe: string | null;
};

export type GroupesDto = {
  session: {
    id: number;
    consigne: string;
    ouverteLe: string;
    finPrevueLe: string | null;
    /** Retour de tous en classe à cette heure (compte à rebours). */
    fermetureLe: string | null;
    retourLibre: boolean;
    choixLibre: boolean;
    annonce: string | null;
    annonceLe: string | null;
  } | null;
  groupes: GroupeTravailDto[];
  monGroupeId: number | null;
  /** Visio des groupes possible (Daily configuré) ; sinon, discussion écrite seulement. */
  visioDisponible: boolean;
};

/** Participant présent, à répartir (formateur et équipe). */
export type ParticipantGroupeDto = MembreGroupeDto & {
  /** Façon de suivre : visio ou son (en ligne), ou dans la salle (il suit alors sa salle). */
  mode: "video" | "radio" | "salle" | null;
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
  /**
   * masquee : le formateur a choisi « Caméras seules » (url vaut alors null, index garde la diapo où reprendre).
   * disposition : diapo en grand, côte à côte ou caméras en grand, quand la diapo est montrée.
   */
  diapo: { index: number; total: number; url: string | null; masquee?: boolean; disposition?: DispositionScene };
  /** Vidéo projetée à la place de la diapo, pilotée par le formateur. */
  projection: ProjectionDto | null;
  /** Page d'une copie montrée à la classe à la place de la diapo (null : aucune). */
  copie: CopieProjeteeDto | null;
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
  /** Qui écrit dans la discussion (réglage du formateur). */
  chatMode: ModeChat;
};

/**
 * GET /api/seances/:id/diapo — relecture légère (toutes les 2 s) quand le temps réel est coupé
 * ou retenu en route : la diapo et le statut suivent sans relire tout l'état du direct.
 */
export type DiapoDirectDto = { statut: StatutSeance; planB: string | null; diapo: EtatDirectDto["diapo"]; projection: ProjectionDto | null; copie: CopieProjeteeDto | null };

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
  /** Pas comptés, dans une salle qui n'a pas émargé (règle D1) : présence non relevée, jamais une absence. */
  inconnus: number;
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
  /** taux : présents / (attendus − justifiés − incidents − non relevés), null s'il ne reste personne à compter (tauxPresence). */
  totaux: { inscrits: number; presents: number; taux: number | null };
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
  video: {
    disponible: boolean;
    source: "daily" | "lien" | null;
    dureeSecondes: number | null;
    poidsEstimeMo: number | null;
    /** Enregistrement en plusieurs morceaux (numéro, durée, début en secondes depuis le début du premier) ; absent : un seul. */
    morceaux?: { numero: number; dureeSecondes: number; decalageSecondes: number }[];
  };
  fiche: { contenu: string; le: string | null } | null;
  /** Formateur : brouillon non validé. */
  brouillon: { contenu: string; parIa: boolean } | null;
  transcription: SousTitreDto[];
  questions: QuestionDirectDto[];
  diapos: DiapoDto[];
  ressources: RessourceSeanceDto[];
  /** Copies montrées à la classe pendant le cours : le moment, pas la copie. */
  moments: MomentReplayDto[];
  /** La personne anime ce cours (ou fait partie de l'équipe) : bilan et fiche à portée de clic. Faux pour un collègue formateur. */
  anime: boolean;
};

/** Un enregistrement vidéo dans la liste des formateurs (« Enregistrements »), tous cours confondus. */
export type ReplayResumeDto = {
  seanceId: number;
  titre: string;
  coursId: number;
  coursCode: string;
  coursTitre: string;
  debut: string;
  dureeSecondes: number | null;
  formateur: string | null;
  /** Séance d'un cours que la personne enseigne (ou qu'elle a animée). */
  mien: boolean;
  /** Pas encore ouvert par la personne, et prêt depuis moins de 14 jours. */
  nouveau: boolean;
};

export type ReplaysDto = { replays: ReplayResumeDto[]; nouveaux: number };


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

// ── Lien invité d'une séance (sans compte) ─────────────────────────────────

/** GET /api/seances/:id/lien-invite : le lien à partager, pour cette séance seulement. */
export type LienInviteDto = {
  url: string;
  valableJusquau: string;
  /** Même lien, avec micro et caméra (un intervenant) : direction, vie scolaire et formateur du cours seulement. */
  urlIntervenant?: string;
};

/** GET /api/invite/:jeton : ce qu'un invité voit de la séance (sans compte). */
export type InfoInviteDto = {
  seanceId: number;
  titre: string;
  cours: string;
  formateur: string | null;
  debut: string;
  fin: string;
  statut: StatutSeance;
  /** Le lien marche encore (jusqu'à 30 minutes après la fin prévue, séance non annulée). */
  valide: boolean;
  /** Vidéo possible (visio Daily) ; sinon, son + diapos seulement. */
  video: boolean;
  diapo: { index: number; total: number; masquee: boolean; url: string | null };
  sousTitre: string | null;
  /** Lien intervenant : vidéo avec micro et caméra. */
  intervenant: boolean;
  /** Le formateur montre une copie d'étudiant à la classe (jamais montrée aux invités). */
  copieMontree: boolean;
};
