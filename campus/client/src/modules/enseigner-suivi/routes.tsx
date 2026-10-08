// Routes du module « côté formateur » (chantier C7) : la correction rapide
// sur téléphone et la relecture facultative des devoirs écrits par l'IA.
// « Après la séance » et le travail de groupe sont des emplacements (ApresSeance,
// TravailDeGroupeDevoir), sans route propre.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const CORRECTEURS = ["formateur", "admin", "vie_scolaire"] as const;

export const routes: DefRoute[] = [
  // Une copie seule à l'écran, sans barre d'onglets : on se concentre (comme l'interrogation).
  { chemin: "/corriger/:id", page: lazy(() => import("./PageCorrigerCopie")), acces: [...CORRECTEURS], droit: "notes", coquille: "aucune" },
  { chemin: "/corriger", page: lazy(() => import("./PageCorriger")), acces: [...CORRECTEURS], droit: "notes" },
  { chemin: "/enseigner/relire", page: lazy(() => import("./QcmARelire")), acces: ["formateur", "admin"] },
];
