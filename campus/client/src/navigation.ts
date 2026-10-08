// Navigation par rôle. Cinq onglets au maximum sur téléphone : un étudiant
// qui n'a jamais utilisé de campus numérique doit tout trouver du pouce.
//
// Simplicité (8 octobre 2026 au soir) : le formateur a, dans cet ordre, Aujourd'hui · Mes séances · Ma classe
// (au centre, l'ancien Studio) · Notes (l'ancien onglet Corrections, même page) · Messages ; le reste dans
// « Plus ». La direction commence par « Le travail du campus », puis « Copies et notes » (/corrections).
import type { LucideIcon } from "lucide-react";
import {
  Home,
  BookOpen,
  Radio,
  ClipboardList,
  MessageCircle,
  CalendarDays,
  GraduationCap,
  Sparkles,
  Layers,
  LayoutDashboard,
  Users,
  CheckSquare,
  Megaphone,
  Globe,
  BarChart3,
  Activity,
  CalendarClock,
  CalendarRange,
  Clapperboard,
  Video,
  Wallet,
  Trophy,
  FolderOpen,
  PlayCircle,
  MonitorPlay,
  Library,
  CalendarCheck,
  ClipboardCheck,
} from "lucide-react";
import type { Droit, Moi, Role } from "@shared/schema";
import { profilPermet } from "@/lib/auth";

export type ElementNav = {
  href: string;
  libelle: string;
  icone: LucideIcon;
  /**
   * Présent dans la barre d'onglets du téléphone. « si-place » : seulement s'il reste une des cinq places
   * (sinon dans « Plus »).
   */
  mobile?: boolean | "si-place";
  /** Libellé de l'onglet du téléphone quand le libellé complet est trop long pour la barre du bas. */
  libelleCourt?: string;
  /** Onglet central mis en avant (le direct). */
  central?: boolean;
  /** Pages dont l'URL commence par ces préfixes activent l'onglet. */
  prefixes?: string[];
  /** Équipe : droit du profil qu'il faut pour voir l'entrée, un seul suffit dans une liste (ext-profils.ts). */
  droit?: Droit | Droit[];
  /** Équipe : entrée montrée seulement aux profils SANS ce droit (la version en lecture d'une page). */
  sansDroit?: Droit;
  /** Réservé à la direction. */
  direction?: boolean;
};

const ETUDIANT: ElementNav[] = [
  { href: "/accueil", libelle: "Aujourd'hui", icone: Home, mobile: true },
  { href: "/cours", libelle: "Cours", icone: BookOpen, mobile: true, prefixes: ["/cours", "/replays"] },
  { href: "/direct", libelle: "Live", icone: Radio, mobile: true, central: true, prefixes: ["/direct", "/live"] },
  { href: "/devoirs", libelle: "Devoirs", icone: ClipboardList, mobile: true, prefixes: ["/devoirs", "/quiz", "/notes"] },
  { href: "/messages", libelle: "Messages", icone: MessageCircle, mobile: true, prefixes: ["/messages"] },
  // « On apprend avec l'IA » : l'assistant reste visible dans l'en-tête.
  { href: "/assistant", libelle: "Assistant IA", icone: Sparkles, prefixes: ["/assistant"] },
  { href: "/reviser", libelle: "Réviser", icone: Layers, prefixes: ["/reviser"] }, // révision du jour (C1), aussi sans réseau
  { href: "/bibliotheque", libelle: "Bibliothèque", icone: Library, prefixes: ["/bibliotheque"] },
  { href: "/emploi-du-temps", libelle: "Emploi du temps", icone: CalendarRange, prefixes: ["/emploi-du-temps"] },
  // Enregistrements et PDF de ses cours, et des cours ouverts à tous.
  { href: "/mediatheque", libelle: "Médiathèque", icone: MonitorPlay, prefixes: ["/mediatheque"] },
  { href: "/agenda", libelle: "Agenda", icone: CalendarDays },
  { href: "/notes", libelle: "Notes", icone: GraduationCap },
  { href: "/annonces", libelle: "Annonces", icone: Megaphone, prefixes: ["/annonces"] },
  { href: "/mon-dossier", libelle: "Mon dossier", icone: FolderOpen, prefixes: ["/mon-dossier"] },
  { href: "/progression", libelle: "Ma progression", icone: Trophy, prefixes: ["/progression", "/coupe"] },
];

