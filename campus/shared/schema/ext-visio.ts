// Module « visio » : visio intégrée au campus (WebRTC pair-à-pair en étoile
// autour du formateur) et « radio » du cours (son du formateur en flux HTTP).
//
// Aucune table : l'état d'une classe en visio (qui est connecté, qui émet la
// radio) vit en mémoire du serveur, le temps de la séance. Ce fichier ne
// porte que les contrats d'API partagés par le serveur et le client.

/** Place d'une personne dans l'étoile : le formateur au centre, les salles et les étudiants autour. */
export type RoleVisio = "formateur" | "salle" | "etudiant";

/** Un onglet connecté à la visio d'une séance (une personne peut en ouvrir plusieurs). */
export type ParticipantVisio = {
  /** Identifiant de l'onglet (tiré au hasard par le navigateur). */
  pairId: string;
  role: RoleVisio;
  utilisateurId: number;
  siteId: number | null;
  /** Nom affiché au formateur : « Yopougon » pour une salle, « Aya K. » pour un étudiant. */
  nom: string;
  /** L'étudiant reçoit la vidéo du formateur (place vidéo occupée). */
  video: boolean;
  rejointLe: string;
};

/** POST /api/visio/:seanceId/rejoindre */
export type ReponseRejoindreVisio = {
  pairId: string;
  role: RoleVisio;
  /** Le formateur au centre de l'étoile (null tant qu'il n'est pas arrivé). */
  formateur: { pairId: string } | null;
  /** Rôle formateur : les onglets déjà connectés, à appeler un par un. */
  participants: ParticipantVisio[];
  /** Étudiant : vidéo accordée (sinon son seul, places vidéo toutes prises). */
  video: boolean;
  /** Étudiant : la classe en visio est complète ; il écoute la radio à la place. */
  complet: boolean;
  iceServers: RTCIceServerJson[];
};

/** Serveur STUN/TURN tel que l'attend RTCPeerConnection. */
export type RTCIceServerJson = { urls: string | string[]; username?: string; credential?: string };

/** GET /api/visio/ice */
export type ReponseIceVisio = { iceServers: RTCIceServerJson[]; turn: boolean };

/** GET /api/visio/:seanceId/pairs (formateur) */
export type PairsVisio = {
  formateur: { pairId: string } | null;
  participants: ParticipantVisio[];
  /** Les salles de conférence du groupe, pour afficher la grille complète. */
  sites: { id: number; nomCourt: string; salleConference: string }[];
  places: { video: number; videoPrises: number; total: number; prises: number };
};

export const TYPES_SIGNAL_VISIO = ["offre", "reponse", "ice", "raccrocher"] as const;
export type TypeSignalVisio = (typeof TYPES_SIGNAL_VISIO)[number];

/**
 * Événement temps réel « visio » reçu sur le canal personnel u:<id>.
 * « vers » désigne l'onglet destinataire : les autres onglets l'ignorent.
 */
export type EvenementVisio =
  | { seanceId: number; vers: string; genre: "signal"; de: string; type: TypeSignalVisio; donnees: unknown }
  | { seanceId: number; vers: string; genre: "pair-arrive"; participant: ParticipantVisio }
  | { seanceId: number; vers: string; genre: "pair-part"; pairId: string }
  | { seanceId: number; vers: string; genre: "formateur-arrive"; pairId: string }
  | { seanceId: number; vers: string; genre: "formateur-part"; pairId: string }
  | { seanceId: number; vers: string; genre: "remplace" };

/** GET /api/radio/:seanceId/etat */
export type EtatRadio = {
  enDirect: boolean;
  /** Personnes distinctes à l'écoute en ce moment. */
  auditeurs: number;
  /** Début de l'émission en cours (ISO). */
  depuis: string | null;
  /** Débit mesuré du flux, en octets par seconde (≈ 3 000 pour 24 kbit/s). */
  debit: number;
};

/** Événement temps réel « radio » sur le canal visio:<seanceId>. */
export type EvenementRadio = { genre: "debut" | "redemarrage" | "fin"; seanceId: number };
