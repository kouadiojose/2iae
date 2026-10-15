// /mon-campus/cours/:coursId/examens : « Les examens ». Une carte par devoir publié : le type, le titre, la date, et
// les copies rendues par les étudiants du campus. Jamais la consigne, le corrigé ni une copie.
import { ClipboardList, Timer } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { t as textesCampus } from "@shared/textes/campus";
import type { CoursCampusDto, ExamenCampusDto } from "@shared/espace-campus";
import { heureSimple, jourEnLettres } from "@shared/espace-campus";
import { BoutonRetour, ErreurCampus, PageCampus, Patience, lienCampus, useApiCampus } from "./composants";

export default function PageExamensCampus({ coursId }: { coursId: string }) {
  const tx = useTextes(textesCampus);
  const id = Number(coursId);
  const { data: c } = useApiCampus<CoursCampusDto>(`/api/mon-campus/cours/${id}`);
  const { data, error, refetch, isLoading } = useApiCampus<ExamenCampusDto[]>(`/api/mon-campus/cours/${id}/examens`);
  const date = (e: ExamenCampusDto) =>
    e.etat === "a_venir" && e.ouvertureLe
      ? tx("examens.ouvre", { v: { date: jourEnLettres(e.ouvertureLe), heure: heureSimple(e.ouvertureLe) } })
      : e.etat === "fini"
        ? tx("examens.fini", { v: { date: jourEnLettres(e.echeance) } })
        : tx("examens.avant", { v: { date: jourEnLettres(e.echeance), heure: heureSimple(e.echeance) } });
  return (
    <PageCampus>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-5 sm:px-8 sm:pt-8">
        <div>
          <BoutonRetour href={lienCampus(`/mon-campus/cours/${id}`)} libelle={tx("retour")} />
        </div>
        <div>
          <h1 className="text-[40px] font-black leading-tight sm:text-[48px]">{tx("bloc.examens")}</h1>
          {c && <p className="text-[22px] text-texte-doux">{c.cours.titre}</p>}
        </div>
        {isLoading ? (
          <Patience />
        ) : error || !data ? (
          <ErreurCampus message={error instanceof Error ? error.message : undefined} onReessayer={() => void refetch()} />
        ) : data.length === 0 ? (
          <p className="rounded-[24px] border-2 border-ligne bg-creme p-6 text-[24px] font-bold shadow-carte">{tx("examens.vide")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.map((e) => (
              <article key={e.id} className={`flex flex-col gap-2 rounded-[24px] border-2 p-5 shadow-carte sm:p-6 ${e.etat === "en_cours" ? "border-orange bg-orange-pale" : "border-ligne bg-white"}`} data-examen={e.id}>
                <span className="flex items-center gap-2 font-mono text-[15px] font-semibold uppercase leading-snug tracking-[0.14em] text-orange-profond">
                  {e.type === "quiz" ? <Timer className="h-6 w-6" aria-hidden /> : <ClipboardList className="h-6 w-6" aria-hidden />}
                  {tx(e.type === "quiz" ? "examens.quiz" : "examens.depot")}
                </span>
                <p className="break-words text-[24px] font-black leading-tight">{e.titre}</p>
                <p className="text-[20px] font-semibold">{date(e)}</p>
                <p className="text-[20px] text-texte-doux">{tx(e.rendus === 0 ? "examens.rendus.zero" : e.rendus === 1 ? "examens.rendus.un" : "examens.rendus", { v: { n: e.rendus, total: e.inscrits, campus: c?.campus.nomCourt ?? "" } })}</p>
              </article>
            ))}
          </div>
        )}
      </main>
    </PageCampus>
  );
}
