// /mon-campus/cours/:coursId/mur — le mur du cours en grand pour les salles du campus (lecture seule : ni écriture, ni
// suppression). La direction l'ouvre avec ?site= (bandeau « Aperçu »).
import { useQuery } from "@tanstack/react-query";
import { MurDuCours, urlMur } from "@/modules/mur/MurDuCours";
import type { MurDto } from "@shared/mur";
import { BoutonRetour, EnTeteCampus, PageCampus, lienCampus, siteApercu, styleCouleur } from "./composants";

export default function PageMurCampus({ coursId }: { coursId: string }) {
  const id = Number(coursId);
  const { data } = useQuery<MurDto>({ queryKey: [urlMur(id, "campus")], staleTime: 10_000 });
  return (
    <PageCampus>
      <EnTeteCampus apercu={Boolean(siteApercu())} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-5 sm:px-8 sm:pt-8">
        <div>
          <BoutonRetour href={lienCampus(`/mon-campus/cours/${id}`)} libelle="Retour au cours" />
        </div>
        {data && (
          <div className="rounded-[24px] px-6 py-6 sm:px-8" style={styleCouleur(data.cours.couleur)}>
            <p className="text-[20px] font-bold">{data.cours.titre}</p>
            <h1 className="text-[40px] font-black leading-[1.05]">Le mur du cours</h1>
          </div>
        )}
        <MurDuCours coursId={id} variante="campus" />
      </main>
    </PageCampus>
  );
}
