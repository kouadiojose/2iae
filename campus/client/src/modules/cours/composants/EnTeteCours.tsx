// En-tête coloré de la page d'un cours : code, titre, formateur « depuis
// Lyon », progression de l'étudiant et UNE action (reprendre, ou modifier).
// La progression est la même que sur la carte du cours et l'accueil (chantier
// C2, un seul calcul côté serveur) : « 1 séance sur 1 suivie ou rattrapée ·
// 0 leçon sur 2 terminée · 33 % », rien tant qu'il n'y a rien à compter.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { Radio } from "lucide-react";
import { Avatar } from "@/components/ui/divers";
import { jourLong, heure, heureDouble } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { texteSur } from "../outils";
import type { FormateurDuCours } from "@shared/schema";
import { libelleSuivi, type CoursDetailSuivi } from "@shared/engagement/objectif";
import type { Traducteur } from "@shared/textes";
import { t, type CleObjectif } from "@shared/textes/objectif";

/** Progression à afficher : celle de la carte du cours (suivi) ; à défaut (ancienne réponse), les leçons seules. */
function progressionAffichee(cours: CoursDetailSuivi, tx: Traducteur<CleObjectif>) {
  if (cours.suivi) {
    const pct = cours.suivi.pourcentage;
    return pct === null ? null : { libelle: libelleSuivi(cours.suivi, tx), pct };
  }
  const p = cours.progression;
  if (!p || p.total <= 0) return null;
  return { libelle: `${p.terminees} leçon${p.terminees > 1 ? "s" : ""} terminée${p.terminees > 1 ? "s" : ""} sur ${p.total}`, pct: p.pourcentage };
}

export function EnTeteCours({ cours, action, etudiant }: { cours: CoursDetailSuivi; action?: ReactNode; etudiant: boolean }) {
  const tx = useTextes(t);
  const clair = texteSur(cours.couleur) === "encre";
  const f = cours.formateur;
  const s = cours.prochaineSeance;
  const p = progressionAffichee(cours, tx);
  // Tous les formateurs du cours ; celui qui anime le prochain live d'abord (M. Konaté le vendredi en Initiation à l'IA).
  const vedette = s?.animateur?.id ?? f?.id ?? null;
  const formateurs = [f, ...cours.coFormateurs]
    .filter((x): x is FormateurDuCours => Boolean(x))
    .sort((a, b) => Number(b.id === vedette) - Number(a.id === vedette));
  const animeParUnAutre = Boolean(s?.animateur && s.animateur.id !== f?.id);
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

        {formateurs.length > 0 && (
          <div className="flex flex-col gap-3">
            {formateurs.map((x) => (
              <div key={x.id} className="flex items-center gap-3">
                <Avatar prenom={x.prenom} nom={x.nom} photo={x.photoUrl} taille={44} className={clair ? "bg-encre text-white" : "bg-white text-encre"} />
                <div className="flex min-w-0 flex-col">
                  <span className="text-base font-bold leading-tight">
                    {x.prenom} {x.nom}
                    {x.ville && <span className={cn("font-normal", clair ? "text-encre/75" : "text-white/80")}> · depuis {x.ville}</span>}
                  </span>
                  {x.titre && <span className={cn("text-[13px]", clair ? "text-encre/70" : "text-white/75")}>{x.titre}</span>}
                </div>
              </div>
            ))}
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
                  {animeParUnAutre && <strong className="font-bold"> avec {s.animateur!.nom}</strong>}
                </span>
              </>
            )}
          </p>
        )}

        {p && (
          <div className="flex max-w-md flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold leading-snug">{p.libelle}</span>
              <span className="shrink-0 text-2xl font-extrabold tabular-nums">{p.pct}%</span>
            </div>
            <div
              className={cn("h-2 overflow-hidden rounded-full", clair ? "bg-encre/15" : "bg-white/25")}
              role="progressbar"
              aria-label={tx("progression.aria", { v: { pct: p.pct } })}
              aria-valuenow={p.pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={cn("h-full rounded-full", clair ? "bg-encre" : "bg-white")} style={{ width: `${p.pct}%` }} />
            </div>
          </div>
        )}

        {action && <div className="flex flex-wrap gap-2.5 pt-1">{action}</div>}
      </div>
    </header>
  );
}
