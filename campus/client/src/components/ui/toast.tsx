// Petits messages de confirmation (« Devoir rendu ! »), en bas de l'écran.
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; texte: string; ton: "succes" | "erreur" | "info" };
let suivant = 1;
const abonnes = new Set<(t: Toast[]) => void>();
let pile: Toast[] = [];

function diffuser() {
  for (const f of abonnes) f(pile);
}

export function toast(texte: string, ton: Toast["ton"] = "succes") {
  const t = { id: suivant++, texte, ton };
  pile = [...pile.slice(-2), t];
  diffuser();
  setTimeout(() => {
    pile = pile.filter((x) => x.id !== t.id);
    diffuser();
  }, ton === "erreur" ? 6000 : 3500);
}
export const toastErreur = (e: unknown) => toast(e instanceof Error ? e.message : String(e), "erreur");

export function Toasts() {
  const [liste, setListe] = useState<Toast[]>(pile);
  useEffect(() => {
    abonnes.add(setListe);
    return () => void abonnes.delete(setListe);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
      {liste.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-5 py-3.5 text-[15px] font-semibold shadow-carte animate-monte",
            t.ton === "succes" && "bg-encre text-white",
            t.ton === "erreur" && "bg-danger text-white",
            t.ton === "info" && "bg-orange text-encre",
          )}
        >
          {t.ton === "succes" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-orange" /> : t.ton === "erreur" ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <Info className="h-5 w-5 shrink-0" />}
          {t.texte}
        </div>
      ))}
    </div>
  );
}
