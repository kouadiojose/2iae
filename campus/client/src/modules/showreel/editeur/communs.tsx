// Briques communes de l'éditeur de présentation.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ShowreelEditionDto } from "@shared/schema";

/** Bloc numéroté de l'éditeur (une étape). */
export function Bloc({
  id,
  numero,
  titre,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  numero?: number;
  titre: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 rounded-[22px] border border-ligne bg-white p-5 sm:p-6", className)} aria-labelledby={id ? `${id}-titre` : undefined}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {numero !== undefined && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-encre font-mono text-sm font-bold text-white">{numero}</span>}
          <div className="min-w-0">
            <h2 id={id ? `${id}-titre` : undefined} className="text-[20px] font-extrabold leading-tight">
              {titre}
            </h2>
            {description && <p className="mt-1 text-[15px] leading-snug text-texte-pale">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

/** Texte au vouvoiement pour le formateur lui-même, ou à la troisième personne pour la direction. */
export function textes(d: Pick<ShowreelEditionDto, "estMoi" | "formateur">) {
  const nom = d.formateur.nomAffiche;
  return {
    estMoi: d.estMoi,
    nom,
    /** « vos liens » / « ses liens » */
    vos: d.estMoi ? "vos" : "ses",
    votre: d.estMoi ? "votre" : "sa",
    /** « Composer ma présentation » / « Composer sa présentation » */
    ma: d.estMoi ? "ma" : "sa",
    t: (moi: string, direction: string) => (d.estMoi ? moi : direction),
  };
}

const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const fmtJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });
export const dateHeure = (iso: string) => fmt.format(new Date(iso)).replace(":", "h");
export const dateJour = (iso: string) => fmtJour.format(new Date(iso));
