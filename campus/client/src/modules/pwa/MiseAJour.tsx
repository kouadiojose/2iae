// Bandeau « Nouvelle version disponible » : la mise à jour du campus est
// proposée, jamais imposée (pas de rechargement au milieu d'un live ou d'un
// envoi). Monté hors de l'arbre React de l'application, par service-worker.ts.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RefreshCw, X } from "lucide-react";

function BandeauMiseAJour({ onAccepter, onFermer }: { onAccepter: () => void; onFermer: () => void }) {
  const [enCours, setEnCours] = useState(false);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 sm:bottom-6" role="status" aria-live="polite">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-encre py-3 pl-4 pr-2 text-white shadow-carte animate-monte">
        <RefreshCw className={`h-5 w-5 shrink-0 text-orange ${enCours ? "animate-spin" : ""}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight">Nouvelle version disponible</p>
          <p className="text-[13px] text-nuit-gris">{enCours ? "Mise à jour en cours…" : "Toucher pour mettre à jour le campus."}</p>
        </div>
        <button
          type="button"
          disabled={enCours}
          onClick={() => {
            setEnCours(true);
            onAccepter();
          }}
          className="min-h-[48px] shrink-0 rounded-xl bg-orange px-4 text-[15px] font-bold text-encre transition-colors hover:bg-orange-peche disabled:opacity-60"
        >
          Mettre à jour
        </button>
        <button
          type="button"
          onClick={onFermer}
          className="grid h-12 w-10 shrink-0 place-items-center rounded-xl text-nuit-gris hover:text-white"
          aria-label="Plus tard"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/** Affiche le bandeau (une seule fois à la fois). */
export function proposerMiseAJour(accepter: () => void) {
  if (document.getElementById("campus-mise-a-jour")) return;
  const hote = document.createElement("div");
  hote.id = "campus-mise-a-jour";
  document.body.appendChild(hote);
  const racine = createRoot(hote);
  const fermer = () => {
    racine.unmount();
    hote.remove();
  };
  racine.render(<BandeauMiseAJour onAccepter={accepter} onFermer={fermer} />);
}
