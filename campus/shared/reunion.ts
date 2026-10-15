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
  /** Dernière ouverture, fermeture ou changement de lien, et par qui. */
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
  /** La direction ajoute et retire des salles ; l'équipe ouvre, ferme, partage et change le lien. */
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
