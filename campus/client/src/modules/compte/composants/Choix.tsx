// Grandes cartes de choix (une seule réponse), faciles à toucher du pouce :
// « Comment suis-tu les cours ? », « Ton forfait internet ».
import type { ReactNode } from "react";
import { Check, Laptop, Presentation, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreferencesUtilisateur } from "@shared/schema";

export type ModeSuivi = NonNullable<PreferencesUtilisateur["modeSuivi"]>;

export const OPTIONS_SUIVI: { valeur: ModeSuivi; titre: string; detail: string; icone: ReactNode }[] = [
  { valeur: "salle", titre: "Dans la salle de conférence", detail: "Je viens au campus : mon téléphone sert à voter et à poser mes questions.", icone: <Presentation className="h-6 w-6" /> },
  { valeur: "telephone", titre: "Sur mon téléphone", detail: "Je suis les lives depuis chez moi ou en déplacement.", icone: <Smartphone className="h-6 w-6" /> },
  { valeur: "ordinateur", titre: "Sur un ordinateur", detail: "J'ai un ordinateur avec une bonne connexion.", icone: <Laptop className="h-6 w-6" /> },
];

export function CarteChoix({
  choisie,
  onChoisir,
  titre,
  detail,
  icone,
  compacte,
}: {
  choisie: boolean;
  onChoisir: () => void;
  titre: ReactNode;
  detail?: ReactNode;
  icone?: ReactNode;
  compacte?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={choisie}
      onClick={onChoisir}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl border-2 text-left transition-colors",
        compacte ? "min-h-[56px] px-3.5 py-2.5" : "min-h-[72px] px-4 py-3.5",
        choisie ? "border-orange bg-orange-pale" : "border-ligne bg-white hover:border-orange-peche",
      )}
    >
      {icone && (
        <span className={cn("grid shrink-0 place-items-center rounded-xl", compacte ? "h-10 w-10" : "h-12 w-12", choisie ? "bg-orange text-encre" : "bg-creme text-texte-doux")}>
          {icone}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] font-extrabold leading-tight text-encre">{titre}</span>
        {detail && <span className="mt-0.5 text-[14px] leading-snug text-texte-pale">{detail}</span>}
      </span>
      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", choisie ? "border-orange bg-orange text-encre" : "border-ligne-forte")}>
        {choisie && <Check className="h-4 w-4" strokeWidth={3} />}
      </span>
    </button>
  );
}

/** Groupe de cartes à choix unique, avec un titre lu par les lecteurs d'écran. */
export function GroupeChoix({ libelle, children, className }: { libelle: string; children: ReactNode; className?: string }) {
  return (
    <div role="radiogroup" aria-label={libelle} className={cn("flex flex-col gap-2.5", className)}>
      {children}
    </div>
  );
}
