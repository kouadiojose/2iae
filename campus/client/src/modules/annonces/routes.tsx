// Routes du module annonces. Motifs précis avant motifs génériques :
// /pilotage/annonces doit passer avant toute route générique du pilotage.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PagePilotageAnnonces = lazy(() => import("./PagePilotageAnnonces"));
const PageAnnonce = lazy(() => import("./PageAnnonce"));
const PageAnnonces = lazy(() => import("./PageAnnonces"));

const LECTEURS: DefRoute["acces"] = ["etudiant", "formateur", "vie_scolaire", "admin"];

export const routes: DefRoute[] = [
  { chemin: "/pilotage/annonces", page: PagePilotageAnnonces, acces: ["admin", "vie_scolaire"] },
  { chemin: "/annonces/:id", page: PageAnnonce, acces: LECTEURS },
  { chemin: "/annonces", page: PageAnnonces, acces: LECTEURS },
];
