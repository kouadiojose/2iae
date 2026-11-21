// « Démarrer un cours » sans question (21 novembre 2026) : le campus devine le cours (prévu maintenant, seul cours,
// habitude, récent) et ouvre la classe. Pas le bon cours ? On range à la fin (ConfirmerSeance).
import { useState } from "react";
import { useLocation } from "wouter";
import { get, post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { toast, toastErreur } from "@/components/ui/toast";

export type EtatDemarrage = {
  enDirect: { seanceId: number } | null;
  devine: { coursId?: number; seanceId?: number; titre: string; raison: "prevue" | "seul" | "habitude" | "recent" } | null;
  cours: { coursId: number; titre: string; code: string }[];
};

/** Ouvre la classe du cours deviné ; sinon le direct déjà ouvert ; sinon l'écran « Quel cours ? ». */
export function useDemarrerUnCours() {
  const [, naviguer] = useLocation();
  const [envoi, setEnvoi] = useState(false);
  const demarrer = async () => {
    if (envoi) return;
    setEnvoi(true);
    try {
      const etat = await get<EtatDemarrage>("/api/enseigner/demarrer");
      if (etat.enDirect) {
        naviguer(`/live/${etat.enDirect.seanceId}`);
        return;
      }
      if (!etat.devine) {
        naviguer("/enseigner/demarrer");
        return;
      }
      const d = etat.devine;
      const r = await post<{ seanceId: number; coursTitre: string }>("/api/enseigner/demarrer", d.seanceId ? { seanceId: d.seanceId } : { coursId: d.coursId });
      await rafraichir("/api/cours", "/api/seances", "/api/accueil", "/api/live/en-cours", "/api/agenda", "/api/enseigner/a-confirmer");
      toast(`Le cours « ${r.coursTitre || d.titre} » démarre. Pas le bon cours ? Vous corrigerez à la fin.`);
      naviguer(`/live/${r.seanceId}`);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return { demarrer, envoi };
}
