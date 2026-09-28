// Contrats d'API du module « lancement » (rentrée, invitations, écrans de
// salle, première connexion d'un formateur). Aucune table : tout se calcule
// sur les tables existantes. Les dates voyagent en chaînes ISO.
import type { Moi } from "./schema";

// ── Liste de contrôle de la rentrée (GET /api/pilotage/rentree) ────────────

/** fait : prêt · attention : utilisable, mais un point reste à régler · a_faire : bloque la rentrée. */
export type EtatControle = "fait" | "attention" | "a_faire";

/** Ce que propose le bouton d'une ligne : aller sur une page, ou ouvrir une fenêtre sur place. */
export type ActionRentree =
  | { type: "lien"; libelle: string; href: string }
  | { type: "ecran"; libelle: string; siteId: number }
  | { type: "inviter"; libelle: string; compteId: number }
  | { type: "purger"; libelle: string };

export type SousLigneRentree = {
  libelle: string;
  detail: string;
  etat: EtatControle;
  action: ActionRentree | null;
};

export type CleRentree = "campus" | "classes" | "formateurs" | "programme" | "etudiants" | "connexions" | "visio" | "services" | "demo";

export type LigneRentree = {
  cle: CleRentree;
  titre: string;
  etat: EtatControle;
  /** Le chiffre qui résume la ligne : « 3 sur 5 », « 6 séances », « 42 % ». */
  chiffre: string;
  /** Une phrase : ce qui est fait, ce qui manque. */
  resume: string;
  action: ActionRentree | null;
  sousLignes: SousLigneRentree[];
};

export type EtatRentree = {
  /** Premier cours de la session de rentrée (ou le 28 septembre 2026 à 08:30 à défaut d'emploi du temps). */
  cible: { le: string; libelle: string; session: string | null; passee: boolean };
  perimetre: { tout: boolean; site: string | null };
  lignes: LigneRentree[];
  /** Lignes « fait ». */
  prets: number;
  total: number;
  genereLe: string;
};

/** GET /api/pilotage/rentree/demo : ce que la purge supprimerait (simulation, rien n'est touché). */
export type ApercuPurge = {
  inventaire: [string, number][];
  comptes: number;
  /** Les comptes de démonstration qui partiraient, un par un (seuls ceux que le semis a marqués). */
  personnes: { id: number; nom: string; identifiant: string | null; role: string }[];
  avertissements: string[];
};

/** POST /api/pilotage/rentree/demo/purger */
export type ResultatPurge = { comptes: number; tables: Record<string, number>; fichiersDisque: number; avertissements: string[] };

// ── Invitations (formateurs et équipe) ─────────────────────────────────────

/** POST /api/pilotage/comptes/:id/invitation : le lien d'activation, montré dans la fenêtre « Inviter ». */
export type InvitationRemise = {
  compteId: number;
  /** Lien d'activation (usage unique) : https://…/activer/<jeton>. */
  lien: string;
  /** Le jeton du lien, pour demander ensuite l'envoi par e-mail du MÊME lien. */
  jeton: string;
  expireLe: string;
  /** Message prêt à envoyer (WhatsApp, SMS, e-mail personnel). */
  message: string;
  /** Lien wa.me : vers le numéro de la personne s'il est connu, sinon WhatsApp demande à qui l'envoyer. */
  whatsapp: string;
  /** Prochain cours de la personne, s'il est déjà au programme. */
  premierCours: string | null;
  email: { adresse: string | null; disponible: boolean; envoye: boolean };
  /** Une invitation précédente existait : son lien ne marche plus (qu'il ait servi ou non). */
  remplaceUnLien: boolean;
  /** Appareils qui avaient ouvert le lien précédent sans finir l'activation : déconnectés. */
  appareilsDeconnectes: number;
};

/** POST /api/pilotage/comptes/:id/invitation/email */
export type EnvoiInvitation = { envoye: boolean; adresse: string; message: string };

// ── Écran de la salle de conférence ────────────────────────────────────────

/**
 * Le lien et le code d'installation de l'écran de la salle d'un campus :
 * permanents et réutilisables (un ordinateur de salle peut changer), jusqu'à
 * ce que la direction ou la vie scolaire les change.
 * GET /api/pilotage/sites/:id/ecran : ceux en place · POST : de nouveaux (les anciens ne marchent plus).
 */
export type InstallationEcran = {
  siteId: number;
  compteId: number;
  site: string;
  salle: string;
  /** À ouvrir sur l'ordinateur de la salle : https://…/ecran/<jeton>. */
  lien: string;
  /** Ou : ouvrir l'adresse courte et taper ce code de 8 caractères (lettres et chiffres sans ambiguïté). */
  code: string;
  adresseCourte: string;
  /** Depuis quand ce lien et ce code sont en place. */
  depuis: string;
  message: string;
  whatsapp: string;
  /** Le compte de l'écran vient d'être créé. */
  nouveau: boolean;
};

/** GET /api/pilotage/sites/:id/ecran */
export type EtatEcranSalle = {
  /** null : aucun lien en place (jamais préparé, ou illisible après un changement de clé du serveur). */
  installation: InstallationEcran | null;
  /** Dernière connexion d'un ordinateur installé avec ce compte d'écran. */
  derniereConnexion: string | null;
};

/** POST /api/ecran/installer : { jeton } (lien) ou { code } (adresse courte). */
export type ReponseInstallationEcran = Moi;

// ── Première connexion d'un formateur ──────────────────────────────────────

/** POST /api/compte/premiere-connexion : nom vérifié, identifiant choisi, mot de passe. */
export type CorpsPremiereConnexion = {
  prenom: string;
  nom: string;
  /** Adresse e-mail, ou numéro de téléphone au format international (+1 514 555 0123). */
  identifiant: string;
  nouveau: string;
};
