// En-tête coloré de la page d'un cours : code, titre, formateur « depuis
// Lyon », progression de l'étudiant et UNE action (reprendre, ou modifier).
import type { ReactNode } from "react";
import { Link } from "wouter";
import { Radio } from "lucide-react";
import { Avatar } from "@/components/ui/divers";
import { jourLong, heure, heureDouble } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { texteSur } from "../outils";
import type { CoursDetail } from "@shared/schema";

export function EnTeteCours({ cours, action, etudiant }: { cours: CoursDetail; action?: ReactNode; etudiant: boolean }) {
  const clair = texteSur(cours.couleur) === "encre";
  const f = cours.formateur;
  const s = cours.prochaineSeance;
  const p = cours.progression;
  return (
    <header
      className={cn("relative overflow-hidden rounded-[24px] px-5 py-6 sm:px-8 sm:py-8", clair ? "text-encre" : "text-white")}
      style={{ backgroundColor: cours.couleur }}
    >
      {/* Motif discret : cinq cercles, un par campus. */}
      <svg aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 opacity-[0.12]" viewBox="0 0 200 200">
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx="100" cy="100" r={20 + i * 18} fill="none" stroke="currentColor" strokeWidth="2" />
        ))}
      </svg>
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className={cn("font-mono text-xs font-semibold uppercase tracking-[0.12em]", clair ? "text-encre/75" : "text-white/80")}>
            {cours.code}
            {cours.statut !== "publie" && ` · ${cours.statut === "brouillon" ? "Brouillon" : "Archivé"}`}
          </span>
          <h1 className="text-[30px] font-black leading-[1.02] tracking-serre sm:text-[42px]">{cours.titre}</h1>
        </div>

        {f && (
          <div className="flex items-center gap-3">
            <Avatar prenom={f.prenom} nom={f.nom} photo={f.photoUrl} taille={44} className={clair ? "bg-encre text-white" : "bg-white text-encre"} />
            <div className="flex min-w-0 flex-col">
              <span className="text-base font-bold leading-tight">
                {f.prenom} {f.nom}
                {f.ville && <span className={cn("font-normal", clair ? "text-encre/75" : "text-white/80")}> · depuis {f.ville}</span>}
              </span>
              {f.titre && <span className={cn("text-[13px]", clair ? "text-encre/70" : "text-white/75")}>{f.titre}</span>}
            </div>
          </div>
        )}

        {s && (
          <p className={cn("flex items-start gap-2 text-[15px] leading-snug", clair ? "text-encre/85" : "text-white/90")}>
            {s.statut === "en_direct" ? (
              <Link href={`/live/${s.id}`} className={cn("inline-flex items-center gap-2 font-bold underline underline-offset-2", clair ? "text-encre hover:text-encre" : "text-white hover:text-white")}>
                <span className="point-direct" /> En direct maintenant : {s.titre}
              </Link>
            ) : (
              <>
                <Radio className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Prochain live {jourLong(s.debut)} à {etudiant ? heure(s.debut) : heureDouble(s.debut)}
                </span>
              </>
            )}
          </p>
        )}

        {p && p.total > 0 && (
          <div className="flex max-w-md flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold">
                {p.terminees} leçon{p.terminees > 1 ? "s" : ""} terminée{p.terminees > 1 ? "s" : ""} sur {p.total}
              </span>
              <span className="text-2xl font-extrabold tabular-nums">{p.pourcentage}%</span>
            </div>
            <div className={cn("h-2 overflow-hidden rounded-full", clair ? "bg-encre/15" : "bg-white/25")} role="progressbar" aria-valuenow={p.pourcentage} aria-valuemin={0} aria-valuemax={100}>
              <div className={cn("h-full rounded-full", clair ? "bg-encre" : "bg-white")} style={{ width: `${p.pourcentage}%` }} />
            </div>
          </div>
        )}

        {action && <div className="flex flex-wrap gap-2.5 pt-1">{action}</div>}
      </div>
    </header>
  );
}
