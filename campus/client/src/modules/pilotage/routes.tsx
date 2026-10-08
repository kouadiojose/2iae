// Pages du pilotage (vie scolaire et direction), relevé public des parents et
// installation de l'écran d'une salle de conférence.
// /pilotage/annonces appartient au module annonces, /pilotage/programme au module programme.
// « droit » : ce que le profil de l'équipe doit permettre (shared/schema/ext-profils.ts).
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const EQUIPE: DefRoute["acces"] = ["admin", "vie_scolaire"];

export const routes: DefRoute[] = [
  // Motifs précis d'abord.
  { chemin: "/pilotage/comptes/import", page: lazy(() => import("./PageImport")), acces: EQUIPE, droit: "comptes_gerer" },
  { chemin: "/pilotage/comptes", page: lazy(() => import("./PageComptes")), acces: EQUIPE, droit: "comptes_voir" },
  { chemin: "/pilotage/fiches", page: lazy(() => import("./PageFiches")), acces: EQUIPE, coquille: "aucune", droit: ["nouveau_code", "comptes_gerer"] },
  { chemin: "/pilotage/classes", page: lazy(() => import("./PageClasses")), acces: EQUIPE },
  { chemin: "/pilotage/cours", page: lazy(() => import("./PageCours")), acces: EQUIPE, droit: "programme" },
  { chemin: "/pilotage/planning", page: lazy(() => import("./PagePlanning")), acces: EQUIPE },
  { chemin: "/pilotage/presences", page: lazy(() => import("./PagePresences")), acces: EQUIPE, droit: "presences_voir" },
  { chemin: "/pilotage/rentree", page: lazy(() => import("./PageRentree")), acces: EQUIPE, droit: "outils_campus" },
  { chemin: "/pilotage/site", page: lazy(() => import("./PageSite")), acces: EQUIPE },
  { chemin: "/pilotage/suivi", page: lazy(() => import("./PageSuivi")), acces: EQUIPE, droit: "suivi" },
  { chemin: "/pilotage/etudiants/nouveau", page: lazy(() => import("./PageNouvelEtudiant")), acces: EQUIPE, droit: "comptes_gerer" },
  { chemin: "/pilotage/etudiants/:id", page: lazy(() => import("./PageEtudiant")), acces: EQUIPE, droit: "comptes_voir" },
  { chemin: "/pilotage/etudiants", page: lazy(() => import("./PageEtudiants")), acces: EQUIPE, droit: "comptes_voir" },
  { chemin: "/pilotage/preinscrits", page: lazy(() => import("./PagePreinscrits")), acces: EQUIPE, droit: "crm" },
  { chemin: "/pilotage/relances", page: lazy(() => import("./PageRelances")), acces: EQUIPE, droit: "crm" },
  { chemin: "/pilotage/scolarite", page: lazy(() => import("./PageScolarite")), acces: EQUIPE, droit: "argent" },
  { chemin: "/pilotage/recus/:id", page: lazy(() => import("./PageRecu")), acces: EQUIPE, coquille: "aucune", droit: "argent" },
  { chemin: "/pilotage/ia", page: lazy(() => import("./PageIa")), acces: EQUIPE, droit: "outils_campus" },
  // « Le travail du campus » : séances tenues, cours résumés, QCM, exercices, notes (direction ; équipe avec notes ou présences).
  { chemin: "/pilotage/travail", page: lazy(() => import("./PageTravail")), acces: EQUIPE, droit: ["notes", "presences_voir"] },
  { chemin: "/pilotage", page: lazy(() => import("./PageTableau")), acces: EQUIPE },
  // Public : le lien envoyé aux parents sur WhatsApp.
  { chemin: "/releve/:jeton", page: lazy(() => import("./PageReleve")), acces: "public", coquille: "aucune" },
  // Public : l'ordinateur de la salle de conférence s'installe (lien, ou code de 8 caractères).
  { chemin: "/ecran/:jeton", page: lazy(() => import("./PageInstallerEcran")), acces: "public", coquille: "aucune" },
  { chemin: "/ecran", page: lazy(() => import("./PageInstallerEcran")), acces: "public", coquille: "aucune" },
];
