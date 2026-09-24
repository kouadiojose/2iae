// Pages publiques du campus : accueil, fiches des cours et des formateurs
// annoncés sur 2iae.com. Sans coquille (en-tête et pied de page propres).
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PageAccueilPublique = lazy(() => import("./PageAccueilPublique"));
const PageCoursPublic = lazy(() => import("./PageCoursPublic"));
const PageFormateurPublic = lazy(() => import("./PageFormateurPublic"));

export const routes: DefRoute[] = [
  { chemin: "/cours-ouverts/:slug", page: PageCoursPublic, acces: "public", coquille: "aucune" },
  { chemin: "/formateurs/:slug", page: PageFormateurPublic, acces: "public", coquille: "aucune" },
  { chemin: "/", page: PageAccueilPublique, acces: "public", coquille: "aucune", redirigerSiConnecte: true },
];
