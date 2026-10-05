// Routes de la médiathèque des cours (enregistrements et documents).
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PageMediatheque = lazy(() => import("./PageMediatheque"));

export const routes: DefRoute[] = [{ chemin: "/mediatheque", page: PageMediatheque, acces: ["etudiant", "formateur", "vie_scolaire", "admin"] }];
