// Directs (chantier C6, campus/ENGAGEMENT.md) : émargement et participation en
// salle, puis présence en ligne. Types d'échange et réglages partagés par le
// serveur (routes/participation-direct.ts) et le client (module live), sans
// drizzle : le téléphone n'embarque que ce fichier.
//
// Les étudiants suivent le cours ENSEMBLE dans la salle de conférence de leur
// campus, devant l'écran de la salle. L'écran prend l'émargement en charge
// tout seul, sans geste du chargé de cours : QR en grand au démarrage du
// direct, puis vers +15 et +45 min, chaque fois une minute au plus.

/** État de présence à un direct, en trois états (server/engagement/presence.ts). */
export type EtatPresenceDirect = "present" | "absent" | "inconnu";

// ── QR d'émargement plein écran sur l'écran de salle ───────────────────────

/** Moments (minutes après le démarrage réel) où l'écran de salle affiche tout seul le QR en grand. */
export const MOMENTS_EMARGEMENT_MIN = [0, 15, 45] as const;
/** Durée d'un affichage plein écran : jamais plus d'une minute (le cours continue dessous, son compris). */
export const DUREE_EMARGEMENT_MS = 60_000;
/**
 * Un moment empêché (sondage en cours, résultats commentés, parole à la salle,
 * travail en groupes) attend la fin de l'empêchement, au plus 10 min ; au-delà,
 * il est abandonné jusqu'au moment suivant.
 */
export const REPORT_MAX_EMARGEMENT_MS = 10 * 60_000;
/** Résultats d'un sondage tout juste fermé : le formateur les commente, le QR attend 90 s. */
export const PAUSE_APRES_SONDAGE_MS = 90_000;
/** Un QR vient de passer : un moment prévu dans les 5 min qui suivent est considéré comme servi. */
export const ECART_MIN_EMARGEMENTS_MS = 5 * 60_000;

/** GET /api/seances/:id/emargement-salle : de quoi l'écran de salle a besoin pour son QR plein écran. */
export type EmargementSalleDto = {
  seanceId: number;
  /** Fin de l'affichage demandé depuis le Studio (« Afficher l'émargement »), heure du serveur ; null sinon. */
  afficheJusqua: string | null;
  /** Campus dont une classe suit le cours : eux seuls entrent au classement des campus. */
  sitesDuCours: number[];
};

/** POST /api/seances/:id/afficher-emargement, et l'événement « emargement:afficher » du canal de la séance. */
export type AfficherEmargementDto = { seanceId: number; afficheJusqua: string };

export type FenetreEmargement = { cle: string; fin: number };
export type MemoireEmargement = { servis: string[]; courant: FenetreEmargement | null };

/**
 * Décide, à l'instant `maintenant` (heure du serveur), si l'écran de salle
 * montre le QR en grand. Fonction pure : l'écran garde sa mémoire (moments
 * servis, fenêtre en cours) et la rappelle chaque seconde.
 *   - occupe : un sondage est ouvert, ses résultats viennent d'être montrés,
 *     la salle a la parole ou travaille en groupes. Jamais de QR à ce moment-là :
 *     une fenêtre en cours se retire, un moment prévu attend.
 *   - demande : affichage demandé depuis le Studio (fin, heure du serveur).
 */
export function decisionEmargement(
  memoire: MemoireEmargement,
  { maintenant, demarreeLe, occupe, demande }: { maintenant: number; demarreeLe: number | null; occupe: boolean; demande: number | null },
): MemoireEmargement {
  const servis = new Set(memoire.servis);
  let courant: FenetreEmargement | null = memoire.courant && memoire.courant.fin > maintenant ? memoire.courant : null;
  if (occupe) return { servis: [...servis], courant: null };
  const ouvrir = (cle: string, fin: number) => {
    courant = { cle, fin: Math.min(fin, maintenant + DUREE_EMARGEMENT_MS) };
    servis.add(cle);
    // Les moments prévus juste après sont servis par cet affichage : pas deux QR coup sur coup.
    if (demarreeLe !== null)
      for (const m of MOMENTS_EMARGEMENT_MIN) if (demarreeLe + m * 60_000 <= maintenant + ECART_MIN_EMARGEMENTS_MS) servis.add(`auto:${m}`);
  };
  if (demande !== null && demande > maintenant && !servis.has(`studio:${demande}`)) ouvrir(`studio:${demande}`, demande);
  else if (!courant && demarreeLe !== null) {
    for (const m of MOMENTS_EMARGEMENT_MIN) {
      const cle = `auto:${m}`;
      const prevu = demarreeLe + m * 60_000;
      if (servis.has(cle) || maintenant < prevu) continue;
      if (maintenant >= prevu + REPORT_MAX_EMARGEMENT_MS) {
        servis.add(cle);
        continue;
      }
      ouvrir(cle, maintenant + DUREE_EMARGEMENT_MS);
      break;
    }
  }
  return { servis: [...servis], courant };
}

// ── Questions de rappel (Studio) ────────────────────────────────────────────

/** Une question du quiz du dernier cours complet du même cours, au format des sondages. */
export type QuestionRappelDto = {
  question: string;
  options: string[];
  bonneReponse: number;
  explication: string;
  /** Écrite par l'IA (cours complet) : le formateur la relit, rien ne part tout seul. */
  parIa: true;
  /** Déjà lancée (ou préparée) dans cette séance. */
  dejaLancee: boolean;
};

/** GET /api/seances/:id/questions-rappel */
export type QuestionsRappelDto = {
  /** Séance dont le cours complet fournit les questions ; null s'il n'y en a pas encore. */
  source: { seanceId: number; titre: string; debut: string } | null;
  questions: QuestionRappelDto[];
};

/** Après 15 min de direct sans sondage ni question traitée, le Studio propose une question de rappel. */
export const SILENCE_INTERACTION_MS = 15 * 60_000;

// ── Présences de l'étudiant ─────────────────────────────────────────────────

/** GET /api/seances/:id/ma-presence : l'état de l'étudiant à une séance (trois états). */
export type MaPresenceDirectDto = {
  seanceId: number;
  etat: EtatPresenceDirect;
  /** Minutes suivies en ligne. */
  minutes: number;
  /** Minutes à atteindre en ligne pour être compté présent. */
  seuil: number;
  /** Émargé en salle (QR ou code) ou pointé présent par le responsable de salle. */
  enSalle: boolean;
  /** Campus où il a été émargé. */
  site: string | null;
  /** Heure de l'émargement en salle (heure du serveur). */
  arriveeSalle: string | null;
};

/** Une séance tenue, dans « Mes présences » et « Déjà passés ». */
export type LignePresenceDirectDto = {
  seanceId: number;
  titre: string;
  coursId: number;
  coursCode: string;
  coursTitre: string;
  debut: string;
  etat: EtatPresenceDirect;
  minutes: number;
  enSalle: boolean;
  replay: boolean;
  /** Cours complet tiré de l'enregistrement : prêt, en préparation, ou aucun. */
  coursComplet: "prete" | "en_cours" | null;
};

/** GET /api/mes-presences : les 20 dernières séances tenues de l'étudiant. */
export type MesPresencesDto = { seances: LignePresenceDirectDto[] };
