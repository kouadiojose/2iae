// Gros blocs, mais beaux (José, 15 octobre 2026 à 5 h : « même si j'ai dit des gros blocs, ça peut être un peu
// esthétique. Faut pas casser la dynamique du campus »). Briques communes à l'espace du campus (modules/espace-campus)
// et à l'accueil du formateur (modules/accueil/simple) : carré de cours en dégradé doux de sa couleur, icône dans un
// cercle, titre fort, sous-titre court, ombre légère, réaction au survol et au toucher, point « En direct » vivant.
//
// Gardés de la version « maternelle » : blocs de 120 px de haut au moins sur ordinateur (le live : 160 px), pleine largeur
// sur téléphone, texte de 20 px au moins, contraste AA (4,5:1) partout. Jamais de flou ni de backdrop-filter (vieux
// ordinateurs des salles) ; « prefers-reduced-motion » et le mode « données réduites » coupent les animations (index.css).
import type { CSSProperties, ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { degradeCours } from "@/modules/cours/outils";

/** Survol, toucher et focus des gros blocs cliquables (ombre qui s'allonge, léger soulèvement, pression au toucher). */
export const CLASSES_VIVANTES =
  "shadow-carte transition-[transform,box-shadow,border-color] duration-150 ease-out hover:shadow-survol active:scale-[.985] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange/50 focus-visible:ring-offset-2";

/** Point « En direct » vivant (pulsé), dans la couleur du texte. Le mot « En direct » est toujours écrit à côté. */
export function PointVivant({ className, fixe = false }: { className?: string; fixe?: boolean }) {
  return (
    <span className={cn("relative flex h-3 w-3 shrink-0", className)} aria-hidden data-point-vivant={fixe ? undefined : ""}>
      {!fixe && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />}
      <span className="relative inline-flex h-3 w-3 rounded-full bg-current" />
    </span>
  );
}

/** Icône dans un cercle (56 px sur les cartes, 64 à 80 px sur les gros blocs). */
export function CercleIcone({ children, taille = 56, fond, couleur, className }: { children: ReactNode; taille?: number | null; fond?: string; couleur?: string; className?: string }) {
  // taille null : la taille vient des classes (cercle qui grandit avec l'écran).
  const dims = taille === null ? {} : { width: taille, height: taille };
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full", className)} style={{ ...dims, background: fond, color: couleur }} aria-hidden>
      {children}
    </span>
  );
}

/** Deux bulles décoratives en haut à droite, couleur du voile (jamais vers le texte). */
export function Bulles({ voile, grandes = false }: { voile: string; grandes?: boolean }) {
  return (
    <>
      <span aria-hidden className={cn("pointer-events-none absolute -z-10 rounded-full", grandes ? "-right-16 -top-16 h-60 w-60" : "-right-12 -top-12 h-44 w-44")} style={{ background: voile }} />
      <span aria-hidden className={cn("pointer-events-none absolute -z-10 rounded-full", grandes ? "-right-2 top-24 h-28 w-28" : "-right-4 top-16 h-24 w-24")} style={{ background: voile }} />
    </>
  );
}

export type TonPastille = "direct" | "ouvert" | "blanc";

/**
 * Pastille de repère : « En direct maintenant » (vert vif, point vivant), « Salle ouverte · début à 8h30 » (vert pâle,
 * point fixe), « Aujourd'hui à 8h30 » (blanche, horloge). Lisible sur toutes les couleurs de cours.
 */
