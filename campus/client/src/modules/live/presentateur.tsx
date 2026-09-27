// Vue présentateur : le formateur voit la diapo qu'il montre, pendant qu'il
// présente. Dans le Studio, à côté de la visio ; ou dans une fenêtre à part
// (/live/:id/presentateur), à poser sur le côté de l'écran ou sur un second
// écran. Les deux pilotent la même diapo (← →, PageUp / PageDown des
// télécommandes, clic sur une vignette) et la même mise en page (1 à 4) :
// diapo en grand, côte à côte, caméras en grand, caméras seules. Ce que le
// formateur voit, les salles et les étudiants le voient.
import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Clock, EyeOff } from "lucide-react";
import { post } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { heureDouble } from "@/lib/dates";
import { Bouton } from "@/components/ui/bouton";
import { EtatVide } from "@/components/ui/divers";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { toastErreur } from "@/components/ui/toast";
import { cleDirect, useEcranAllume, useEtatDirect, useSeance } from "./outils";
import type { DispositionScene, EtatDirectDto, SeanceDetailDto } from "@shared/schema";

// ── Mises en page de la scène ──────────────────────────────────────────────

/** Les trois dispositions de la diapo montrée, plus « seules » : la diapo masquée, les caméras plein cadre. */
export type ModeScene = DispositionScene | "seules";

export const MODES_SCENE: { mode: ModeScene; libelle: string; touche: string; aide: string }[] = [
  { mode: "diapo", libelle: "Diapo en grand", touche: "1", aide: "La diapo en grand, les caméras en vignette" },
  { mode: "cote", libelle: "Côte à côte", touche: "2", aide: "La diapo et les caméras côte à côte, à parts égales" },
  { mode: "cameras", libelle: "Caméras en grand", touche: "3", aide: "Les caméras et les salles en grand, la diapo en vignette" },
  { mode: "seules", libelle: "Caméras seules", touche: "4", aide: "Les caméras et les salles seules, la diapo masquée" },
];

export function modeScene(etat: EtatDirectDto): ModeScene {
  return etat.diapo.masquee ? "seules" : (etat.diapo.disposition ?? "diapo");
}

// ── Pilotage des diapos (Studio et fenêtre présentateur) ──────────────────

export function usePilotageDiapos(seance: SeanceDetailDto) {
  const aller = useCallback(
    async (index: number) => {
      const actuel = queryClient.getQueryData<EtatDirectDto>(cleDirect(seance.id))?.diapo;
      if (!actuel?.total) return;
      const cible = Math.min(actuel.total - 1, Math.max(0, index));
      // Changer de diapo la remontre aux salles si elle était masquée (« Caméra seule »).
      if (cible === actuel.index && !actuel.masquee) return;
      queryClient.setQueryData<EtatDirectDto>(cleDirect(seance.id), (x) =>
        x ? { ...x, diapo: { ...x.diapo, index: cible, masquee: false, url: seance.diapos[cible]?.url ?? x.diapo.url } } : x,
      );
      try {
        await post(`/api/seances/${seance.id}/diapo`, { index: cible });
      } catch (e) {
        toastErreur(e);
      }
    },
    [seance.id, seance.diapos],
  );

  const changer = useCallback(
    (delta: number) => {
      const actuel = queryClient.getQueryData<EtatDirectDto>(cleDirect(seance.id))?.diapo;
      if (actuel?.total) void aller(actuel.index + delta);
    },
    [seance.id, aller],
  );

  // Mise en page, identique pour tous : « seules » masque la diapo (caméras plein cadre) ;
  // les autres la montrent, en grand, à côté des caméras ou en vignette.
  const disposer = useCallback(
    async (mode: ModeScene) => {
      const actuel = queryClient.getQueryData<EtatDirectDto>(cleDirect(seance.id))?.diapo;
      if (!actuel?.total) return;
      const masquer = mode === "seules";
      const disposition = masquer ? undefined : mode;
      queryClient.setQueryData<EtatDirectDto>(cleDirect(seance.id), (x) =>
        x
          ? {
              ...x,
              diapo: {
                ...x.diapo,
                masquee: masquer,
                disposition: disposition ?? x.diapo.disposition,
                url: masquer ? null : (seance.diapos[x.diapo.index]?.url ?? x.diapo.url),
              },
            }
          : x,
      );
      try {
        await post(`/api/seances/${seance.id}/diapo`, { index: actuel.index, masquer, ...(disposition && { disposition }) });
      } catch (e) {
        toastErreur(e);
      }
    },
    [seance.id, seance.diapos],
  );

  return { aller, changer, disposer };
}

