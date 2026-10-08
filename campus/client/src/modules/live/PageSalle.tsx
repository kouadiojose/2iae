// /salle — écran de la salle de conférence (kiosque) : plein écran, lisible
// du fond de la salle, AUCUN clic nécessaire. Avant le cours : compte à
// rebours géant, carte des campus qui s'allument, code d'émargement + QR
// renouvelés chaque minute. Pendant : la visio en grand, « M'BATTO A LA
// PAROLE », la question en cours, les résultats des sondages par campus.
// Une petite console en bas sert au responsable de salle. Aucun nom
// d'étudiant n'est jamais affiché ici.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Hand, Minus, Plus, CheckCircle2, CircleAlert, Maximize, MonitorPlay, Eye, EyeOff, X, MessageSquare, LogOut, ArrowLeft, Video } from "lucide-react";
import { get, post, put, suppr } from "@/lib/api";
import { accueilDuRole, seDeconnecter, useMoiConnecte } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { heure, dateEtHeure, decompte } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { toastErreur, Toasts } from "@/components/ui/toast";
import { Scene, usePetitEcran } from "./scene";
import { PanneauDiscussion, useNonLusDiscussion } from "./discussion";
import { BoutonLienInvite } from "./LienInvite";
import { ResultatsParCampus } from "./panneaux";
import { CarteCoteIvoire } from "./CarteCoteIvoire";
import { cleDirect, useEcranAllume, useEtatDirect, useSeance } from "./outils";
import { VueGroupeSalle, monGroupe, useGroupes } from "./groupes";
import { EmargementPleinEcran, GuideChargeDeCours, cheminEmargement, useCodeSalle } from "./EmargementSalle";
import { LimiteSilencieuse } from "@/components/ui/limite-silencieuse";
// Emplacement du plan d'engagement (campus/ENGAGEMENT.md) : sans cours et avant le cours, jamais pendant.
import { CoupeSalle } from "@/modules/progression/CoupeSalle";
import type { EtatDirectDto, MainDirectDto, SeanceDetailDto } from "@shared/schema";
import type { EnCours, SeanceResume } from "@shared/api";

const INCIDENTS = ["Son coupé", "Image figée", "Plus d'électricité", "Plus d'internet", "Salle bruyante"];

export default function PageSalle() {
  const moi = useMoiConnecte();
  useEcranAllume(true);
  const siteParam = Number(new URLSearchParams(window.location.search).get("site")) || null;
  const siteId = moi.role === "salle" || (moi.role === "vie_scolaire" && moi.siteId) ? moi.siteId : siteParam ?? 1;

  // Seulement les cours que suit ce campus (le serveur l'impose à l'écran d'une salle ; l'équipe précise le site) :
  // un autre campus qui démarre, ou l'essai de visio d'un collègue, ne fait pas quitter la classe en cours.
  const site = siteId ? `site=${siteId}` : "";
  const { data: enCours } = useQuery<EnCours>({ queryKey: [`/api/live/en-cours${site ? `?${site}` : ""}`], refetchInterval: 30_000 });
  const { data: duJour } = useQuery<SeanceResume[]>({ queryKey: [`/api/seances?periode=jour${site ? `&${site}` : ""}`], refetchInterval: 60_000 });
  // Séance à afficher : celle en direct, sinon la prochaine, sinon la dernière du jour (annulée ou terminée).
  const seanceId = enCours?.enDirect?.id ?? enCours?.prochaine?.id ?? duJour?.[duJour.length - 1]?.id ?? null;

  return (
    <div className="min-h-dvh bg-nuit text-white">
      {seanceId ? <EcranSeance seanceId={seanceId} siteId={siteId} /> : <EcranSansCours siteId={siteId} enCours={enCours} />}
      <Toasts />
    </div>
  );
}

/** Préférence de l'écran de salle, gardée sur cet ordinateur (elle survit au rechargement de la page). */
function usePreferenceSalle(cle: string): [boolean, (v: boolean) => void] {
  const [valeur, setValeur] = useState(() => {
    try {
      return localStorage.getItem(cle) === "1";
    } catch {
      return false;
    }
  });
  const changer = useCallback(
    (v: boolean) => {
      setValeur(v);
      try {
        localStorage.setItem(cle, v ? "1" : "0");
      } catch {
        /* navigateur sans stockage : la préférence vaut pour la page ouverte */
      }
    },
    [cle],
  );
  return [valeur, changer];
}

/** Plein écran possible dans ce navigateur (pas sur iPhone : le bouton n'y ferait rien). */
const pleinEcranPossible = () => typeof document !== "undefined" && Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);

/**
 * Quitter l'écran : le compte d'une salle se déconnecte (après confirmation : l'écran ne reçoit plus les
 * cours tant qu'on ne le réinstalle pas) ; l'équipe revient au campus.
 */
