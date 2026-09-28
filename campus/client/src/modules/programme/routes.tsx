// Pages du module « programme » (emploi du temps) : back-office, espace
// étudiant et formateur, pages publiques et fiches imprimables.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const EQUIPE: DefRoute["acces"] = ["admin", "vie_scolaire"];
const PageProgrammePublic = lazy(() => import("./PageProgrammePublic"));

export const routes: DefRoute[] = [
  // Back-office (motifs précis d'abord).
  { chemin: "/pilotage/programme/:id/imprimer", page: lazy(() => import("./PageImprimerPilotage")), acces: EQUIPE, coquille: "aucune" },
  { chemin: "/pilotage/programme/:id", page: lazy(() => import("./PageEditeur")), acces: EQUIPE },
  { chemin: "/pilotage/programme", page: lazy(() => import("./PageSessions")), acces: EQUIPE },
  // Espace connecté.
  { chemin: "/emploi-du-temps", page: lazy(() => import("./PageEmploiDuTemps")), acces: ["etudiant", "formateur", "admin", "vie_scolaire"] },
  // Public : consultable connecté ou non (pas de redirection).
  { chemin: "/programme/:id/imprimer", page: lazy(() => import("./PageImprimerPublic")), acces: "public", coquille: "aucune" },
  { chemin: "/programme/:id", page: PageProgrammePublic, acces: "public", coquille: "aucune" },
  { chemin: "/programme", page: PageProgrammePublic, acces: "public", coquille: "aucune" },
];
