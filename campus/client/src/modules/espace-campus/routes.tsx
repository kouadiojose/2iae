// Routes de l'espace du campus (profil « Chargé du campus » : ext-profils.ts, droit « espace_campus »). Pages nues
// (coquille « aucune ») : ni menu, ni cloche, chaque page a son en-tête simple. La direction les ouvre avec ?site=.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

const acces: DefRoute["acces"] = ["vie_scolaire", "admin"];

export const routes: DefRoute[] = [
  { chemin: "/mon-campus/cours/:coursId/live", page: lazy(() => import("./PageLiveCampus")), acces, droit: "espace_campus", coquille: "aucune" },
  { chemin: "/mon-campus/cours/:coursId/lecons/:leconId", page: lazy(() => import("./PageLeconCampus")), acces, droit: "espace_campus", coquille: "aucune" },
  { chemin: "/mon-campus/cours/:coursId/resumes/:seanceId", page: lazy(() => import("./PageResumeCampus")), acces, droit: "espace_campus", coquille: "aucune" },
  { chemin: "/mon-campus/cours/:coursId/lecons", page: lazy(() => import("./PageLeconsCampus")), acces, droit: "espace_campus", coquille: "aucune" },
  { chemin: "/mon-campus/cours/:coursId/resumes", page: lazy(() => import("./PageResumesCampus")), acces, droit: "espace_campus", coquille: "aucune" },
  { chemin: "/mon-campus/cours/:coursId/examens", page: lazy(() => import("./PageExamensCampus")), acces, droit: "espace_campus", coquille: "aucune" },
  { chemin: "/mon-campus/cours/:coursId/notes", page: lazy(() => import("./PageNotesCampus")), acces, droit: "espace_campus", coquille: "aucune" },
  { chemin: "/mon-campus/cours/:coursId", page: lazy(() => import("./PageCoursCampus")), acces, droit: "espace_campus", coquille: "aucune" },
  { chemin: "/mon-campus", page: lazy(() => import("./PageAccueilCampus")), acces, droit: "espace_campus", coquille: "aucune" },
];
