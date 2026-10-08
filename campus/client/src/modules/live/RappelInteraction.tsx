// Studio (chantier C6) : après 15 min de direct sans sondage ni question, un
// rappel discret propose de lancer une question de rappel. Le minuteur suit
// l'heure du serveur (silenceDuDirect, partagé et vérifié avec une horloge
// simulée) ; « Plus tard » le remet à zéro. Rien n'est lancé tout seul.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { maintenantServeur } from "@/lib/horloge";
import { t } from "@shared/textes/direct";
import { silenceDuDirect } from "@shared/engagement/direct";
import type { EtatDirectDto, SondageDto } from "@shared/schema";

export function RappelInteraction({ seanceId, etat, masque, onVoir }: { seanceId: number; etat: EtatDirectDto; masque?: boolean; onVoir: () => void }) {
  const tx = useTextes(t);
  // Même liste (et même cache) que l'onglet Sondages du Studio.
  const { data: sondages } = useQuery<SondageDto[]>({ queryKey: [`/api/seances/${seanceId}/sondages`], staleTime: 60_000, enabled: etat.statut === "en_direct" });
  const maintenant = useMaintenant(15_000);
  const [reporteLe, setReporteLe] = useState<number | null>(null);
  if (etat.statut !== "en_direct") return null;
  const minutes = silenceDuDirect({
    maintenant,
    demarreeLe: etat.demarreeLe ? new Date(etat.demarreeLe).getTime() : null,
    sondages: [...(sondages ?? []), ...(etat.sondage ? [etat.sondage] : [])],
    questions: etat.questions,
    reporteLe,
  });
  // Onglet Sondages déjà ouvert : les questions de rappel sont sous les yeux du formateur.
  if (minutes === null || masque) return null;
  return (
    <div className="flex flex-col gap-2 border-b border-nuit-ligne bg-nuit-bulle px-3.5 py-3" role="status">
      <p className="flex items-start gap-2 text-[13.5px] font-semibold leading-snug text-orange-peche">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /> {tx("interaction.silence", { v: { n: minutes } })}
      </p>
      <div className="flex gap-2">
        <button onClick={onVoir} className="min-h-11 rounded-xl bg-orange px-3 text-[13px] font-bold text-encre hover:bg-orange-peche">
          {tx("interaction.voir")}
        </button>
        <button onClick={() => setReporteLe(maintenantServeur())} className="min-h-11 rounded-xl px-3 text-[13px] font-bold text-nuit-doux hover:text-white">
          {tx("interaction.plusTard")}
        </button>
      </div>
    </div>
  );
}
