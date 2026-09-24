// Routes du module compte : connexion, première connexion, code oublié, profil.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  { chemin: "/connexion", page: lazy(() => import("./PageConnexion")), acces: "public", coquille: "aucune" },
  { chemin: "/activer/:jeton", page: lazy(() => import("./PageActiver")), acces: "public", coquille: "aucune" },
  { chemin: "/mot-de-passe-oublie", page: lazy(() => import("./PageMotDePasseOublie")), acces: "public", coquille: "aucune" },
  { chemin: "/reinitialiser/:jeton", page: lazy(() => import("./PageReinitialiser")), acces: "public", coquille: "aucune" },
  { chemin: "/bienvenue", page: lazy(() => import("./PageBienvenue")), acces: "connecte", coquille: "aucune" },
  { chemin: "/profil", page: lazy(() => import("./PageProfil")), acces: ["etudiant", "formateur", "vie_scolaire", "admin"], coquille: "standard" },
];
