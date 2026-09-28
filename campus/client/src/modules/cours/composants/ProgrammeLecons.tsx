// Chapitres et leçons d'un cours, côté lecture : coche « terminée », numéro,
// durée, et repère « Tu en es là » sur la leçon où reprendre.
import { Link } from "wouter";
import { Check, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import { TYPES_LECON_INFOS, dureeLecon } from "../outils";
import type { ChapitreDuCours } from "@shared/schema";

export function ProgrammeLecons({
  coursId,
  chapitres,
  reprendreId,
  etudiant,
}: {
  coursId: number;
  chapitres: ChapitreDuCours[];
  reprendreId: number | null;
  etudiant: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {chapitres.map((ch) => {
        const publiees = ch.lecons.filter((l) => l.publiee);
        const faites = publiees.filter((l) => l.terminee).length;
        return (
          <section key={ch.id} aria-labelledby={`chapitre-${ch.id}`}>
            <div className="mb-2 flex items-end justify-between gap-3 px-1">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">Chapitre {ch.numero}</span>
                <h2 id={`chapitre-${ch.id}`} className="text-xl font-extrabold leading-tight">
                  {ch.titre}
                </h2>
              </div>
              {etudiant && publiees.length > 0 && (
                <span className="shrink-0 font-mono text-xs text-texte-gris">
                  {faites}/{publiees.length}
                </span>
              )}
            </div>
            <ol className="flex flex-col overflow-hidden rounded-2xl border border-ligne bg-white">
              {ch.lecons.map((l, i) => {
                const Icone = TYPES_LECON_INFOS[l.type].icone;
                const ici = l.id === reprendreId;
                const duree = dureeLecon(l.dureeMinutes);
                return (
                  <li key={l.id} className={cn(i > 0 && "border-t border-ligne-douce")}>
                    <Link
                      href={`/cours/${coursId}/lecons/${l.id}`}
                      className={cn(
                        "flex min-h-[64px] items-center gap-3.5 px-4 py-3 text-encre no-underline transition-colors hover:bg-creme hover:text-encre",
                        ici && "bg-orange-pale shadow-[inset_4px_0_0_#E4793A]",
                      )}
                    >
                      {!l.publiee ? (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-ligne-forte text-texte-gris" aria-label="Brouillon">
                          <PenLine className="h-3.5 w-3.5" />
                        </span>
                      ) : l.terminee ? (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-succes text-white" aria-label="Terminée">
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </span>
                      ) : (
                        <span
                          className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[11px]", ici ? "border-orange bg-white text-orange-fonce" : "border-ligne-forte text-texte-gris")}
                          aria-label="À faire"
                        >
                          {l.numero.split(".")[1]}
                        </span>
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-base font-semibold leading-snug">{l.titre}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-texte-gris">
                          {l.numero && <span className="font-mono">Leçon {l.numero}</span>}
                          <span className="inline-flex items-center gap-1">
                            <Icone className="h-3.5 w-3.5" aria-hidden />
                            {TYPES_LECON_INFOS[l.type].libelle}
                          </span>
                          {duree && <span>· {duree}</span>}
                          {!l.publiee && <Badge ton="gris">Brouillon</Badge>}
                        </span>
                      </span>
                      {ici && <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-wider text-orange-fonce sm:inline">Tu en es là</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
