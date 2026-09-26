// Lecteur de showreel : 30 secondes pour présenter un formateur.
//
//   <Showreel scenes={…} formateur={…} format="paysage" | "portrait" autoplay />
//
// Rendu dans le navigateur (CSS et requestAnimationFrame, aucune dépendance) :
// léger en 3G, net sur tous les écrans, à jour quand le profil change.
// - lecture automatique quand il est visible (IntersectionObserver), muet ;
// - barre de progression segmentée façon « stories » (un segment par plan,
//   touchable pour y aller) ;
// - pause au toucher ou à la barre d'espace, flèches pour changer de plan,
//   « Rejouer » à la fin ;
// - mouvement réduit (prefers-reduced-motion) : version fixe lisible, tous les
//   plans côte à côte, et un bouton pour lire l'animation quand même ;
// - accessible : texte réel, transcription complète pour les lecteurs
//   d'écran, annonces discrètes (aria-live) seulement quand on agit.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { LIBELLES_TYPES_PLAN, type FormateurShowreel, type PlanShowreel } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Scene, type FormatShowreel } from "./scenes";
import { texteDuPlan } from "./outils";
import "./showreel.css";

export type ProprietesShowreel = {
  scenes: PlanShowreel[];
  formateur: FormateurShowreel;
  format?: FormatShowreel;
  /** Lecture automatique dès que le lecteur est visible à moitié. */
  autoplay?: boolean;
  /** Remplit son conteneur (plein écran) au lieu de garder son format. */
  plein?: boolean;
  /** Sans barres ni boutons (enregistrement vidéo, écran de salle). */
  sansCommandes?: boolean;
  /** Recommence à la fin. */
  boucle?: boolean;
  /** Démarre tout de suite, même hors de l'écran. */
  immediat?: boolean;
  /** Joue l'animation même si la personne a demandé moins de mouvement. */
  forcerAnimation?: boolean;
  className?: string;
  onFin?: () => void;
};

/** La personne a demandé moins de mouvement (réglage du téléphone ou de l'ordinateur). */
export function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    const ecouter = () => setReduit(m.matches);
    m.addEventListener("change", ecouter);
    return () => m.removeEventListener("change", ecouter);
  }, []);
  return reduit;
}

const minutes = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Showreel(props: ProprietesShowreel) {
  const reduit = useMouvementReduit();
  const [forcer, setForcer] = useState(false);
  if (reduit && !props.forcerAnimation && !forcer) return <ShowreelFixe {...props} onLire={() => setForcer(true)} />;
  return <LecteurAnime {...props} autoplay={props.autoplay || forcer} />;
}

type EtatScene = { index: number; precedent: number | null; jeton: number };

