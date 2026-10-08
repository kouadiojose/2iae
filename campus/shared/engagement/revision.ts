// Révision du jour (chantier C1 du plan d'engagement) : contrats d'échange
// client ↔ serveur et règles pures, sans drizzle ni dépendance, partagés par le
// serveur (sélection, boîtes) et le téléphone (paquet hors ligne, mélange).
//
// - Une carte est une question tirée d'un cours complet (quiz, fiche mémo,
//   glossaire) ou d'un sondage du direct qui a une bonne réponse.
// - Chaque étudiant a sa boîte pour chaque carte (1 à 5) : une bonne réponse la
//   fait monter et l'éloigne (1, 2, 4, 8 puis 16 jours) ; une erreur ou « À
//   revoir » la ramène en boîte 1, pour le lendemain.
// - La révision ne donne jamais de note (CONCEPTION §1.10) : les réponses
//   servent seulement à reposer les questions au bon moment.
import type { Jour } from "./calendrier";
import type { CoursCompletDto } from "../schema/ext-etudes";

/** Écart (en jours) avant le retour d'une carte, selon sa boîte (1 à 5). */
export const INTERVALLES_JOURS = [1, 2, 4, 8, 16] as const;
export const BOITE_MAX = INTERVALLES_JOURS.length;

/** Cartes de la révision du jour, et cartes gardées d'avance pour réviser sans réseau. */
export const CARTES_PAR_JOUR = 5;
export const CARTES_D_AVANCE = 15;
/** « Réviser ce cours en 5 min » : cartes d'une seule séance. */
export const CARTES_PAR_SEANCE = 8;
/** Questions du défi de la classe. */
export const CARTES_DEFI = 3;
/**
 * Le défi porte sur la dernière séance tenue avant ce jour (depuis au plus ce
 * nombre de jours) qui avait des cartes à 0 h : il reste le même toute la journée.
 */
export const DEFI_JOURS_MAX = 14;
/** « 14 sur 25 l'ont relevé » ne s'affiche qu'à partir de cette taille de classe (et les agrégats du formateur, à partir d'autant d'étudiants). */
export const SEUIL_COLLECTIF = 5;
/** Réponses envoyées au plus par lot. */
export const REPONSES_PAR_LOT = 40;
/** Au 3e signalement d'étudiants, la carte est retirée de la révision. */
export const SIGNALEMENTS_RETRAIT = 3;
/** Une question ratée par au moins 70 % d'au moins 10 étudiants est retirée et signalée au formateur. */
export const ANOMALIE_MIN_ETUDIANTS = 10;
export const ANOMALIE_TAUX_ERREUR = 0.7;
/**
 * Seuls les étudiants qui suivent le cours (classe ou inscription, pas la
 * médiathèque ouverte à tous), au compte créé depuis au moins ce nombre de
 * jours, comptent pour retirer une carte (signalements, taux d'erreur) : trois
 * comptes créés dans la minute ne suffisent pas.
 */
export const ANCIENNETE_VOIX_JOURS = 7;
/** Une réponse faite hors ligne compte pour son jour si elle arrive dans les 48 h. */
export const DELAI_JOUR_REPONSE_MS = 48 * 3600_000;

export const SOURCES_CARTE = ["quiz", "fiche", "glossaire", "sondage"] as const;
export type SourceCarte = (typeof SOURCES_CARTE)[number];
export type GenreCarte = "qcm" | "fiche";
export const ORIGINES_REPONSE = ["du_jour", "defi", "cours_complet"] as const;
export type OrigineReponse = (typeof ORIGINES_REPONSE)[number];

/** Contenu d'une carte (colonne contenu de cartes_revision). */
export type ContenuQcm = { question: string; options: string[]; bonneReponse: number; explication: string };
export type ContenuFiche = { recto: string; verso: string };
export type ContenuCarte = ContenuQcm | ContenuFiche;

// ── Échanges ───────────────────────────────────────────────────────────────

/** Une carte telle que le téléphone la garde : options déjà mélangées, bonne réponse connue (correction sans réseau). */
export type CarteDto = {
  id: number;
  genre: GenreCarte;
  /** Code du cours (« IA-101 »). */
  cours: string;
  seanceId: number;
  /** Question (QCM) ou recto (fiche). */
  question: string;
  /** QCM : options dans l'ordre affiché. */
  options?: string[];
  /** QCM : index d'origine de chaque option affichée (le serveur recorrige sur l'index d'origine). */
  ordre?: number[];
  /** QCM : position affichée de la bonne réponse. */
  bonne?: number;
  explication?: string;
  /** Fiche : la réponse au verso. */
  verso?: string;
  /** Boîte actuelle de l'étudiant (0 : carte nouvelle). */
  boite: number;
};

export type DefiDto = {
  cours: string;
  seanceTitre: string;
  cartes: CarteDto[];
  /** L'étudiant a déjà relevé le défi aujourd'hui. */
  fait: boolean;
  /** « 14 sur 25 l'ont relevé » : seulement dans une classe de SEUIL_COLLECTIF étudiants ou plus. */
  releve: { n: number; sur: number } | null;
};

/** GET /api/revision/paquet[?seance=] : tout ce qu'il faut pour réviser sans réseau (20 Ko au plus). */
export type PaquetRevision = {
  utilisateurId: number;
  jour: Jour;
  genereLe: string;
  /** Paquet d'une seule séance (« Réviser ce cours en 5 min »), sinon null. */
  seanceId: number | null;
  defi: DefiDto | null;
  /** Les CARTES_PAR_JOUR premières forment la révision du jour, les suivantes sont d'avance. */
  cartes: CarteDto[];
  parJour: number;
  /** Cartes dues aujourd'hui (avant les nouvelles). */
  dues: number;
  /** Réponses déjà enregistrées aujourd'hui. */
  faitesAujourdhui: number;
  /** Prochain jour où une carte revient (après aujourd'hui), null s'il n'y en a pas. */
  prochaine: Jour | null;
};

