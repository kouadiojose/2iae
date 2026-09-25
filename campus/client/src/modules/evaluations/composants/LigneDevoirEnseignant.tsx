// Ligne d'un devoir côté formateur / équipe : échéance (Abidjan et Paris),
// compteurs de copies et accès direct à la correction.
import { PenLine, ListChecks, FileText } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Badge } from "@/components/ui/divers";
import { heureDouble, jourLong } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DevoirEnseignantResume } from "@shared/schema";

export function LigneDevoirEnseignant({ d, maintenant, compact }: { d: DevoirEnseignantResume; maintenant: number; compact?: boolean }) {
  const c = d.compteurs;
  const quiz = d.type === "quiz";
  const passe = new Date(d.dateLimite).getTime() < maintenant;
  const aCorriger = !quiz && c.aCorriger > 0;
  return (
    <article className={cn("flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5", aCorriger ? "border-orange/60" : "border-ligne")}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-orange-fonce">{d.coursCode}</span>
          <Badge ton={quiz ? "encre" : "gris"} className="py-0.5">
            {quiz ? <ListChecks className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            {quiz ? "Interrogation" : "Devoir"}
          </Badge>
          {!d.publie && <Badge ton="alerte" className="py-0.5">Brouillon, non publié</Badge>}
        </div>
        <h3 className="text-[17px] font-bold leading-snug">{d.titre}</h3>
        <p className={cn("text-sm", passe ? "text-texte-gris" : "text-texte-pale")}>
          {passe ? "Clos depuis le" : "À rendre avant le"} {jourLong(d.dateLimite)} · {heureDouble(d.dateLimite)}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <Badge ton="gris">
            {c.rendus}/{c.inscrits} {quiz ? "terminées" : "rendues"}
          </Badge>
          {c.enRetard > 0 && <Badge ton="danger">{c.enRetard} en retard</Badge>}
          {aCorriger && <Badge ton="orange">{c.aCorriger} à corriger</Badge>}
          {!quiz && c.corrigees > 0 && <Badge ton="alerte">{c.corrigees} prête{c.corrigees > 1 ? "s" : ""} à publier</Badge>}
          {!quiz && c.publiees > 0 && <Badge ton="succes">{c.publiees} publiée{c.publiees > 1 ? "s" : ""}</Badge>}
        </div>
      </div>
      <div className={cn("flex shrink-0 gap-2", compact ? "" : "sm:flex-col")}>
        <LienBouton href={`/enseigner/devoirs/${d.id}/copies`} variante={aCorriger || c.corrigees > 0 ? "principal" : "contour"} className="min-h-[48px] flex-1">
          {quiz ? "Résultats" : aCorriger ? "Corriger" : "Copies"}
        </LienBouton>
        {d.modifiable && (
          <LienBouton href={`/enseigner/devoirs/${d.id}`} variante="fantome" icone={<PenLine className="h-4 w-4" />} className="min-h-[48px] flex-1 border border-ligne">
            Modifier
          </LienBouton>
        )}
      </div>
    </article>
  );
}