function BoutonQuitter() {
  const moi = useMoiConnecte();
  const classe = "flex items-center gap-1.5 rounded-full p-2 font-mono text-[12px] text-nuit-gris hover:text-white";
  if (moi.role !== "salle") {
    return (
      <a href={accueilDuRole(moi.role)} className={classe} title="Revenir au campus">
        <ArrowLeft className="h-5 w-5" /> <span className="hidden xl:inline">Campus</span>
      </a>
    );
  }
  const quitter = () => {
    if (window.confirm("Déconnecter cet écran ?\n\nLa salle ne recevra plus les cours sur cet appareil tant qu'il n'est pas reconnecté (lien d'installation de la salle, ou identifiant et mot de passe).")) void seDeconnecter();
  };
  return (
    <button onClick={quitter} className={classe} aria-label="Déconnecter cet écran" title="Déconnecter cet écran">
      <LogOut className="h-5 w-5" /> <span className="hidden xl:inline">Déconnexion</span>
    </button>
  );
}

function BandeauHaut({ seance, siteId, onPresentation }: { seance?: SeanceDetailDto; siteId: number | null; onPresentation?: () => void }) {
  const maintenant = useMaintenant(1000);
  const site = seance?.sites.find((s) => s.id === siteId);
  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:flex-wrap sm:gap-4 sm:px-6 sm:pt-5 lg:px-10">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <img src="/marque-2iae-detouree.png" alt="Groupe Écoles 2IAE International" className="h-9 w-auto shrink-0 sm:h-12" />
        <span className="min-w-0 font-mono text-[11px] uppercase leading-snug tracking-[0.12em] text-nuit-doux sm:text-sm sm:tracking-[0.14em] lg:text-base">
          {site ? `${site.salleConference} · ${site.nomCourt}` : "Salle de conférence"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {seance && (
          <span className="hidden items-center gap-2 rounded-full bg-[#2A1510] px-4 py-2 font-mono text-sm text-[#FF8A6B] md:flex">
            <span className="point-direct" />
            {seance.fournisseur === "daily" ? "Ce cours est enregistré" : "Questions et sous-titres gardés pour le replay"}
          </span>
        )}
        {onPresentation && (
          <button
            onClick={onPresentation}
            className="flex min-h-11 items-center gap-2 rounded-full bg-orange px-4 text-[15px] font-bold text-encre hover:bg-orange-peche"
            title="La diapo seule, en plein écran (touche P)"
          >
            <MonitorPlay className="h-5 w-5" /> Présentation seule
          </button>
        )}
        <span className="font-mono text-xl tabular-nums text-white sm:text-2xl lg:text-3xl">{heure(maintenant)}</span>
        {pleinEcranPossible() && (
          <button
            onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
            className="rounded-full p-2 text-nuit-gris hover:text-white"
            aria-label="Plein écran"
          >
            <Maximize className="h-5 w-5" />
          </button>
        )}
        <BoutonQuitter />
      </div>
    </header>
  );
}

function EcranSansCours({ siteId, enCours }: { siteId: number | null; enCours?: EnCours }) {
  return (
    <>
      <BandeauHaut siteId={siteId} />
      <div className="grid min-h-[80dvh] place-items-center px-6 text-center">
        <div className="flex max-w-3xl flex-col items-center gap-5">
          <span className="etiquette text-orange-peche">Campus numérique 2IAE</span>
          <p className="text-[clamp(36px,5vw,80px)] font-black leading-none tracking-serre">Aucun cours aujourd'hui dans cette salle.</p>
          {enCours?.prochaine ? (
            <p className="text-2xl text-nuit-doux">Prochain live : {enCours.prochaine.titre} · {dateEtHeure(enCours.prochaine.debut)}</p>
          ) : (
            <p className="text-2xl text-nuit-doux">Cet écran s'allumera tout seul avant le prochain live.</p>
          )}
          <LimiteSilencieuse nom="CoupeSalle">
            <CoupeSalle siteId={siteId} />
          </LimiteSilencieuse>
        </div>
      </div>
    </>
  );
}

