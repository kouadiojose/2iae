// « Ajouter un PowerPoint », « Ajouter une vidéo » (José, 15 octobre 2026 à 5 h : « le professeur, il faut qu'il puisse
// rajouter ses vidéos, ses diapositives ; le chargé du campus aussi »). Briques communes :
//   - useAjoutPowerPoint : sélecteur de fichier (PowerPoint, PDF, images allégées), envoi avec progression, puis
//     « Le PowerPoint se prépare » pendant la conversion côté serveur, puis le nombre de diapos ajoutées ;
//   - useAjoutVideo : un lien YouTube (champ, « Coller ») ou un fichier vidéo (MP4, WebM, MOV), avec progression ;
//   - ChoixVideo : les deux gros choix (« Une vidéo de mon ordinateur », « Un lien YouTube »), puis l'état ;
//   - BlocsAjouts : les deux gros boutons du formateur, en tête de « Préparer le cours » et dans le Studio.
// L'espace du campus (modules/espace-campus/ajouts-campus.tsx) les réutilise avec ses propres routes et ses textes.
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { CheckCircle2, Clapperboard, ClipboardPaste, FileText, Laptop, MonitorPlay, Presentation, Youtube, X } from "lucide-react";
import { alleger, post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { toast, toastErreur } from "@/components/ui/toast";
import { BarreProgression, CercleIcone, CLASSES_VIVANTES } from "@/components/ui/gros-blocs";
import { t as tEnseigner } from "@shared/textes/enseigner";
import type { RessourceSeanceDto, SeanceDetailDto } from "@shared/schema";
import { envoyerAvecProgression, projetable } from "./ressources";
import { FORMATS_DIAPOS } from "./outils";

export const FORMATS_VIDEO = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";
const PRESENTATION_OU_PDF = /\.(pptx?|ppsx?|odp|pdf)$/i;

export type EtatAjout =
  | { phase: "repos" }
  | { phase: "envoi"; part: number | null }
  | { phase: "conversion" }
  | { phase: "fait"; diapos?: number; ressource?: RessourceSeanceDto | null }
  | { phase: "erreur"; message: string };

const occupe = (e: EtatAjout) => e.phase === "envoi" || e.phase === "conversion";
const message = (e: unknown, defaut: string) => (e instanceof Error && e.message ? e.message : defaut);

/** Nombre de diapos ajoutées, d'après la réponse : la liste complète (route du formateur) ou { diapos } (campus). */
function diaposAjoutees(rep: unknown, avant: number): number {
  if (Array.isArray(rep)) return Math.max(0, rep.length - avant);
  const n = (rep as { diapos?: unknown } | null)?.diapos;
  return typeof n === "number" ? n : 0;
}

/** La ressource ajoutée, d'après la réponse : la liste complète (formateur : la plus récente) ou { ressource(s) } (campus). */
function ressourceAjoutee(rep: unknown): RessourceSeanceDto | null {
  if (Array.isArray(rep)) return (rep as RessourceSeanceDto[]).reduce<RessourceSeanceDto | null>((m, r) => (!m || r.id > m.id ? r : m), null);
  const o = rep as { ressource?: RessourceSeanceDto | null; ressources?: RessourceSeanceDto[] } | null;
  return o?.ressource ?? o?.ressources?.[o.ressources.length - 1] ?? null;
}

/**
 * « Ajouter un PowerPoint » : `url` reçoit les fichiers (champ « fichiers », dix au plus). Les images sont allégées ; un
 * PowerPoint ou un PDF passe en « conversion » dès que l'envoi est fini (le serveur le change en diapos : une minute).
 */
export function useAjoutPowerPoint({ url, diaposAvant = 0, onFait }: { url: string | null; diaposAvant?: number; onFait?: (diapos: number) => void }) {
  const entree = useRef<HTMLInputElement>(null);
  const [etat, setEtat] = useState<EtatAjout>({ phase: "repos" });
  const deposer = async (liste: FileList | File[] | null) => {
    if (!url || !liste || !liste.length || occupe(etat)) return;
    const fichiers = Array.from(liste).slice(0, 10);
    const convertir = fichiers.some((f) => PRESENTATION_OU_PDF.test(f.name));
    setEtat({ phase: "envoi", part: 0 });
    try {
      const donnees = new FormData();
      for (const f of fichiers) donnees.append("fichiers", await alleger(f), f.name);
      const rep = await envoyerAvecProgression<unknown>(
        url,
        donnees,
        (part) => setEtat((e) => (e.phase === "envoi" ? { phase: "envoi", part } : e)),
        () => convertir && setEtat({ phase: "conversion" }),
      );
      const diapos = diaposAjoutees(rep, diaposAvant);
      setEtat({ phase: "fait", diapos });
      onFait?.(diapos);
    } catch (e) {
      setEtat({ phase: "erreur", message: message(e, "L'envoi n'a pas abouti. Réessayez.") });
    } finally {
      if (entree.current) entree.current.value = "";
    }
  };
  const champ = <input ref={entree} type="file" accept={FORMATS_DIAPOS} multiple className="hidden" onChange={(e) => void deposer(e.target.files)} data-entree-ppt />;
  return { etat, occupe: occupe(etat), choisir: () => entree.current?.click(), deposer, champ, reinitialiser: () => setEtat({ phase: "repos" }) };
}

/** « Ajouter une vidéo » : un lien (POST JSON { url }) ou un fichier vidéo (champ « fichiers »), avec progression. */
export function useAjoutVideo({ urlLien, urlFichiers, onFait }: { urlLien: string | null; urlFichiers: string | null; onFait?: (r: RessourceSeanceDto | null) => void }) {
  const entree = useRef<HTMLInputElement>(null);
  const [etat, setEtat] = useState<EtatAjout>({ phase: "repos" });
  const ajouterLien = async (lien: string) => {
    if (!urlLien || !lien.trim() || occupe(etat)) return;
    setEtat({ phase: "envoi", part: null });
    try {
      const r = ressourceAjoutee(await post<unknown>(urlLien, { url: lien.trim() }));
      setEtat({ phase: "fait", ressource: r });
      onFait?.(r);
    } catch (e) {
      setEtat({ phase: "erreur", message: message(e, "L'envoi n'a pas abouti. Réessayez.") });
    }
  };
  const deposer = async (liste: FileList | File[] | null) => {
    if (!urlFichiers || !liste || !liste.length || occupe(etat)) return;
    setEtat({ phase: "envoi", part: 0 });
    try {
      const donnees = new FormData();
      for (const f of Array.from(liste).slice(0, 3)) donnees.append("fichiers", f, f.name);
      const r = ressourceAjoutee(await envoyerAvecProgression<unknown>(urlFichiers, donnees, (part) => setEtat((e) => (e.phase === "envoi" ? { phase: "envoi", part } : e))));
      setEtat({ phase: "fait", ressource: r });
      onFait?.(r);
    } catch (e) {
      setEtat({ phase: "erreur", message: message(e, "L'envoi n'a pas abouti. Réessayez.") });
    } finally {
      if (entree.current) entree.current.value = "";
    }
  };
  const champ = <input ref={entree} type="file" accept={FORMATS_VIDEO} className="hidden" onChange={(e) => void deposer(e.target.files)} data-entree-video />;
  return { etat, occupe: occupe(etat), ajouterLien, deposer, choisir: () => entree.current?.click(), champ, reinitialiser: () => setEtat({ phase: "repos" }) };
}

/** Les textes de ChoixVideo (formateur : enseigner.ts, campus : campus.ts). */
export type TextesVideo = {
  fichier: string;
  fichierTexte: string;
  lien: string;
  lienTexte: string;
  champ: string;
  coller: string;
  ajouter: string;
  ok: string;
  envoi: (n: number) => string;
  autreLien?: string;
  /** Un lien qui n'est pas YouTube (formateur) : « Lien ajouté aux documents. », sans la coche de la vidéo. */
  lienOk?: string;
  retour: string;
};

/**
 * Les deux gros choix d'une vidéo, puis le champ du lien (avec « Coller »), puis l'état (« Vidéo ajoutée. »). `apres` :
 * ce qui s'affiche sous « Vidéo ajoutée. » (« La projeter maintenant dans les salles »).
 */
export function ChoixVideo({ video, textes, nuit = false, apres }: { video: ReturnType<typeof useAjoutVideo>; textes: TextesVideo; nuit?: boolean; apres?: (r: RessourceSeanceDto | null) => ReactNode }) {
  const [lien, setLien] = useState("");
  const [vue, setVue] = useState<"choix" | "lien">("choix");
  const champ = useRef<HTMLInputElement>(null);
  const e = video.etat;
  useEffect(() => {
    if (vue === "lien") champ.current?.focus();
  }, [vue]);
  // Vidéo ajoutée : « Ajouter une autre vidéo » repart des deux choix (fichier ou lien), champ vide.
  useEffect(() => {
    if (e.phase === "fait") {
      setVue("choix");
      setLien("");
    }
  }, [e.phase]);
  const coller = async () => {
    try {
      const texte = await navigator.clipboard.readText();
      if (texte) setLien(texte.trim());
    } catch {
      champ.current?.focus();
    }
  };
  const carte = cn(
    "flex min-h-[120px] w-full items-center gap-5 rounded-[26px] border-2 px-5 py-5 text-left",
    nuit ? "border-nuit-bord bg-nuit-carte text-white hover:border-orange/60" : cn("border-ligne bg-white text-encre hover:border-orange/60", CLASSES_VIVANTES),
  );
  const doux = nuit ? "text-nuit-doux" : "text-texte-doux";
  if (e.phase === "fait") {
    // Un lien qui n'est pas YouTube n'est pas une vidéo : pas de « ✓ Vidéo ajoutée. » suivi d'un démenti.
    const simpleLien = e.ressource?.type === "lien";
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="flex items-center gap-3 text-[24px] font-black" data-video-fait={simpleLien ? "lien" : "video"}>
          {simpleLien ? (
            <FileText className={cn("h-8 w-8 shrink-0", doux)} aria-hidden />
          ) : (
            <CheckCircle2 className="h-8 w-8 shrink-0 text-vif-texte" style={nuit ? { color: "#7BD3A6" } : undefined} aria-hidden />
          )}
          {simpleLien ? (textes.lienOk ?? textes.ok) : textes.ok}
        </p>
        {e.ressource && <p className={cn("text-[18px] font-semibold", doux)}>{e.ressource.titre}</p>}
        {e.ressource?.type === "lien" && textes.autreLien && <p className={cn("text-[16px]", doux)}>{textes.autreLien}</p>}
        {apres?.(e.ressource ?? null)}
      </div>
    );
  }
  if (e.phase === "envoi") {
    return (
      <div className="flex flex-col gap-2" role="status" aria-live="polite">
        <p className="text-[22px] font-bold">{e.part === null ? textes.envoi(0).replace(/\s*0\s*%/, "") : textes.envoi(Math.round(e.part * 100))}</p>
        <BarreProgression part={e.part ?? 0.15} nuit={nuit} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {video.champ}
      {e.phase === "erreur" && (
        <p className={cn("rounded-[18px] px-5 py-4 text-[18px] font-bold", nuit ? "bg-[#2A1510] text-[#FFD2B3]" : "bg-danger-clair text-danger")} role="alert">
          {e.message}
        </p>
      )}
      {vue === "choix" ? (
        <>
          <button type="button" className={carte} onClick={() => video.choisir()} data-choix-video="fichier">
            <CercleIcone taille={64} fond={nuit ? "rgba(228,121,58,.15)" : "#FFF1E6"} couleur={nuit ? "#E4793A" : "#A34C17"}>
              <Laptop className="h-8 w-8" strokeWidth={2.25} />
            </CercleIcone>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[24px] font-black leading-tight">{textes.fichier}</span>
              <span className={cn("text-[18px] font-semibold", doux)}>{textes.fichierTexte}</span>
            </span>
          </button>
          <button type="button" className={carte} onClick={() => setVue("lien")} data-choix-video="youtube">
            <CercleIcone taille={64} fond={nuit ? "rgba(228,121,58,.15)" : "#FDECE6"} couleur={nuit ? "#E4793A" : "#C2410C"}>
              <Youtube className="h-8 w-8" strokeWidth={2.25} />
            </CercleIcone>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[24px] font-black leading-tight">{textes.lien}</span>
              <span className={cn("text-[18px] font-semibold", doux)}>{textes.lienTexte}</span>
            </span>
          </button>
        </>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            void video.ajouterLien(lien);
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-[20px] font-bold">{textes.champ}</span>
            <span className={cn("text-[17px]", doux)}>{textes.lienTexte}</span>
            <input
              ref={champ}
              value={lien}
              onChange={(ev) => setLien(ev.target.value)}
              inputMode="url"
              autoComplete="off"
              placeholder="https://www.youtube.com/watch?v=…"
              className={cn(
                "min-h-[64px] w-full rounded-[18px] border-2 px-4 text-[20px] outline-none focus:border-orange",
                nuit ? "border-nuit-bord bg-nuit text-white placeholder:text-nuit-gris" : "border-ligne bg-white text-encre placeholder:text-texte-gris",
              )}
              data-champ-youtube
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void coller()}
              className={cn("flex min-h-[64px] items-center justify-center gap-2 rounded-[18px] border-2 px-5 text-[20px] font-bold", nuit ? "border-nuit-bord text-white" : "border-encre text-encre")}
            >
              <ClipboardPaste className="h-6 w-6" aria-hidden />
              {textes.coller}
            </button>
            <button type="submit" disabled={!lien.trim()} className="flex min-h-[64px] flex-1 items-center justify-center rounded-[18px] bg-orange px-6 text-[22px] font-black text-encre disabled:opacity-60" data-ajouter-video>
              {textes.ajouter}
            </button>
          </div>
          <button type="button" onClick={() => setVue("choix")} className={cn("self-start text-[18px] font-bold underline underline-offset-4", doux)}>
            {textes.retour}
          </button>
        </form>
      )}
    </div>
  );
}

