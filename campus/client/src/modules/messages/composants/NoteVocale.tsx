// Notes vocales : enregistrement (MediaRecorder, Opus ≈ 24 kbit/s, soit
// environ 180 Ko par minute) et lecteur léger (rien ne se télécharge avant
// qu'on appuie sur lecture : chaque méga compte).
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dureeCourte } from "../outils";

/** Deux minutes au plus, comme sur la maquette du panel. */
export const DUREE_MAX_VOCAL = 120;

const FORMATS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export const enregistrementPossible = () =>
  typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

export type NoteEnregistree = { fichier: File; dureeSecondes: number };

type Etat = "repos" | "demande" | "enregistre";

/**
 * Enregistreur de note vocale. demarrer() demande le micro puis enregistre ;
 * terminer() rend le fichier prêt à envoyer (type sans paramètres, sinon le
 * serveur le refuse) ; annuler() jette tout.
 */
export function useEnregistreur(surLimite: () => void) {
  const [etat, setEtat] = useState<Etat>("repos");
  const [secondes, setSecondes] = useState(0);
  const enregistreur = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const debut = useRef(0);
  const minuterie = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const flux = useRef<MediaStream | null>(null);
  const limite = useRef(surLimite);
  limite.current = surLimite;

  const liberer = useCallback(() => {
    clearInterval(minuterie.current);
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
    enregistreur.current = null;
    setEtat("repos");
    setSecondes(0);
  }, []);

  useEffect(() => () => liberer(), [liberer]);

  const demarrer = useCallback(async (): Promise<boolean> => {
    if (!enregistrementPossible() || enregistreur.current) return false;
    setEtat("demande");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      flux.current = s;
      const format = FORMATS.find((f) => MediaRecorder.isTypeSupported(f));
      const r = new MediaRecorder(s, { ...(format ? { mimeType: format } : {}), audioBitsPerSecond: 24_000 });
      morceaux.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size) morceaux.current.push(e.data);
      };
      r.start(500);
      enregistreur.current = r;
      debut.current = Date.now();
      setSecondes(0);
      setEtat("enregistre");
      minuterie.current = setInterval(() => {
        const s2 = (Date.now() - debut.current) / 1000;
        setSecondes(s2);
        if (s2 >= DUREE_MAX_VOCAL) limite.current();
      }, 250);
      return true;
    } catch {
      liberer();
      throw new Error("Autorise le micro pour enregistrer une note vocale (réglages du navigateur).");
    }
  }, [liberer]);

  const terminer = useCallback(async (): Promise<NoteEnregistree | null> => {
    const r = enregistreur.current;
    if (!r) return null;
    const dureeSecondes = Math.min(DUREE_MAX_VOCAL, Math.round((Date.now() - debut.current) / 1000));
    const type = (r.mimeType || "audio/webm").split(";")[0];
    await new Promise<void>((ok) => {
      r.onstop = () => ok();
      r.stop();
    });
    liberer();
    const blob = new Blob(morceaux.current, { type });
    if (dureeSecondes < 1 || blob.size < 500) return null; // appui trop bref
    const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    return { fichier: new File([blob], `note-vocale.${extension}`, { type }), dureeSecondes };
  }, [liberer]);

  const annuler = useCallback(() => {
    const r = enregistreur.current;
    if (r && r.state !== "inactive") {
      r.onstop = null;
      r.stop();
    }
    liberer();
  }, [liberer]);

  return { etat, secondes, demarrer, terminer, annuler };
}

// ── Lecteur ────────────────────────────────────────────────────────────────

/** Un seul lecteur à la fois, comme sur WhatsApp. */
let lecteurEnCours: HTMLAudioElement | null = null;

export function LecteurVocal({ url, duree, deMoi, taille }: { url: string; duree: number | null; deMoi: boolean; taille?: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [lecture, setLecture] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [position, setPosition] = useState(0);
  const total = duree && duree > 0 ? duree : null;

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const surTemps = () => setPosition(a.currentTime);
    const surFin = () => {
      setLecture(false);
      setPosition(0);
    };
    const surPause = () => setLecture(false);
    const surLecture = () => {
      setChargement(false);
      setLecture(true);
    };
    const surAttente = () => setChargement(true);
    a.addEventListener("timeupdate", surTemps);
    a.addEventListener("ended", surFin);
    a.addEventListener("pause", surPause);
    a.addEventListener("playing", surLecture);
    a.addEventListener("waiting", surAttente);
    return () => {
      a.removeEventListener("timeupdate", surTemps);
      a.removeEventListener("ended", surFin);
      a.removeEventListener("pause", surPause);
      a.removeEventListener("playing", surLecture);
      a.removeEventListener("waiting", surAttente);
      if (lecteurEnCours === a) lecteurEnCours = null;
    };
  }, []);

  function basculer() {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    if (lecteurEnCours && lecteurEnCours !== a) lecteurEnCours.pause();
    lecteurEnCours = a;
    setChargement(true);
    a.play().catch(() => setChargement(false));
  }

  const progression = total ? Math.min(100, (position / total) * 100) : 0;

  return (
    <div className="flex min-w-[210px] max-w-[280px] items-center gap-3 py-0.5" style={taille ? { width: taille } : undefined}>
      <button
        type="button"
        onClick={basculer}
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-full transition-colors",
          deMoi ? "bg-encre text-white hover:bg-orange hover:text-encre" : "bg-orange text-encre hover:bg-encre hover:text-white",
        )}
        aria-label={lecture ? "Mettre en pause la note vocale" : "Écouter la note vocale"}
      >
        {chargement && !lecture ? <Loader2 className="h-5 w-5 animate-spin" /> : lecture ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div
          className="relative h-1.5 cursor-pointer rounded-full bg-encre/10"
          role="slider"
          tabIndex={-1}
          aria-label="Position dans la note vocale"
          aria-valuemin={0}
          aria-valuemax={total ?? 0}
          aria-valuenow={Math.round(position)}
          onClick={(e) => {
            const a = audio.current;
            if (!a || !total) return;
            const r = e.currentTarget.getBoundingClientRect();
            a.currentTime = ((e.clientX - r.left) / r.width) * total;
          }}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-orange-fonce" style={{ width: `${progression}%` }} />
          <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-fonce" style={{ left: `${progression}%` }} />
        </div>
        <span className="font-mono text-xs text-texte-pale">
          {lecture || position > 0 ? dureeCourte(position) : total ? dureeCourte(total) : "Note vocale"}
        </span>
      </div>
      <audio ref={audio} src={url} preload="none" />
    </div>
  );
}
