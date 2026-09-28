// Module « vitrine » : le site public du campus (accueil, cours, formateurs,
// campus, le direct, questions, à propos, contact, confidentialité), ses
// contenus éditables depuis le back-office « Site public », et les rappels
// sur le téléphone (Web Push, abonnements dans abonnementsPush d'echanges.ts).
//
// Règle d'or de la vitrine : rien de nominatif sur les étudiants, seulement
// des agrégats ; un formateur n'apparaît qu'avec son consentement.
//
// Les contenus éditables vivent dans UNE table clé → JSON (contenusSite). Le
// code porte des VALEURS PAR DÉFAUT tirées des faits réels du Groupe 2IAE
// (site 2iae.com, affiches officielles ; voir shared/vitrine-contenus.ts) :
// la production affiche du vrai contenu dès le déploiement, sans aucune
// saisie. Ce que la direction enregistre remplace la valeur par défaut,
// champ par champ.
import { text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import type { VitrineCours, VitrineFormateur, VitrineLive } from "../api";

// ── Table ──────────────────────────────────────────────────────────────────

/**
 * Contenus du site public. Clés : « accueil », « apropos », « questions »,
 * « contacts », « confidentialite », et « campus.<slug> » pour chaque campus
 * (adresse, photo, filières…). La salle de conférence et le WhatsApp de la
 * vie scolaire restent dans la table sites (le reste du campus s'en sert).
 */
export const contenusSite = campusSchema.table("contenus_site", {
  cle: text("cle").primaryKey(),
  valeur: jsonb("valeur").$type<Record<string, unknown>>().notNull(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
  majParId: integer("maj_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
});

// ── Contenus éditables ─────────────────────────────────────────────────────

export type ContenuAccueil = {
  /** Petite ligne au-dessus du titre. */
  etiquette: string;
  /** Une ligne par retour à la ligne ; la dernière s'affiche en orange. */
  titre: string;
  sousTitre: string;
};

export type ChiffreGroupe = { valeur: string; libelle: string };

export type ContenuAPropos = {
  /** Phrase d'ouverture de la page. */
  chapeau: string;
  /** Le Groupe 2IAE (paragraphes séparés par une ligne vide). */
  groupe: string;
  /** Le campus numérique et sa raison d'être (paragraphes séparés par une ligne vide). */
  campusNumerique: string;
  /** Quatre chiffres réels mis en avant. */
  chiffres: ChiffreGroupe[];
};

export const THEMES_QUESTIONS = ["connexion", "suivre", "parents", "inscription"] as const;
export type ThemeQuestion = (typeof THEMES_QUESTIONS)[number];
export const LIBELLES_THEMES: Record<ThemeQuestion, string> = {
  connexion: "Se connecter",
  suivre: "Suivre les cours",
  parents: "Parents",
  inscription: "S'inscrire",
};

export type QuestionFrequente = { id: string; theme: ThemeQuestion; question: string; reponse: string; visible: boolean };
export type ContenuQuestions = { liste: QuestionFrequente[] };

export type ContenuContacts = {
  /** Numéros affichés tels quels (« +225 05 84 24 90 90 »). */
  telephones: string[];
  whatsapp: string;
  email: string;
  facebook: string;
  siteWeb: string;
  preinscription: string;
  bureauCanada: string;
  /** Registre du commerce. */
  rc: string;
  /** Numéro d'agrément du ministère. */
  agrement: string;
};

export type ContenuConfidentialite = {
  responsable: string;
  contact: string;
  /** Durées de conservation (paragraphes séparés par une ligne vide). */
  conservation: string;
  /** « 2026-09-26 » */
  miseAJour: string;
};

export type ContenuCampus = {
  /** Adresse telle que publiée sur 2iae.com. */
  adresse: string;
  /** Quartier, commune, ville (« Riviera Palmeraie, Cocody, Abidjan »). */
  localite: string;
  /** Téléphone propre au campus ; vide : les numéros du groupe. */
  telephone: string;
  /** Photo réelle : /images/… (livrée avec le campus) ou /api/fichiers/:id (téléversée). */
  photoUrl: string | null;
  /** Lien de carte choisi par la direction ; vide : itinéraire construit depuis l'adresse. */
  lienCarte: string;
  /** Codes des filières BTS présentées (voir FILIERES_BTS). */
  filieres: string[];
  /** Résultat officiel le plus récent (« BTS 2026 », 58,4 %) ; null : non publié. */
  resultat: { libelle: string; taux: number } | null;
  /** Quelques phrases sur le campus (facultatif). */
  presentation: string;
};

export type ContenusSite = {
  accueil: ContenuAccueil;
  apropos: ContenuAPropos;
  questions: ContenuQuestions;
  contacts: ContenuContacts;
  confidentialite: ContenuConfidentialite;
};
export const CLES_CONTENUS = ["accueil", "apropos", "questions", "contacts", "confidentialite"] as const;
export type CleContenu = (typeof CLES_CONTENUS)[number];

// ── Faits réels : filières ─────────────────────────────────────────────────

export type FiliereBts = { code: string; nom: string; famille: "tertiaire" | "industriel" };

/** Les BTS du Groupe 2IAE (site 2iae.com). */
export const FILIERES_BTS: FiliereBts[] = [
  { code: "FCGE", nom: "Finance Comptabilité & Gestion d'Entreprise", famille: "tertiaire" },
  { code: "GEC", nom: "Gestion Commerciale", famille: "tertiaire" },
  { code: "RHCOM", nom: "Ressources Humaines & Communication", famille: "tertiaire" },
  { code: "LOG", nom: "Logistique", famille: "tertiaire" },
  { code: "SI", nom: "Sciences de l'Information", famille: "industriel" },
  { code: "IDA", nom: "Informatique Développeur d'Applications", famille: "industriel" },
  { code: "GBAT", nom: "Génie civil option Bâtiment", famille: "industriel" },
  { code: "GTP", nom: "Génie civil option Travaux Publics", famille: "industriel" },
  { code: "ATPV", nom: "Agriculture Tropicale option Production Végétale", famille: "industriel" },
  { code: "ATPA", nom: "Agriculture Tropicale option Production Animale", famille: "industriel" },
];

/** Licences professionnelles (3 ans). */
export const LICENCES_PRO = ["Management & Entrepreneuriat", "Marketing Digital & Communication", "Gestion Financière & Contrôle"];

/** Noms de salles inventés pour la démonstration : en réel, on dit « Salle de conférence » tant que la direction n'a pas saisi le vrai nom. */
export const SALLES_INVENTEES = ["Salle Palmeraie", "Salle Kédjénou", "Salle Baoulé", "Salle Agro-pastorale", "Salle Akwaba"];
export const SALLE_PAR_DEFAUT = "Salle de conférence";

// ── Valeurs par défaut ─────────────────────────────────────────────────────
// Les textes par défaut (faits réels) vivent dans shared/vitrine-contenus.ts :
// hors du schéma commun, ils ne pèsent pas sur les pages de l'application.

// ── Contrats d'API publics ─────────────────────────────────────────────────

/** GET /api/public/sites — les cinq campus et leur salle de conférence (lu aussi par 2iae.com). */
export type SitePublic = {
  slug: string;
  nom: string;
  nomCourt: string;
  ville: string;
  /** Nom réel de la salle, ou « Salle de conférence » tant qu'il n'est pas saisi. */
  salle: string;
  /** Nombre d'étudiants actifs rattachés au campus (agrégat, jamais de nom). */
  etudiants: number;
};

/** Un campus sur le site public : faits réels et saisie de la direction. */
export type CampusPublic = {
  /** Identifiant du site (les sessions de l'emploi du temps désignent leurs classes par site). */
  id: number;
  slug: string;
  nom: string;
  nomCourt: string;
  ville: string;
  salle: string;
  /** Vrai quand la direction a saisi le nom réel de la salle. */
  salleNommee: boolean;
  /** Numéro wa.me (chiffres) de la vie scolaire du campus, sinon celui du groupe. */
  whatsapp: string;
  /** Vrai quand le numéro est propre à la vie scolaire du campus (différent de celui du groupe). */
  whatsappCampus: boolean;
  adresse: string;
  localite: string;
  /** Téléphone du campus ; null : ceux du groupe. */
  telephone: string | null;
  photoUrl: string | null;
  /** Lien Google Maps (itinéraire depuis l'adresse, ou lien choisi). */
  itineraire: string;
  filieres: FiliereBts[];
  resultat: { libelle: string; taux: number } | null;
  presentation: string;
  etudiants: number;
};

/** GET /api/public/site — tout le contenu éditable du site public, déjà fusionné avec les valeurs par défaut. */
export type SitePublicDto = {
  accueil: ContenuAccueil;
  apropos: ContenuAPropos;
  /** Questions visibles seulement, dans l'ordre choisi. */
  questions: QuestionFrequente[];
  contacts: ContenuContacts;
  confidentialite: ContenuConfidentialite;
  campus: CampusPublic[];
  majLe: string | null;
};

/** GET /api/public/campus/:slug — un campus, ses cours annoncés et ses prochains lives publics. */
export type CampusDetailPublic = {
  campus: CampusPublic;
  cours: VitrineCours[];
  lives: VitrineLive[];
};

/** GET /api/public/en-direct — le cours public en direct (indicateur de l'en-tête), très léger. */
export type EnDirectPublic = {
  live: { id: number; titre: string; coursTitre: string; coursCode: string } | null;
};

/** Un campus qui suit un cours annoncé. */
export type CampusCours = { slug: string; nomCourt: string; salle: string };

/** GET /api/public/cours/:slug — fiche publique d'un cours annoncé. */
export type FicheCoursPublique = VitrineCours & {
  /** Identifiant interne : le bouton « accéder au cours » mène à /cours/:id (connexion exigée). */
  coursId: number;
  description: string;
  objectifs: string[];
  /** Titres des chapitres seulement (le contenu reste réservé aux étudiants). */
  programme: { titre: string; lecons: number }[];
  campus: CampusCours[];
  /** Lives publics à venir du cours (et celui en cours). */
  lives: VitrineLive[];
};

/** GET /api/public/formateurs/:slug — fiche publique d'un formateur annoncé. */
export type FicheFormateurPublique = VitrineFormateur & {
  /** Cours annoncés de ce formateur, avec leurs détails de carte. */
  coursDetail: VitrineCours[];
  /** Ses lives publics à venir (et celui en cours). */
  lives: VitrineLive[];
};

// ── Contrats du back-office « Site public » ────────────────────────────────

export type CampusPilotage = {
  id: number;
  slug: string;
  nom: string;
  nomCourt: string;
  /** Tel qu'en base (peut être un nom inventé à remplacer). */
  salleConference: string;
  whatsappVieScolaire: string | null;
  contenu: ContenuCampus;
  defaut: ContenuCampus;
  majLe: string | null;
  majPar: string | null;
};

/** GET /api/pilotage/site/contenus */
export type ContenusPilotage = {
  contenus: ContenusSite;
  defauts: ContenusSite;
  campus: CampusPilotage[];
  /** Dernière modification de chaque bloc (absent : valeur par défaut). */
  modifications: Partial<Record<CleContenu, { le: string; par: string | null }>>;
  /** Direction : modifie. Vie scolaire : lecture seule. */
  peutModifier: boolean;
};

// ── Rappels sur le téléphone (Web Push) ────────────────────────────────────

/** GET /api/push/cle — clé publique VAPID ; null quand les rappels ne sont pas configurés. */
export type ClePush = { cle: string | null };

/** POST /api/push/test — ce qui s'est passé pour l'essai. */
export type ResultatEssaiPush = {
  /** Le rappel est parti vers le(s) téléphone(s) abonné(s). */
  envoye: boolean;
  /** Nombre d'appareils abonnés pour ce compte. */
  appareils: number;
  /** Raison quand rien n'est parti tout de suite. */
  raison: "heures_calmes" | "plafond" | "aucun_appareil" | "indisponible" | null;
};
