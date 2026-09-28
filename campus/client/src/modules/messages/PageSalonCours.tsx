// /messages/cours/:coursId — ouvre (ou crée) le salon « Questions du cours »
// puis emmène dans le fil. Lien stable pour la page du cours (CONCEPTION §5).
import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { EtatVide } from "@/components/ui/divers";
import type { ConversationOuverte } from "@shared/schema";

export default function PageSalonCours({ coursId }: { coursId: string }) {
  const [, naviguer] = useLocation();
  const recherche = useSearch();
  const { data, error } = useQuery<ConversationOuverte>({ queryKey: [`/api/conversations/cours/${coursId}`], staleTime: Infinity, retry: false });

  useEffect(() => {
    if (data) naviguer(`${data.lien}${recherche ? `?${recherche}` : ""}`, { replace: true });
  }, [data, recherche, naviguer]);

  if (error) {
    return (
      <Page>
        <EtatVide
          icone={<UsersRound className="h-6 w-6" />}
          titre="Salon inaccessible"
          texte={(error as Error).message}
          action={<LienBouton href="/messages">Revenir à mes messages</LienBouton>}
        />
      </Page>
    );
  }
  return (
    <div className="grid min-h-[50dvh] place-items-center" aria-busy="true">
      <p className="flex items-center gap-3 font-mono text-sm text-texte-gris">
        <span className="point-direct bg-orange" />
        Ouverture du salon du cours…
      </p>
    </div>
  );
}
