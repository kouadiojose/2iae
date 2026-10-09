// Vue posée par-dessus une page (portail plein écran : « Devoirs » et visite d'un groupe dans le Studio, copie
// lue en grand). Trois règles pour ceux qui ne sont pas à l'aise avec la technique :
//
//   - le geste « retour » du téléphone (ou la flèche retour du navigateur) referme la vue au lieu de quitter la
//     page : en plein direct, quitter le Studio coupait la visio. La vue ajoute une entrée à l'historique (même
//     adresse) et se referme quand on la retire ; refermée par un bouton, elle retire elle-même son entrée ;
//   - Échap referme la vue du dessus, et elle seule ;
//   - le clavier reste dans la vue (Tab tourne dans la vue, le focus y entre à l'ouverture et revient au bouton
//     qui l'a ouverte à la fermeture).
import { useEffect, useRef, type RefObject } from "react";

const pile: symbol[] = [];

const SELECTEUR_FOCUS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Options = {
  /** Appelée sur Échap avant de refermer : rend true si elle a traité la touche (vider un champ de recherche…). */
  avantEchap?: (e: KeyboardEvent) => boolean;
};

export function useVueSuperposee(conteneur: RefObject<HTMLElement | null>, onFermer: () => void, options: Options = {}) {
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  const avantEchap = useRef(options.avantEchap);
  avantEchap.current = options.avantEchap;

  // Historique : le geste retour referme la vue.
  useEffect(() => {
    const marque = `vue-${Math.random().toString(36).slice(2)}`;
    let retiree = false;
    try {
      const etat = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
      window.history.pushState({ ...etat, vueSuperposee: marque }, "");
    } catch {
      retiree = true;
    }
    const surRetour = () => {
      if ((window.history.state as { vueSuperposee?: string } | null)?.vueSuperposee === marque) return;
      retiree = true;
      fermer.current();
    };
    window.addEventListener("popstate", surRetour);
    return () => {
      window.removeEventListener("popstate", surRetour);
      // Refermée par un bouton (ou démontée) : son entrée part, sans toucher à celles des autres pages.
      if (!retiree && (window.history.state as { vueSuperposee?: string } | null)?.vueSuperposee === marque) window.history.back();
    };
  }, []);

  // Clavier : Échap et Tab pour la vue du dessus ; le focus entre dans la vue, puis revient où il était.
  useEffect(() => {
    const moi = Symbol("vue");
    pile.push(moi);
    const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    conteneur.current?.focus({ preventScroll: true });
    const touche = (e: KeyboardEvent) => {
      if (pile[pile.length - 1] !== moi) return;
      if (e.key === "Escape") {
        if (avantEchap.current?.(e)) return;
        e.preventDefault();
        fermer.current();
        return;
      }
      if (e.key !== "Tab") return;
      const el = conteneur.current;
      if (!el) return;
      const liste = [...el.querySelectorAll<HTMLElement>(SELECTEUR_FOCUS)].filter((x) => x.getClientRects().length > 0);
      const actif = document.activeElement;
      if (!liste.length) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        return;
      }
      const premier = liste[0];
      const dernier = liste[liste.length - 1];
      if (!actif || !el.contains(actif) || actif === el) {
        e.preventDefault();
        (e.shiftKey ? dernier : premier).focus();
      } else if (e.shiftKey && actif === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && actif === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("keydown", touche);
      const i = pile.indexOf(moi);
      if (i >= 0) pile.splice(i, 1);
      if (avant && document.contains(avant)) avant.focus({ preventScroll: true });
    };
  }, []);
}
