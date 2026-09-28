// Tables et contrats d'API propres au module « evaluations » : devoirs,
// interrogations (quiz), rendus, corrections et carnet de notes.
// Les tables principales (devoirs, rendus, questions_quiz, tentatives_quiz)
// sont dans ./evaluations.ts ; ici : la trace des rappels envoyés, puis les
// types échangés entre le serveur et le client (dates en chaînes ISO).
import { integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { campusSchema } from "./base";
import { devoirs, type TypeDevoir, type TypeQuestion, type StatutRendu, type CritereGrille, type PropositionIa } from "./evaluations";

/**
 * Rappels déjà envoyés pour un devoir, pour ne jamais prévenir deux fois :
 * « ouverture » (le devoir vient d'ouvrir) et « veille » (la veille de la
 * date limite, aux étudiants qui n'ont pas encore rendu). L'échéance est
 * gardée : si le formateur repousse la date limite, un nouveau rappel partira.
 */
export const rappelsDevoirs = campusSchema.table(
  "rappels_devoirs",
  {
    devoirId: integer("devoir_id").notNull().references(() => devoirs.id, { onDelete: "cascade" }),
    type: text("type").$type<"ouverture" | "veille">().notNull(),
    echeance: timestamp("echeance", { withTimezone: true }).notNull(),
    destinataires: integer("destinataires").notNull().default(0),
    envoyeLe: timestamp("envoye_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.devoirId, t.type] })],
);

// ── Contrats d'API ─────────────────────────────────────────────────────────

/** Fichier joint tel que le client le reçoit (lecture contrôlée par /api/fichiers/:id). */
export type PieceJointe = { id: number; nom: string; mime: string; taille: number; url: string };

/**
 * Où en est l'étudiant sur un devoir :
 * a_rendre · en_retard (échéance passée, retard accepté) · manque (échéance
 * passée, retard refusé) · en_cours (interrogation commencée) · rendu (✓) ·
 * vu par le formateur (✓✓) · corrige (note publiée).
 */
export type StatutDevoirEtudiant = "a_rendre" | "en_retard" | "manque" | "en_cours" | "rendu" | "vu" | "corrige";

type BaseDevoirResume = {
  id: number;
  type: TypeDevoir;
  titre: string;
  coursId: number;
  coursCode: string;
  coursTitre: string;
  couleur: string;
  dateLimite: string;
  ouvertureLe: string | null;
  bareme: number;
  coefficient: number;
  accepteRetard: boolean;
  dureeMinutes: number | null;
};

/** Ligne de « Mes devoirs » (étudiant) : uniquement SES informations. */
export type DevoirEtudiantResume = BaseDevoirResume & {
  statut: StatutDevoirEtudiant;
  renduLe: string | null;
  enRetard: boolean;
  recu: string | null;
  vuLe: string | null;
  /** Note publiée (null tant que le formateur n'a pas publié). */
  note: number | null;
};

export type CompteursCopies = {
  inscrits: number;
  /** Copies rendues (à l'heure ou en retard). */
  rendus: number;
  enRetard: number;
  /** À corriger : rendues, sans note encore (ou notées avant l'arrivée de la copie actuelle). */
  aCorriger: number;
  /** À publier : note posée sur la copie actuelle, pas encore publiée aux étudiants. */
  aPublier: number;
  /** Notes publiées aux étudiants. */
  publiees: number;
};

/** Ligne de la liste du formateur / de l'équipe, avec les compteurs de copies. */
export type DevoirEnseignantResume = BaseDevoirResume & {
  publie: boolean;
  compteurs: CompteursCopies;
  /** Faux pour la vie scolaire d'un campus sur un cours suivi aussi par d'autres campus (consultation seule). */
  modifiable: boolean;
};

/** GET /api/devoirs (et ?cours=<id>) : la vue dépend du rôle. */
export type ListeDevoirs = { vue: "etudiant"; devoirs: DevoirEtudiantResume[] } | { vue: "enseignant"; devoirs: DevoirEnseignantResume[] };

export type LigneNoteDetail = { critere: string; points: number; obtenu: number };

/** Copie de l'étudiant, vue par lui-même. La note n'apparaît qu'une fois publiée. */
export type RenduEtudiant = {
  id: number;
  statut: StatutRendu;
  texte: string;
  fichiers: PieceJointe[];
  renduLe: string | null;
  prepareLe: string | null;
  enRetard: boolean;
  recu: string | null;
  vuLe: string | null;
  deposeParEquipe: boolean;
  note: number | null;
  noteDetail: LigneNoteDetail[] | null;
  commentaire: string | null;
  commentaireAudio: PieceJointe | null;
  corrigeLe: string | null;
  correcteur: { prenom: string; nom: string } | null;
};

/** Question d'interrogation vue par l'étudiant : jamais les bonnes réponses avant la correction. */
export type QuestionEleve = { id: number; type: TypeQuestion; enonce: string; options: string[]; points: number };

/** Question avec la correction (après l'échéance, si le formateur l'a permis). */
export type QuestionCorrigee = QuestionEleve & {
  bonnesReponses: (number | string)[];
  explication: string | null;
  maReponse: (number | string)[] | null;
  juste: boolean;
  obtenu: number;
};

/** Question complète, pour le formateur. */
export type QuestionEnseignant = QuestionEleve & {
  bonnesReponses: (number | string)[];
  explication: string | null;
  ordre: number;
};

/** Question proposée par l'IA : brouillon à relire, pas encore enregistré. */
export type QuestionProposee = Omit<QuestionEnseignant, "id" | "ordre">;

export type EtatQuizEtudiant = {
  tentativesFaites: number;
  tentativesMax: number;
  nbQuestions: number;
  /** Tentative commencée dont le temps n'est pas écoulé (reprise après coupure). */
  enCours: { id: number; finPrevueLe: string | null } | null;
  meilleureNote: number | null;
  /** Correction détaillée (après l'échéance, si le formateur l'a permis). */
  correction: QuestionCorrigee[] | null;
  /** Quand la correction détaillée sera visible (null : jamais). */
  correctionLe: string | null;
};

/** GET /api/devoirs/:id vu par un étudiant. */
export type DevoirDetailEtudiant = {
  vue: "etudiant";
  devoir: BaseDevoirResume & {
    consigne: string;
    tentativesMax: number;
    correctionVisible: boolean;
    grille: CritereGrille[];
    piecesJointes: PieceJointe[];
    formateur: { id: number; prenom: string; nom: string } | null;
  };
  statut: StatutDevoirEtudiant;
  /** Il peut encore rendre (ou remplacer) sa copie maintenant. */
  peutRendre: boolean;
  /** Après la date limite, la copie rendue ne peut plus être remplacée. */
  peutRemplacer: boolean;
  rendu: RenduEtudiant | null;
  quiz: EtatQuizEtudiant | null;
};

/** GET /api/devoirs/:id vu par le formateur ou l'équipe (éditeur). */
export type DevoirDetailEnseignant = {
  vue: "enseignant";
  devoir: BaseDevoirResume & {
    consigne: string;
    publie: boolean;
    tentativesMax: number;
    correctionVisible: boolean;
    grille: CritereGrille[];
    piecesJointes: PieceJointe[];
  };
  questions: QuestionEnseignant[];
  compteurs: CompteursCopies;
  /** Des copies ou des tentatives existent : on ne change plus le type. */
  aDesRendus: boolean;
  iaDisponible: boolean;
  /** La personne peut modifier le devoir (formateur du cours, direction, vie scolaire d'un cours propre à son campus). */
  modifiable: boolean;
};

export type DevoirDetail = DevoirDetailEtudiant | DevoirDetailEnseignant;

/** Reçu de dépôt (POST /api/devoirs/:id/rendre) : la preuve à montrer. */
export type RecuDepot = {
  devoirId: number;
  titre: string;
  coursCode: string;
  recu: string;
  renduLe: string;
  enRetard: boolean;
  remplace: boolean;
  fichiers: PieceJointe[];
  aDuTexte: boolean;
};

export type EtudiantCopie = { id: number; prenom: string; nom: string; matricule: string | null; site: string | null };

/** Une ligne de la liste des copies (tous les inscrits, rendus ou non). */
export type CopieResume = {
  etudiant: EtudiantCopie;
  renduId: number | null;
  etat: "non_rendu" | "rendu" | "en_retard";
  renduLe: string | null;
  vuLe: string | null;
  note: number | null;
  /** La note est posée mais pas encore publiée. */
  noteBrouillon: boolean;
  publiee: boolean;
  nbFichiers: number;
  aPropositionIa: boolean;
  deposeParEquipe: boolean;
};

/** GET /api/devoirs/:id/copies */
export type ListeCopies = {
  devoir: {
    id: number;
    titre: string;
    type: TypeDevoir;
    bareme: number;
    grille: CritereGrille[];
    dateLimite: string;
    coursId: number;
    coursCode: string;
    coursTitre: string;
  };
  copies: CopieResume[];
  compteurs: CompteursCopies;
  iaDisponible: boolean;
  /**
   * La personne peut noter, publier et modifier le devoir. Faux pour la vie
   * scolaire d'un campus sur un cours suivi aussi par d'autres campus : elle
   * consulte les copies de ses étudiants et dépose les copies papier.
   */
  peutCorriger: boolean;
};

/** GET /api/rendus/:id : une copie dans la visionneuse du formateur. */
export type CopieDetail = {
  id: number;
  devoirId: number;
  etudiant: EtudiantCopie;
  statut: StatutRendu;
  texte: string;
  fichiers: PieceJointe[];
  renduLe: string | null;
  prepareLe: string | null;
  enRetard: boolean;
  vuLe: string | null;
  recu: string | null;
  note: number | null;
  noteDetail: LigneNoteDetail[] | null;
  commentaire: string | null;
  commentaireAudio: PieceJointe | null;
  propositionIa: PropositionIa | null;
  corrigeLe: string | null;
  deposePar: { prenom: string; nom: string } | null;
  /** Interrogation : réponses de la meilleure tentative, question par question. */
  reponsesQuiz: QuestionCorrigee[] | null;
};

/** POST /api/quiz/:devoirId/commencer : la tentative (nouvelle ou reprise). */
export type QuizEnCours = {
  tentative: { id: number; debutLe: string; finPrevueLe: string | null; reponses: Record<string, (number | string)[]> };
  questions: QuestionEleve[];
  devoir: { id: number; titre: string; coursCode: string; bareme: number; dureeMinutes: number | null };
  reprise: boolean;
};

/** POST /api/quiz/tentatives/:id/terminer */
export type ResultatQuiz = {
  devoirId: number;
  score: number;
  total: number;
  note: number;
  bareme: number;
  meilleureNote: number;
  tentativesRestantes: number;
  correction: QuestionCorrigee[] | null;
  correctionLe: string | null;
  /** Terminée automatiquement parce que le temps était écoulé. */
  horsDelai: boolean;
};

export type EvaluationNote = {
  devoirId: number;
  titre: string;
  type: TypeDevoir;
  dateLimite: string;
  bareme: number;
  coefficient: number;
  /** Note publiée, sur le barème du devoir. */
  note: number | null;
  /** Note ramenée sur 20. */
  sur20: number | null;
  etat: "note" | "en_correction" | "non_rendu" | "a_venir";
};

/** GET /api/notes (étudiant) : ses notes publiées, cours par cours. */
export type NotesEtudiant = {
  cours: {
    coursId: number;
    code: string;
    titre: string;
    couleur: string;
    /** Moyenne sur 20, pondérée par les coefficients (null sans note). */
    moyenne: number | null;
    evaluations: EvaluationNote[];
  }[];
};

export type CelluleCarnet = {
  note: number | null;
  etat: "publiee" | "brouillon" | "a_corriger" | "non_rendu" | "en_attente";
  enRetard: boolean;
};

/** GET /api/notes/cours/:id : carnet de notes d'un cours (formateur, équipe dans son périmètre). */
export type CarnetCours = {
  cours: { id: number; code: string; titre: string };
  devoirs: { id: number; titre: string; type: TypeDevoir; bareme: number; coefficient: number; dateLimite: string; publie: boolean }[];
  etudiants: (EtudiantCopie & { notes: Record<string, CelluleCarnet>; moyenne: number | null })[];
  /** Moyenne de chaque campus (le collectif, jamais un classement d'étudiants). */
  moyennesParSite: { site: string; moyenne: number | null; effectif: number }[];
};
