// Routes du module « côté formateur » (chantier C7) : la correction rapide
// sur téléphone et les devoirs écrits par l'IA ; puis la correction
// automatique (8 octobre 2026) : corrigés du jour à valider, copies à revoir
// et relectures demandées. « Après la séance », les cartes de la correction
// et le travail de groupe sont des emplacements (ApresSeance,
// CartesCorrections, TravailDeGroupeDevoir), sans route propre.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const CORRECTEURS = ["formateur", "admin", "vie_scolaire"] as const;

export const routes: DefRoute[] = [
  // Une copie seule à l'écran, sans barre d'onglets : on se concentre (comme l'interrogation).
  { chemin: "/corriger/:id", page: lazy(() => import("./PageCorrigerCopie")), acces: [...CORRECTEURS], droit: "notes", coquille: "aucune" },
  { chemin: "/corriger", page: lazy(() => import("./PageCorriger")), acces: [...CORRECTEURS], droit: "notes" },
  { chemin: "/enseigner/relire", page: lazy(() => import("./QcmARelire")), acces: ["formateur", "admin"] },
  // Lien de la notification et de l'e-mail du matin. La vie scolaire (droit « notes ») consulte sans valider.
  { chemin: "/enseigner/corriges/:devoirId", page: lazy(() => import("./PageCorrige")), acces: [...CORRECTEURS], droit: "notes" },
  { chemin: "/enseigner/corriges", page: lazy(() => import("./PageCorriges")), acces: [...CORRECTEURS], droit: "notes" },
  { chemin: "/enseigner/a-revoir", page: lazy(() => import("./PageARevoir")), acces: [...CORRECTEURS], droit: "notes" },
];
