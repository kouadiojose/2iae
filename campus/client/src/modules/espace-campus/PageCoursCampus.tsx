// /mon-campus/cours/:coursId : un cours, cinq gros blocs. « Entrer dans le live » (orange, vert quand la classe est en
// direct), puis « Les cours », « Les résumés de cours », « Les examens », « Les notes ». Toucher « Entrer dans le
// live » demande le plein écran dans le même geste (le navigateur le permet), puis ouvre l'écran de la salle.
import { useLocation } from "wouter";
import { BookOpen, ClipboardList, FileText, GraduationCap, MonitorPlay } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { t as textesCampus } from "@shared/textes/campus";
import type { CoursCampusDto } from "@shared/espace-campus";
import { BandeauApercu, BoutonRetour, ErreurCampus, GrosBloc, PageCampus, Patience, PastilleRepere, lienCampus, styleCouleur, useApiCampus } from "./composants";

/** Clé (sessionStorage) : « on arrive sur l'écran du live par un toucher » (pas de voile à l'arrivée). */
export const CLE_GESTE_LIVE = "campus:live-geste";

/** Demande le plein écran (geste de la personne) ; sans effet sur iPhone, ou si le navigateur refuse. */
export function demanderPleinEcran() {
  try {
    if (document.fullscreenEnabled && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  } catch {
    /* navigateur sans plein écran */
  }
}

type Compteur = "lecons" | "resumes" | "examens" | "notes";

export default function PageCoursCampus({ coursId }: { coursId: string }) {
  const tx = useTextes(textesCampus);
  const [, naviguer] = useLocation();
  const id = Number(coursId);
  const { data, error, refetch, isLoading } = useApiCampus<CoursCampusDto>(`/api/mon-campus/cours/${id}`);
  const compte = (cle: Compteur, n: number) => tx(n === 0 ? `compteur.${cle}.zero` : n === 1 ? `compteur.${cle}.un` : `compteur.${cle}`, { v: { n } });
  const sousTitreLive = (d: CoursCampusDto) =>
    d.live.repere === "direct"
      ? tx("repere.direct")
      : d.live.repere === "ouvert"
        ? tx("repere.ouvert", { v: { heure: d.live.heure ?? "" } })
        : d.live.repere === "aujourdhui"
          ? tx("repere.aujourdhui", { v: { heure: d.live.heure ?? "" } })
          : tx("bloc.live.aucun");
  return (
    <PageCampus>
      {data?.apercu && <BandeauApercu campus={data.campus.nomCourt} />}
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-5 sm:px-8 sm:pt-8">
        <div>
          <BoutonRetour href={lienCampus("/mon-campus")} libelle={tx("cours.retour")} />
        </div>
        {isLoading ? (
          <Patience />
        ) : error || !data ? (
          <ErreurCampus message={error instanceof Error ? error.message : undefined} onReessayer={() => void refetch()} />
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-[24px] px-6 py-6 sm:px-8" style={styleCouleur(data.cours.couleur)}>
              <PastilleRepere repere={data.live.repere} heure={data.live.heure} grande />
              <h1 className="break-words text-[36px] font-black leading-[1.05] sm:text-[48px]">{data.cours.titre}</h1>
              {data.cours.formateur && <p className="text-[22px] font-semibold">{tx("cours.avec", { v: { formateur: data.cours.formateur } })}</p>}
            </div>
            <GrosBloc
              grand
              testId="live"
              ton={data.live.repere === "direct" || data.live.repere === "ouvert" ? "vert" : "orange"}
              icone={<MonitorPlay className="h-14 w-14" />}
              titre={tx("bloc.live")}
              sousTitre={sousTitreLive(data)}
              onClick={() => {
                demanderPleinEcran();
                try {
                  sessionStorage.setItem(CLE_GESTE_LIVE, String(Date.now()));
                } catch {
                  /* navigateur sans stockage : le voile demandera un toucher, sans conséquence */
                }
                naviguer(lienCampus(`/mon-campus/cours/${id}/live`));
              }}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <GrosBloc testId="lecons" icone={<BookOpen className="h-12 w-12" />} titre={tx("bloc.lecons")} sousTitre={compte("lecons", data.compteurs.lecons)} href={lienCampus(`/mon-campus/cours/${id}/lecons`)} />
              <GrosBloc testId="resumes" icone={<FileText className="h-12 w-12" />} titre={tx("bloc.resumes")} sousTitre={compte("resumes", data.compteurs.resumes)} href={lienCampus(`/mon-campus/cours/${id}/resumes`)} />
              <GrosBloc testId="examens" icone={<ClipboardList className="h-12 w-12" />} titre={tx("bloc.examens")} sousTitre={compte("examens", data.compteurs.examens)} href={lienCampus(`/mon-campus/cours/${id}/examens`)} />
              <GrosBloc testId="notes" icone={<GraduationCap className="h-12 w-12" />} titre={tx("bloc.notes")} sousTitre={compte("notes", data.compteurs.notes)} href={lienCampus(`/mon-campus/cours/${id}/notes`)} />
            </div>
          </>
        )}
      </main>
    </PageCampus>
  );
}
