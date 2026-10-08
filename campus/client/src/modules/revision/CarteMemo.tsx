// Fiche à retourner : la question au recto, la réponse au verso. Partagée par
// les fiches mémo du cours complet (CarteRetournable) et la révision du jour
// (CarteMemo : une fois retournée, « Je savais » ou « À revoir »).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/revision";

export function CarteRetournable({
  recto,
  verso,
  retournee,
  onRetourner,
  etiquette,
  grande,
}: {
  recto: string;
  verso: string;
  retournee: boolean;
  onRetourner: () => void;
  /** Au recto, au-dessus de la question (« Fiche 3 »). */
  etiquette: string;
  /** Révision du jour : une seule carte à l'écran, en grand. */
  grande?: boolean;
}) {
  const tx = useTextes(t);
  return (
    <button
      type="button"
      onClick={onRetourner}
      className={cn(
        "flex w-full flex-col justify-center gap-1 rounded-2xl border p-4 text-left transition-colors",
        grande ? "min-h-52 gap-3 p-6" : "min-h-28",
        retournee ? "border-succes bg-succes-clair" : "border-ligne bg-white hover:border-orange",
      )}
      aria-pressed={retournee}
    >
      <span className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">{retournee ? tx("fiche.reponse") : etiquette}</span>
      <span className={cn("leading-snug", grande ? "text-xl" : "text-[16px]", retournee ? "text-encre" : "font-bold")}>{retournee ? verso : recto}</span>
      {grande && !retournee && <span className="text-sm text-texte-pale">{tx("fiche.toucher")}</span>}
    </button>
  );
}

/** Fiche de révision : on la retourne, puis on dit honnêtement si on savait. */
export function CarteMemo({
  recto,
  verso,
  etiquette,
  retournee,
  onRetourner,
  onRepondre,
  grande = true,
  pied,
}: {
  recto: string;
  verso: string;
  etiquette: string;
  retournee: boolean;
  onRetourner: () => void;
  onRepondre: (savait: boolean) => void;
  grande?: boolean;
  /** Sous les boutons (« Signaler une erreur »). */
  pied?: ReactNode;
}) {
  const tx = useTextes(t);
  return (
    <div className="flex flex-col gap-3">
      <CarteRetournable recto={recto} verso={verso} etiquette={etiquette} retournee={retournee} onRetourner={onRetourner} grande={grande} />
      {retournee && (
        <div className="grid animate-monte grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onRepondre(false)}
            className="min-h-[52px] rounded-2xl border-[1.5px] border-ligne bg-white px-3 text-base font-bold text-encre hover:border-orange hover:bg-orange-pale"
          >
            {tx("fiche.arevoir")}
          </button>
          <button type="button" onClick={() => onRepondre(true)} className="min-h-[52px] rounded-2xl bg-succes px-3 text-base font-bold text-white hover:bg-encre">
            {tx("fiche.savais")}
          </button>
        </div>
      )}
      {pied}
    </div>
  );
}
