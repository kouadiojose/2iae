// Copie d'étudiant montrée à la classe pendant le direct, à la place de la diapo (server/projection-copies.ts).
// Fichier léger, importé par la scène de tous les écrans : le cadre de la copie (même rendu pour l'aperçu du
// formateur, son panneau du Studio, les salles et les étudiants), et le pilotage (projeter, tourner les pages,
// régler, revenir aux diapos). La rotation et le zoom sont rendus ici, par le navigateur : l'image ne change
// pas, rien n'est rechargé. L'image arrive en double tampon : l'ancienne page reste affichée tant que la
// nouvelle n'est pas là (4 s au plus, puis « La copie arrive… »).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ErreurApi, patch, post } from "@/lib/api";
import { useCanal } from "@/lib/flux";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";
import { toast, toastErreur } from "@/components/ui/toast";
import { t as textesCopies } from "@shared/textes/copies-direct";
import type { CopieProjeteeDto, CorpsProjectionCopie, EtatDirectDto, ReglageCopieDto, RotationCopie, ZoneCopie } from "@shared/schema";
import { cleDirect } from "./outils";

/** Disposition de la scène pendant une copie : « côte à côte » si choisie, sinon « diapo » (en vignette, une page est illisible). */
export const dispositionAvecCopie = (etat: EtatDirectDto): "diapo" | "cote" => (etat.diapo.disposition === "cote" ? "cote" : "diapo");

type Emplacement = { src: string; iw: number; ih: number; pret: boolean };

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

/**
 * Le cadre d'une copie : image tournée et zoomée, ou texte en grands caractères sur une feuille claire, avec sa
 * légende en haut à gauche (la vignette caméra est en bas à droite). « relance » : en cas d'erreur, nouvel essai
 * toutes les 3 s (écrans de la classe) ; sinon « erreur » s'affiche (aperçu du formateur).
 */
