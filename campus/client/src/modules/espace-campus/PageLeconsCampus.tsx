// /mon-campus/cours/:coursId/lecons : « Les cours ». Une grosse ligne par leçon publiée, rangée par chapitre ; un
// toucher ouvre la leçon dans l'espace du campus (PageLeconCampus). Lu dans GET /api/cours/:id (leçons publiées
// seulement pour le compte de campus, qui n'enseigne pas le cours).
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FileText, Link2, Paperclip, PlayCircle, File, ChevronRight } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { t as textesCampus } from "@shared/textes/campus";
import type { CoursDetail, TypeLecon } from "@shared/schema";
import { BoutonRetour, ErreurCampus, PageCampus, Patience, lienCampus } from "./composants";

const ICONES: Record<TypeLecon, typeof FileText> = { texte: FileText, video: PlayCircle, pdf: File, lien: Link2, fichier: Paperclip };

export default function PageLeconsCampus({ coursId }: { coursId: string }) {
  const tx = useTextes(textesCampus);
  const id = Number(coursId);
  const { data, error, refetch, isLoading } = useQuery<CoursDetail>({ queryKey: [`/api/cours/${id}`] });
  const chapitres = (data?.chapitres ?? []).map((ch) => ({ ...ch, lecons: ch.lecons.filter((l) => l.publiee) })).filter((ch) => ch.lecons.length);
  return (
    <PageCampus>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-5 sm:px-8 sm:pt-8">
        <div>
          <BoutonRetour href={lienCampus(`/mon-campus/cours/${id}`)} libelle={tx("retour")} />
        </div>
        <div>
          <h1 className="text-[40px] font-black leading-tight sm:text-[48px]">{tx("bloc.lecons")}</h1>
          {data && <p className="text-[22px] text-texte-doux">{data.titre}</p>}
        </div>
        {isLoading ? (
          <Patience />
        ) : error || !data ? (
          <ErreurCampus message={error instanceof Error ? error.message : undefined} onReessayer={() => void refetch()} />
        ) : chapitres.length === 0 ? (
          <p className="rounded-[24px] border-[3px] border-encre p-6 text-[24px] font-bold">{tx("lecons.vide")}</p>
        ) : (
          chapitres.map((ch) => (
            <section key={ch.id} className="flex flex-col gap-3">
              <h2 className="text-[18px] font-bold uppercase tracking-wide text-texte-pale">
                {ch.numero}. {ch.titre}
              </h2>
              {ch.lecons.map((l) => {
                const Icone = ICONES[l.type] ?? FileText;
                return (
                  <Link
                    key={l.id}
                    href={lienCampus(`/mon-campus/cours/${id}/lecons/${l.id}`)}
                    className="flex min-h-[72px] items-center gap-4 rounded-[20px] border-[3px] border-encre bg-white px-5 py-3 text-[22px] font-bold text-encre no-underline hover:bg-creme"
                  >
                    <Icone className="h-8 w-8 shrink-0 text-orange-fonce" aria-hidden />
                    <span className="min-w-0 flex-1 break-words">{l.titre}</span>
                    <ChevronRight className="h-7 w-7 shrink-0" aria-hidden />
                  </Link>
                );
              })}
            </section>
          ))
        )}
      </main>
    </PageCampus>
  );
}
