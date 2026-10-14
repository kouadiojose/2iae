import { QueryCache, QueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "./api";

/** Repère (sessionStorage) : la session de cet onglet vient d'être fermée ailleurs (nouveau code, « déconnecter partout »). */
export const CLE_SESSION_PERDUE = "campus:session-perdue";

let verificationEnCours = false;

/**
 * Une requête reçoit 401 alors que la personne se croit connectée : sa session a été fermée ailleurs (« Nouveau code »
 * de la direction pour le compte d'un campus, « Déconnecter partout », code changé, session expirée). On relit
 * /api/auth/moi (une fois à la fois) : s'il répond « personne », la Garde ouvre la connexion et revient ensuite à la page
 * où l'on était (l'écran d'un cours, pour l'ordinateur d'une salle) ; sinon (réponse en retard d'avant la connexion),
 * rien ne change. Sans cela, l'écran restait figé sur d'anciennes données, sans rien dire.
 */
function surErreurRequete(erreur: unknown, cle: readonly unknown[]) {
  if (!(erreur instanceof ErreurApi) || erreur.statut !== 401 || cle[0] === "/api/auth/moi") return;
  if (!queryClient.getQueryData(["/api/auth/moi"]) || verificationEnCours) return;
  verificationEnCours = true;
  try {
    sessionStorage.setItem(CLE_SESSION_PERDUE, String(Date.now()));
  } catch {
    /* navigateur sans stockage : pas de message, la connexion s'ouvre quand même */
  }
  void queryClient.invalidateQueries({ queryKey: ["/api/auth/moi"] }).finally(() => {
    verificationEnCours = false;
  });
}

// Clé de requête = URL de l'API : useQuery({ queryKey: ["/api/cours"] }) suffit.
export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e, q) => surErreurRequete(e, q.queryKey) }),
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
