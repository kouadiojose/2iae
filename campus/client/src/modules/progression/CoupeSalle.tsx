// La Coupe sur l'écran de la salle de conférence (chantier C5), en grand et en
// mode nuit, lisible du fond de la salle : seulement sans cours et avant le
// cours, jamais pendant (placement du socle, PageSalle). « Coupe des campus :
// Yamoussoukro mène cette semaine », le rang du campus de la salle s'il est
// dans la moitié haute, sinon sa progression. Le dernier n'est jamais montré,
// aucun nom d'étudiant n'apparaît.
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { t } from "@shared/textes/progression";
import type { CoupeSalleDto } from "@shared/engagement/progression";
import { rangTexte } from "./donnees";

export function CoupeSalle({ siteId }: { siteId: number | null }) {
  const tx = useTextes(t);
  const { data } = useQuery<CoupeSalleDto>({
    queryKey: [`/api/coupe/salle${siteId ? `?site=${siteId}` : ""}`],
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
  if (!data) return null;
  const c = data.campus;
  const ligneCampus = !c
    ? null
    : c.bientot
      ? tx("salle.bientot", { v: { nom: c.nom } })
      : c.rang && c.nom !== data.meneur
        ? tx("salle.rang", { v: { nom: c.nom, rang: rangTexte(tx, c.rang) } })
        : c.progression
          ? tx("salle.progression", { v: { nom: c.nom, n: c.progression } })
          : c.nom === data.meneur
            ? null
            : tx("salle.relance", { v: { nom: c.nom } });
  return (
    // Compacte : avant le cours, l'écran de la salle tient dans la hauteur sans défiler ; sur un écran bas,
    // le podium et la consigne d'émargement (déjà donnée par le bloc du code) s'effacent.
    <section className="flex w-full shrink-0 flex-col gap-2 rounded-[20px] bg-[#242120] px-5 py-4 text-left" aria-label={tx("salle.titre")}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm uppercase tracking-[0.14em] text-orange-peche">
        <Trophy className="h-5 w-5 text-orange" aria-hidden />
        {tx("salle.titre")} · {tx("salle.semaine", { v: { n: data.numero } })}
        {data.essai && <span className="rounded-full bg-nuit-carte px-2.5 py-0.5 text-[12px] text-nuit-doux">{tx("coupe.essai")}</span>}
      </p>
      <p className="text-[clamp(22px,2.1vw,42px)] font-black leading-tight tracking-serre text-white">
        {data.meneur ? tx("salle.meneur", { v: { nom: data.meneur } }) : tx("salle.demarrage")}
      </p>
      {ligneCampus && <p className="text-[clamp(17px,1.4vw,28px)] font-bold leading-snug text-orange-peche">{ligneCampus}</p>}
      {data.podium.length > 1 && (
        <ol className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[clamp(15px,1.15vw,21px)] text-nuit-doux lg:[@media(max-height:800px)]:hidden">
          {data.podium.map((p) => (
            <li key={p.nom} className={cn(c?.nom === p.nom && "text-white")}>
              {rangTexte(tx, p.rang)} {p.nom}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[clamp(14px,1vw,19px)] text-nuit-gris lg:[@media(max-height:800px)]:hidden">{tx("salle.emarger")}</p>
    </section>
  );
}
