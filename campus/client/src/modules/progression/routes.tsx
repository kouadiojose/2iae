// Routes du module progression (chantier C5) : « Ma progression » pour
// l'étudiant, la Coupe des campus et des classes pour tout compte connecté
// (l'écran d'une salle a sa propre vue, sur /salle).
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  { chemin: "/progression", page: lazy(() => import("./PageProgression")), acces: ["etudiant"] },
  { chemin: "/coupe", page: lazy(() => import("./PageCoupe")), acces: ["etudiant", "formateur", "admin", "vie_scolaire"] },
];
