// Module « vitrine » : contrats des pages publiques du campus et des rappels
// sur le téléphone (Web Push). Aucune table nouvelle : la vitrine lit les
// cases « Annoncer sur 2iae.com » (publierSurSite) des tables existantes et
// les abonnements push vivent dans abonnementsPush (echanges.ts).
//
// Règle d'or de la vitrine : rien de nominatif sur les étudiants, seulement
// des agrégats ; un formateur n'apparaît qu'avec son consentement.
import type { VitrineCours, VitrineFormateur, VitrineLive } from "../api";

/** GET /api/public/sites — les cinq campus et leur salle de conférence. */
export type SitePublic = {
  slug: string;
  nom: string;
  nomCourt: string;
  ville: string;
  salle: string;
  /** Nombre d'étudiants actifs rattachés au campus (agrégat, jamais de nom). */
  etudiants: number;
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
