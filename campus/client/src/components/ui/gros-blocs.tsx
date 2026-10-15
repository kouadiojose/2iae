// Gros blocs du campus, beaux et simples (José, 15 octobre 2026 : « de gros blocs, beaux, très simples »), pour
// l'espace du professeur, le mur du cours et la page « Professeurs » de la direction. Même identité que les blocs de
// l'espace du campus : couleur du cours en dégradé doux, icône dans un cercle, ombre légère, mouvement discret au
// survol et au toucher (coupé par prefers-reduced-motion et « données réduites », index.css). Aucun flou, aucune
// image. Texte ≥ 18 px, blocs ≥ 120 px de haut sur ordinateur et pleine largeur sur téléphone, contraste AA.
import type { CSSProperties, ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { couleurLisible } from "@/modules/cours/outils";

/** Mélange deux couleurs hexadécimales (part de la seconde). */
function melanger(a: string, b: string, part: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * part).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Dégradé de la couleur d'un cours : le second arrêt va toujours dans le sens qui AUGMENTE le contraste du texte
 * (plus sombre sous un texte blanc, plus clair sous un texte encre) : ≥ 4,5:1 sur tout le dégradé.
 */
export function degradeCours(hex: string): { background: string; color: string; voile: string } {
  const { fond, texte } = couleurLisible(hex);
  const blanc = texte.toUpperCase() === "#FFFFFF";
  const arret = blanc ? melanger(fond, "#000000", 0.18) : melanger(fond, "#FFFFFF", 0.22);
  return { background: `linear-gradient(135deg, ${fond} 0%, ${arret} 100%)`, color: texte, voile: blanc ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.30)" };
}

/** La couleur d'un cours mêlée à beaucoup de blanc (fond doux d'une carte). */
export const teinteDouce = (hex: string, part = 0.08) => (/^#[0-9a-fA-F]{6}$/.test(hex) ? melanger("#FFFFFF", hex, part) : "#FFF7F1");

const MOUVEMENT =
  "transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(20,20,20,.08),0_18px_36px_-16px_rgba(20,20,20,.40)] active:translate-y-0 active:scale-[.985] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange/50 focus-visible:ring-offset-2";

/** Point « En direct » vivant (toujours à côté d'un mot : jamais la couleur seule). */
export function PointVivant({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-3 w-3 shrink-0", className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-current" />
    </span>
  );
}

/** Bande d'en-tête d'un cours : dégradé de sa couleur, deux bulles discrètes, titre en grand. */
export function BandeauCours({ couleur, etiquette, titre, sousTitre, children }: { couleur: string; etiquette?: string; titre: string; sousTitre?: string | null; children?: ReactNode }) {
  const d = degradeCours(couleur);
  return (
    <div className="relative isolate overflow-hidden rounded-[28px] px-6 py-6 sm:rounded-[32px] sm:px-9 sm:py-8" style={{ background: d.background, color: d.color }}>
      <span className="absolute -right-12 -top-14 -z-10 h-44 w-44 rounded-full" style={{ background: d.voile }} aria-hidden />
      <span className="absolute -right-3 top-20 -z-10 h-20 w-20 rounded-full" style={{ background: d.voile }} aria-hidden />
      {etiquette && <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.14em]">{etiquette}</span>}
      <h1 className="mt-1 break-words pb-[0.08em] font-sans text-[34px] font-black leading-[1.08] sm:text-[46px]">{titre}</h1>
      {sousTitre && <p className="mt-2 text-[20px] font-bold leading-snug">{sousTitre}</p>}
      {children}
    </div>
  );
}

/** « Retour » : 64 px, contour, pleine largeur sur téléphone. */
export function RetourGros({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[20px] border-2 border-ligne bg-white px-6 text-[20px] font-extrabold text-encre no-underline shadow-carte transition-colors hover:border-orange hover:text-encre focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange/50 sm:w-auto sm:self-start"
    >
      <ArrowLeft className="h-6 w-6" aria-hidden />
      {children}
    </Link>
  );
}

export type TonGrosBloc = "orange" | "vert" | "gris" | "blanc" | "encre" | "nuit";

const TONS: Record<TonGrosBloc, { carte: string; cercle: string; style?: CSSProperties }> = {
  // Orange : texte encre (6,2:1), dégradé vers un orange plus clair (8,7:1).
  orange: { carte: "border-transparent text-encre", cercle: "bg-white/40 text-encre", style: { background: "linear-gradient(135deg,#E4793A 0%,#F0A066 100%)" } },
  // Vert « en direct » : blanc dessus 5,6:1, plus sombre vers la fin (7,7:1).
  vert: { carte: "border-transparent text-white", cercle: "bg-black/15 text-white", style: { background: "linear-gradient(135deg,#16774C 0%,#0F5F3C 100%)" } },
  gris: { carte: "border-[#D9D2CB] bg-[#EEEAE6] text-[#5E554F]", cercle: "bg-white text-[#5E554F]" },
  blanc: { carte: "border-ligne bg-white text-encre hover:border-orange", cercle: "bg-orange-clair text-orange-profond" },
  encre: { carte: "border-transparent bg-encre text-white", cercle: "bg-orange text-encre" },
  nuit: { carte: "border-transparent text-white", cercle: "bg-orange text-encre", style: { background: "linear-gradient(135deg,#1E1C1A 0%,#0F0E0D 100%)" } },
};

/**
 * Un gros bloc : icône dans un cercle, titre en 26-32 px, une ligne dessous (20 px), flèche à droite sur ordinateur.
 * 120 px au moins (téléphone), 160 px sur ordinateur ; lien, bouton ou bloc grisé.
 */
export function GrosBlocProf({
  icone,
  titre,
  texte,
  ton = "blanc",
  href,
  onClick,
  testId,
  cercle,
  grand,
  chargement,
  vivant,
  className,
}: {
  icone: ReactNode;
  titre: string;
  texte?: ReactNode;
  ton?: TonGrosBloc;
  href?: string;
  onClick?: () => void;
  testId?: string;
  /** Couleurs du cercle (fond, icône) quand le ton ne suffit pas. */
  cercle?: { fond: string; icone: string };
  /** Bloc principal (le live) : plus haut, titre plus grand. */
  grand?: boolean;
  chargement?: boolean;
  /** Point « En direct » vivant devant le texte. */
  vivant?: boolean;
  className?: string;
}) {
  const t = TONS[ton];
  const inactif = !href && !onClick;
  const classe = cn(
    "group relative isolate flex w-full items-center gap-4 overflow-hidden rounded-[26px] border-2 px-5 py-5 text-left no-underline shadow-carte sm:gap-5 sm:px-6",
    grand ? "min-h-[136px] sm:min-h-[168px] sm:py-7" : "min-h-[120px] sm:min-h-[160px]",
    t.carte,
    !inactif && MOUVEMENT,
    inactif && "cursor-default",
    className,
  );
  const contenu = (
    <>
      <span
        className={cn("grid shrink-0 place-items-center rounded-full", grand ? "h-[68px] w-[68px] sm:h-20 sm:w-20" : "h-14 w-14 sm:h-16 sm:w-16", !cercle && t.cercle)}
        style={cercle ? { background: cercle.fond, color: cercle.icone } : undefined}
        aria-hidden
      >
        {chargement ? <Loader2 className="h-8 w-8 animate-spin" /> : icone}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn("break-words font-black leading-tight", grand ? "text-[28px] sm:text-[36px]" : "text-[24px] sm:text-[26px]")}>{titre}</span>
        {texte && (
          <span className="flex items-center gap-2 text-[18px] font-semibold leading-snug sm:text-[20px]">
            {vivant && <PointVivant />}
            <span className="min-w-0">{texte}</span>
          </span>
        )}
      </span>
      {!inactif && (
        <span className={cn("hidden shrink-0 place-items-center rounded-full sm:grid", grand ? "h-14 w-14" : "h-11 w-11", ton === "blanc" || ton === "gris" ? "bg-creme" : "bg-white/20")} aria-hidden>
          <ChevronRight className="h-7 w-7" />
        </span>
      )}
    </>
  );
  if (href)
    return (
      <Link href={href} className={classe} style={t.style} data-bloc={testId}>
        {contenu}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={classe} style={t.style} data-bloc={testId} aria-disabled={inactif || undefined} disabled={chargement}>
      {contenu}
    </button>
  );
}

/** Ligne plus petite (80 px) sous les gros blocs : « Leçons, devoirs et notes ». */
export function LigneBloc({ icone, titre, href, testId }: { icone: ReactNode; titre: string; href: string; testId?: string }) {
  return (
    <Link
      href={href}
      data-bloc={testId}
      className={cn("flex min-h-[80px] w-full items-center gap-4 rounded-[22px] border-2 border-ligne bg-white px-5 text-encre no-underline shadow-carte hover:border-orange", MOUVEMENT)}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-creme text-orange-profond" aria-hidden>
        {icone}
      </span>
      <span className="flex-1 text-[20px] font-extrabold sm:text-[22px]">{titre}</span>
      <ChevronRight className="h-6 w-6 shrink-0" aria-hidden />
    </Link>
  );
}

/** Gros bouton d'action (64 px) : orange, contour, ou danger. Pleine largeur sur téléphone. */
export function GrosBouton({
  children,
  onClick,
  href,
  ton = "orange",
  icone,
  disabled,
  chargement,
  type = "button",
  className,
  externe,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  ton?: "orange" | "contour" | "encre" | "danger" | "vert";
  icone?: ReactNode;
  disabled?: boolean;
  chargement?: boolean;
  type?: "button" | "submit";
  className?: string;
  externe?: boolean;
}) {
  const classe = cn(
    "inline-flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[20px] px-7 text-[20px] font-black no-underline transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:w-auto",
    ton === "orange" && "bg-orange text-encre hover:bg-encre hover:text-white",
    ton === "encre" && "bg-encre text-white hover:bg-orange hover:text-encre",
    ton === "contour" && "border-2 border-encre bg-white text-encre hover:bg-orange-pale hover:text-encre",
    ton === "danger" && "bg-[#B42318] text-white hover:bg-[#8F1C13] hover:text-white",
    ton === "vert" && "bg-[#16774C] text-white hover:bg-[#0F5F3C] hover:text-white",
    className,
  );
  const contenu = (
    <>
      {chargement ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : icone}
      {children}
    </>
  );
  if (href && externe)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classe}>
        {contenu}
      </a>
    );
  if (href)
    return (
      <Link href={href} className={classe}>
        {contenu}
      </Link>
    );
  return (
    <button type={type} onClick={onClick} disabled={disabled || chargement} className={classe}>
      {contenu}
    </button>
  );
}
