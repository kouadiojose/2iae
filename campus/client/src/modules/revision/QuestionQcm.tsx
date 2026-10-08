// Une question à choix multiple, corrigée et expliquée tout de suite : gros
// boutons au pouce, bonne réponse en vert, la mienne en rouge si elle est
// fausse. Partagée par la révision du jour, le quiz du cours complet et
// « Me faire réviser » (QuizRevision, ia/composants.tsx). Gardée ici, dans un
// petit fichier, pour que l'écran /reviser reste léger.
import { useEffect, useRef, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/revision";

export const lettre = (i: number) => String.fromCharCode(65 + i);

export function QuestionQcm({
  question,
  options,
  bonne,
  explication,
  choix,
  onChoisir,
  suite,
  sousCorrection,
  defiler,
}: {
  question: string;
  options: string[];
  /** Position (dans l'ordre affiché) de la bonne réponse. */
  bonne: number;
  explication?: string;
  /** Option choisie (ordre affiché), null tant que la personne n'a pas répondu. */
  choix: number | null;
  onChoisir: (i: number) => void;
  /** Bouton « Question suivante » sous la correction. */
  suite?: { libelle: string; onClick: () => void };
  /** Sous la correction (« Signaler une erreur »). */
  sousCorrection?: ReactNode;
  /** Sur un petit écran, amène la correction et le bouton suivant sous le pouce. */
  defiler?: boolean;
}) {
  const tx = useTextes(t);
  const repondu = choix !== null;
  const correction = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (defiler && repondu) correction.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [defiler, repondu]);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg font-extrabold leading-snug tracking-[-0.01em]">{question}</p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={tx("qcm.reponses")}>
        {options.map((o, i) => {
          const juste = i === bonne;
          const choisie = i === choix;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={choisie}
              disabled={repondu}
              onClick={() => onChoisir(i)}
              className={cn(
                "flex min-h-[52px] items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-left text-base font-semibold leading-snug transition-colors",
                !repondu && "border-ligne bg-white hover:border-orange hover:bg-orange-pale",
                repondu && juste && "border-succes bg-succes-clair text-encre",
                repondu && choisie && !juste && "border-danger bg-danger-clair text-encre",
                repondu && !juste && !choisie && "border-ligne bg-white text-texte-gris",
              )}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-creme font-mono text-xs text-texte-doux">{lettre(i)}</span>
              <span className="flex-1">{o}</span>
              {repondu && juste && <CheckCircle2 className="h-5 w-5 shrink-0 text-succes" aria-label="Bonne réponse" />}
              {repondu && choisie && !juste && <XCircle className="h-5 w-5 shrink-0 text-danger" aria-label="Mauvaise réponse" />}
            </button>
          );
        })}
      </div>
      {repondu && (
        <div ref={correction} className="flex animate-monte scroll-mb-4 flex-col gap-3">
          <div className={cn("rounded-2xl p-4 text-[15px] leading-relaxed", choix === bonne ? "bg-succes-clair text-encre" : "bg-creme text-texte-doux")} role="status">
            <p className="mb-1 font-extrabold text-encre">{choix === bonne ? tx("qcm.bonne") : tx("qcm.mauvaise", { v: { lettre: lettre(bonne) } })}</p>
            {explication}
          </div>
          {suite && (
            <Bouton pleineLargeur taille="lg" onClick={suite.onClick}>
              {suite.libelle}
            </Bouton>
          )}
          {sousCorrection}
        </div>
      )}
    </div>
  );
}
