// Tableau « Engagement et participation » (chantier C8) : constantes et types
// d'échange entre le serveur (server/engagement/indicateurs.ts) et la page
// /pilotage/engagement. Aucune dépendance (ni drizzle ni React) : le client ne
// les importe qu'en « import type », sauf les quelques constantes pures.
//
// Règles de lecture communes à tous les chiffres :
// - un « jour d'apprentissage » compte une ACTION d'apprentissage (présence
//   suivie, copie rendue, interrogation, leçon terminée, replay, participation
//   au direct, et, quand leurs chantiers sont en ligne, révision, cours complet,
//   objectif validé) ; ouvrir le campus ne suffit jamais ;
// - présence à un direct en trois états (server/engagement/presence.ts) :
//   « inconnu » n'est jamais compté comme une absence ; une salle n'est
//   « émargée » qu'avec au moins 3 émargés de son campus et au moins 25 % de
//   ses attendus (décision D1) ;
// - aucun taux sous EFFECTIF_MINIMUM personnes, aucune donnée nominative
//   d'étudiant ;
// - un bloc qui dépend d'un autre chantier vaut null tant que sa table
//   n'existe pas : la page écrit « pas encore mesuré », jamais 0 %.
import type { Jour, SemaineIso } from "./calendrier";
import type { AContacter, IndicateursCampus, TableauPilotage } from "../schema/ext-pilotage";

// ── Plateforme (en-tête X-Campus-Plateforme) ───────────────────────────────

/** En-tête envoyé par lib/api.ts : déclaratif, limité à ces valeurs, pour les statistiques seulement. */
export const ENTETE_PLATEFORME = "x-campus-plateforme";
export const PLATEFORMES = ["android_app", "installee", "mobile", "ordinateur"] as const;
export type Plateforme = (typeof PLATEFORMES)[number];
/** Ordre « téléphone d'abord » : un jour passé en partie sur le téléphone compte comme un jour sur téléphone. */
export const RANG_PLATEFORME: Record<Plateforme, number> = { ordinateur: 1, mobile: 2, installee: 3, android_app: 4 };
export const estPlateforme = (x: unknown): x is Plateforme => typeof x === "string" && (PLATEFORMES as readonly string[]).includes(x);

// ── Réglages ───────────────────────────────────────────────────────────────

/** Aucun taux ni décompte détaillé sous cet effectif (une classe de 3 étudiants n'affiche rien). */
export const EFFECTIF_MINIMUM = 5;
/** Périodes proposées (jours) ; 30 par défaut. */
export const PERIODES = [7, 30, 90] as const;
export const PERIODE_PAR_DEFAUT = 30;
/** « A suivi » un direct : émargé en salle, ou au moins 30 minutes ou la moitié de la séance en ligne. */
export const SUIVI_MINUTES = 30;
export const SUIVI_PART = 0.5;
/** Semaines complètes montrées pour l'indicateur principal (plus la semaine en cours). */
export const SEMAINES_HISTORIQUE = 6;
/** Semaines d'inscription suivies pour le retour à J1 et à J7. */
export const SEMAINES_COHORTES = 8;
/** Conservation de l'activité quotidienne (ENGAGEMENT.md § 4). */
export const CONSERVATION_ACTIVITE_JOURS = 400;

// ── Briques ────────────────────────────────────────────────────────────────

/**
 * Une part « n sur sur ». taux (0 à 100, arrondi) et n valent null quand sur
 * est inférieur à EFFECTIF_MINIMUM (ou nul) : seul l'effectif reste affiché.
 */
export type Part = { n: number | null; sur: number; taux: number | null };

/** Présence aux directs en trois états, sur des couples (séance, étudiant attendu). */
export type TroisEtats = {
  presents: number;
  absents: number;
  inconnus: number;
  total: number;
  /** Présents sur présents + absents : la présence là où elle est connue. */
  tauxConnu: number | null;
  /** Part des couples dont la présence est inconnue (salle non émargée). */
  partInconnue: number | null;
};

// ── 1. Téléphone et régularité ─────────────────────────────────────────────

export type Actifs = {
  /** Ont ouvert le campus (ou fait une action) dans la période. */
  ouverture: number;
  /** Ont fait au moins une action d'apprentissage dans la période. */
  apprentissage: number;
};

