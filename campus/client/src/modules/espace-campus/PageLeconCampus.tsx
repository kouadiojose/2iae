// /mon-campus/cours/:coursId/lecons/:leconId : une leçon, lue DANS l'espace du campus (relecture du 15 octobre 2026 :
// la page des étudiants ouvrait la coquille complète, des onglets, l'assistant et des liens vers d'autres pages). Un
// gros bouton « Retour » vers la liste des leçons, le titre, la vidéo ou le document, le texte en 20 px, et la leçon
// suivante. Rien d'autre. Lu dans GET /api/cours/:id/lecons/:leconId (leçons publiées des cours de son campus).
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { Markdown } from "@/components/ui/markdown";
import { MediaLecon } from "@/modules/cours/composants/MediasLecon";
import { typographie } from "@/modules/cours/outils";
import { t as textesCampus } from "@shared/textes/campus";
import type { LeconDetail } from "@shared/schema";
import { BoutonRetour, ErreurCampus, PageCampus, Patience, lienCampus } from "./composants";

export default function PageLeconCampus({ coursId, leconId }: { coursId: string; leconId: string }) {
  const tx = useTextes(textesCampus);
  const id = Number(coursId);
  const lId = Number(leconId);
  const { data: l, error, refetch, isLoading } = useQuery<LeconDetail>({ queryKey: ["/api/cours", id, "lecons", lId] });
  return (
    <PageCampus>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-5 sm:px-8 sm:pt-8">
        <div>
          <BoutonRetour href={lienCampus(`/mon-campus/cours/${id}/lecons`)} libelle={tx("lecon.retour")} />
        </div>
        {isLoading ? (
          <Patience />
        ) : error || !l ? (
          <ErreurCampus message={error instanceof Error ? error.message : undefined} onReessayer={() => void refetch()} />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-[20px] font-bold text-texte-doux">{l.coursTitre}</p>
              <h1 className="break-words text-[34px] font-black leading-tight sm:text-[44px]">{l.titre}</h1>
            </div>
            <MediaLecon type={l.type} url={l.url} fichier={l.fichier} titre={l.titre} minutes={l.dureeMinutes} />
            {l.contenu.trim() ? (
              <article>
                <Markdown source={typographie(l.contenu)} className="text-[20px] leading-[1.6] [&_h2]:text-[26px] [&_h3]:text-[23px] [&_li]:my-2" />
              </article>
            ) : null}
            {l.suivante && (
              <Link
                href={lienCampus(`/mon-campus/cours/${id}/lecons/${l.suivante.id}`)}
                className="flex min-h-[96px] items-center gap-4 rounded-[24px] bg-orange px-6 py-4 text-encre no-underline"
                data-lecon-suivante
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[20px] font-bold">{tx("lecon.suivante")}</span>
                  <span className="break-words text-[24px] font-black leading-tight">{l.suivante.titre}</span>
                </span>
                <ArrowRight className="h-9 w-9 shrink-0" aria-hidden />
              </Link>
            )}
          </>
        )}
      </main>
    </PageCampus>
  );
}
