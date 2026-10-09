// Devoirs et copies dans le Studio, sans quitter le direct (demande de José du 9 octobre 2026 : « quand on
// est dans la classe en live, on ne peut pas aller voir les devoirs des étudiants et les présenter en live »).
//
// Trois gestes : « Devoirs » (bouton d'en-tête), toucher une copie, « Projeter à la classe ». La vue se pose
// par-dessus le Studio (portail, comme la visite d'un groupe) : la visio, la radio, les sous-titres et
// l'enregistrement continuent dessous. Après la projection, la vue se ferme et la copie prend la place de la
// diapo dans le panneau présentateur (PanneauCopieEnCours) ; « Revenir aux diapos » la retire d'un geste.
// La classe ne voit jamais le nom de l'étudiant (sauf choix du formateur), ni la note, ni les commentaires.
// Le geste « retour » du téléphone referme la vue (il ne quitte jamais le Studio, donc jamais le direct).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, BookCheck, ChevronLeft, ChevronRight, ClipboardList, ExternalLink, Hand, Loader2, Maximize2, MonitorUp, Presentation, RotateCw, Search } from "lucide-react";
import { useTousEvenements } from "@/lib/flux";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { useVueSuperposee } from "@/lib/vue-superposee";
import { Bouton } from "@/components/ui/bouton";
import { Interrupteur } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { formaterDate, type Traducteur } from "@shared/textes";
import { deDevant, t as textesCopies } from "@shared/textes/copies-direct";
import type {
  CopieDuDirectDto,
  CorpsProjectionCopie,
  DevoirDuDirectDto,
  EtatDirectDto,
  ListeCopiesDuDirectDto,
  ListeDevoirsDuDirectDto,
  PageCopieDto,
  PlanCopieDto,
  PlanCorrigeDto,
  ProjectionCopieAnimateurDto,
  RotationCopie,
  SeanceDetailDto,
  ZoneCopie,
} from "@shared/schema";
import { CadreCopie, CopieProjetee, LecteurCopie, codeErreur, useCibleCopie, useCopieDirect } from "./copie-projetee";

type Tx = Traducteur<Parameters<typeof textesCopies>[0]>;

// ── Bouton d'en-tête ───────────────────────────────────────────────────────

/** Bouton du Studio : ouvre « Devoirs et copies ». Orange pendant qu'une copie est montrée. */
export function BoutonDevoirs({ actif, onClick }: { actif: boolean; onClick: () => void }) {
  const tx = useTextes(textesCopies);
  return (
    <Bouton variante={actif ? "nuit-actif" : "nuit"} icone={<ClipboardList className="h-4 w-4" />} onClick={onClick} title={tx("bouton.aide")}>
      {actif ? tx("bouton.actif") : tx("bouton")}
    </Bouton>
  );
}

// ── Petits outils ──────────────────────────────────────────────────────────

const dateCourte = (iso: string) => formaterDate(iso, { style: "court" });
const dateLimite = (iso: string) => formaterDate(iso, { style: "jourHeure" });

/** « Copie d'Awa K. », « Copie de Yao K. » : même règle que le serveur (deDevant). */
function etiquetteLocale(tx: Tx, nomVisible: boolean, prenom: string, initiale: string) {
  if (!nomVisible) return tx("classe.anonyme");
  return tx("classe.nom", { v: { de: deDevant(prenom), prenom, initiale } }).trim();
}

function resumeCopie(tx: Tx, r: CopieDuDirectDto["resume"]): string {
  const morceaux: string[] = [];
  const compte = (n: number, un: Parameters<Tx>[0], plusieurs: Parameters<Tx>[0]) => {
    if (n === 1) morceaux.push(tx(un));
    else if (n > 1) morceaux.push(tx(plusieurs, { v: { n } }));
  };
  compte(r.photos, "resume.photo", "resume.photos");
  if (r.pdf) morceaux.push(tx("resume.pdf", { v: { n: r.pdf } }));
  compte(r.documents, "resume.document", "resume.documents");
  compte(r.videos, "resume.video", "resume.videos");
  compte(r.sons, "resume.son", "resume.sons");
  compte(r.autres, "resume.autre", "resume.autres");
  if (r.texte) morceaux.push(tx("resume.texte"));
  return morceaux.join(" · ");
}

