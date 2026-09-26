// Mise en page commune des pages publiques du campus : lien d'évitement,
// en-tête avec la navigation du site, contenu, pied de page. Toute page
// publique (accueil, programme, cours, formateurs, campus…) s'enveloppe dedans.
import type { ReactNode } from "react";
import { EnTetePublic, PiedPublic } from "./navigation-publique";

export function MiseEnPagePublique({ children, sansAppel = false }: { children: ReactNode; sansAppel?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-encre">
      <a
        href="#contenu"
        className="sr-only z-50 rounded-xl bg-encre px-4 py-3 font-bold text-white no-underline focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Aller au contenu
      </a>
      <EnTetePublic />
      <main id="contenu" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <PiedPublic sansAppel={sansAppel} />
    </div>
  );
}
