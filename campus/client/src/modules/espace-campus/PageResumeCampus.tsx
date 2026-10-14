// /mon-campus/cours/:coursId/resumes/:seanceId : le résumé d'un cours (tiré de son enregistrement), lu DANS l'espace du
// campus (relecture du 15 octobre 2026 : la page des étudiants avait six onglets, l'impression, la médiathèque et le
// replay). Un gros bouton « Retour », puis, en 20 px et sans onglets : le cours en résumé, ce qu'il faut retenir, les
// idées du cours et les fiches. Lu dans GET /api/seances/:id/cours-complet (sans interrogation notée ni corrigé).
import { useQuery } from "@tanstack/react-query";
import { useTextes } from "@/lib/textes";
import { Markdown } from "@/components/ui/markdown";
import { t as textesCampus } from "@shared/textes/campus";
import { jourEnLettres } from "@shared/espace-campus";
import type { CoursCompletRevision } from "@shared/engagement/revision";
import { BoutonRetour, ErreurCampus, PageCampus, Patience, lienCampus } from "./composants";

export default function PageResumeCampus({ coursId, seanceId }: { coursId: string; seanceId: string }) {
  const tx = useTextes(textesCampus);
  const id = Number(coursId);
  const { data, error, refetch, isLoading } = useQuery<CoursCompletRevision>({ queryKey: [`/api/seances/${Number(seanceId)}/cours-complet`] });
  const d = data?.dossier ?? null;
  const section = "flex flex-col gap-3 rounded-[24px] border-[3px] border-encre p-5 sm:p-6";
  const titreSection = "text-[26px] font-black leading-tight sm:text-[30px]";
  return (
    <PageCampus>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-5 sm:px-8 sm:pt-8">
        <div>
          <BoutonRetour href={lienCampus(`/mon-campus/cours/${id}/resumes`)} libelle={tx("resume.retour")} />
        </div>
        {isLoading ? (
          <Patience />
        ) : error || !data ? (
          <ErreurCampus message={error instanceof Error ? error.message : undefined} onReessayer={() => void refetch()} />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-[20px] font-bold text-texte-doux">
                {data.seance.coursTitre} · {tx("resumes.ligne", { v: { date: jourEnLettres(data.seance.debut) } })}
              </p>
              <h1 className="break-words text-[34px] font-black leading-tight sm:text-[44px]">{d?.titre || data.seance.titre}</h1>
            </div>
            {!d || data.statut !== "prete" ? (
              <p className="rounded-[24px] border-[3px] border-encre p-6 text-[24px] font-bold">{tx("resume.pasPret")}</p>
            ) : (
              <>
                {d.resume.trim() && (
                  <section className={section}>
                    <h2 className={titreSection}>{tx("resume.cours")}</h2>
                    <Markdown source={d.resume} className="text-[20px] leading-[1.6] [&_h2]:text-[24px] [&_h3]:text-[22px] [&_li]:my-2" />
                  </section>
                )}
                {d.aRetenir.length > 0 && (
                  <section className={section}>
                    <h2 className={titreSection}>{tx("resume.retenir")}</h2>
                    <ul className="flex list-disc flex-col gap-2 pl-6 text-[20px] leading-snug">
                      {d.aRetenir.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {d.notions.length > 0 && (
                  <section className={section}>
                    <h2 className={titreSection}>{tx("resume.notions")}</h2>
                    <ol className="flex flex-col gap-4">
                      {d.notions.map((n, i) => (
                        <li key={i} className="flex flex-col gap-1">
                          <p className="text-[22px] font-black">
                            {i + 1}. {n.titre}
                          </p>
                          <p className="text-[20px] leading-snug">{n.explication}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                {d.fiches.length > 0 && (
                  <section className={section}>
                    <h2 className={titreSection}>{tx("resume.fiches")}</h2>
                    <ul className="flex flex-col gap-3">
                      {d.fiches.map((f, i) => (
                        <li key={i} className="flex flex-col gap-1 rounded-[18px] bg-creme px-5 py-4">
                          <p className="text-[21px] font-black leading-snug">{f.recto}</p>
                          <p className="text-[20px] leading-snug">{f.verso}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
    </PageCampus>
  );
}