export type JourActivite = {
  jour: Jour;
  /** Étudiants qui ont ouvert le campus ce jour-là ; null avant le début de la mesure jour par jour. */
  ouverts: number | null;
  /** Action d'apprentissage un jour où l'un de leurs cours avait un direct. */
  apprenantsCours: number;
  /** Action d'apprentissage un jour sans direct de leurs cours. */
  apprenantsSansCours: number;
  /** Étudiants dont au moins un cours avait un direct tenu ce jour-là. */
  attendusCours: number;
  /** Étudiants inscrits ce jour-là (compte créé). */
  inscrits: number;
};

export type SemaineApprentissage = {
  semaine: SemaineIso;
  lundi: Jour;
  /** Semaine en cours : chiffres provisoires. */
  enCours: boolean;
  /** Étudiants inscrits avant le lundi de la semaine. */
  inscrits: number;
  /** Médiane des jours d'apprentissage (0 à 7) ; null sous l'effectif minimum. */
  mediane: number | null;
  moyenne: number | null;
  auMoins1: Part;
  auMoins3: Part;
};

export type CohorteRetour = {
  semaine: SemaineIso;
  lundi: Jour;
  /** Comptes créés cette semaine-là. */
  inscrits: number;
  /** Venus au moins une fois (ouverture ou action). */
  venus: number;
  /** Revenus le lendemain de leur premier jour (parmi ceux dont le lendemain est passé). */
  j1: Part;
  /** Revenus entre le 7e et le 13e jour après leur premier jour. */
  j7: Part;
  /** Premier jour antérieur à la mesure jour par jour : seules les actions d'apprentissage étaient connues (minimum). */
  partielle: boolean;
};

export type RepartitionPlateformes = Record<Plateforme | "inconnue", number> & { total: number };

export type BlocRegularite = {
  aujourdhui: Actifs;
  j7: Actifs;
  j30: Actifs;
  courbe: JourActivite[];
  /** Part des jours-étudiants SANS direct où l'étudiant a fait une action d'apprentissage (jours complets de la période). */
  joursSansCours: Part;
  /** Même part pour les jours AVEC un direct de ses cours (à lire à part). */
  joursCours: Part;
  semaines: SemaineApprentissage[];
  cohortes: CohorteRetour[];
  plateformes: RepartitionPlateformes;
  /** Étudiants vus sur le campus au moins deux jours différents. */
  revenus: Part;
};

// ── 2. Directs ─────────────────────────────────────────────────────────────

/** Une ligne de l'entonnoir : attendus → venus → ont suivi → au seuil → ont participé. */
export type LigneEntonnoir = {
  libelle: string;
  attendus: number;
  /** Émargés en salle (QR, code) ou pointés présents par le responsable de salle. */
  enSalle: number;
  /** Venus en ligne (au moins une minute), hors salle. */
  enLigne: number;
  /** En salle, ou en ligne au moins 30 minutes ou la moitié de la séance. */
  ontSuivi: number;
  /** En ligne jusqu'au seuil officiel (70 % de la durée de référence). */
  auSeuil: number;
  /** Présents au sens du bilan : en salle ou au seuil en ligne. */
  presents: number;
  absents: number;
  inconnus: number;
  /** Question, vote, réponse à un sondage, message ou main levée. */
  ontParticipe: number;
  /** Ligne d'un campus : sa salle a-t-elle été émargée ? (null pour le total et les classes) */
  salleEmargee: boolean | null;
};

export type SeanceEntonnoir = {
  id: number;
  titre: string;
  coursCode: string;
  /** Date prévue (seances.debut) et date réelle (demarree_le). */
  prevueLe: string;
  tenueLe: string;
  /** Démarrée un autre jour que prévu (cas de la séance #26). */
  malDatee: boolean;
  sondages: number;
  total: LigneEntonnoir;
  campus: LigneEntonnoir[];
  /** Classes d'au moins EFFECTIF_MINIMUM attendus (classe de l'étudiant au moment de la séance). */
  classes: LigneEntonnoir[];
};

export type EmargementCampus = {
  siteId: number;
  site: string;
  /** Séances tenues où ce campus avait au moins un étudiant attendu. */
  seances: number;
  /** Séances où sa salle a été émargée (au moins 3 émargés de ce campus et 25 % de ses attendus). */
  emargees: number;
  /** Séances touchées par un incident de sa salle (présence inconnue, pas de reproche). */
  incidents: number;
  taux: number | null;
  /** Émargements en salle des étudiants de ce campus, sur leurs présences attendues. */
  emarges: Part;
};

