// Le showreel d'un formateur, prêt à poser sur sa fiche publique
// (/formateurs/:slug) : <ShowreelFormateur slug={slug} />, et la vitrine des
// présentations de l'accueil : <ShowreelsAccueil />, qui enchaîne les
// formateurs l'un après l'autre sans s'arrêter. Rien ne s'affiche tant
// qu'aucune présentation n'est publiée. 16:9 sur un écran large ; sur
// téléphone, 9:16 comme une « story », avec un lien vers le plein écran.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShowreelPublicDto } from "@shared/schema";
import { Showreel } from "./Showreel";

/** Le lecteur dans son cadre : paysage, ou portrait quand la place manque. */
function CadreShowreel({ d, className, pied, onFin, boucle }: { d: ShowreelPublicDto; className?: string; pied?: ReactNode; onFin?: () => void; boucle?: boolean }) {
  const boite = useRef<HTMLDivElement>(null);
  const [etroit, setEtroit] = useState(false);
  useEffect(() => {
    const el = boite.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(([e]) => setEtroit(e.contentRect.width < 560));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const pleinEcran = new URL(d.urlPage).pathname;
  return (
    <div ref={boite} className={cn("flex flex-col gap-2", className)}>
      <div className={cn("relative overflow-hidden rounded-[24px] bg-encre", etroit && "h-[min(78dvh,calc(100vw*16/9))] max-h-[720px]")}>
        {/* key : changer de formateur relance la présentation depuis le début. */}
        <Showreel key={d.slug} scenes={d.scenes} formateur={d.formateur} format={etroit ? "portrait" : "paysage"} plein={etroit} autoplay onFin={onFin} boucle={boucle} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={pleinEcran} className="inline-flex min-h-[40px] items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-texte-gris no-underline hover:text-encre">
          <Maximize2 className="h-3.5 w-3.5" /> Plein écran · partager
        </Link>
        {pied}
      </div>
    </div>
  );
}

export function ShowreelFormateur({ slug, className }: { slug: string; className?: string }) {
  const q = useQuery<ShowreelPublicDto>({ queryKey: ["/api/public/presentations", slug], staleTime: 60_000, retry: false });
  if (!q.data) return null;
  return <CadreShowreel d={q.data} className={className} />;
}

/**
 * Accueil du site public : les présentations en ligne, une à la fois, avec le
 * nom de chaque formateur pour passer de l'une à l'autre.
 */
export function ShowreelsAccueil({ className, entete }: { className?: string; entete?: ReactNode }) {
  const q = useQuery<ShowreelPublicDto[]>({ queryKey: ["/api/public/presentations"], staleTime: 60_000, retry: false });
  const [choisi, setChoisi] = useState(0);
  const liste = q.data ?? [];
  if (!liste.length) return null;
  const d = liste[Math.min(choisi, liste.length - 1)];
  const nom = `${d.formateur.prenom} ${d.formateur.nom}`;
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {entete}
      {liste.length > 1 && (
        <div role="tablist" aria-label="Choisir un formateur" className="flex flex-wrap gap-2">
          {liste.map((x, i) => (
            <button
              key={x.slug}
              type="button"
              role="tab"
              aria-selected={i === choisi}
              onClick={() => setChoisi(i)}
              className={cn(
                "min-h-[40px] rounded-full border px-4 text-sm font-semibold transition-colors",
                i === choisi ? "border-encre bg-encre text-white" : "border-ligne bg-white text-encre hover:border-encre",
              )}
            >
              {x.formateur.prenom} {x.formateur.nom}
            </button>
          ))}
        </div>
      )}
      <CadreShowreel
        d={d}
        className="w-full"
        // Enchaînement : à la fin d'une présentation, la suivante démarre (puis retour à la première).
        onFin={liste.length > 1 ? () => setChoisi((i) => (Math.min(i, liste.length - 1) + 1) % liste.length) : undefined}
        boucle={liste.length === 1}
        pied={
          d.urlFiche ? (
            <Link href={new URL(d.urlFiche).pathname} className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold no-underline">
              La fiche de {nom} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null
        }
      />
    </div>
  );
}