const FORMATEUR: ElementNav[] = [
  { href: "/enseigner", libelle: "Aujourd'hui", icone: Home, mobile: true },
  // Le fil de ses séances tenues : vidéo, cours résumé, QCM, exercice, présents.
  { href: "/mes-seances", libelle: "Mes séances", icone: CalendarCheck, mobile: true, prefixes: ["/mes-seances"] },
  // L'ancien « Studio » : à 45 minutes du cours et pendant le direct, l'onglet ouvre directement la classe (coquille).
  { href: "/direct", libelle: "Ma classe", icone: Radio, mobile: true, central: true, prefixes: ["/direct", "/live", "/enseigner/seances"] },
  {
    href: "/corrections",
    libelle: "Notes",
    icone: GraduationCap,
    mobile: true,
    // Correction rapide, corrigés du jour, copies à revoir, devoirs de l'IA et carnets : tout ce qui touche aux copies et aux notes.
    prefixes: ["/corrections", "/enseigner/devoirs", "/enseigner/notes", "/devoirs", "/corriger", "/enseigner/corriges", "/enseigner/a-revoir", "/enseigner/relire"],
  },
  { href: "/messages", libelle: "Messages", icone: MessageCircle, mobile: true, prefixes: ["/messages"] },
  { href: "/cours", libelle: "Mes cours", icone: BookOpen, prefixes: ["/cours", "/enseigner/cours"] },
  // Les replays de tous les cours, les siens et ceux des collègues.
  { href: "/replays", libelle: "Vidéos des cours", icone: PlayCircle, prefixes: ["/replays"] },
  { href: "/mediatheque", libelle: "Médiathèque", icone: MonitorPlay, prefixes: ["/mediatheque"] },
  { href: "/assistant", libelle: "Assistant IA", icone: Sparkles, prefixes: ["/assistant"] },
  { href: "/bibliotheque", libelle: "Bibliothèque", icone: Library, prefixes: ["/bibliotheque"] },
  { href: "/emploi-du-temps", libelle: "Emploi du temps", icone: CalendarRange, prefixes: ["/emploi-du-temps"] },
  { href: "/agenda", libelle: "Agenda", icone: CalendarDays },
  { href: "/annonces", libelle: "Annonces", icone: Megaphone, prefixes: ["/annonces"] },
];

