// /mon-campus/cours/:coursId/resumes : « Les résumés de cours ». Une grosse ligne par cours complet prêt (tiré de
// l'enregistrement : fiche, exercices, quiz) ; un toucher l'ouvre dans l'espace du campus (PageResumeCampus).
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { CercleIcone } from "@/components/ui/gros-blocs";
import { t as textesCampus } from "@shared/textes/campus";
import type { CoursCompletARevise } from "@shared/engagement/revision";
import type { CoursCampusDto } from "@shared/espace-campus";
import { jourEnLettres } from "@shared/espace-campus";
import { BoutonRetour, ErreurCampus, PageCampus, Patience, lienCampus, useApiCampus } from "./composants";

export default function PageResumesCampus({ coursId }: { coursId: string }) {
  const tx = useTextes(textesCampus);
  const id = Number(coursId);
  const { data: c } = useApiCampus<CoursCampusDto>(`/api/mon-campus/cours/${id}`);
  const { data, error, refetch, isLoading } = useQuery<CoursCompletARevise[]>({ queryKey: [`/api/revision/cours/${id}`] });
  return (
    <PageCampus>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-5 sm:px-8 sm:pt-8">
        <div>
          <BoutonRetour href={lienCampus(`/mon-campus/cours/${id}`)} libelle={tx("retour")} />
        </div>
        <div>
          <h1 className="text-[40px] font-black leading-tight sm:text-[48px]">{tx("bloc.resumes")}</h1>
          {c && <p className="text-[22px] text-texte-doux">{c.cours.titre}</p>}
        </div>
        {isLoading ? (
          <Patience />
        ) : error || !data ? (
          <ErreurCampus message={error instanceof Error ? error.message : undefined} onReessayer={() => void refetch()} />
        ) : data.length === 0 ? (
          <p className="rounded-[24px] border-2 border-ligne bg-creme p-6 text-[24px] font-bold shadow-carte">{tx("resumes.vide")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.map((r) => (
              <Link
                key={r.seanceId}
                href={lienCampus(`/mon-campus/cours/${id}/resumes/${r.seanceId}`)}
                className="flex min-h-[80px] items-center gap-4 rounded-[22px] border-2 border-ligne bg-white px-5 py-3 text-encre no-underline shadow-carte transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-orange/60 hover:text-encre hover:shadow-survol active:scale-[.985] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange/50"
              >
                <CercleIcone taille={48} fond="#EAF1FE" couleur="#1D4ED8">
                  <FileText className="h-6 w-6" strokeWidth={2.25} />
                </CercleIcone>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[22px] font-bold">{tx("resumes.ligne", { v: { date: jourEnLettres(r.debut) } })}</span>
                  <span className="break-words text-[18px] text-texte-doux">{r.titre}</span>
                </span>
                <ChevronRight className="h-7 w-7 shrink-0 text-orange-profond" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </main>
    </PageCampus>
  );
}
