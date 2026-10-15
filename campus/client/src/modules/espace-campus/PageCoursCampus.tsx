// /mon-campus/cours/:coursId : un cours, en gros blocs. Le héros du cours (dégradé de sa couleur), « Entrer dans le
// live » (orange : à ouvrir aujourd'hui ; vert, point vivant : ouvert ou en direct ; nuit : pas de cours aujourd'hui,
// tester le son et l'image), « Ajouter un PowerPoint » et « Ajouter une vidéo », puis « Les cours », « Les résumés de
// cours », « Les examens », « Les notes ».
//
// Toucher « Entrer dans le live » demande le plein écran dans le même geste (le navigateur le permet), puis ouvre
// l'écran de la salle. Séance du jour à venir : la salle s'ouvre (…/live?ouvrir=1 : la page du live l'ouvre une seule
// fois) ; plus d'une heure avant, une confirmation d'un toucher d'abord (« Le cours commence à 14h00. Ouvrir la salle
// maintenant pour tester le son ? ») contre le carré touché par erreur (José, 15 octobre 2026 à 5 h : « les salles
// n'ont pas besoin d'attendre que le professeur arrive pour ouvrir »).
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, CheckCircle2, ClipboardList, FileText, GraduationCap, MonitorPlay, Volume2 } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { maintenantServeur } from "@/lib/horloge";
import { rafraichir } from "@/lib/queryClient";
import { Bulles, Etiquette, GrosBloc } from "@/components/ui/gros-blocs";
import { degradeCours, teinteDouce } from "@/modules/cours/outils";
import { t as textesCampus } from "@shared/textes/campus";
import { AVANCE_MAX_OUVERTURE_MIN } from "@shared/ouverture";
import type { CoursCampusDto } from "@shared/espace-campus";
import { BandeauApercu, BoutonRetour, Confirmation, ErreurCampus, PageCampus, Patience, PastilleRepere, lienCampus, useApiCampus } from "./composants";
import { CartesAjoutsCampus } from "./ajouts-campus";

/** Clé (sessionStorage) : « on arrive sur l'écran du live par un toucher » (pas de voile à l'arrivée). */
export const CLE_GESTE_LIVE = "campus:live-geste";
/** Clé (sessionStorage) : « Salle fermée. Le cours continue pour les autres. » à afficher au retour sur la page du cours. */
export const CLE_SALLE_FERMEE = "campus:salle-fermee";