// Chaque entrée de l'équipe porte le droit du profil qu'elle demande
// (shared/schema/ext-profils.ts) : un profil ne voit que ce qu'il peut utiliser.
const EQUIPE: ElementNav[] = [
  // La première entrée : tout le travail fait (séances, cours résumés, QCM, exercices, notes), en grand.
  {
    href: "/pilotage/travail",
    libelle: "Le travail du campus",
    libelleCourt: "Le travail",
    icone: ClipboardCheck,
    mobile: true,
    prefixes: ["/pilotage/travail"],
    droit: ["notes", "presences_voir"],
  },
  { href: "/pilotage", libelle: "Pilotage", icone: LayoutDashboard, mobile: true },
  // Tous les devoirs, les copies, les notes à publier et les carnets de notes (page existante /corrections).
  {
    href: "/corrections",
    libelle: "Copies et notes",
    icone: CheckSquare,
    prefixes: ["/corrections", "/enseigner/devoirs", "/enseigner/notes", "/corriger", "/enseigner/corriges", "/enseigner/a-revoir", "/enseigner/relire"],
    droit: "notes",
  },
  {
    href: "/pilotage/etudiants",
    libelle: "Étudiants",
    icone: GraduationCap,
    mobile: true,
    prefixes: ["/pilotage/etudiants", "/pilotage/preinscrits", "/pilotage/relances"],
    droit: "comptes_voir",
  },
  { href: "/pilotage/scolarite", libelle: "Scolarité", icone: Wallet, prefixes: ["/pilotage/scolarite", "/pilotage/recus"], droit: "argent" },
  { href: "/pilotage/comptes", libelle: "Comptes", icone: Users, prefixes: ["/pilotage/comptes", "/pilotage/fiches", "/pilotage/classes"], droit: "comptes_voir" },
  { href: "/pilotage/programme", libelle: "Emploi du temps", icone: CalendarRange, mobile: true, prefixes: ["/pilotage/programme"], droit: "programme" },
  // Sans le droit « programme » : l'emploi du temps en lecture.
  { href: "/emploi-du-temps", libelle: "Emploi du temps", icone: CalendarRange, mobile: true, prefixes: ["/emploi-du-temps"], sansDroit: "programme" },
  { href: "/pilotage/planning", libelle: "Planning", icone: CalendarClock, prefixes: ["/pilotage/planning", "/pilotage/cours"] },
  { href: "/pilotage/presences", libelle: "Présences", icone: BarChart3, prefixes: ["/pilotage/presences", "/pilotage/suivi"], droit: "presences_voir" },
  { href: "/pilotage/engagement", libelle: "Engagement", icone: Activity, prefixes: ["/pilotage/engagement"], droit: "presences_voir" },
  // Dans la barre du bas s'il reste une place (sinon dans « Plus ») : « Le travail du campus » passe avant.
  { href: "/pilotage/annonces", libelle: "Annonces", icone: Megaphone, mobile: "si-place", droit: "annonces" },
  { href: "/coupe", libelle: "Coupe", icone: Trophy, prefixes: ["/coupe"] },
  { href: "/pilotage/site", libelle: "Site public", icone: Globe, prefixes: ["/pilotage/site"], droit: "outils_campus" },
  { href: "/pilotage/formateurs", libelle: "Présentations", icone: Clapperboard, prefixes: ["/pilotage/formateurs"], direction: true },
  { href: "/pilotage/visio", libelle: "Visio", icone: Video, prefixes: ["/pilotage/visio", "/visio"], droit: "outils_campus" },
  { href: "/messages", libelle: "Messages", icone: MessageCircle, mobile: true, prefixes: ["/messages"] },
  { href: "/mediatheque", libelle: "Médiathèque", icone: MonitorPlay, prefixes: ["/mediatheque"] },
  { href: "/direct", libelle: "Live", icone: Radio, prefixes: ["/direct", "/live"], droit: ["programme", "presences", "presences_voir"] },
  { href: "/bibliotheque", libelle: "Bibliothèque", icone: Library, prefixes: ["/bibliotheque"] },
];

/** L'entrée est-elle pour cette personne de l'équipe (direction, ou profil de la vie scolaire) ? */
export function entreeVisible(el: Pick<ElementNav, "droit" | "sansDroit" | "direction">, moi: Pick<Moi, "role" | "profil">): boolean {
  if (el.direction) return moi.role === "admin";
  if (el.sansDroit) return moi.role === "vie_scolaire" && !profilPermet(moi, el.sansDroit);
  return profilPermet(moi, el.droit);
}

export function navigationDe(moi: Pick<Moi, "role" | "profil">): ElementNav[] {
  const role: Role = moi.role;
  switch (role) {
    case "formateur":
      return FORMATEUR;
    case "admin":
    case "vie_scolaire":
      return EQUIPE.filter((el) => entreeVisible(el, moi));
    case "salle":
      return [];
    default:
      return ETUDIANT;
  }
}

/** Places de la barre d'onglets du téléphone. */
export const ONGLETS_TELEPHONE = 5;

/**
 * Barre du bas du téléphone (cinq onglets au plus, « si-place » seulement s'il en reste) et menu « Plus »
 * (tout le reste, dans l'ordre de la navigation).
 */
export function ongletsTelephone(nav: ElementNav[]): { onglets: ElementNav[]; plus: ElementNav[] } {
  const places = Math.max(0, ONGLETS_TELEPHONE - nav.filter((el) => el.mobile === true).length);
  const siPlace = new Set(nav.filter((el) => el.mobile === "si-place").slice(0, places));
  const onglets = nav.filter((el) => el.mobile === true || siPlace.has(el)).slice(0, ONGLETS_TELEPHONE);
  return { onglets, plus: nav.filter((el) => !onglets.includes(el)) };
}

export function estActif(el: ElementNav, chemin: string): boolean {
  if (chemin === el.href) return true;
  const prefixes = el.prefixes ?? [];
  return prefixes.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}
