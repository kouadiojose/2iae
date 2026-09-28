// Carte « Rentrée : 7 sur 9 prêts » du tableau de pilotage, tant que la
// liste de contrôle n'est pas entièrement verte. Même requête que la page
// Rentrée (le cache est partagé).
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleDashed, TriangleAlert } from "lucide-react";
import type { EtatRentree } from "@shared/lancement";
import { LienBouton } from "@/components/ui/bouton";
import { BarreProgression } from "@/components/ui/divers";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { cn } from "@/lib/utils";
import { dans } from "../outils";

export function CarteRentree() {
  const { data: e } = useQuery<EtatRentree>({ queryKey: ["/api/pilotage/rentree"], refetchInterval: 120_000 });
  const maintenant = useMaintenant(60_000);
  if (!e || e.prets === e.total) return null;
  const restants = e.lignes.filter((l) => l.etat !== "fait");
  return (
    <section aria-label="Rentrée" className="flex flex-col gap-4 rounded-[24px] border border-orange/40 bg-orange-pale p-5 sm:p-6 lg:flex-row lg:items-center lg:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="font-mono text-xs uppercase tracking-wider text-orange-profond">
          {e.cible.passee ? "Session lancée" : `Premier cours ${dans(e.cible.le, maintenant)}`}
        </span>
        <h2 className="text-2xl font-black leading-tight tracking-serre">
          Rentrée : {e.prets} sur {e.total} {e.prets > 1 ? "prêts" : "prêt"}
        </h2>
        <BarreProgression valeur={(e.prets / Math.max(1, e.total)) * 100} className="h-2 bg-white" />
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[15px]">
          {restants.slice(0, 4).map((l) => {
            const I = l.etat === "a_faire" ? CircleDashed : TriangleAlert;
            return (
              <li key={l.cle} className={cn("flex items-center gap-1.5 font-semibold", l.etat === "a_faire" ? "text-danger" : "text-alerte")}>
                <I className="h-4 w-4 shrink-0" aria-hidden />
                {l.titre}
              </li>
            );
          })}
          {restants.length > 4 && <li className="text-texte-pale">et {restants.length - 4} autre{restants.length - 4 > 1 ? "s" : ""}</li>}
        </ul>
      </div>
      <LienBouton href="/pilotage/rentree" taille="lg" icone={<ArrowRight className="h-5 w-5" />} className="min-h-[52px] shrink-0">
        Voir la liste
      </LienBouton>
    </section>
  );
}
