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
} from "lucide-react";
import type { Role } from "@shared/schema";

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
};

const ETUDIANT: ElementNav[] = [
  { href: "/accueil", libelle: "Aujourd'hui", icone: Home, mobile: true },
  { href: "/cours", libelle: "Cours", icone: BookOpen, mobile: true, prefixes: ["/cours", "/replays"] },
  { href: "/direct", libelle: "Live", icone: Radio, mobile: true, central: true, prefixes: ["/direct", "/live"] },
  { href: "/devoirs", libelle: "Devoirs", icone: ClipboardList, mobile: true, prefixes: ["/devoirs", "/quiz", "/notes"] },
  { href: "/messages", libelle: "Messages", icone: MessageCircle, mobile: true, prefixes: ["/messages"] },
  { href: "/agenda", libelle: "Agenda", icone: CalendarDays },
  { href: "/notes", libelle: "Notes", icone: GraduationCap },
  { href: "/assistant", libelle: "Assistant IA", icone: Sparkles, prefixes: ["/assistant"] },
];

const FORMATEUR: ElementNav[] = [
  { href: "/enseigner", libelle: "Aujourd'hui", icone: Home, mobile: true },
  { href: "/cours", libelle: "Mes cours", icone: BookOpen, mobile: true, prefixes: ["/cours", "/enseigner/cours", "/replays"] },
  { href: "/direct", libelle: "Studio", icone: Radio, mobile: true, central: true, prefixes: ["/direct", "/live", "/enseigner/seances"] },
  { href: "/corrections", libelle: "Corrections", icone: CheckSquare, mobile: true, prefixes: ["/corrections", "/enseigner/devoirs", "/devoirs"] },
  { href: "/messages", libelle: "Messages", icone: MessageCircle, mobile: true, prefixes: ["/messages"] },
  { href: "/agenda", libelle: "Agenda", icone: CalendarDays },
  { href: "/assistant", libelle: "Assistant IA", icone: Sparkles, prefixes: ["/assistant"] },
];

const EQUIPE: ElementNav[] = [
  { href: "/pilotage", libelle: "Pilotage", icone: LayoutDashboard, mobile: true },
  { href: "/pilotage/comptes", libelle: "Comptes", icone: Users, mobile: true, prefixes: ["/pilotage/comptes", "/pilotage/fiches", "/pilotage/etudiants", "/pilotage/classes"] },
  { href: "/pilotage/planning", libelle: "Planning", icone: CalendarClock, mobile: true, prefixes: ["/pilotage/planning", "/pilotage/cours"] },
  { href: "/pilotage/presences", libelle: "Présences", icone: BarChart3, prefixes: ["/pilotage/presences", "/pilotage/suivi"] },
  { href: "/pilotage/annonces", libelle: "Annonces", icone: Megaphone, mobile: true },
  { href: "/pilotage/site", libelle: "Site 2iae.com", icone: Globe },
  { href: "/messages", libelle: "Messages", icone: MessageCircle, mobile: true, prefixes: ["/messages"] },
  { href: "/direct", libelle: "Live", icone: Radio, prefixes: ["/direct", "/live"] },
];

export function navigationDuRole(role: Role): ElementNav[] {
  switch (role) {
    case "formateur":
      return FORMATEUR;
    case "admin":
    case "vie_scolaire":
      return EQUIPE;
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
