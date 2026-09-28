// /messages/nouveau?a=<id>&contexte=<texte> — ouvre la conversation directe
// avec quelqu'un (et prépare l'en-tête « À propos du devoir… »). Permet aux
// autres modules (devoir, leçon, dossier étudiant) d'offrir « Écrire au
// formateur » par un simple lien. Sans « a », ouvre le choix du contact.
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { MessageCircle } from "lucide-react";
import { post } from "@/lib/api";
import { Page } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { EtatVide } from "@/components/ui/divers";
import type { ConversationOuverte } from "@shared/schema";

export default function PageNouveauMessage() {
  const [, naviguer] = useLocation();
  const recherche = new URLSearchParams(useSearch());
  const destinataire = Number(recherche.get("a"));
  const contexte = recherche.get("contexte")?.slice(0, 200) || undefined;
  const [erreur, setErreur] = useState<string | null>(null);
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;
    if (!Number.isInteger(destinataire) || destinataire <= 0) {
      naviguer("/messages?nouveau=1", { replace: true });
      return;
    }
    post<ConversationOuverte>("/api/conversations/directe", { destinataireId: destinataire, contexte })
      .then((c) => naviguer(c.lien, { replace: true }))
      .catch((e: Error) => setErreur(e.message));
  }, [destinataire, contexte, naviguer]);

  if (erreur) {
    return (
      <Page>
        <EtatVide icone={<MessageCircle className="h-6 w-6" />} titre="Impossible d'ouvrir la conversation" texte={erreur} action={<LienBouton href="/messages">Revenir à mes messages</LienBouton>} />
      </Page>
    );
  }
  return (
    <div className="grid min-h-[50dvh] place-items-center" aria-busy="true">
      <p className="flex items-center gap-3 font-mono text-sm text-texte-gris">
        <span className="point-direct bg-orange" />
        Ouverture de la conversation…
      </p>
    </div>
  );
}
