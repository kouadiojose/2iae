// Progression et Coupe (chantier C5 du plan d'engagement, campus/ENGAGEMENT.md) :
// règles et types d'échange communs au serveur et au client, sans aucune
// dépendance (ni drizzle ni React). Le barème chiffré vit côté serveur
// (server/engagement/bareme.ts) ; les textes dans shared/textes/progression.ts.
//
// Principes (recherche du plan, Hanus et Fox 2015, Silverman et Barasch 2023) :
// des points seulement pour des actes d'apprentissage ; des semaines actives
// avec un joker plutôt qu'une flamme quotidienne que cassent les coupures ;
// des classements de classes et de campus en TAUX, jamais d'étudiants.
import type { Jour, SemaineIso } from "./calendrier";

// ── Semaines actives ───────────────────────────────────────────────────────

/** Objectif de la semaine : nombre de jours actifs visés (3 par défaut). */
export const OBJECTIFS_SEMAINE = [2, 3, 5] as const;
export type ObjectifSemaine = (typeof OBJECTIFS_SEMAINE)[number];
export const OBJECTIF_PAR_DEFAUT: ObjectifSemaine = 3;
export const estObjectifSemaine = (n: unknown): n is ObjectifSemaine => OBJECTIFS_SEMAINE.includes(n as ObjectifSemaine);

/**
 * Bilan d'une semaine terminée : réussie (objectif atteint), sauvée par le
 * joker du mois (un jour manquant), neutre (aucune séance de ses cours ni
 * devoir dû : la série ne bouge pas) ou manquée (la série repart de zéro).
 */
export const RESULTATS_SEMAINE = ["reussie", "joker", "neutre", "manquee"] as const;
export type ResultatSemaine = (typeof RESULTATS_SEMAINE)[number];

// ── Actes et points ────────────────────────────────────────────────────────

/** Types d'activité du registre des points (un acte d'apprentissage = une ligne de campus.activites). */
export const TYPES_ACTIVITE = [
  "presence", // émargé, pointé ou au moins 30 minutes en ligne
  "presence_seuil", // présent au seuil officiel (70 %)
  "devoir", // copie rendue à l'heure
  "devoir_retard", // copie rendue en retard
  "quiz", // interrogation terminée (au moins une réponse)
  "quiz_reussi", // note d'au moins la moitié du barème
  "lecon", // leçon terminée
  "question", // question posée en direct
  "question_votee", // question soutenue par au moins 3 camarades
  "sondage", // réponse à un sondage du direct
  "ressenti", // ressenti donné pendant le direct
  "replay", // replay d'une séance manquée
  "revision", // bonne réponse de révision (C1)
  "entrainement", // quiz d'entraînement d'un cours complet terminé (C1)
  "objectif", // objectif du jour validé (C2)
] as const;
export type TypeActivite = (typeof TYPES_ACTIVITE)[number];

/**
 * Familles d'actes. Un étudiant « participe » à la Coupe s'il a fait des actes
 * d'au moins deux familles différentes dans la semaine : plus difficile à
 * gonfler que des points.
 */
export const FAMILLES = ["direct", "participation", "devoir", "quiz", "lecon", "replay", "revision", "entrainement", "objectif"] as const;
export type Famille = (typeof FAMILLES)[number];

export const FAMILLE_DU_TYPE: Record<TypeActivite, Famille> = {
  presence: "direct",
  presence_seuil: "direct",
  devoir: "devoir",
  devoir_retard: "devoir",
  quiz: "quiz",
  quiz_reussi: "quiz",
  lecon: "lecon",
  question: "participation",
  question_votee: "participation",
  sondage: "participation",
  ressenti: "participation",
  replay: "replay",
  revision: "revision",
  entrainement: "entrainement",
  objectif: "objectif",
};

// ── Badges ─────────────────────────────────────────────────────────────────

