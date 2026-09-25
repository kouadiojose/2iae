// Temps réel côté client : UNE connexion SSE (/api/flux) par onglet,
// multiplexée en canaux. Les pages s'abonnent avec useCanal("seance:12", …).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { post } from "./api";
import { useMoi } from "./auth";

export type EvenementFlux = { canal: string; type: string; data: any };
type Ecouteur = (e: EvenementFlux) => void;

type ContexteFlux = {
  connecte: boolean;
  ecouter: (canal: string, fn: Ecouteur) => () => void;
};

const Contexte = createContext<ContexteFlux>({ connecte: false, ecouter: () => () => undefined });

export function FournisseurFlux({ children }: { children: ReactNode }) {
  const { moi } = useMoi();
  const [connecte, setConnecte] = useState(false);
  const ecouteurs = useRef(new Map<string, Set<Ecouteur>>());
  const connexionId = useRef<string | null>(null);

  const abonnerServeur = (canal: string) => {
    if (!connexionId.current || canal === "*" || isCanalPersonnel(canal)) return;
    post("/api/flux/abonner", { connexion: connexionId.current, canal }).catch(() => undefined);
  };

  useEffect(() => {
    if (!moi) return;
    const source = new EventSource("/api/flux", { withCredentials: true });
    source.onmessage = (m) => {
      let e: EvenementFlux;
      try {
        e = JSON.parse(m.data);
      } catch {
        return;
      }
      if (e.type === "connexion") {
        connexionId.current = e.data.id;
        setConnecte(true);
        // (Ré)abonne tous les canaux écoutés : utile après une coupure réseau.
        for (const canal of ecouteurs.current.keys()) abonnerServeur(canal);
        return;
      }
      for (const fn of ecouteurs.current.get(e.canal) ?? []) fn(e);
      for (const fn of ecouteurs.current.get("*") ?? []) fn(e);
    };
    source.onerror = () => setConnecte(false);
    return () => {
      source.close();
      connexionId.current = null;
      setConnecte(false);
    };
  }, [moi?.id]);

  const ecouter = useCallback((canal: string, fn: Ecouteur) => {
    let s = ecouteurs.current.get(canal);
    if (!s) {
      ecouteurs.current.set(canal, (s = new Set()));
      if (canal !== "*") abonnerServeur(canal);
    }
    s.add(fn);
    return () => {
      const t = ecouteurs.current.get(canal);
      if (!t) return;
      t.delete(fn);
      if (!t.size) {
        ecouteurs.current.delete(canal);
        if (connexionId.current && canal !== "*" && !isCanalPersonnel(canal)) {
          post("/api/flux/desabonner", { connexion: connexionId.current, canal }).catch(() => undefined);
        }
      }
    };
  }, []);

  return <Contexte.Provider value={{ connecte, ecouter }}>{children}</Contexte.Provider>;
}

// Canaux auxquels le serveur abonne d'office chaque connexion.
function isCanalPersonnel(canal: string) {
  return canal === "tous" || /^(u|role|site|classe):/.test(canal);
}

/** Écoute un canal ; le gestionnaire le plus récent est toujours utilisé. */
export function useCanal(canal: string | null | undefined, gestionnaire: (e: EvenementFlux) => void) {
  const { ecouter } = useContext(Contexte);
  const ref = useRef(gestionnaire);
  ref.current = gestionnaire;
  useEffect(() => {
    if (!canal) return;
    return ecouter(canal, (e) => ref.current(e));
  }, [canal, ecouter]);
}

/** Événements de TOUS les canaux (ex. cloche de notifications). */
export function useTousEvenements(gestionnaire: (e: EvenementFlux) => void) {
  useCanal("*", gestionnaire);
}

export function useFluxConnecte() {
  return useContext(Contexte).connecte;
}
