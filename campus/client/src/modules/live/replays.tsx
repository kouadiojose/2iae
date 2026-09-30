// Enregistrements (replays vidéo) de tous les cours, pour les formateurs :
// une ligne par séance, partagée par la page « Enregistrements » et le
// tableau de bord du formateur. Le « Nouveau » s'efface quand il ouvre le replay.
import { useQuery } from "@tanstack/react-query";
import { PlayCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateCourte, heure, jourLong } from "@/lib/dates";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { CarteLien } from "@/components/ui/carte";
import { Badge } from "@/components/ui/divers";
import type { ReplayResumeDto, ReplaysDto } from "@shared/schema";

export const CLE_REPLAYS = "/api/replays";

/** La liste, relue dès qu'une notification arrive (un replay vient d'être prêt). */
export function useReplays() {
  const requete = useQuery<ReplaysDto>({ queryKey: [CLE_REPLAYS], refetchInterval: 5 * 60_000 });
  useTousEvenements((e) => {
    if (e.type === "notification") void rafraichir(CLE_REPLAYS);
  });
  return requete;
}

/** « 1 h 45 », « 52 min ». */
export function dureeLisible(secondes: number | null): string | null {
  if (!secondes) return null;
  const minutes = Math.max(1, Math.round(secondes / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function LigneReplay({ replay, compacte }: { replay: ReplayResumeDto; compacte?: boolean }) {
  const duree = dureeLisible(replay.dureeSecondes);
  const quand = compacte ? dateCourte(replay.debut) : `${jourLong(replay.debut)} · ${heure(replay.debut)}`;
  return (
    <CarteLien href={`/replays/${replay.seanceId}`} className={cn("flex items-center gap-3.5", compacte ? "px-4 py-3" : "px-4 py-3.5 sm:px-5")}>
      <span className={cn("grid shrink-0 place-items-center rounded-full", compacte ? "h-10 w-10" : "h-12 w-12", replay.nouveau ? "bg-orange text-encre" : "bg-creme text-orange-fonce")}>
        <PlayCircle className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("min-w-0 font-extrabold leading-snug", compacte ? "text-[15px]" : "text-[17px]")}>{replay.titre}</span>
          {replay.nouveau && <Badge ton="orange">Nouveau</Badge>}
          {replay.mien && !compacte && <Badge ton="gris">Mon cours</Badge>}
        </span>
        <span className="truncate text-sm text-texte-pale">
          {replay.coursCode}
          {!compacte && ` · ${replay.coursTitre}`}
          {replay.formateur ? ` · ${replay.formateur}` : ""}
        </span>
        <span className="font-mono text-xs text-texte-gris">
          {quand}
          {duree ? ` · ${duree}` : ""}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
    </CarteLien>
  );
}