/** Ce que compte un badge (calculé par le serveur, server/engagement/badges.ts). */
export type CompteurBadge = "actes" | "reponsesRevision" | "defis" | "record" | "directs" | "sansFaute" | "questionsVotees" | "devoirsALHeure" | "objectifs";

/**
 * Badges, dans l'ordre d'affichage. « source » : table d'un autre chantier
 * sans laquelle le badge ne peut pas s'obtenir (il est alors masqué).
 */
export const BADGES = [
  { code: "premier_pas", compteur: "actes", seuil: 1 },
  { code: "premiere_revision", compteur: "reponsesRevision", seuil: 1, source: "reponses_revision" },
  { code: "directs_5", compteur: "directs", seuil: 5 },
  { code: "devoirs_a_l_heure_5", compteur: "devoirsALHeure", seuil: 5 },
  { code: "semaines_4", compteur: "record", seuil: 4 },
  { code: "question_votee", compteur: "questionsVotees", seuil: 1 },
  { code: "sans_faute", compteur: "sansFaute", seuil: 1 },
  { code: "defi_classe_5", compteur: "defis", seuil: 5, source: "reponses_revision" },
  { code: "objectif_jour_7", compteur: "objectifs", seuil: 7, source: "objectifs_jours" },
  { code: "directs_10", compteur: "directs", seuil: 10 },
  { code: "semaines_12", compteur: "record", seuil: 12 },
] as const satisfies readonly { code: string; compteur: CompteurBadge; seuil: number; source?: string }[];
export type CodeBadge = (typeof BADGES)[number]["code"];
export const CODES_BADGES = BADGES.map((b) => b.code) as CodeBadge[];

// ── Coupe des campus et des classes ────────────────────────────────────────

/** Ligues de la Coupe des classes : même niveau, tous campus confondus. */
export const LIGUES = ["annee1", "annee2", "licences"] as const;
export type Ligue = (typeof LIGUES)[number];
/** Portée d'une ligne de classement : un campus (ligue « campus ») ou une classe (ligue de son niveau). */
export type PorteeCoupe = "campus" | "classe";

/**
 * Ligue d'une classe d'après son niveau (« 1BTS », « BTS 2 », « Licence 3 »,
 * « Certificat »…) : 1re année, 2e année, ou licences, certificats et autres.
 */