export type BlocDirects = {
  seancesTenues: number;
  presence: TroisEtats;
  /**
   * Étudiants qui ont suivi au moins un direct dans la période, sur ceux dont la présence est connue
   * (au moins une présence ou une absence, ou un direct suivi) : une salle non émargée ne fait pas
   * baisser ce chiffre.
   */
  ontSuivi: Part;
  /** Part des étudiants attendus à un direct dont toutes les présences sont inconnues (null sous 5). */
  ontSuiviInconnue: number | null;
  emargement: EmargementCampus[];
  seances: SeanceEntonnoir[];
};

// ── 3. Travail entre les cours ─────────────────────────────────────────────

export type CleTravail = "copies" | "interrogations" | "qcm_auto" | "exercices_auto";

export type LigneTravail = {
  cle: CleTravail;
  /** Devoirs publiés concernés (échus dans la période ou encore ouverts). */
  devoirs: number;
  /** Dont encore ouverts : le taux est « à ce jour ». */
  ouverts: number;
  attendus: number;
  /** Interrogations seulement : tentatives commencées. */
  commences: number | null;
  /** Copies rendues ou interrogations terminées. */
  rendus: Part;
};

export type BlocRevision = {
  /** Inscrits qui ont révisé au moins une fois ces 7 derniers jours. */
  reviseurs7j: Part;
  /** Réponses de révision par réviseur sur la période. */
  reponsesParReviseur: number | null;
  /** Part des cartes suivies en boîte 3 ou plus (la mémoire tient) ; null si la table des boîtes manque. */
  boite3: Part | null;
};

export type BlocObjectifs = {
  /** Objectifs validés sur (inscrits × jours ouvrés de la période). */
  valides: Part;
};

export type CoupeSemaineCampus = { semaine: string; cibleId: number; nom: string; tauxParticipation: number | null; rang: number | null };

export type BlocTravail = {
  lignes: LigneTravail[];
  /** Absents (connus) à un direct qui ont ouvert son replay. */
  replaysAbsents: Part;
  /** Présence inconnue (salle non émargée) et replay ouvert : à titre d'information. */
  replaysInconnus: Part;
  revision: BlocRevision | null;
  /** Inscrits qui ont ouvert au moins un cours complet dans la période (C1). */
  coursComplets: Part | null;
  objectifs: BlocObjectifs | null;
  /** Étudiants dont la dernière semaine complète a atteint leur objectif de jours actifs (C5). */
  semainesActives: Part | null;
  /** Coupe des campus sur 8 semaines (C5). */
  coupe: CoupeSemaineCampus[] | null;
};

// ── 4. Rappels ─────────────────────────────────────────────────────────────

export type JoignablesCampus = { siteId: number | null; site: string; inscrits: number; abonnes: Part; email: Part };

export type LigneEnvois = {
  /** Priorité (urgent, action, contenu, engagement) ou type de rappel. */
  cle: string;
  total: number;
  envoyes: number;
  differes: number;
  bloques: number;
  echecs: number;
  /** Ouverts dans les 24 h, sur les envoyés. */
  ouverts: Part;
};

export type BlocRappels = {
  /** Téléphone abonné aux rappels. */
  abonnes: Part;
  /** Essai de rappel reçu et confirmé sur le téléphone (C3) ; null tant que la colonne n'existe pas. */
  essaiRecu: Part | null;
  email: Part;
  parCampus: JoignablesCampus[];
  /** Marque déclarée du téléphone (C3). */
  parMarque: { marque: string; n: number }[] | null;
  /** Décisions d'envoi (C3), par priorité et par type. */
  envois: { parPriorite: LigneEnvois[]; parType: LigneEnvois[] } | null;
  /** Effet du rappel d'entraînement (C4) : action d'apprentissage dans les 24 h. */
  effetRappel: { avecRappel: Part; sansRappel: Part; ecartPoints: number | null } | null;
  /** Relances des décrocheurs (C4). */
  relances: { envoyees: number; revenus48h: Part; aAppeler: number } | null;
};

// ── 5 et 6. Copies en attente, séances mal datées, questions ratées ────────

