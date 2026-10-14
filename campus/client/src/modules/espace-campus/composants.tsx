// Briques de l'espace du campus : gros carrés, gros blocs, en-tête simple, fenêtre de confirmation.
// « Pense que ce sont des enfants de la maternelle » (José) : texte courant de 20 px au moins, blocs de 120 px de haut
// au moins sur ordinateur et pleine largeur sur téléphone, couleurs franches, une icône par bloc. Aucune animation,
// aucun flou (vieux ordinateurs de salle), rien qui demande de survoler.
import { useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { seDeconnecter } from "@/lib/auth";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { couleurLisible } from "@/modules/cours/outils";
import { t as textesCampus } from "@shared/textes/campus";
import type { CarreCampusDto, RepereCarre } from "@shared/espace-campus";

/** Aperçu de la direction : ?site=3 suit toutes les adresses de l'espace. */
export function siteApercu(): string | null {
  if (typeof window === "undefined") return null;
  const n = Number(new URLSearchParams(window.location.search).get("site"));
  return Number.isInteger(n) && n > 0 ? String(n) : null;
}

/** Adresse dans l'espace du campus, avec ?site= en aperçu (et d'autres paramètres au besoin). */
export function lienCampus(chemin: string, params: Record<string, string | number | null | undefined> = {}): string {
  const q = new URLSearchParams();
  const site = siteApercu();
  if (site) q.set("site", site);
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `${chemin}${chemin.includes("?") ? "&" : "?"}${s}` : chemin;
}

/**
 * Lecture d'une adresse de l'API de l'espace (avec ?site= en aperçu) : relue toutes les 60 s (ou `intervalle`), et
 * aussitôt quand un live démarre ou finit (événement temps réel « live »).
 */
export function useApiCampus<T>(chemin: string, intervalle = 60_000) {
  const cle = lienCampus(chemin);
  useTousEvenements((e) => {
    if (e.type === "live") void rafraichir("/api/mon-campus");
  });
  return useQuery<T>({ queryKey: [cle], refetchInterval: intervalle, staleTime: 5_000 });
}

/** Fond et texte d'un carré de la couleur d'un cours (contraste de 4,5 au moins : couleurLisible). */
export const styleCouleur = (couleur: string) => {
  const c = couleurLisible(couleur);
  return { background: c.fond, color: c.texte };
};

/** Bandeau gris de l'aperçu de la direction. */
export function BandeauApercu({ campus }: { campus: string }) {
  const tx = useTextes(textesCampus);
  return <div className="bg-[#E9E5E1] px-4 py-3 text-center text-[18px] font-bold text-encre">{tx("accueil.apercu", { v: { campus } })}</div>;
}

/** Bouton « Retour » de 64 px (contour encre). */
export function BoutonRetour({ href, libelle }: { href: string; libelle: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[20px] border-[3px] border-encre bg-white px-6 text-[22px] font-extrabold text-encre no-underline hover:bg-creme sm:w-auto sm:justify-start"
    >
      <ArrowLeft className="h-7 w-7 shrink-0" aria-hidden />
      {libelle}
    </Link>
  );
}

/** Pastille du repère d'un carré : lisible sur toutes les couleurs (blanche, ou verte pour le direct). */
export function PastilleRepere({ repere, heure, grande = false }: { repere: RepereCarre; heure: string | null; grande?: boolean }) {
  const tx = useTextes(textesCampus);
  if (!repere) return null;
  const taille = grande ? "text-[22px] px-4 py-2" : "text-[20px] px-3.5 py-1.5";
  if (repere === "direct") {
    return (
      <span className={cn("inline-flex items-center gap-2.5 rounded-full bg-succes font-extrabold text-white", taille)}>
        <span className="h-3 w-3 shrink-0 rounded-full bg-white" aria-hidden />
        {tx("repere.direct")}
      </span>
    );
  }
  if (repere === "ouvert") {
    return <span className={cn("inline-flex rounded-full bg-succes-clair font-extrabold text-succes", taille)}>{tx("repere.ouvert", { v: { heure: heure ?? "" } })}</span>;
  }
  return <span className={cn("inline-flex rounded-full bg-white font-extrabold text-encre", taille)}>{tx("repere.aujourdhui", { v: { heure: heure ?? "" } })}</span>;
}

/** Un gros carré de cours : la couleur du cours, son nom en très gros, le repère en haut. */
export function Carre({ carre, href }: { carre: Pick<CarreCampusDto, "titre" | "couleur" | "repere" | "heure" | "code">; href: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[160px] flex-col justify-between gap-4 rounded-[24px] p-5 no-underline ring-encre focus-visible:outline-none focus-visible:ring-4 sm:min-h-[200px] sm:p-6"
      style={styleCouleur(carre.couleur)}
      data-carre={carre.code}
    >
      <div className="min-h-[38px]">
        <PastilleRepere repere={carre.repere} heure={carre.heure} />
      </div>
      <span className="line-clamp-3 break-words text-[32px] font-black leading-[1.05] sm:text-[40px]">{carre.titre}</span>
    </Link>
  );
}

export type TonBloc = "orange" | "vert" | "blanc" | "gris";

const styleBloc: Record<TonBloc, string> = {
  orange: "bg-orange text-encre border-orange",
  vert: "bg-succes text-white border-succes",
  blanc: "bg-white text-encre border-encre hover:bg-creme",
  gris: "bg-[#EEEAE6] text-[#5E554F] border-[#D9D2CB]",
};

/**
 * Un gros bloc : une icône de 48 à 56 px, un titre, une ligne dessous. Lien (href), bouton (onClick), ou inerte
 * (ni l'un ni l'autre). 120 px de haut au moins sur ordinateur, pleine largeur sur téléphone.
 */
export function GrosBloc({
  icone,
  titre,
  sousTitre,
  href,
  onClick,
  ton = "blanc",
  grand = false,
  className,
  attente = false,
  testId,
}: {
  icone: ReactNode;
  titre: string;
  sousTitre?: string | null;
  href?: string;
  onClick?: () => void;
  ton?: TonBloc;
  grand?: boolean;
  className?: string;
  attente?: boolean;
  testId?: string;
}) {
  const classes = cn(
    "flex w-full items-center gap-5 rounded-[24px] border-[3px] px-6 text-left no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-encre/40",
    grand ? "min-h-[140px] py-6 sm:min-h-[160px]" : "min-h-[112px] py-5 sm:min-h-[140px]",
    styleBloc[ton],
    className,
  );
  const contenu = (
    <>
      <span className="grid shrink-0 place-items-center" aria-hidden>
        {attente ? <Loader2 className="h-12 w-12" /> : icone}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className={cn("break-words font-black leading-tight", grand ? "text-[30px] sm:text-[36px]" : "text-[26px] sm:text-[30px]")}>{titre}</span>
        {sousTitre && <span className="text-[20px] font-semibold leading-snug sm:text-[22px]">{sousTitre}</span>}
      </span>
    </>
  );
  if (href)
    return (
      <Link href={href} className={classes} data-bloc={testId}>
        {contenu}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={classes} data-bloc={testId}>
        {contenu}
      </button>
    );
  return (
    <div className={classes} data-bloc={testId} aria-disabled>
      {contenu}
    </div>
  );
}

/** Fenêtre de confirmation simple (sans flou ni animation) : un titre, une phrase, « Oui » et « Non ». */
export function Confirmation({
  ouverte,
  titre,
  texte,
  oui,
  non,
  onOui,
  onNon,
  nuit = false,
}: {
  ouverte: boolean;
  titre: string;
  texte?: string;
  oui: string;
  non: string;
  onOui: () => void;
  onNon: () => void;
  nuit?: boolean;
}) {
  useEffect(() => {
    if (!ouverte) return;
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onNon();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [ouverte, onNon]);
  if (!ouverte) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-label={titre}>
      <div className={cn("flex w-full max-w-xl flex-col gap-5 rounded-[28px] p-6 sm:p-8", nuit ? "bg-nuit-panneau text-white" : "bg-white text-encre")}>
        <p className="text-[32px] font-black leading-tight">{titre}</p>
        {texte && <p className={cn("text-[22px] leading-snug", nuit ? "text-nuit-doux" : "text-texte-doux")}>{texte}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onOui} className="min-h-[72px] flex-1 rounded-[20px] bg-orange px-6 text-[24px] font-black text-encre">
            {oui}
          </button>
          <button
            type="button"
            onClick={onNon}
            className={cn("min-h-[72px] flex-1 rounded-[20px] border-[3px] px-6 text-[24px] font-black", nuit ? "border-white text-white" : "border-encre text-encre")}
          >
            {non}
          </button>
        </div>
      </div>
    </div>
  );
}

/** « Se déconnecter » (lien discret), confirmé : « Se déconnecter de cet ordinateur ? ». */
export function BoutonDeconnexion() {
  const tx = useTextes(textesCampus);
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuverte(true)} className="inline-flex min-h-[48px] items-center gap-2 px-2 text-[18px] font-bold text-texte-doux underline underline-offset-4">
        <LogOut className="h-5 w-5" aria-hidden />
        {tx("deconnexion")}
      </button>
      <Confirmation
        ouverte={ouverte}
        titre={tx("deconnexion.titre")}
        oui={tx("deconnexion.oui")}
        non={tx("deconnexion.non")}
        onOui={() => void seDeconnecter()}
        onNon={() => setOuverte(false)}
      />
    </>
  );
}

