// Routes de la révision du jour (chantier C1) : /reviser, sur un écran nu.
//
// Ce fichier est chargé au démarrage de l'application (App.tsx) : il reste
// minuscule. Chez un étudiant qui a déjà révisé sur ce téléphone, le campus
// prépare en arrière-plan, une fois par jour, le paquet de cartes et l'écran
// /reviser (et l'écran du cours complet s'il en a ouvert un) : après une
// nouvelle version du campus, ils s'ouvrent encore sans réseau.
import { lazy } from "react";
import type { DefRoute } from "@/routes-types";
import { rafraichir } from "@/lib/queryClient";
import { lireLocal } from "@/modules/pwa/outils";
import { prechargerRevision } from "./prechargerRevision";

const PageReviser = lazy(() => import("./PageReviser"));

export const routes: DefRoute[] = [{ chemin: "/reviser", page: PageReviser, acces: ["etudiant"], coquille: "aucune" }];

/** Posé par l'écran /reviser et par le cours complet (mêmes clés que paquet.ts et PageCoursComplet.tsx). */
const CLE_UTILISEE = "campus:revision:utilisee";
const CLE_COURS_COMPLET = "campus:cours-complet:vu";

if (typeof window !== "undefined") {
  // Réponses parties plus tard par la file hors ligne : l'objectif du jour et le résumé se remettent à jour.
  window.addEventListener("campus:envoi-reussi", (e) => {
    const cle = (e as CustomEvent<{ cle?: string }>).detail?.cle ?? "";
    if (cle.startsWith("revision:")) void rafraichir("/api/revision/du-jour", "/api/objectif-du-jour");
  });
  window.setTimeout(() => {
    if (!navigator.onLine) return;
    const plusTard = (fn: () => void) => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn) : setTimeout(fn, 0));
    if (lireLocal(CLE_UTILISEE)) plusTard(prechargerRevision);
    if (lireLocal(CLE_COURS_COMPLET)) plusTard(() => void import("@/modules/mediatheque/PageCoursComplet").catch(() => undefined));
  }, 8_000);
}
