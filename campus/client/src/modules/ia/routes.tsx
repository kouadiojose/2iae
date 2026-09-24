// Routes de l'assistant IA. Les motifs précis passent AVANT « /assistant/:id ».
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const PageAssistant = lazy(() => import("./PageAssistant"));
const PageConversation = lazy(() => import("./PageConversation"));
const PageCharte = lazy(() => import("./PageCharte"));
const PagePreparerSeance = lazy(() => import("./PagePreparerSeance"));
const PageFiches = lazy(() => import("./PageFiches"));

/** L'écran d'une salle de conférence n'a pas d'assistant. */
const PERSONNES = ["etudiant", "formateur", "vie_scolaire", "admin"] as const;
const EQUIPE_PEDAGOGIQUE = ["formateur", "vie_scolaire", "admin"] as const;

export const routes: DefRoute[] = [
  { chemin: "/assistant/charte", page: PageCharte, acces: [...PERSONNES] },
  { chemin: "/assistant/preparer-seance", page: PagePreparerSeance, acces: [...EQUIPE_PEDAGOGIQUE] },
  { chemin: "/assistant/fiches", page: PageFiches, acces: [...EQUIPE_PEDAGOGIQUE] },
  { chemin: "/assistant/:id", page: PageConversation, acces: [...PERSONNES] },
  { chemin: "/assistant", page: PageAssistant, acces: [...PERSONNES] },
];
