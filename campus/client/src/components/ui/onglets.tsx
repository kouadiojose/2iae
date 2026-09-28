import { cn } from "@/lib/utils";

/** Onglets en pilule de la maquette (fond encre pour l'onglet actif). */
export function Onglets<T extends string>({
  valeur,
  onChange,
  options,
  nuit,
  className,
}: {
  valeur: T;
  onChange: (v: T) => void;
  options: { valeur: T; libelle: string; compteur?: number }[];
  nuit?: boolean;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1.5", nuit ? "bg-nuit-panneau" : "bg-creme", className)}>
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <button
            key={o.valeur}
            role="tab"
            aria-selected={actif}
            onClick={() => onChange(o.valeur)}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-colors",
              nuit
                ? actif
                  ? "bg-orange text-encre"
                  : "text-nuit-doux hover:text-white"
                : actif
                  ? "bg-white text-encre shadow-sm"
                  : "text-texte-pale hover:text-encre",
            )}
          >
            {o.libelle}
            {o.compteur ? (
              <span className={cn("rounded-full px-1.5 font-mono text-[11px]", actif ? "bg-orange text-encre" : "bg-ligne text-texte-doux")}>{o.compteur}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
