// Écran de sortie du direct (chantier C6), après « Quitter » : la présence
// telle que le campus la compte (trois états, lue sur le serveur), le ressenti
// en un toucher, ce qui arrive ce soir et demain, les points gagnés et la
// proposition d'activer les rappels (emplacements de C5 et C3), et la
// consommation de données. Pendant cet écran, plus aucun battement de
// présence ne part : « Revenir dans la classe » relance le comptage.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Moon } from "lucide-react";
import { post } from "@/lib/api";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { toastErreur } from "@/components/ui/toast";
import { LimiteSilencieuse } from "@/components/ui/limite-silencieuse";
// Emplacements du plan d'engagement (campus/ENGAGEMENT.md) : vides tant que C5 et C3 ne sont pas fusionnés.
import { GainDuJour } from "@/modules/progression/GainDuJour";
import { ProposerRappel } from "@/modules/rappels/ProposerRappel";
import { CONSOMMATION, RESSENTIS_UI, formatMo } from "./outils";
import { t } from "@shared/textes/direct";
import type { MaPresenceDirectDto } from "@shared/engagement/direct";
import type { ModeSuivi, SeanceDetailDto } from "@shared/schema";

export function SortieDuLive({
  seance,
  mode,
  minutes,
  mo,
  mesure,
  enDirect,
  onRevenir,
}: {
  seance: SeanceDetailDto;
  mode: ModeSuivi;
  /** Minutes passées dans la classe depuis l'ouverture de la page. */
  minutes: number;
  mo: number;
  /** Consommation mesurée (visio ou radio) plutôt qu'estimée. */
  mesure: boolean;
  enDirect: boolean;
  onRevenir: () => void;
}) {
  const tx = useTextes(t);
  const { data: presence } = useQuery<MaPresenceDirectDto>({ queryKey: [`/api/seances/${seance.id}/ma-presence`], staleTime: 0 });
  const [ressenti, setRessenti] = useState<string | null>(null);
  const envoyer = async (valeur: string) => {
    try {
      await post(`/api/seances/${seance.id}/ressentis`, { ressenti: valeur });
      setRessenti(valeur);
    } catch (e) {
      toastErreur(e);
    }
  };
  const suivies = presence?.minutes ?? minutes;
  const ligne = presence?.enSalle
    ? tx("sortie.salle")
    : presence?.etat === "present"
      ? tx("sortie.suivi.present", { v: { minutes: suivies } })
      : tx("sortie.suivi", { v: { minutes: suivies } });
  const present = presence?.enSalle || presence?.etat === "present";
  return (
    <div className="grid min-h-[calc(100dvh-64px)] place-items-center bg-nuit px-4 pb-28 pt-6 text-white">
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <span className="etiquette text-orange-peche">{tx("sortie.etiquette")}</span>
        <p className={cn("flex items-center gap-2 text-[26px] font-black leading-tight tracking-serre", present && "text-[#6FCF97]")} role="status">
          {present && <CheckCircle2 className="h-7 w-7 shrink-0" />}
          {presence ? ligne : "…"}
        </p>

        {enDirect && (
          <div className="flex w-full flex-col gap-2">
            <p className="text-[15px] font-bold">{tx("sortie.ressenti")}</p>
            {ressenti ? (
              <p className="text-[14px] font-semibold text-[#6FCF97]">{tx("sortie.ressenti.merci")}</p>
            ) : (
              <div className="grid grid-cols-4 gap-2" role="group" aria-label={tx("sortie.ressenti")}>
                {RESSENTIS_UI.map((r) => (
                  <button
                    key={r.valeur}
                    onClick={() => void envoyer(r.valeur)}
                    className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] bg-nuit-carte px-1 text-[12.5px] font-bold leading-tight hover:bg-nuit-ligne"
                  >
                    <span aria-hidden className="text-lg">
                      {r.emoji}
                    </span>
                    {r.libelle}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex w-full flex-col gap-2 rounded-[20px] bg-nuit-panneau p-4 text-left text-[15px] leading-snug">
          <p className="flex items-start gap-2.5">
            <Moon className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
            {tx("sortie.suite")}
          </p>
        </div>

        <LimiteSilencieuse nom="GainDuJour">
          <GainDuJour moment="live" />
        </LimiteSilencieuse>
        <LimiteSilencieuse nom="ProposerRappel">
          <ProposerRappel moment="live" />
        </LimiteSilencieuse>

        <div className="flex flex-col gap-1">
          <p className="text-[17px] font-extrabold">{mo < 1 ? tx("sortie.cout.moins") : tx("sortie.cout", { v: { mo: `environ ${formatMo(mo)}` } })}</p>
          <p className="text-[13px] text-nuit-doux">
            {mesure ? tx("sortie.mesure", { v: { minutes } }) : tx("sortie.estimation", { v: { mode: CONSOMMATION[mode].titre, minutes } })}
            {mode === "radio" && ` ${tx("sortie.radio")}`}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Bouton variante="nuit" onClick={onRevenir}>
            {tx("sortie.revenir")}
          </Bouton>
          <LienBouton href="/direct">{tx("sortie.lives")}</LienBouton>
        </div>
      </div>
    </div>
  );
}
