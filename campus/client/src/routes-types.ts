import type { ComponentType, LazyExoticComponent } from "react";
import type { Role } from "@shared/schema";

/**
 * Une route du campus. Chaque module déclare les siennes dans
 * modules/<module>/routes.tsx (tableau exporté « routes ») : App.tsx les
 * rassemble toutes automatiquement.
 */
export type DefRoute = {
  /** Motif wouter, ex. « /cours/:id ». */
  chemin: string;
  page: LazyExoticComponent<ComponentType<any>> | ComponentType<any>;
  /** « public » : visible sans compte · « connecte » : tout compte · liste : rôles autorisés. */
  acces: "public" | "connecte" | Role[];
  /** standard : coquille avec navigation · plein-ecran : coquille sans marge basse (live) · aucune : page nue. */
  coquille?: "standard" | "plein-ecran" | "aucune";
  /** Pour les pages publiques : envoyer une personne connectée vers son accueil. */
  redirigerSiConnecte?: boolean;
};
