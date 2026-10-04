import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

// Pages du module visio. Les composants de la classe en direct (scène,
// radio, test du micro, cadre Daily) sont intégrés par le module live via ./index.ts.
export const routes: DefRoute[] = [
  { chemin: "/visio/essai", page: lazy(() => import("./PageEssai")), acces: "connecte" },
  // Répétition dans la vraie salle Daily d'une séance (formateur, direction ; salles 90 min avant).
  { chemin: "/visio/repetition/:seanceId", page: lazy(() => import("./PageRepetition")), acces: "connecte" },
  // Coût et réglages de la visio (équipe ; la direction seule modifie).
  { chemin: "/pilotage/visio", page: lazy(() => import("./PagePilotageVisio")), acces: ["admin", "vie_scolaire"], droit: "outils_campus" },
  // Banc d'essai d'une séance : ouvert à tous en développement (tests
  // automatisés formateur / salle / étudiant), réservé à l'équipe en production.
  {
    chemin: "/visio/test/:seanceId",
    page: lazy(() => import("./PageTest")),
    acces: import.meta.env.DEV ? "connecte" : ["admin", "vie_scolaire"],
    coquille: "plein-ecran",
  },
];
