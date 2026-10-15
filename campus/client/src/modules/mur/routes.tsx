// Le mur du cours (José, 15 octobre 2026) : la page du professeur. Les étudiants le lisent dans l'onglet « Le mur » de
// la page du cours (modules/cours/PageCours.tsx), l'espace du campus dans /mon-campus/cours/:id/mur (espace-campus).
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  { chemin: "/enseigner/mon-cours/:coursId/mur", page: lazy(() => import("./PageMurProfesseur")), acces: ["formateur", "admin"] },
];
