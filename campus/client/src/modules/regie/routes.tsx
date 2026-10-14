// Routes du module régie (profil « Chargé de cours » : ext-profils.ts, droit « animer »).
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  // « Mon espace » du chargé de cours ; « Régie des cours » pour la direction et les profils « programme ».
  { chemin: "/regie", page: lazy(() => import("./PageRegie")), acces: ["admin", "vie_scolaire"], droit: ["animer", "programme"] },
];
