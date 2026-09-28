// Routes du module cours : lecture (étudiants, formateurs, équipe) et
// éditeur (formateurs, équipe). Motifs précis avant motifs génériques.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const LECTEURS = ["etudiant", "formateur", "admin", "vie_scolaire"] as const;
const EDITEURS = ["formateur", "admin", "vie_scolaire"] as const;

export const routes: DefRoute[] = [
  { chemin: "/enseigner/cours/nouveau", page: lazy(() => import("./PageNouveauCours")), acces: [...EDITEURS] },
  { chemin: "/enseigner/cours/:id", page: lazy(() => import("./PageEditeurCours")), acces: [...EDITEURS] },
  { chemin: "/cours/:id/lecons/:leconId", page: lazy(() => import("./PageLecon")), acces: [...LECTEURS] },
  { chemin: "/cours/:id", page: lazy(() => import("./PageCours")), acces: [...LECTEURS] },
  { chemin: "/cours", page: lazy(() => import("./PageMesCours")), acces: [...LECTEURS] },
];
