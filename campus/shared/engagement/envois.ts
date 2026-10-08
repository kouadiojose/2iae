// Rappels sur le téléphone (chantier C3) : la politique d'envoi en constantes
// et les types d'échange du module, sans drizzle (le client les importe).
//
// Politique (CONCEPTION §9.16, plan d'engagement) :
//   - au plus 3 rappels par jour et par personne, comptés dans SON jour local ;
//   - une place toujours gardée pour une action : un contenu (cours, replay,
//     annonce…) ne prend que les 2 premières places, un rappel d'engagement
//     aussi, et un seul par jour ;
//   - heures calmes de 21 h à 6 h dans le fuseau de la personne ; seul un
//     rappel urgent (15 min avant un live, « En direct ») passe la nuit ;
//   - ce qui ne peut pas sonner n'est jamais perdu : une action ou un contenu
//     part dans le résumé du matin suivant, un rappel d'engagement reste dans
//     la cloche.

/**
 * Priorité d'envoi :
 * urgent : le live commence (hors plafond, même la nuit) ·
 * action : échéance, message d'un formateur, live déplacé… (3 places) ·
 * contenu : nouveauté d'un cours ou d'une séance, annonce (2 places, regroupée) ·
 * engagement : rappel d'entraînement ou relance (2 places, un par jour).
 */
export const PRIORITES = ["urgent", "action", "contenu", "engagement"] as const;
export type Priorite = (typeof PRIORITES)[number];

/**
 * Décision prise pour une personne et une notification (table envois_push, lue par C8) :
 * envoye : parti vers au moins un appareil ·
 * regroupe : nouveauté de la même séance (ou du même lien) dans les 3 h : remplace la précédente sur le téléphone, sans prendre de place ·
 * differe : heures calmes ; une action ou un contenu part dans le résumé du matin, un rappel d'engagement reste dans la cloche ·
 * plafond : plus de place ce jour-là ; une action ou un contenu part dans le résumé du lendemain matin, un rappel d'engagement reste dans la cloche ·
 * echec : aucun appareil n'a accepté le rappel (la place est rendue) ·
 * expire : un appareil a été oublié (abonnement révoqué, erreur 404 ou 410), une ligne par appareil ·
 * sans_abonnement : la personne n'a aucun téléphone abonné.
 */
export const STATUTS_ENVOI = ["envoye", "regroupe", "differe", "plafond", "echec", "expire", "sans_abonnement"] as const;
export type StatutEnvoi = (typeof STATUTS_ENVOI)[number];

/** Type d'un envoi qui n'est pas une notification de la cloche : le résumé du matin. */
export const TYPE_RESUME = "resume";

/** Rappels par jour et par personne, hors rappels urgents. */
export const PLAFOND_JOUR = 3;
/** Un contenu ne part que s'il reste au moins une place après lui pour une action. */
export const PLACES_CONTENU = 2;
/** Même règle pour un rappel d'engagement, qui ne part en plus qu'une fois par jour. */
export const PLACES_ENGAGEMENT = 2;
/** Heures calmes, dans le fuseau de la personne : de 21 h à 6 h. */
export const HEURES_CALMES = { debut: 21, fin: 6 } as const;
/** Deux nouveautés de la même séance (ou du même lien) à moins de 3 h : la seconde remplace la première. */
export const DELAI_REGROUPEMENT_MS = 3 * 60 * 60_000;
/** Durée de vie chez le service d'envoi : un téléphone sans données le reçoit encore 12 h plus tard. */
export const DUREE_VIE_S = { urgent: 15 * 60, autre: 12 * 60 * 60 } as const;
/** Conservation des décisions d'envoi (plan d'engagement § 4). */
export const CONSERVATION_ENVOIS_JOURS = 90;
/** « Plus tard » sur l'accueil masque la carte des rappels une semaine. */
export const PLUS_TARD_JOURS = 7;

/** Marques proposées d'un toucher dans le guide (Tecno, Infinix et itel ferment Chrome en arrière-plan). */
export const MARQUES = ["tecno", "infinix", "itel", "samsung", "autre"] as const;
export type Marque = (typeof MARQUES)[number];
export const PLATEFORMES = ["android", "ios", "ordinateur"] as const;
export type PlateformeRappels = (typeof PLATEFORMES)[number];

/** POST /api/push/abonnement : l'abonnement du navigateur, plus la plateforme et la marque si on les connaît. */
export type DemandeAbonnement = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  plateforme?: PlateformeRappels;
  marque?: Marque;
};

/** POST /api/push/verification : « L'as-tu reçu ? », et la marque choisie dans le guide. */
export type DemandeVerification = { endpoint: string; recu: boolean; marque?: Marque };

/** GET /api/push/etat?endpoint=… : ce que le campus sait des rappels de cette personne et de cet appareil. */
export type EtatRappels = {
  /** Le campus sait envoyer des rappels (clés configurées). */
  disponible: boolean;
  /** Appareils abonnés pour ce compte. */
  appareils: number;
  /** Cet appareil (l'endpoint demandé), ou null si le campus ne le connaît pas (abonnement perdu, autre compte…). */
  cetAppareil: {
    plateforme: PlateformeRappels | null;
    marque: Marque | null;
    /** Réponse à « L'as-tu reçu ? » : null tant que la personne n'a pas répondu. */
    recu: boolean | null;
    verifieLe: string | null;
    derniereReussiteLe: string | null;
  } | null;
  /** Il est entre 21 h et 6 h chez la personne : un essai partirait le matin. */
  heuresCalmes: boolean;
  /** Rappels déjà partis aujourd'hui (jour local) et plafond. */
  envoisDuJour: number;
  plafond: number;
};
