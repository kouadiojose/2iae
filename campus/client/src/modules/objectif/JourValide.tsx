// « Jour validé ! » : les lignes de l'objectif du jour sont toutes faites
// (chantier C2). Les points gagnés viennent de l'emplacement GainDuJour,
// rempli par C5 (rien tant qu'il n'est pas là), sous une LimiteSilencieuse.
import { PartyPopper } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { LimiteSilencieuse } from "@/components/ui/limite-silencieuse";
import { GainDuJour } from "@/modules/progression/GainDuJour";
import { t } from "@shared/textes/objectif";

export function JourValide() {
  const tx = useTextes(t);
  return (
    <div className="flex flex-col gap-3" role="status">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-orange text-encre">
          <PartyPopper className="h-6 w-6" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 id="titre-objectif" className="text-[26px] font-black leading-tight tracking-serre">{tx("valide.titre")}</h2>
          <p className="text-[15px] leading-snug text-nuit-doux">{tx("valide.texte")}</p>
        </div>
      </div>
      <LimiteSilencieuse nom="GainDuJour">
        <GainDuJour moment="objectif" />
      </LimiteSilencieuse>
    </div>
  );
}
