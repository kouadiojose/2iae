// Bandeau de la Coupe des campus et des classes, une ligne en tête de la
// colonne de droite de l'accueil étudiant (chantier C5) : « Coupe · semaine 41 :
// Azaguié mène, Yopougon 3e. Ta classe progresse de +12 points. » Il ouvre
// /coupe. Le rang de son campus n'apparaît que dans la moitié haute ; aucun
// nom d'étudiant. Emplacement posé par le socle (C0), sous une limite d'erreur.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, Trophy } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/progression";
import type { BandeauCoupeDto } from "@shared/engagement/progression";
import { rangTexte } from "./donnees";

export function BandeauCoupe() {
  const tx = useTextes(t);
  const { moi } = useMoi();
  const { data } = useQuery<BandeauCoupeDto>({ queryKey: ["/api/coupe?vue=bandeau"], enabled: moi?.role === "etudiant", staleTime: 5 * 60_000 });
  if (!data) return null;
  const morceaux: string[] = [];
  if (data.meneur) {
    morceaux.push(tx("bandeau.meneur", { v: { nom: data.meneur } }));
    if (data.monCampus?.rang && data.monCampus.nom !== data.meneur) morceaux.push(tx("bandeau.monCampus", { v: { nom: data.monCampus.nom, rang: rangTexte(tx, data.monCampus.rang) } }));
  }
  const phrase = morceaux.length ? `${morceaux.join(", ")}.` : tx("bandeau.demarrage");
  const classe = data.maClasse
    ? data.maClasse.progression !== null && data.maClasse.progression > 0
      ? tx("bandeau.classe.hausse", { v: { n: data.maClasse.progression } })
      : tx("bandeau.classe.relance")
    : null;
  return (
    <Link href="/coupe" className="flex items-center gap-3 rounded-2xl border border-ligne bg-white px-4 py-3 text-encre no-underline transition-colors hover:border-orange hover:text-encre">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-encre text-orange">
        <Trophy className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-[15px] leading-snug">
        <span className="font-extrabold">{tx("bandeau.coupe", { v: { n: data.numero } })}</span>
        {data.essai && <span className="ml-1.5 font-mono text-[11px] uppercase tracking-wider text-orange-fonce">{tx("coupe.essai")}</span>}
        <span className="text-texte-doux"> · {phrase}</span>
        {classe && <span className="text-texte-doux"> {classe}</span>}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
    </Link>
  );
}
