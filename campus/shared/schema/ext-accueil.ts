// Module « accueil » : accueil « Aujourd'hui », agenda, annonces et
// notifications. Tables de la politique push (plafond quotidien, heures
// calmes) et des relances d'annonces, puis contrats d'API du module.
import { serial, integer, text, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import { annonces, notifications, type Cible } from "./echanges";

/**
 * Compteur de notifications envoyées sur le téléphone, par personne et par
 * jour (heure d'Abidjan) : au plus 3 par jour hors rappels de live.
 */
export const compteursPush = campusSchema.table(
  "compteurs_push",
  {
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    /** Jour à Abidjan, « 2026-09-24 ». */
    jour: text("jour").notNull(),
    nombre: integer("nombre").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.jour] })],
);

/**
 * Notifications arrivées pendant les heures calmes (21 h – 6 h) : rien ne
 * sonne la nuit ; un seul rappel groupé part le matin pour celles qui sont
 * restées non lues.
 */
export const pushDifferes = campusSchema.table(
  "push_differes",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    notificationId: integer("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_differes_utilisateur_idx").on(t.utilisateurId)],
);

/** Relances d'une annonce vers ceux qui ne l'ont pas encore lue (une par heure au plus). */
export const relancesAnnonces = campusSchema.table(
  "relances_annonces",
  {
    id: serial("id").primaryKey(),
    annonceId: integer("annonce_id").notNull().references(() => annonces.id, { onDelete: "cascade" }),
    auteurId: integer("auteur_id").notNull().references(() => utilisateurs.id),
    destinataires: integer("destinataires").notNull().default(0),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("relances_annonce_idx").on(t.annonceId)],
);

// ── Contrats d'API du module (dates en chaînes ISO) ────────────────────────

/**
 * Nature d'un élément « à faire » de l'accueil étudiant :
 * live (en direct maintenant) · live_bientot (dans moins de 2 h) · live_prevu (plus tard) ·
 * devoir_urgent (dû sous 24 h) · message (d'un formateur, non lu) · devoir_retard (encore accepté) ·
 * devoir (à venir) · a_jour (rien à faire).
 */
export type TypeAFaire = "live" | "live_bientot" | "live_prevu" | "devoir_urgent" | "message" | "devoir_retard" | "devoir" | "a_jour";

/** haute : maintenant · moyenne : aujourd'hui · basse : plus tard · aucune : tout est fait. */
export type Urgence = "haute" | "moyenne" | "basse" | "aucune";

export type ElementAFaire = {
  type: TypeAFaire;
  titre: string;
  detail: string;
  lien: string;
  bouton: string;
  urgence: Urgence;
  /** Heure de référence (début du live, date limite, message) pour un compte à rebours ou une pastille. */
  quand?: string;
  coursCode?: string;
  couleur?: string;
};

export type CoursAccueil = {
  id: number;
  code: string;
  titre: string;
  couleur: string;
  /** Leçons terminées / leçons publiées, en %. */
  progression: number;
  leconsTerminees: number;
  leconsTotal: number;
  formateur: string | null;
  prochaineSeance: { id: number; titre: string; debut: string; statut: string } | null;
};

export type AnnonceResume = {
  id: number;
  titre: string;
  extrait: string;
  importante: boolean;
  epinglee: boolean;
  lue: boolean;
  publieeLe: string;
  auteur: string;
};

/** GET /api/accueil — accueil « Aujourd'hui » de l'étudiant. */
export type AccueilEtudiant = {
  salutation: string;
  prenom: string;
  /** « Campus Yopougon · BTS Gestion commerciale · 1re année » */
  contexte: string;
  aFaire: ElementAFaire;
  /** Trois lignes au plus, après la carte principale. */
  prochains: ElementAFaire[];
  cours: CoursAccueil[];
  annonceImportante: AnnonceResume | null;
  /** Annonces en ligne qui me concernent et que je n'ai pas encore ouvertes. */
  annoncesNonLues: number;
  semaine: { numero: number; lives: number; devoirs: number };
};

