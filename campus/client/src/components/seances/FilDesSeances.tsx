// Le fil des séances tenues en cartes (CarteSeance), la plus récente d'abord, avec « Voir plus » :
// « Mes séances » du formateur (/mes-seances) et « Le travail du campus » de la direction (/pilotage/travail).
import type { ReactNode } from "react";
import { CalendarCheck } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { EtatVide, Erreur, Squelette } from "@/components/ui/divers";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/travail";
import { CarteSeance } from "./CarteSeance";
import { useFilSeances, type FiltresFil } from "./fil";

export function FilDesSeances({ filtres, avecFormateur = false, vide }: { filtres: FiltresFil; avecFormateur?: boolean; vide?: ReactNode }) {
  const tx = useTextes(t);
  const q = useFilSeances(filtres);

  if (q.isLoading) return <SquelettesSeances />;
  if (q.error && !q.data) return <Erreur message={tx("seances.erreur")} reessayer={() => void q.refetch()} />;
  const seances = q.data?.pages.flatMap((p) => p.seances) ?? [];
  if (!seances.length) return <>{vide ?? <EtatVide icone={<CalendarCheck className="h-6 w-6" />} titre={tx("seances.vide.titre")} texte={tx("seances.vide.texte")} />}</>;

  return (
    <div className="flex flex-col gap-5">
      <ul className="grid gap-4 lg:grid-cols-2">
        {seances.map((s) => (
          <li key={s.id} className="min-w-0">
            <CarteSeance seance={s} avecFormateur={avecFormateur} className="h-full" />
          </li>
        ))}
      </ul>
      {q.hasNextPage ? (
        <Bouton variante="contour" taille="lg" onClick={() => void q.fetchNextPage()} chargement={q.isFetchingNextPage} className="min-h-[56px] w-full text-[17px] sm:w-auto sm:self-center sm:px-10">
          {tx("seances.plus")}
        </Bouton>
      ) : (
        seances.length > 3 && <p className="text-center text-[15px] text-texte-pale">{tx("seances.fin")}</p>
      )}
    </div>
  );
}

export function SquelettesSeances({ nombre = 2 }: { nombre?: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: nombre }, (_, i) => (
        <Squelette key={i} className="h-[300px] rounded-[22px] sm:h-[230px]" />
      ))}
    </div>
  );
}
