// Routes du module compte : connexion, première connexion, code oublié, profil.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  { chemin: "/connexion", page: lazy(() => import("./PageConnexion")), acces: "public", coquille: "aucune" },
  { chemin: "/activer/:jeton", page: lazy(() => import("./PageActiver")), acces: "public", coquille: "aucune" },
  // Public : le lien d'inscription que la direction partage à l'équipe administrative.
  { chemin: "/rejoindre/:jeton", page: lazy(() => import("./PageRejoindre")), acces: "public", coquille: "aucune" },
  // Public : le lien personnel d'un formateur (ou de l'équipe) pour créer son compte ; le guide part par e-mail.
  { chemin: "/invitation/:jeton", page: lazy(() => import("./PageInvitation")), acces: "public", coquille: "aucune" },
  // Public : le lien partagé aux étudiants pour créer leur compte eux-mêmes (compte ouvert aussitôt).
  { chemin: "/inscription/:jeton", page: lazy(() => import("./PageInscription")), acces: "public", coquille: "aucune" },
  // Public : l'ancien lien d'inscription d'un formateur (/inscription-formateur) : les liens déjà envoyés restent valables.
  { chemin: "/inscription-formateur/:jeton", page: lazy(() => import("./PageInscriptionFormateur")), acces: "public", coquille: "aucune" },
  { chemin: "/mot-de-passe-oublie", page: lazy(() => import("./PageMotDePasseOublie")), acces: "public", coquille: "aucune" },
  { chemin: "/reinitialiser/:jeton", page: lazy(() => import("./PageReinitialiser")), acces: "public", coquille: "aucune" },
  { chemin: "/bienvenue", page: lazy(() => import("./PageBienvenue")), acces: "connecte", coquille: "aucune" },
  { chemin: "/profil", page: lazy(() => import("./PageProfil")), acces: ["etudiant", "formateur", "vie_scolaire", "admin"], coquille: "standard" },
];
