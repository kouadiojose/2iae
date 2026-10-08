// Données du module progression (chantier C5) : une seule requête pour la
// pastille de l'accueil, le gain du jour et « Ma progression » (même clé, donc
// servie par le cache), et quelques aides d'affichage communes.
import { useQuery } from "@tanstack/react-query";
import { useMoi } from "@/lib/auth";
import type { ProgressionMoi } from "@shared/engagement/progression";
import type { t as textes } from "@shared/textes/progression";

export const CLE_PROGRESSION = "/api/progression/moi";

/** Progression de l'étudiant connecté (rien pour les autres comptes). */
export function useProgression(options: { toujours?: boolean } = {}) {
  const { moi } = useMoi();
  return useQuery<ProgressionMoi>({
    queryKey: [CLE_PROGRESSION],
    enabled: moi?.role === "etudiant",
    staleTime: 60_000,
    // Après un acte (sortie du direct, révision), le gain doit se voir tout de suite.
    refetchOnMount: options.toujours ? "always" : true,
  });
}

/** « 1er », « 2e », « 3e »… */
export const rangTexte = (tx: typeof textes, rang: number) => (rang === 1 ? tx("rang.1") : tx("rang.n", { v: { n: rang } }));
