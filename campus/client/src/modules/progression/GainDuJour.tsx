// Ce que l'étudiant vient de gagner, affiché à la fin d'un acte : sortie d'un
// direct (C6), objectif du jour validé (C2), fin de révision (C1), reçu d'une
// copie. Points du jour, jour actif de la semaine, nouveau badge. Rempli par
// C5 ; chaque appelant l'enveloppe dans une LimiteSilencieuse. Rien ne
// s'affiche tant qu'il n'y a rien à fêter (aucun point aujourd'hui).
import { Link } from "wouter";
import { ChevronRight, Sparkles } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/progression";
import { useProgression } from "./donnees";

export type MomentGain = "live" | "objectif" | "revision" | "rendu";

export function GainDuJour(_props: { moment: MomentGain }) {
  const tx = useTextes(t);
  const { data } = useProgression({ toujours: true });
  if (!data) return null;
  const nouveau = data.badges.obtenus.find((b) => b.nouveau);
  if (data.points.aujourdhui <= 0 && !nouveau) return null;
  const n = data.semaine.joursActifs.length;
  const objectif = data.semaine.objectif;
  return (
    <Link
      href="/progression"
      className="flex items-center gap-3 rounded-2xl bg-orange-clair px-4 py-3 text-encre no-underline animate-monte hover:text-encre"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange text-encre">
        <Sparkles className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {data.points.aujourdhui > 0 && <span className="font-extrabold">{tx("gain.points", { v: { n: data.points.aujourdhui } })}</span>}
        <span className="text-sm text-texte-doux">{tx(n >= objectif ? "gain.semaine" : "gain.jour", { v: { n, objectif } })}</span>
        {nouveau && <span className="text-sm font-bold text-orange-profond">{tx("gain.badge", { v: { nom: tx(`badge.${nouveau.code}.nom`) } })}</span>}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-orange-fonce" aria-label={tx("gain.lien")} />
    </Link>
  );
}
