// Routes du module accueil : « Aujourd'hui » de l'étudiant et du formateur.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PageAccueil = lazy(() => import("./PageAccueil"));
const PageEnseigner = lazy(() => import("./PageEnseigner"));

export const routes: DefRoute[] = [
  { chemin: "/accueil", page: PageAccueil, acces: ["etudiant"] },
  // Motif exact : /enseigner/cours/:id, /enseigner/seances/:id… appartiennent à d'autres modules.
  { chemin: "/enseigner", page: PageEnseigner, acces: ["formateur"] },
];
