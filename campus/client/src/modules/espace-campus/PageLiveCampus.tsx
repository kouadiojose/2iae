// /mon-campus/cours/:coursId/live : « Entrer dans le live ». Cet ordinateur devient l'écran de la salle pour CE cours,
// celui que la personne a touché (le cours est dans l'adresse : il reste le même au rechargement ; plus aucune
// attribution automatique). Même affichage que l'écran d'une salle (EcranSeance, live/PageSalle.tsx : grande vidéo du
// formateur, diapos, QR et code du campus, son), en plein écran, avec un seul bouton discret : « Quitter ».
//   - Pas encore ouverte : « Ouvrir le cours » dès 1 h avant (comme l'ouverture automatique), sinon « Le cours
//     commence à 8h30 : la salle s'ouvrira toute seule à 8h00 ».
//   - Rechargement, ou ordinateur rallumé : un bandeau jaune « Touchez l'écran pour reprendre le cours. » en haut, qui
//     ne cache rien (la vidéo, le QR et le code restent visibles) ; le premier toucher, n'importe où, remet le plein
//     écran et le son.
//   - Deux ordinateurs du campus sur le même cours : « Un autre ordinateur de … montre ce cours. Même salle ? Fermez-en un. »
// L'ordinateur entre dans la classe comme une salle (serveur : estEcran), caméra et micro de la salle.
import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { heure as heureLocale } from "@/lib/dates";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { relancerSons } from "@/modules/visio/composants";
import { EcranSeance } from "@/modules/live/PageSalle";
import { useEcranAllume } from "@/modules/live/outils";
import { t as textesCampus } from "@shared/textes/campus";
import { deCampus, type LiveCampusDto } from "@shared/espace-campus";
import type { EtatDirectDto, SeanceDetailDto } from "@shared/schema";
import { Confirmation, lienCampus, useApiCampus } from "./composants";
import { CLE_GESTE_LIVE, demanderPleinEcran } from "./PageCoursCampus";

/**
 * Bandeau « Touchez l'écran pour reprendre le cours. » à l'arrivée sur la page ? Non quand on vient de toucher « Entrer
 * dans le live » (repère laissé par la page du cours, consommé ici) ; oui après un rechargement ou un ordinateur
 * rallumé : le navigateur n'a reçu aucun geste, ni le plein écran ni le son ne peuvent repartir sans un toucher.
 */
function voileAuChargement(): boolean {
  let geste = 0;
  try {
    geste = Number(sessionStorage.getItem(CLE_GESTE_LIVE) ?? 0);
    sessionStorage.removeItem(CLE_GESTE_LIVE);
  } catch {
    /* navigateur sans stockage */
  }
  return !(geste && Date.now() - geste < 15_000);
}

function sortirDuPleinEcran() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
  } catch {
    /* rien à faire */
  }
}

