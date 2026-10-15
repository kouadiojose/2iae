// /enseigner/mon-cours/:coursId/videos-examens — « Vidéos et examens » (José, 15 octobre 2026 : « un bloc où ils voient
// les vidéos des cours, les résumés de session, les examens QCM et autres faits par l'IA ; maintenant il peut lui aussi
// créer des examens et donner les critères à l'IA pour la correction »). En haut, le gros bouton « Créer un examen » ;
// puis les examens et devoirs du cours (ceux de l'IA marqués, à relire et publier dans l'éditeur existant ; les notes
// dans la page des copies existante) ; puis les vidéos des séances (replay, résumé tiré de l'enregistrement).
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ClipboardList, FileText, PlayCircle, Plus, Sparkles } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { BandeauCours, GrosBlocProf, RetourGros } from "@/components/ui/gros-blocs";
import { dateCourte, jourLong } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { t as tProf } from "@shared/textes/espace-prof";
import type { ExamenProfDto, VideosExamensDto } from "@shared/espace-prof";
import { useAccueilSimple } from "./simple/blocs";

export const cleVideosExamens = (coursId: number) => `/api/enseigner/mon-cours/${coursId}/videos-examens`;

const PASTILLE = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-bold";

export default function PageVideosExamens({ coursId }: { coursId: string }) {
  const tx = useTextes(tProf);
  const id = Number(coursId);
  const accueil = useAccueilSimple();
  const c = accueil.data?.cours.find((x) => x.coursId === id);
  const { data, error, isLoading, refetch } = useQuery<VideosExamensDto>({ queryKey: [cleVideosExamens(id)], staleTime: 10_000 });
  return (
    <Page className="gap-6 sm:gap-8">
      <RetourGros href={`/enseigner/mon-cours/${id}`}>{tx("documents.retour")}</RetourGros>
      <BandeauCours couleur={c?.couleur ?? "#2563A6"} etiquette={c?.titre ?? ""} titre={tx("videos.titre")} />
      <GrosBlocProf
        grand
        testId="creer-examen"
        ton="orange"
        icone={<Plus className="h-10 w-10" strokeWidth={2.5} />}
        titre={tx("videos.creer")}
        texte={tx("videos.creer.texte")}
        href={`/enseigner/mon-cours/${id}/examen/nouveau`}
      />
      {isLoading ? (
        <p className="text-[22px] font-bold text-texte-doux" aria-busy="true">
          …
        </p>
      ) : error || !data ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[22px] font-bold">{error instanceof Error ? error.message : "La page ne s'ouvre pas."}</p>
          <button type="button" onClick={() => void refetch()} className="min-h-[56px] rounded-[18px] bg-orange px-6 text-[18px] font-black text-encre">
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-4" data-section="examens">
            <h2 className="font-sans text-[28px] font-black">{tx("videos.section.examens")}</h2>
            {!data.examens.length ? (
              <p className="rounded-[22px] border-2 border-dashed border-ligne bg-white p-6 text-[19px] font-bold text-texte-doux">{tx("videos.aucunExamen")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.examens.map((e) => (
                  <CarteExamen key={e.id} e={e} />
                ))}
              </div>
            )}
          </section>
          <section className="flex flex-col gap-4" data-section="videos">
            <h2 className="font-sans text-[28px] font-black">{tx("videos.section.videos")}</h2>
            {!data.seances.length ? (
              <p className="rounded-[22px] border-2 border-dashed border-ligne bg-white p-6 text-[19px] font-bold text-texte-doux">{tx("videos.aucuneVideo")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.seances.map((s) => (
                  <article key={s.id} className="flex flex-col gap-3 rounded-[24px] border-2 border-ligne bg-white p-5 shadow-carte" data-video={s.id}>
                    <div>
                      <p className="text-[15px] font-semibold uppercase tracking-[0.08em] text-texte-doux">{jourLong(s.debut)}</p>
                      <h3 className="mt-1 text-[21px] font-black leading-snug">{s.titre}</h3>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {s.replay && (
                        <Link href={`/replays/${s.id}`} className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-encre px-4 text-[18px] font-bold text-white no-underline hover:bg-orange hover:text-encre">
                          <PlayCircle className="h-6 w-6" aria-hidden /> {tx("videos.replay")}
                        </Link>
                      )}
                      {s.resume === "prete" ? (
                        <Link href={`/mediatheque/cours/${s.id}`} className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] border-2 border-encre bg-white px-4 text-[18px] font-bold text-encre no-underline hover:bg-orange-pale">
                          <FileText className="h-6 w-6" aria-hidden /> {tx("videos.resume")}
                        </Link>
                      ) : s.resume ? (
                        <span className="inline-flex min-h-[56px] flex-1 items-center justify-center rounded-[16px] bg-creme px-4 text-[17px] font-bold text-texte-doux">
                          {s.resume === "erreur" ? tx("videos.resume.erreur") : tx("videos.resume.enCours")}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Page>
  );
}

/** Une carte d'examen : son type, son état, ses copies, ses critères ; « Relire et publier » ou « Voir les notes ». */
function CarteExamen({ e }: { e: ExamenProfDto }) {
  const tx = useTextes(tProf);
  const etat =
    e.etat === "brouillon"
      ? tx("videos.etat.brouillon")
      : e.etat === "a_venir"
        ? tx("videos.etat.a_venir", { v: { date: dateCourte(e.ouvertureLe ?? e.dateLimite) } })
        : e.etat === "ouvert"
          ? tx("videos.etat.ouvert", { v: { date: dateCourte(e.dateLimite) } })
          : tx("videos.etat.fini", { v: { date: dateCourte(e.dateLimite) } });
  const chiffres = [
    e.type === "quiz" ? tx(e.questions === 1 ? "videos.questions.un" : "videos.questions.n", { v: { n: e.questions } }) : null,
    e.copies ? tx(e.copies === 1 ? "videos.copies.un" : "videos.copies.n", { v: { n: e.copies } }) : null,
    e.type === "depot" && e.notees ? tx("videos.notees", { v: { n: e.notees } }) : null,
    e.aCorriger ? tx("videos.aCorriger", { v: { n: e.aCorriger } }) : null,
  ].filter(Boolean);
  const aRelire = e.etat === "brouillon" || e.criteres === "a_valider" || e.aRevoir > 0;
  return (
    <article className={cn("flex flex-col gap-3 rounded-[24px] border-2 bg-white p-5 shadow-carte", aRelire ? "border-orange" : "border-ligne")} data-examen={e.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(PASTILLE, "bg-creme text-encre")}>
          <ClipboardList className="h-4 w-4" aria-hidden />
          {e.type === "quiz" ? tx("videos.quiz") : tx("videos.depot")}
        </span>
        {e.parIa && (
          <span className={cn(PASTILLE, "bg-[#EAF1FE] text-[#1D4ED8]")}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {tx("videos.ia")}
          </span>
        )}
        <span className={cn(PASTILLE, e.etat === "brouillon" ? "bg-[#FDF3E1] text-[#8A5A12]" : e.etat === "ouvert" ? "bg-[#E7F5EE] text-[#145F3F]" : "bg-[#EEEAE6] text-[#5E554F]")}>{etat}</span>
      </div>
      <h3 className="text-[22px] font-black leading-snug">{e.titre}</h3>
      {chiffres.length > 0 && <p className="text-[18px] text-texte-doux">{chiffres.join(" · ")}</p>}
      {e.type === "depot" && (
        <p className={cn("text-[17px] font-bold", e.criteres === "professeur" ? "text-[#145F3F]" : "text-[#8A5A12]")}>
          {tx(`videos.criteres.${e.criteres}`)}
          {e.aRevoir ? ` · ${tx("videos.aRevoir", { v: { n: e.aRevoir } })}` : ""}
        </p>
      )}
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/enseigner/devoirs/${e.id}`}
          className={cn(
            "inline-flex min-h-[56px] flex-1 items-center justify-center rounded-[16px] px-4 text-[18px] font-black no-underline",
            aRelire ? "bg-orange text-encre hover:bg-encre hover:text-white" : "border-2 border-encre bg-white text-encre hover:bg-orange-pale",
          )}
        >
          {e.etat === "brouillon" ? tx("videos.relire") : tx("videos.modifier")}
        </Link>
        {(e.copies > 0 || e.etat === "fini") && (
          <Link href={`/enseigner/devoirs/${e.id}/copies`} className="inline-flex min-h-[56px] flex-1 items-center justify-center rounded-[16px] bg-encre px-4 text-[18px] font-bold text-white no-underline hover:bg-orange hover:text-encre">
            {tx("videos.notes")}
          </Link>
        )}
      </div>
    </article>
  );
}
