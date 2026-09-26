// Réglages de la visio lus par les autres modules (fournisseur par défaut,
// vidéo étudiante par défaut, Daily configuré ou non).
import { useQuery } from "@tanstack/react-query";
import type { OptionsVisio } from "@shared/schema";

export function useOptionsVisio() {
  return useQuery<OptionsVisio>({ queryKey: ["/api/visio/options"], staleTime: 5 * 60_000 }).data;
}
