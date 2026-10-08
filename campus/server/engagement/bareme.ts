// Barème des points et règles de la Coupe (chantier C5), regroupés ici pour
// être ajustés d'un seul endroit. Les points ne paient que des actes
// d'apprentissage : rien pour le temps passé, les pages rouvertes ni
// l'assistant, et une ouverture ou un clic seuls ne rapportent rien (le
// ressenti et l'objectif du jour accompagnent un acte vérifié, voir le
// registre). Les plafonds empêchent d'accumuler des points sans apprendre.
// À revoir au bout de 4 semaines (plan d'engagement, « mesures ») : un campus
// qui gagne sans que ses jours d'apprentissage augmentent a détourné les points.
import type { Jour } from "@shared/engagement/calendrier";
import type { TypeActivite } from "@shared/engagement/progression";

/** Rentrée 2026 : les points sont comptés depuis ce lundi (rattrapage au démarrage). */
export const RENTREE: Jour = "2026-09-28";

export const POINTS: Record<TypeActivite, number> = {
  /** Émargé en salle (QR ou code), pointé présent, ou au moins 30 minutes en ligne. */
  presence: 20,
  /** En plus, présent au seuil officiel (70 % de la durée de référence). */
  presence_seuil: 5,
  /** Copie rendue (premier dépôt), à l'heure… */
  devoir: 30,
  /** … ou en retard. */
  devoir_retard: 15,
  /** Interrogation terminée avec au moins une réponse. */
  quiz: 10,
  /** En plus, note d'au moins la moitié du barème. */
  quiz_reussi: 10,
  lecon: 5,
  question: 5,
  /** En plus, question soutenue par au moins 3 camarades. */
  question_votee: 5,
  sondage: 3,
  /** Ressenti donné en direct, une fois par séance, avec une présence, une question ou un sondage à cette séance. */
  ressenti: 2,
  /** Replay d'une séance manquée, une seule fois. */
  replay: 5,
  /**
   * Carte revue en révision (C1), juste ou non, une fois par carte et par jour :
   * les points paient l'effort, jamais la seule réponse « Je savais » (décision D4).
   */
  revision: 2,
  /** Quiz d'entraînement d'un cours complet terminé (C1), une fois par séance. */
  entrainement: 10,
  /** Objectif du jour validé (C2), le jour où un autre acte d'apprentissage est inscrit. */
  objectif: 10,
};

export const PLAFONDS = {
  leconsParJour: 4,
  questionsParSeance: 3,
  /** Au-delà, un direct qui enchaîne les sondages ne fait plus gagner (15 points au plus). */
  sondagesParSeance: 5,
  /** Cartes revues comptées par jour, justes ou non (20 points). */
  revisionsParJour: 10,
  replaysParJour: 3,
} as const;

/** Minutes en ligne pour une présence (sans émargement), si le seuil officiel n'est pas plus bas. */
export const MINUTES_PRESENCE = 30;
/** Votes de camarades (l'auteur exclu) pour une question « soutenue ». */
export const VOTES_QUESTION = 3;
/**
 * Un replay ne compte que si l'étudiant y est resté ou revenu : au moins
 * 5 minutes entre la première et la dernière vue. Une simple ouverture ne
 * rapporte rien.
 */
export const REPLAY_MINUTES = 5;

/** Fenêtre du passage régulier du registre (toutes les 5 minutes). */
export const FENETRE_JOURS = 3;

export const COUPE = {
  /** Une classe plus petite reste hors classement (résultat trop aléatoire) mais compte pour son campus. */
  tailleMinClasse: 5,
  /** Points d'un étudiant retenus pour les points moyens : un seul ne fait pas gagner sa classe. */
  plafondPointsEtudiant: 150,
  /** Familles d'actes différentes pour « participer » dans la semaine. */
  famillesParticipation: 2,
  /** Jours actifs pour être « assidu » dans la semaine. */
  joursAssidu: 3,
  /** Participation qui vaut le trophée Équipe à une classe (en %). */
  seuilEquipe: 70,
  /**
   * Poids de la présence aux directs émargés dans le taux de la Coupe
   * (amendement de José) ; le reste est la participation. La présence ne peut
   * que faire monter le taux (le plus haut des deux calculs est gardé) : faire
   * émarger ne pénalise jamais un campus. Une séance sans aucun émargement dans
   * un campus est neutre : sans séance émargée, le taux est la participation seule.
   */
  poidsPresence: 1 / 3,
  /** Semaines d'historique montrées à l'équipe. */
  semainesHistorique: 8,
} as const;
