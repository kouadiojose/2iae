// Bandeau orange de l'accueil (maquette) : « Dans 2 j 4 h · Initiation à
// l'IA · Salle Kédjénou, campus Yopougon · ou en ligne » avec « Entrer dans
// la classe » et « Ajouter à l'agenda ». En direct, il devient noir et pulse.
import { useQuery } from "@tanstack/react-query";
import { useMoi } from "@/lib/auth";
import { LienBouton } from "@/components/ui/bouton";
import { DecompteCourt } from "@/components/ui/compte-a-rebours";
import { LienAgenda } from "./ui";
import type { EnCours } from "@shared/api";

export function BandeauProchainLive() {
  const { moi } = useMoi();
  const { data } = useQuery<EnCours>({ queryKey: ["/api/live/en-cours"], refetchInterval: 60_000, staleTime: 20_000, enabled: Boolean(moi) });
  if (!data || (!data.enDirect && !data.prochaine)) return null;
  const lieu = moi?.site ? `${moi.site.salleConference}, campus ${moi.site.nomCourt} · ou en ligne` : "En ligne, depuis ton téléphone ou ton ordinateur";

  if (data.enDirect) {
    const s = data.enDirect;
    return (
      <div className="flex flex-wrap items-center justify-between gap-5 rounded-[24px] bg-encre px-6 py-6 text-white sm:px-7">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-[#FF8A6B]">
            <span className="point-direct" /> En direct maintenant
          </span>
          <span className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[26px]">{s.titre}</span>
          <span className="text-[15px] text-nuit-doux">{lieu}</span>
        </div>
        <LienBouton href={`/live/${s.id}`} taille="lg">
          Entrer dans la classe
        </LienBouton>
      </div>
    );
  }
  const s = data.prochaine!;
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 rounded-[24px] bg-orange px-6 py-6 sm:px-7">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="font-mono text-xs uppercase tracking-[0.08em] text-encre">
          Dans <DecompteCourt cible={s.debut} />
        </span>
        <span className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-encre sm:text-[26px]">{s.titre}</span>
        <span className="text-[15px] text-[#2B211B]">{lieu}</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <LienBouton href={`/live/${s.id}`} variante="encre" className="min-h-12 px-[22px] text-[15px]">
          Entrer dans la classe
        </LienBouton>
        <LienAgenda seanceId={s.id} className="min-h-12 rounded-xl border-[1.5px] border-encre px-[22px] text-[15px] text-encre hover:bg-encre hover:text-white" />
      </div>
    </div>
  );
}
