// Routes du module évaluations : devoirs, interrogations, notes (étudiants),
// corrections, éditeur et carnet de notes (formateurs, équipe).
// Motifs précis avant motifs génériques.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const ENSEIGNANTS = ["formateur", "admin", "vie_scolaire"] as const;
const LECTEURS = ["etudiant", "formateur", "admin", "vie_scolaire"] as const;

export const routes: DefRoute[] = [
  { chemin: "/devoirs/:id", page: lazy(() => import("./PageDevoir")), acces: [...LECTEURS] },
  { chemin: "/devoirs", page: lazy(() => import("./PageDevoirs")), acces: [...LECTEURS] },
  // L'interrogation se passe sur un écran nu : pas d'onglets, pas d'assistant, on se concentre.
  { chemin: "/quiz/:id", page: lazy(() => import("./PageQuiz")), acces: [...LECTEURS], coquille: "aucune" },
  { chemin: "/notes", page: lazy(() => import("./PageNotes")), acces: ["etudiant"] },
  { chemin: "/corrections", page: lazy(() => import("./PageCorrections")), acces: [...ENSEIGNANTS] },
  { chemin: "/enseigner/devoirs/nouveau", page: lazy(() => import("./PageEditeurDevoir")), acces: [...ENSEIGNANTS] },
  { chemin: "/enseigner/devoirs/:id/copies", page: lazy(() => import("./PageCopies")), acces: [...ENSEIGNANTS] },
  { chemin: "/enseigner/devoirs/:id", page: lazy(() => import("./PageEditeurDevoir")), acces: [...ENSEIGNANTS] },
  { chemin: "/enseigner/notes/:coursId", page: lazy(() => import("./PageCarnet")), acces: [...ENSEIGNANTS] },
];
