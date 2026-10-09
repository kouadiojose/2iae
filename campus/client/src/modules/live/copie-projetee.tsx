// Copie d'étudiant montrée à la classe pendant le direct, à la place de la diapo (server/projection-copies.ts).
// Fichier léger, importé par la scène de tous les écrans : le cadre de la copie (même rendu pour l'aperçu du
// formateur, son panneau du Studio, les salles et les étudiants), la lecture en grand, et le pilotage
// (projeter, tourner les pages, régler, revenir aux diapos).
//
//   - la légende est posée dans un bandeau AU-DESSUS de la page (elle ne cache jamais la première ligne) ;
//   - un texte saisi s'ajuste au cadre (la taille des lettres baisse jusqu'à ce que tout tienne) et contourne
//     la vignette de la caméra : rien n'est coupé dans une salle, quelle que soit la taille de son écran ;
//   - la rotation et le zoom sont rendus par le navigateur : l'image ne change pas, rien n'est rechargé (sauf
//     quand le haut est caché : le serveur coupe alors le bord qui arrivera en haut, nouvelle image) ;
//   - l'image arrive en double tampon : l'ancienne page reste affichée, avec SA rotation, tant que la nouvelle
//     n'est pas là (4 s au plus, puis « La copie arrive… ») ;
//   - au téléphone, un toucher ouvre la page en grand (LecteurCopie), le geste retour la referme.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Maximize2, X } from "lucide-react";
import { ErreurApi, patch, post } from "@/lib/api";
import { useCanal } from "@/lib/flux";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { useVueSuperposee } from "@/lib/vue-superposee";
import { Markdown } from "@/components/ui/markdown";
import { toast, toastErreur } from "@/components/ui/toast";
import type { Traducteur } from "@shared/textes";
import { t as textesCopies } from "@shared/textes/copies-direct";
import type { CopieProjeteeDto, CorpsProjectionCopie, EtatDirectDto, ReglageCopieDto, RotationCopie, ZoneCopie } from "@shared/schema";
import { cleDirect } from "./outils";

/** Disposition de la scène pendant une copie : « côte à côte » si choisie, sinon « diapo » (en vignette, une page est illisible). */
export const dispositionAvecCopie = (etat: EtatDirectDto): "diapo" | "cote" => (etat.diapo.disposition === "cote" ? "cote" : "diapo");

/**
 * Vignette de la caméra posée sur la copie (scene.tsx) : « grand » sur les écrans de salle ; « bouton » : le bouton
 * « Masquer la caméra » est posé au-dessus de la vignette (écran de salle).
 */
export type VignetteSurCopie = { grand: boolean; bouton: boolean } | null;

type Emplacement = { src: string; iw: number; ih: number; pret: boolean; rotation: RotationCopie };

/** Position de l'image dans le cadre : page entière (contenue) ou largeur pleine, calée en haut, au milieu ou en bas. */
function placement(iw: number, ih: number, cw: number, ch: number, rotation: RotationCopie, zone: ZoneCopie) {
  const tourne = rotation === 90 || rotation === 270;
  const [lw, lh] = tourne ? [ih, iw] : [iw, ih];
  const echelle = zone === "page" ? Math.min(cw / lw, ch / lh) : cw / lw;
  const hv = lh * echelle;
  const y = hv <= ch || zone === "page" || zone === "milieu" ? (ch - hv) / 2 : zone === "haut" ? 0 : ch - hv;
  const largeur = iw * echelle;
  const hauteur = ih * echelle;
  return { largeur, hauteur, gauche: cw / 2 - largeur / 2, haut: y + hv / 2 - hauteur / 2 };
}

/** Coin occupé par la vignette de la caméra (mêmes mesures que scene.tsx), marge comprise. */
function coinVignette(vignette: VignetteSurCopie, cw: number): { l: number; h: number } | null {
  if (!vignette) return null;
  const [part, mini, ecart] = vignette.grand ? [0.3, 260, 16] : [0.38, 140, 8];
  const l = Math.max(cw * part, mini);
  return { l: l + ecart + 12, h: (l * 9) / 16 + ecart + 12 + (vignette.bouton ? 56 : 0) };
}

