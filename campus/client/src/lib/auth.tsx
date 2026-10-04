// Utilisateur connecté, disponible partout via useMoi().
import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ErreurApi, post } from "./api";
import { queryClient } from "./queryClient";
import { peut, type Droit, type Moi, type Role } from "@shared/schema";

type ContexteAuth = { moi: Moi | null; chargement: boolean };
const Contexte = createContext<ContexteAuth>({ moi: null, chargement: true });

export function FournisseurAuth({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<Moi | null>({
    queryKey: ["/api/auth/moi"],
    queryFn: async () => {
      try {
        return await api<Moi>("/api/auth/moi");
      } catch (e) {
        if (e instanceof ErreurApi && e.statut === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
  return <Contexte.Provider value={{ moi: data ?? null, chargement: isLoading }}>{children}</Contexte.Provider>;
}

/** Utilisateur connecté (null si déconnecté). */
export function useMoi() {
  return useContext(Contexte);
}

/** Utilisateur connecté, garanti (à utiliser dans les pages protégées). */
export function useMoiConnecte(): Moi {
  const { moi } = useContext(Contexte);
  if (!moi) throw new Error("useMoiConnecte() hors d'une page protégée");
  return moi;
}

export async function seConnecter(identifiant: string, motDePasse: string): Promise<Moi> {
  const m = await post<Moi>("/api/auth/connexion", { identifiant, motDePasse });
  queryClient.setQueryData(["/api/auth/moi"], m);
  return m;
}

export async function seDeconnecter() {
  await post("/api/auth/deconnexion").catch(() => undefined);
  queryClient.clear();
  window.location.href = "/connexion";
}

/** Double casquette : passer sur l'autre compte de la personne, puis repartir de son accueil. */
export async function basculerCasquette() {
  const m = await post<Moi>("/api/auth/casquette");
  queryClient.clear();
  window.location.assign(accueilDuRole(m.role));
}

export function rechargerMoi() {
  return queryClient.invalidateQueries({ queryKey: ["/api/auth/moi"] });
}

export const estEquipe = (r: Role | undefined) => r === "admin" || r === "vie_scolaire";

/**
 * Le profil de la personne permet-il cela ? (shared/schema/ext-profils.ts)
 * Ne concerne que l'équipe : la direction a tout ; un formateur ou un
 * étudiant reste soumis aux seules règles de son rôle (réponse « oui » ici).
 * Sert aux menus et aux boutons : le serveur reste la vraie barrière.
 */
export function profilPermet(moi: Pick<Moi, "role" | "profil"> | null | undefined, droit?: Droit | readonly Droit[]): boolean {
  if (!droit) return true;
  if (!moi) return false;
  if (moi.role !== "vie_scolaire") return true;
  return (typeof droit === "string" ? [droit] : droit).some((d) => peut(moi, d));
}

/** Page d'arrivée de chaque rôle après connexion. */
export function accueilDuRole(r: Role): string {
  switch (r) {
    case "formateur":
      return "/enseigner";
    case "admin":
    case "vie_scolaire":
      return "/pilotage";
    case "salle":
      return "/salle";
    default:
      return "/accueil";
  }
}