function EcranSeance({ seanceId, siteId }: { seanceId: number; siteId: number | null }) {
  const moi = useMoiConnecte();
  const { data: seance } = useSeance(seanceId);
  const { data: etat } = useEtatDirect(seanceId, false);
  // Groupe de travail : la salle quitte la classe pour la visio de son groupe, puis revient.
  const { data: groupes } = useGroupes(seanceId);
  // Téléphone : tout s'empile et défile (visio, diapo, code, console) ; pas de présentation seule.
  const petit = usePetitEcran();
  // « Présentation seule » : la diapo en plein écran, sans bandeau, panneau ni console (pendant le direct).
  const [presentation, setPresentation] = usePreferenceSalle("campus:salle-presentation");
  const [videoMasquee, setVideoMasquee] = usePreferenceSalle("campus:salle-video-masquee");
  const pleinEcranDemande = useRef(false);
  const enDirect = etat?.statut === "en_direct";
  const entrer = useCallback(() => {
    setPresentation(true);
    if (!document.fullscreenElement) {
      pleinEcranDemande.current = true;
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  }, [setPresentation]);
  const sortir = useCallback(() => {
    setPresentation(false);
    if (pleinEcranDemande.current && document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    pleinEcranDemande.current = false;
  }, [setPresentation]);
  // Touche P : entrer ou sortir ; Échap : sortir (quand le navigateur n'est pas en plein écran).
  useEffect(() => {
    if (!enDirect || petit) return;
    const touche = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "p" || e.key === "P") (presentation ? sortir : entrer)();
      else if (e.key === "Escape" && presentation) sortir();
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [enDirect, petit, presentation, entrer, sortir]);
  if (!seance || !etat) return <div className="min-h-dvh" aria-busy="true" />;
  const statut = etat.statut;
  const groupe = statut === "en_direct" ? monGroupe(groupes) : null;
  const seule = statut === "en_direct" && presentation && !groupe && !petit;
  // Sur l'écran de la salle (grand écran), tout tient dans la hauteur : aucun défilement. En présentation
  // seule, bandeau et console disparaissent sans démonter la scène : la visio ne se recharge pas.
  return (
    <div className={seule ? "relative h-dvh w-screen overflow-hidden bg-black" : "flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden"}>
      {!seule && <BandeauHaut seance={seance} siteId={siteId} onPresentation={statut === "en_direct" && !groupe && !petit ? entrer : undefined} />}
      {statut === "annulee" ? (
        <Message titre="Cours annulé" texte={etat.motifAnnulation ?? seance.motifAnnulation ?? "Le formateur a un empêchement."} seance={seance} />
      ) : statut === "terminee" ? (
        <Message titre="Merci et à bientôt !" texte="Le replay, la transcription et la fiche de révision arrivent dans le cours sur le campus numérique." seance={seance} />
      ) : statut === "planifiee" ? (
        <AvantLeCours seance={seance} etat={etat} siteId={siteId} />
      ) : groupe && groupes ? (
        <VueGroupeSalle seance={seance} groupes={groupes} groupe={groupe} moiId={moi.id} />
      ) : (
        <PendantLeCours seance={seance} etat={etat} siteId={siteId} videoMasquee={videoMasquee} onVideoMasquee={setVideoMasquee} presentation={seule} onSortir={sortir} petit={petit} />
      )}
      {siteId && !seule && (statut === "planifiee" || statut === "en_direct") && <ConsoleResponsable seance={seance} etat={etat} siteId={siteId} petit={petit} />}
      {/* Émargement : le QR en grand au démarrage, à +15 et +45 min, ou à la demande du Studio (une minute). */}
      {statut === "en_direct" && <EmargementPleinEcran seance={seance} etat={etat} siteId={siteId} enGroupe={Boolean(groupe)} />}
    </div>
  );
}

function Message({ titre, texte, seance }: { titre: string; texte: string; seance: SeanceDetailDto }) {
  return (
    <div className="grid flex-1 place-items-center px-6 text-center">
      <div className="flex max-w-4xl flex-col items-center gap-6">
        <span className="font-mono text-xl text-orange-peche">
          {seance.coursCode} · {seance.titre}
        </span>
        <p className="text-[clamp(44px,7vw,110px)] font-black leading-none tracking-serre">{titre}</p>
        <p className="rounded-3xl bg-nuit-carte px-8 py-5 text-[clamp(22px,2.4vw,40px)] font-semibold leading-snug">{texte}</p>
      </div>
    </div>
  );
}

// ── Code d'émargement renouvelé chaque minute (useCodeSalle : EmargementSalle.tsx) ──

function BlocCode({ seance, siteId, compact, mini }: { seance: SeanceDetailDto; siteId: number | null; compact?: boolean; mini?: boolean }) {
  const ouvert = seance.statut === "en_direct" || new Date(seance.debut).getTime() - maintenantServeur() < 60 * 60_000;
  const { code, erreur } = useCodeSalle(seance.id, siteId, ouvert);
  const maintenant = useMaintenant(1000);
  const restant = 60 - Math.floor((maintenant / 1000) % 60);
  if (!ouvert) {
    return (
      <div className="rounded-[28px] bg-nuit-panneau p-6">
        <p className="font-mono text-sm uppercase tracking-wider text-orange-peche">Émargement</p>
        <p className="mt-2 text-2xl font-bold text-nuit-doux">Le code s'affichera une heure avant le début.</p>
      </div>
    );
  }
  if (!code) return <div className="rounded-[28px] bg-nuit-panneau p-6 text-xl text-nuit-doux">{erreur ?? "Chargement du code…"}</div>;
  if (mini) {
    // Pendant un sondage : le code reste visible pour les retardataires, sur une seule ligne.
    return (
      <div className="flex items-center justify-between gap-4 rounded-[20px] bg-nuit-panneau px-5 py-3">
        <span className="font-mono text-sm uppercase tracking-[0.12em] text-orange-peche">Émargement</span>
        <span className="text-4xl font-black tabular-nums tracking-[0.08em]" aria-live="polite">
          {code.code}
        </span>
      </div>
    );
  }
  const chemin = cheminEmargement(code.url);
  return (
    <div className={cn("flex gap-5 rounded-[28px] bg-nuit-panneau", compact ? "flex-col p-5" : "flex-col p-6 sm:flex-row sm:items-center lg:p-7")}>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="font-mono text-sm uppercase tracking-[0.14em] text-orange-peche">Émargement · {code.salle}</p>
        <p
          className={cn("whitespace-nowrap font-black tabular-nums leading-none tracking-[0.08em] text-white", compact ? "text-[clamp(48px,4.6vw,88px)]" : "text-[clamp(64px,7.2vw,150px)]")}
          aria-live="polite"
          aria-label={`Code d'émargement ${code.code.split("").join(" ")}`}
        >
          {code.code}
        </p>
        <div className="h-2.5 overflow-hidden rounded-full bg-nuit-ligne" aria-hidden>
          <div className="h-full rounded-full bg-orange transition-[width] duration-1000 ease-linear" style={{ width: `${(restant / 60) * 100}%` }} />
        </div>
        <p className={cn("text-nuit-doux", compact ? "text-base" : "text-lg lg:text-xl")}>
          {compact ? "Tape ce code dans le campus : il change chaque minute." : "Tape ce code dans le campus ou scanne le QR : il change chaque minute."}
          {!compact && <span className="block font-mono text-base text-nuit-gris">{chemin}</span>}
        </p>
      </div>
      <div
        className={cn("shrink-0 self-center rounded-2xl bg-white p-2.5", compact ? "hidden" : "w-44 xl:w-52")}
        dangerouslySetInnerHTML={{ __html: code.qrSvg }}
        aria-label={`QR d'émargement, code ${code.code}`}
        role="img"
      />
    </div>
  );
}

function CompteursEmarges({ etat, grand, liste }: { etat: EtatDirectDto; grand?: boolean; liste?: boolean }) {
  if (liste) {
    return (
      <div className="flex flex-col rounded-[24px] bg-nuit-panneau px-5 py-3">
        <p className="py-2 font-mono text-sm uppercase tracking-[0.14em] text-nuit-gris">Émargés par campus</p>
        {etat.campus.map((c) => (
          <div key={c.siteId} className="flex items-center justify-between border-t border-nuit-ligne py-2.5">
            <span className={cn("flex items-center gap-2.5 text-xl font-bold", c.salleConnectee ? "text-white" : "text-nuit-gris")}>
              <span className={cn("h-2.5 w-2.5 rounded-full", c.salleConnectee ? "bg-orange" : "bg-nuit-bord")} />
              {c.nomCourt}
            </span>
            <span className="text-3xl font-black tabular-nums">{c.emarges}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-5 gap-2">
      {etat.campus.map((c) => (
        <div key={c.siteId} className={cn("rounded-2xl px-1.5 py-3 text-center", c.salleConnectee ? "bg-nuit-carte" : "bg-nuit-panneau")}>
          <div className={cn("font-black tabular-nums text-white", grand ? "text-5xl" : "text-3xl")}>{c.emarges}</div>
          <div className={cn("mt-1 overflow-hidden text-ellipsis whitespace-nowrap font-bold leading-tight", grand ? "text-[clamp(11px,0.86vw,17px)]" : "text-sm", c.salleConnectee ? "text-orange-peche" : "text-nuit-gris")}>{c.nomCourt}</div>
        </div>
      ))}
    </div>
  );
}

// ── Avant le cours ─────────────────────────────────────────────────────────

/** Compte à rebours lisible du fond de la salle. */
function GrandCompteARebours({ cible }: { cible: string }) {
  const d = decompte(cible, useMaintenant(1000));
  const p = (n: number) => String(n).padStart(2, "0");
  const cases = [
    ...(d.jours ? [{ v: String(d.jours), l: d.jours > 1 ? "jours" : "jour" }] : []),
    { v: p(d.heures), l: "heures" },
    { v: p(d.minutes), l: "min" },
    { v: p(d.secondes), l: "sec" },
  ];
  return (
    <div className="flex max-w-3xl gap-2 sm:gap-3" aria-label="Compte à rebours">
      {cases.map((c) => (
        <div key={c.l} className="min-w-0 flex-1 rounded-[20px] bg-[#242120] px-2 py-4 text-center">
          <div className="text-[clamp(44px,5.2vw,100px)] font-black leading-none tabular-nums">{c.v}</div>
          <div className="mt-2 font-mono text-sm uppercase tracking-wider text-nuit-gris">{c.l}</div>
        </div>
      ))}
    </div>
  );
}

/** Avant le cours, la visio s'ouvre toute seule 30 min avant le début ; d'un bouton dès 90 min (réglages de la salle). */
const VISIO_AUTO_MIN = 30;
const VISIO_POSSIBLE_MIN = 90;

function AvantLeCours({ seance, etat, siteId }: { seance: SeanceDetailDto; etat: EtatDirectDto; siteId: number | null }) {
  const moi = useMoiConnecte();
  const ville = seance.formateur?.localisation?.split(",")[0] ?? null;
  const maintenant = useMaintenant(1000);
  const avantDebutMin = (new Date(seance.debut).getTime() - maintenant) / 60_000;
  // Réglages avant le formateur : image, son, micro, avec les autres salles déjà connectées. Le micro reste
  // à la main de la salle (bouton de la visio) ; au début du cours, il se coupe et suit la parole.
  const visioPossible = moi.role === "salle" && seance.fournisseur === "daily" && avantDebutMin <= VISIO_POSSIBLE_MIN;
  const [visioDemandee, setVisioDemandee] = useState(false);
  const visioOuverte = visioPossible && (visioDemandee || avantDebutMin <= VISIO_AUTO_MIN);
  // Sans la diapo : la vidéo en grand, et la salle se voit elle-même pour régler sa caméra.
  const etatReglages = useMemo(() => ({ ...etat, diapo: { ...etat.diapo, url: null }, projection: null }), [etat]);
  return (
    <main className="grid flex-1 gap-6 px-4 py-5 sm:px-6 lg:min-h-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:px-10">
      <div className="flex min-w-0 flex-col gap-5 lg:min-h-0">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-lg text-orange-peche">
            {seance.coursCode} · {avantDebutMin <= 0 ? "Le formateur arrive" : avantDebutMin < 10 ? "La salle ouvre, installez-vous" : "Prochain cours"}
          </span>
          <h1 className="text-[clamp(38px,4.2vw,80px)] font-black leading-[0.98] tracking-serre">{seance.titre}</h1>
          <p className="text-[clamp(20px,1.7vw,30px)] text-nuit-doux">
            {seance.formateur ? `${seance.formateur.prenom} ${seance.formateur.nom}` : "Formateur"}
            {ville ? `, depuis ${ville}` : ""} · début {heure(seance.debut)}
          </p>
        </div>
        {avantDebutMin > 0 ? (
          <GrandCompteARebours cible={seance.debut} />
        ) : (
          <p className="rounded-[20px] bg-[#242120] px-6 py-5 text-[clamp(24px,2.4vw,44px)] font-black">Le cours commence dès que le formateur ouvre l'antenne.</p>
        )}
        {visioOuverte ? (
          <div className="flex flex-col gap-2 lg:min-h-0 lg:flex-1">
            <p className="font-mono text-sm uppercase tracking-[0.14em] text-orange-peche">Réglages de la salle · visio ouverte</p>
            <div className="lg:min-h-0 lg:flex-1">
              <Scene seance={seance} etat={etatReglages} role="salle" camera className="mx-auto w-full lg:h-full lg:w-auto lg:max-w-full" />
            </div>
            <p className="text-[15px] leading-snug text-nuit-doux">
              Vérifiez l'image, le son et le micro (bouton du micro dans la visio). Les salles déjà connectées vous voient. Au début du cours, le micro se coupe : le formateur vous donne la parole.
            </p>
          </div>
        ) : (
          <>
            {visioPossible && (
              <button
                onClick={() => setVisioDemandee(true)}
                className="flex min-h-12 items-center justify-center gap-2 self-start rounded-2xl bg-orange px-5 text-[16px] font-bold text-encre hover:bg-orange-peche"
              >
                <Video className="h-5 w-5" /> Ouvrir la visio pour les réglages
              </button>
            )}
            <div className="flex min-h-[260px] justify-center lg:min-h-0 lg:flex-1">
              <CarteCoteIvoire campus={etat.campus} villeFormateur={ville} className="w-full max-w-md lg:h-full lg:max-h-[560px] lg:w-auto lg:max-w-full" />
            </div>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-5 lg:min-h-0">
        <BlocCode seance={seance} siteId={siteId} />
        <div className="flex flex-col gap-3">
          <p className="font-mono text-sm uppercase tracking-[0.14em] text-nuit-gris">Émargés par campus</p>
          <CompteursEmarges etat={etat} grand />
        </div>
        <GuideChargeDeCours />
        <LimiteSilencieuse nom="CoupeSalle">
          <CoupeSalle siteId={siteId} />
        </LimiteSilencieuse>
        {seance.plan.length > 0 && (
          <div className="hidden min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:flex">
            <p className="font-mono text-sm uppercase tracking-[0.14em] text-nuit-gris">Au programme</p>
            <ol className="flex flex-col gap-1.5">
              {seance.plan.map((e, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 border-b border-nuit-ligne py-2 text-[clamp(16px,1.3vw,24px)] font-bold">
                  <span>
                    <span className="mr-3 font-mono text-orange-peche">{i + 1}</span>
                    {e.titre}
                  </span>
                  {e.minutes ? <span className="shrink-0 font-mono text-base font-normal text-nuit-gris">{e.minutes} min</span> : null}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Pendant le cours ───────────────────────────────────────────────────────

type PropsVideo = { videoMasquee: boolean; onVideoMasquee: (v: boolean) => void };

/**
 * Pendant le cours. En « présentation seule », la scène occupe tout l'écran ; ce que le formateur envoie
 * reste visible par-dessus (« C'est à vous », question affichée, sondage, sous-titres) et les commandes
 * apparaissent quand la souris bouge. Les deux mises en page gardent la même structure : la visio (et le
 * son) ne se coupent jamais au passage de l'une à l'autre.
 */
function PendantLeCours({
  seance,
  etat,
  siteId,
  videoMasquee,
  onVideoMasquee,
  presentation,
  onSortir,
  petit,
}: { seance: SeanceDetailDto; etat: EtatDirectDto; siteId: number | null; presentation: boolean; onSortir: () => void; petit: boolean } & PropsVideo) {
  const aLaParole = etat.parole?.type === "salle" && etat.parole.siteId === siteId;
  const questionEnCours = etat.questions.find((q) => q.epinglee && !q.masquee);
  const derniereLigne = etat.sousTitres[etat.sousTitres.length - 1];
  const sondage = etat.sondage;
  const commandes = useCommandesVisibles(presentation);
  const cacheeParFormateur = etat.diapo.masquee || etat.diapo.disposition === "cameras";
  return (
    <main
      className={
        presentation
          ? cn("absolute inset-0", !commandes && "cursor-none")
          : "grid flex-1 gap-4 px-3 py-3 sm:gap-6 sm:px-6 sm:py-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(340px,30%)] lg:px-10"
      }
    >
      <div className={presentation ? "absolute inset-0" : "flex min-w-0 flex-col gap-4 lg:min-h-0"}>
        {aLaParole && (
          <div
            className={cn(
              "animate-monte bg-orange px-6 text-center text-[clamp(26px,2.8vw,50px)] font-black uppercase tracking-serre text-encre",
              presentation ? "absolute inset-x-0 top-0 z-40 py-4" : "shrink-0 rounded-[22px] py-3",
            )}
            role="alert"
          >
            C'est à vous : passez le micro
          </div>
        )}
        <div className={presentation ? "absolute inset-0" : petit ? "" : "min-h-[40vh] lg:min-h-0 lg:flex-1"}>
          <Scene
            seance={seance}
            etat={etat}
            role="salle"
            micro={aLaParole}
            camera
            grand
            videoMasquee={videoMasquee}
            onVideoMasquee={onVideoMasquee}
            className={presentation ? "h-full rounded-none border-0" : "h-full"}
          />
        </div>
        {/* Téléphone : la vidéo est au-dessus de la diapo ; le bouton se range sous la scène. */}
        {petit && !presentation && etat.diapo.url && !cacheeParFormateur && seance.fournisseur !== "demo" && (
          <button
            onClick={() => onVideoMasquee(!videoMasquee)}
            className="flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-nuit-carte px-4 text-[15px] font-bold text-white hover:bg-nuit-ligne"
          >
            {videoMasquee ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            {videoMasquee ? "Afficher la caméra" : "Masquer la caméra (la diapo seule)"}
          </button>
        )}
        <div className={presentation ? "absolute inset-x-6 bottom-6 z-40 flex flex-col gap-3" : "contents"}>
          {/* Question affichée par le formateur, puis sous-titres : lisibles du fond de la salle. */}
          {questionEnCours && (
            <div className={cn("animate-monte shrink-0 rounded-[24px] px-6 py-4 text-encre", presentation ? "bg-creme/95 shadow-2xl" : "bg-creme")}>
              <p className="font-mono text-base uppercase tracking-wider text-orange-fonce">Question de {questionEnCours.site ?? "la classe en ligne"}</p>
              <p className="mt-1 line-clamp-2 text-[clamp(26px,2.6vw,48px)] font-black leading-tight tracking-serre">{questionEnCours.texte}</p>
            </div>
          )}
          {derniereLigne && (
            <p
              className={cn(
                "shrink-0 rounded-2xl px-6 py-3 text-center text-[clamp(22px,2vw,38px)] font-semibold leading-snug text-white",
                presentation ? "self-center bg-black/85" : "bg-black",
              )}
              aria-live="polite"
            >
              {derniereLigne.texte}
            </p>
          )}
        </div>
      </div>
      {!presentation && (
        <aside className="flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">
          {sondage && (
            <div className="rounded-[24px] bg-nuit-panneau p-5">
              <p className="font-mono text-sm uppercase tracking-wider text-orange-peche">{sondage.ouvert ? "Sondage en cours · réponds sur ton téléphone" : "Résultats du sondage"}</p>
              <p className="mb-4 mt-2 text-[clamp(22px,1.8vw,36px)] font-black leading-tight">{sondage.question}</p>
              {etat.resultats ? <ResultatsParCampus sondage={sondage} resultats={etat.resultats} grand /> : null}
            </div>
          )}
          <BlocCode seance={seance} siteId={siteId} compact mini={Boolean(sondage)} />
          {!sondage && <CompteursEmarges etat={etat} liste />}
        </aside>
      )}
      {presentation && sondage?.ouvert && (
        <div className="absolute right-6 top-6 z-40 w-[min(34vw,520px)] rounded-[24px] bg-nuit-panneau/95 p-5 text-white shadow-2xl">
          <p className="font-mono text-sm uppercase tracking-wider text-orange-peche">Sondage en cours · réponds sur ton téléphone</p>
          <p className="mb-4 mt-2 text-[clamp(20px,1.6vw,32px)] font-black leading-tight">{sondage.question}</p>
          {etat.resultats ? <ResultatsParCampus sondage={sondage} resultats={etat.resultats} grand /> : null}
        </div>
      )}
      {presentation && (
        <div
          className={cn(
            "absolute right-4 z-50 flex items-center gap-2 transition-opacity duration-300",
            sondage?.ouvert ? "bottom-4" : "top-4",
            commandes ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {!cacheeParFormateur && (
            <button onClick={() => onVideoMasquee(!videoMasquee)} className="flex min-h-11 items-center gap-2 rounded-full bg-black/80 px-4 text-[15px] font-bold text-white hover:bg-black">
              {videoMasquee ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              {videoMasquee ? "Afficher la caméra" : "Masquer la caméra"}
            </button>
          )}
          <button onClick={onSortir} className="flex min-h-11 items-center gap-2 rounded-full bg-orange px-4 text-[15px] font-bold text-encre hover:bg-orange-peche">
            <X className="h-5 w-5" /> Quitter la présentation
          </button>
        </div>
      )}
      {!presentation && !petit && videoMasquee && !cacheeParFormateur && (
        <button
          onClick={() => onVideoMasquee(false)}
          className="fixed bottom-24 left-4 z-40 flex min-h-11 items-center gap-2 rounded-full bg-nuit-carte px-4 text-[15px] font-bold text-white shadow-xl hover:bg-nuit-ligne lg:bottom-20"
        >
          <Eye className="h-5 w-5" /> Afficher la caméra
        </button>
      )}
    </main>
  );
}

/** Commandes de la présentation seule : visibles quand la souris bouge, effacées après quelques secondes. */
function useCommandesVisibles(actif: boolean): boolean {
  const [visibles, setVisibles] = useState(true);
  useEffect(() => {
    if (!actif) return;
    setVisibles(true);
    let id = setTimeout(() => setVisibles(false), 4000);
    const bouge = () => {
      setVisibles(true);
      clearTimeout(id);
      id = setTimeout(() => setVisibles(false), 3000);
    };
    window.addEventListener("pointermove", bouge);
    window.addEventListener("pointerdown", bouge);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointermove", bouge);
      window.removeEventListener("pointerdown", bouge);
    };
  }, [actif]);
  return visibles;
}

// ── Console du responsable de salle ────────────────────────────────────────

/**
 * Grand écran : barre en bas de l'écran. Téléphone : la console suit le cours (elle ne reste pas collée en
 * bas, où elle cachait la visio), boutons rangés sur deux colonnes.
 */
function ConsoleResponsable({ seance, etat, siteId, petit }: { seance: SeanceDetailDto; etat: EtatDirectDto; siteId: number; petit: boolean }) {
  const moi = useMoiConnecte();
  const campus = etat.campus.find((c) => c.siteId === siteId);
  const [effectif, setEffectif] = useState<number | null>(campus?.effectif ?? null);
  const [incidents, setIncidents] = useState(false);
  useEffect(() => setEffectif(campus?.effectif ?? null), [campus?.effectif]);
  const mainSalle: MainDirectDto | undefined = useMemo(() => etat.mains.find((m) => m.pourSalle && m.siteId === siteId), [etat.mains, siteId]);
  const peutLever = moi.role === "salle" || moi.role === "vie_scolaire";
  const enDirect = etat.statut === "en_direct";
  const [discussion, setDiscussion] = useState(false);
  const nonLus = useNonLusDiscussion(seance.id, false, moi.id, discussion);

  const declarer = async (corps: { nombre?: number; prete?: boolean; incident?: string | null }) => {
    try {
      await put(`/api/seances/${seance.id}/effectifs/${siteId}`, corps);
    } catch (e) {
      toastErreur(e);
    }
  };
  const main = async () => {
    try {
      const mains = mainSalle ? await suppr<MainDirectDto[]>(`/api/seances/${seance.id}/mains`) : await post<MainDirectDto[]>(`/api/seances/${seance.id}/mains`);
      queryClient.setQueryData<EtatDirectDto>(cleDirect(seance.id), (x) => (x ? { ...x, mains } : x));
    } catch (e) {
      toastErreur(e);
    }
  };
  const bouton = "flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-bold transition-colors";
  return (
    <footer className={cn("mt-auto shrink-0 border-t border-nuit-ligne bg-nuit-panneau/95 px-3 py-3 backdrop-blur sm:px-4 lg:px-10", !petit && "sticky bottom-0 lg:static")}>
      <p className="mb-2 font-mono text-[12px] uppercase tracking-wider text-nuit-gris md:hidden">Responsable de salle</p>
      <div className="mx-auto grid max-w-[1800px] grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-2.5">
        <span className="mr-2 hidden font-mono text-[12px] uppercase tracking-wider text-nuit-gris md:inline">Responsable de salle</span>
        {peutLever && (
          <button onClick={main} disabled={!enDirect} className={cn(bouton, "col-span-2", mainSalle ? "bg-orange text-encre" : "bg-nuit-carte text-white hover:bg-nuit-ligne", !enDirect && "opacity-50")}>
            <Hand className="h-5 w-5" /> {mainSalle ? "Main de la salle levée" : "Lever la main de la salle"}
          </button>
        )}
        <div className="col-span-2 flex items-center justify-between gap-1 rounded-2xl bg-nuit-carte p-1">
          <button
            onClick={() => {
              const n = Math.max(0, (effectif ?? 0) - 1);
              setEffectif(n);
              void declarer({ nombre: n });
            }}
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-nuit-ligne"
            aria-label="Retirer une personne de l'effectif"
          >
            <Minus className="h-5 w-5" />
          </button>
          <span className="min-w-[110px] text-center text-[15px] font-bold">Effectif : {effectif ?? "—"}</span>
          <button
            onClick={() => {
              const n = (effectif ?? 0) + 1;
              setEffectif(n);
              void declarer({ nombre: n });
            }}
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-nuit-ligne"
            aria-label="Ajouter une personne à l'effectif"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <button onClick={() => declarer({ prete: !campus?.prete })} className={cn(bouton, "col-span-2", campus?.prete ? "bg-[#1F3A2B] text-[#6FCF97]" : "bg-nuit-carte text-white hover:bg-nuit-ligne")}>
          <CheckCircle2 className="h-5 w-5" /> {campus?.prete ? "Salle prête" : "Déclarer la salle prête"}
        </button>
        <button
          onClick={() => setDiscussion((v) => !v)}
          className={cn(bouton, discussion ? "bg-orange text-encre" : "bg-nuit-carte text-white hover:bg-nuit-ligne")}
          aria-expanded={discussion}
        >
          <MessageSquare className="h-5 w-5" /> Discussion
          {nonLus > 0 && <span className="rounded-full bg-orange px-2 font-mono text-[12px] text-encre">{nonLus}</span>}
        </button>
        <BoutonLienInvite seance={seance} variante="nuit" qrGrand className="min-h-12 justify-center rounded-2xl px-4 text-[15px]" />
        {campus?.incident ? (
          <button onClick={() => declarer({ incident: null })} className={cn(bouton, "col-span-2 bg-direct text-white")}>
            <CircleAlert className="h-5 w-5" /> {campus.incident} · résolu ?
          </button>
        ) : (
          <div className="relative col-span-2">
            <button onClick={() => setIncidents((v) => !v)} className={cn(bouton, "w-full bg-nuit-carte text-white hover:bg-nuit-ligne")} aria-expanded={incidents}>
              <CircleAlert className="h-5 w-5 text-orange" /> Incident
            </button>
            {incidents && (
              <div className="absolute bottom-14 right-0 z-10 flex w-64 flex-col gap-1 rounded-2xl border border-nuit-bord bg-nuit-panneau p-2 shadow-2xl">
                {INCIDENTS.map((i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setIncidents(false);
                      void declarer({ incident: i });
                    }}
                    className="min-h-11 rounded-xl px-3 text-left text-[15px] font-semibold hover:bg-nuit-carte"
                  >
                    {i}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Hors de la console : son flou d'arrière-plan enfermerait le tiroir dans la barre. */}
      {discussion &&
        createPortal(
          <div className="fixed inset-y-0 right-0 z-50 flex w-[min(440px,100vw)] flex-col border-l border-nuit-bord bg-nuit-panneau text-white shadow-2xl" role="dialog" aria-label="Discussion de la classe">
            <div className="flex items-center justify-between border-b border-nuit-ligne px-4 py-3">
              <div>
                <p className="text-base font-extrabold text-white">Discussion de la classe</p>
                <p className="text-[12px] text-nuit-gris">Vous écrivez au nom de la salle. Les noms des étudiants ne s'affichent pas ici.</p>
              </div>
              <button onClick={() => setDiscussion(false)} className="rounded-full p-2 text-nuit-gris hover:text-white" aria-label="Fermer la discussion">
                <X className="h-5 w-5" />
              </button>
            </div>
            <PanneauDiscussion
              seanceId={seance.id}
              role="salle"
              moiId={moi.id}
              ouverte={etat.statut === "planifiee" || etat.statut === "en_direct"}
              mode={etat.chatMode}
              formateur={seance.formateur}
            />
          </div>,
          document.body,
        )}
    </footer>
  );
}