const ignorerTouche = (e: KeyboardEvent) => {
  const cible = e.target as HTMLElement | null;
  return Boolean(cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA" || cible.tagName === "SELECT" || cible.isContentEditable));
};

/** Ce qu'on regarde dans la vue : une copie d'étudiant, ou le corrigé du devoir (lot 5). */
type Choix = { genre: "copie"; renduId: number } | { genre: "corrige"; devoirId: number };
const memeChoix = (a: Choix | null, b: Choix | null) =>
  Boolean(a && b && a.genre === b.genre && (a.genre === "copie" ? a.renduId === (b as { renduId: number }).renduId : a.devoirId === (b as { devoirId: number }).devoirId));

// ── Vue « Devoirs et copies » ──────────────────────────────────────────────

export function VueDevoirs({ seance, etat, partageLocal, onFermer }: { seance: SeanceDetailDto; etat: EtatDirectDto; partageLocal: boolean; onFermer: () => void }) {
  const tx = useTextes(textesCopies);
  const id = seance.id;
  const enDirect = etat.statut === "en_direct" && !(etat.planB ?? seance.planB);
  const { projeter, revenirAuxDiapos, envoi } = useCopieDirect(id);
  // Geste retour du téléphone, Échap, focus : la vue se referme sans quitter le Studio. Échap dans la recherche
  // la vide d'abord.
  const vue = useRef<HTMLDivElement>(null);
  useVueSuperposee(vue, onFermer, {
    avantEchap: (e) => {
      const cible = e.target as HTMLInputElement | null;
      return Boolean(cible && cible.tagName === "INPUT" && cible.value);
    },
  });

  const liste = useQuery<ListeDevoirsDuDirectDto>({ queryKey: [`/api/seances/${id}/devoirs`], staleTime: 20_000 });
  const projete = useQuery<ProjectionCopieAnimateurDto | null>({ queryKey: [`/api/seances/${id}/projection/copie`], staleTime: 5_000 });
  const cleCopie = etat.copie?.cle ?? null;
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: [`/api/seances/${id}/projection/copie`] });
  }, [cleCopie, id]);
  const aLEcran = etat.copie ? (projete.data ?? null) : null;

  const [devoirId, setDevoirId] = useState<number | null>(null);
  const [changerDevoir, setChangerDevoir] = useState(false);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [numero, setNumero] = useState(1);
  const [rotation, setRotation] = useState<RotationCopie>(0);
  const [nomVisible, setNomVisible] = useState(false);
  const [enteteChoisi, setEnteteChoisi] = useState<boolean | null>(null);
  const [zoneApercu, setZoneApercu] = useState<ZoneCopie>("page");
  const [lecture, setLecture] = useState(false);
  const [confirmes, setConfirmes] = useState<Set<number>>(() => new Set());
  const [demande, setDemande] = useState<{ peuventRendre: number; dateLimite: string } | null>(null);
  const [etape, setEtape] = useState<"devoirs" | "copies" | "apercu">("devoirs");

  // Départ : le devoir de la copie à l'écran, sinon celui que le serveur suggère ; la copie à l'écran présélectionnée.
  const initialise = useRef(false);
  useEffect(() => {
    if (initialise.current || !liste.data || projete.isLoading) return;
    initialise.current = true;
    const p = etat.copie ? projete.data : null;
    const depart = p?.devoirId ?? liste.data.suggestion;
    if (depart === null || depart === undefined) return;
    setDevoirId(depart);
    setEtape("copies");
    if (p) {
      setChoix(p.source === "copie" && p.renduId ? { genre: "copie", renduId: p.renduId } : { genre: "corrige", devoirId: p.devoirId });
      setNumero(p.numero);
    }
  }, [liste.data, projete.isLoading, projete.data, etat.copie]);

  const devoirListe = liste.data?.devoirs.find((d) => d.id === devoirId) ?? null;
  const urlCopies = `/api/seances/${id}/devoirs/${devoirId}/copies`;
  const copies = useQuery<ListeCopiesDuDirectDto>({
    queryKey: [urlCopies],
    enabled: devoirId !== null && devoirListe?.type === "depot",
    refetchInterval: 30_000,
  });
  // Une copie arrive (formateurs du cours) : la liste se met à jour ; la direction relit toutes les 30 s.
  useTousEvenements((e) => {
    if (e.type === "copie-recue" && e.data?.devoirId === devoirId) void queryClient.invalidateQueries({ queryKey: [urlCopies] });
  });
  const devoir = copies.data?.devoir ?? devoirListe;

  const urlPlan = choix ? (choix.genre === "copie" ? `/api/seances/${id}/copies/${choix.renduId}` : `/api/seances/${id}/devoirs/${choix.devoirId}/corrige`) : null;
  const plan = useQuery<PlanCopieDto | PlanCorrigeDto>({
    queryKey: [urlPlan ?? ""],
    enabled: Boolean(urlPlan),
    staleTime: 60_000,
    refetchInterval: (q) => (q.state.data?.enPreparation ? 2000 : false),
  });
  const pages = plan.data?.pages ?? [];
  const page: PageCopieDto | null = pages[Math.min(Math.max(numero, 1), pages.length) - 1] ?? null;

  // Ce choix est-il celui que la classe voit déjà ? (copie, puis page)
  const choixALEcran = Boolean(
    aLEcran && choix && (choix.genre === "copie" ? aLEcran.source === "copie" && aLEcran.renduId === choix.renduId : aLEcran.source === "corrige" && aLEcran.devoirId === choix.devoirId),
  );
  const pageALEcran = choixALEcran && Boolean(page && aLEcran?.page === page.page);

  // Nouvelle page : rotation et haut caché reviennent à ceux de la page (ou à ceux de l'écran si la classe la
  // voit déjà) ; nouvelle copie : prénom masqué (ou tel qu'à l'écran).
  const clePage = `${urlPlan}:${page?.page ?? ""}`;
  useEffect(() => {
    if (pageALEcran && etat.copie) {
      setRotation(etat.copie.rotation);
      setEnteteChoisi(etat.copie.enteteMasque);
    } else {
      setRotation(page?.rotation ?? 0);
      setEnteteChoisi(null);
    }
    setZoneApercu("page");
  }, [clePage, pageALEcran]);
  const cleChoix = choix ? (choix.genre === "copie" ? `c${choix.renduId}` : `d${choix.devoirId}`) : "";
  useEffect(() => {
    setNomVisible(choixALEcran && etat.copie ? etat.copie.nomVisible : false);
    setDemande(null);
  }, [cleChoix, choixALEcran]);

  const enteteMasque = Boolean(page?.enteteDisponible && (enteteChoisi ?? page.enteteParDefaut));
  const urlApercu =
    choix && page
      ? choix.genre === "copie"
        ? // Haut caché : le serveur coupe le bord qui arrivera en haut une fois la page tournée (même image que la classe).
          `/api/seances/${id}/copies/${choix.renduId}/pages/${page.page}?entete=${enteteMasque ? 1 : 0}${enteteMasque ? `&rotation=${rotation}` : ""}`
        : `/api/seances/${id}/devoirs/${choix.devoirId}/corrige/pages/${page.page}`
      : null;
  const texteApercu = useQuery<{ texte: string }>({ queryKey: [urlApercu ?? ""], enabled: Boolean(urlApercu && page && page.contenu !== "image"), staleTime: 60_000 });

  // ← → et PageUp / PageDown changent la page de l'APERÇU (les diapos ne bougent pas tant que la vue est ouverte).
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (ignorerTouche(e) || !pages.length) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setNumero((n) => Math.min(pages.length, n + 1));
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setNumero((n) => Math.max(1, n - 1));
      }
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [pages.length]);

  const copieChoisie = choix?.genre === "copie" ? copies.data?.copies.find((c) => c.renduId === choix.renduId) : undefined;
  const etiquette =
    choix?.genre === "corrige" ? tx("classe.corrige") : etiquetteLocale(tx, nomVisible && !partageLocal, copieChoisie?.prenom ?? "", copieChoisie?.initiale ?? "");
  const vLegende = page && devoir ? { etiquette, devoir: devoir.titre, n: page.numero, total: pages.length } : null;
  const legende = vLegende ? tx("classe.legende", { v: vLegende }) : undefined;

  const memePage = Boolean(
    pageALEcran &&
      etat.copie &&
      etat.copie.rotation === rotation &&
      etat.copie.enteteMasque === enteteMasque &&
      (choix?.genre === "corrige" || etat.copie.nomVisible === nomVisible),
  );

  const lancer = async (confirmer: boolean) => {
    if (!choix || !page || !devoir) return;
    const corps: CorpsProjectionCopie =
      choix.genre === "copie"
        ? {
            source: "copie",
            renduId: choix.renduId,
            page: page.page,
            nomVisible,
            ...(page.enteteDisponible ? { enteteMasque } : {}),
            rotation,
            confirmerOuvert: confirmer || confirmes.has(devoir.id),
            // La version regardée : si l'étudiant l'a remplacée depuis, le serveur refuse (on regarde la nouvelle).
            ...(plan.data ? { version: plan.data.version } : {}),
          }
        : { source: "corrige", devoirId: choix.devoirId, page: page.page };
    const videoAvant = Boolean(etat.projection);
    try {
      await projeter(corps);
      onFermer();
      toast(videoAvant ? tx("toast.video") : tx("toast.projetee"));
    } catch (e) {
      const code = codeErreur(e);
      if (code === "devoir_ouvert") {
        const d = (e as { details?: { peuventRendre?: number; dateLimite?: string } }).details;
        setDemande({ peuventRendre: d?.peuventRendre ?? 0, dateLimite: d?.dateLimite ?? devoir.dateLimite });
        return;
      }
      if (code === "copie_changee") {
        // La nouvelle version s'affiche dans l'aperçu : le formateur la regarde avant de la montrer.
        void queryClient.invalidateQueries({ queryKey: [urlPlan ?? ""] });
        void queryClient.invalidateQueries({ queryKey: [urlCopies] });
        setNumero(1);
      }
      toastErreur(e);
    }
  };

  const choisirDevoir = (d: DevoirDuDirectDto) => {
    setDevoirId(d.id);
    setChangerDevoir(false);
    setChoix(null);
    setEtape("copies");
  };
  const choisir = (c: Choix, depart = 1) => {
    if (!memeChoix(c, choix)) setNumero(depart);
    setChoix(c);
    setEtape("apercu");
  };

  const nbMains = etat.mains.length;
  return createPortal(
    <div
      ref={vue}
      tabIndex={-1}
      className="fixed inset-0 z-[59] flex flex-col bg-nuit text-white outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={tx("vue.titre", { v: { code: seance.coursCode } })}
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-nuit-ligne px-4 py-3">
        <span className="flex items-center gap-2 text-lg font-black">
          <ClipboardList className="h-5 w-5 text-orange" /> {tx("vue.titre", { v: { code: liste.data?.coursCode || seance.coursCode } })}
        </span>
        {enDirect && (
          <span className="flex items-center gap-2 text-[13px] text-nuit-doux">
            <span className="h-2 w-2 animate-pulse rounded-full bg-direct" /> {tx("vue.direct")}
          </span>
        )}
        {nbMains > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-orange/15 px-2.5 py-1 text-[13px] font-bold text-orange-peche">
            <Hand className="h-3.5 w-3.5" /> {nbMains === 1 ? tx("vue.mains.une") : tx("vue.mains", { v: { n: nbMains } })}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {etat.copie && (
            <Bouton variante="nuit" taille="sm" icone={<Presentation className="h-4 w-4" />} onClick={() => void revenirAuxDiapos()}>
              {seance.diapos.length ? tx("copie.revenir") : tx("copie.arreter")}
            </Bouton>
          )}
          <Bouton variante="nuit-actif" taille="sm" onClick={onFermer} icone={<ArrowLeft className="h-4 w-4" />}>
            {tx("vue.revenir")}
          </Bouton>
        </div>
      </header>
      {partageLocal && (
        <p className="flex items-center gap-2 bg-orange px-4 py-2 text-[14px] font-bold text-encre" role="alert">
          <MonitorUp className="h-4 w-4 shrink-0" /> {tx("vue.partage")}
        </p>
      )}
      {!enDirect && <p className="border-b border-nuit-ligne bg-nuit-panneau px-4 py-2 text-[14px] text-nuit-doux">{tx("vue.avantDirect")}</p>}

      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-3 lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:content-stretch lg:overflow-hidden">
        {/* Colonne de gauche : 1. le devoir, 2. les copies */}
        <div className={cn("min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1", etape === "apercu" ? "hidden lg:flex" : "flex")}>
          {liste.isLoading ? (
            <EtatVue icone={<Loader2 className="h-5 w-5 animate-spin" />} texte={tx("vue.chargement")} />
          ) : liste.error ? (
            <EtatVue
              icone={<AlertTriangle className="h-5 w-5" />}
              texte={tx("vue.erreur")}
              action={
                <Bouton variante="nuit" taille="sm" onClick={() => void liste.refetch()}>
                  {tx("vue.reessayer")}
                </Bouton>
              }
            />
          ) : (
            <>
              <section className={cn("flex-col gap-2 rounded-[18px] bg-nuit-panneau p-3", etape === "devoirs" ? "flex" : "hidden", changerDevoir || !devoir ? "lg:flex" : "lg:hidden")}>
                <h2 className="px-1 font-mono text-[11px] uppercase tracking-wider text-orange-peche">{tx("devoirs.titre")}</h2>
                {!liste.data?.devoirs.length && <p className="px-1 text-[14px] text-nuit-doux">{tx("devoirs.vide")}</p>}
                {liste.data?.devoirs.map((d) => (
                  <CarteDevoir key={d.id} tx={tx} devoir={d} actif={d.id === devoirId} aLEcran={aLEcran?.devoirId === d.id} onChoisir={() => choisirDevoir(d)} />
                ))}
              </section>
              {devoir && (
                <div className={cn("flex-col gap-3", etape === "copies" ? "flex" : "hidden", changerDevoir ? "lg:hidden" : "lg:flex")}>
                  <div className="flex flex-col gap-2 rounded-[18px] bg-nuit-panneau p-3">
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => setEtape("devoirs")} className="flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-orange-peche lg:hidden">
                        <ChevronLeft className="h-4 w-4" /> {tx("copies.retour")}
                      </button>
                      <button type="button" onClick={() => setChangerDevoir(true)} className="ml-auto hidden min-h-9 items-center rounded-lg px-2 text-[13px] font-bold text-orange-peche hover:bg-nuit-carte lg:flex">
                        {tx("devoirs.changer")}
                      </button>
                    </div>
                    <CarteDevoir tx={tx} devoir={devoir} actif aLEcran={aLEcran?.devoirId === devoir.id} />
                    {devoir.corrige && (
                      <CarteCorrige tx={tx} devoir={devoir} actif={choix?.genre === "corrige"} onVoir={() => choisir({ genre: "corrige", devoirId: devoir.id })} />
                    )}
                  </div>
                  {devoir.type === "quiz" ? (
                    <p className="rounded-[18px] bg-nuit-panneau p-4 text-[14px] text-nuit-doux">{tx("devoirs.quiz")}</p>
                  ) : (
                    <ListeCopies
                      tx={tx}
                      chargement={copies.isLoading}
                      copies={copies.data?.copies ?? []}
                      choisie={choix?.genre === "copie" ? choix.renduId : null}
                      aLEcran={aLEcran?.source === "copie" ? aLEcran.renduId : null}
                      anonyme={partageLocal}
                      onChoisir={(c) => choisir({ genre: "copie", renduId: c.renduId }, aLEcran?.renduId === c.renduId ? aLEcran.numero : 1)}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Colonne de droite : 3. l'aperçu (grand), puis les pages, les réglages et « Projeter à la classe » */}
        <section className={cn("min-h-0 flex-col gap-3 rounded-[18px] bg-nuit-panneau p-3 sm:p-4 lg:overflow-y-auto xl:overflow-hidden", etape === "apercu" ? "flex" : "hidden lg:flex")}>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setEtape("copies")} className="flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-orange-peche lg:hidden">
              <ChevronLeft className="h-4 w-4" /> {tx("copies.titre")}
            </button>
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-orange-peche">{tx("apercu.titre")}</h2>
            {plan.data?.nomCourt && !partageLocal && <span className="text-[14px] font-bold text-white">{plan.data.nomCourt}</span>}
          </div>
          {!choix ? (
            <EtatVue icone={<ClipboardList className="h-5 w-5" />} texte={tx("apercu.choisir")} />
          ) : plan.isLoading ? (
            <EtatVue icone={<Loader2 className="h-5 w-5 animate-spin" />} texte={tx("apercu.preparation")} />
          ) : plan.error ? (
            <EtatVue icone={<AlertTriangle className="h-5 w-5" />} texte={(plan.error as Error).message} />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:grid-rows-[minmax(0,1fr)]">
              {/* L'aperçu, aussi grand que possible : on y lit la copie avant de la montrer. */}
              <div className="flex min-h-0 flex-col gap-2">
                <p className="text-[13px] text-nuit-gris">{tx("apercu.prive")}</p>
                {page ? (
                  <CadreCopie
                    src={page.contenu === "image" ? urlApercu : null}
                    contenu={page.contenu}
                    texte={texteApercu.data?.texte}
                    rotation={rotation}
                    zone={zoneApercu}
                    legende={legende}
                    legendeCourte={vLegende ? tx("classe.legendeCourte", { v: vLegende }) : undefined}
                    erreur={tx("apercu.erreur")}
                    onAgrandir={() => setLecture(true)}
                    boutonAgrandir={false}
                    chargement={
                      <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 font-mono text-sm text-orange-peche">
                        <Loader2 className="h-4 w-4 animate-spin" /> {tx("apercu.preparation")}
                      </span>
                    }
                    className="aspect-[4/3] w-full shrink-0 rounded-[14px] border-2 border-nuit-ligne sm:aspect-video lg:aspect-auto lg:h-[46vh] xl:h-auto xl:min-h-0 xl:flex-1"
                  />
                ) : (
                  <div className="grid aspect-video place-items-center rounded-[14px] bg-nuit-carte p-4 text-center text-[14px] text-nuit-doux lg:aspect-auto lg:h-[46vh] xl:h-auto xl:flex-1">
                    {plan.data?.enPreparation ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> {tx("apercu.preparationDoc")}
                      </span>
                    ) : (
                      tx("non.rien")
                    )}
                  </div>
                )}
                {page && (
                  <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={tx("apercu.zoom")}>
                    <span className="mr-1 text-[12px] font-bold text-nuit-doux">{tx("copie.zoom")}</span>
                    {ZONES.map((z) => (
                      <button
                        key={z}
                        type="button"
                        role="radio"
                        aria-checked={zoneApercu === z}
                        onClick={() => setZoneApercu(z)}
                        className={cn("min-h-9 rounded-lg px-2.5 text-[12px] font-semibold", zoneApercu === z ? "bg-white text-encre ring-2 ring-orange" : "bg-nuit-carte text-white hover:bg-nuit-ligne")}
                      >
                        {tx(`zone.${z}`)}
                      </button>
                    ))}
                    <span className="ml-auto flex flex-wrap gap-1.5">
                      {page.contenu === "image" && (
                        <Bouton variante="nuit" taille="sm" className="min-h-9 bg-nuit-carte" icone={<RotateCw className="h-4 w-4" />} onClick={() => setRotation((r) => ((r + 90) % 360) as RotationCopie)}>
                          {tx("apercu.tourner")}
                        </Bouton>
                      )}
                      <Bouton variante="nuit" taille="sm" className="min-h-9 bg-nuit-carte" icone={<Maximize2 className="h-4 w-4" />} onClick={() => setLecture(true)}>
                        {tx("apercu.lire")}
                      </Bouton>
                    </span>
                  </div>
                )}
              </div>

              {/* Pages, réglages, puis « Projeter à la classe » (collé en bas). */}
              <div className="flex min-h-0 flex-col gap-3 xl:overflow-y-auto xl:pr-1">
                {pages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Bouton variante="nuit" taille="sm" className="min-h-11 min-w-11" aria-label={tx("apercu.precedente")} disabled={numero <= 1} onClick={() => setNumero((n) => Math.max(1, n - 1))} icone={<ChevronLeft className="h-4 w-4" />} />
                    {pages.map((p) => (
                      <button
                        key={p.page}
                        type="button"
                        title={p.libelle}
                        aria-label={p.libelle}
                        aria-current={p.numero === page?.numero ? "true" : undefined}
                        onClick={() => setNumero(p.numero)}
                        className={cn(
                          "relative min-h-11 min-w-11 rounded-xl px-2 text-[14px] font-bold transition-colors",
                          p.numero === page?.numero ? "bg-white text-encre ring-2 ring-orange" : "bg-nuit-carte text-white hover:bg-nuit-ligne",
                        )}
                      >
                        {p.numero}
                        {choixALEcran && aLEcran?.page === p.page && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-nuit-panneau bg-orange" aria-hidden />}
                      </button>
                    ))}
                    <Bouton variante="nuit" taille="sm" className="min-h-11 min-w-11" aria-label={tx("apercu.suivante")} disabled={numero >= pages.length} onClick={() => setNumero((n) => Math.min(pages.length, n + 1))} icone={<ChevronRight className="h-4 w-4" />} />
                    {page && <span className="basis-full text-[13px] text-nuit-doux">{page.libelle}</span>}
                  </div>
                )}
                {plan.data && (plan.data.nonProjetables.length > 0 || plan.data.pagesEnTrop > 0 || (plan.data.enPreparation && page)) && (
                  <ul className="flex flex-col gap-1.5 text-[13px] text-nuit-doux">
                    {plan.data.enPreparation && page && (
                      <li className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-orange-peche" /> {tx("apercu.preparationProjeter")}
                      </li>
                    )}
                    {plan.data.nonProjetables.map((n, i) => (
                      <li key={`${n.fichierId ?? "x"}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-bold text-nuit-texte">{n.libelle}</span>
                        <span>{tx(`non.${n.raison}` as Parameters<Tx>[0])}</span>
                        {n.raison === "video" && (
                          <a href={`/enseigner/devoirs/${plan.data!.devoirId}/copies`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-orange-peche underline">
                            {tx("non.video.lien")} <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </li>
                    ))}
                    {plan.data.pagesEnTrop > 0 && <li>{tx("non.pages", { v: { max: 30 } })}</li>}
                  </ul>
                )}
                {page && (
                  <div className="flex flex-col gap-2.5 rounded-[14px] bg-nuit-carte p-3">
                    {page.enteteDisponible ? (
                      <Reglage libelle={tx("apercu.entete")} aide={tx("apercu.entete.aide")} actif={enteteMasque} onChange={(v) => setEnteteChoisi(v)} />
                    ) : (
                      page.contenu === "image" && (
                        <p className="flex items-start gap-2 text-[13px] text-orange-peche">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {tx("apercu.entete.indispo")}
                        </p>
                      )
                    )}
                    {choix.genre === "copie" && (
                      <Reglage
                        libelle={tx("apercu.nom")}
                        aide={partageLocal ? undefined : tx("apercu.nom.aide", { v: { etiquette: etiquetteLocale(tx, nomVisible, copieChoisie?.prenom ?? "", copieChoisie?.initiale ?? "") } })}
                        actif={nomVisible}
                        onChange={setNomVisible}
                      />
                    )}
                  </div>
                )}
                {/* Barre d'action : collée en bas (téléphone, et colonne des réglages sur grand écran). */}
                <div className="sticky -bottom-3 z-[5] -mx-3 -mb-3 mt-auto flex flex-col gap-2 border-t border-nuit-ligne bg-nuit-panneau px-3 pb-3 pt-3 sm:-bottom-4 sm:-mx-4 sm:-mb-4 sm:px-4 sm:pb-4 xl:bottom-0 xl:mx-0 xl:mb-0 xl:px-0 xl:pb-0">
                  {demande && devoir ? (
                    <div className="flex flex-col gap-2 rounded-[14px] border-2 border-orange bg-nuit-carte p-3" role="alertdialog" aria-label={tx("ouvert.titre")}>
                      <p className="flex items-center gap-2 text-[15px] font-extrabold text-white">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-orange" /> {tx("ouvert.titre")}
                      </p>
                      <p className="text-[14px] text-nuit-texte">
                        {demande.peuventRendre === 1
                          ? tx("ouvert.texte.un", { v: { date: dateLimite(demande.dateLimite) } })
                          : tx("ouvert.texte", { v: { n: demande.peuventRendre, date: dateLimite(demande.dateLimite) } })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Bouton
                          variante="nuit-actif"
                          chargement={envoi}
                          onClick={() => {
                            setConfirmes((s) => new Set(s).add(devoir.id));
                            setDemande(null);
                            void lancer(true);
                          }}
                        >
                          {tx("ouvert.confirmer")}
                        </Bouton>
                        <Bouton variante="nuit" onClick={() => setDemande(null)}>
                          {tx("ouvert.annuler")}
                        </Bouton>
                      </div>
                    </div>
                  ) : (
                    <>
                      {choix.genre === "copie" && devoir && devoir.etat === "retards" && devoir.peuventEncoreRendre > 0 && (
                        <p className="flex items-start gap-2 text-[13px] text-orange-peche">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          {devoir.peuventEncoreRendre === 1 ? tx("apercu.retards.un") : tx("apercu.retards", { v: { n: devoir.peuventEncoreRendre } })}
                        </p>
                      )}
                      <Bouton
                        variante="nuit-actif"
                        taille="lg"
                        pleineLargeur
                        className="min-h-14"
                        icone={<Presentation className="h-5 w-5" />}
                        chargement={envoi}
                        disabled={!enDirect || !page || memePage}
                        onClick={() => void lancer(false)}
                      >
                        {envoi ? tx("apercu.envoi") : etat.copie && !memePage ? tx("apercu.projeterPlace") : tx("apercu.projeter")}
                      </Bouton>
                      <p className="text-center text-[12px] text-nuit-gris">{!enDirect ? tx("vue.avantDirect") : memePage ? tx("apercu.dejaProjetee") : tx("apercu.projeter.aide")}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
      {lecture && page && (
        <LecteurCopie
          src={page.contenu === "image" ? urlApercu : null}
          contenu={page.contenu}
          texte={texteApercu.data?.texte}
          rotation={rotation}
          titre={[plan.data?.nomCourt && !partageLocal ? plan.data.nomCourt : null, page.libelle].filter(Boolean).join(" · ")}
          onFermer={() => setLecture(false)}
        />
      )}
    </div>,
    document.body,
  );
}

function EtatVue({ icone, texte, action }: { icone: ReactNode; texte: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] bg-nuit-panneau px-4 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-nuit-ligne text-orange">{icone}</span>
      <p className="max-w-sm text-[14px] text-nuit-texte">{texte}</p>
      {action}
    </div>
  );
}

function Reglage({ libelle, aide, actif, onChange }: { libelle: string; aide?: string; actif: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-[14px] font-bold text-white">{libelle}</span>
        {aide && <span className="text-[12px] leading-snug text-nuit-doux">{aide}</span>}
      </span>
      <Interrupteur actif={actif} onChange={onChange} libelle={libelle} />
    </label>
  );
}

function CarteDevoir({ tx, devoir, actif, aLEcran, onChoisir }: { tx: Tx; devoir: DevoirDuDirectDto; actif?: boolean; aLEcran?: boolean; onChoisir?: () => void }) {
  const rendues =
    devoir.type === "quiz"
      ? null
      : devoir.copiesRendues === 0
        ? tx("devoirs.rendues.zero")
        : devoir.copiesRendues === 1
          ? tx("devoirs.rendues.une", { v: { inscrits: devoir.inscrits } })
          : tx("devoirs.rendues", { v: { n: devoir.copiesRendues, inscrits: devoir.inscrits } });
  const ouvert = new Date(devoir.dateLimite).getTime() >= Date.now();
  const contenu = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-extrabold leading-snug text-white">{devoir.titre}</span>
        {aLEcran && <span className="shrink-0 rounded-full bg-orange px-2 py-0.5 text-[11px] font-black text-encre">{tx("copies.aLEcran")}</span>}
      </span>
      {devoir.type === "quiz" ? (
        <span className="text-[13px] text-nuit-doux">{tx("devoirs.quiz")}</span>
      ) : (
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-nuit-doux">
          <span>{rendues}</span>
          <span>{ouvert ? tx("devoirs.ouvert", { v: { date: dateCourte(devoir.dateLimite) } }) : tx("devoirs.limite", { v: { date: dateCourte(devoir.dateLimite) } })}</span>
          {devoir.accepteRetard && <span className="text-orange-peche">{tx("devoirs.retards")}</span>}
        </span>
      )}
    </>
  );
  if (!onChoisir) return <div className="flex flex-col gap-1 rounded-xl border border-orange/50 bg-nuit-carte px-3 py-2.5">{contenu}</div>;
  return (
    <button
      type="button"
      onClick={onChoisir}
      className={cn("flex min-h-11 flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors", actif ? "border-orange bg-nuit-carte" : "border-nuit-ligne bg-nuit-carte hover:border-orange-peche/60")}
    >
      {contenu}
    </button>
  );
}

function CarteCorrige({ tx, devoir, actif, onVoir }: { tx: Tx; devoir: DevoirDuDirectDto; actif: boolean; onVoir: () => void }) {
  const c = devoir.corrige;
  if (!c) return null;
  const raison = c.montrable
    ? null
    : c.raison === "absent"
      ? tx("corrige.absent")
      : c.raison === "non_valide"
        ? tx("corrige.nonValide")
        : c.raison === "avant_limite"
          ? tx("corrige.avantLimite", { v: { date: dateCourte(devoir.dateLimite) } })
          : c.raison === "retards"
            ? tx("corrige.retards")
            : (c.n ?? 0) === 1
              ? tx("corrige.notes.une")
              : tx("corrige.notes", { v: { n: c.n ?? 0 } });
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-xl border px-3 py-2.5", actif ? "border-orange" : "border-nuit-ligne")}>
      <span className="flex items-center gap-2 text-[14px] font-bold text-white">
        <BookCheck className="h-4 w-4 text-orange" /> {tx("corrige.titre")}
      </span>
      {c.montrable ? (
        <>
          <span className="text-[12px] text-nuit-doux">{tx("corrige.montrable")}</span>
          <Bouton variante="nuit" taille="sm" className="self-start bg-nuit-panneau" onClick={onVoir}>
            {tx("corrige.projeter")}
          </Bouton>
        </>
      ) : (
        <span className="text-[12px] leading-snug text-nuit-doux">{raison}</span>
      )}
    </div>
  );
}

function ListeCopies({
  tx,
  chargement,
  copies,
  choisie,
  aLEcran,
  anonyme,
  onChoisir,
}: {
  tx: Tx;
  chargement: boolean;
  copies: CopieDuDirectDto[];
  choisie: number | null;
  aLEcran: number | null;
  anonyme: boolean;
  onChoisir: (c: CopieDuDirectDto) => void;
}) {
  const [recherche, setRecherche] = useState("");
  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!q || anonyme) return copies.map((c, i) => ({ c, n: i + 1 }));
    return copies
      .map((c, i) => ({ c, n: i + 1 }))
      .filter(({ c }) => `${c.prenom} ${c.initiale}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q));
  }, [copies, recherche, anonyme]);
  return (
    <section className="flex flex-col gap-2 rounded-[18px] bg-nuit-panneau p-3">
      <h2 className="px-1 font-mono text-[11px] uppercase tracking-wider text-orange-peche">{tx("copies.titre")}</h2>
      <p className="px-1 text-[12px] leading-snug text-nuit-gris">{tx("copies.info")}</p>
      {copies.length > 12 && !anonyme && (
        <label className="flex items-center gap-2 rounded-xl border border-nuit-ligne bg-nuit-carte px-3">
          <Search className="h-4 w-4 text-nuit-gris" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => {
              // Échap vide la recherche (la vue reste ouverte) ; un second Échap referme la vue.
              if (e.key === "Escape" && recherche) {
                e.stopPropagation();
                setRecherche("");
              }
            }}
            placeholder={tx("copies.recherche")}
            className="min-h-11 w-full bg-transparent text-[14px] text-white placeholder:text-nuit-gris focus:outline-none"
          />
        </label>
      )}
      {chargement && (
        <p className="flex items-center gap-2 px-1 text-[14px] text-nuit-doux">
          <Loader2 className="h-4 w-4 animate-spin" /> {tx("vue.chargement")}
        </p>
      )}
      {!chargement && !copies.length && <p className="px-1 text-[14px] text-nuit-doux">{tx("copies.vide")}</p>}
      {!chargement && copies.length > 0 && !filtrees.length && <p className="px-1 text-[14px] text-nuit-doux">{tx("copies.aucunResultat")}</p>}
      <ul className="flex flex-col gap-1.5">
        {filtrees.map(({ c, n }) => (
          <li key={c.renduId}>
            <button
              type="button"
              onClick={() => onChoisir(c)}
              aria-pressed={c.renduId === choisie}
              className={cn(
                "flex min-h-11 w-full flex-col gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors",
                c.renduId === choisie ? "border-orange bg-nuit-carte" : "border-nuit-ligne bg-nuit-carte hover:border-orange-peche/60",
              )}
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[15px] font-extrabold text-white">{anonyme ? tx("copies.anonyme", { v: { n } }) : `${c.prenom} ${c.initiale}`}</span>
                {!anonyme && c.site && <span className="text-[13px] text-nuit-doux">· {c.site}</span>}
                <span className="text-[13px] text-nuit-doux">· {tx("copies.rendueLe", { v: { date: dateCourte(c.renduLe) } })}</span>
                {c.enRetard && <span className="rounded-full bg-direct/20 px-2 py-0.5 text-[11px] font-bold text-orange-peche">{tx("copies.retard")}</span>}
                {c.renduId === aLEcran && <span className="rounded-full bg-orange px-2 py-0.5 text-[11px] font-black text-encre">{tx("copies.aLEcran")}</span>}
              </span>
              <span className="text-[12px] text-nuit-gris">{resumeCopie(tx, c.resume)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Copie à l'écran : à la place du panneau présentateur ───────────────────

const ZONES: ZoneCopie[] = ["page", "haut", "milieu", "bas"];

/**
 * La copie telle que les salles la voient, « Revenir aux diapos » (en haut : toujours visible sans défiler),
 * ses pages, puis ses réglages. Dans le Studio à la place du panneau présentateur ; « grand » dans la fenêtre
 * présentateur. Un animateur qui ne lit pas les copies (vie scolaire sans « notes ») n'a que le retour aux diapos.
 */
export function PanneauCopieEnCours({ seance, etat, grand }: { seance: SeanceDetailDto; etat: EtatDirectDto; grand?: boolean }) {
  const tx = useTextes(textesCopies);
  const { allerPage, regler, revenirAuxDiapos, envoi } = useCopieDirect(seance.id);
  const cible = useCibleCopie(seance.id);
  const copie = etat.copie;
  if (!copie) return null;
  const avecDiapos = seance.diapos.length > 0;
  const diapoRevient = avecDiapos && Boolean(etat.diapo.url);
  const pilote = seance.peutMontrerCopies;
  // Page visée (envoi en cours) : les boutons se grisent d'après elle, jamais de retour aux diapos par eux.
  const vise = cible ?? copie.numero;
  const retour = (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="inline-flex items-center gap-2 font-mono text-xs font-bold text-orange-peche">
        <span className="h-2 w-2 animate-pulse rounded-full bg-orange" />
        {tx(copie.source === "corrige" ? "copie.etatCorrige" : "copie.etat", { v: { n: copie.numero, total: copie.total } })}
        {envoi && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label={tx("copie.envoi")} />}
      </span>
      <Bouton variante="nuit-actif" taille="lg" pleineLargeur className="min-h-14" icone={<Presentation className="h-5 w-5" />} onClick={() => void revenirAuxDiapos()}>
        {avecDiapos ? tx("copie.revenir") : tx("copie.arreter")}
      </Bouton>
      <p className="-mt-1 text-[12px] leading-snug text-nuit-doux">
        {diapoRevient ? tx("copie.revenir.diapo", { v: { n: etat.diapo.index + 1 } }) : tx("copie.revenir.cameras")}
        {pilote ? ` ${tx("copie.touches")}` : ""}
      </p>
      {pilote && (
        <div className="grid grid-cols-2 gap-2">
          <Bouton variante="nuit" taille="sm" className="min-h-11" disabled={vise <= 1} onClick={() => allerPage(-1, { borne: true })} icone={<ChevronLeft className="h-4 w-4 shrink-0" />}>
            {tx("apercu.precedente")}
          </Bouton>
          <Bouton variante="nuit" taille="sm" className="min-h-11" disabled={vise >= copie.total} onClick={() => allerPage(1, { borne: true })} icone={<ChevronRight className="h-4 w-4 shrink-0" />}>
            {tx("apercu.suivante")}
          </Bouton>
        </div>
      )}
    </div>
  );
  const reglages = pilote ? (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={tx("copie.zoom")} title={tx("copie.zoom.aide")}>
        <span className="mr-1 text-[12px] font-bold text-nuit-doux">{tx("copie.zoom")}</span>
        {ZONES.map((z) => (
          <button
            key={z}
            type="button"
            role="radio"
            aria-checked={copie.zone === z}
            onClick={() => regler({ zone: z })}
            className={cn("min-h-9 rounded-lg px-2.5 text-[12px] font-semibold", copie.zone === z ? "bg-white text-encre ring-2 ring-orange" : "bg-nuit-carte text-white hover:bg-nuit-ligne")}
          >
            {tx(`zone.${z}`)}
          </button>
        ))}
        {copie.contenu === "image" && (
          <Bouton
            variante="nuit"
            taille="sm"
            className="min-h-9"
            icone={<RotateCw className="h-4 w-4" />}
            // Haut caché : la nouvelle image vient du serveur, un second appui attend la première.
            disabled={envoi && copie.enteteMasque}
            onClick={() => regler({ rotation: ((copie.rotation + 90) % 360) as RotationCopie })}
          >
            {tx("apercu.tourner")}
          </Bouton>
        )}
      </div>
      {copie.source === "copie" && <Reglage libelle={tx("apercu.nom")} actif={copie.nomVisible} onChange={(v) => regler({ nomVisible: v })} />}
      {copie.enteteDisponible && <Reglage libelle={tx("apercu.entete")} actif={copie.enteteMasque} onChange={(v) => regler({ enteteMasque: v })} />}
    </div>
  ) : null;
  if (grand) {
    return (
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_300px]">
        <CopieProjetee copie={copie} className="h-full min-h-[40vh] rounded-[18px] border-2 border-orange" />
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {retour}
          {reglages}
        </aside>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {retour}
      <CopieProjetee copie={copie} className="aspect-video h-auto rounded-[18px] border-2 border-orange" />
      {reglages}
    </div>
  );
}
