// Tableau « Engagement et participation » (chantier C8) : direction, et vie
// scolaire dont le profil permet de consulter les présences.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  { chemin: "/pilotage/engagement", page: lazy(() => import("./PageEngagement")), acces: ["admin", "vie_scolaire"], droit: "presences_voir" },
];
