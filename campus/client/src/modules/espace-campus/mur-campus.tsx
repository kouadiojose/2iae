// Le mur du cours dans l'espace du campus (José, 15 octobre 2026) : un gros bloc de lecture sur la page du cours
// (« Le mur du cours · 2 messages · dernier il y a 2 heures »), dans la teinte douce du cours comme les autres blocs
// « À lire », et sa page en grand, sans écrire ni supprimer.
// Lu par GET /api/mon-campus/cours/:id/mur (routes/mur.ts ; le filtre du compte de campus laisse /api/mon-campus).
import { Newspaper } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { relatif } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { teinteDouce } from "@/modules/cours/outils";
import { urlMur } from "@/modules/mur/MurDuCours";
import { t as textesCampus } from "@shared/textes/campus";
import type { MurDto } from "@shared/mur";
import { GrosBloc, lienCampus } from "./composants";

export function BlocMurCampus({ coursId, couleur }: { coursId: number; couleur: string }) {
  const tx = useTextes(textesCampus);
  const { data } = useQuery<MurDto>({ queryKey: [urlMur(coursId, "campus")], staleTime: 30_000, refetchInterval: 60_000 });
  const n = data?.total ?? 0;
  const compte = n === 0 ? tx("compteur.mur.zero") : n === 1 ? tx("compteur.mur.un") : tx("compteur.mur", { v: { n } });
  const sousTitre = data?.dernierLe ? tx("compteur.mur.dernier", { v: { compte, quand: relatif(data.dernierLe) } }) : compte;
  return (
    <GrosBloc
      testId="mur"
      ton="teinte"
      fond={teinteDouce(couleur)}
      cercle={{ fond: "#F3EEFC", couleur: "#5B3A9E" }}
      icone={<Newspaper className="h-8 w-8" strokeWidth={2.25} />}
      titre={tx("bloc.mur")}
      sousTitre={<span className="text-texte-doux">{sousTitre}</span>}
      href={lienCampus(`/mon-campus/cours/${coursId}/mur`)}
    />
  );
}