export type SeanceFormateur = {
  id: number;
  titre: string;
  coursId: number;
  coursCode: string;
  coursTitre: string;
  debut: string;
  dureeMinutes: number;
  statut: string;
  lienStudio: string;
  lienPreparation: string;
  lienAgenda: string;
  preparation: { plan: number; diapos: number; description: boolean };
};

export type CopiesDevoir = {
  devoirId: number;
  titre: string;
  coursCode: string;
  nombre: number;
  enRetard: number;
  plusAncienne: string | null;
  lien: string;
};

export type QuestionEnSuspens = { id: number; texte: string; votes: number; site: string | null };

export type CoursFormateur = {
  id: number;
  code: string;
  titre: string;
  couleur: string;
  statut: string;
  etudiants: number;
  campus: number;
  prochaineSeance: { id: number; debut: string; statut: string } | null;
};

/** GET /api/accueil/formateur */
export type AccueilFormateur = {
  salutation: string;
  prenom: string;
  localisation: string | null;
  enDirect: SeanceFormateur | null;
  prochaineSeance: SeanceFormateur | null;
  copies: CopiesDevoir[];
  totalCopies: number;
  questions: {
    seanceId: number;
    seanceTitre: string;
    coursCode: string;
    termineeLe: string | null;
    lien: string;
    liste: QuestionEnSuspens[];
    total: number;
  } | null;
  cours: CoursFormateur[];
  messagesNonLus: number;
  annoncesNonLues: number;
  semaine: ElementAgenda[];
};

// ── Annonces ───────────────────────────────────────────────────────────────

export type AnnonceDto = {
  id: number;
  titre: string;
  corps: string;
  cible: Cible;
  /** « Tout le campus », « Campus Yopougon », « IA-101 · Initiation à l'IA »… */
  cibleLibelle: string;
  siteId: number | null;
  classeId: number | null;
  coursId: number | null;
  importante: boolean;
  epinglee: boolean;
  proposeSurSite: boolean;
  publierSurSite: boolean;
  publieeLe: string;
  expireLe: string | null;
  auteur: { id: number; prenom: string; nom: string; role: string; photoUrl: string | null };
  lue: boolean;
  /** La personne peut modifier, supprimer, voir les lectures et relancer. */
  gerable: boolean;
};

/** Ligne de la liste de gestion (pilotage, « Mes annonces » du formateur). */
export type AnnonceGestion = AnnonceDto & {
  lus: number;
  total: number;
  expiree: boolean;
  derniereRelance: string | null;
};

/** GET /api/annonces/:id/lectures */
export type LecturesAnnonce = {
  lus: number;
  total: number;
  nonLus: string[];
  parSite: { site: string; lus: number; total: number }[];
  derniereRelance: string | null;
};

/** GET /api/annonces/cibles — ce que la personne a le droit de viser. */
export type CiblesAnnonce = {
  tous: boolean;
  sites: { id: number; nom: string }[];
  classes: { id: number; nom: string; siteId: number }[];
  cours: { id: number; code: string; titre: string }[];
  /** Direction : publie directement sur 2iae.com ; les autres proposent. */
  publieSurSite: boolean;
};

/** GET /api/annonces/destinataires */
export type DestinatairesAnnonce = { etudiants: number; personnel: number; total: number };

// ── Agenda ─────────────────────────────────────────────────────────────────

export type TypeElementAgenda = "live" | "devoir" | "evenement";

export type ElementAgenda = {
  /** « seance-12 », « devoir-4 », « evenement-7 » : stable d'une semaine à l'autre. */
  cle: string;
  id: number;
  type: TypeElementAgenda;
  titre: string;
  debut: string;
  fin: string | null;
  coursId: number | null;
  coursCode: string | null;
  couleur: string | null;
  lieu: string | null;
  lien: string | null;
  description: string;
  /** Séance : planifiee, en_direct, terminee, annulee · devoir : a_rendre, rendu, en_retard, corrige. */
  statut: string | null;
  motifAnnulation: string | null;
  /** Événement : cible et possibilité de le modifier. */
  cible: Cible | null;
  siteId: number | null;
  classeId: number | null;
  modifiable: boolean;
};

/** GET /api/agenda */
export type Agenda = { debut: string; fin: string; elements: ElementAgenda[]; peutAjouter: boolean };
