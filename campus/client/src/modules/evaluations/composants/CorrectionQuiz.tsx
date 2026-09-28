// Correction détaillée d'une interrogation (après l'échéance, si le formateur
// l'a permis) : ta réponse, la bonne, et pourquoi.
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import type { QuestionCorrigee } from "@shared/schema";
import { LETTRES, nombre } from "../outils";

export function CorrectionQuiz({ questions, vous }: { questions: QuestionCorrigee[]; vous?: boolean }) {
  const ta = vous ? "Réponse de l'étudiant" : "Ta réponse";
  return (
    <ol className="flex flex-col gap-4">
      {questions.map((q, i) => {
        const choisies = new Set((q.maReponse ?? []).map(Number));
        const bonnes = new Set(q.bonnesReponses.map(Number));
        return (
          <li key={q.id} className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[16px] font-bold leading-snug">
                <span className="mr-1.5 font-mono text-sm text-texte-gris">{i + 1}.</span>
                {q.enonce}
              </span>
              <Badge ton={q.juste ? "succes" : "danger"} className="shrink-0">
                {q.juste ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                {nombre(q.obtenu)}/{nombre(q.points)}
              </Badge>
            </div>
            {q.type === "reponse_courte" ? (
              <div className="flex flex-col gap-1 text-[15px]">
                <span>
                  <span className="text-texte-pale">{ta} : </span>
                  <strong className={q.juste ? "text-succes" : "text-danger"}>{String(q.maReponse?.[0] ?? "") || "(pas de réponse)"}</strong>
                </span>
                {!q.juste && (
                  <span>
                    <span className="text-texte-pale">Réponse attendue : </span>
                    <strong>{q.bonnesReponses.join(" ou ")}</strong>
                  </span>
                )}
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {q.options.map((o, j) => {
                  const bonne = bonnes.has(j);
                  const choisie = choisies.has(j);
                  return (
                    <li
                      key={j}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[15px]",
                        bonne ? "bg-succes-clair text-encre" : choisie ? "bg-danger-clair text-danger line-through" : "text-texte-pale",
                      )}
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current font-mono text-[11px]">{LETTRES[j]}</span>
                      <span className="flex-1">{o}</span>
                      {bonne && <Check className="h-4 w-4 shrink-0 text-succes" aria-label="Bonne réponse" />}
                      {choisie && <span className="shrink-0 font-mono text-[11px] no-underline">{vous ? "choisi" : "ton choix"}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {q.explication && <p className="rounded-xl bg-creme px-3 py-2 text-sm leading-relaxed text-texte-doux">{q.explication}</p>}
          </li>
        );
      })}
    </ol>
  );
}
