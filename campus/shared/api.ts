// Contrats d'API partagés entre modules (serveur et client).
// Les dates voyagent en JSON sous forme de chaînes ISO : Json<T> le reflète.
import type { Notification, Role, StatutSeance, FournisseurVisio } from "./schema";

/** Type T tel qu'il arrive côté client après JSON (Date → string). */
export type Json<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;

export type PersonneResume = {
  id: number;
  prenom: string;
  nom: string;
  role: Role;
  photoUrl: string | null;
  titre: string | null;
  siteId: number | null;
};

/** Séance live résumée (listes, bandeaux, accueil). */
export type SeanceResume = {
  id: number;
  titre: string;
  coursId: number;
  coursCode: string;
  coursTitre: string;
  debut: string;
  dureeMinutes: number;
  statut: StatutSeance;
  fournisseur: FournisseurVisio;
  replayDisponible: boolean;
  formateur: { id: number; prenom: string; nom: string; localisation: string | null; photoUrl: string | null } | null;
};

/** GET /api/live/en-cours — séance en direct maintenant et prochaine séance de la personne. */
export type EnCours = {
  enDirect: SeanceResume | null;
  prochaine: SeanceResume | null;
};

/** GET /api/notifications — les plus récentes d'abord. */
export type NotificationDto = Json<Notification>;

/** GET /api/notifications/compteur */
export type CompteurNotifications = { nonLues: number; messagesNonLus: number };

// ── Vitrine publique (lue par le site www.2iae.com) ────────────────────────

export type VitrineCours = {
  code: string;
  slug: string;
  titre: string;
  accroche: string;
  imageUrl: string | null;
  couleur: string;
  dateDebut: string | null;
  dateFin: string | null;
  formateur: VitrineFormateur | null;
  /** Nombre de campus qui suivent le cours. */
  nbCampus: number;
  url: string;
};

export type VitrineFormateur = {
  slug: string;
  prenom: string;
  nom: string;
  titre: string | null;
  localisation: string | null;
  bio: string | null;
  photoUrl: string | null;
  annonceLe: string | null;
  cours: { code: string; titre: string; slug: string }[];
  url: string;
};

export type VitrineLive = {
  id: number;
  titre: string;
  coursCode: string;
  coursTitre: string;
  debut: string;
  dureeMinutes: number;
  enDirect: boolean;
  formateur: { prenom: string; nom: string; localisation: string | null } | null;
  url: string;
};

export type VitrineAnnonce = {
  id: number;
  titre: string;
  corps: string;
  publieeLe: string;
};

/** GET /api/public/vitrine — tout ce que le site affiche du campus. */
export type Vitrine = {
  campus: { nom: string; url: string; sites: { nom: string; salle: string }[] };
  /** Cours annoncés : à venir ou commencés depuis moins de 30 jours. */
  cours: VitrineCours[];
  /** Formateurs annoncés, du plus récent au plus ancien. */
  formateurs: VitrineFormateur[];
  /** Lives publics des 14 prochains jours (et celui en cours). */
  lives: VitrineLive[];
  annonces: VitrineAnnonce[];
  chiffres: { etudiants: number; formateurs: number; cours: number; heuresDeDirect: number };
  genereLe: string;
};
