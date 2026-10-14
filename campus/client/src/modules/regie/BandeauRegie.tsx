// Repère de régie dans le Studio : la personne anime le cours d'un autre (Chargé de cours, direction). Le même
// Studio que le formateur ; le formateur, s'il est là, garde toute la main et les deux peuvent agir (pour la diapo,
// la projection et la parole, le dernier geste l'emporte). Micro et caméra coupés en entrant.
import { Presentation } from "lucide-react";
import type { SeanceDetailDto } from "@shared/schema";
import { t as textesRegie } from "@shared/textes/regie";
import { LienBouton } from "@/components/ui/bouton";
import { useMoi } from "@/lib/auth";
import { useTextes } from "@/lib/textes";
import { estProfilRegie } from "@shared/schema";
import { BoutonLienIntervenant } from "./LienIntervenant";

export function BandeauRegie({ seance }: { seance: Pick<SeanceDetailDto, "id" | "formateur"> }) {
  const tx = useTextes(textesRegie);
  const { moi } = useMoi();
  const formateur = seance.formateur ? `${seance.formateur.prenom} ${seance.formateur.nom}`.trim() : null;
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-orange/50 bg-nuit-carte p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4" aria-label={tx("studio.regie.sansFormateur")} data-bandeau-regie>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange text-encre" aria-hidden>
          <Presentation className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[16px] font-extrabold leading-snug text-white">{formateur ? tx("studio.regie", { v: { formateur } }) : tx("studio.regie.sansFormateur")}</p>
          <p className="text-[14px] leading-snug text-nuit-doux">{tx("studio.regie.aide")}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <BoutonLienIntervenant seanceId={seance.id} variante="nuit-actif" taille="sm" className="min-h-[44px] sm:text-[15px]" />
        {estProfilRegie(moi) && (
          <LienBouton href="/regie" variante="nuit" taille="sm" className="min-h-[44px] border border-nuit-bord sm:text-[15px]">
            {tx("retour.espace")}
          </LienBouton>
        )}
      </div>
    </section>
  );
}
