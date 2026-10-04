import type { ComponentType, LazyExoticComponent } from "react";
import type { Droit, Role } from "@shared/schema";

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
  /**
   * Équipe (vie scolaire) : droit du profil exigé en plus du rôle, un seul
   * suffit dans une liste (shared/schema/ext-profils.ts). Sans effet pour les
   * autres rôles ; la direction a tous les droits.
   */
  droit?: Droit | Droit[];
  /** standard : coquille avec navigation · plein-ecran : coquille sans marge basse (live) · aucune : page nue. */
  coquille?: "standard" | "plein-ecran" | "aucune";
  /** Pour les pages publiques : envoyer une personne connectée vers son accueil. */
  redirigerSiConnecte?: boolean;
};
