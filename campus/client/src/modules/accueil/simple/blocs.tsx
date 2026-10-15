// Accueil du formateur en gros blocs (José, 14 octobre 2026 au soir : « le professeur se connecte et il veut voir de
// gros blocs. Il clique, 1, 2, il lit, c'est clair »). Briques communes à /enseigner (PageEnseigner) et
// /enseigner/mon-cours/:id (PageMonCours) : l'accueil simple, le repère d'un cours, son carré et le lien « Plus ».
// Les blocs d'un cours (« Commencer le live », « Mes documents », « Le mur du cours », « Vidéos et examens ») sont dans
// blocs-cours.tsx : ils ont remplacé les trois blocs du 14 octobre (« Le cours », « Entrer dans le live », « Préparer le
// cours ») le 15 octobre. « Des gros blocs, mais un peu de beauté » : le même carré en dégradé que l'espace du campus
// (components/ui/gros-blocs).
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, MonitorPlay } from "lucide-react";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { CarteCours, Pastille } from "@/components/ui/gros-blocs";
import { t as tEnseigner } from "@shared/textes/enseigner";
import type { AccueilSimpleDto, CarreFormateurDto } from "@shared/accueil-simple";

export const CLE_ACCUEIL_SIMPLE = "/api/enseigner/accueil-simple";

/** L'accueil simple, relu toutes les 60 s et aussitôt quand un live démarre ou finit. */
export function useAccueilSimple() {
  useTousEvenements((e) => {
    if (e.type === "live") void rafraichir(CLE_ACCUEIL_SIMPLE);
  });
  return useQuery<AccueilSimpleDto>({ queryKey: [CLE_ACCUEIL_SIMPLE], refetchInterval: 60_000, staleTime: 5_000 });
}

/** Le repère d'un cours, en mots : « En direct maintenant », « Aujourd'hui à 8h30 · 4h30 chez vous », « Jeudi à 8h30 ». */
export function useRepere() {
  const tx = useTextes(tEnseigner);
  return (c: CarreFormateurDto): string | null => {
    const chez = c.heureChezVous ? ` · ${tx("blocs.live.chezVous", { v: { heure: c.heureChezVous } })}` : "";
    switch (c.repere) {
      case "direct":
        return tx("blocs.live.direct");
      case "ouvert":
        return tx("blocs.live.ouvert", { v: { heure: c.heure ?? "" } });
      case "aujourdhui":
        return `${tx("blocs.live.aujourdhui", { v: { heure: c.heure ?? "" } })}${chez}`;
      case "jour":
        return `${tx("blocs.live.jour", { v: { jour: c.jour ?? "", heure: c.heure ?? "" } })}${chez}`;
      default:
        return null;
    }
  };
}

/** La pastille du repère d'un carré (en direct : point vivant ; ouvert : vert pâle ; sinon blanche avec l'heure). */
function PastilleCours({ c, texte }: { c: CarreFormateurDto; texte: string | null }) {
  if (!texte) return null;
  if (c.repere === "direct") return <Pastille ton="direct">{texte}</Pastille>;
  if (c.repere === "ouvert") return <Pastille ton="ouvert">{texte}</Pastille>;
  return (
    <Pastille ton="blanc" sansIcone>
      {texte}
    </Pastille>
  );
}

/** Un gros carré de cours (plusieurs cours : on choisit d'abord le cours). Le même que l'espace du campus. */
export function CarreCours({ c }: { c: CarreFormateurDto }) {
  const repere = useRepere()(c);
  const Icone = c.repere === "direct" || c.repere === "ouvert" ? MonitorPlay : c.repere === "aujourdhui" || c.repere === "jour" ? CalendarDays : BookOpen;
  return (
    <CarteCours
      href={`/enseigner/mon-cours/${c.coursId}`}
      couleur={c.couleur}
      code={c.code}
      titre={c.titre}
      repere={<PastilleCours c={c} texte={repere} />}
      icone={<Icone className="h-7 w-7" strokeWidth={2.25} />}
    />
  );
}

/** Le lien « Plus » (l'accueil détaillé d'avant), avec le nombre de choses à faire : une pilule crème de 56 px. */
export function LienPlus({ aFaire }: { aFaire: number }) {
  const tx = useTextes(tEnseigner);
  return (
    <Link
      href="/enseigner/plus"
      className="inline-flex min-h-[56px] items-center self-end rounded-full border-2 border-ligne bg-creme px-6 text-[20px] font-bold text-orange-profond no-underline shadow-carte transition-[border-color,box-shadow] duration-150 hover:border-orange/60 hover:text-orange-profond hover:shadow-survol"
      data-lien-plus
    >
      {aFaire === 0 ? tx("blocs.plus") : aFaire === 1 ? tx("blocs.plus.un") : tx("blocs.plus.n", { v: { n: aFaire } })}
    </Link>
  );
}
