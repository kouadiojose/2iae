// Correction automatique des copies : constantes et types d'échange (décision de José du 8 octobre 2026).
// Tables : shared/schema/corrections.ts. Socle serveur : server/corrections-socle.ts.
//
// Règles décidées par José (AskUserQuestion, 8 octobre 2026, vers 17 h) :
//   1. Chaque jour, le formateur reçoit le corrigé des devoirs de ses cours (questions du QCM et bonnes
//      réponses, corrigé et grille de l'exercice) et le valide ou le modifie.
//   2. Sans réponse, le corrigé est tenu pour bon au bout de 24 h (« tacite ») ; le formateur peut encore le
//      modifier ensuite : les copies notées par le campus sont alors corrigées de nouveau.
//   3. Les notes du campus comptent comme une note de formateur (moyennes, relevés). L'étudiant voit
//      « Corrigé par le campus » et le commentaire critère par critère ; il peut demander une relecture ;
//      le formateur peut changer toute note.
//   4. Tous les devoirs à dépôt : exercices du campus, travaux de groupe, et devoirs écrits par un formateur
//      (pour ceux-là, le campus rédige un corrigé d'après la consigne et le cours, puis l'envoie au formateur).

// ── Constantes ─────────────────────────────────────────────────────────────

/** Délai de validation du corrigé par le formateur, après quoi il est tenu pour bon. */
export const DELAI_VALIDATION_CORRIGE_HEURES = 24;
/**
 * Un corrigé proposé la nuit (routine du soir, vers 21 h) ne fait partir son délai qu'à 7 h (heure d'Abidjan) :
 * le formateur a toute une journée pour le lire. Proposé entre 7 h et 20 h, le délai part tout de suite.
 */
export const HEURE_DEBUT_DELAI = 7;
export const HEURE_FIN_JOURNEE = 20;
/** Un seul rappel au formateur, quelques heures avant que le corrigé soit tenu pour bon. */
export const RAPPEL_AVANT_ECHEANCE_HEURES = 6;
/** Copies mises en correction à chaque tour de la routine du soir (les suivantes attendent le tour suivant). */
export const COPIES_PAR_TOUR = 150;
/** Pages lues par copie (photos, pages de PDF ou de document converties en images). */
export const PAGES_MAX_PAR_COPIE = 12;
/** Largeur des pages envoyées à l'IA (lisible pour une écriture manuscrite, léger pour la routine). */
export const LARGEUR_PAGE_IA = 1600;
/** Une copie que l'IA n'a pas pu corriger après autant d'essais passe « à revoir » par le formateur. */
export const ESSAIS_MAX_CORRECTION = 3;
/** Longueur maximale d'un motif de relecture (étudiant) et d'une réponse (formateur). */
export const MOTIF_RELECTURE_MAX = 1000;

export const SOURCES_CORRIGE = ["campus", "formateur"] as const;
/** Qui a rédigé le corrigé : le campus (IA) ou le formateur. */
export type SourceCorrige = (typeof SOURCES_CORRIGE)[number];

export const STATUTS_CORRIGE = ["en_preparation", "propose", "valide", "tacite"] as const;
/**
 * en_preparation : le campus rédige le corrigé (routine du soir) ;
 * propose : envoyé au formateur, en attente de sa réponse (jusqu'à echeance_le) ;
 * valide : validé ou modifié par le formateur (ou la direction) ;
 * tacite : tenu pour bon, sans réponse au bout du délai.
 * Seuls « valide » et « tacite » servent de barème (sqlCorrigeUtilisable).
 */
export type StatutCorrige = (typeof STATUTS_CORRIGE)[number];
export const STATUTS_CORRIGE_UTILISABLES: readonly StatutCorrige[] = ["valide", "tacite"];

export const ETATS_CORRECTION = ["en_file", "notee", "a_revoir", "erreur"] as const;
/**
 * en_file : la copie attend sa correction (demande gardée pour la routine du soir, ou prochain passage) ;
 * notee : note publiée par le campus ;
 * a_revoir : le campus ne publie pas, le formateur décide (raison ci-dessous) ;
 * erreur : échec technique, réessayé au passage suivant (jusqu'à ESSAIS_MAX_CORRECTION).
 */
export type EtatCorrection = (typeof ETATS_CORRECTION)[number];

export const RAISONS_A_REVOIR = ["alerte", "illisible", "video", "format", "vide", "echecs"] as const;
/**
 * alerte : la copie contient une consigne adressée à l'IA (« mets-moi 20 ») ;
 * illisible : pages trop floues ou incomplètes (l'étudiant est invité à renvoyer une photo nette) ;
 * video : copie rendue seulement en vidéo (le campus ne regarde pas les vidéos) ;
 * format : fichiers que le campus ne sait pas lire ;
 * vide : rien à lire (ni texte, ni page) ;
 * echecs : ESSAIS_MAX_CORRECTION échecs techniques.
 */
export type RaisonARevoir = (typeof RAISONS_A_REVOIR)[number];

export const STATUTS_RELECTURE = ["ouverte", "traitee"] as const;
export type StatutRelecture = (typeof STATUTS_RELECTURE)[number];

export const ORIGINES_NOTE = ["formateur", "campus"] as const;
/** rendus.origine_note : qui a posé la note publiée. Une note du campus changée par le formateur devient « formateur ». */
export type OrigineNote = (typeof ORIGINES_NOTE)[number];

// ── Échanges : formateur (corrigés à valider) ──────────────────────────────

