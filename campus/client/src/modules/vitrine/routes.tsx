// Le site public du campus : un vrai site multi-pages, sans coquille (en-tête
// et pied de page propres, voir MiseEnPagePublique). Seul l'accueil renvoie
// une personne connectée vers son espace ; les autres pages restent
// consultables connecté (l'en-tête affiche alors « Mon campus »).
// /programme appartient au module « programme ».
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PUBLIC = { acces: "public", coquille: "aucune" } as const;

export const routes: DefRoute[] = [
  { chemin: "/cours-ouverts/:slug", page: lazy(() => import("./PageCoursPublic")), ...PUBLIC },
  { chemin: "/cours-ouverts", page: lazy(() => import("./PageCatalogueCours")), ...PUBLIC },
  { chemin: "/formateurs/:slug", page: lazy(() => import("./PageFormateurPublic")), ...PUBLIC },
  { chemin: "/formateurs", page: lazy(() => import("./PageFormateurs")), ...PUBLIC },
  { chemin: "/campus/:slug", page: lazy(() => import("./PageUnCampus")), ...PUBLIC },
  { chemin: "/campus", page: lazy(() => import("./PageCampus")), ...PUBLIC },
  { chemin: "/le-direct", page: lazy(() => import("./PageLeDirect")), ...PUBLIC },
  { chemin: "/questions", page: lazy(() => import("./PageQuestions")), ...PUBLIC },
  { chemin: "/a-propos", page: lazy(() => import("./PageAPropos")), ...PUBLIC },
  { chemin: "/contact", page: lazy(() => import("./PageContact")), ...PUBLIC },
  { chemin: "/suppression-compte", page: lazy(() => import("./PageSuppressionCompte")), ...PUBLIC },
  { chemin: "/android", page: lazy(() => import("./PageAndroid")), ...PUBLIC },
  { chemin: "/confidentialite", page: lazy(() => import("./PageConfidentialite")), ...PUBLIC },
  { chemin: "/", page: lazy(() => import("./PageAccueilPublique")), ...PUBLIC, redirigerSiConnecte: true },
];
