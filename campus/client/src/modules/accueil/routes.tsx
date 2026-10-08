// Routes du module accueil : « Aujourd'hui » de l'étudiant et du formateur, et « Mes séances » du formateur.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PageAccueil = lazy(() => import("./PageAccueil"));
const PageEnseigner = lazy(() => import("./PageEnseigner"));
const PageMesSeances = lazy(() => import("./PageMesSeances"));

export const routes: DefRoute[] = [
  { chemin: "/accueil", page: PageAccueil, acces: ["etudiant"] },
  // Motif exact : /enseigner/cours/:id, /enseigner/seances/:id… appartiennent à d'autres modules.
  { chemin: "/enseigner", page: PageEnseigner, acces: ["formateur"] },
  // Le fil des séances tenues du formateur ; la direction a le sien, « Le travail du campus » (/pilotage/travail).
  { chemin: "/mes-seances", page: PageMesSeances, acces: ["formateur"] },
];