export type CopiesFormateur = {
  formateurId: number | null;
  nom: string;
  enAttente: number;
  /** Ancienneté de la plus ancienne copie en attente, en jours. */
  plusAncienneJours: number | null;
  /** Copies en attente depuis plus de 72 h. */
  auDela72h: number;
  /** Délai médian entre la remise et la note, sur les copies corrigées de la période (heures). */
  delaiMedianHeures: number | null;
  corrigees: number;
};

/** Copies des exercices automatiques de la routine du soir : correction facultative (D2), comptées à part. */
export type CopiesAutomatiques = {
  enAttente: number;
  /** Corrigées sur la période (le formateur l'a fait de lui-même). */
  corrigees: number;
};

export type SeanceMalDatee = { id: number; titre: string; coursCode: string; prevueLe: string; tenueLe: string; ecartJours: number };

export type QuestionRatee = {
  seanceId: number;
  seanceTitre: string;
  coursCode: string;
  enonce: string;
  reponses: number;
  tauxErreur: number;
  origine: "interrogation" | "revision";
};

// ── Réponse de GET /api/pilotage/engagement ────────────────────────────────

export type EngagementPilotage = {
  perimetre: { tout: boolean; site: string | null };
  filtre: { jours: number; siteId: number | null; classeId: number | null };
  /** Étudiants actifs du filtre. */
  effectif: number;
  /** Moins de EFFECTIF_MINIMUM étudiants : la page n'affiche aucun chiffre détaillé. */
  effectifTropPetit: boolean;
  aujourdhui: Jour;
  debut: Jour;
  /** Premier jour de la mesure jour par jour (activite_jours) ; null si rien n'est encore enregistré. */
  mesureDepuis: Jour | null;
  regularite: BlocRegularite | null;
  directs: BlocDirects | null;
  travail: BlocTravail | null;
  rappels: BlocRappels | null;
  /** Copies des devoirs donnés par les formateurs (les exercices automatiques n'y sont jamais). */
  copies: CopiesFormateur[];
  /** Copies des exercices automatiques, à part (null si rien n'est calculé : groupe trop petit). */
  copiesAutomatiques: CopiesAutomatiques | null;
  seancesMalDatees: SeanceMalDatee[];
  questionsRatees: QuestionRatee[];
  genereLe: string;
  /** Durée du calcul (ms) : le résultat est gardé 10 minutes. */
  calculMs: number;
};

// ── Tableau de pilotage (/pilotage) : les chiffres corrigés ────────────────

/** Ajouts de C8 aux indicateurs d'un campus du tableau existant (IndicateursCampus). */
export type IndicateursEngagement = {
  /** Ont ouvert le campus aujourd'hui (jour local). */
  actifsAujourdhui: number;
  /** Ont fait une action d'apprentissage aujourd'hui. */
  apprenantsAujourdhui: number;
  /** Vus au moins deux jours différents. */
  revenus: Part;
  /**
   * Ont suivi au moins un direct en 30 jours (émargés, ou 30 min ou la moitié en ligne), sur les
   * étudiants dont la présence est connue : les présences « inconnu » ne sont pas au dénominateur.
   */
  ontSuivi: Part;
  /** Part des étudiants attendus à un direct dont la présence est entièrement inconnue (null sous 5). */
  ontSuiviInconnue: number | null;
  /** Présence aux directs de 30 jours en trois états. */
  presence: TroisEtats;
  /** Copies rendues à ce jour, devoirs ouverts compris. */
  copies: Part;
  /** Devoirs encore ouverts parmi ceux comptés. */
  devoirsOuverts: number;
  /** Séances de 30 jours dont la salle de ce campus a été émargée (null pour le total). */
  emargement: { seances: number; emargees: number } | null;
};

export type IndicateursTableau = IndicateursCampus & IndicateursEngagement;

/**
 * GET /api/pilotage/tableau : le tableau existant, ses chiffres corrigés, et
 * les 4 premiers « à contacter » (null sans le droit « suivi ») pour que la
 * liste ne soit calculée qu'une fois par visite.
 */
export type TableauPilotageEngagement = Omit<TableauPilotage, "total" | "campus"> & {
  total: IndicateursTableau;
  campus: IndicateursTableau[];
  aContacter: { total: number; lignes: AContacter[] } | null;
};
