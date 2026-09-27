// Vue présentateur : le formateur voit la diapo qu'il montre, pendant qu'il
// présente. Dans le Studio, à côté de la visio (« Diapo à côté ») ; ou dans
// une fenêtre à part (/live/:id/presentateur), à poser sur le côté de l'écran
// ou sur un second écran. Les deux pilotent la même diapo : ← →, PageUp /
// PageDown (télécommandes de présentation), clic sur une vignette.
import { useCallback, useEffect, useState } from "react";
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
import type { EtatDirectDto, SeanceDetailDto } from "@shared/schema";

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

  // « Caméra seule » : la diapo disparaît des écrans de salle et des téléphones, le formateur plein cadre.
  const basculer = useCallback(async () => {
    const actuel = queryClient.getQueryData<EtatDirectDto>(cleDirect(seance.id))?.diapo;
    if (!actuel?.total) return;
    const masquer = !actuel.masquee;
    queryClient.setQueryData<EtatDirectDto>(cleDirect(seance.id), (x) =>
      x ? { ...x, diapo: { ...x.diapo, masquee: masquer, url: masquer ? null : (seance.diapos[x.diapo.index]?.url ?? x.diapo.url) } } : x,
    );
    try {
      await post(`/api/seances/${seance.id}/diapo`, { index: actuel.index, masquer });
    } catch (e) {
      toastErreur(e);
    }
  }, [seance.id, seance.diapos]);

  return { aller, changer, basculer };
}

/** ← → et PageUp / PageDown (les télécommandes de présentation envoient ces touches). */
export function useClavierDiapos(changer: (delta: number) => void, actif: boolean) {
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
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [changer, actif]);
}

// ── Préférence du Studio : diapo à côté de la visio, ou visio seule ────────

export type VuePresentateur = "cote" | "video";
const CLE_VUE = "campus:vue-presentateur";

export function useVuePresentateur(): [VuePresentateur, (v: VuePresentateur) => void] {
  const [vue, setVue] = useState<VuePresentateur>(() => {
    try {
      return window.localStorage.getItem(CLE_VUE) === "video" ? "video" : "cote";
    } catch {
      return "cote";
    }
  });
  const choisir = useCallback((v: VuePresentateur) => {
    setVue(v);
    try {
      window.localStorage.setItem(CLE_VUE, v);
    } catch {
      /* stockage indisponible : le choix vaut pour cette page */
    }
  }, []);
  return [vue, choisir];
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

/** La diapo en cours telle que les salles la voient, même en « Caméra seule » (grisée). */
function DiapoEnCours({ seance, etat, grand }: { seance: SeanceDetailDto; etat: EtatDirectDto; grand?: boolean }) {
  const d = seance.diapos[etat.diapo.index];
  return (
    <div className={cn("relative overflow-hidden rounded-[18px] border-2 bg-black", etat.diapo.masquee ? "border-nuit-ligne" : "border-orange", grand ? "h-full min-h-0" : "aspect-video")}>
      {d ? (
        <img src={d.url} alt={`Diapo ${etat.diapo.index + 1} sur ${etat.diapo.total}`} className={cn("h-full w-full object-contain transition-opacity", etat.diapo.masquee && "opacity-30")} />
      ) : null}
      <span className={cn("absolute left-3 top-3 flex items-center gap-2 rounded-lg px-2.5 py-1 font-mono text-xs font-bold", etat.diapo.masquee ? "bg-nuit-carte text-nuit-texte" : "bg-orange text-encre")}>
        {etat.diapo.masquee ? (
          <>
            <EyeOff className="h-3.5 w-3.5" /> Masquée aux salles
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-encre" /> Vue par les salles
          </>
        )}
      </span>
      <span className="absolute right-3 top-3 rounded-lg bg-black/70 px-2.5 py-1 font-mono text-xs text-orange-peche">
        {etat.diapo.index + 1} / {etat.diapo.total}
      </span>
    </div>
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

/** Dans le Studio, à côté de la visio : la diapo en cours en grand, la suivante en dessous. */
export function PanneauPresentateur({ seance, etat, onAller }: { seance: SeanceDetailDto; etat: EtatDirectDto; onAller: (index: number) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <DiapoEnCours seance={seance} etat={etat} />
      <div className="flex items-center gap-3">
        <DiapoSuivante seance={seance} etat={etat} onAller={onAller} className="w-36 shrink-0" />
        <p className="text-[13px] leading-snug text-nuit-doux">
          Ce que les salles et les étudiants voient en ce moment. <span className="text-nuit-texte">← →</span> pour avancer.
        </p>
      </div>
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
  const { aller, changer, basculer } = usePilotageDiapos(seance);
  useClavierDiapos(changer, true);
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
  const { index, total, masquee } = etat.diapo;
  return (
    <div className="flex h-dvh flex-col gap-3 bg-nuit p-3 text-white sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-orange-peche">Vue présentateur</p>
          <h1 className="truncate font-sans text-base font-bold tracking-normal text-white">{seance.titre}</h1>
        </div>
        <Chrono seance={seance} etat={etat} />
      </header>

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
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
          <button
            type="button"
            onClick={() => void basculer()}
            aria-pressed={Boolean(masquee)}
            className={cn("min-h-11 rounded-xl px-3 text-[14px] font-semibold transition-colors", masquee ? "bg-orange text-encre" : "bg-nuit-carte text-white hover:bg-nuit-ligne")}
          >
            {masquee ? "Montrer la diapo aux salles" : "Caméra seule"}
          </button>
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
      <p className="hidden text-center font-mono text-[11px] text-nuit-gris sm:block">← → ou télécommande pour changer de diapo · cette fenêtre peut rester sur le côté ou sur un second écran</p>
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
