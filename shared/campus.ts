// Campus numérique 2IAE — types partagés entre le serveur et le client du site.
//
// Le campus (dossier campus/, service Railway à part) expose sa vitrine
// publique sur GET <campus>/api/public/vitrine. Le site est une application
// séparée : il n'importe rien du campus, ces types sont une COPIE du contrat
// défini dans campus/shared/api.ts (section « Vitrine publique »). Toute
// évolution du contrat côté campus doit être reportée ici.

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

/** GET <campus>/api/public/vitrine — tout ce que le site affiche du campus. */
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

// ── Réponse du site : GET /api/campus/vitrine ─────────────────────────────

/** Vitrine connue (fraîche, ou dernière version si le campus est injoignable). */
export type VitrineCampusDisponible = Vitrine & {
  indisponible?: false;
  /** Adresse publique du campus (bouton « Accéder au campus »). */
  campusUrl: string;
  /** Faux quand le campus ne répond plus et qu'on sert la dernière version connue. */
  aJour: boolean;
  /** Dernière lecture réussie auprès du campus (ISO). */
  luLe: string;
  /** Heure du serveur du site (ISO) : cale les comptes à rebours. */
  maintenant: string;
};

/** Le campus n'a encore jamais répondu depuis le démarrage du site. */
export type VitrineCampusIndisponible = {
  indisponible: true;
  campusUrl: string;
  maintenant: string;
};

export type ReponseVitrineCampus = VitrineCampusDisponible | VitrineCampusIndisponible;

/** Corps du webhook POST /api/campus/rafraichir envoyé par le campus. */
export type EvenementCampus = {
  evenement: string;
  raison?: string;
  horodatage: string;
};

/** Adresse actuelle du campus, utilisée tant que le nouveau campus n'a pas répondu. */
export const CAMPUS_URL_REPLI = "https://campus.groupe2iae.com";

/** Les cinq sites du groupe, dans l'ordre de la maquette (repli sans vitrine). */
export const SITES_CAMPUS_REPLI: { nom: string; salle: string }[] = [
  { nom: "Riviera Palmeraie", salle: "Salle de conférence" },
  { nom: "Yopougon", salle: "Salle de conférence" },
  { nom: "Yamoussoukro", salle: "Salle de conférence" },
  { nom: "Azaguié", salle: "Salle de conférence" },
  { nom: "M'Batto", salle: "Salle de conférence" },
];