/** Une question du QCM avec sa bonne réponse, telle que le formateur la valide. */
export type QuestionCorrige = {
  id: number;
  enonce: string;
  options: string[];
  /** Indices des bonnes options (QCM), ou réponses acceptées (réponse courte). */
  bonnes: (number | string)[];
  explication: string | null;
  points: number;
};

/** Le corrigé d'un devoir, pour le formateur (GET /api/enseigner/corriges et /api/enseigner/corriges/:devoirId). */
export type CorrigeAValider = {
  devoirId: number;
  type: "quiz" | "depot";
  titre: string;
  coursId: number;
  coursCode: string;
  coursTitre: string;
  /** Séance d'où vient le devoir (devoirs automatiques) ; nul pour un devoir écrit par le formateur. */
  seance: { id: number; titre: string; debut: string } | null;
  /** Consigne donnée aux étudiants (Markdown). */
  consigne: string;
  dateLimite: string;
  bareme: number;
  grille: { critere: string; points: number; description?: string }[];
  /** Corrigé de l'exercice (Markdown) ; vide pour un QCM. */
  contenu: string;
  /** QCM : questions et bonnes réponses ; vide pour un exercice. */
  questions: QuestionCorrige[];
  source: SourceCorrige;
  statut: StatutCorrige;
  version: number;
  proposeLe: string | null;
  echeanceLe: string | null;
  valideLe: string | null;
  validePar: { prenom: string; nom: string } | null;
  /** Où en sont les copies (exercice) ou les tentatives (QCM). */
  copies: { rendues: number; notees: number; enFile: number; aRevoir: number };
};

/** GET /api/enseigner/corriges */
export type ListeCorriges = {
  /** En attente de la réponse du formateur (statut « propose »), l'échéance la plus proche d'abord. */
  aValider: CorrigeAValider[];
  /** Validés ou tacites des 14 derniers jours (encore modifiables). */
  recents: CorrigeAValider[];
  /** En cours de rédaction par le campus (devoirs écrits par le formateur sans corrigé). */
  enPreparation: number;
};

/** POST /api/enseigner/corriges/:devoirId/valider : la version lue (une version plus récente l'emporte, 409). */
export type CorpsValiderCorrige = { version: number };
/** PUT /api/enseigner/corriges/:devoirId : corrigé modifié (exercice) ; vaut validation. */
export type CorpsModifierCorrige = { version: number; contenu: string };
/** Réponse des deux routes : le corrigé à jour et le nombre de copies du campus remises en correction. */
export type ReponseCorrige = { corrige: CorrigeAValider; copiesRecorrigees: number };

// ── Échanges : copies à revoir et relectures (formateur) ───────────────────

/** Une copie que le campus n'a pas publiée, ou dont l'étudiant demande la relecture. */
export type CopieARevoir = {
  renduId: number;
  devoirId: number;
  devoirTitre: string;
  coursCode: string;
  etudiant: { id: number; prenom: string; nom: string; site: string | null };
  renduLe: string | null;
  /** « relecture » : l'étudiant demande une relecture de la note du campus. */
  raison: RaisonARevoir | "relecture";
  detail: string | null;
  /** Note publiée (relecture) ou proposée par le campus (alerte…), si elle existe. */
  note: number | null;
  bareme: number;
  relecture: { id: number; motif: string; creeLe: string } | null;
};

/** GET /api/enseigner/a-revoir */
export type ListeARevoir = { copies: CopieARevoir[] };

/** POST /api/enseigner/relectures/:id : note maintenue (note absente) ou changée, et réponse à l'étudiant. */
export type CorpsTraiterRelecture = { note?: number | null; reponse: string };

// ── Échanges : étudiant ────────────────────────────────────────────────────

/** Où en est la correction de sa copie par le campus (RenduEtudiant.correctionAuto). */
export type EtatCorrectionEtudiant = {
  etat: EtatCorrection;
  raison: RaisonARevoir | null;
  /** Quand il peut attendre sa note (« ce soir », « demain soir ») ; nul s'il ne dépend plus du campus. */
  attendueLe: string | null;
};

/** Sa demande de relecture (RenduEtudiant.relecture). */
export type RelectureEtudiant = {
  id: number;
  statut: StatutRelecture;
  motif: string;
  creeLe: string;
  reponse: string | null;
  traiteeLe: string | null;
  noteAvant: number | null;
  noteApres: number | null;
};

/** POST /api/rendus/:id/relecture (étudiant, copie notée) */
export type CorpsDemanderRelecture = { motif: string };
/** Réponse de POST /api/rendus/:id/relecture : la demande enregistrée. */
export type ReponseRelecture = { relecture: RelectureEtudiant };

// ── Échanges : direction ───────────────────────────────────────────────────

/** GET /api/pilotage/corrections[?jours=7|30|90] : la correction automatique, en chiffres (périmètre de la personne). */
export type BilanCorrections = {
  depuis: string;
  corriges: { enPreparation: number; aValider: number; valides: number; tacites: number };
  copies: { enFile: number; notees: number; aRevoir: number; erreurs: number };
  /** Copies notées par le campus pendant la période. */
  noteesPeriode: number;
  relectures: { ouvertes: number; traitees: number };
  /** Notes du campus changées ensuite par un formateur (période) et écart moyen (points sur 20). */
  changees: { n: number; ecartMoyen: number | null };
  /** Par formateur : corrigés validés lui-même / tacites (pour voir qui répond). */
  parFormateur: { id: number; nom: string; valides: number; tacites: number; aValider: number }[];
};