/**
 * Le cadre d'une copie : bandeau de légende, puis l'image tournée et zoomée, ou le texte en grands caractères sur
 * une feuille claire, ajusté au cadre. « relance » : en cas d'erreur, nouvel essai toutes les 3 s (écrans de la
 * classe) ; sinon « erreur » s'affiche (aperçu du formateur). « onAgrandir » : un toucher ouvre la lecture en grand.
 */
export function CadreCopie(p: {
  src: string | null;
  contenu: "image" | "texte" | "markdown";
  texte?: string;
  rotation: RotationCopie;
  zone: ZoneCopie;
  legende?: string;
  /** Légende des petits cadres (téléphone) : « Copie d'un étudiant · p. 4/7 ». */
  legendeCourte?: string;
  grand?: boolean;
  className?: string;
  relance?: boolean;
  erreur?: ReactNode;
  chargement?: ReactNode;
  vignette?: VignetteSurCopie;
  onAgrandir?: () => void;
  /** Bouton « Agrandir » dans le bandeau (sinon, seul le toucher sur la page agrandit). */
  boutonAgrandir?: boolean;
}) {
  const tx = useTextes(textesCopies);
  const surface = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ cw: 0, ch: 0 });
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const mesurer = () => setTaille({ cw: el.clientWidth, ch: el.clientHeight });
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Double tampon : deux emplacements fixes ; la nouvelle adresse se charge dans celui de derrière, puis passe devant.
  const [emplacements, setEmplacements] = useState<[Emplacement | null, Emplacement | null]>([null, null]);
  const [devant, setDevant] = useState<0 | 1>(0);
  const [attenteDepuis, setAttenteDepuis] = useState<number | null>(null);
  const [enErreur, setEnErreur] = useState(false);
  const [, rafraichir] = useState(0);
  const essais = useRef(0);
  const srcVoulue = p.contenu === "image" ? p.src : null;
  const voulue = useRef(srcVoulue);
  voulue.current = srcVoulue;
  const estVoulue = (e: Emplacement | null) => Boolean(e && srcVoulue && e.src.startsWith(srcVoulue));
  useEffect(() => {
    essais.current = 0;
    setEnErreur(false);
    if (!srcVoulue) return;
    const affichee = emplacements[devant];
    if (affichee?.pret && affichee.src.startsWith(srcVoulue)) {
      setAttenteDepuis(null);
      return;
    }
    const arriere = devant === 0 ? 1 : 0;
    setEmplacements((e) => {
      const copie: [Emplacement | null, Emplacement | null] = [e[0], e[1]];
      copie[arriere] = { src: srcVoulue, iw: 0, ih: 0, pret: false, rotation: p.rotation };
      return copie;
    });
    setAttenteDepuis(Date.now());
  }, [srcVoulue]);
  // La rotation suit tout de suite sur l'image voulue ; l'ancienne garde la sienne jusqu'à ce qu'elle parte
  // (sinon, haut caché, l'ancienne image tournée montrerait le bord qui n'a pas été coupé).
  useEffect(() => {
    setEmplacements((e) => {
      if (!e.some((x) => estVoulue(x) && x!.rotation !== p.rotation)) return e;
      return [e[0] && estVoulue(e[0]) ? { ...e[0], rotation: p.rotation } : e[0], e[1] && estVoulue(e[1]) ? { ...e[1], rotation: p.rotation } : e[1]];
    });
  }, [p.rotation, srcVoulue]);
  // Au-delà de 4 s sans la nouvelle page : voile « La copie arrive… ».
  useEffect(() => {
    if (attenteDepuis === null) return;
    const id = setTimeout(() => rafraichir((n) => n + 1), 4100);
    return () => clearTimeout(id);
  }, [attenteDepuis]);

  const charge = (i: 0 | 1, img: HTMLImageElement) => {
    // Une page déjà remplacée par une autre (deux changements rapides) ne passe pas devant.
    const chargee = img.getAttribute("src") ?? "";
    if (!voulue.current || !chargee.startsWith(voulue.current)) return;
    setEmplacements((e) => {
      const x = e[i];
      if (!x) return e;
      const copie: [Emplacement | null, Emplacement | null] = [e[0], e[1]];
      copie[i] = { ...x, iw: img.naturalWidth, ih: img.naturalHeight, pret: true };
      return copie;
    });
    setDevant(i);
    setAttenteDepuis(null);
    setEnErreur(false);
  };
  const echec = (i: 0 | 1) => {
    if (!p.relance) {
      setEnErreur(true);
      setAttenteDepuis(null);
      return;
    }
    // Nouvel essai dans 3 s, tant que la page à l'écran ne change pas.
    const base = srcVoulue;
    setTimeout(() => {
      essais.current += 1;
      setEmplacements((e) => {
        const x = e[i];
        if (!x || !base || !x.src.startsWith(base)) return e;
        const copie: [Emplacement | null, Emplacement | null] = [e[0], e[1]];
        copie[i] = { ...x, src: `${base}${base.includes("?") ? "&" : "?"}r=${essais.current}` };
        return copie;
      });
    }, 3000);
  };

  // Texte : la taille des lettres s'ajuste au cadre (jusqu'à ce que tout tienne), le coin de la vignette est évité.
  const { cw, ch } = taille;
  const feuille = useRef<HTMLDivElement>(null);
  const [police, setPolice] = useState<number | null>(null);
  const padX = Math.round(cw * 0.045);
  const padY = Math.round(ch * 0.05);
  const coin = p.contenu !== "image" ? coinVignette(p.vignette ?? null, cw) : null;
  const flotteLargeur = coin ? Math.max(0, coin.l - padX) : 0;
  const flotteHauteur = coin ? Math.max(0, coin.h - padY) : 0;
  useLayoutEffect(() => {
    const el = feuille.current;
    if (!el || p.contenu === "image" || p.texte === undefined || !cw || !ch) return;
    const maxi = Math.max(12, Math.min(p.grand ? 84 : 56, ch / 5));
    let bas = 9;
    let haut = maxi;
    el.style.fontSize = `${haut}px`;
    if (el.scrollHeight <= el.clientHeight + 1) bas = haut;
    else
      for (let i = 0; i < 9; i++) {
        const milieu = (bas + haut) / 2;
        el.style.fontSize = `${milieu}px`;
        if (el.scrollHeight <= el.clientHeight + 1) bas = milieu;
        else haut = milieu;
      }
    el.style.fontSize = `${bas}px`;
    setPolice(bas);
  }, [p.texte, p.contenu, cw, ch, p.grand, flotteLargeur, flotteHauteur]);
  useEffect(() => {
    const el = feuille.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = p.zone === "bas" ? max : p.zone === "milieu" ? max / 2 : 0;
  }, [p.zone, p.texte, police]);

  const visible = emplacements[devant];
  const attenteLongue = attenteDepuis !== null && Date.now() - attenteDepuis > 4000;
  const legende = cw && cw < 520 && p.legendeCourte ? p.legendeCourte : p.legende;
  return (
    <div className={cn("relative flex flex-col overflow-hidden bg-black", p.className)}>
      {(legende || (p.onAgrandir && p.boutonAgrandir !== false)) && (
        <div className={cn("flex shrink-0 items-center gap-2 bg-black px-3 font-mono text-orange-peche", p.grand ? "py-2 text-[clamp(14px,1.3vw,22px)]" : "py-1 text-xs")}>
          <span className="min-w-0 flex-1 truncate">{legende}</span>
          {p.onAgrandir && p.boutonAgrandir !== false && (
            <button type="button" onClick={p.onAgrandir} className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 font-sans text-[13px] font-bold text-white hover:bg-white/20">
              <Maximize2 className="h-4 w-4" /> {tx("classe.agrandir")}
            </button>
          )}
        </div>
      )}
      <div
        ref={surface}
        className={cn("relative min-h-0 flex-1 overflow-hidden", p.onAgrandir && "cursor-zoom-in")}
        onClick={p.onAgrandir}
      >
        {p.contenu === "image" ? (
          <>
            {([0, 1] as const).map((i) => {
              const e = emplacements[i];
              if (!e) return null;
              const pos = e.pret && cw ? placement(e.iw, e.ih, cw, ch, e.rotation, p.zone) : null;
              return (
                <img
                  key={i}
                  src={e.src}
                  alt=""
                  draggable={false}
                  onLoad={(ev) => charge(i, ev.currentTarget)}
                  onError={() => echec(i)}
                  className={cn("absolute max-w-none select-none", i === devant && e.pret ? "z-[1] opacity-100" : "z-0 opacity-0")}
                  style={
                    pos
                      ? { width: pos.largeur, height: pos.hauteur, left: pos.gauche, top: pos.haut, transform: `rotate(${e.rotation}deg)` }
                      : { left: 0, top: 0, width: 1, height: 1 }
                  }
                />
              );
            })}
            {(attenteLongue || (!visible?.pret && !enErreur && srcVoulue)) && (
              <div className="absolute inset-0 z-[2] grid place-items-center bg-black/55">
                {p.chargement ?? (
                  <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 font-mono text-sm text-orange-peche">
                    <Loader2 className="h-4 w-4 animate-spin" /> {tx("classe.chargement")}
                  </span>
                )}
              </div>
            )}
            {enErreur && <div className="absolute inset-0 z-[2] grid place-items-center bg-black/70 p-4 text-center text-sm text-nuit-texte">{p.erreur}</div>}
          </>
        ) : (
          <div
            ref={feuille}
            className="defile-fin absolute inset-0 overflow-y-auto bg-creme text-encre"
            style={{ padding: `${padY}px ${padX}px`, fontSize: police ?? undefined }}
          >
            {p.texte === undefined ? (
              <div className="grid h-full place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-orange" />
              </div>
            ) : (
              <>
                {coin && (
                  <>
                    {/* Le texte contourne le coin de la vignette de la caméra (en bas à droite). */}
                    <span aria-hidden className="float-right block" style={{ width: 0.1, height: Math.max(0, ch - 2 * padY - flotteHauteur) }} />
                    <span aria-hidden className="clear-right float-right block" style={{ width: flotteLargeur, height: flotteHauteur }} />
                  </>
                )}
                {p.contenu === "markdown" ? (
                  <Markdown source={p.texte} className="leading-snug text-encre [font-size:1em] [&_code]:text-[0.85em] [&_h1]:text-[1.35em] [&_h2]:text-[1.2em] [&_h3]:text-[1.1em] [&_pre]:text-[0.8em]" />
                ) : (
                  <p className="whitespace-pre-line font-semibold leading-snug">{p.texte}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * La copie à lire en grand, par-dessus tout (étudiant au téléphone, aperçu du formateur) : la page à la
 * largeur de l'écran, qu'on fait défiler. Le geste retour, Échap ou « Fermer » la referment.
 */
export function LecteurCopie(p: { src: string | null; contenu: "image" | "texte" | "markdown"; texte?: string; rotation: RotationCopie; titre?: string; onFermer: () => void }) {
  const tx = useTextes(textesCopies);
  const vue = useRef<HTMLDivElement>(null);
  useVueSuperposee(vue, p.onFermer);
  const corps = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = corps.current;
    if (!el) return;
    const mesurer = () => setLargeur(el.clientWidth);
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const [dims, setDims] = useState<{ src: string; iw: number; ih: number } | null>(null);
  const tourne = p.rotation === 90 || p.rotation === 270;
  const d = dims && dims.src === p.src ? dims : null;
  const lw = d ? (tourne ? d.ih : d.iw) : 0;
  const lh = d ? (tourne ? d.iw : d.ih) : 0;
  const disponible = Math.max(0, largeur - 24);
  const echelle = d && lw ? Math.min(disponible / lw, 2) : 0;
  return createPortal(
    <div ref={vue} tabIndex={-1} className="fixed inset-0 z-[80] flex flex-col bg-black text-white outline-none" role="dialog" aria-modal="true" aria-label={p.titre ?? tx("classe.anonyme")}>
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-orange-peche">{p.titre}</span>
        <button type="button" onClick={p.onFermer} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 text-[14px] font-bold text-encre">
          <X className="h-4 w-4" /> {tx("lecteur.fermer")}
        </button>
      </header>
      <div ref={corps} className="min-h-0 flex-1 overflow-auto p-3" style={{ touchAction: "pan-x pan-y pinch-zoom" }}>
        {p.contenu === "image" ? (
          p.src ? (
            <div className="relative mx-auto" style={d ? { width: lw * echelle, height: lh * echelle } : { width: "100%", minHeight: "50vh" }}>
              <img
                src={p.src}
                alt=""
                draggable={false}
                onLoad={(e) => setDims({ src: p.src!, iw: e.currentTarget.naturalWidth, ih: e.currentTarget.naturalHeight })}
                className="absolute max-w-none select-none"
                style={
                  d
                    ? { width: d.iw * echelle, height: d.ih * echelle, left: (lw * echelle - d.iw * echelle) / 2, top: (lh * echelle - d.ih * echelle) / 2, transform: `rotate(${p.rotation}deg)` }
                    : { opacity: 0, width: 1, height: 1 }
                }
              />
              {!d && (
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="h-6 w-6 animate-spin text-orange" />
                </div>
              )}
            </div>
          ) : null
        ) : (
          <div className="mx-auto max-w-3xl rounded-xl bg-creme px-5 py-6 text-encre">
            {p.texte === undefined ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-orange" />
            ) : p.contenu === "markdown" ? (
              <Markdown source={p.texte} className="text-[18px] leading-relaxed sm:text-[21px]" />
            ) : (
              <p className="whitespace-pre-line text-[19px] font-semibold leading-relaxed sm:text-[23px]">{p.texte}</p>
            )}
          </div>
        )}
      </div>
      <p className="shrink-0 px-3 pb-3 text-center text-[12px] text-white/60">{tx("lecteur.aide")}</p>
    </div>,
    document.body,
  );
}

/** La copie projetée, telle que la voit toute la classe (et l'animateur, dans son panneau). */
export function CopieProjetee({
  copie,
  grand,
  className,
  vignette,
  agrandissable,
}: {
  copie: CopieProjeteeDto;
  grand?: boolean;
  className?: string;
  vignette?: VignetteSurCopie;
  /** Étudiants : un toucher ouvre la page en grand (au téléphone, elle tient dans 200 px sinon). */
  agrandissable?: boolean;
}) {
  const tx = useTextes(textesCopies);
  const [lecture, setLecture] = useState(false);
  const texte = useQuery<{ texte: string }>({
    queryKey: [copie.url],
    enabled: copie.contenu !== "image",
    staleTime: Infinity,
    gcTime: 60_000,
    retry: (n) => n < 40,
    retryDelay: 3000,
  });
  const v = { etiquette: copie.etiquette, devoir: copie.devoirTitre, n: copie.numero, total: copie.total };
  const legende = tx("classe.legende", { v });
  return (
    <>
      <CadreCopie
        src={copie.contenu === "image" ? copie.url : null}
        contenu={copie.contenu}
        texte={texte.data?.texte}
        rotation={copie.rotation}
        zone={copie.zone}
        legende={legende}
        legendeCourte={tx("classe.legendeCourte", { v })}
        grand={grand}
        relance
        vignette={vignette}
        onAgrandir={agrandissable ? () => setLecture(true) : undefined}
        className={cn("h-full w-full", className)}
      />
      {lecture && (
        <LecteurCopie
          src={copie.contenu === "image" ? copie.url : null}
          contenu={copie.contenu}
          texte={texte.data?.texte}
          rotation={copie.rotation}
          titre={legende}
          onFermer={() => setLecture(false)}
        />
      )}
    </>
  );
}

// ── Pilotage (Studio, fenêtre présentateur, vue « Devoirs ») ───────────────

/**
 * Page voulue pendant qu'un envoi est en route, partagée par le panneau, la bande des diapos et le clavier du
 * même onglet : deux appuis rapides ne sautent ni ne répètent une page, et les boutons se grisent d'après la
 * page visée (pas seulement celle que le serveur a confirmée).
 */
const cibles = new Map<number, number | null>();
const abonnesCible = new Set<() => void>();
function fixerCible(seanceId: number, valeur: number | null) {
  cibles.set(seanceId, valeur);
  abonnesCible.forEach((f) => f());
}
export function useCibleCopie(seanceId: number): number | null {
  return useSyncExternalStore(
    (f) => {
      abonnesCible.add(f);
      return () => abonnesCible.delete(f);
    },
    () => cibles.get(seanceId) ?? null,
  );
}

const codeErreur = (e: unknown) => (e instanceof ErreurApi && e.details && typeof e.details === "object" ? (e.details as { code?: string }).code : undefined);

let dernierAvisArret = 0;
/** Copie remplacée par l'étudiant, corrigé modifié : le Studio le dit une fois (temps réel et réponse du serveur). */
function avisArret(tx: Traducteur<Parameters<typeof textesCopies>[0]>, motif: "remplacee" | "modifie") {
  if (Date.now() - dernierAvisArret < 3000) return;
  dernierAvisArret = Date.now();
  toast(tx(motif === "modifie" ? "toast.corrigeModifie" : "toast.remplacee"), "info");
}

export function useCopieDirect(seanceId: number) {
  const tx = useTextes(textesCopies);
  const [envoi, setEnvoi] = useState(false);
  const cle = cleDirect(seanceId);
  const majCopie = useCallback(
    (copie: CopieProjeteeDto | null) =>
      queryClient.setQueryData<EtatDirectDto>(cle, (x) => (x ? { ...x, copie, ...(copie ? { projection: null } : {}) } : x)),
    [seanceId],
  );

  /** Projette une page ; lève ErreurApi (409 « devoir_ouvert », « copie_changee »…) pour que la vue réagisse. */
  const projeter = useCallback(
    async (corps: CorpsProjectionCopie) => {
      setEnvoi(true);
      try {
        const dto = await post<CopieProjeteeDto>(`/api/seances/${seanceId}/projection/copie`, corps);
        fixerCible(seanceId, null);
        majCopie(dto);
        void queryClient.invalidateQueries({ queryKey: [`/api/seances/${seanceId}/projection/copie`] });
        return dto;
      } finally {
        setEnvoi(false);
      }
    },
    [seanceId, majCopie],
  );

  /** Arrête la copie : les salles retrouvent la diapo laissée (ou les caméras). Un seul chemin pour tous les retours. */
  const revenirAuxDiapos = useCallback(
    async (o: { silencieux?: boolean } = {}) => {
      const etat = queryClient.getQueryData<EtatDirectDto>(cle);
      fixerCible(seanceId, null);
      majCopie(null);
      try {
        await post(`/api/seances/${seanceId}/projection`, { ressourceId: null });
        if (!o.silencieux) toast(etat?.diapo.url ? tx("toast.retour") : tx("toast.retourCameras"));
      } catch (e) {
        toastErreur(e);
      }
    },
    [seanceId, majCopie, tx],
  );

  const envoyerReglage = useCallback(
    async (corps: ReglageCopieDto) => {
      setEnvoi(true);
      try {
        const dto = await patch<CopieProjeteeDto>(`/api/seances/${seanceId}/projection/copie`, corps);
        majCopie(dto);
        return dto;
      } catch (e) {
        const code = codeErreur(e);
        // L'état a bougé ailleurs (retour aux diapos, autre poste) : le temps réel le dira.
        if (code === "projection_changee" || code === "aucune") return null;
        // La copie a été remplacée (ou le corrigé modifié) : elle a quitté l'écran, on le dit.
        if (code === "plus_montree") {
          const source = queryClient.getQueryData<EtatDirectDto>(cle)?.copie?.source;
          majCopie(null);
          avisArret(tx, source === "corrige" ? "modifie" : "remplacee");
          return null;
        }
        toastErreur(e);
        return null;
      } finally {
        setEnvoi(false);
      }
    },
    [seanceId, majCopie, tx],
  );

  /**
   * ← → : les pages de la copie ; avant la première ou après la dernière, retour aux diapos (clavier, télécommande).
   * « borne » (boutons du panneau) : aux deux bouts, rien ne se passe. Numéro absolu : deux appuis rapides ne
   * sautent ni ne répètent une page.
   */
  const allerPage = useCallback(
    (delta: number, o: { borne?: boolean } = {}) => {
      const copie = queryClient.getQueryData<EtatDirectDto>(cle)?.copie;
      if (!copie) return;
      const base = cibles.get(seanceId) ?? copie.numero;
      const cible = base + delta;
      if (cible < 1 || cible > copie.total) {
        if (!o.borne) void revenirAuxDiapos();
        return;
      }
      fixerCible(seanceId, cible);
      void envoyerReglage({ numero: cible }).finally(() => {
        if (cibles.get(seanceId) === cible) fixerCible(seanceId, null);
      });
    },
    [seanceId, revenirAuxDiapos, envoyerReglage],
  );

  /**
   * Zoom, rotation, prénom, haut caché : l'affichage suit tout de suite, le serveur confirme (en cas d'échec,
   * l'état est relu). Haut caché : la rotation attend la nouvelle image du serveur (le bord coupé change).
   */
  const regler = useCallback(
    (r: Partial<{ zone: ZoneCopie; rotation: RotationCopie; nomVisible: boolean; enteteMasque: boolean }>) => {
      queryClient.setQueryData<EtatDirectDto>(cle, (x) => {
        if (!x?.copie) return x;
        const rotationTout = r.rotation !== undefined && !(x.copie.enteteMasque && x.copie.enteteDisponible);
        return {
          ...x,
          copie: {
            ...x.copie,
            ...(r.zone && { zone: r.zone }),
            ...(rotationTout && { rotation: r.rotation }),
            ...(r.nomVisible !== undefined && { nomVisible: r.nomVisible }),
            ...(r.enteteMasque !== undefined && { enteteMasque: r.enteteMasque }),
          },
        };
      });
      void envoyerReglage(r).then((dto) => {
        if (!dto) void queryClient.invalidateQueries({ queryKey: cle });
      });
    },
    [seanceId, envoyerReglage],
  );

  return { projeter, allerPage, regler, revenirAuxDiapos, envoi };
}

/** L'étudiant a remplacé la copie montrée (ou le corrigé a été modifié) : elle quitte l'écran, le Studio le dit. */
export function useAvisCopieRemplacee(seanceId: number, actif: boolean) {
  const tx = useTextes(textesCopies);
  useCanal(actif ? `seance:${seanceId}` : null, (e) => {
    if (e.type !== "copie:arretee") return;
    if (e.data?.motif === "remplacee" || e.data?.motif === "modifie") avisArret(tx, e.data.motif);
  });
}

export { codeErreur };
