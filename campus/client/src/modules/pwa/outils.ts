// Petits outils du module PWA : plateforme, mode installé, formulation selon le rôle.
import type { Role } from "@shared/schema";

export type Plateforme = "android" | "ios" | "ordinateur";

export function plateforme(): Plateforme {
  if (typeof navigator === "undefined") return "ordinateur";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "ordinateur";
}

/** Le campus est-il ouvert comme une application installée (icône de l'écran d'accueil) ? */
export function estInstallee(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

/** Tutoiement pour les étudiants, vouvoiement pour les formateurs, l'équipe et les visiteurs. */
export function formuler(role: Role | undefined | null, tu: string, vous: string): string {
  return role === "etudiant" ? tu : vous;
}

/** Lecture et écriture sûres du stockage local (navigation privée, stockage plein…). */
export function lireLocal(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}
export function ecrireLocal(cle: string, valeur: string | null) {
  try {
    if (valeur === null) window.localStorage.removeItem(cle);
    else window.localStorage.setItem(cle, valeur);
  } catch {
    /* stockage indisponible : tant pis, on redemandera */
  }
}
