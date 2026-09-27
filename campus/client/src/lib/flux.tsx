// Temps réel côté client : UNE connexion SSE (/api/flux) par onglet,
// multiplexée en canaux. Les pages s'abonnent avec useCanal("seance:12", …).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { post, ErreurApi } from "./api";
import { useMoi } from "./auth";

export type EvenementFlux = { canal: string; type: string; data: any };
type Ecouteur = (e: EvenementFlux) => void;

type ContexteFlux = {
  connecte: boolean;
  /** Le flux arrive en direct (messages reçus il y a moins de 40 s). Sinon, les pages relisent vite. */
  sain: boolean;
  ecouter: (canal: string, fn: Ecouteur) => () => void;
};

const Contexte = createContext<ContexteFlux>({ connecte: false, sain: false, ecouter: () => () => undefined });

/** Sans aucun message (le serveur en envoie un toutes les 15 s) pendant ce délai, le flux est retenu en route. */
const SILENCE_MAX_MS = 40_000;

export function FournisseurFlux({ children }: { children: ReactNode }) {
  const { moi } = useMoi();
  const [connecte, setConnecte] = useState(false);
  const [sain, setSain] = useState(false);
  const ecouteurs = useRef(new Map<string, Set<Ecouteur>>());
  const connexionId = useRef<string | null>(null);
  const reconnecter = useRef<() => void>(() => undefined);

  // Abonnement côté serveur, réessayé en cas d'échec passager (un refus d'accès, lui, est définitif).
  const abonnerServeur = (canal: string, essai = 0) => {
    const id = connexionId.current;
    if (!id || canal === "*" || isCanalPersonnel(canal)) return;
    post("/api/flux/abonner", { connexion: id, canal }).catch((e: unknown) => {
      const statut = e instanceof ErreurApi ? e.statut : 0;
      if (statut === 403 || !ecouteurs.current.has(canal) || connexionId.current !== id) return;
      if (statut === 410) return reconnecter.current(); // connexion inconnue du serveur : on en ouvre une neuve
      if (essai < 5) setTimeout(() => abonnerServeur(canal, essai + 1), 3000);
    });
  };

  useEffect(() => {
    if (!moi) return;
    let source: EventSource | null = null;
    let dernier = Date.now();
    let remplacee = false;
    const ouvrir = () => {
      source?.close();
      connexionId.current = null;
      dernier = Date.now();
      source = new EventSource("/api/flux", { withCredentials: true });
      source.onmessage = (m) => {
        dernier = Date.now();
        let e: EvenementFlux;
        try {
          e = JSON.parse(m.data);
        } catch {
          return;
        }
        if (e.type === "battement") return setSain(true);
        if (e.type === "remplace") {
          // Trop d'onglets ouverts avec ce compte : celui-ci cède sa place et relit l'état de temps en temps.
          remplacee = true;
          source?.close();
          connexionId.current = null;
          setConnecte(false);
          setSain(false);
          return;
        }
        if (e.type === "connexion") {
          connexionId.current = e.data.id;
          setConnecte(true);
          setSain(true);
          // (Ré)abonne tous les canaux écoutés : utile après une coupure réseau.
          for (const canal of ecouteurs.current.keys()) abonnerServeur(canal);
          return;
        }
        for (const fn of ecouteurs.current.get(e.canal) ?? []) fn(e);
        for (const fn of ecouteurs.current.get("*") ?? []) fn(e);
      };
      source.onerror = () => {
        setConnecte(false);
        setSain(false);
      };
    };
    reconnecter.current = () => {
      if (!remplacee) ouvrir();
    };
    ouvrir();
    // Flux muet (retenu par un antivirus, un proxy, un réseau) : on le rouvre, et les pages relisent vite en attendant.
    const veille = setInterval(() => {
      if (remplacee || Date.now() - dernier < SILENCE_MAX_MS) return;
      setSain(false);
      ouvrir();
    }, 5000);
    return () => {
      clearInterval(veille);
      reconnecter.current = () => undefined;
      source?.close();
      connexionId.current = null;
      setConnecte(false);
      setSain(false);
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

  return <Contexte.Provider value={{ connecte, sain, ecouter }}>{children}</Contexte.Provider>;
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

/** Le temps réel arrive-t-il en direct ? Sinon, relire l'état souvent (quelques secondes). */
export function useFluxSain() {
  return useContext(Contexte).sain;
}
