// Studio, onglet Sondages (chantier C6) : « Questions de rappel prêtes » —
// 3 questions tirées du quiz du cours complet de la séance précédente du même
// cours, préparées chaque soir par l'IA. Le formateur les relit et décide de
// les lancer (sondage dans les cinq salles, résultats par campus) : rien ne
// part tout seul, et il n'a rien à préparer.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, History, Play } from "lucide-react";
import { post } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import { toast, toastErreur } from "@/components/ui/toast";
import { formaterDate } from "@shared/textes";
import { t } from "@shared/textes/direct";
import type { QuestionRappelDto, QuestionsRappelDto } from "@shared/engagement/direct";
import type { EtatDirectDto } from "@shared/schema";

const LETTRES = ["A", "B", "C", "D", "E"];
export const cleQuestionsRappel = (seanceId: number) => [`/api/seances/${seanceId}/questions-rappel`];

export function QuestionsRappel({ seanceId, etat, onLancee }: { seanceId: number; etat: EtatDirectDto; onLancee: () => void }) {
  const tx = useTextes(t);
  const { data } = useQuery<QuestionsRappelDto>({ queryKey: cleQuestionsRappel(seanceId), staleTime: 5 * 60_000, retry: false });
  const [envoi, setEnvoi] = useState<number | null>(null);
  if (!data?.source || !data.questions.length) return null;
  const enDirect = etat.statut === "en_direct";
  const lancer = async (q: QuestionRappelDto, i: number) => {
    setEnvoi(i);
    try {
      await post(`/api/seances/${seanceId}/sondages`, {
        question: q.question,
        options: q.options,
        bonneReponse: q.bonneReponse,
        explication: q.explication || null,
        parIa: true,
        lancer: enDirect,
      });
      toast(enDirect ? tx("rappelQ.ok") : tx("rappelQ.prepare"));
      await queryClient.invalidateQueries({ queryKey: cleQuestionsRappel(seanceId) });
      onLancee();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };
  return (
    <section className="flex flex-col gap-3 rounded-[16px] border border-orange/40 bg-nuit-bulle p-4">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-orange-peche">
          <History className="h-3.5 w-3.5" /> {tx("rappelQ.titre", { v: { date: formaterDate(data.source.debut, { style: "jour" }) } })}
        </span>
        <span className="text-[12px] text-nuit-gris">{tx("rappelQ.ia")}</span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {data.questions.map((q, i) => (
          <li key={i} className={cn("flex flex-col gap-2 rounded-xl bg-nuit-carte p-3", q.dejaLancee && "opacity-70")}>
            <p className="text-[14px] font-bold leading-snug">{q.question}</p>
            <ul className="flex flex-col gap-0.5 text-[13px] text-nuit-doux">
              {q.options.map((o, j) => (
                <li key={j} className={cn("flex items-baseline gap-1.5", j === q.bonneReponse && "font-semibold text-[#6FCF97]")}>
                  <span className="font-mono text-[11px]">{LETTRES[j]}</span> {o} {j === q.bonneReponse && <Check className="h-3.5 w-3.5 shrink-0 self-center" aria-label="bonne réponse" />}
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              {q.dejaLancee ? (
                <span className="flex min-h-9 items-center gap-1 font-mono text-[12px] text-nuit-gris">
                  <Check className="h-3.5 w-3.5" /> {tx("rappelQ.lancee")}
                </span>
              ) : (
                <Bouton variante={enDirect ? "nuit-actif" : "nuit"} taille="sm" icone={<Play className="h-3.5 w-3.5" />} chargement={envoi === i} disabled={envoi !== null} onClick={() => void lancer(q, i)}>
                  {enDirect ? tx("rappelQ.lancer") : tx("rappelQ.preparer")}
                </Bouton>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
