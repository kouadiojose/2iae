// Petites briques d'affichage de la visio et de la radio (mode nuit).
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Image d'une piste vidéo (toujours muette : le son passe par <Son>). */
export function Video({ piste, miroir, ajuster = "cover", className, libelle }: { piste: MediaStreamTrack | null; miroir?: boolean; ajuster?: "cover" | "contain"; className?: string; libelle?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = piste ? new MediaStream([piste]) : null;
    if (piste) void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [piste]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      aria-label={libelle}
      className={cn("h-full w-full bg-black", ajuster === "cover" ? "object-cover" : "object-contain", miroir && "-scale-x-100", className)}
    />
  );
}

/**
 * Son d'une piste distante. Les navigateurs bloquent parfois la lecture sans
 * geste de l'utilisateur (écran de salle allumé sans clic) : `onBloque`
 * permet d'afficher le bouton « Activer le son ».
 */
export function Son({ piste, onBloque }: { piste: MediaStreamTrack; onBloque?: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const bloque = useRef(onBloque);
  bloque.current = onBloque;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = new MediaStream([piste]);
    el.play().catch((e: Error) => {
      if (e.name === "NotAllowedError") bloque.current?.();
    });
    return () => {
      el.srcObject = null;
    };
  }, [piste]);
  return <audio ref={ref} autoPlay data-visio-son="" className="hidden" />;
}

/** Relance tous les sons d'une scène après un geste (bouton « Activer le son »). */
export function relancerSons(racine: HTMLElement | null) {
  racine?.querySelectorAll<HTMLAudioElement>("audio[data-visio-son]").forEach((a) => void a.play().catch(() => undefined));
}

export type TonPastille = "direct" | "attente" | "alerte" | "neutre";

/** Pastille d'état en haut de la scène : « ● En direct », « Connexion… », « Reconnexion… ». */
export function Pastille({ ton, children, className }: { ton: TonPastille; children: ReactNode; className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider backdrop-blur",
        ton === "direct" && "bg-[#2A1510]/90 text-[#FF8A6B]",
        ton === "attente" && "bg-black/60 text-nuit-doux",
        ton === "alerte" && "bg-orange text-encre",
        ton === "neutre" && "bg-black/60 text-white",
        className,
      )}
    >
      {ton === "direct" ? (
        <span className="point-direct" />
      ) : ton === "attente" ? (
        <span className="inline-block h-2 w-2 animate-direct rounded-full bg-nuit-gris" />
      ) : ton === "alerte" ? (
        <span className="inline-block h-2 w-2 animate-direct rounded-full bg-encre" />
      ) : null}
      {children}
    </span>
  );
}

/** Étiquette posée sur une image (« Yopougon », « Vous »). */
export function Etiquette({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("rounded-lg bg-black/70 px-2 py-1 text-[13px] font-bold text-white", className)}>{children}</span>;
}