export default function PageLiveCampus({ coursId }: { coursId: string }) {
  const tx = useTextes(textesCampus);
  const id = Number(coursId);
  useEcranAllume(true);
  const [, naviguer] = useLocation();
  const recherche = useSearch();
  const seanceChoisie = Number(new URLSearchParams(recherche).get("seance")) || null;
  const chemin = `/api/mon-campus/cours/${id}/live${seanceChoisie ? `?seance=${seanceChoisie}` : ""}`;
  const { data, error, refetch } = useApiCampus<LiveCampusDto>(chemin, 30_000);
  const queryClient = useQueryClient();
  const [voile, setVoile] = useState(voileAuChargement);
  const [quitter, setQuitter] = useState(false);
  const [ouverture, setOuverture] = useState(false);
  const [erreurOuverture, setErreurOuverture] = useState<string | null>(null);
  const retourCours = lienCampus(`/mon-campus/cours/${id}`);

  const reprendre = () => {
    demanderPleinEcran();
    relancerSons(document.body);
    setVoile(false);
  };
  // Le bandeau n'a de sens que sur l'écran d'un cours (à venir ou en direct), pas sur « Le cours est fini ».
  const ecranDuCours = Boolean(data?.seanceId && !data.choix && (data.etat === "a_venir" || data.etat === "ouverte"));
  // Le premier toucher (ou touche du clavier), n'importe où sur l'écran, remet le plein écran et le son : le bandeau ne
  // bloque rien, personne n'a besoin de viser.
  useEffect(() => {
    if (!voile || !ecranDuCours) return;
    const geste = () => {
      demanderPleinEcran();
      relancerSons(document.body);
      setVoile(false);
    };
    document.addEventListener("click", geste, { capture: true, once: true });
    document.addEventListener("keydown", geste, { capture: true, once: true });
    return () => {
      document.removeEventListener("click", geste, { capture: true });
      document.removeEventListener("keydown", geste, { capture: true });
    };
  }, [voile, ecranDuCours]);

  const ouvrir = async (seanceId: number) => {
    setOuverture(true);
    setErreurOuverture(null);
    try {
      const dto = await post<LiveCampusDto>(lienCampus(`/api/mon-campus/seances/${seanceId}/ouvrir`));
      queryClient.setQueryData([lienCampus(chemin)], dto);
      await rafraichir(`/api/seances/${seanceId}`);
    } catch (e) {
      setErreurOuverture(e instanceof ErreurApi ? e.message : tx("accueil.erreur"));
      void refetch();
    } finally {
      setOuverture(false);
    }
  };

  const bandeau = (d: LiveCampusDto) => (seance: SeanceDetailDto | null, etat: EtatDirectDto | null) => (
    <BandeauCampus d={d} etat={etat} titre={seance?.coursTitre || d.cours.titre} onQuitter={() => setQuitter(true)} reprendre={voile && ecranDuCours ? reprendre : undefined} />
  );

  let contenu;
  if (!data) {
    contenu = error ? (
      <div className="flex flex-col items-center gap-6 px-6 py-24 text-center">
        <p className="text-[32px] font-black">{error instanceof Error ? error.message : tx("accueil.erreur")}</p>
        <button type="button" onClick={() => void refetch()} className="min-h-[72px] rounded-[20px] bg-orange px-8 text-[24px] font-black text-encre">
          {tx("accueil.reessayer")}
        </button>
        <Link href={retourCours} className="text-[22px] font-bold text-white underline underline-offset-4">
          {tx("live.revenir")}
        </Link>
      </div>
    ) : (
      <p className="px-6 py-24 text-center text-[32px] font-black text-nuit-doux">{tx("live.chargement")}</p>
    );
  } else if (data.choix) {
    // Deux séances du même cours à la même heure (deux sessions) : la personne choisit ; le choix va dans l'adresse.
    contenu = (
      <>
        {bandeau(data)(null, null)}
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10">
          <p className="text-[40px] font-black leading-tight">{tx("live.choix")}</p>
          {data.choix.map((x) => (
            <button
              key={x.seanceId}
              type="button"
              onClick={() => naviguer(lienCampus(`/mon-campus/cours/${id}/live`, { seance: x.seanceId }), { replace: true })}
              className="flex min-h-[120px] w-full flex-col justify-center rounded-[24px] bg-orange px-6 py-4 text-left text-encre"
              data-choix
            >
              <span className="text-[36px] font-black leading-tight">
                {x.heure}
                {x.classes ? ` · ${x.classes}` : ""}
              </span>
              {x.detail && <span className="text-[26px] font-bold leading-tight">{x.detail}</span>}
            </button>
          ))}
        </main>
      </>
    );
  } else if (data.seanceId && (data.etat === "a_venir" || data.etat === "ouverte")) {
    const avant =
      data.etat === "a_venir" ? (
        <div className="flex flex-col gap-3">
          {data.peutOuvrir ? (
            <>
              <button
                type="button"
                disabled={ouverture}
                onClick={() => void ouvrir(data.seanceId!)}
                className="flex min-h-[120px] w-full items-center justify-center gap-4 rounded-[24px] bg-orange px-6 text-[34px] font-black text-encre disabled:opacity-80 sm:text-[40px]"
              >
                <Play className="h-12 w-12 shrink-0" aria-hidden />
                {ouverture ? tx("live.ouverture") : tx("live.ouvrir")}
              </button>
              <p className="text-[26px] font-bold">{tx("live.commence", { v: { heure: data.heure ?? "" } })}</p>
            </>
          ) : (
            <p className="rounded-[24px] bg-nuit-carte px-6 py-5 text-[26px] font-black leading-snug sm:text-[32px]" role="status">
              {data.apresPrecedente && !data.ouvertureAutoA
                ? tx("live.apresPrecedente", { v: { heure: data.heure ?? "" } })
                : data.ouvertureAutoA
                ? tx("live.attendre.auto", { v: { heure: data.heure ?? "", ouverture: data.ouvertureAutoA } })
                : data.ouvrableA
                  ? tx("live.attendre.main", { v: { heure: data.heure ?? "", ouverture: data.ouvrableA } })
                  : tx("live.commence", { v: { heure: data.heure ?? "" } })}
            </p>
          )}
          {erreurOuverture && (
            <p className="rounded-[20px] bg-[#3A1A10] px-5 py-4 text-[24px] font-bold text-[#FFB59E]" role="alert">
              {erreurOuverture}
            </p>
          )}
        </div>
      ) : undefined;
    contenu = (
      <EcranSeance
        key={data.seanceId}
        seanceId={data.seanceId}
        siteId={data.campus.id}
        campus={{ bandeau: (s, e) => bandeau(data)(s, e), avant, guide: tx("live.guide") }}
      />
    );
  } else {
    // Fini, annulé, pas eu lieu, ou pas de cours aujourd'hui.
    const titre =
      data.etat === "terminee" ? tx("live.fini") : data.etat === "annulee" ? tx("live.annule") : data.etat === "non_tenue" ? tx("live.nonTenu") : tx("live.aucun");
    contenu = (
      <>
        {bandeau(data)(null, null)}
        <main className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-4 py-16 text-center">
          <p className="text-[48px] font-black leading-[1.02] sm:text-[80px]">{titre}</p>
          {data.etat === "annulee" && data.motif && <p className="rounded-[24px] bg-nuit-carte px-6 py-4 text-[26px] font-semibold">{data.motif}</p>}
          {data.etat === "aucune" && data.prochaine && (
            <p className="text-[28px] font-bold text-nuit-doux">{tx("live.prochain", { v: { jour: data.prochaine.jour, heure: data.prochaine.heure } })}</p>
          )}
          <Link
            href={retourCours}
            onClick={sortirDuPleinEcran}
            className="flex min-h-[96px] w-full max-w-xl items-center justify-center gap-3 rounded-[24px] bg-orange px-6 text-[30px] font-black text-encre no-underline sm:min-h-[120px]"
          >
            <ArrowLeft className="h-9 w-9" aria-hidden />
            {tx("live.revenir")}
          </Link>
        </main>
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-nuit text-white">
      {contenu}
      <Confirmation
        nuit
        ouverte={quitter}
        titre={tx("live.quitter.titre")}
        texte={tx("live.quitter.texte")}
        oui={tx("live.quitter.oui")}
        non={tx("live.quitter.non")}
        onOui={() => {
          setQuitter(false);
          sortirDuPleinEcran();
          naviguer(retourCours);
        }}
        onNon={() => setQuitter(false)}
      />
    </div>
  );
}

/** Bandeau de l'écran du campus : logo, « Yamoussoukro · Marketing digital », l'heure, et « Quitter ». */
function BandeauCampus({ d, etat, titre, onQuitter, reprendre }: { d: LiveCampusDto; etat: EtatDirectDto | null; titre: string; onQuitter: () => void; reprendre?: () => void }) {
  const tx = useTextes(textesCampus);
  const maintenant = useMaintenant(1000);
  const ecrans = etat?.campus.find((c) => c.siteId === d.campus.id)?.ecrans ?? d.ecransDuCampus;
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 lg:px-10">
      {/* Après un rechargement : un bandeau qui ne cache rien ; le premier toucher, n'importe où, suffit. */}
      {reprendre && (
        <button type="button" onClick={reprendre} className="w-full rounded-[18px] bg-[#F5C542] px-5 py-3 text-center text-[24px] font-black leading-tight text-encre sm:text-[28px]" data-voile>
          {tx("live.reprendre")}
        </button>
      )}
      <div className="flex min-w-0 items-center gap-3">
        <img src="/marque-2iae-detouree.png" alt="Groupe Écoles 2IAE" className="h-10 w-auto shrink-0 sm:h-12" />
        <span className="min-w-0 break-words text-[20px] font-bold text-nuit-texte">
          {d.campus.nomCourt} · {titre}
        </span>
      </div>
      {ecrans >= 2 && (
        <span className="order-last w-full rounded-[18px] bg-[#F5C542] px-4 py-2 text-[18px] font-bold text-encre sm:order-none sm:w-auto" role="status" data-deux-ecrans>
          {tx("live.deuxEcrans", { v: { deCampus: deCampus(d.campus.nomCourt) } })} {tx("live.deuxEcrans.conseil")}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-4">
        <span className="font-mono text-xl tabular-nums text-white sm:text-2xl lg:text-3xl">{heureLocale(maintenant)}</span>
        <button
          type="button"
          onClick={onQuitter}
          className="flex min-h-[44px] items-center gap-2 rounded-full border border-nuit-bord px-4 text-[16px] font-bold text-nuit-gris hover:text-white"
          data-quitter
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          {tx("live.quitter")}
        </button>
      </div>
    </header>
  );
}
