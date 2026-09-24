import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

// La messagerie est ouverte à tous les comptes, sauf l'écran de salle.
const ACCES: DefRoute["acces"] = ["etudiant", "formateur", "vie_scolaire", "admin"];

const PageMessages = lazy(() => import("./PageMessages"));

// Motifs précis avant les motifs génériques. La liste et le fil gèrent eux-mêmes
// leur hauteur (fil plein écran sur téléphone, deux panneaux sur ordinateur) :
// coquille « plein-ecran », sans la marge basse standard.
export const routes: DefRoute[] = [
  { chemin: "/messages/cours/:coursId", page: lazy(() => import("./PageSalonCours")), acces: ACCES },
  { chemin: "/messages/nouveau", page: lazy(() => import("./PageNouveauMessage")), acces: ACCES },
  { chemin: "/messages/:id", page: PageMessages, acces: ACCES, coquille: "plein-ecran" },
  { chemin: "/messages", page: PageMessages, acces: ACCES, coquille: "plein-ecran" },
];
