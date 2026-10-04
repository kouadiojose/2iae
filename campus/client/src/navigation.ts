// Navigation par rôle. Cinq onglets au maximum sur téléphone : un étudiant
// qui n'a jamais utilisé de campus numérique doit tout trouver du pouce.
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
  LayoutDashboard,
  Users,
  CheckSquare,
  Megaphone,
  Globe,
  BarChart3,
  CalendarClock,
  CalendarRange,
  Clapperboard,
  Video,
  Wallet,
  FolderOpen,
  PlayCircle,
  Library,
} from "lucide-react";
import type { Droit, Moi, Role } from "@shared/schema";
import { profilPermet } from "@/lib/auth";

export type ElementNav = {
  href: string;
  libelle: string;
  icone: LucideIcon;
  /** Présent dans la barre d'onglets du téléphone. */
  mobile?: boolean;
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
  { href: "/bibliotheque", libelle: "Bibliothèque", icone: Library, prefixes: ["/bibliotheque"] },
  { href: "/emploi-du-temps", libelle: "Emploi du temps", icone: CalendarRange, prefixes: ["/emploi-du-temps"] },
  { href: "/agenda", libelle: "Agenda", icone: CalendarDays },
  { href: "/notes", libelle: "Notes", icone: GraduationCap },
  { href: "/annonces", libelle: "Annonces", icone: Megaphone, prefixes: ["/annonces"] },
  { href: "/mon-dossier", libelle: "Mon dossier", icone: FolderOpen, prefixes: ["/mon-dossier"] },
];

const FORMATEUR: ElementNav[] = [
  { href: "/enseigner", libelle: "Aujourd'hui", icone: Home, mobile: true },
  { href: "/cours", libelle: "Mes cours", icone: BookOpen, mobile: true, prefixes: ["/cours", "/enseigner/cours"] },
  { href: "/direct", libelle: "Studio", icone: Radio, mobile: true, central: true, prefixes: ["/direct", "/live", "/enseigner/seances"] },
  { href: "/corrections", libelle: "Corrections", icone: CheckSquare, mobile: true, prefixes: ["/corrections", "/enseigner/devoirs", "/devoirs"] },
  { href: "/messages", libelle: "Messages", icone: MessageCircle, mobile: true, prefixes: ["/messages"] },
  // Les replays de tous les cours, les siens et ceux des collègues.
  { href: "/replays", libelle: "Enregistrements", icone: PlayCircle, prefixes: ["/replays"] },
  { href: "/assistant", libelle: "Assistant IA", icone: Sparkles, prefixes: ["/assistant"] },
  { href: "/bibliotheque", libelle: "Bibliothèque", icone: Library, prefixes: ["/bibliotheque"] },
  { href: "/emploi-du-temps", libelle: "Emploi du temps", icone: CalendarRange, prefixes: ["/emploi-du-temps"] },
  { href: "/agenda", libelle: "Agenda", icone: CalendarDays },
  { href: "/annonces", libelle: "Annonces", icone: Megaphone, prefixes: ["/annonces"] },
];

// Chaque entrée de l'équipe porte le droit du profil qu'elle demande
// (shared/schema/ext-profils.ts) : un profil ne voit que ce qu'il peut utiliser.
const EQUIPE: ElementNav[] = [
  { href: "/pilotage", libelle: "Pilotage", icone: LayoutDashboard, mobile: true },
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
  { href: "/pilotage/annonces", libelle: "Annonces", icone: Megaphone, mobile: true, droit: "annonces" },
  { href: "/pilotage/site", libelle: "Site public", icone: Globe, prefixes: ["/pilotage/site"], droit: "outils_campus" },
  { href: "/pilotage/formateurs", libelle: "Présentations", icone: Clapperboard, prefixes: ["/pilotage/formateurs"], direction: true },
  { href: "/pilotage/visio", libelle: "Visio", icone: Video, prefixes: ["/pilotage/visio", "/visio"], droit: "outils_campus" },
  { href: "/messages", libelle: "Messages", icone: MessageCircle, mobile: true, prefixes: ["/messages"] },
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

export function estActif(el: ElementNav, chemin: string): boolean {
  if (chemin === el.href) return true;
  const prefixes = el.prefixes ?? [];
  return prefixes.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}
