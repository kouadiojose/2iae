// Outils de la correction : visionneuse de copie (photos zoomables, PDF,
// fichiers) et commentaire vocal (MediaRecorder, 60 s au plus).
import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Trash2, ZoomIn, ZoomOut, RotateCw, FileText, Download } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { toastErreur } from "@/components/ui/toast";
import { televerser } from "@/lib/api";
import { duree } from "@/lib/dates";
import { taille, cn } from "@/lib/utils";
import type { PieceJointe } from "@shared/schema";

/** Pages et fichiers d'une copie : photos en grand (zoom, rotation), PDF intégré, autres fichiers à télécharger. */
export function Visionneuse({ fichiers, texte }: { fichiers: PieceJointe[]; texte: string }) {
  const [zoom, setZoom] = useState<PieceJointe | null>(null);
  const [grand, setGrand] = useState(false);
  const [rotation, setRotation] = useState(0);
  const images = fichiers.filter((f) => f.mime.startsWith("image/"));
  const pdfs = fichiers.filter((f) => f.mime === "application/pdf");
  const autres = fichiers.filter((f) => !f.mime.startsWith("image/") && f.mime !== "application/pdf");

  const ouvrir = (f: PieceJointe) => {
    setZoom(f);
    setGrand(false);
    setRotation(0);
  };

  return (
    <div className="flex flex-col gap-4">
      {images.map((f, i) => (
        <figure key={f.id} className="overflow-hidden rounded-2xl border border-ligne bg-creme">
          <button type="button" onClick={() => ouvrir(f)} className="block w-full cursor-zoom-in" aria-label={`Agrandir la page ${i + 1}`}>
            <img src={f.url} alt={`Page ${i + 1}`} loading="lazy" className="max-h-[80vh] w-full object-contain" />
          </button>
          <figcaption className="flex justify-between border-t border-ligne bg-white px-3 py-2 font-mono text-xs text-texte-gris">
            <span>Page {i + 1}</span>
            <span>{taille(f.taille)}</span>
          </figcaption>
        </figure>
      ))}
      {pdfs.map((f) => (
        <div key={f.id} className="flex flex-col gap-2">
          <iframe src={f.url} title={f.nom} className="hidden h-[70vh] w-full rounded-2xl border border-ligne bg-creme md:block" />
          <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] items-center gap-3 rounded-xl border border-ligne bg-white px-4 text-encre no-underline hover:border-orange">
            <FileText className="h-5 w-5 text-orange-fonce" />
            <span className="flex-1 truncate font-semibold">{f.nom}</span>
            <span className="font-mono text-xs text-texte-gris">{taille(f.taille)}</span>
          </a>
        </div>
      ))}
      {autres.map((f) => (
        <a key={f.id} href={`${f.url}?telecharger=1`} className="flex min-h-[52px] items-center gap-3 rounded-xl border border-ligne bg-white px-4 text-encre no-underline hover:border-orange">
          <Download className="h-5 w-5 text-orange-fonce" />
          <span className="flex-1 truncate font-semibold">{f.nom}</span>
          <span className="font-mono text-xs text-texte-gris">{taille(f.taille)}</span>
        </a>
      ))}
      {texte.trim() && (
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <div className="mb-2 font-mono text-xs uppercase tracking-wider text-texte-gris">Texte rendu</div>
          <p className="whitespace-pre-line text-[15.5px] leading-relaxed text-texte-doux">{texte}</p>
        </div>
      )}
      {!fichiers.length && !texte.trim() && <p className="text-texte-pale">Copie vide.</p>}

      <Fenetre
        ouverte={Boolean(zoom)}
        onFermer={() => setZoom(null)}
        large
        titre={zoom ? `Page ${images.findIndex((x) => x.id === zoom.id) + 1}` : ""}
        pied={
          <>
            <Bouton variante="contour" icone={<RotateCw className="h-4 w-4" />} onClick={() => setRotation((r) => (r + 90) % 360)}>
              Tourner
            </Bouton>
            <Bouton variante="contour" icone={grand ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />} onClick={() => setGrand((g) => !g)}>
              {grand ? "Ajuster" : "Taille réelle"}
            </Bouton>
          </>
        }
      >
        {zoom && (
          <div className={cn("overflow-auto rounded-xl bg-creme", grand ? "max-h-[72dvh]" : "")}>
            <img
              src={zoom.url}
              alt=""
              style={{ transform: `rotate(${rotation}deg)` }}
              className={cn("mx-auto transition-transform", grand ? "max-w-none" : "max-h-[68dvh] w-full object-contain")}
            />
          </div>
        )}
      </Fenetre>
    </div>
  );
}

