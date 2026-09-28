// Une conversation avec l'assistant : messages enregistrés + échange en cours
// affiché en flux. Sert à la page /assistant/:id et à la feuille du
// BoutonAssistant (qui crée la conversation au premier message).
import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { post, ErreurApi } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import type { ConversationIaDetail, ConversationIaResume } from "@shared/schema/ext-ia";
import { toast } from "@/components/ui/toast";
import { envoyerQuestion } from "./api-ia";

export type EchangeEnCours = {
  question: string;
  reponse: string;
  statut: "attente" | "flux" | "fini" | "erreur";
  erreur?: string;
  /** La connexion a coupé : la réponse est peut-être enregistrée côté serveur (recharger plutôt que reposer). */
  coupure?: boolean;
  messageId?: number;
};

export type ContexteConversation = { coursId?: number; leconId?: number; devoirId?: number };

export function useConversationIa({
  id: idInitial,
  contexte,
  surCreation,
}: {
  id: number | null;
  contexte?: ContexteConversation;
  surCreation?: (id: number) => void;
}) {
  const [id, setId] = useState<number | null>(idInitial);
  const detail = useQuery<ConversationIaDetail>({ queryKey: ["/api/ia/conversations", id ?? 0], enabled: id !== null });
  const [enCours, setEnCours] = useState<EchangeEnCours | null>(null);
  const occupe = useRef(false);

  const envoyer = useCallback(
    async (question: string) => {
      const texte = question.trim();
      if (!texte || occupe.current) return;
      occupe.current = true;
      setEnCours({ question: texte, reponse: "", statut: "attente" });
      let conversationId = id;
      try {
        if (conversationId === null) {
          const creee = await post<ConversationIaResume>("/api/ia/conversations", contexte ?? {});
          conversationId = creee.id;
          setId(creee.id);
          surCreation?.(creee.id);
        }
        const { texte: reponse, fin } = await envoyerQuestion(
          conversationId,
          { contenu: texte, leconId: contexte?.leconId, devoirId: contexte?.devoirId },
          (t) => setEnCours((e) => (e ? { ...e, reponse: t, statut: "flux" } : e)),
        );
        const coupure = Boolean(fin.erreur) && fin.restantes === undefined;
        setEnCours({
          question: texte,
          reponse,
          statut: fin.erreur ? "erreur" : "fini",
          erreur: fin.erreur,
          coupure,
          messageId: fin.messageId,
        });
        // fetchQuery (et non refetch) : la conversation vient peut-être d'être créée
        // et n'a pas encore d'observateur ; le cache est rempli dans tous les cas.
        await Promise.all([
          queryClient.fetchQuery({ queryKey: ["/api/ia/conversations", conversationId], staleTime: 0 }),
          rafraichir("/api/ia/etat", "/api/ia/conversations"),
        ]).catch(() => undefined);
        // Réponse enregistrée : elle s'affiche désormais depuis la conversation
        // (si elle a été coupée en route, on le dit en plus).
        if (fin.messageId) {
          setEnCours(null);
          if (fin.erreur) toast(fin.erreur, "erreur");
        }
      } catch (e) {
        setEnCours({
          question: texte,
          reponse: "",
          statut: "erreur",
          erreur: e instanceof Error ? e.message : "Une erreur est survenue. Réessaie dans un instant.",
        });
        if (e instanceof ErreurApi && [423, 429, 503].includes(e.statut)) void rafraichir("/api/ia/etat");
      } finally {
        occupe.current = false;
      }
    },
    [id, contexte, surCreation],
  );

  const recharger = useCallback(async () => {
    if (id === null) return;
    await queryClient.fetchQuery({ queryKey: ["/api/ia/conversations", id], staleTime: 0 }).catch(() => undefined);
    setEnCours(null);
  }, [id]);

  const oublierErreur = useCallback(() => setEnCours(null), []);

  const messages = detail.data?.messages ?? [];
  // Évite d'afficher deux fois la réponse le temps que la conversation se recharge.
  const echange = enCours && !(enCours.messageId && messages.some((m) => m.id === enCours.messageId)) ? enCours : null;

  return {
    id,
    detail,
    messages,
    echange,
    occupe: enCours?.statut === "attente" || enCours?.statut === "flux",
    envoyer,
    recharger,
    oublierErreur,
  };
}
