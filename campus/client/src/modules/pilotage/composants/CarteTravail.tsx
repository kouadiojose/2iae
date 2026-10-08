// Grande carte en tête de /pilotage : l'entrée de « Le travail du campus » (/pilotage/travail), avec les
// chiffres de la semaine quand ils sont là. Toute la carte est un bouton : on ne cherche pas où toucher.
import { Link } from "wouter";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { useResumeTravail } from "@/components/seances/fil";
import { useTextes } from "@/lib/textes";
import { selonNombre, t } from "@shared/textes/travail";

export function CarteTravail() {
  const tx = useTextes(t);
  const { data: r } = useResumeTravail(7);
  return (
    <Link
      href="/pilotage/travail"
      className="group flex flex-col gap-4 rounded-[24px] bg-encre p-5 text-white no-underline transition-colors hover:bg-[#262321] hover:text-white sm:flex-row sm:items-center sm:gap-6 sm:p-7"
    >
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-orange text-encre" aria-hidden>
        <ClipboardCheck className="h-8 w-8" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[24px] font-black leading-tight sm:text-[28px]">{tx("tableau.carte.titre")}</span>
        <span className="text-[16px] leading-snug text-nuit-doux">{tx("tableau.carte.texte")}</span>
        {r && (
          <span className="text-[15px] font-bold leading-snug text-orange-peche">
            {tx("tableau.carte.semaine", {
              v: {
                seances: selonNombre(tx, "tableau.carte.seances", r.seancesTenues),
                resumes: selonNombre(tx, "tableau.carte.resumes", r.coursResumes),
                notees: selonNombre(tx, "tableau.carte.notees", r.copiesNotees),
              },
            })}
          </span>
        )}
      </span>
      <span className="inline-flex min-h-[56px] shrink-0 items-center justify-center gap-2 rounded-[14px] bg-orange px-6 text-[17px] font-bold text-encre transition-colors group-hover:bg-white">
        {tx("tableau.carte.bouton")} <ArrowRight className="h-5 w-5" aria-hidden />
      </span>
    </Link>
  );
}
