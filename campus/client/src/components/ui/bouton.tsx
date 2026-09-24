import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Boutons de la maquette : gros, arrondis, lisibles au pouce.
const VARIANTES = {
  principal: "bg-orange text-encre hover:bg-encre hover:text-white",
  encre: "bg-encre text-white hover:bg-orange hover:text-encre",
  contour: "bg-white text-encre border-[1.5px] border-encre hover:bg-orange-pale",
  doux: "bg-creme text-encre hover:bg-orange-clair",
  fantome: "bg-transparent text-texte-doux hover:bg-creme hover:text-encre",
  danger: "bg-direct text-white hover:bg-danger",
  nuit: "bg-nuit-carte text-white hover:bg-nuit-ligne",
  "nuit-actif": "bg-orange text-encre hover:bg-orange-peche",
} as const;

const TAILLES = {
  sm: "text-[13px] px-3 py-2 rounded-[10px] gap-1.5",
  md: "text-[15px] px-5 py-3 rounded-xl gap-2",
  lg: "text-base px-6 py-4 rounded-[14px] gap-2.5",
  icone: "p-2.5 rounded-xl",
} as const;

export type VarianteBouton = keyof typeof VARIANTES;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBouton;
  taille?: keyof typeof TAILLES;
  chargement?: boolean;
  icone?: ReactNode;
  pleineLargeur?: boolean;
};

export const Bouton = forwardRef<HTMLButtonElement, Props>(function Bouton(
  { variante = "principal", taille = "md", chargement, icone, pleineLargeur, className, children, disabled, type = "button", ...reste },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || chargement}
      className={cn(
        "inline-flex items-center justify-center font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none select-none",
        VARIANTES[variante],
        TAILLES[taille],
        pleineLargeur && "w-full",
        className,
      )}
      {...reste}
    >
      {chargement ? <Loader2 className="h-4 w-4 animate-spin" /> : icone}
      {children}
    </button>
  );
});

/** Lien interne qui a l'apparence d'un bouton. */
export function LienBouton({
  href,
  variante = "principal",
  taille = "md",
  icone,
  className,
  children,
  externe,
}: {
  href: string;
  variante?: VarianteBouton;
  taille?: keyof typeof TAILLES;
  icone?: ReactNode;
  className?: string;
  children?: ReactNode;
  externe?: boolean;
}) {
  const classes = cn(
    "inline-flex items-center justify-center font-bold transition-colors no-underline select-none",
    VARIANTES[variante],
    TAILLES[taille],
    // Les liens héritent sinon de la couleur orange des <a>.
    variante === "principal" && "text-encre hover:text-white",
    variante === "encre" && "text-white hover:text-encre",
    variante === "contour" && "text-encre hover:text-encre",
    className,
  );
  if (externe) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {icone}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {icone}
      {children}
    </Link>
  );
}
