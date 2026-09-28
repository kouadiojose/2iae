// Données des pages publiques : le contenu éditable du site, le direct, la
// vitrine (cours, formateurs, lives annoncés) et l'emploi du temps publié.
// Une seule requête par donnée pour toute la visite (TanStack Query) : le site
// reste léger en 3G, et le service worker garde la dernière version connue.
import { useQuery } from "@tanstack/react-query";
import type { Vitrine } from "@shared/api";
import type { EnDirectPublic, ProgrammePublicDto, SitePublicDto } from "@shared/schema";
import { SITE_DE_SECOURS } from "./outils";

/** Contenu du site public (textes, contacts, campus). null pendant le premier chargement. */
export function useSitePublic() {
  const q = useQuery<SitePublicDto>({ queryKey: ["/api/public/site"], staleTime: 60_000 });
  // Réseau coupé et rien en cache : les faits réels livrés avec le code.
  const site = q.data ?? (q.isError ? SITE_DE_SECOURS : null);
  return { site, chargement: q.isLoading };
}

/** Pour l'en-tête et le pied de page : jamais vide (faits réels en attendant la réponse). */
export function useSitePublicOuSecours(): SitePublicDto {
  return useSitePublic().site ?? SITE_DE_SECOURS;
}

/** Le cours public en direct, s'il y en a un (indicateur « EN DIRECT » de l'en-tête). */
export function useEnDirect() {
  const { data } = useQuery<EnDirectPublic>({ queryKey: ["/api/public/en-direct"], staleTime: 30_000, refetchInterval: 60_000 });
  return data?.live ?? null;
}

/** Cours, formateurs, lives et annonces publiés (lus aussi par 2iae.com). */
export function useVitrine() {
  return useQuery<Vitrine>({ queryKey: ["/api/public/vitrine"], staleTime: 60_000, refetchInterval: 120_000 });
}

/**
 * Emploi du temps publié (module « programme »). Tant qu'il n'existe pas, ou
 * si la route ne répond pas, les pages se replient sur les lives annoncés.
 */
export function useProgrammePublic() {
  return useQuery<ProgrammePublicDto>({ queryKey: ["/api/public/programme"], staleTime: 60_000, retry: false, refetchInterval: 5 * 60_000 });
}
