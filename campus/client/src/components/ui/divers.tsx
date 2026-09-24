import type { ReactNode } from "react";
import { cn, initiales } from "@/lib/utils";

const TONS = {
  orange: "bg-orange-clair text-orange-profond",
  encre: "bg-encre text-white",
  gris: "bg-creme text-texte-pale",
  succes: "bg-succes-clair text-succes",
  alerte: "bg-alerte-clair text-alerte",
  danger: "bg-danger-clair text-danger",
  direct: "bg-[#2A1510] text-[#FF8A6B]",
  nuit: "bg-nuit-carte text-nuit-doux",
} as const;
export type Ton = keyof typeof TONS;

/** Pastille mono arrondie (« 348 inscrits », « En retard »…). */
export function Badge({ ton = "orange", children, className }: { ton?: Ton; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-xs", TONS[ton], className)}>{children}</span>;
}

/** Badge « EN DIRECT » avec point rouge pulsant. */
export function BadgeDirect({ libelle = "En direct", className }: { libelle?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full bg-[#2A1510] px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-[#FF8A6B]", className)}>
      <span className="point-direct" />
      {libelle}
    </span>
  );
}

export function Avatar({
  prenom,
  nom,
  photo,
  taille = 40,
  className,
}: {
  prenom?: string | null;
  nom?: string | null;
  photo?: string | null;
  taille?: number;
  className?: string;
}) {
  const style = { width: taille, height: taille, fontSize: Math.max(11, Math.round(taille * 0.36)) };
  if (photo) return <img src={photo} alt="" style={style} className={cn("shrink-0 rounded-full object-cover", className)} loading="lazy" />;
  return (
    <span style={style} className={cn("grid shrink-0 place-items-center rounded-full bg-orange font-extrabold text-encre", className)}>
      {initiales(prenom, nom)}
    </span>
  );
}

export function BarreProgression({ valeur, className, ton = "orange" }: { valeur: number; className?: string; ton?: "orange" | "succes" | "nuit" }) {
  const v = Math.max(0, Math.min(100, Math.round(valeur)));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full", ton === "nuit" ? "bg-nuit-ligne" : "bg-[#F3EAE2]", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width]", ton === "succes" ? "bg-succes" : "bg-orange")} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Squelette({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-creme", className)} />;
}

/** Liste de squelettes pendant un chargement. */
export function Chargement({ lignes = 3, className }: { lignes?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lignes }, (_, i) => (
        <Squelette key={i} className="h-20" />
      ))}
    </div>
  );
}

/** État vide pédagogique : dit ce qui se passera et quoi faire. */
export function EtatVide({
  icone,
  titre,
  texte,
  action,
  className,
  nuit,
}: {
  icone?: ReactNode;
  titre: ReactNode;
  texte?: ReactNode;
  action?: ReactNode;
  className?: string;
  nuit?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center", nuit ? "border-nuit-bord text-nuit-doux" : "border-ligne", className)}>
      {icone && <div className={cn("grid h-12 w-12 place-items-center rounded-full", nuit ? "bg-nuit-carte text-orange" : "bg-orange-clair text-orange-fonce")}>{icone}</div>}
      <p className={cn("text-lg font-extrabold", nuit ? "text-white" : "text-encre")}>{titre}</p>
      {texte && <p className={cn("max-w-md text-[15px] leading-relaxed", nuit ? "text-nuit-doux" : "text-texte-pale")}>{texte}</p>}
      {action}
    </div>
  );
}

/** Pastille de date de la maquette (« 02 / OCT »). */
export function PastilleDate({ jour, mois, className, ton = "creme" }: { jour: string; mois: string; className?: string; ton?: "creme" | "orange" | "encre" }) {
  return (
    <div
      className={cn(
        "w-14 shrink-0 rounded-xl py-2 text-center",
        ton === "creme" && "bg-creme",
        ton === "orange" && "bg-orange text-encre",
        ton === "encre" && "bg-encre text-white",
        className,
      )}
    >
      <div className="text-xl font-extrabold leading-none">{jour}</div>
      <div className={cn("mt-1 font-mono text-[10px]", ton === "creme" ? "text-texte-gris" : "opacity-80")}>{mois}</div>
    </div>
  );
}

/** Message d'erreur en ligne, avec bouton réessayer. */
export function Erreur({ message, reessayer, className }: { message: string; reessayer?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger-clair px-5 py-4 text-[15px] text-danger", className)} role="alert">
      <span className="font-semibold">{message}</span>
      {reessayer && (
        <button onClick={reessayer} className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-danger hover:bg-danger hover:text-white">
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Grand chiffre de tableau de bord (vie scolaire). */
export function Chiffre({ valeur, libelle, detail, ton = "encre" }: { valeur: ReactNode; libelle: string; detail?: ReactNode; ton?: "encre" | "orange" | "danger" | "succes" }) {
  return (
    <div className="rounded-2xl border border-ligne bg-white p-5">
      <div className="font-mono text-xs uppercase tracking-wider text-texte-gris">{libelle}</div>
      <div
        className={cn(
          "mt-2 text-4xl font-black tabular-nums tracking-serre",
          ton === "orange" && "text-orange-fonce",
          ton === "danger" && "text-danger",
          ton === "succes" && "text-succes",
        )}
      >
        {valeur}
      </div>
      {detail && <div className="mt-1 text-sm text-texte-pale">{detail}</div>}
    </div>
  );
}
