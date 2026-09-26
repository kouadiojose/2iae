// Module « visio » : visio intégrée au campus (WebRTC pair-à-pair en étoile
// autour du formateur), « radio » du cours (son du formateur en flux HTTP) et
// réglages de Daily (salle d'essai, répétition, direct immédiat, coût).
//
// L'état d'une classe en visio (qui est connecté, qui émet la radio) vit en
// mémoire du serveur, le temps de la séance. Deux tables seulement, en fin de
// fichier : les réglages de la visio et les « directs immédiats ».
import { integer, text, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import { seances, type FournisseurVisio } from "./live";

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

// ════════════════════════════════════════════════════════════════════════════
// Daily : salle d'essai, répétition, direct immédiat, coût, fuseau (v2)
// ════════════════════════════════════════════════════════════════════════════
//
// Deux petites tables : les réglages de la visio (une seule ligne, id = 1) et
// les « directs immédiats » (séance créée à la volée depuis le Studio, pour
// savoir qui l'a lancée, s'il fallait prévenir les étudiants, et effacer les
// essais qui n'ont servi à personne).

/** Réglages de la visio (ligne unique, id = 1), modifiables par la direction sur /pilotage/visio. */
export const reglagesVisio = campusSchema.table("reglages_visio", {
  id: integer("id").primaryKey().default(1),
  /** Fournisseur des nouvelles séances (Daily si configuré, sinon la visio du campus). */
  fournisseurParDefaut: text("fournisseur_par_defaut").$type<FournisseurVisio>(),
  /** Un étudiant en ligne entre-t-il en vidéo par défaut ? Non : « son + diapos », il choisit la vidéo s'il le veut. */
  videoEtudiantParDefaut: boolean("video_etudiant_par_defaut").notNull().default(false),
  /** Étudiants en vidéo dans une salle Daily (au-delà : « complète », ils suivent en son + diapos ; formateur, salles et équipe ont leurs places à part). */
  placesDailyEtudiants: integer("places_daily_etudiants").notNull().default(30),
  /** Prix d'une minute-participant Daily, en dollars (0,004 $ au tarif public). */
  prixMinuteUsd: real("prix_minute_usd").notNull().default(0.004),
  /** Minutes-participant offertes chaque mois par Daily (10 000 au tarif public). */
  minutesOffertes: integer("minutes_offertes").notNull().default(10_000),
  /** Taux de conversion affiché : 1 dollar ≈ N FCFA. */
  tauxFcfa: integer("taux_fcfa").notNull().default(600),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
  majParId: integer("maj_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
});

/** Séances lancées par « Lancer un direct maintenant » (Studio). */
export const directsImmediats = campusSchema.table("directs_immediats", {
  seanceId: integer("seance_id")
    .primaryKey()
    .references(() => seances.id, { onDelete: "cascade" }),
  creeParId: integer("cree_par_id")
    .notNull()
    .references(() => utilisateurs.id, { onDelete: "cascade" }),
  /** Les étudiants ont été prévenus (sinon c'est un essai : pas d'enregistrement, effacé après coup s'il n'a servi à personne). */
  prevenir: boolean("prevenir").notNull().default(false),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type ReglagesVisio = typeof reglagesVisio.$inferSelect;
export type DirectImmediat = typeof directsImmediats.$inferSelect;

/** GET /api/visio/options : ce que le client doit savoir de la visio de ce campus. */
export type OptionsVisio = {
  daily: boolean;
  /** Sous-domaine Daily (« schoolofservant » pour schoolofservant.daily.co), s'il est connu. */
  domaineDaily: string | null;
  fournisseurParDefaut: FournisseurVisio;
  fournisseurs: FournisseurVisio[];
  videoEtudiantParDefaut: boolean;
};

/** Profil d'une personne dans une salle Daily (droits du jeton). */
export type ProfilDaily = "formateur" | "salle" | "etudiant" | "observateur";

/** Accès à une salle Daily : POST /api/visio/essai/rejoindre, ou /api/seances/:id/rejoindre (Daily). */
export type AccesDaily = {
  url: string;
  jeton: string;
  nomAffiche: string;
  profil: ProfilDaily;
  /** Le formateur doit lancer l'enregistrement du replay dès que la séance passe en direct. */
  enregistrement?: boolean;
  /** Répétition : la séance n'est pas en direct, les étudiants ne sont pas là. */
  repetition?: boolean;
};

/** Réponse de /api/seances/:id/rejoindre (contrat RejoindreDto du module live, enrichi pour Daily). */
export type RejoindreVisioDto = {
  fournisseur: FournisseurVisio;
  url: string | null;
  jeton?: string;
  nomAffiche: string;
  message?: string;
  profil?: ProfilDaily;
  enregistrement?: boolean;
  /** Durée maximale de l'enregistrement du replay (secondes) : la durée du cours plus le débordement possible. */
  enregistrementMaxS?: number;
  repetition?: boolean;
};

/** Personne présente dans une salle Daily (lu côté serveur, sans jeton). */
export type PresentVisio = { nom: string; depuis: string };

/** GET /api/visio/essai/presence et /api/visio/seances/:id/presence */
export type PresenceSalleVisio = { salle: string; presents: PresentVisio[]; lu: string; disponible: boolean };

/** POST /api/visio/essai/resultat : ce que la personne vient de vérifier. */
export type ResultatEssaiVisio = {
  connexion: "ok" | "avertissement" | "echec" | "non_teste";
  qualite: "bonne" | "moyenne" | "faible" | null;
  camera: boolean | null;
  micro: boolean | null;
  salle: boolean;
};

/** GET /api/visio/pret : la carte « Prêt pour votre prochaine classe » (formateur, direction). */
export type PretClasseDto = {
  fuseau: string | null;
  essai: { le: string; reussi: boolean; salle: boolean } | null;
  seance: {
    id: number;
    titre: string;
    coursCode: string;
    debut: string;
    dureeMinutes: number;
    fournisseur: FournisseurVisio;
    statut: string;
    diapos: number;
    etapes: number;
    /** Somme des minutes du plan (étapes minutées). */
    minutesPlan: number;
    /** Toutes les étapes ont une durée. */
    planMinute: boolean;
  } | null;
};

/** POST /api/seances/direct-immediat */
export type DemandeDirectImmediat = { coursId: number; dureeMinutes: number; prevenir: boolean; titre?: string };

/** Minutes-participant Daily d'un mois (GET /api/visio/usage?mois=AAAA-MM). */
export type UsageVisioDto = {
  mois: string;
  /** L'API Daily a répondu (sinon : état vide honnête, avec la raison). */
  disponible: boolean;
  raison: string | null;
  minutes: number;
  reunions: number;
  /** Minutes par profil de participant (formateurs, salles, étudiants, équipe, autres). */
  parProfil: { profil: "formateur" | "salle" | "etudiant" | "equipe" | "inconnu"; minutes: number; personnes: number }[];
  /** Minutes par salle Daily, de la plus coûteuse à la moins coûteuse. */
  parSalle: { salle: string; libelle: string; minutes: number; reunions: number }[];
  /** Estimation du coût (prix public, minutes offertes du compte déduites). */
  cout: { usd: number; fcfa: number; minutesFacturables: number; prixMinuteUsd: number; minutesOffertes: number; tauxFcfa: number };
  /** Minutes des autres salles du même compte Daily (non comptées ci-dessus). */
  minutesAutresSalles: number;
  lu: string;
};

/** GET /api/visio/reglages et PUT (direction). */
export type ReglagesVisioDto = {
  fournisseurParDefaut: FournisseurVisio;
  videoEtudiantParDefaut: boolean;
  placesDailyEtudiants: number;
  /** Étudiants en vidéo au plus que le forfait Daily permet (salle entière plafonnée, places réservées déduites). */
  placesDailyMax: number;
  /** Places gardées dans chaque salle pour le formateur, les cinq écrans de salle et l'équipe. */
  placesHorsEtudiants: number;
  prixMinuteUsd: number;
  minutesOffertes: number;
  tauxFcfa: number;
  fournisseurs: FournisseurVisio[];
  daily: boolean;
  majLe: string | null;
};

// ── Fuseaux horaires des formateurs ────────────────────────────────────────

/** Fuseaux proposés en premier (formateurs du Canada, d'Europe et d'Afrique de l'Ouest). */
export const FUSEAUX_UTILES: { fuseau: string; ville: string; pays: string }[] = [
  { fuseau: "Africa/Abidjan", ville: "Abidjan", pays: "Côte d'Ivoire" },
  { fuseau: "America/Toronto", ville: "Toronto", pays: "Canada, Ontario" },
  { fuseau: "America/Montreal", ville: "Montréal", pays: "Canada, Québec" },
  { fuseau: "America/Vancouver", ville: "Vancouver", pays: "Canada, Colombie-Britannique" },
  { fuseau: "America/New_York", ville: "New York", pays: "États-Unis" },
  { fuseau: "Europe/Paris", ville: "Paris", pays: "France" },
  { fuseau: "Europe/Brussels", ville: "Bruxelles", pays: "Belgique" },
  { fuseau: "Europe/Zurich", ville: "Genève", pays: "Suisse" },
  { fuseau: "Europe/Berlin", ville: "Berlin", pays: "Allemagne" },
  { fuseau: "Europe/London", ville: "Londres", pays: "Royaume-Uni" },
  { fuseau: "Africa/Dakar", ville: "Dakar", pays: "Sénégal" },
  { fuseau: "Africa/Lagos", ville: "Lagos", pays: "Nigeria, Cameroun, Gabon" },
  { fuseau: "Africa/Casablanca", ville: "Casablanca", pays: "Maroc" },
  { fuseau: "Asia/Dubai", ville: "Dubaï", pays: "Émirats arabes unis" },
];

const VILLES_TRADUITES: Record<string, string> = {
  Montreal: "Montréal",
  Quebec: "Québec",
  New_York: "New York",
  Brussels: "Bruxelles",
  London: "Londres",
  Zurich: "Zurich",
  Geneva: "Genève",
  Vienna: "Vienne",
  Rome: "Rome",
  Lisbon: "Lisbonne",
  Madrid: "Madrid",
  Algiers: "Alger",
  Tunis: "Tunis",
  Dubai: "Dubaï",
  Moscow: "Moscou",
  Beijing: "Pékin",
  Shanghai: "Shanghai",
};

/** « America/Toronto » → « Toronto », « America/Montreal » → « Montréal ». */
export function villeDuFuseau(fuseau: string): string {
  const connu = FUSEAUX_UTILES.find((f) => f.fuseau === fuseau);
  if (connu) return connu.ville;
  const fin = fuseau.split("/").pop() ?? fuseau;
  return VILLES_TRADUITES[fin] ?? fin.replace(/_/g, " ");
}
