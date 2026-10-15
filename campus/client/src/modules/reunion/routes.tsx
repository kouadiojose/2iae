// Salle de réunion de l'administration (server/routes/reunions.ts, shared/reunion.ts).
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  // Le lien, les boutons pour le partager, l'interrupteur « Réunion ouverte » : direction, et équipe des écrans et de la visio.
  { chemin: "/pilotage/reunion", page: lazy(() => import("./PageSalleReunion")), acces: ["admin", "vie_scolaire"], droit: "outils_campus" },
  // Le lien à partager : sans compte, à tout moment, tant que la réunion est ouverte.
  { chemin: "/reunion/:jeton", page: lazy(() => import("./PageReunion")), acces: "public", coquille: "aucune" },
];