export function ligueDuNiveau(niveau: string | null | undefined): Ligue {
  const n = (niveau ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (/licence|certificat|master|bachelor|\bl[1-3]\b/.test(n)) return "licences";
  if (/(^|\D)1(\D|$)|1re|1ere|premiere/.test(n)) return "annee1";
  if (/(^|\D)2(\D|$)|2e|deuxieme/.test(n)) return "annee2";
  return "licences";
}

/** Trophées de la semaine (aucun pendant la semaine d'essai). */
export const TROPHEES = ["participation", "progression", "assiduite", "equipe"] as const;
export type Trophee = (typeof TROPHEES)[number];

// ── Échanges avec le client ────────────────────────────────────────────────

/** Une ligne de « ce qui t'a rapporté des points » : une famille d'actes dans un cours. */
export type LignePoints = { famille: Famille; cours: string | null; actes: number; points: number };

export type BadgeObtenu = { code: CodeBadge; obtenuLe: string; nouveau: boolean };

/** GET /api/progression/moi (étudiant) : sa progression, visible de lui seul. */
export type ProgressionMoi = {
  semaine: {
    iso: SemaineIso;
    numero: number;
    lundi: Jour;
    aujourdhui: Jour;
    /** Jours de la semaine qui comptent au moins un acte d'apprentissage. */
    joursActifs: Jour[];
    objectif: ObjectifSemaine;
  };
  serie: {
    /** Semaines réussies d'affilée (semaines terminées). */
    actuelle: number;
    record: number;
    jokerDisponible: boolean;
    /** Bilan de la semaine dernière (null : pas encore de semaine terminée). */
    derniere: ResultatSemaine | null;
  };
  points: { semaine: number; aujourdhui: number; total: number; detail: LignePoints[] };
  badges: {
    obtenus: BadgeObtenu[];
    /** Le badge le plus proche, avec où en est l'étudiant. */
    prochain: { code: CodeBadge; compteur: number; seuil: number } | null;
    /** Badges qui peuvent s'obtenir aujourd'hui (les autres attendent un chantier pas encore en ligne). */
    disponibles: CodeBadge[];
  };
  /** Sa contribution à la participation de sa classe cette semaine. */
  contribution: { familles: number; compte: boolean; classe: string | null };
  /** Le barème, pour « Comment gagner des points » (mêmes chiffres que le registre). */
  bareme: { points: Record<TypeActivite, number>; plafonds: Record<"leconsParJour" | "questionsParSeance" | "sondagesParSeance" | "revisionsParJour" | "replaysParJour", number> };
};

export type EntreeCoupe = {
  id: number;
  nom: string;
  /** Taux de la Coupe (0 à 100) : participation, et présence en salle quand la salle a été émargée. */
  score: number | null;
  /** Part des inscrits qui ont fait au moins deux types d'actes dans la semaine (0 à 100). */
  participation: number | null;
  /** Présence aux directs émargés (0 à 100) ; null : aucune séance émargée, la semaine est neutre. */
  presence: number | null;
  /** Écart de score avec la semaine précédente, en points. */
  progression: number | null;
  /** Rang dans sa ligue, seulement dans la moitié haute (vue étudiante). */
  rang: number | null;
  trophees: Trophee[];
  /** Le campus ou la classe de la personne qui regarde. */
  moi?: boolean;
  /** Équipe seulement : les chiffres complets. */
  detail?: { inscrits: number; participants: number; assidus: number; pointsMoyens: number; seances: number; classee: boolean };
};

export type ListeCoupe = { haut: EntreeCoupe[]; autres: EntreeCoupe[] };

/** GET /api/coupe : la Coupe de la semaine, sans aucune donnée nominative. */
export type CoupeDto = {
  semaine: { iso: SemaineIso; numero: number; lundi: Jour; essai: boolean; figee: boolean; majLe: string | null };
  /** Vue de l'équipe (direction, vie scolaire) : vouvoiement, chiffres complets, historique. */
  personnel: boolean;
  campus: ListeCoupe & { bientot: string[] };
  ligues: ({ ligue: Ligue } & ListeCoupe)[];
  maClasse: { nom: string; inscrits: number; participants: number; objectifEquipe: number; classee: boolean; ligue: Ligue } | null;
  /** Lauréats de la semaine précédente (figée). */
  precedente: { numero: number; essai: boolean; laureats: { trophee: Trophee; portee: PorteeCoupe; nom: string }[] } | null;
  /** Équipe : scores des 8 dernières semaines, et détail des actes de la semaine par campus. */
  historique?: { semaines: { iso: SemaineIso; numero: number }[]; lignes: { portee: PorteeCoupe; id: number; nom: string; scores: (number | null)[] }[] };
  actes?: { id: number; nom: string; actes: Partial<Record<Famille, number>> }[];
};

/** GET /api/coupe?vue=bandeau : la ligne de l'accueil étudiant. */
export type BandeauCoupeDto = {
  numero: number;
  essai: boolean;
  meneur: string | null;
  monCampus: { nom: string; rang: number | null } | null;
  /** Progression de sa classe (classes de 5 étudiants ou plus). */
  maClasse: { progression: number | null } | null;
};

/** GET /api/coupe/salle : l'écran de la salle de conférence. Aucun nom d'étudiant, jamais le dernier. */
export type CoupeSalleDto = {
  numero: number;
  essai: boolean;
  meneur: string | null;
  /** Le campus de la salle : rang s'il est dans la moitié haute, sinon sa progression. */
  campus: { nom: string; rang: number | null; progression: number | null; bientot: boolean } | null;
  /** La moitié haute du classement des campus. */
  podium: { nom: string; rang: number }[];
};