/** ← → et PageUp / PageDown (les télécommandes de présentation envoient ces touches) ; 1 à 4 : mise en page. */
export function useClavierDiapos(changer: (delta: number) => void, actif: boolean, disposer?: (mode: ModeScene) => void) {
  useEffect(() => {
    if (!actif) return;
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA" || cible.tagName === "SELECT" || cible.isContentEditable)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        changer(1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        changer(-1);
      }
      const choix = disposer && !e.ctrlKey && !e.metaKey && !e.altKey ? MODES_SCENE.find((m) => m.touche === e.key) : undefined;
      if (choix) {
        e.preventDefault();
        disposer!(choix.mode);
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [changer, actif, disposer]);
}

/** Petit schéma de chaque mise en page : la diapo en orange, les caméras en gris. */
function Pictogramme({ mode }: { mode: ModeScene }) {
  const diapo = (x: number, y: number, l: number, h: number) => (
    <g>
      <rect x={x} y={y} width={l} height={h} rx={1.5} fill="#E4793A" />
      <rect x={x + l * 0.14} y={y + h * 0.3} width={l * 0.55} height={Math.max(1, h * 0.1)} rx={0.5} fill="#fff" opacity={0.9} />
      <rect x={x + l * 0.14} y={y + h * 0.52} width={l * 0.38} height={Math.max(1, h * 0.08)} rx={0.5} fill="#fff" opacity={0.7} />
    </g>
  );
  const camera = (x: number, y: number, l: number, h: number, contour = false) => (
    <g>
      <rect x={x} y={y} width={l} height={h} rx={1.5} fill="#6B625A" stroke={contour ? "#1B1714" : "none"} strokeWidth={contour ? 1 : 0} />
      <circle cx={x + l / 2} cy={y + h * 0.42} r={Math.min(l, h) * 0.17} fill="#E9E1D9" />
      <path d={`M${x + l * 0.24} ${y + h} q${l * 0.26} ${-h * 0.5} ${l * 0.52} 0`} fill="#E9E1D9" />
    </g>
  );
  return (
    <svg viewBox="0 0 30 19" className="h-[19px] w-[30px] shrink-0" aria-hidden>
      {mode === "diapo" && (
        <>
          {diapo(1, 1, 28, 17)}
          {camera(18, 10.5, 10, 6.5, true)}
        </>
      )}
      {mode === "cote" && (
        <>
          {diapo(1, 3, 15, 13)}
          {camera(17.5, 3, 11.5, 13)}
        </>
      )}
      {mode === "cameras" && (
        <>
          {camera(1, 1, 28, 17)}
          {diapo(18, 10.5, 10, 6.5)}
        </>
      )}
      {mode === "seules" && (
        <>
          {camera(1, 1, 13.5, 17)}
          {camera(15.5, 1, 13.5, 17)}
        </>
      )}
    </svg>
  );
}

/**
 * Le sélecteur de mise en page : quatre boutons, un schéma chacun, la touche
 * du clavier en rappel. « bande » dans le Studio, « grille » (2 × 2) dans la
 * fenêtre présentateur.
 */
export function ChoixMiseEnPage({ mode, onChoisir, forme = "bande", className }: { mode: ModeScene; onChoisir: (m: ModeScene) => void; forme?: "bande" | "grille"; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Mise en page pour les salles et les étudiants" className={cn(forme === "grille" ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-1.5", className)}>
      {MODES_SCENE.map((m) => {
        const actif = m.mode === mode;
        return (
          <button
            key={m.mode}
            type="button"
            role="radio"
            aria-checked={actif}
            title={`${m.aide} (touche ${m.touche})`}
            onClick={() => onChoisir(m.mode)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-[13px] font-semibold transition-colors",
              forme === "grille" && "min-h-12",
              actif ? "bg-white text-encre ring-2 ring-orange" : "bg-nuit-carte text-white hover:bg-nuit-ligne",
            )}
          >
            <Pictogramme mode={m.mode} />
            <span className="leading-tight">{m.libelle}</span>
            {forme === "bande" && (
              <kbd className={cn("ml-auto rounded border px-1 font-mono text-[10px] leading-4", actif ? "border-encre/30 text-encre/60" : "border-nuit-ligne text-nuit-gris")}>{m.touche}</kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Ouvre (ou ramène devant) la fenêtre présentateur, sur le côté de l'écran. */
export function ouvrirFenetrePresentateur(seanceId: number) {
  const largeur = Math.min(960, Math.round(window.screen.availWidth * 0.5));
  const hauteur = Math.min(720, window.screen.availHeight - 40);
  const gauche = Math.max(0, window.screen.availWidth - largeur);
  const fenetre = window.open(
    `/live/${seanceId}/presentateur`,
    `presentateur-${seanceId}`,
    `popup,width=${largeur},height=${hauteur},left=${gauche},top=0`,
  );
  fenetre?.focus();
  return Boolean(fenetre);
}

// ── Diapo en cours, vue du formateur ───────────────────────────────────────

/** La diapo en cours telle que les salles la voient, même en « Caméras seules » (grisée). Rien par-dessus : le titre reste lisible. */
function DiapoEnCours({ seance, etat, grand }: { seance: SeanceDetailDto; etat: EtatDirectDto; grand?: boolean }) {
  const d = seance.diapos[etat.diapo.index];
  return (
    <div className={cn("overflow-hidden rounded-[18px] border-2 bg-black", etat.diapo.masquee ? "border-nuit-ligne" : "border-orange", grand ? "h-full min-h-0" : "aspect-video")}>
      {d ? (
        <img src={d.url} alt={`Diapo ${etat.diapo.index + 1} sur ${etat.diapo.total}`} className={cn("h-full w-full object-contain transition-opacity", etat.diapo.masquee && "opacity-30")} />
      ) : null}
    </div>
  );
}

/** « Vue par les salles · 3 / 12 », ou « Masquée aux salles » en « Caméras seules ». */
function EtatDiapo({ etat, className }: { etat: EtatDirectDto; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-xs font-bold", etat.diapo.masquee ? "text-nuit-gris" : "text-orange-peche", className)}>
      {etat.diapo.masquee ? <EyeOff className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-orange" />}
      {etat.diapo.masquee ? "Masquée aux salles" : "Vue par les salles"} · {etat.diapo.index + 1} / {etat.diapo.total}
    </span>
  );
}

function DiapoSuivante({ seance, etat, onAller, className }: { seance: SeanceDetailDto; etat: EtatDirectDto; onAller: (index: number) => void; className?: string }) {
  const suivante = seance.diapos[etat.diapo.index + 1];
  if (!suivante) {
    return <div className={cn("grid aspect-video place-items-center rounded-xl bg-nuit-carte text-center font-mono text-[11px] uppercase tracking-wider text-nuit-gris", className)}>Dernière diapo</div>;
  }
  return (
    <button
      type="button"
      onClick={() => onAller(suivante.index)}
      className={cn("group relative aspect-video overflow-hidden rounded-xl border-2 border-nuit-ligne bg-black hover:border-orange-peche", className)}
      aria-label={`Passer à la diapo suivante (${suivante.index + 1})`}
    >
      <img src={suivante.url} alt="" className="h-full w-full object-contain" />
      <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-left font-mono text-[11px] text-nuit-texte group-hover:text-white">Suivante · {suivante.index + 1}</span>
    </button>
  );
}

/**
 * Dans le Studio, à côté de la visio : la diapo en cours, la suivante en dessous.
 * compact : colonne étroite (« Caméras en grand »), la suivante en pleine largeur, sans texte.
 */
export function PanneauPresentateur({ seance, etat, onAller, compact }: { seance: SeanceDetailDto; etat: EtatDirectDto; onAller: (index: number) => void; compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <DiapoEnCours seance={seance} etat={etat} />
      {compact ? (
        <>
          <EtatDiapo etat={etat} className="px-1" />
          <DiapoSuivante seance={seance} etat={etat} onAller={onAller} className="w-full" />
        </>
      ) : (
        <div className="flex items-center gap-3">
          <DiapoSuivante seance={seance} etat={etat} onAller={onAller} className="w-36 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <EtatDiapo etat={etat} />
            <p className="text-[13px] leading-snug text-nuit-doux">
              <span className="text-nuit-texte">← →</span> pour avancer, <span className="text-nuit-texte">1 à 4</span> pour changer la mise en page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fenêtre présentateur : /live/:id/presentateur ──────────────────────────

export default function PagePresentateur({ id }: { id: string }) {
  const { data: seance, error } = useSeance(Number(id));
  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center bg-nuit px-4">
        <EtatVide nuit titre="Impossible d'ouvrir la vue présentateur." texte={error instanceof Error ? error.message : "Vérifiez votre connexion."} className="max-w-lg" />
      </div>
    );
  }
  if (!seance) return <div className="min-h-dvh bg-nuit" aria-busy="true" />;
  if (seance.monRole !== "formateur") {
    return (
      <div className="grid min-h-dvh place-items-center bg-nuit px-4">
        <EtatVide nuit titre="Vue réservée au formateur de la séance." texte="Elle s'ouvre depuis le Studio, avec le bouton « Fenêtre à part »." className="max-w-lg" />
      </div>
    );
  }
  return <FenetrePresentateur seance={seance} />;
}

function FenetrePresentateur({ seance }: { seance: SeanceDetailDto }) {
  const { data: etat } = useEtatDirect(seance.id, true);
  const { aller, changer, disposer } = usePilotageDiapos(seance);
  useClavierDiapos(changer, true, disposer);
  useEcranAllume(true);
  useEffect(() => {
    const avant = document.title;
    document.title = `Présentateur · ${seance.titre}`;
    return () => {
      document.title = avant;
    };
  }, [seance.titre]);

  if (!etat) return <div className="min-h-dvh bg-nuit" aria-busy="true" />;
  if (!seance.diapos.length) {
    return (
      <div className="grid min-h-dvh place-items-center bg-nuit px-4">
        <EtatVide nuit titre="Pas de diapos pour cette séance." texte="Déposez votre PowerPoint ou votre PDF dans la préparation de la séance." className="max-w-lg" />
      </div>
    );
  }
  const { index, total } = etat.diapo;
  return (
    <div className="flex h-dvh flex-col gap-3 bg-nuit p-3 text-white sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-orange-peche">Vue présentateur</p>
          <h1 className="truncate font-sans text-base font-bold tracking-normal text-white">{seance.titre}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EtatDiapo etat={etat} />
          <Chrono seance={seance} etat={etat} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_300px]">
        <DiapoEnCours seance={seance} etat={etat} grand />
        <aside className="flex min-h-0 flex-col gap-3">
          <DiapoSuivante seance={seance} etat={etat} onAller={(i) => void aller(i)} />
          <div className="grid grid-cols-2 gap-2">
            <Bouton variante="nuit" onClick={() => changer(-1)} disabled={index === 0} icone={<ChevronLeft className="h-5 w-5 shrink-0" />} className="min-h-14 px-3">
              Précédente
            </Bouton>
            <Bouton variante="nuit-actif" onClick={() => changer(1)} disabled={index >= total - 1} icone={<ChevronRight className="h-5 w-5 shrink-0" />} className="min-h-14 px-3">
              Suivante
            </Bouton>
          </div>
          <ChoixMiseEnPage mode={modeScene(etat)} onChoisir={(m) => void disposer(m)} forme="grille" />
          <ol className="defile-fin hidden min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pr-1 md:grid">
            {seance.diapos.map((d) => (
              <li key={d.fichierId}>
                <button
                  type="button"
                  onClick={() => void aller(d.index)}
                  className={cn("relative block w-full overflow-hidden rounded-md border-2 bg-black", d.index === index ? "border-orange" : "border-transparent hover:border-nuit-ligne")}
                  aria-label={`Aller à la diapo ${d.index + 1}`}
                  aria-current={d.index === index ? "true" : undefined}
                >
                  <img src={d.url} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 font-mono text-[10px] text-nuit-texte">{d.index + 1}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <p className="hidden text-center font-mono text-[11px] text-nuit-gris sm:block">← → ou télécommande : diapo suivante · 1 à 4 : mise en page · cette fenêtre peut rester sur le côté ou sur un second écran</p>
    </div>
  );
}

function Chrono({ seance, etat }: { seance: SeanceDetailDto; etat: EtatDirectDto }) {
  const maintenant = useMaintenant(1000);
  const demarree = etat.demarreeLe ? new Date(etat.demarreeLe).getTime() : null;
  const finPrevue = (demarree ?? new Date(seance.debut).getTime()) + seance.dureeMinutes * 60_000;
  const ecoule = demarree ? Math.max(0, Math.floor((maintenant - demarree) / 1000)) : 0;
  const resteMin = Math.round((finPrevue - maintenant) / 60_000);
  const mm = String(Math.floor(ecoule / 60)).padStart(2, "0");
  const ss = String(ecoule % 60).padStart(2, "0");
  return (
    <div className="flex items-center gap-3 rounded-xl bg-nuit-panneau px-3 py-2">
      <Clock className="h-4 w-4 text-orange-peche" />
      {demarree ? (
        <>
          <span className="text-2xl font-black tabular-nums leading-none">
            {mm}:{ss}
          </span>
          <span className={cn("font-mono text-[11px]", resteMin < 0 ? "text-direct" : "text-nuit-gris")}>
            {resteMin >= 0 ? `${resteMin} min restantes` : `+${-resteMin} min`} · fin {heureDouble(finPrevue)}
          </span>
        </>
      ) : (
        <span className="font-mono text-[12px] text-nuit-texte">Pas encore en direct · début {heureDouble(seance.debut)}</span>
      )}
    </div>
  );
}
