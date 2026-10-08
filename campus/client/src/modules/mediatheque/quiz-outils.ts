// Quiz du cours complet : un vrai mélange (Fisher-Yates) des questions et des
// réponses, et le lien de chaque question affichée avec sa carte de révision.
// La routine du soir range souvent la bonne réponse au même endroit : les
// options sont donc mélangées dès la première série ; « Recommencer le quiz »
// mélange aussi l'ordre des questions.
import { aleaDepuis, ordreMelange } from "@shared/engagement/revision";
import type { DossierCours } from "@shared/schema/ext-etudes";
import type { QuestionRevision } from "@shared/schema/ext-ia";

/** Une question telle qu'affichée : options dans le nouvel ordre, et d'où elle vient. */
export type QuestionMelangee = QuestionRevision & {
  /** Rang de la question dans le dossier (carte de révision correspondante). */
  position: number;
  /** Index d'origine de chaque option affichée. */
  ordre: number[];
};

/** Série n du quiz, reproductible avec la même graine (même ordre en revenant sur la page le même jour). */
export function serieMelangee(quiz: DossierCours["quiz"], graine: string, serie: number): QuestionMelangee[] {
  const alea = aleaDepuis(`${graine}|${serie}`);
  const positions = serie ? ordreMelange(quiz.length, alea) : quiz.map((_, i) => i);
  return positions.map((position) => {
    const q = quiz[position];
    const ordre = ordreMelange(q.options.length, alea);
    return {
      question: q.question,
      options: ordre.map((i) => q.options[i]),
      bonneReponse: ordre.indexOf(q.bonneReponse),
      explication: q.explication,
      position,
      ordre,
    };
  });
}