/** Demande le plein écran (geste de la personne) ; sans effet sur iPhone, ou si le navigateur refuse. */
export function demanderPleinEcran() {
  try {
    if (document.fullscreenEnabled && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  } catch {
    /* navigateur sans plein écran */
  }
}

type Compteur = "lecons" | "resumes" | "examens" | "notes";

/** Teintes des blocs de lecture (fond du cercle / couleur de l'icône) : contraste AA. */
const LECTURES: { cle: Compteur; bloc: "bloc.lecons" | "bloc.resumes" | "bloc.examens" | "bloc.notes"; chemin: string; icone: typeof BookOpen; cercle: { fond: string; couleur: string } }[] = [
  { cle: "lecons", bloc: "bloc.lecons", chemin: "lecons", icone: BookOpen, cercle: { fond: "#FFF1E6", couleur: "#A34C17" } },
  { cle: "resumes", bloc: "bloc.resumes", chemin: "resumes", icone: FileText, cercle: { fond: "#EAF1FE", couleur: "#1D4ED8" } },
  { cle: "examens", bloc: "bloc.examens", chemin: "examens", icone: ClipboardList, cercle: { fond: "#FDF3E1", couleur: "#8A5A12" } },
  { cle: "notes", bloc: "bloc.notes", chemin: "notes", icone: GraduationCap, cercle: { fond: "#E7F5EE", couleur: "#145F3F" } },
];

/** « Salle fermée. Le cours continue pour les autres. » : une fois, au retour de l'écran du live. */
function useSalleFermee(): boolean {
  const [fermee] = useState(() => {
    try {
      const v = sessionStorage.getItem(CLE_SALLE_FERMEE);
      sessionStorage.removeItem(CLE_SALLE_FERMEE);
      return Boolean(v);
    } catch {
      return false;
    }
  });
  return fermee;
}

export default function PageCoursCampus({ coursId }: { coursId: string }) {
  const tx = useTextes(textesCampus);
  const [, naviguer] = useLocation();
  const id = Number(coursId);
  const { data, error, refetch, isLoading } = useApiCampus<CoursCampusDto>(`/api/mon-campus/cours/${id}`);
  const [confirmer, setConfirmer] = useState(false);
  const salleFermee = useSalleFermee();
  const [ligneFermee, setLigneFermee] = useState(salleFermee);
  useEffect(() => {
    if (!ligneFermee) return;
    const t = setTimeout(() => setLigneFermee(false), 20_000);
    return () => clearTimeout(t);
  }, [ligneFermee]);
  const compte = (cle: Compteur, n: number) => tx(n === 0 ? `compteur.${cle}.zero` : n === 1 ? `compteur.${cle}.un` : `compteur.${cle}`, { v: { n } });

  const entrer = (ouvrir: boolean) => {
    demanderPleinEcran();
    try {
      sessionStorage.setItem(CLE_GESTE_LIVE, String(Date.now()));
    } catch {
      /* navigateur sans stockage : le voile demandera un toucher, sans conséquence */
    }
    naviguer(lienCampus(`/mon-campus/cours/${id}/live`, { ouvrir: ouvrir ? 1 : null }));
  };

  let contenu = null;
  if (data) {
    const d = degradeCours(data.cours.couleur);
    const live = data.live;
    const aOuvrir = live.repere === "aujourdhui";
    const ouvert = live.repere === "direct" || live.repere === "ouvert";
    const sousTitreLive = live.essai
      ? live.fin === "fini"
        ? tx("bloc.live.essai.fini")
        : live.fin === "annule"
          ? tx("bloc.live.essai.annule")
          : live.fin === "non_tenu"
            ? tx("bloc.live.essai.nonTenu")
            : tx("bloc.live.essai")
      : live.repere === "direct"
        ? tx("repere.direct")
        : live.repere === "ouvert"
          ? tx("repere.ouvert", { v: { heure: live.heure ?? "" } })
          : tx("bloc.live.ouvrir", { v: { heure: live.heure ?? "" } });
    const toucherLive = () => {
      // Plus d'une heure avant le cours : une confirmation d'un toucher (contre le carré touché par erreur).
      if (aOuvrir && live.debut && Date.parse(live.debut) - maintenantServeur() > AVANCE_MAX_OUVERTURE_MIN * 60_000) return setConfirmer(true);
      entrer(aOuvrir);
    };
    contenu = (
      <>
        {ligneFermee && (
          <p className="flex items-center gap-3 rounded-[22px] border-2 border-[#B9E2CC] bg-succes-clair px-5 py-4 text-[22px] font-bold text-vif-texte" role="status" data-salle-fermee>
            <CheckCircle2 className="h-7 w-7 shrink-0" aria-hidden />
            {tx("fermer.salle.fait")}
          </p>
        )}
        {/* Héros du cours : dégradé doux de sa couleur, bulles, code, titre, formateur, repère en grand. */}
        <section
          className="relative isolate flex flex-col gap-4 overflow-hidden rounded-[32px] p-7 shadow-carte sm:p-10"
          style={{ background: d.css, color: d.texte }}
          data-degrade={`${d.fond},${d.a}`}
          data-heros
        >
          <Bulles voile={d.voile} grandes />
          <span className="font-mono text-[15px] font-semibold uppercase tracking-[0.14em]">{data.cours.code}</span>
          <h1 className="break-words text-[40px] leading-[1.02] sm:text-[56px]" style={{ color: d.texte }}>
            {data.cours.titre}
          </h1>
          {data.cours.formateur && <p className="text-[22px] font-semibold">{tx("cours.avec", { v: { formateur: data.cours.formateur } })}</p>}
          {live.repere && (
            <span>
              <PastilleRepere repere={live.repere} heure={live.heure} grande />
            </span>
          )}
        </section>
        <GrosBloc
          grand
          testId="live"
          ton={live.essai ? "nuit" : ouvert ? "vert" : "orange"}
          vivant={ouvert}
          icone={live.essai ? <Volume2 className="h-10 w-10" strokeWidth={2.25} /> : <MonitorPlay className="h-10 w-10" strokeWidth={2.25} />}
          titre={tx("bloc.live")}
          sousTitre={sousTitreLive}
          onClick={toucherLive}
        />
        <section className="flex flex-col gap-4" aria-label={tx("bloc.ajouts")}>
          <h2 className="text-[30px] text-encre">{tx("bloc.ajouts")}</h2>
          <CartesAjoutsCampus ajouts={data.ajouts} onFait={() => void rafraichir(lienCampus(`/api/mon-campus/cours/${id}`))} />
        </section>
        <section className="flex flex-col gap-4" aria-label={tx("bloc.lectures")}>
          <h2 className="text-[30px] text-encre">{tx("bloc.lectures")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            {LECTURES.map((l) => {
              const Icone = l.icone;
              return (
                <GrosBloc
                  key={l.cle}
                  testId={l.cle}
                  ton="teinte"
                  fond={teinteDouce(data.cours.couleur)}
                  cercle={l.cercle}
                  icone={<Icone className="h-8 w-8" strokeWidth={2.25} />}
                  titre={tx(l.bloc)}
                  sousTitre={<span className="text-texte-doux">{compte(l.cle, data.compteurs[l.cle])}</span>}
                  href={lienCampus(`/mon-campus/cours/${id}/${l.chemin}`)}
                />
              );
            })}
          </div>
        </section>
        <Confirmation
          ouverte={confirmer}
          titre={tx("live.ouvrir.confirm.titre", { v: { heure: live.heure ?? "" } })}
          texte={tx("live.ouvrir.confirm.texte")}
          oui={tx("live.ouvrir.confirm.oui")}
          non={tx("live.ouvrir.confirm.non")}
          onOui={() => {
            setConfirmer(false);
            entrer(true);
          }}
          onNon={() => setConfirmer(false)}
        />
      </>
    );
  }

  return (
    <PageCampus className="bg-white">
      {data?.apercu && <BandeauApercu campus={data.campus.nomCourt} />}
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-5 sm:gap-8 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BoutonRetour href={lienCampus("/mon-campus")} libelle={tx("cours.retour")} />
          {data && <Etiquette className="hidden sm:inline">{data.campus.nomCourt}</Etiquette>}
        </div>
        {isLoading ? <Patience /> : error || !data ? <ErreurCampus message={error instanceof Error ? error.message : undefined} onReessayer={() => void refetch()} /> : contenu}
      </main>
    </PageCampus>
  );
}
