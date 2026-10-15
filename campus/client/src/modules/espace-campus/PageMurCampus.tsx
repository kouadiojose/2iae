// /mon-campus/cours/:coursId/mur — le mur du cours en grand pour les salles du campus (lecture seule : ni écriture, ni
// suppression). La direction l'ouvre avec ?site= (bandeau « Aperçu »). En-tête : BandeauCours, comme le mur chez le
// professeur (dégradé doux de la couleur du cours, nom du cours en Plex Mono, « Le mur du cours » en grand).
import { useQuery } from "@tanstack/react-query";
import { useTextes } from "@/lib/textes";
import { BandeauCours } from "@/components/ui/gros-blocs";
import { MurDuCours, urlMur } from "@/modules/mur/MurDuCours";
import { t as textesCampus } from "@shared/textes/campus";
import type { MurDto } from "@shared/mur";
import { BoutonRetour, EnTeteCampus, PageCampus, lienCampus, siteApercu } from "./composants";

export default function PageMurCampus({ coursId }: { coursId: string }) {
  const tx = useTextes(textesCampus);
  const id = Number(coursId);
  const { data } = useQuery<MurDto>({ queryKey: [urlMur(id, "campus")], staleTime: 10_000 });
  return (
    <PageCampus className="bg-white">
      <EnTeteCampus apercu={Boolean(siteApercu())} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-5 sm:px-8 sm:pt-8">
        <div>
          <BoutonRetour href={lienCampus(`/mon-campus/cours/${id}`)} libelle={tx("mur.retour")} />
        </div>
        {/* Même en-tête que le mur chez le professeur (BandeauCours) : la même identité partout. */}
        {data && <BandeauCours couleur={data.cours.couleur} etiquette={data.cours.titre} titre={tx("bloc.mur")} />}
        <MurDuCours coursId={id} variante="campus" />
      </main>
    </PageCampus>
  );
}
