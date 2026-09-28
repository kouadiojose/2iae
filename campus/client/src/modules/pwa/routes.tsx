// Routes du module PWA. La page hors ligne est chargée avec l'application
// (import direct, pas de React.lazy) : sans réseau, un écran chargé à la
// demande ne pourrait pas s'ouvrir.
import type { DefRoute } from "@/routes-types";
import PageHorsLigne from "./PageHorsLigne";

export const routes: DefRoute[] = [{ chemin: "/hors-ligne", page: PageHorsLigne, acces: "public", coquille: "aucune" }];
