// Accès à l'API de l'assistant : état (disponible, quota, pause), cours,
// conversations, et lecture EN FLUX de la réponse (ReadableStream) pour
// afficher le texte pendant que Claude l'écrit.
import { useQuery } from "@tanstack/react-query";
import { ErreurApi } from "@/lib/api";
import { noterHeureServeur } from "@/lib/horloge";
// Import direct du fichier de contrats (sans tables Drizzle) : rien de lourd dans le paquet du téléphone.
import { SEPARATEUR_FIN_FLUX, type EtatIa, type CoursAssistant, type FinFluxIa } from "@shared/schema/ext-ia";

/** État de l'assistant pour la personne connectée (rafraîchi toutes les minutes : la pause d'une interrogation se lève seule). */
export function useEtatIa(actif = true) {
  return useQuery<EtatIa>({ queryKey: ["/api/ia/etat"], refetchInterval: 60_000, staleTime: 15_000, enabled: actif });
}

export function useCoursAssistant() {
  return useQuery<CoursAssistant[]>({ queryKey: ["/api/ia/cours"], staleTime: 5 * 60_000 });
}

/** Ce que l'interface doit dire quand l'assistant ne peut pas répondre (null s'il peut). */
export function blocageDe(etat: EtatIa | undefined): { type: "pause" | "indisponible" | "quota"; message: string } | null {
  if (!etat) return null;
  if (etat.pause) return { type: "pause", message: etat.pause.raison };
  if (!etat.disponible) return { type: "indisponible", message: "L'assistant est en pause pour le moment." };
  if (etat.restantes <= 0) return { type: "quota", message: `Limite de ${etat.quotaJour} questions atteinte pour aujourd'hui.` };
  return null;
}

export type CorpsQuestion = { contenu: string; leconId?: number; devoirId?: number };

/**
 * Envoie une question et lit la réponse au fil de l'eau. `surTexte` reçoit le
 * texte complet déjà arrivé (pas seulement le dernier morceau). Les refus
 * (quota, pause, IA absente) arrivent avant le flux, en JSON : ErreurApi.
 */
export async function envoyerQuestion(
  conversationId: number,
  corps: CorpsQuestion,
  surTexte: (texte: string) => void,
  signal?: AbortSignal,
): Promise<{ texte: string; fin: FinFluxIa }> {
  let reponse: Response;
  try {
    reponse = await fetch(`/api/ia/conversations/${conversationId}/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ErreurApi(0, "Pas de connexion internet. Vérifie ton réseau et réessaie.");
  }
  noterHeureServeur(reponse.headers.get("date"));
  if (!reponse.ok) {
    const contenu = (await reponse.json().catch(() => null)) as { message?: string } | null;
    throw new ErreurApi(reponse.status, contenu?.message || "Une erreur est survenue. Réessaie dans un instant.");
  }

  let brut = "";
  const decodeur = new TextDecoder();
  const partieTexte = () => {
    const i = brut.indexOf(SEPARATEUR_FIN_FLUX);
    return i >= 0 ? brut.slice(0, i) : brut;
  };
  try {
    if (reponse.body) {
      const lecteur = reponse.body.getReader();
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        brut += decodeur.decode(value, { stream: true });
        surTexte(partieTexte());
      }
      brut += decodeur.decode();
    } else {
      // Très vieux navigateur sans flux : tout arrive d'un coup.
      brut = await reponse.text();
      surTexte(partieTexte());
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    // Coupure réseau en pleine réponse : le serveur, lui, termine et enregistre.
    return {
      texte: partieTexte(),
      fin: { erreur: "La connexion a coupé pendant la réponse. Elle sera complète dans la conversation au retour du réseau." },
    };
  }

  const i = brut.indexOf(SEPARATEUR_FIN_FLUX);
  let fin: FinFluxIa = {};
  if (i >= 0) {
    try {
      fin = JSON.parse(brut.slice(i + SEPARATEUR_FIN_FLUX.length)) as FinFluxIa;
    } catch {
      fin = {};
    }
  } else {
    fin = { erreur: "La réponse a été coupée en route. Recharge la conversation dans un instant." };
  }
  return { texte: fin.remplacer ?? partieTexte(), fin };
}

/**
 * Question tapée sur l'accueil de l'assistant, à envoyer dès l'ouverture de
 * la conversation (prise une seule fois).
 */
const questionsEnAttente = new Map<number, string>();
export function mettreEnAttente(conversationId: number, question: string) {
  questionsEnAttente.set(conversationId, question);
}
export function prendreEnAttente(conversationId: number): string | undefined {
  const q = questionsEnAttente.get(conversationId);
  questionsEnAttente.delete(conversationId);
  return q;
}
