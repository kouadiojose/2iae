// Mise en page commune des pages publiques du campus : en-tête avec la
// navigation du site, contenu, pied de page. Toute page publique (accueil,
// programme, cours, formateurs, campus…) s'enveloppe dedans.
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SitePublic } from "@shared/schema";
import { EnTetePublic, PiedPublic } from "./composants";

export function MiseEnPagePublique({ children, sansAppel = false }: { children: ReactNode; sansAppel?: boolean }) {
  const { data: sites = [] } = useQuery<SitePublic[]>({ queryKey: ["/api/public/sites"], staleTime: 10 * 60_000 });
  return (
    <div className="flex min-h-screen flex-col bg-white text-encre">
      <EnTetePublic />
      <main className="flex-1">{children}</main>
      <PiedPublic sites={sites} sansAppel={sansAppel} />
    </div>
  );
}
