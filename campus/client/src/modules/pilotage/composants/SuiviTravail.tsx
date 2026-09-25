// Progression d'un travail long (import, fiches) : étape en cours, « 640 / 1 500 »,
// barre, et ce qui se passe si la connexion se coupe.
import { WifiOff } from "lucide-react";
import { LIBELLES_ETAPES_TRAVAIL } from "@shared/schema";
import { BarreProgression } from "@/components/ui/divers";
import type { EtatTravail } from "../outils";

/** Avancement global : les codes pèsent le plus lourd (70 %), puis l'enregistrement et les QR. */
function avancement(e: EtatTravail | null): number {
  const p = e?.progression;
  if (!p) return 2;
  const part = p.total > 0 ? p.faits / p.total : 0;
  switch (p.etape) {
    case "verification":
      return 3;
    case "codes":
      return 5 + 65 * part;
    case "enregistrement":
      return 72;
    case "liens":
      return 75 + 25 * part;
    default:
      return 100;
  }
}

export function SuiviTravail({ etat, attente = "Envoi au serveur…" }: { etat: EtatTravail | null; attente?: string }) {
  const p = etat?.progression;
  const compte = p && p.total > 0 && (p.etape === "codes" || p.etape === "liens");
  return (
    <div className="flex w-full flex-col gap-1.5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-sm font-semibold">
        <span>{p ? LIBELLES_ETAPES_TRAVAIL[p.etape] : attente}</span>
        {compte && (
          <span className="font-mono tabular-nums text-texte-doux">
            {p.faits.toLocaleString("fr-FR")} / {p.total.toLocaleString("fr-FR")}
          </span>
        )}
      </div>
      <BarreProgression valeur={avancement(etat)} />
      {etat?.coupure && (
        <p className="flex items-start gap-2 text-sm text-alerte">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          Connexion perdue : le serveur continue. Les fiches seront récupérées dès le retour du réseau, sans créer de doublon. Gardez cette page ouverte.
        </p>
      )}
    </div>
  );
}
