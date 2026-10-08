// « Signaler une erreur » sur une carte de révision (révision du jour, quiz du
// cours complet) : trois motifs au pouce, un signalement par étudiant, envoyé
// tout de suite ou au retour du réseau. Au 3e signalement d'étudiants, la carte
// sort de la révision et le formateur est prévenu (côté serveur).
import { useState } from "react";
import { Flag } from "lucide-react";
import { Fenetre } from "@/components/ui/fenetre";
import { toast } from "@/components/ui/toast";
import { envoyerOuMettreEnFile } from "@/lib/file-envoi";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/revision";

const MOTIFS = ["signaler.fausse", "signaler.floue", "signaler.horsCours"] as const;
/** Cartes déjà signalées depuis ce téléphone pendant la visite. */
const signalees = new Set<number>();

export function BoutonSignaler({ carteId }: { carteId: number | null | undefined }) {
  const tx = useTextes(t);
  const [ouverte, setOuverte] = useState(false);
  const [, setFait] = useState(0);
  if (!carteId) return null;
  const deja = signalees.has(carteId);

  const envoyer = async (motif: string) => {
    setOuverte(false);
    signalees.add(carteId);
    setFait((n) => n + 1);
    try {
      const r = await envoyerOuMettreEnFile({
        cle: `revision-signalement:${carteId}`,
        description: tx("signaler"),
        url: `/api/revision/cartes/${carteId}/signaler`,
        methode: "POST",
        corps: { motif },
      });
      toast(r.statut === "envoye" ? tx("signaler.merci") : tx("signaler.attente"));
    } catch {
      // Refus (question déjà retirée, par exemple) : rien à faire de plus pour l'étudiant.
      toast(tx("signaler.merci"));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !deja && setOuverte(true)}
        disabled={deja}
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-texte-pale hover:text-encre disabled:opacity-70"
      >
        <Flag className="h-4 w-4" aria-hidden />
        {deja ? tx("signaler.deja") : tx("signaler")}
      </button>
      <Fenetre ouverte={ouverte} onFermer={() => setOuverte(false)} titre={tx("signaler.titre")}>
        <div className="flex flex-col gap-2 pb-4">
          {MOTIFS.map((cle) => (
            <button
              key={cle}
              type="button"
              onClick={() => void envoyer(tx(cle))}
              className="min-h-[52px] rounded-2xl border-[1.5px] border-ligne bg-white px-4 text-left text-base font-semibold hover:border-orange hover:bg-orange-pale"
            >
              {tx(cle)}
            </button>
          ))}
        </div>
      </Fenetre>
    </>
  );
}
