// Module « ia » : contrats d'API de l'assistant pédagogique (serveur et
// client). Aucune table ici : les conversations, les messages, la
// consommation et les fiches de révision vivent dans « ./ia ».
// Les dates voyagent en chaînes ISO.

/** GET /api/ia/etat — ce que l'interface doit savoir avant d'afficher l'assistant. */
export type EtatIa = {
  /** Faux quand la clé Anthropic manque : l'assistant est « en pause pour le moment ». */
  disponible: boolean;
  /** Questions permises par jour pour cette personne. */
  quotaJour: number;
  /** Questions déjà posées aujourd'hui. */
  utilisees: number;
  restantes: number;
  /** Quota quotidien d'un étudiant (affiché dans la charte, y compris au personnel). */
  quotaEtudiants: number;
  /** Présent pendant une interrogation : l'assistant se tait jusqu'à la fin. */
  pause?: { raison: string; devoirId: number; coursId: number };
};

/** GET /api/ia/cours — les cours sur lesquels la personne peut interroger l'assistant. */
export type CoursAssistant = {
  id: number;
  code: string;
  titre: string;
  couleur: string;
  /** La personne enseigne ce cours (outils du formateur). */
  enseignant: boolean;
  /** Questions de départ tirées des dernières leçons publiées (aucun coût d'IA). */
  suggestions: string[];
  /** Leçons publiées : la matière sur laquelle l'assistant s'appuie. */
  nbLecons: number;
};

export type ConversationIaResume = {
  id: number;
  titre: string;
  coursId: number | null;
  cours: { code: string; titre: string; couleur: string } | null;
  leconId: number | null;
  devoirId: number | null;
  /** Mode tuteur : ouverte depuis un devoir. */
  tuteur: boolean;
  nbMessages: number;
  creeLe: string;
  majLe: string;
};

export type MessageIaDto = {
  id: number;
  role: "user" | "assistant";
  contenu: string;
  creeLe: string;
};

/** GET /api/ia/conversations/:id */
export type ConversationIaDetail = {
  conversation: ConversationIaResume & {
    lecon: { id: number; titre: string } | null;
    devoir: { id: number; titre: string; dateLimite: string } | null;
  };
  messages: MessageIaDto[];
  /** Leçons publiées du cours : les sources citées (« Leçon 1.2 ») deviennent des liens. */
  lecons: { id: number; numero: string; titre: string }[];
};

/**
 * POST /api/ia/conversations/:id/messages répond en texte fragmenté
 * (text/plain, Transfer-Encoding chunked) : la réponse de l'assistant arrive
 * morceau par morceau, puis un séparateur SEPARATEUR_FIN_FLUX suivi d'un
 * objet JSON FinFluxIa. Tout ce qui précède le séparateur est du texte.
 */
export const SEPARATEUR_FIN_FLUX = "\u001e";

export type FinFluxIa = {
  /** Identifiant du message de l'assistant enregistré (absent en cas d'erreur). */
  messageId?: number;
  /** Titre de la conversation (donné automatiquement à la première question). */
  titre?: string;
  /** Texte définitif quand il diffère de ce qui a été diffusé (refus, réponse coupée). */
  remplacer?: string;
  /** Message d'erreur lisible si la réponse n'a pas pu aller au bout. */
  erreur?: string;
  restantes?: number;
};

/** Fiche de révision (« L'essentiel en 5 points »), proposée par l'IA puis validée par le formateur. */
export type FicheRevisionDto = {
  id: number;
  coursId: number;
  leconId: number | null;
  seanceId: number | null;
  titre: string;
  contenu: string;
  validee: boolean;
  /** Vrai tant que le formateur ne l'a pas validée : afficher « Proposé par l'IA ». */
  proposeeParIa: boolean;
  lecon: { id: number; titre: string; numero: string | null } | null;
  cours: { id: number; code: string; titre: string };
  creeLe: string;
};

export const ANGLES_EXPLICATION = ["plus simple", "avec un exemple", "en schéma"] as const;
export type AngleExplication = (typeof ANGLES_EXPLICATION)[number];

/** POST /api/ia/lecons/:id/autrement */
export type ExplicationAutrement = { angle: AngleExplication; texte: string; proposeParIa: true };

/** Question d'entraînement (« Me faire réviser ») : non notée, jamais enregistrée. */
export type QuestionRevision = {
  question: string;
  options: string[];
  /** Index de la bonne option. */
  bonneReponse: number;
  explication: string;
};

/** POST /api/ia/lecons/:id/reviser */
export type RevisionLecon = { lecon: { id: number; titre: string; numero: string | null }; questions: QuestionRevision[] };

/** POST /api/ia/preparer-seance — brouillon « Proposé par l'IA », jamais publié tel quel. */
export type PreparationSeance = {
  titre: string;
  objectif: string;
  dureeMinutes: number;
  plan: { titre: string; minutes: number; deroule: string }[];
  /** Sondages éclair à lancer pendant le live ; bonneReponse = null pour un sondage d'opinion. */
  sondages: { question: string; options: string[]; bonneReponse: number | null }[];
  qcmSortie: QuestionRevision[];
  proposeParIa: true;
};

/** POST /api/ia/accroche-site — brouillon pour 2iae.com, à valider par un humain. */
export type AccrocheSite = { accroche: string; proposeParIa: true };
