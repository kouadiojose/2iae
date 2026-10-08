// Contrats d'échange du chantier C2 (campus/ENGAGEMENT.md), sans drizzle :
// l'objectif du jour de l'étudiant (GET /api/objectif-du-jour) et la
// progression honnête d'un cours, partagée par l'accueil et « Mes cours ».
//
// L'objectif du jour tient en trois lignes au plus, choisies par le serveur
// au premier passage de la journée (jour local de l'étudiant) et figées
// jusqu'à minuit : la révision du jour, le rattrapage du cours manqué (ou
// « À retenir » du dernier cours), puis l'interrogation ou l'exercice le plus
// proche. Chaque ligne se coche toute seule, d'après ce que l'étudiant a fait.
import type { Jour } from "./calendrier";
import type { AccueilEtudiant, CoursAccueil } from "../schema/ext-accueil";
import type { CoursResume } from "../schema/ext-cours";
import type { Traducteur } from "../textes";
import type { CleObjectif } from "../textes/objectif";

export type TypeElementObjectif = "revision" | "rattrapage" | "retenir" | "devoir";

/** Durées affichées (minutes) : estimations courtes et constantes, pour un téléphone. */
export const MINUTES_REVISION = 3;
export const MINUTES_RATTRAPAGE = 15;
export const MINUTES_RETENIR = 2;

/**
 * Une ligne de l'objectif, telle qu'elle est figée pour la journée
 * (objectifs_jours.elements). Clé stable : « revision », « rattrapage:12 »,
 * « retenir:12 », « devoir:27 ». Les libellés se composent côté client avec
 * le dictionnaire shared/textes/objectif.ts.
 */
export type ElementObjectif =
  | { cle: "revision"; type: "revision"; lien: string; minutes: number }
  | {
      cle: string;
      type: "rattrapage";
      seanceId: number;
      coursCode: string;
      coursTitre: string;
      /** Début de la séance manquée (ISO). */
      debut: string;
      lien: string;
      minutes: number;
      /** Poids estimé du cours complet sans vidéo, en Ko ; null quand le lien mène au replay. */
      ko: number | null;
    }
  | { cle: string; type: "retenir"; seanceId: number; coursCode: string; coursTitre: string; debut: string; lien: string; minutes: number }
  | {
      cle: string;
      type: "devoir";
      devoirId: number;
      genre: "quiz" | "depot";
      coursCode: string;
      coursTitre: string;
      titre: string;
      /** Date limite (ISO). */
      dateLimite: string;
      /** Interrogation : nombre de questions et durée estimée. */
      questions: number | null;
      minutes: number | null;
      lien: string;
    };

/** Une ligne telle que la renvoie le GET : son état du moment, et les points « À retenir » à lire sur place. */
export type ElementObjectifDto = ElementObjectif & { fait: boolean; points?: string[] };

/** GET /api/objectif-du-jour (et réponse de POST /api/objectif-du-jour/ouvert). */
export type ObjectifDuJourDto = {
  jour: Jour;
  /** Vide : rien à proposer aujourd'hui (l'accueil garde sa carte « À jour »). */
  elements: ElementObjectifDto[];
  faits: number;
  total: number;
  /** Jour validé (les lignes toutes faites), écrit une seule fois ; ISO. */
  valideLe: string | null;
};

/** Éléments qui se cochent à l'ouverture, faute d'autre trace (POST /api/objectif-du-jour/ouvert). */
export const TYPES_OUVERTURE = ["retenir", "rattrapage"] as const;
export const CLE_OUVERTURE = /^(retenir|rattrapage):[1-9]\d{0,9}$/;

// ── Progression honnête d'un cours ────────────────────────────────────────

/**
 * Progression d'un étudiant dans un cours : (leçons terminées + séances
 * suivies ou rattrapées) / (leçons publiées + séances comptées). Une séance
 * compte si l'étudiant y était attendu, qu'elle a été tenue, et que sa
 * présence est connue (présent ou absent) ou qu'il l'a rattrapée : une
 * présence « inconnue » (salle non émargée) ne compte jamais contre lui.
 */
export type ProgressionCours = {
  leconsTerminees: number;
  leconsTotal: number;
  /** Présent, ou séance rattrapée (replay, cours complet, cartes de révision). */
  seancesSuivies: number;
  seancesTotal: number;
  /** null quand il n'y a encore rien à compter : rien ne s'affiche. */
  pourcentage: number | null;
};

export function calculerPourcentage(p: Omit<ProgressionCours, "pourcentage">): number | null {
  const total = p.leconsTotal + p.seancesTotal;
  if (total <= 0) return null;
  return Math.min(100, Math.round(((p.leconsTerminees + p.seancesSuivies) / total) * 100));
}

/** Cours de l'accueil étudiant, avec sa progression honnête (GET /api/accueil). */
export type CoursAccueilSuivi = CoursAccueil & { suivi: ProgressionCours };
export type AccueilEtudiantSuivi = Omit<AccueilEtudiant, "cours"> & { cours: CoursAccueilSuivi[] };
/** Cours de « Mes cours » (GET /api/cours) : suivi renseigné pour l'étudiant, null pour les autres rôles. */
export type CoursResumeSuivi = CoursResume & { suivi?: ProgressionCours | null };

/**
 * « 3 séances sur 4 suivies ou rattrapées · 1 leçon sur 2 terminée » (accueil
 * et « Mes cours ») ; chaîne vide tant qu'il n'y a rien à compter.
 */
export function libelleSuivi(s: ProgressionCours, tx: Traducteur<CleObjectif>): string {
  const morceaux: string[] = [];
  if (s.seancesTotal) morceaux.push(tx(s.seancesSuivies >= 2 ? "progression.seancesN" : "progression.seances1", { v: { n: s.seancesSuivies, total: s.seancesTotal } }));
  if (s.leconsTotal) morceaux.push(tx(s.leconsTerminees >= 2 ? "progression.leconsN" : "progression.lecons1", { v: { n: s.leconsTerminees, total: s.leconsTotal } }));
  return morceaux.join(" · ");
}

/** « de Marketing digital », « d'Initiation à l'IA » (élision devant une voyelle). */
export function deCours(titre: string): string {
  return /^[aeiouyàâäéèêëîïôöûüœæ]/i.test(titre.trim()) ? `d'${titre.trim()}` : `de ${titre.trim()}`;
}
