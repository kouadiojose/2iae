// Pages du module « showreel » : la présentation publique de 30 secondes,
// « Ma présentation » du formateur et l'éditeur de la direction.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  // Public : consultable connecté ou non (pas de redirection).
  { chemin: "/formateurs/:slug/presentation", page: lazy(() => import("./PagePresentationPublique")), acces: "public", coquille: "aucune" },
  // Le formateur, pour lui-même.
  { chemin: "/profil/presentation", page: lazy(() => import("./PageMaPresentation")), acces: ["formateur"] },
  // La direction, pour chaque formateur.
  { chemin: "/pilotage/formateurs/:id/presentation", page: lazy(() => import("./PagePresentationFormateur")), acces: ["admin"] },
  { chemin: "/pilotage/formateurs", page: lazy(() => import("./PagePresentations")), acces: ["admin"] },
];
