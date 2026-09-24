// Bloc du profil : titre avec pictogramme, courte explication, contenu.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  titre,
  icone,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  titre: ReactNode;
  icone?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 rounded-[22px] border border-ligne bg-white p-5 sm:p-6", className)} aria-labelledby={id ? `${id}-titre` : undefined}>
      {/* Sur téléphone, le bouton d'action passe sous le titre : le texte garde toute la largeur. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icone && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">{icone}</span>}
          <div className="min-w-0">
            <h2 id={id ? `${id}-titre` : undefined} className="text-[20px] font-extrabold leading-tight">
              {titre}
            </h2>
            {description && <p className="mt-1 text-[15px] leading-snug text-texte-pale">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0 [&>button]:w-full sm:[&>button]:w-auto">{action}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

/** Ligne « libellé · valeur » (fiche d'identité, sécurité). */
export function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="font-mono text-xs uppercase tracking-wider text-texte-gris">{libelle}</dt>
      <dd className="min-w-0 text-right text-[15px] font-bold">{children}</dd>
    </div>
  );
}
