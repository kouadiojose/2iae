// Routes de la médiathèque des cours (enregistrements et documents).
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PageMediatheque = lazy(() => import("./PageMediatheque"));
const PageDiapos = lazy(() => import("./PageDiapos"));
const PageCoursComplet = lazy(() => import("./PageCoursComplet"));

const TOUS = ["etudiant", "formateur", "vie_scolaire", "admin"] as const;

export const routes: DefRoute[] = [
  { chemin: "/mediatheque/diapos/:id", page: PageDiapos, acces: [...TOUS] },
  { chemin: "/mediatheque/cours/:id", page: PageCoursComplet, acces: [...TOUS] },
  { chemin: "/mediatheque", page: PageMediatheque, acces: [...TOUS] },
];
