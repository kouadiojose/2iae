// Routes de la bibliothèque virtuelle.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PageBibliotheque = lazy(() => import("./PageBibliotheque"));
const PageRecherche = lazy(() => import("./PageRecherche"));
const PageLivre = lazy(() => import("./PageLivre"));
const PageExpose = lazy(() => import("./PageExpose"));
const PageActivite = lazy(() => import("./PageActivite"));
const PageBibliothecaire = lazy(() => import("./PageBibliothecaire"));

const LECTEURS = ["etudiant", "formateur", "vie_scolaire", "admin"] as const;
const SUIVI = ["formateur", "vie_scolaire", "admin"] as const;

export const routes: DefRoute[] = [
  { chemin: "/bibliotheque/activite", page: PageActivite, acces: [...SUIVI] },
  { chemin: "/bibliotheque/conversations/:id", page: PageBibliothecaire, acces: [...LECTEURS] },
  { chemin: "/bibliotheque/recherches/:id", page: PageRecherche, acces: [...LECTEURS] },
  { chemin: "/bibliotheque/livres/:id", page: PageLivre, acces: [...LECTEURS] },
  { chemin: "/bibliotheque/exposes/:id", page: PageExpose, acces: [...LECTEURS] },
  { chemin: "/bibliotheque", page: PageBibliotheque, acces: [...LECTEURS] },
];
