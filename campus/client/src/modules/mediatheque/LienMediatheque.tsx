// Carte « Médiathèque » de l'accueil étudiant : revoir les cours en vidéo et
// ouvrir leurs PDF.
import { ChevronRight, MonitorPlay } from "lucide-react";
import { CarteLien } from "@/components/ui/carte";

export function LienMediatheque() {
  return (
    <CarteLien href="/mediatheque" className="flex items-center gap-3.5 bg-creme px-4 py-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange text-encre">
        <MonitorPlay className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-extrabold">Médiathèque des cours</span>
        <span className="text-sm text-texte-pale">Les enregistrements des lives et les PDF des cours, à revoir quand tu veux.</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
    </CarteLien>
  );
}
