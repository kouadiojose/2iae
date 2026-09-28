import { QueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "./api";

// Clé de requête = URL de l'API : useQuery({ queryKey: ["/api/cours"] }) suffit.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => api(queryKey.filter((k) => typeof k === "string" || typeof k === "number").join("/")),
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: (n, e) => !(e instanceof ErreurApi && e.statut >= 400 && e.statut < 500) && n < 2,
    },
    mutations: { retry: false },
  },
});

/** Rafraîchit toutes les requêtes dont la clé commence par ce préfixe d'URL. */
export function rafraichir(...prefixes: string[]) {
  return Promise.all(
    prefixes.map((p) =>
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(p) }),
    ),
  );
}