/** Fenêtre posée par-dessus la page (claire dans la préparation, nuit dans le Studio), sans flou ; Échap la ferme. */
export function FeuilleAjout({ ouverte, onFermer, titre, nuit = false, fermer, children }: { ouverte: boolean; onFermer: () => void; titre: string; nuit?: boolean; fermer: string; children: ReactNode }) {
  useEffect(() => {
    if (!ouverte) return;
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [ouverte, onFermer]);
  if (!ouverte) return null;
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[rgba(15,14,13,.72)] px-4 py-6 sm:py-12" role="dialog" aria-modal="true" aria-label={titre}>
      <div className={cn("mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-[28px] p-6 sm:p-8", nuit ? "bg-nuit-panneau text-white" : "bg-white text-encre")}>
        <div className="flex items-start justify-between gap-4">
          <p className="text-[30px] font-black leading-tight sm:text-[34px]">{titre}</p>
          <button
            type="button"
            onClick={onFermer}
            className={cn("flex min-h-[56px] shrink-0 items-center gap-2 rounded-full border-2 px-4 text-[18px] font-bold", nuit ? "border-nuit-bord text-white" : "border-ligne text-encre")}
          >
            {fermer}
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Zone qui accepte un fichier lâché dessus (bord pointillé orange au survol d'un fichier). */
function useDepot(surDepot: (f: FileList) => void, actif: boolean) {
  const [survol, setSurvol] = useState(false);
  const props = actif
    ? {
        onDragOver: (e: DragEvent) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setSurvol(true);
        },
        onDragLeave: (e: DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSurvol(false);
        },
        onDrop: (e: DragEvent) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setSurvol(false);
          surDepot(e.dataTransfer.files);
        },
      }
    : {};
  return { survol, props };
}

/**
 * Les deux gros boutons du formateur : « Ajouter un PowerPoint » et « Ajouter une vidéo » (fichier ou lien YouTube).
 * `preparation` : deux cartes blanches en tête de « Préparer le cours » (on peut y lâcher un fichier) ; `studio` : deux
 * boutons nuit sous l'en-tête du Studio, avant et pendant le cours (une vidéo ajoutée en direct se projette d'un geste).
 */
export function BlocsAjouts({ seance, variante }: { seance: SeanceDetailDto; variante: "preparation" | "studio" }) {
  const tx = useTextes(tEnseigner);
  const [feuille, setFeuille] = useState(false);
  const [projetee, setProjetee] = useState(false);
  const relire = () => rafraichir(`/api/seances/${seance.id}`);
  const ppt = useAjoutPowerPoint({
    url: `/api/seances/${seance.id}/diapos`,
    diaposAvant: seance.diapos.length,
    onFait: (n) => {
      void relire();
      toast(n === 1 ? tx("ajouts.ppt.ok.un") : tx("ajouts.ppt.ok", { v: { n } }));
    },
  });
  const video = useAjoutVideo({
    urlLien: `/api/seances/${seance.id}/ressources`,
    urlFichiers: `/api/seances/${seance.id}/ressources/fichiers`,
    onFait: () => void relire(),
  });
  useEffect(() => {
    if (ppt.etat.phase === "erreur") toastErreur(new Error(ppt.etat.message));
  }, [ppt.etat]);
  const diapos = seance.diapos.length;
  const videos = seance.ressources.filter(projetable).length;
  const depotPpt = useDepot((f) => void ppt.deposer(f), variante === "preparation");
  const depotVideo = useDepot(
    (f) => {
      setFeuille(true);
      void video.deposer(f);
    },
    variante === "preparation",
  );
  const sousTitrePpt =
    ppt.etat.phase === "envoi"
      ? tx("ajouts.envoi", { v: { n: Math.round((ppt.etat.part ?? 0) * 100) } })
      : ppt.etat.phase === "conversion"
        ? tx("ajouts.conversion")
        : `${tx("ajouts.ppt.texte")}${diapos ? ` · ${diapos === 1 ? tx("ajouts.deja.diapos.un") : tx("ajouts.deja.diapos", { v: { n: diapos } })}` : ""}`;
  const sousTitreVideo = `${tx("ajouts.video.texte")}${videos ? ` · ${videos === 1 ? tx("ajouts.deja.videos.un") : tx("ajouts.deja.videos", { v: { n: videos } })}` : ""}`;
  const ouvrirVideo = () => {
    video.reinitialiser();
    setProjetee(false);
    setFeuille(true);
  };
  const projeter = async (r: RessourceSeanceDto) => {
    try {
      await post(`/api/seances/${seance.id}/projection`, { ressourceId: r.id, lecture: false, position: 0 });
      setProjetee(true);
      toast(tx("ajouts.video.projetee"));
    } catch (e) {
      toastErreur(e);
    }
  };
  const textesVideo: TextesVideo = {
    fichier: tx("ajouts.video.fichier"),
    fichierTexte: tx("ajouts.video.fichier.texte"),
    lien: tx("ajouts.video.lien"),
    lienTexte: tx("ajouts.video.lien.texte"),
    champ: tx("ajouts.video.champ"),
    coller: tx("ajouts.video.coller"),
    ajouter: tx("ajouts.video.ajouter"),
    ok: tx("ajouts.video.ok"),
    envoi: (n) => tx("ajouts.video.envoi", { v: { n } }),
    autreLien: tx("ajouts.video.autreLien"),
    lienOk: tx("ajouts.video.lienOk"),
    retour: tx("ajouts.retour"),
  };
  const nuit = variante === "studio";
  const fenetre = (
    <FeuilleAjout ouverte={feuille} onFermer={() => setFeuille(false)} titre={tx("ajouts.video.titre")} nuit={nuit} fermer={tx("ajouts.fermer")}>
      <ChoixVideo
        video={video}
        textes={textesVideo}
        nuit={nuit}
        apres={(r) => (
          <div className="flex flex-col gap-3 sm:flex-row">
            {r && projetable(r) && seance.statut === "en_direct" && !projetee && (
              <button type="button" onClick={() => void projeter(r)} className="flex min-h-[64px] flex-1 items-center justify-center gap-2 rounded-[18px] bg-orange px-5 text-[20px] font-black text-encre" data-projeter-ajout>
                <MonitorPlay className="h-6 w-6" aria-hidden />
                {tx("ajouts.video.projeter")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                video.reinitialiser();
                setProjetee(false);
              }}
              className={cn("flex min-h-[64px] items-center justify-center rounded-[18px] border-2 px-5 text-[20px] font-bold", nuit ? "border-nuit-bord text-white" : "border-encre text-encre")}
            >
              {tx("ajouts.video.autre")}
            </button>
          </div>
        )}
      />
    </FeuilleAjout>
  );

  if (variante === "studio") {
    const bouton = "flex min-h-[72px] flex-1 items-center gap-3 rounded-[18px] border border-nuit-bord bg-nuit-carte px-4 text-left text-white transition-colors duration-150 hover:border-orange/60 hover:bg-[#24211F] lg:min-h-[64px]";
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3" data-ajouts-studio>
        {ppt.champ}
        <button type="button" className={bouton} onClick={() => ppt.choisir()} disabled={ppt.occupe} data-ajout="ppt">
          <CercleIcone taille={44} fond="#E4793A" couleur="#141414">
            <Presentation className="h-6 w-6" strokeWidth={2.25} />
          </CercleIcone>
          <span className="min-w-0 flex-1 text-[18px] font-bold leading-tight">
            {ppt.etat.phase === "envoi" ? tx("ajouts.envoi", { v: { n: Math.round((ppt.etat.part ?? 0) * 100) } }) : ppt.etat.phase === "conversion" ? tx("ajouts.conversion") : tx("ajouts.ppt")}
          </span>
          {diapos > 0 && !ppt.occupe && <span className="shrink-0 font-mono text-[14px] text-nuit-doux">{diapos === 1 ? tx("ajouts.deja.diapos.un") : tx("ajouts.deja.diapos", { v: { n: diapos } })}</span>}
        </button>
        <button type="button" className={bouton} onClick={ouvrirVideo} data-ajout="video">
          <CercleIcone taille={44} fond="#FFFFFF" couleur="#141414">
            <Clapperboard className="h-6 w-6" strokeWidth={2.25} />
          </CercleIcone>
          <span className="min-w-0 flex-1 text-[18px] font-bold leading-tight">{tx("ajouts.video")}</span>
          {videos > 0 && <span className="shrink-0 font-mono text-[14px] text-nuit-doux">{videos === 1 ? tx("ajouts.deja.videos.un") : tx("ajouts.deja.videos", { v: { n: videos } })}</span>}
        </button>
        {fenetre}
      </div>
    );
  }

  const carte = (survol: boolean) =>
    cn("relative flex min-h-[120px] w-full items-center gap-5 rounded-[26px] border-2 bg-white px-5 py-5 text-left sm:px-6", CLASSES_VIVANTES, "hover:-translate-y-0.5", survol ? "border-dashed border-orange bg-orange-pale" : "border-ligne hover:border-orange/60");
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5" aria-label={`${tx("ajouts.ppt")} · ${tx("ajouts.video")}`} data-ajouts-preparation>
      {ppt.champ}
      <button type="button" className={carte(depotPpt.survol)} onClick={() => ppt.choisir()} disabled={ppt.occupe} {...depotPpt.props} data-ajout="ppt">
        <CercleIcone taille={64} fond="#E4793A" couleur="#141414">
          <Presentation className="h-8 w-8" strokeWidth={2.25} />
        </CercleIcone>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[24px] font-black leading-tight">{depotPpt.survol ? tx("ajouts.deposer") : tx("ajouts.ppt")}</span>
          <span className="text-[18px] font-semibold leading-snug text-texte-doux" role={ppt.occupe ? "status" : undefined}>
            {sousTitrePpt}
          </span>
          {ppt.etat.phase === "envoi" && <BarreProgression part={ppt.etat.part ?? 0} />}
        </span>
      </button>
      <button type="button" className={carte(depotVideo.survol)} onClick={ouvrirVideo} {...depotVideo.props} data-ajout="video">
        <CercleIcone taille={64} fond="#141414" couleur="#FFFFFF">
          <Clapperboard className="h-8 w-8" strokeWidth={2.25} />
        </CercleIcone>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[24px] font-black leading-tight">{depotVideo.survol ? tx("ajouts.deposer") : tx("ajouts.video")}</span>
          <span className="text-[18px] font-semibold leading-snug text-texte-doux">{sousTitreVideo}</span>
        </span>
      </button>
      {fenetre}
    </section>
  );
}
