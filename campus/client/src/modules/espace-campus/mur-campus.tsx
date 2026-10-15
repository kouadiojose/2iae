// Le mur du cours dans l'espace du campus (José, 15 octobre 2026) : un gros bloc de lecture sur la page du cours
// (« Le mur du cours · 2 messages · dernier il y a 2 heures »), et sa page en grand, sans écrire ni supprimer.
// Lu par GET /api/mon-campus/cours/:id/mur (routes/mur.ts ; le filtre du compte de campus laisse /api/mon-campus).
import { Newspaper } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { relatif } from "@/lib/dates";
import { urlMur } from "@/modules/mur/MurDuCours";
import type { MurDto } from "@shared/mur";
import { GrosBloc, lienCampus } from "./composants";

export function BlocMurCampus({ coursId }: { coursId: number }) {
  const { data } = useQuery<MurDto>({ queryKey: [urlMur(coursId, "campus")], staleTime: 30_000, refetchInterval: 60_000 });
  const n = data?.total ?? 0;
  const compte = n === 0 ? "Rien pour l'instant" : n === 1 ? "1 message" : `${n} messages`;
  const sousTitre = data?.dernierLe ? `${compte} · dernier ${relatif(data.dernierLe)}` : compte;
  return <GrosBloc testId="mur" icone={<Newspaper className="h-12 w-12" />} titre="Le mur du cours" sousTitre={sousTitre} href={lienCampus(`/mon-campus/cours/${coursId}/mur`)} />;
}
