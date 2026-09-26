// Le showreel d'un formateur, prêt à poser sur sa fiche publique
// (/formateurs/:slug) : <ShowreelFormateur slug={slug} />. N'affiche rien tant
// que la présentation n'est pas publiée. 16:9 sur un écran large ; sur
// téléphone, 9:16 comme une « story », avec un lien vers le plein écran.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShowreelPublicDto } from "@shared/schema";
import { Showreel } from "./Showreel";

export function ShowreelFormateur({ slug, className }: { slug: string; className?: string }) {
  const q = useQuery<ShowreelPublicDto>({ queryKey: ["/api/public/presentations", slug], staleTime: 60_000, retry: false });
  const boite = useRef<HTMLDivElement>(null);
  const [etroit, setEtroit] = useState(false);
  useEffect(() => {
    const el = boite.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(([e]) => setEtroit(e.contentRect.width < 560));
    obs.observe(el);
    return () => obs.disconnect();
  }, [q.data]);
  const d = q.data;
  if (!d) return null;
  const pleinEcran = new URL(d.urlPage).pathname;
  return (
    <div ref={boite} className={cn("flex flex-col gap-2", className)}>
      <div className={cn("relative overflow-hidden rounded-[24px] bg-encre", etroit && "h-[min(78dvh,calc(100vw*16/9))] max-h-[720px]")}>
        <Showreel scenes={d.scenes} formateur={d.formateur} format={etroit ? "portrait" : "paysage"} plein={etroit} autoplay />
      </div>
      <Link href={pleinEcran} className="inline-flex min-h-[40px] items-center gap-2 self-start font-mono text-xs uppercase tracking-[0.12em] text-texte-gris no-underline hover:text-encre">
        <Maximize2 className="h-3.5 w-3.5" /> Plein écran · partager
      </Link>
    </div>
  );
}
