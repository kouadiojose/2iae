// « Le travail du campus » côté client : lecture du fil des séances tenues et des grands chiffres
// (contrat : shared/engagement/fil.ts). Le même fil sert au formateur (ses cours) et à la direction
// (tous les cours, filtres par campus, cours et formateur) : le serveur choisit le périmètre.
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FilSeances, ResumeTravail } from "@shared/engagement/fil";

export type FiltresFil = { cours?: string; formateur?: string; site?: string };

/** Adresse du fil : seuls les filtres choisis partent (?cours=&formateur=&site=&avant=&limite=). */
export function adresseFil(filtres: FiltresFil, limite: number, avant?: string | null): string {
  const p = new URLSearchParams();
  for (const cle of ["cours", "formateur", "site"] as const) if (filtres[cle]) p.set(cle, filtres[cle]!);
  if (avant) p.set("avant", avant);
  p.set("limite", String(limite));
  return `/api/fil/seances?${p.toString()}`;
}

/** Les dernières séances, sans pagination (accueil du formateur). */
export function useDernieresSeances(limite = 5) {
  return useQuery<FilSeances>({ queryKey: [adresseFil({}, limite)], staleTime: 60_000, retry: 1 });
}

/** Le fil complet, page par page (« Voir plus » : curseur `suivant`, la date réelle de la dernière séance). */
export function useFilSeances(filtres: FiltresFil, limite = 10) {
  return useInfiniteQuery({
    // Clé = adresse de la première page : rafraichir("/api/fil") la retrouve comme les autres requêtes.
    queryKey: [adresseFil(filtres, limite)],
    queryFn: ({ pageParam }) => api<FilSeances>(adresseFil(filtres, limite, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (derniere: FilSeances) => derniere.suivant,
    staleTime: 60_000,
    retry: 1,
  });
}

/** Les grands chiffres de la période (7 ou 30 jours), pour tout le groupe ou un campus. */
export function useResumeTravail(jours: number, site?: string) {
  const p = new URLSearchParams({ jours: String(jours) });
  if (site) p.set("site", site);
  return useQuery<ResumeTravail>({ queryKey: [`/api/fil/resume?${p.toString()}`], staleTime: 2 * 60_000, retry: 1, placeholderData: (avant) => avant });
}
