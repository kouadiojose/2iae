// Routes du module live (classe en direct). Motifs précis avant motifs génériques.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PageDirect = lazy(() => import("./PageDirect"));
const PageLive = lazy(() => import("./PageLive"));
const PageSalle = lazy(() => import("./PageSalle"));
const PageEmargement = lazy(() => import("./PageEmargement"));
const PagePreparation = lazy(() => import("./PagePreparation"));
const PageReplay = lazy(() => import("./PageReplay"));

export const routes: DefRoute[] = [
  { chemin: "/direct", page: PageDirect, acces: "connecte" },
  { chemin: "/live/:id", page: PageLive, acces: "connecte", coquille: "plein-ecran" },
  { chemin: "/salle", page: PageSalle, acces: ["salle", "admin", "vie_scolaire"], coquille: "aucune" },
  { chemin: "/emargement/:code", page: PageEmargement, acces: ["etudiant"], coquille: "aucune" },
  { chemin: "/enseigner/seances/nouvelle", page: PagePreparation, acces: ["formateur", "admin", "vie_scolaire"] },
  { chemin: "/enseigner/seances/:id", page: PagePreparation, acces: ["formateur", "admin", "vie_scolaire"] },
  { chemin: "/replays/:id", page: PageReplay, acces: "connecte" },
];
