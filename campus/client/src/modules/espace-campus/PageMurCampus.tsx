// /mon-campus/cours/:coursId/mur — le mur du cours en grand pour les salles du campus (lecture seule : ni écriture, ni
// suppression). La direction l'ouvre avec ?site= (bandeau « Aperçu »). En-tête : le héros du cours (dégradé doux de sa
// couleur, comme la page du cours).
import { useQuery } from "@tanstack/react-query";
import { useTextes } from "@/lib/textes";
import { Bulles } from "@/components/ui/gros-blocs";
import { degradeCours } from "@/modules/cours/outils";
import { MurDuCours, urlMur } from "@/modules/mur/MurDuCours";
import { t as textesCampus } from "@shared/textes/campus";
import type { MurDto } from "@shared/mur";
import { BoutonRetour, EnTeteCampus, PageCampus, lienCampus, siteApercu } from "./composants";

export default function PageMurCampus({ coursId }: { coursId: string }) {
  const tx = useTextes(textesCampus);
  const id = Number(coursId);
  const { data } = useQuery<MurDto>({ queryKey: [urlMur(id, "campus")], staleTime: 10_000 });
  const d = data ? degradeCours(data.cours.couleur) : null;
  return (
    <PageCampus className="bg-white">
      <EnTeteCampus apercu={Boolean(siteApercu())} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-5 sm:px-8 sm:pt-8">
        <div>
          <BoutonRetour href={lienCampus(`/mon-campus/cours/${id}`)} libelle={tx("mur.retour")} />
        </div>
        {data && d && (
          <section className="relative isolate flex flex-col gap-1 overflow-hidden rounded-[32px] px-7 py-6 shadow-carte sm:px-9" style={{ background: d.css, color: d.texte }} data-degrade={`${d.fond},${d.a}`} data-heros>
            <Bulles voile={d.voile} />
            <p className="text-[20px] font-bold">{data.cours.titre}</p>
            <h1 className="text-[40px] leading-[1.05]" style={{ color: d.texte }}>
              {tx("bloc.mur")}
            </h1>
          </section>
        )}
        <MurDuCours coursId={id} variante="campus" />
      </main>
    </PageCampus>
  );
}
