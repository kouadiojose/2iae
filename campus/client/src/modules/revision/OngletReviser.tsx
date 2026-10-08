// Onglet « Réviser » de la page d'un cours : ses cours complets prêts, du plus
// récent au plus ancien. L'étudiant voit ce qu'il a à revoir et son meilleur
// score au quiz, et révise une séance en 5 minutes ; le formateur ouvre le cours
// complet (la révision de sa classe y est en tête).
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenCheck, Layers } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Chargement, EtatVide } from "@/components/ui/divers";
import { dateCourte } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/revision";
import type { CoursCompletARevise } from "@shared/engagement/revision";

/** Clé de la liste, partagée avec la page du cours (onglet ouvert par défaut). */
export const cleCoursComplets = (coursId: number) => [`/api/revision/cours/${coursId}`];

export function OngletReviser({ coursId, etudiant }: { coursId: number; etudiant: boolean }) {
  const tx = useTextes(t);
  const { data, isLoading } = useQuery<CoursCompletARevise[]>({ queryKey: cleCoursComplets(coursId), staleTime: 60_000 });
  const retour = encodeURIComponent(`/cours/${coursId}?onglet=reviser`);
  if (isLoading) return <Chargement lignes={3} />;
  if (!data?.length) return <EtatVide icone={<BookOpenCheck className="h-6 w-6" />} titre={tx("cours.onglet")} texte={tx("cours.vide")} />;
  return (
    <div className="flex flex-col gap-3">
      {etudiant && (
        <LienBouton href={`/reviser?depuis=${retour}`} taille="lg" icone={<Layers className="h-5 w-5" />} className="min-h-[56px] w-full sm:w-auto sm:self-start">
          {tx("cours.jour")}
        </LienBouton>
      )}
      <ul className="flex flex-col divide-y divide-ligne-douce rounded-2xl border border-ligne bg-white">
        {data.map((c) => {
          const details = [
            tx("cours.cartes", { v: { n: c.cartes } }),
            c.aRevoir ? tx("cours.aRevoir", { v: { n: c.aRevoir } }) : null,
            c.quiz ? tx("cours.quiz", { v: { meilleur: c.quiz.meilleur, total: c.quiz.total } }) : etudiant && c.ouvert === false ? tx("cours.nouveau") : null,
          ].filter(Boolean);
          return (
            <li key={c.seanceId} className="flex items-center gap-2 py-1 pl-4 pr-2">
              <Link href={`/mediatheque/cours/${c.seanceId}?depuis=cours`} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2 text-encre no-underline hover:text-orange-fonce">
                <span className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">{dateCourte(c.debut)}</span>
                <span className="line-clamp-2 font-bold leading-snug">{c.titre}</span>
                <span className="text-sm text-texte-pale">{details.join(" · ")}</span>
              </Link>
              {etudiant && c.cartes > 0 ? (
                <Link
                  href={`/reviser?seance=${c.seanceId}&depuis=${retour}`}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-orange text-encre no-underline hover:bg-encre hover:text-white"
                  aria-label={`${tx("cc.reviser")} : ${c.titre}`}
                >
                  <Layers className="h-5 w-5" aria-hidden />
                </Link>
              ) : (
                <ArrowRight className="mr-2 h-4 w-4 shrink-0 text-texte-gris" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