const DUREE_MAX = 60;

/**
 * Commentaire vocal du formateur : on enregistre (60 s au plus), on
 * réécoute, on garde. Le fichier (audio/webm, ~100 Ko) est rangé avec la
 * copie ; l'étudiant l'écoute quand la note est publiée.
 */
export function EnregistreurVocal({ audio, onChange }: { audio: PieceJointe | null; onChange: (fichierId: number | null) => Promise<void> | void }) {
  const [etat, setEtat] = useState<"repos" | "enregistrement" | "apercu">("repos");
  const [secondes, setSecondes] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const enregistreur = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);
  const possible = typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(
    () => () => {
      if (minuteur.current) clearInterval(minuteur.current);
      enregistreur.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  async function demarrer() {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(flux, type ? { mimeType: type, audioBitsPerSecond: 24_000 } : undefined);
      morceaux.current = [];
      r.ondataavailable = (e) => e.data.size && morceaux.current.push(e.data);
      r.onstop = () => {
        flux.getTracks().forEach((t) => t.stop());
        // Le type sans « ;codecs=… » : c'est ce que le serveur accepte.
        setBlob(new Blob(morceaux.current, { type: (r.mimeType || "audio/webm").split(";")[0] }));
        setEtat("apercu");
      };
      enregistreur.current = r;
      r.start(1000);
      setSecondes(0);
      setEtat("enregistrement");
      minuteur.current = setInterval(() => {
        setSecondes((s) => {
          if (s + 1 >= DUREE_MAX) arreter();
          return s + 1;
        });
      }, 1000);
    } catch {
      toastErreur(new Error("Micro indisponible : autorisez le micro dans votre navigateur."));
    }
  }

  function arreter() {
    if (minuteur.current) clearInterval(minuteur.current);
    minuteur.current = null;
    if (enregistreur.current?.state === "recording") enregistreur.current.stop();
  }

  async function garder() {
    if (!blob) return;
    setEnvoi(true);
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const [f] = await televerser([new File([blob], `commentaire-vocal.${ext}`, { type: blob.type })], "rendu");
      await onChange(f.id);
      setBlob(null);
      setEtat("repos");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  if (!possible) return <p className="text-sm text-texte-gris">Ce navigateur ne permet pas d'enregistrer un commentaire vocal.</p>;

  if (etat === "enregistrement") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-encre p-3 text-white">
        <span className="point-direct" />
        <span className="font-mono text-lg tabular-nums">{duree(secondes)}</span>
        <span className="flex-1 text-sm text-nuit-doux">Parlez… (60 s au plus)</span>
        <Bouton variante="nuit-actif" onClick={arreter} icone={<Square className="h-4 w-4" />}>
          Arrêter
        </Bouton>
      </div>
    );
  }
  if (etat === "apercu" && url) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-ligne bg-creme p-3">
        <audio controls src={url} className="w-full" />
        <div className="flex gap-2">
          <Bouton variante="contour" icone={<RotateCcw className="h-4 w-4" />} onClick={() => void demarrer()} className="flex-1">
            Recommencer
          </Bouton>
          <Bouton onClick={() => void garder()} chargement={envoi} className="flex-1">
            Garder ({blob ? taille(blob.size) : ""})
          </Bouton>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {audio && (
        <div className="flex items-center gap-2 rounded-2xl border border-ligne bg-creme p-2">
          <audio controls preload="none" src={audio.url} className="min-w-0 flex-1" />
          <button type="button" onClick={() => void onChange(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-danger hover:bg-danger-clair" aria-label="Supprimer le commentaire vocal">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
      <Bouton variante="doux" icone={<Mic className="h-4 w-4" />} onClick={() => void demarrer()} className="min-h-[48px]">
        {audio ? "Réenregistrer le commentaire vocal" : "Commenter à voix haute"}
      </Bouton>
    </div>
  );
}