export function CadreCopie(p: {
  src: string | null;
  contenu: "image" | "texte" | "markdown";
  texte?: string;
  rotation: RotationCopie;
  zone: ZoneCopie;
  legende?: string;
  grand?: boolean;
  className?: string;
  relance?: boolean;
  erreur?: ReactNode;
  chargement?: ReactNode;
}) {
  const tx = useTextes(textesCopies);
  const cadre = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ cw: 0, ch: 0 });
  useEffect(() => {
    const el = cadre.current;
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
      copie[arriere] = { src: srcVoulue, iw: 0, ih: 0, pret: false };
      return copie;
    });
    setAttenteDepuis(Date.now());
  }, [srcVoulue]);
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

  const zoneTexte = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = zoneTexte.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = p.zone === "bas" ? max : p.zone === "milieu" ? max / 2 : 0;
  }, [p.zone, p.texte]);

  const visible = emplacements[devant];
  const attenteLongue = attenteDepuis !== null && Date.now() - attenteDepuis > 4000;
  return (
    <div ref={cadre} className={cn("relative overflow-hidden bg-black", p.className)}>
      {p.contenu === "image" ? (
        <>
          {([0, 1] as const).map((i) => {
            const e = emplacements[i];
            if (!e) return null;
            const pos = e.pret && taille.cw ? placement(e.iw, e.ih, taille.cw, taille.ch, p.rotation, p.zone) : null;
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
                    ? { width: pos.largeur, height: pos.hauteur, left: pos.gauche, top: pos.haut, transform: `rotate(${p.rotation}deg)` }
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
        <div ref={zoneTexte} className="defile-fin absolute inset-0 overflow-y-auto bg-creme text-encre">
          {p.texte === undefined ? (
            <div className="grid h-full place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-orange" />
            </div>
          ) : p.contenu === "markdown" ? (
            <Markdown source={p.texte} className={cn("mx-auto max-w-4xl px-[5%] py-[4%]", p.grand ? "text-[clamp(20px,2.4vw,44px)]" : "text-[clamp(14px,1.8vw,28px)]")} />
          ) : (
            <p className={cn("mx-auto max-w-5xl whitespace-pre-line px-[6%] py-[5%] font-semibold leading-snug", p.grand ? "text-[clamp(22px,3vw,56px)]" : "text-[clamp(16px,2.4vw,40px)]")}>{p.texte}</p>
          )}
        </div>
      )}
      {p.legende && (
        <span
          className={cn(
            "pointer-events-none absolute left-3 top-3 z-[3] line-clamp-2 max-w-[85%] rounded-lg bg-black/70 px-2.5 py-1 font-mono text-orange-peche",
            p.grand ? "text-[clamp(14px,1.4vw,22px)]" : "text-xs",
          )}
        >
          {p.legende}
        </span>
      )}
    </div>
  );
}

/** La copie projetée, telle que la voit toute la classe (et l'animateur, dans son panneau). */
export function CopieProjetee({ copie, grand, className }: { copie: CopieProjeteeDto; grand?: boolean; className?: string }) {
  const tx = useTextes(textesCopies);
  const texte = useQuery<{ texte: string }>({
    queryKey: [copie.url],
    enabled: copie.contenu !== "image",
    staleTime: Infinity,
    gcTime: 60_000,
    retry: (n) => n < 40,
    retryDelay: 3000,
  });
  const legende = tx("classe.legende", { v: { etiquette: copie.etiquette, devoir: copie.devoirTitre, n: copie.numero, total: copie.total } });
  return (
    <CadreCopie
      src={copie.contenu === "image" ? copie.url : null}
      contenu={copie.contenu}
      texte={texte.data?.texte}
      rotation={copie.rotation}
      zone={copie.zone}
      legende={legende}
      grand={grand}
      relance
      className={cn("h-full w-full", className)}
    />
  );
}

// ── Pilotage (Studio, fenêtre présentateur, vue « Devoirs ») ───────────────

/** Page voulue pendant qu'un envoi est en route, partagée par le panneau, la bande des diapos et le clavier du même onglet. */
const cibleEnCours = new Map<number, number | null>();

const codeErreur = (e: unknown) => (e instanceof ErreurApi && e.details && typeof e.details === "object" ? (e.details as { code?: string }).code : undefined);

export function useCopieDirect(seanceId: number) {
  const tx = useTextes(textesCopies);
  const [envoi, setEnvoi] = useState(false);
  const cle = cleDirect(seanceId);
  const majCopie = useCallback(
    (copie: CopieProjeteeDto | null) =>
      queryClient.setQueryData<EtatDirectDto>(cle, (x) => (x ? { ...x, copie, ...(copie ? { projection: null } : {}) } : x)),
    [seanceId],
  );

  /** Projette une page ; lève ErreurApi (409 « devoir_ouvert »…) pour que la vue réagisse. */
  const projeter = useCallback(
    async (corps: CorpsProjectionCopie) => {
      setEnvoi(true);
      try {
        const dto = await post<CopieProjeteeDto>(`/api/seances/${seanceId}/projection/copie`, corps);
        cibleEnCours.set(seanceId, null);
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
      cibleEnCours.set(seanceId, null);
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
        // L'état a bougé ailleurs (retour aux diapos, autre poste) : le temps réel le dira.
        if (codeErreur(e) !== "projection_changee" && !(e instanceof ErreurApi && e.statut === 409)) toastErreur(e);
        return null;
      } finally {
        setEnvoi(false);
      }
    },
    [seanceId, majCopie],
  );

  /** ← → : les pages de la copie ; avant la première ou après la dernière, retour aux diapos. Numéro absolu : deux appuis rapides ne sautent ni ne répètent une page. */
  const allerPage = useCallback(
    (delta: number) => {
      const copie = queryClient.getQueryData<EtatDirectDto>(cle)?.copie;
      if (!copie) return;
      const base = cibleEnCours.get(seanceId) ?? copie.numero;
      const cible = base + delta;
      if (cible < 1 || cible > copie.total) {
        void revenirAuxDiapos();
        return;
      }
      cibleEnCours.set(seanceId, cible);
      void envoyerReglage({ numero: cible }).finally(() => {
        if (cibleEnCours.get(seanceId) === cible) cibleEnCours.set(seanceId, null);
      });
    },
    [seanceId, revenirAuxDiapos, envoyerReglage],
  );

  /** Zoom, rotation, prénom, haut caché : l'affichage suit tout de suite, le serveur confirme. */
  const regler = useCallback(
    (r: Partial<{ zone: ZoneCopie; rotation: RotationCopie; nomVisible: boolean; enteteMasque: boolean }>) => {
      queryClient.setQueryData<EtatDirectDto>(cle, (x) =>
        x?.copie ? { ...x, copie: { ...x.copie, ...(r.zone && { zone: r.zone }), ...(r.rotation !== undefined && { rotation: r.rotation }) } } : x,
      );
      void envoyerReglage(r);
    },
    [seanceId, envoyerReglage],
  );

  return { projeter, allerPage, regler, revenirAuxDiapos, envoi };
}

let dernierAvisRemplacee = 0;

/** L'étudiant a remplacé la copie montrée : elle quitte l'écran, le Studio le dit (une fois par poste). */
export function useAvisCopieRemplacee(seanceId: number, actif: boolean) {
  const tx = useTextes(textesCopies);
  useCanal(actif ? `seance:${seanceId}` : null, (e) => {
    if (e.type !== "copie:arretee" || e.data?.motif !== "remplacee") return;
    if (Date.now() - dernierAvisRemplacee < 3000) return;
    dernierAvisRemplacee = Date.now();
    toast(tx("toast.remplacee"), "info");
  });
}

export { codeErreur };
