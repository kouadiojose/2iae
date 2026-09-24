// « Ouvre le campus dans Chrome » : Opera Mini, les navigateurs préinstallés
// (Phoenix sur Tecno/Infinix/Itel, UC Browser) et les navigateurs trop anciens
// ne gèrent ni le service worker ni la visio. Mieux vaut le dire tout de
// suite que d'échouer sans explication au premier cours en direct.
//
// Les navigateurs incapables d'exécuter l'application (Opera Mini en mode
// extrême, très vieux Android) voient un message équivalent écrit en dur dans
// client/index.html.
import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { plateforme } from "./outils";

export type RaisonNavigateur = "opera-mini" | "preinstalle" | "ancien";

/** Ce navigateur empêchera-t-il de suivre les cours ? (?navigateur=ancien force l'affichage, pour les essais.) */
export function navigateurLimite(): RaisonNavigateur | null {
  if (typeof window === "undefined") return null;
  if (new URLSearchParams(window.location.search).get("navigateur") === "ancien") return "ancien";
  const ua = navigator.userAgent;
  if (/Opera Mini|OPiM/i.test(ua) || "operamini" in window) return "opera-mini";
  if (/UCBrowser|UCWEB|\bPHX\/|PhoenixBrowser/i.test(ua)) return "preinstalle";
  const manque =
    !("serviceWorker" in navigator) ||
    typeof window.RTCPeerConnection === "undefined" ||
    typeof window.fetch !== "function" ||
    typeof window.IntersectionObserver === "undefined";
  return manque ? "ancien" : null;
}

/** Lien qui ouvre la même page dans Chrome sur Android (intent://). */
function lienChrome(): string {
  const { host, pathname, search } = window.location;
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
}

const CLE_FERME = "campus:avertissement-navigateur";

export function AvertissementNavigateur({ vouvoiement = false, className }: { vouvoiement?: boolean; className?: string }) {
  const [raison] = useState(navigateurLimite);
  const [ferme, setFerme] = useState(() => {
    try {
      return window.sessionStorage.getItem(CLE_FERME) === "1";
    } catch {
      return false;
    }
  });
  if (!raison || ferme) return null;

  const fermer = () => {
    try {
      window.sessionStorage.setItem(CLE_FERME, "1");
    } catch {
      /* stockage indisponible */
    }
    setFerme(true);
  };
  const android = plateforme() === "android";
  const titre = vouvoiement ? "Ouvrez le campus dans Chrome" : "Ouvre le campus dans Chrome";
  const texte =
    raison === "opera-mini"
      ? "Opera Mini ne permet pas de suivre les cours en direct ni d'utiliser le campus sans réseau."
      : raison === "preinstalle"
        ? "Le navigateur installé d'origine sur ce téléphone ne permet pas de suivre les cours en direct."
        : "Ce navigateur est trop ancien ou trop limité : les cours en direct et le mode sans réseau n'y fonctionneront pas.";

  return (
    <div role="alert" className={cn("border-b border-orange-peche bg-orange-clair", className)}>
      <div className="conteneur flex items-start gap-3 py-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] leading-snug text-encre">
            <strong className="font-extrabold">{titre}.</strong> {texte}
          </p>
          {android ? (
            <a
              href={lienChrome()}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center self-start rounded-xl bg-encre px-4 text-[15px] font-bold text-white no-underline hover:bg-orange hover:text-encre"
            >
              Ouvrir dans Chrome
            </a>
          ) : (
            <a
              href="https://www.google.com/chrome/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center self-start rounded-xl bg-encre px-4 text-[15px] font-bold text-white no-underline hover:bg-orange hover:text-encre"
            >
              Télécharger Chrome
            </a>
          )}
        </div>
        <button type="button" onClick={fermer} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-texte-pale hover:bg-white hover:text-encre" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