/** GET /api/revision/du-jour : le résumé léger (quelques centaines d'octets). */
export type RevisionDuJour = {
  jour: Jour;
  /** L'étudiant a des cartes dans ses cours (sinon, rien à proposer). */
  disponible: boolean;
  dues: number;
  nouvelles: number;
  /** Cartes de la révision du jour (au plus CARTES_PAR_JOUR). */
  aFaire: number;
  faitesAujourdhui: number;
  defi: { cours: string; fait: boolean; releve: { n: number; sur: number } | null } | null;
  /** Prochain jour où une carte revient, si rien n'est dû aujourd'hui. */
  prochaine: Jour | null;
};

/** Une réponse envoyée par le téléphone (QCM : index d'origine choisi ; fiche : « Je savais » ou « À revoir »). */
export type ReponseRevisionEnvoi = {
  carteId: number;
  origine: OrigineReponse;
  choix?: number;
  savait?: boolean;
  /** Heure de la réponse, à l'horloge du serveur (ms). */
  reponduLe: number;
  /** Identifiant unique de la réponse : un renvoi n'est jamais compté deux fois. */
  cle: string;
};
export type ResultatReponses = { enregistrees: number; doublons: number; ignorees: number };

/** GET /api/revision/cours/:id : onglet « Réviser » de la page d'un cours. */
export type CoursCompletARevise = {
  seanceId: number;
  titre: string;
  debut: string;
  cartes: number;
  /** Étudiant : cartes de cette séance à revoir aujourd'hui, et suivi du cours complet. */
  aRevoir: number | null;
  ouvert: boolean | null;
  quiz: { meilleur: number; total: number } | null;
};

/** Suivi du cours complet (POST /api/seances/:id/cours-complet/suivi). */
export type EvenementSuivi =
  | { evenement: "ouverture" }
  | { evenement: "fiche"; index: number }
  | { evenement: "exercice"; index: number; etat: "fait" | "difficile" }
  | { evenement: "corrige"; index: number }
  | { evenement: "quiz"; score: number; total: number };

/** Identifiants des cartes du cours complet, dans l'ordre du dossier (null : carte retirée ou pas encore créée). */
export type CartesCoursComplet = { quiz: (number | null)[]; fiches: (number | null)[] };

/** GET /api/seances/:id/cours-complet : le cours complet, et pour l'étudiant les cartes de sa révision. */
export type CoursCompletRevision = CoursCompletDto & { cartes?: CartesCoursComplet | null };

/** GET /api/seances/:id/revision-classe : formateur du cours et direction. Jamais de note ni de nom d'étudiant. */
export type RevisionClasseDto = {
  inscrits: number;
  /** Étudiants qui ont répondu à au moins une carte de la séance. */
  revisePar: number;
  /** Agrégats montrés à partir de SEUIL_COLLECTIF étudiants (null en dessous). */
  moyenneQuiz: { moyenne: number; sur: number; etudiants: number } | null;
  plusRatees: { position: number; question: string; tauxErreur: number; notion: { titre: string; debutSecondes: number } | null }[] | null;
  /** Questions signalées ou très ratées, retirées de la révision en attendant (ou après) votre décision. */
  aRelire: {
    id: number;
    source: SourceCarte;
    position: number;
    question: string;
    signalements: number;
    tauxErreur: number | null;
    motifs: string[];
    /** Null : en attente ; « retiree » : vous l'avez gardée retirée. */
    decision: "retiree" | null;
  }[];
};

// ── Règles pures ───────────────────────────────────────────────────────────

/**
 * Boîte et prochain retour après une réponse. Une bonne réponse ne fait monter
 * la carte que si elle était due (ou nouvelle) : refaire le quiz deux fois le
 * même jour ne la propulse pas à 16 jours. Une erreur la ramène toujours en
 * boîte 1, pour le lendemain.
 */
export function boiteApres(
  etat: { boite: number; prochaine: Jour } | null,
  juste: boolean,
  jour: Jour,
  ajouterJours: (j: Jour, n: number) => Jour,
): { boite: number; prochaine: Jour; deplacee: boolean } {
  if (!juste) return { boite: 1, prochaine: ajouterJours(jour, INTERVALLES_JOURS[0]), deplacee: true };
  if (etat && etat.prochaine > jour) return { boite: etat.boite, prochaine: etat.prochaine, deplacee: false };
  const boite = Math.min(BOITE_MAX, (etat?.boite ?? 1) + 1);
  return { boite, prochaine: ajouterJours(jour, INTERVALLES_JOURS[boite - 1]), deplacee: true };
}

/** Empreinte 32 bits (FNV-1a) d'un texte : graine stable, identique sur le serveur et le téléphone. */
export function empreinte32(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Suite pseudo-aléatoire reproductible (mulberry32) : même graine, même suite. */
export function aleaDepuis(graine: string | number): () => number {
  let a = typeof graine === "number" ? graine >>> 0 : empreinte32(graine);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Indices 0…n-1 mélangés (Fisher-Yates) : un vrai mélange, uniforme, et reproductible avec une graine. */
export function ordreMelange(n: number, alea: () => number = Math.random): number[] {
  const ordre = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  }
  return ordre;
}

/** Texte ramené à l'essentiel (minuscules, sans accents ni ponctuation) : la même question réécrite garde la même carte. */
export function normaliserTexte(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
