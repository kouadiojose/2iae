import { useEffect, useState } from "react";
import { decompte } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { cn } from "@/lib/utils";

/** Horloge (heure du serveur) qui avance chaque seconde (ou minute). */
export function useMaintenant(intervalleMs = 1000) {
  const [t, setT] = useState(() => maintenantServeur());
  useEffect(() => {
    const id = setInterval(() => setT(maintenantServeur()), intervalleMs);
    return () => clearInterval(id);
  }, [intervalleMs]);
  return t;
}

/** Compte à rebours en quatre cases (jours · heures · min · sec), comme la maquette. */
export function CompteARebours({ cible, nuit = true, className }: { cible: string | Date; nuit?: boolean; className?: string }) {
  const maintenant = useMaintenant(1000);
  const d = decompte(cible, maintenant);
  const p = (n: number) => String(n).padStart(2, "0");
  const cases = [
    { v: p(d.jours), l: "jours" },
    { v: p(d.heures), l: "heures" },
    { v: p(d.minutes), l: "min" },
    { v: p(d.secondes), l: "sec" },
  ];
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)} aria-label="Compte à rebours">
      {cases.map((c) => (
        <div key={c.l} className={cn("rounded-[14px] px-2 py-3 text-center", nuit ? "bg-[#242120]" : "bg-creme")}>
          <div className="text-[30px] font-extrabold tabular-nums leading-none">{c.v}</div>
          <div className={cn("mt-1.5 font-mono text-[10px] uppercase tracking-wider", nuit ? "text-nuit-gris" : "text-texte-gris")}>{c.l}</div>
        </div>
      ))}
    </div>
  );
}

/** Version texte courte : « 2 j 4 h 05 min ». */
export function DecompteCourt({ cible }: { cible: string | Date }) {
  const maintenant = useMaintenant(30_000);
  const d = decompte(cible, maintenant);
  if (d.total <= 0) return <>maintenant</>;
  if (d.jours) return <>{`${d.jours} j ${d.heures} h ${String(d.minutes).padStart(2, "0")} min`}</>;
  if (d.heures) return <>{`${d.heures} h ${String(d.minutes).padStart(2, "0")} min`}</>;
  return <>{`${d.minutes} min`}</>;
}
