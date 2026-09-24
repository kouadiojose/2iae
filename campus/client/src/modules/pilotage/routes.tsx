// Pages du pilotage (vie scolaire et direction) et relevé public des parents.
// /pilotage/annonces appartient au module annonces.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const EQUIPE: DefRoute["acces"] = ["admin", "vie_scolaire"];

export const routes: DefRoute[] = [
  // Motifs précis d'abord.
  { chemin: "/pilotage/comptes/import", page: lazy(() => import("./PageImport")), acces: EQUIPE },
  { chemin: "/pilotage/comptes", page: lazy(() => import("./PageComptes")), acces: EQUIPE },
  { chemin: "/pilotage/fiches", page: lazy(() => import("./PageFiches")), acces: EQUIPE, coquille: "aucune" },
  { chemin: "/pilotage/classes", page: lazy(() => import("./PageClasses")), acces: EQUIPE },
  { chemin: "/pilotage/cours", page: lazy(() => import("./PageCours")), acces: EQUIPE },
  { chemin: "/pilotage/planning", page: lazy(() => import("./PagePlanning")), acces: EQUIPE },
  { chemin: "/pilotage/presences", page: lazy(() => import("./PagePresences")), acces: EQUIPE },
  { chemin: "/pilotage/site", page: lazy(() => import("./PageSite")), acces: EQUIPE },
  { chemin: "/pilotage/suivi", page: lazy(() => import("./PageSuivi")), acces: EQUIPE },
  { chemin: "/pilotage/etudiants/:id", page: lazy(() => import("./PageEtudiant")), acces: EQUIPE },
  { chemin: "/pilotage/ia", page: lazy(() => import("./PageIa")), acces: EQUIPE },
  { chemin: "/pilotage", page: lazy(() => import("./PageTableau")), acces: EQUIPE },
  // Public : le lien envoyé aux parents sur WhatsApp.
  { chemin: "/releve/:jeton", page: lazy(() => import("./PageReleve")), acces: "public", coquille: "aucune" },
];
