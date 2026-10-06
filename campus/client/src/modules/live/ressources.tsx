// Ressources d'une séance (liens YouTube ou autres, vidéos de l'ordinateur,
// PDF, documents) et projection d'une vidéo dans les salles.
//
// Projection : chaque écran (salles, étudiants en vidéo, Studio du formateur)
// suit le même état publié par le serveur — vidéo, lecture ou pause, position
// à un instant de l'horloge du serveur — et se recale au-delà de 2 secondes
// d'écart. Le formateur pilote avec de gros boutons ; son aperçu est muet
// (sinon son micro renverrait le son dans les salles).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Download, ExternalLink, FileText, Link2, MonitorPlay, Pause, Pencil, Play, Plus, RotateCcw, RotateCw, Square, Trash2, Upload, Video, Volume2, VolumeX, Youtube } from "lucide-react";
import { post, patch, put, suppr } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { maintenantServeur } from "@/lib/horloge";
import { cn, taille } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import type { ProjectionDto, RessourceSeanceDto, SeanceDetailDto } from "@shared/schema";

// ── Position et lecteur synchronisé ────────────────────────────────────────

/** Position (secondes) de la vidéo projetée à cet instant, d'après l'horloge du serveur. */
export function positionCourante(p: Pick<ProjectionDto, "lecture" | "position" | "horodatage">): number {
  return p.lecture ? p.position + Math.max(0, maintenantServeur() - p.horodatage) / 1000 : p.position;
}

export const minutes = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

export const projetable = (r: Pick<RessourceSeanceDto, "type">) => r.type === "youtube" || r.type === "video";

/** Écart toléré avant de recaler la vidéo (secondes). */
const ECART_MAX = 2;

