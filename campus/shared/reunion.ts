// Salle de réunion de l'administration (demande de José du 13 octobre 2026) : un lien permanent, à partager à tous
// les participants, qui marche sans compte et à tout moment ; la direction ferme la réunion quand il le faut (personne
// n'entre plus, les personnes présentes sortent) et la rouvre : le MÊME lien remarche. « Changer le lien » donne un
// nouveau lien (l'ancien ne marche plus) s'il a trop circulé. Plusieurs salles possibles (« Conseil pédagogique »).
//
// Serveur : server/routes/reunions.ts (réglages dans contenus_site, clés « pilotage.reunion.<id> », jamais servies au
// site public). Client : modules/reunion (/pilotage/reunion pour l'équipe, /reunion/:jeton pour tous).

/** Préfixe des clés de contenus_site : une ligne par salle de réunion. */
export const PREFIXE_CLE_REUNION = "pilotage.reunion.";
/** Identifiant fixe de la salle principale (« Réunion de l'administration »), créée d'elle-même à la première visite. */
export const ID_REUNION_PRINCIPALE = "administration";
export const NOM_REUNION_PRINCIPALE = "Réunion de l'administration";
/** Salles de réunion au plus, principale comprise. */
export const REUNIONS_MAX = 5;
/** Le jeton du lien : 32 caractères hexadécimaux tirés au hasard (128 bits), ni « _ » ni « - » que WhatsApp couperait. */
export const FORMAT_JETON_REUNION = /^[0-9a-f]{32}$/;
/** Nom d'une salle : de 2 à 60 caractères. */
export const NOM_REUNION_MAX = 60;

/** Dernier geste sur une salle, gardé avec elle (« Lien changé par … », « Fermée par … »). */
export const ACTIONS_REUNION = ["creee", "ouverte", "fermee", "lien"] as const;
export type ActionReunion = (typeof ACTIONS_REUNION)[number];

/** Une personne dans la réunion, lue chez Daily (sans rejoindre la salle). */
export type PresentReunionDto = { nom: string; depuis: string };

/** GET /api/pilotage/reunions : une salle de réunion vue par l'équipe. */
export type ReunionDto = {
  id: string;
  nom: string;
  principale: boolean;
  ouverte: boolean;
  /** Le lien à partager (https://campus.2iae.com/reunion/<jeton>). */
  lien: string;
  /** Message prêt à envoyer, lien compris. */
  message: string;
  /** https://wa.me/?text=… (on choisit le destinataire dans WhatsApp). */
  whatsapp: string;
  /** Dernier geste sur la salle (ajout, ouverture, fermeture, changement de lien), quand et par qui. */
  majAction: ActionReunion | null;
  majLe: string | null;
  majPar: string | null;
  /** Qui est dans la réunion en ce moment (réunion ouverte, Daily configuré). */
  presents: PresentReunionDto[];
  /** La présence a pu être lue chez Daily. */
  presenceLue: boolean;
};

export type ReunionsDto = {
  reunions: ReunionDto[];
  /** La visio Daily est configurée sur ce campus (sinon personne ne peut entrer). */
  daily: boolean;
  /**
   * La direction ouvre, ferme, change le lien, ajoute et retire des salles. L'équipe des écrans et de la visio
   * (droit « outils_campus ») voit la page : le lien, Copier, WhatsApp, Entrer, qui est dedans.
   */
  peutGerer: boolean;
  max: number;
};

/** GET /api/reunion/:jeton : ce que voit la personne qui ouvre le lien (rien d'autre que « fermée » quand elle l'est). */
export type ReunionPubliqueDto =
  | {
      etat: "ouverte";
      nom: string;
      /** Membre du personnel connecté : il entre sous son nom, sans le taper. */
      personnel: { nom: string } | null;
    }
  | { etat: "fermee" };
