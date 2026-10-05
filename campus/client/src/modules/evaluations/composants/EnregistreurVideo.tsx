// Filmer une courte vidéo pour rendre un devoir (expliquer sa démarche,
// montrer un travail pratique) : enregistrée dans le navigateur en qualité
// légère (environ 5 Mo la minute, au lieu de 100 Mo avec l'appareil photo du
// téléphone), 3 minutes au plus. Sans enregistreur dans le navigateur, on
// passe par l'appareil photo du téléphone.
import { useEffect, useRef, useState } from "react";
import { Circle, RotateCcw, Square, SwitchCamera, Video, X } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const DUREE_MAX_S = 180;

const formatPossible = () =>
  ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1,mp4a", "video/mp4"].find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)) ?? null;

export const enregistreurDisponible = () => typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

export function EnregistreurVideo({ onTermine, onFermer }: { onTermine: (fichier: File) => void; onFermer: () => void }) {
  const apercu = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const enregistreur = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const [face, setFace] = useState<"environment" | "user">("environment");
  // Change à chaque « Refaire » : la caméra, éteinte pendant la relecture, se rallume.
  const [prise, setPrise] = useState(0);
  const demonte = useRef(false);
  useEffect(() => {
    demonte.current = false;
    return () => void (demonte.current = true);
  }, []);
  const [etat, setEtat] = useState<"pret" | "enregistre" | "fini">("pret");
  const [secondes, setSecondes] = useState(0);
  const [video, setVideo] = useState<{ url: string; blob: Blob } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Caméra ouverte en petite définition : la vidéo reste légère pour un petit forfait.
  useEffect(() => {
    let annule = false;
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: face, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } }, audio: true })
      .then((m) => {
        if (annule) return m.getTracks().forEach((t) => t.stop());
        flux.current = m;
        if (apercu.current) {
          apercu.current.srcObject = m;
          void apercu.current.play().catch(() => undefined);
        }
      })
      .catch(() => setErreur("La caméra ou le micro n'est pas accessible. Autorise-les dans ton navigateur, ou envoie plutôt une photo ou un fichier."));
    return () => {
      annule = true;
      flux.current?.getTracks().forEach((t) => t.stop());
      flux.current = null;
    };
  }, [face, prise]);

  useEffect(() => {
    if (etat !== "enregistre") return;
    const t = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [etat]);
  useEffect(() => {
    if (etat === "enregistre" && secondes >= DUREE_MAX_S) arreter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondes, etat]);
  useEffect(() => () => void (video && URL.revokeObjectURL(video.url)), [video]);
  // Retour à la caméra après « Refaire » : l'aperçu reprend le flux.
  useEffect(() => {
    if (etat !== "fini" && apercu.current && flux.current && apercu.current.srcObject !== flux.current) {
      apercu.current.srcObject = flux.current;
      void apercu.current.play().catch(() => undefined);
    }
  }, [etat]);

  function demarrer() {
    if (!flux.current) return;
    const type = formatPossible();
    const r = new MediaRecorder(flux.current, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 550_000, audioBitsPerSecond: 48_000 });
    morceaux.current = [];
    r.ondataavailable = (e) => e.data.size && morceaux.current.push(e.data);
    r.onstop = () => {
      // Fermé pendant l'enregistrement : rien à garder.
      if (demonte.current) return;
      // Caméra et micro éteints pendant la relecture.
      flux.current?.getTracks().forEach((t) => t.stop());
      flux.current = null;
      const blob = new Blob(morceaux.current, { type: (r.mimeType || type || "video/webm").split(";")[0] });
      setVideo({ url: URL.createObjectURL(blob), blob });
      setEtat("fini");
    };
    r.start(1000);
    enregistreur.current = r;
    setSecondes(0);
    setEtat("enregistre");
  }

  function arreter() {
    enregistreur.current?.state === "recording" && enregistreur.current.stop();
  }

  function garder() {
    if (!video) return;
    const ext = video.blob.type.includes("mp4") ? "mp4" : "webm";
    onTermine(new File([video.blob], `video-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`, { type: video.blob.type }));
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-encre text-white" role="dialog" aria-modal="true" aria-label="Filmer une vidéo">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-mono text-sm">{etat === "enregistre" ? `● ${mmss(secondes)} / ${mmss(DUREE_MAX_S)}` : "Vidéo légère, 3 minutes au plus"}</span>
        <button type="button" onClick={onFermer} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Fermer">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {erreur ? (
          <p className="max-w-sm px-6 text-center text-[15px]">{erreur}</p>
        ) : etat === "fini" && video ? (
          <video src={video.url} controls playsInline className="max-h-full max-w-full" />
        ) : (
          <video ref={apercu} muted playsInline className="max-h-full max-w-full" />
        )}
      </div>
      <div className="flex items-center justify-center gap-3 px-4 pb-8 pt-4">
        {etat === "pret" && !erreur && (
          <>
            <button type="button" onClick={() => setFace((f) => (f === "environment" ? "user" : "environment"))} className="grid h-12 w-12 place-items-center rounded-full bg-white/10" aria-label="Changer de caméra">
              <SwitchCamera className="h-6 w-6" />
            </button>
            <button type="button" onClick={demarrer} className="grid h-20 w-20 place-items-center rounded-full border-4 border-white" aria-label="Commencer l'enregistrement">
              <Circle className="h-14 w-14 fill-danger text-danger" />
            </button>
          </>
        )}
        {etat === "enregistre" && (
          <button type="button" onClick={arreter} className="grid h-20 w-20 place-items-center rounded-full border-4 border-white" aria-label="Arrêter l'enregistrement">
            <Square className="h-10 w-10 fill-white" />
          </button>
        )}
        {etat === "fini" && (
          <>
            <Bouton
              variante="contour"
              icone={<RotateCcw className="h-4 w-4" />}
              onClick={() => {
                setEtat("pret");
                setPrise((n) => n + 1);
              }}
            >
              Refaire
            </Bouton>
            <Bouton icone={<Video className="h-4 w-4" />} onClick={garder}>
              Garder cette vidéo ({Math.max(1, Math.round((video?.blob.size ?? 0) / 1_000_000))} Mo)
            </Bouton>
          </>
        )}
      </div>
    </div>
  );
}
