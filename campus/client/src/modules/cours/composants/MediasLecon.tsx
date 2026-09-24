// Ce qui accompagne le texte d'une leçon, pensé pour la 4G prépayée : une
// vidéo ne se charge qu'au toucher (miniature seule au départ, poids
// annoncé), un fichier affiche son poids avant le téléchargement.
import { useState } from "react";
import { Play, FileDown, ExternalLink, Download, Paperclip, Wifi } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { useMoiConnecte } from "@/lib/auth";
import { taille } from "@/lib/utils";
import { idYoutube, poidsVideoEstime } from "../outils";
import type { FichierDeLecon } from "@shared/schema";

/** Vidéo YouTube : miniature légère (≈ 15 Ko), le lecteur ne se charge qu'au toucher. */
export function VideoYoutube({ id, titre, minutes }: { id: string; titre: string; minutes: number | null }) {
  const moi = useMoiConnecte();
  const [chargee, setChargee] = useState(false);
  const [miniatureKo, setMiniatureKo] = useState(false);
  const poids = poidsVideoEstime(minutes);
  // En mode données réduites, même la miniature attend.
  const sansMiniature = Boolean(moi.preferences?.donneesReduites);

  if (chargee) {
    return (
      <div className="overflow-hidden rounded-2xl bg-encre" style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={titre}
          className="h-full w-full"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setChargee(true)}
      className="group relative block w-full overflow-hidden rounded-2xl bg-encre text-left text-white"
      style={{ aspectRatio: "16 / 9" }}
      aria-label={`Charger la vidéo « ${titre} »${poids ? `, environ ${poids} mégaoctets` : ""}`}
    >
      {!sansMiniature && !miniatureKo && (
        <img
          src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          onError={() => setMiniatureKo(true)}
          className="absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-45"
        />
      )}
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-orange text-encre shadow-carte transition-transform group-hover:scale-105">
          <Play className="ml-1 h-7 w-7" fill="currentColor" />
        </span>
        <span className="text-base font-bold leading-snug [text-shadow:0_1px_8px_rgba(0,0,0,.6)]">
          Toucher pour charger la vidéo{poids ? ` (≈ ${poids} Mo)` : ""}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-white/80">
          <Wifi className="h-3.5 w-3.5" /> {poids ? "Estimation en qualité basse · le Wi-Fi est conseillé" : "Plusieurs Mo · le Wi-Fi est conseillé"}
        </span>
      </span>
    </button>
  );
}

/** Vidéo déposée sur le campus : poids exact connu, rien ne se charge avant le toucher. */
export function VideoFichier({ fichier, titre }: { fichier: FichierDeLecon; titre: string }) {
  const [chargee, setChargee] = useState(false);
  if (chargee) {
    return <video src={fichier.url} controls autoPlay playsInline preload="auto" className="w-full rounded-2xl bg-encre" aria-label={titre} />;
  }
  return (
    <button
      type="button"
      onClick={() => setChargee(true)}
      className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl bg-encre px-6 text-center text-white"
      style={{ aspectRatio: "16 / 9" }}
    >
      <span className="grid h-16 w-16 place-items-center rounded-full bg-orange text-encre">
        <Play className="ml-1 h-7 w-7" fill="currentColor" />
      </span>
      <span className="text-base font-bold">Toucher pour charger la vidéo ({taille(fichier.taille)})</span>
    </button>
  );
}

/** Vidéo sur un autre site (Vimeo, lien direct…) : on n'embarque rien, on ouvre. */
export function VideoExterne({ url }: { url: string }) {
  return <LienExterne url={url} titre="Vidéo sur un autre site" />;
}

export function LienExterne({ url, titre = "Ressource sur un autre site" }: { url: string; titre?: string }) {
  let hote = url;
  try {
    hote = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* adresse illisible : on l'affiche telle quelle */
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ligne bg-creme p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-orange-fonce">
          <ExternalLink className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-base font-bold">{titre}</span>
          <span className="truncate font-mono text-[13px] text-texte-pale">{hote}</span>
          <span className="text-[13px] text-texte-gris">S'ouvre dans un nouvel onglet ; le campus reste ouvert.</span>
        </div>
      </div>
      <LienBouton href={url} externe variante="contour" icone={<ExternalLink className="h-4 w-4" />} className="min-h-[48px] shrink-0">
        Ouvrir le lien
      </LienBouton>
    </div>
  );
}

/** Fichier joint : nom, nature et poids AVANT le téléchargement. */
export function BlocFichier({ fichier }: { fichier: FichierDeLecon }) {
  const pdf = fichier.mime === "application/pdf";
  const Icone = pdf ? FileDown : Paperclip;
  const extension = fichier.nom.includes(".") ? fichier.nom.split(".").pop()!.toUpperCase() : "Fichier";
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">
          <Icone className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="break-words text-base font-bold">{fichier.nom}</span>
          <span className="font-mono text-[13px] text-texte-pale">
            {pdf ? "PDF" : extension} · {taille(fichier.taille)}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {pdf && (
          <LienBouton href={fichier.url} externe variante="contour" className="min-h-[48px]">
            Ouvrir
          </LienBouton>
        )}
        <LienBouton href={`${fichier.url}?telecharger=1`} externe variante="contour" icone={<Download className="h-4 w-4" />} className="min-h-[48px]">
          Télécharger · {taille(fichier.taille)}
        </LienBouton>
      </div>
    </div>
  );
}

/** Choisit le bon bloc selon le type de la leçon. */
export function MediaLecon({
  type,
  url,
  fichier,
  titre,
  minutes,
}: {
  type: string;
  url: string | null;
  fichier: FichierDeLecon | null;
  titre: string;
  minutes: number | null;
}) {
  const blocs = [];
  if (type === "video") {
    const yt = idYoutube(url);
    if (yt) blocs.push(<VideoYoutube key="yt" id={yt} titre={titre} minutes={minutes} />);
    else if (fichier?.mime.startsWith("video/")) blocs.push(<VideoFichier key="vf" fichier={fichier} titre={titre} />);
    else if (url) blocs.push(<VideoExterne key="ve" url={url} />);
  }
  if (type === "lien" && url) blocs.push(<LienExterne key="lien" url={url} />);
  if (fichier && !(type === "video" && fichier.mime.startsWith("video/") && !idYoutube(url))) blocs.push(<BlocFichier key="f" fichier={fichier} />);
  if (!blocs.length) return null;
  return <div className="flex flex-col gap-4">{blocs}</div>;
}
