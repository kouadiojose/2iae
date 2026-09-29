// Routes du module compte : connexion, première connexion, code oublié, profil.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  { chemin: "/connexion", page: lazy(() => import("./PageConnexion")), acces: "public", coquille: "aucune" },
  { chemin: "/activer/:jeton", page: lazy(() => import("./PageActiver")), acces: "public", coquille: "aucune" },
  // Public : le lien d'inscription que la direction partage à l'équipe administrative.
  { chemin: "/rejoindre/:jeton", page: lazy(() => import("./PageRejoindre")), acces: "public", coquille: "aucune" },
  // Public : le lien personnel d'inscription d'un formateur (compte prêt aussitôt, guide par e-mail).
  { chemin: "/inscription-formateur/:jeton", page: lazy(() => import("./PageInscriptionFormateur")), acces: "public", coquille: "aucune" },
  { chemin: "/mot-de-passe-oublie", page: lazy(() => import("./PageMotDePasseOublie")), acces: "public", coquille: "aucune" },
  { chemin: "/reinitialiser/:jeton", page: lazy(() => import("./PageReinitialiser")), acces: "public", coquille: "aucune" },
  { chemin: "/bienvenue", page: lazy(() => import("./PageBienvenue")), acces: "connecte", coquille: "aucune" },
  { chemin: "/profil", page: lazy(() => import("./PageProfil")), acces: ["etudiant", "formateur", "vie_scolaire", "admin"], coquille: "standard" },
];