function LecteurAnime({ scenes, formateur, format = "paysage", autoplay = false, plein, sansCommandes, boucle, immediat, className, onFin }: ProprietesShowreel) {
  const racine = useRef<HTMLElement>(null);
  const barres = useRef<(HTMLSpanElement | null)[]>([]);
  const temps = useRef<HTMLSpanElement>(null);
  const tRef = useRef(0);
  const [scene, setScene] = useState<EtatScene>({ index: 0, precedent: null, jeton: 0 });
  const indexRef = useRef(0);
  const [enLecture, setEnLecture] = useState(false);
  const enLectureRef = useRef(false);
  const [demarre, setDemarre] = useState(false);
  const [fini, setFini] = useState(false);
  const finiRef = useRef(false);
  const pauseManuelle = useRef(false);
  const visible = useRef(false);
  const [annonce, setAnnonce] = useState("");
  const [flash, setFlash] = useState<{ icone: "pause" | "lecture"; n: number } | null>(null);

  const durees = useMemo(() => scenes.map((p) => Math.max(0.5, p.duree || 3.75) * 1000), [scenes]);
  const debuts = useMemo(() => durees.reduce<number[]>((acc, d, i) => [...acc, i === 0 ? 0 : acc[i - 1] + durees[i - 1]], []), [durees]);
  const total = useMemo(() => durees.reduce((a, b) => a + b, 0), [durees]);
  const indexA = useCallback(
    (t: number) => {
      for (let i = debuts.length - 1; i >= 0; i--) if (t >= debuts[i]) return i;
      return 0;
    },
    [debuts],
  );

  const majBarres = useCallback(
    (t: number) => {
      durees.forEach((d, i) => {
        const el = barres.current[i];
        if (el) el.style.transform = `scaleX(${Math.min(1, Math.max(0, (t - debuts[i]) / d))})`;
      });
      if (temps.current) temps.current.textContent = `${minutes(t)} / ${minutes(total)}`;
    },
    [durees, debuts, total],
  );

  const changerLecture = (v: boolean) => {
    enLectureRef.current = v;
    setEnLecture(v);
  };
  const changerFini = (v: boolean) => {
    finiRef.current = v;
    setFini(v);
  };

  const allerA = useCallback(
    (i: number, annoncer = true) => {
      const cible = Math.max(0, Math.min(scenes.length - 1, i));
      tRef.current = debuts[cible] ?? 0;
      indexRef.current = cible;
      setScene((s) => ({ index: cible, precedent: null, jeton: s.jeton + 1 }));
      changerFini(false);
      setDemarre(true);
      pauseManuelle.current = false;
      changerLecture(true);
      majBarres(tRef.current);
      if (annoncer) setAnnonce(`Plan ${cible + 1} sur ${scenes.length} : ${LIBELLES_TYPES_PLAN[scenes[cible].type]}.`);
    },
    [debuts, majBarres, scenes],
  );

  const rejouer = useCallback(() => allerA(0, false), [allerA]);

  const lire = useCallback(() => {
    if (!scenes.length) return;
    if (finiRef.current) return rejouer();
    if (!demarre) {
      setDemarre(true);
      setScene((s) => ({ index: indexRef.current, precedent: null, jeton: s.jeton + 1 }));
    }
    changerLecture(true);
  }, [demarre, rejouer, scenes.length]);

  const mettreEnPause = useCallback((manuelle: boolean) => {
    pauseManuelle.current = manuelle;
    changerLecture(false);
  }, []);

  const basculer = useCallback(() => {
    if (enLectureRef.current) {
      mettreEnPause(true);
      setAnnonce("Présentation en pause.");
      setFlash((f) => ({ icone: "pause", n: (f?.n ?? 0) + 1 }));
    } else {
      pauseManuelle.current = false;
      lire();
      setAnnonce(finiRef.current ? "Lecture depuis le début." : "Lecture.");
      setFlash((f) => ({ icone: "lecture", n: (f?.n ?? 0) + 1 }));
    }
  }, [lire, mettreEnPause]);

  // Horloge : avance seulement pendant la lecture ; les animations CSS sont gelées avec elle.
  useEffect(() => {
    if (!enLecture) return;
    // Signal pour les outils (enregistrement vidéo, essais) : la lecture part de t.
    window.dispatchEvent(new CustomEvent("showreel:lecture", { detail: { t: tRef.current } }));
    let raf = 0;
    let avant = performance.now();
    const pas = (maintenant: number) => {
      tRef.current += Math.min(250, maintenant - avant);
      avant = maintenant;
      const t = tRef.current;
      if (t >= total) {
        tRef.current = total;
        majBarres(total);
        if (boucle) {
          rejouer();
          return;
        }
        changerLecture(false);
        changerFini(true);
        onFin?.();
        return;
      }
      majBarres(t);
      const i = indexA(t);
      if (i !== indexRef.current) {
        const avantIndex = indexRef.current;
        indexRef.current = i;
        setScene((s) => ({ index: i, precedent: avantIndex, jeton: s.jeton }));
      }
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [enLecture, total, indexA, majBarres, boucle, rejouer, onFin]);

  // Lecture automatique quand le lecteur est visible ; pause quand il sort de l'écran ou que l'onglet est caché.
  useEffect(() => {
    const el = racine.current;
    if (!el) return;
    const peutDemarrer = () => (autoplay || immediat) && !pauseManuelle.current && !finiRef.current && document.visibilityState === "visible";
    if (immediat) lire();
    const obs =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([e]) => {
              visible.current = e.isIntersecting && e.intersectionRatio >= 0.5;
              if (visible.current && peutDemarrer() && !enLectureRef.current) lire();
              if (!visible.current && enLectureRef.current && !immediat) mettreEnPause(false);
            },
            { threshold: [0, 0.5, 1] },
          )
        : null;
    obs?.observe(el);
    const onglet = () => {
      if (document.visibilityState === "hidden" && enLectureRef.current) mettreEnPause(false);
      else if (document.visibilityState === "visible" && (visible.current || immediat) && peutDemarrer() && !enLectureRef.current) lire();
    };
    document.addEventListener("visibilitychange", onglet);
    return () => {
      obs?.disconnect();
      document.removeEventListener("visibilitychange", onglet);
    };
  }, [autoplay, immediat, lire, mettreEnPause]);

  // Nouvelles scènes (éditeur en direct) : on reste au même plan si possible.
  useEffect(() => {
    if (indexRef.current >= scenes.length) {
      indexRef.current = 0;
      tRef.current = 0;
      setScene((s) => ({ index: 0, precedent: null, jeton: s.jeton + 1 }));
    }
    majBarres(tRef.current);
  }, [scenes, majBarres]);

  const clavier = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === " " || e.key === "k" || e.key === "K") {
      e.preventDefault();
      basculer();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      allerA(indexRef.current + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      allerA(tRef.current - debuts[indexRef.current] > 1500 ? indexRef.current : indexRef.current - 1);
    } else if (e.key === "Home" || e.key === "r" || e.key === "R") {
      e.preventDefault();
      rejouer();
    }
  };

  if (!scenes.length) return null;
  const nom = formateur.nomAffiche;
  const calques = [scene.precedent, scene.index].filter((x): x is number => x !== null && x !== scene.index).concat(scene.index);

  return (
    <section
      ref={racine}
      className={cn("sr", plein && "sr-plein", className)}
      data-format={format}
      data-pause={demarre && !enLecture ? "" : undefined}
      role="region"
      aria-roledescription="présentation animée"
      aria-label={`Présentation de ${nom} en 30 secondes`}
      tabIndex={0}
      onKeyDown={clavier}
      onClick={() => (demarre ? basculer() : lire())}
    >
      <div aria-hidden className="absolute inset-0">
        {calques.map((i) => (
          <div key={`${scene.jeton}-${i}`} className="absolute inset-0" style={{ zIndex: i === scene.index ? 2 : 1 }}>
            <div className={cn("absolute inset-0", !demarre && "sr-statique")}>
              <Scene plan={scenes[i]} formateur={formateur} format={format} premier={i === 0} />
            </div>
          </div>
        ))}
      </div>

      {!sansCommandes && (
        <>
          <div className="sr-voile-haut" aria-hidden />
          <div className="sr-voile-bas" aria-hidden />
          <div className="sr-barres" onClick={(e) => e.stopPropagation()}>
            {scenes.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className="sr-barre"
                style={{ flexGrow: durees[i], flexBasis: 0 }}
                aria-label={`Aller au plan ${i + 1} : ${LIBELLES_TYPES_PLAN[p.type]}`}
                onClick={() => allerA(i)}
              >
                <span ref={(el) => void (barres.current[i] = el)} />
              </button>
            ))}
          </div>
          <div className="sr-commandes" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="sr-bouton" onClick={basculer} aria-label={enLecture ? "Mettre en pause" : fini ? "Rejouer" : "Lire"}>
              {enLecture ? <Pause className="h-[18px] w-[18px]" fill="currentColor" /> : <Play className="h-[18px] w-[18px]" fill="currentColor" />}
            </button>
            <span ref={temps} className="sr-temps" aria-hidden>
              0:00 / {minutes(total)}
            </span>
            <span className="flex-1" />
            <button type="button" className="sr-bouton" onClick={rejouer} aria-label="Rejouer depuis le début">
              <RotateCcw className="h-[18px] w-[18px]" />
            </button>
          </div>
          {(!demarre || fini) && (
            <button
              type="button"
              className="sr-grand-bouton"
              onClick={(e) => {
                e.stopPropagation();
                if (fini) rejouer();
                else lire();
              }}
              aria-label={fini ? "Rejouer la présentation" : `Lire la présentation de ${nom}`}
            >
              {fini ? <RotateCcw style={{ width: "42%", height: "42%" }} /> : <Play style={{ width: "42%", height: "42%", marginLeft: "8%" }} fill="currentColor" />}
            </button>
          )}
          {flash && demarre && !fini && (
            <span key={flash.n} className="sr-flash" aria-hidden>
              {flash.icone === "pause" ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="h-7 w-7" fill="currentColor" />}
            </span>
          )}
        </>
      )}

      {/* Transcription complète et annonces discrètes, pour les lecteurs d'écran. */}
      <div className="sr-only">
        <p>Texte de la présentation de {nom} :</p>
        <ol>
          {scenes.map((p) => (
            <li key={p.id}>{texteDuPlan(p, formateur.campus)}</li>
          ))}
        </ol>
      </div>
      <p className="sr-only" aria-live="polite">
        {annonce}
      </p>
    </section>
  );
}

/**
 * Version fixe (mouvement réduit) : tous les plans côte à côte, lisibles
 * d'un coup d'œil, dans le même style ; l'animation reste à un bouton.
 */
export function ShowreelFixe({ scenes, formateur, className, onLire }: ProprietesShowreel & { onLire?: () => void }) {
  return (
    <section className={cn("flex flex-col gap-3", className)} aria-label={`Présentation de ${formateur.nomAffiche}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {scenes.map((p, i) => (
          <figure key={p.id} className="m-0 flex flex-col gap-1.5">
            <div className="sr sr-statique overflow-hidden rounded-2xl" data-format="paysage">
              <Scene plan={p} formateur={formateur} format="paysage" premier={i === 0} />
            </div>
            <figcaption className="font-mono text-xs text-texte-gris">
              {String(i + 1).padStart(2, "0")} · {LIBELLES_TYPES_PLAN[p.type]}
            </figcaption>
          </figure>
        ))}
      </div>
      {onLire && (
        <div>
          <button type="button" onClick={onLire} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-creme px-4 text-[15px] font-bold text-encre hover:bg-orange-clair">
            <Play className="h-4 w-4" fill="currentColor" /> Lire l'animation (30 secondes)
          </button>
        </div>
      )}
    </section>
  );
}
