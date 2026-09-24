// Routes du module agenda : « Ma semaine en liste ».
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PageAgenda = lazy(() => import("./PageAgenda"));

export const routes: DefRoute[] = [{ chemin: "/agenda", page: PageAgenda, acces: ["etudiant", "formateur", "vie_scolaire", "admin"] }];
