// Routes du module relances (chantier C4) : la page « Mes rappels » de
// l'étudiant (lien depuis son profil), et la page publique où mène le lien
// « Ne plus recevoir ces e-mails » (sans connexion).
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";

export const routes: DefRoute[] = [
  { chemin: "/mes-rappels", page: lazy(() => import("./PageMesRappels")), acces: ["etudiant"] },
  { chemin: "/desabonnement", page: lazy(() => import("./PageDesabonnement")), acces: "public", coquille: "aucune" },
];