export function Pastille({ ton, children, icone, grande = false, sansIcone = false }: { ton: TonPastille; children: ReactNode; icone?: ReactNode; grande?: boolean; sansIcone?: boolean }) {
  // Sur les carrés, plus serrée (18 px) et arrondie à 22 px : sur deux lignes (écran étroit), elle reste douce.
  const taille = grande ? "text-[20px] sm:text-[22px] px-4 py-2 gap-2.5 rounded-full" : "text-[18px] px-3.5 py-1.5 gap-2 rounded-[22px]";
  if (ton === "direct") {
    return (
      <span className={cn("inline-flex items-center bg-vif font-extrabold leading-tight text-white ring-2 ring-white/70", taille)} data-pastille="direct">
        <PointVivant />
        {children}
      </span>
    );
  }
  if (ton === "ouvert") {
    return (
      <span className={cn("inline-flex items-center bg-succes-clair font-extrabold leading-tight text-vif-texte", taille)} data-pastille="ouvert">
        <PointVivant fixe />
        {children}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center bg-white font-extrabold leading-tight text-encre", taille)} data-pastille="blanc">
      {!sansIcone && (icone ?? <Clock className="h-5 w-5 shrink-0 text-orange-profond" strokeWidth={2.25} aria-hidden />)}
      {children}
    </span>
  );
}

/**
 * Un carré de cours : dégradé doux de sa couleur, deux bulles, en haut le repère et l'icône dans un cercle, en bas le
 * code (Plex Mono), le titre (gros, trois lignes au plus) et, pour le campus, les classes. `data-degrade` porte les
 * deux arrêts (essai de contraste).
 */
export function CarteCours({
  href,
  couleur,
  code,
  titre,
  classes,
  repere,
  icone,
  testId,
}: {
  href: string;
  couleur: string;
  code: string;
  titre: string;
  classes?: string;
  repere?: ReactNode;
  icone: ReactNode;
  testId?: string;
}) {
  const d = degradeCours(couleur);
  return (
    <Link
      href={href}
      className={cn("relative isolate flex min-h-[180px] flex-col justify-between gap-5 overflow-hidden rounded-[28px] p-6 no-underline hover:-translate-y-1 active:translate-y-0 sm:min-h-[220px] sm:p-7", CLASSES_VIVANTES)}
      style={{ background: d.css, color: d.texte }}
      data-carre={testId ?? code}
      data-degrade={`${d.fond},${d.a}`}
    >
      <Bulles voile={d.voile} />
      <span className="flex items-start justify-between gap-3">
        <span className="min-h-[40px]">{repere}</span>
        <CercleIcone fond={d.voile}>{icone}</CercleIcone>
      </span>
      {/* Interligne et marge basse : les jambages (g, p, y) de la dernière ligne ne sont pas coupés. */}
      <span className="flex flex-col gap-1.5">
        <span className="font-mono text-[15px] font-semibold uppercase tracking-[0.14em]">{code}</span>
        <span className="line-clamp-3 break-words pb-[0.12em] text-[32px] font-black leading-[1.08] sm:text-[40px]">{titre}</span>
        {classes && <span className="text-[20px] font-bold leading-snug">{classes}</span>}
      </span>
    </Link>
  );
}

export type TonBloc = "orange" | "vert" | "blanc" | "gris" | "nuit" | "teinte";

const TONS: Record<TonBloc, { classe: string; style?: CSSProperties; degrade?: string; vivant: boolean }> = {
  orange: { classe: "text-encre border-transparent", style: { background: "linear-gradient(135deg, #E4793A 0%, #F0A066 100%)" }, degrade: "#E4793A,#F0A066", vivant: true },
  vert: { classe: "text-white border-transparent", style: { background: "linear-gradient(135deg, #16774C 0%, #0F5F3C 100%)" }, degrade: "#16774C,#0F5F3C", vivant: true },
  blanc: { classe: "bg-white text-encre border-ligne hover:border-orange/60", vivant: true },
  gris: { classe: "bg-[#EEEAE6] text-[#5E554F] border-[#D9D2CB]", vivant: false },
  nuit: { classe: "text-white border-transparent", style: { background: "linear-gradient(135deg, #1E1C1A 0%, #0F0E0D 100%)" }, degrade: "#1E1C1A,#0F0E0D", vivant: true },
  teinte: { classe: "text-encre border-ligne hover:border-orange/60", vivant: true },
};

/**
 * Un gros bloc : icône dans un cercle, titre fort, une ligne dessous, flèche dans un cercle à droite (ordinateur).
 * Lien (href), bouton (onClick), ou inerte (ni l'un ni l'autre, ou `inerte`). `grand` : le bloc du live (160 px au
 * moins sur ordinateur, cercle de 80 px). `fond` : la teinte douce d'un bloc « teinte ». `enfants` : sous le texte
 * (barre de progression d'un envoi).
 */
export function GrosBloc({
  icone,
  cercle,
  titre,
  sousTitre,
  href,
  onClick,
  ton = "blanc",
  grand = false,
  vivant = false,
  attente = false,
  chevron = true,
  fond,
  className,
  testId,
  enfants,
  inerte = false,
}: {
  icone: ReactNode;
  cercle?: { fond: string; couleur: string };
  titre: string;
  sousTitre?: ReactNode;
  href?: string;
  onClick?: () => void;
  ton?: TonBloc;
  grand?: boolean;
  vivant?: boolean;
  attente?: boolean;
  chevron?: boolean;
  fond?: string;
  className?: string;
  testId?: string;
  enfants?: ReactNode;
  inerte?: boolean;
}) {
  const t = TONS[ton];
  const actif = !inerte && Boolean(href || onClick) && t.vivant;
  const style: CSSProperties | undefined = ton === "teinte" ? { background: fond ?? "#FFFFFF" } : t.style;
  const classes = cn(
    "relative isolate flex w-full items-center gap-5 overflow-hidden rounded-[26px] border-2 px-5 text-left no-underline sm:px-7",
    grand ? "min-h-[140px] py-6 sm:min-h-[160px]" : "min-h-[112px] py-5 sm:min-h-[128px]",
    t.classe,
    actif ? cn(CLASSES_VIVANTES, "hover:-translate-y-0.5 active:translate-y-0") : "shadow-none",
    className,
  );
  // Le cercle grandit avec l'écran : 64 px (grand : 64 puis 80) ; 56 puis 64 sinon.
  const tailleCercle = grand ? "h-16 w-16 sm:h-20 sm:w-20" : "h-14 w-14 sm:h-16 sm:w-16";
  const cercleParDefaut = ton === "blanc" || ton === "teinte" || ton === "gris" ? { fond: "#FFF1E6", couleur: "#A34C17" } : { fond: "rgba(255,255,255,.22)", couleur: "currentColor" };
  const c = cercle ?? (ton === "nuit" ? { fond: "#E4793A", couleur: "#141414" } : cercleParDefaut);
  const contenu = (
    <>
      <CercleIcone taille={null} className={tailleCercle} fond={c.fond} couleur={c.couleur}>
        {attente ? <Loader2 className={cn("animate-spin", grand ? "h-10 w-10" : "h-8 w-8")} strokeWidth={2.25} /> : icone}
      </CercleIcone>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn("break-words font-black leading-tight", grand ? "text-[30px] sm:text-[36px]" : "text-[24px] sm:text-[28px]")}>{titre}</span>
        {sousTitre && (
          <span className={cn("flex items-center gap-2.5 font-semibold leading-snug", grand ? "text-[20px] sm:text-[22px]" : "text-[20px]")}>
            {vivant && <PointVivant />}
            <span className="min-w-0">{sousTitre}</span>
          </span>
        )}
        {enfants}
      </span>
      {chevron && actif && (
        <span className="hidden shrink-0 sm:grid" aria-hidden>
          <CercleIcone taille={grand ? 56 : 48} fond={ton === "blanc" || ton === "teinte" ? "#FBF6F2" : "rgba(255,255,255,.18)"}>
            <ChevronRight className={grand ? "h-8 w-8" : "h-7 w-7"} strokeWidth={2.25} />
          </CercleIcone>
        </span>
      )}
    </>
  );
  const commun = { className: classes, style, "data-bloc": testId, "data-degrade": t.degrade };
  if (href && !inerte)
    return (
      <Link href={href} {...commun}>
        {contenu}
      </Link>
    );
  if (onClick && !inerte)
    return (
      <button type="button" onClick={onClick} {...commun}>
        {contenu}
      </button>
    );
  return (
    <div {...commun} aria-disabled>
      {contenu}
    </div>
  );
}

/** Barre de progression d'un envoi, dans un bloc (orange sur ligne). */
export function BarreProgression({ part, nuit = false }: { part: number; nuit?: boolean }) {
  return (
    <span className={cn("mt-2 block h-3 w-full overflow-hidden rounded-full", nuit ? "bg-nuit-ligne" : "bg-ligne")} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(part * 100)}>
      <span className="block h-full rounded-full bg-orange transition-[width] duration-300" style={{ width: `${Math.max(4, Math.round(part * 100))}%` }} />
    </span>
  );
}

/** Étiquette en Plex Mono majuscules (« ESPACE DU CAMPUS », le code d'un cours, la date). */
export function Etiquette({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[14px] font-semibold uppercase tracking-[0.14em] text-orange-profond", className)}>{children}</span>;
}
