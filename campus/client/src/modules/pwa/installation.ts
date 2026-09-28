// Installation du campus sur l'écran d'accueil (PWA).
//
// Chrome Android envoie « beforeinstallprompt » très tôt, parfois avant que
// React ait monté la page : on l'attrape dès le chargement du module (importé
// par service-worker.ts depuis main.tsx) et on le garde pour le bouton
// « Installer ».
import { useEffect, useState } from "react";
import { estInstallee } from "./outils";

type EvenementInstallation = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let evenement: EvenementInstallation | null = null;
let installee = estInstallee();
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // On garde la fenêtre système pour la proposer au bon moment, avec une explication.
    e.preventDefault();
    evenement = e as EvenementInstallation;
    prevenir();
  });
  window.addEventListener("appinstalled", () => {
    evenement = null;
    installee = true;
    prevenir();
  });
}

/** Ouvre la fenêtre d'installation de Chrome. Renvoie vrai si la personne a accepté. */
export async function installer(): Promise<boolean> {
  if (!evenement) return false;
  const e = evenement;
  evenement = null;
  prevenir();
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") {
    installee = true;
    prevenir();
  }
  return outcome === "accepted";
}

/** État de l'installation : { peutInstaller } quand Chrome propose l'installation, { installee } une fois fait. */
export function useInstallation() {
  const [, setTic] = useState(0);
  useEffect(() => {
    const maj = () => setTic((t) => t + 1);
    abonnes.add(maj);
    return () => void abonnes.delete(maj);
  }, []);
  return { peutInstaller: Boolean(evenement), installee, installer };
}
