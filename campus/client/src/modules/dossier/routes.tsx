// Espace « Mon dossier » de l'étudiant : ses pièces, sa scolarité, ses reçus.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  { chemin: "/mon-dossier/recus/:id", page: lazy(() => import("./PageRecuEtudiant")), acces: ["etudiant"], coquille: "aucune" },
  { chemin: "/mon-dossier", page: lazy(() => import("./PageMonDossier")), acces: ["etudiant"] },
];