/** En-tête simple de l'espace : logo et « Se déconnecter ». */
export function EnTeteCampus({ apercu, campus }: { apercu?: boolean; campus?: string }) {
  return (
    <>
      {apercu && campus && <BandeauApercu campus={campus} />}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
        <img src="/marque-2iae.png" alt="Groupe Écoles 2IAE" className="h-12 w-auto sm:h-14" />
        <BoutonDeconnexion />
      </header>
    </>
  );
}

/** Page qui charge : une phrase, pas d'animation. */
export function Patience() {
  return (
    <div className="grid min-h-[50dvh] place-items-center px-4" aria-busy="true">
      <p className="text-[24px] font-bold text-texte-doux">…</p>
    </div>
  );
}

/** La page ne s'ouvre pas : une phrase et un gros bouton « Réessayer ». */
export function ErreurCampus({ message, onReessayer }: { message?: string; onReessayer: () => void }) {
  const tx = useTextes(textesCampus);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16 text-center">
      <p className="text-[28px] font-black leading-tight">{message ?? tx("accueil.erreur")}</p>
      <button type="button" onClick={onReessayer} className="min-h-[72px] w-full rounded-[20px] bg-orange px-6 text-[24px] font-black text-encre sm:w-auto sm:min-w-[280px]">
        {tx("accueil.reessayer")}
      </button>
    </div>
  );
}

/** Mise en page commune des pages de l'espace (fond blanc, texte encre, 20 px au moins). */
export function PageCampus({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-dvh bg-white pb-16 text-[20px] text-encre", className)}>{children}</div>;
}