type LecteurYT = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, autoriser: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
};
type ApiYT = { Player: new (el: HTMLElement, options: Record<string, unknown>) => LecteurYT };
declare global {
  interface Window {
    YT?: ApiYT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let chargementYT: Promise<ApiYT> | null = null;
/** Le lecteur YouTube (iframe API), chargé une seule fois et seulement quand une vidéo YouTube est projetée. */
function chargerYoutube(): Promise<ApiYT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  chargementYT ??= new Promise<ApiYT>((ok, ko) => {
    const avant = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      avant?.();
      if (window.YT) ok(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      chargementYT = null;
      ko(new Error("YouTube ne répond pas"));
    };
    document.head.appendChild(s);
  });
  return chargementYT;
}

/** Commandes communes aux deux lecteurs (YouTube et fichier vidéo). */
type Pilote = { lire: () => Promise<void> | void; pause: () => void; aller: (s: number) => void; position: () => number; duree: () => number; son: (oui: boolean) => void };

/**
 * Lecteur qui suit la projection. son : le son sort de cet écran (salles,
 * étudiants) ; muet chez le formateur. onDuree : durée connue (commandes).
 * Lecture automatique refusée par le navigateur : un gros bouton la lance.
 */
export function LecteurProjection({ projection, son, onDuree, className }: { projection: ProjectionDto; son: boolean; onDuree?: (s: number) => void; className?: string }) {
  const hote = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const pilote = useRef<Pilote | null>(null);
  const [pret, setPret] = useState(false);
  const [bloquee, setBloquee] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const r = projection.ressource;
  const etat = useRef(projection);
  etat.current = projection;

  // YouTube : un lecteur par vidéo, sans commandes (c'est le formateur qui pilote).
  useEffect(() => {
    if (r.type !== "youtube" || !r.youtubeId || !hote.current) return;
    let fini = false;
    let lecteur: LecteurYT | null = null;
    const cible = document.createElement("div");
    hote.current.replaceChildren(cible);
    setPret(false);
    setErreur(null);
    chargerYoutube()
      .then((YT) => {
        if (fini) return;
        lecteur = new YT.Player(cible, {
          host: "https://www.youtube-nocookie.com",
          videoId: r.youtubeId,
          width: "100%",
          height: "100%",
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, fs: 0, iv_load_policy: 3, start: Math.floor(positionCourante(etat.current)) },
          events: {
            onReady: () => {
              if (fini || !lecteur) return;
              const l = lecteur;
              pilote.current = {
                lire: () => l.playVideo(),
                pause: () => l.pauseVideo(),
                aller: (s) => l.seekTo(s, true),
                position: () => l.getCurrentTime() || 0,
                duree: () => l.getDuration() || 0,
                son: (oui) => (oui ? l.unMute() : l.mute()),
              };
              setPret(true);
            },
            onError: () => setErreur("Cette vidéo YouTube ne peut pas être lue ici (vidéo privée, supprimée, ou intégration interdite par son auteur)."),
          },
        });
      })
      .catch(() => setErreur("YouTube ne répond pas sur ce réseau."));
    return () => {
      fini = true;
      pilote.current = null;
      try {
        lecteur?.destroy();
      } catch {
        /* déjà détruit */
      }
    };
  }, [r.type, r.youtubeId]);

  // Fichier vidéo : la balise <video> du navigateur.
  useEffect(() => {
    if (r.type !== "video") return;
    const v = video.current;
    if (!v) return;
    setPret(false);
    setErreur(null);
    const surPret = () => {
      pilote.current = {
        lire: () => v.play(),
        pause: () => v.pause(),
        aller: (s) => {
          v.currentTime = s;
        },
        position: () => v.currentTime || 0,
        duree: () => (Number.isFinite(v.duration) ? v.duration : 0),
        son: (oui) => {
          v.muted = !oui;
        },
      };
      setPret(true);
    };
    if (v.readyState >= 1) surPret();
    v.addEventListener("loadedmetadata", surPret);
    return () => {
      v.removeEventListener("loadedmetadata", surPret);
      pilote.current = null;
    };
  }, [r.type, r.url]);

  // Suivre l'état publié : position, lecture ou pause, et recalage régulier.
  useEffect(() => {
    if (!pret) return;
    const p = pilote.current;
    if (!p) return;
    p.son(son);
    const d = p.duree();
    if (d) onDuree?.(d);
    const appliquer = () => {
      const q = pilote.current;
      if (!q) return;
      const cible = positionCourante(etat.current);
      if (Math.abs(q.position() - cible) > ECART_MAX) q.aller(cible);
      if (etat.current.lecture) {
        const lance = q.lire();
        if (lance && typeof (lance as Promise<void>).catch === "function") {
          (lance as Promise<void>).then(
            () => setBloquee(false),
            () => setBloquee(true),
          );
        }
      } else q.pause();
    };
    appliquer();
    const t = setInterval(() => {
      appliquer();
      const duree = pilote.current?.duree();
      if (duree) onDuree?.(duree);
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, projection.lecture, projection.position, projection.horodatage, son]);

  // YouTube ne dit pas quand la lecture automatique est refusée : lecture demandée mais rien ne bouge.
  useEffect(() => {
    if (r.type !== "youtube" || !pret || !projection.lecture) return setBloquee(false);
    const t = setTimeout(() => {
      const ici = pilote.current?.position();
      if (ici !== undefined && Math.abs(ici - positionCourante(etat.current)) > 3) setBloquee(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [r.type, pret, projection.lecture, projection.horodatage]);

  const debloquer = () => {
    const p = pilote.current;
    if (!p) return;
    p.son(son);
    p.aller(positionCourante(etat.current));
    void Promise.resolve(p.lire()).then(() => setBloquee(false));
  };

  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      {r.type === "youtube" ? (
        <div ref={hote} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      ) : (
        <video ref={video} src={r.url} playsInline preload="auto" className="h-full w-full object-contain" onError={() => setErreur("La vidéo ne se lit pas sur cet appareil (format non pris en charge ?).")} />
      )}
      {erreur && <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl bg-black/85 p-4 text-center text-[15px] font-semibold text-white">{erreur}</p>}
      {bloquee && !erreur && (
        <button type="button" onClick={debloquer} className="absolute inset-0 grid place-items-center bg-black/60 text-white">
          <span className="flex flex-col items-center gap-3">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-orange text-encre">
              <Play className="h-10 w-10 fill-current" />
            </span>
            <span className="text-lg font-extrabold">Lancer la vidéo</span>
          </span>
        </button>
      )}
    </div>
  );
}

/** La vidéo projetée dans la scène (salles, étudiants en vidéo), avec son titre. */
export function VideoProjetee({ projection, className, son = true }: { projection: ProjectionDto; className?: string; son?: boolean }) {
  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      <LecteurProjection projection={projection} son={son} />
      <span className="pointer-events-none absolute left-3 top-3 flex max-w-[70%] items-center gap-1.5 truncate rounded-lg bg-black/70 px-2.5 py-1 font-mono text-xs text-orange-peche">
        <MonitorPlay className="h-3.5 w-3.5 shrink-0" /> {projection.ressource.titre}
      </span>
    </div>
  );
}

/**
 * Étudiant en « son + diapos » : la vidéo projetée ne se charge pas d'office
 * (forfait). Un bouton la lance ici, synchronisée avec la salle.
 */
export function CarteVideoProjetee({ projection }: { projection: ProjectionDto }) {
  const [regarder, setRegarder] = useState(false);
  useEffect(() => setRegarder(false), [projection.ressourceId]);
  const r = projection.ressource;
  if (regarder) return <VideoProjetee projection={projection} />;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-nuit-carte p-5 text-center text-white">
      <MonitorPlay className="h-10 w-10 text-orange" />
      <p className="text-[15px] font-bold">Le formateur projette une vidéo</p>
      <p className="max-w-sm text-sm text-nuit-doux">{r.titre}</p>
      <Bouton onClick={() => setRegarder(true)} icone={<Play className="h-4 w-4" />}>
        Regarder ici{r.type === "video" && r.taille ? ` (${taille(r.taille)})` : " (consomme des données)"}
      </Bouton>
    </div>
  );
}

// ── Commandes du formateur ─────────────────────────────────────────────────

export function CommandesProjection({ seanceId, projection }: { seanceId: number; projection: ProjectionDto }) {
  const [duree, setDuree] = useState(0);
  const [, rafraichirAffichage] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [sonIci, setSonIci] = useState(false);
  useEffect(() => {
    const t = setInterval(() => rafraichirAffichage((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);
  const position = Math.min(positionCourante(projection), duree || Infinity);
  const envoyer = async (corps: { ressourceId: number | null; lecture?: boolean; position?: number }) => {
    setEnvoi(true);
    try {
      await post(`/api/seances/${seanceId}/projection`, corps);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const id = projection.ressourceId;
  const aller = (s: number) => void envoyer({ ressourceId: id, position: Math.max(0, duree ? Math.min(s, duree - 1) : s) });
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-video overflow-hidden rounded-xl border-2 border-orange bg-black">
        <LecteurProjection projection={projection} son={sonIci} onDuree={setDuree} />
        <span className="absolute left-2 top-2 rounded-md bg-orange px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-encre">Projetée dans les salles</span>
        <button
          type="button"
          onClick={() => setSonIci((s) => !s)}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-bold text-white"
          title="Le son de l'aperçu reste coupé chez vous : votre micro le renverrait dans les salles."
        >
          {sonIci ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} {sonIci ? "Son chez moi" : "Aperçu muet"}
        </button>
      </div>
      <p className="truncate text-sm font-bold text-white">{projection.ressource.titre}</p>
      <div className="flex items-center gap-2 font-mono text-xs text-nuit-doux">
        <span>{minutes(position)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duree))}
          value={Math.floor(position)}
          onChange={(e) => aller(Number(e.target.value))}
          className="h-2 flex-1 accent-[#E4793A]"
          aria-label="Avancer ou reculer la vidéo"
          disabled={!duree}
        />
        <span>{duree ? minutes(duree) : "…"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Bouton taille="sm" variante="nuit" icone={<RotateCcw className="h-4 w-4" />} onClick={() => aller(position - 10)} disabled={envoi} aria-label="Reculer de 10 secondes">
          10 s
        </Bouton>
        {projection.lecture ? (
          <Bouton taille="sm" variante="nuit-actif" icone={<Pause className="h-4 w-4" />} onClick={() => void envoyer({ ressourceId: id, lecture: false, position })} disabled={envoi}>
            Pause
          </Bouton>
        ) : (
          <Bouton taille="sm" variante="nuit-actif" icone={<Play className="h-4 w-4" />} onClick={() => void envoyer({ ressourceId: id, lecture: true, position })} disabled={envoi}>
            Lancer pour les salles
          </Bouton>
        )}
        <Bouton taille="sm" variante="nuit" icone={<RotateCw className="h-4 w-4" />} onClick={() => aller(position + 10)} disabled={envoi} aria-label="Avancer de 10 secondes">
          10 s
        </Bouton>
        <Bouton taille="sm" variante="nuit" icone={<Square className="h-4 w-4" />} onClick={() => void envoyer({ ressourceId: null })} disabled={envoi}>
          Arrêter la projection
        </Bouton>
      </div>
    </div>
  );
}

// ── Liste des ressources (étudiants, salles, formateur) ─────────────────────

function IconeRessource({ r, className }: { r: RessourceSeanceDto; className?: string }) {
  const Icone = r.type === "youtube" ? Youtube : r.type === "video" ? Video : r.type === "lien" ? Link2 : FileText;
  return <Icone className={className} />;
}

function detailRessource(r: RessourceSeanceDto): string {
  if (r.type === "youtube") return "Vidéo YouTube";
  if (r.type === "lien") {
    try {
      return new URL(r.url).hostname.replace(/^www\./, "");
    } catch {
      return "Lien";
    }
  }
  return [r.type === "video" ? "Vidéo" : (r.nom?.split(".").pop()?.toUpperCase() ?? "Fichier"), r.taille ? taille(r.taille) : null].filter(Boolean).join(" · ");
}

/**
 * Ressources de la séance à ouvrir ou télécharger. nuit : sur fond sombre
 * (live). projeter : le formateur projette une vidéo d'un clic.
 */
export function ListeRessources({
  ressources,
  nuit,
  projeteeId,
  onProjeter,
  vide,
}: {
  ressources: RessourceSeanceDto[];
  nuit?: boolean;
  projeteeId?: number | null;
  onProjeter?: (r: RessourceSeanceDto) => void;
  vide?: ReactNode;
}) {
  if (!ressources.length) return <>{vide ?? null}</>;
  return (
    <ul className="flex flex-col gap-2">
      {ressources.map((r) => {
        const fichier = r.type === "video" || r.type === "fichier";
        return (
          <li key={r.id} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", nuit ? "border-nuit-ligne bg-nuit-carte text-white" : "border-ligne bg-white")}>
            <IconeRessource r={r} className={cn("h-5 w-5 shrink-0", nuit ? "text-orange" : "text-orange-fonce")} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{r.titre}</p>
              <p className={cn("truncate text-[13px]", nuit ? "text-nuit-doux" : "text-texte-gris")}>{detailRessource(r)}</p>
            </div>
            {onProjeter && projetable(r) && (
              <Bouton taille="sm" variante={projeteeId === r.id ? "nuit-actif" : nuit ? "nuit" : "contour"} icone={<MonitorPlay className="h-4 w-4" />} onClick={() => onProjeter(r)}>
                {projeteeId === r.id ? "Projetée" : "Projeter"}
              </Bouton>
            )}
            <a
              href={fichier ? `${r.url}?telecharger=1` : r.url}
              target={fichier ? undefined : "_blank"}
              rel="noopener noreferrer"
              className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", nuit ? "bg-nuit-ligne text-white hover:bg-orange hover:text-encre" : "bg-creme text-encre hover:bg-orange-clair")}
              aria-label={fichier ? `Télécharger « ${r.titre} »` : `Ouvrir « ${r.titre} »`}
              title={fichier ? "Télécharger" : "Ouvrir"}
            >
              {fichier ? <Download className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// ── Gestion (préparation de la séance, Studio) ─────────────────────────────

/** Envoi avec la progression (une vidéo de l'ordinateur peut peser des centaines de Mo). */
function envoyerAvecProgression(url: string, donnees: FormData, surProgression: (part: number) => void): Promise<void> {
  return new Promise((ok, ko) => {
    const x = new XMLHttpRequest();
    x.open("POST", url);
    x.withCredentials = true;
    x.upload.onprogress = (e) => e.lengthComputable && surProgression(e.loaded / e.total);
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) return ok();
      let message = "L'envoi n'a pas abouti. Réessayez.";
      try {
        message = (JSON.parse(x.responseText) as { message?: string }).message ?? message;
      } catch {
        /* réponse non JSON */
      }
      ko(new Error(message));
    };
    x.onerror = () => ko(new Error("Connexion coupée pendant l'envoi : réessayez."));
    x.send(donnees);
  });
}

const FORMATS_RESSOURCES = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.zip,image/*,audio/*";

/** Ajouter, renommer, ordonner, retirer les ressources d'une séance (formateur, direction, équipe). */
export function GestionRessources({ seance, nuit }: { seance: SeanceDetailDto; nuit?: boolean }) {
  const entree = useRef<HTMLInputElement>(null);
  const [lien, setLien] = useState("");
  const [ajout, setAjout] = useState(false);
  const [progression, setProgression] = useState<number | null>(null);
  const [survol, setSurvol] = useState(false);
  const [renomme, setRenomme] = useState<{ id: number; titre: string } | null>(null);
  const base = `/api/seances/${seance.id}/ressources`;
  const relire = () => rafraichir(`/api/seances/${seance.id}`);

  const ajouterLien = async () => {
    if (!lien.trim()) return;
    setAjout(true);
    try {
      await post(base, { url: lien.trim() });
      setLien("");
      await relire();
      toast("Lien ajouté.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setAjout(false);
    }
  };
  const deposer = async (liste: FileList | null) => {
    if (!liste?.length) return;
    const fichiers = Array.from(liste).slice(0, 10);
    setProgression(0);
    try {
      const donnees = new FormData();
      for (const f of fichiers) donnees.append("fichiers", f, f.name);
      await envoyerAvecProgression(`${base}/fichiers`, donnees, setProgression);
      await relire();
      toast(fichiers.length > 1 ? `${fichiers.length} fichiers ajoutés.` : "Fichier ajouté.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setProgression(null);
      if (entree.current) entree.current.value = "";
    }
  };
  const action = async (f: () => Promise<unknown>) => {
    try {
      await f();
      await relire();
    } catch (e) {
      toastErreur(e);
    }
  };
  const ids = seance.ressources.map((r) => r.id);
  const deplacer = (i: number, sens: -1 | 1) => {
    const ordre = [...ids];
    const j = i + sens;
    if (j < 0 || j >= ordre.length) return;
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
    void action(() => put(`${base}/ordre`, { ordre }));
  };

  return (
    <div
      className={cn("-m-2 flex flex-col gap-3 rounded-2xl p-2 transition-colors", survol && "bg-orange/10 ring-2 ring-orange")}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSurvol(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setSurvol(false);
        if (progression === null) void deposer(e.dataTransfer.files);
      }}
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ajouterLien();
        }}
      >
        <div className="min-w-0 flex-1">
          <Champ
            libelle="Lien YouTube ou site"
            value={lien}
            onChange={(e) => setLien(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            inputMode="url"
            className={nuit ? "bg-nuit-carte text-white" : undefined}
          />
        </div>
        <Bouton type="submit" className="mt-[26px] shrink-0" chargement={ajout} disabled={!lien.trim()} icone={<Plus className="h-4 w-4" />}>
          Ajouter
        </Bouton>
      </form>
      <input ref={entree} type="file" multiple accept={FORMATS_RESSOURCES} className="hidden" onChange={(e) => void deposer(e.target.files)} />
      <Bouton variante="contour" pleineLargeur icone={<Upload className="h-4 w-4" />} onClick={() => entree.current?.click()} disabled={progression !== null}>
        {progression !== null ? `Envoi… ${Math.round(progression * 100)} %` : "Ajouter des fichiers (vidéo, PDF, Word, Excel…)"}
      </Bouton>
      {progression !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-ligne">
          <div className="h-full bg-orange transition-[width]" style={{ width: `${Math.round(progression * 100)}%` }} />
        </div>
      )}
      <p className={cn("text-[13px]", nuit ? "text-nuit-doux" : "text-texte-gris")}>
        Vidéo MP4 ou WebM jusqu'à 300 Mo, ou n'importe quel document : les étudiants et les salles les ouvrent ou les téléchargent. Les vidéos se projettent en grand dans les salles pendant le cours.
      </p>
      {seance.ressources.length > 0 && (
        <ul className="flex flex-col gap-2">
          {seance.ressources.map((r, i) => (
            <li key={r.id} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", nuit ? "border-nuit-ligne bg-nuit-carte text-white" : "border-ligne bg-white")}>
              <IconeRessource r={r} className="h-5 w-5 shrink-0 text-orange-fonce" />
              {renomme?.id === r.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const titre = renomme.titre.trim();
                    setRenomme(null);
                    if (titre && titre !== r.titre) void action(() => patch(`${base}/${r.id}`, { titre }));
                  }}
                >
                  <input autoFocus value={renomme.titre} onChange={(e) => setRenomme({ id: r.id, titre: e.target.value })} maxLength={200} className="min-w-0 flex-1 rounded-lg border border-ligne px-2 py-1 text-[15px] text-encre" aria-label="Nouveau titre" />
                  <Bouton type="submit" taille="sm">
                    OK
                  </Bouton>
                </form>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{r.titre}</p>
                  <p className={cn("truncate text-[13px]", nuit ? "text-nuit-doux" : "text-texte-gris")}>{detailRessource(r)}</p>
                </div>
              )}
              <div className="flex shrink-0 items-center">
                <button type="button" onClick={() => setRenomme({ id: r.id, titre: r.titre })} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-creme" aria-label={`Renommer « ${r.titre} »`} title="Renommer">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-creme disabled:opacity-30" aria-label="Monter" title="Monter">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => deplacer(i, 1)} disabled={i === seance.ressources.length - 1} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-creme disabled:opacity-30" aria-label="Descendre" title="Descendre">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Retirer « ${r.titre} » des ressources de la séance ?`)) void action(() => suppr(`${base}/${r.id}`));
                  }}
                  className="grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-danger/10"
                  aria-label={`Retirer « ${r.titre} »`}
                  title="Retirer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {seance.ressources.length === 0 && <p className={cn("text-[14px]", nuit ? "text-nuit-doux" : "text-texte-gris")}>Aucune ressource pour l'instant.</p>}
    </div>
  );
}

// ── Studio : projeter, piloter, ajouter pendant le cours ───────────────────

/** Panneau du Studio : la vidéo projetée et ses commandes, puis les ressources (projeter d'un clic, en ajouter). */
export function PanneauRessourcesStudio({ seance, projection }: { seance: SeanceDetailDto; projection: ProjectionDto | null }) {
  const [gestion, setGestion] = useState(false);
  const projeter = async (r: RessourceSeanceDto) => {
    try {
      if (projection?.ressourceId === r.id) await post(`/api/seances/${seance.id}/projection`, { ressourceId: null });
      else await post(`/api/seances/${seance.id}/projection`, { ressourceId: r.id, lecture: false, position: 0 });
    } catch (e) {
      toastErreur(e);
    }
  };
  return (
    <section className="flex flex-col gap-3 rounded-[18px] bg-nuit-panneau p-3 sm:p-4" aria-label="Vidéos et documents de la séance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
          <MonitorPlay className="h-5 w-5 text-orange" /> Vidéos et documents
        </h2>
        <Bouton taille="sm" variante="nuit" icone={<Plus className="h-4 w-4" />} onClick={() => setGestion(true)}>
          Ajouter ou modifier
        </Bouton>
      </div>
      {projection && <CommandesProjection seanceId={seance.id} projection={projection} />}
      <ListeRessources
        ressources={seance.ressources}
        nuit
        projeteeId={projection?.ressourceId ?? null}
        onProjeter={(r) => void projeter(r)}
        vide={<p className="text-[14px] text-nuit-doux">Ajoutez une vidéo YouTube, une vidéo de votre ordinateur ou un document : les salles et les étudiants les ouvrent ou les téléchargent, et les vidéos se projettent en grand dans les salles.</p>}
      />
      <Fenetre ouverte={gestion} onFermer={() => setGestion(false)} titre="Vidéos et documents de la séance" description="Les étudiants et les salles les ouvrent ou les téléchargent ; les vidéos se projettent en grand dans les salles." large>
        <GestionRessources seance={seance} />
      </Fenetre>
    </section>
  );
}
