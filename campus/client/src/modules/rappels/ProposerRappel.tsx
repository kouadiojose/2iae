// Proposition d'activer les rappels au bon moment (chantier C3) : à la sortie
// d'un direct (C6), sous le reçu d'un devoir rendu (C3), à la fin d'une
// révision (C1). Emplacement posé par le socle commun (C0) ; chaque appelant
// l'enveloppe dans une LimiteSilencieuse.
//
// Rien ne s'affiche si ce téléphone reçoit déjà les rappels, s'il ne peut pas
// les recevoir, s'ils sont bloqués (la carte de l'accueil s'en charge) ou si
// la personne a répondu « Plus tard » cette semaine. Après l'activation : un
// essai, puis « L'as-tu reçu ? ».
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { Bouton } from "@/components/ui/bouton";
import { toast, toastErreur } from "@/components/ui/toast";
import { abonnementActuel, activerRappels, pushSupporte } from "@/modules/pwa/ActiverNotifications";
import { VerificationRappel } from "./VerificationRappel";
import { masqueePlusTard, plusTard } from "./memoire";
import { t } from "@shared/textes/rappels";
import type { ClePush } from "@shared/schema";

export type MomentRappel = "live" | "rendu" | "revision";

const TITRES = { live: "proposer.live.titre", rendu: "proposer.rendu.titre", revision: "proposer.revision.titre" } as const;
const TEXTES = { live: "proposer.live.texte", rendu: "proposer.rendu.texte", revision: "proposer.revision.texte" } as const;

export function ProposerRappel({ moment }: { moment: MomentRappel }) {
  const tx = useTextes(t);
  const { data } = useQuery<ClePush>({ queryKey: ["/api/push/cle"], staleTime: 10 * 60_000 });
  const cle = data?.cle ?? null;
  const [visible, setVisible] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    if (!cle || !pushSupporte() || Notification.permission === "denied" || masqueePlusTard("proposer")) return;
    let actif = true;
    void abonnementActuel()
      .catch(() => null)
      .then((abo) => {
        if (actif) setVisible(!abo || Notification.permission !== "granted");
      });
    return () => {
      actif = false;
    };
  }, [cle]);

  async function activer() {
    if (!cle) return;
    setOccupe(true);
    try {
      const r = await activerRappels(cle);
      if (r.resultat === "actif") {
        setEndpoint(r.endpoint);
        toast(tx("carte.active"));
      } else {
        // Refusé (ou fenêtre fermée) : on ne redemande pas ici ; la carte de l'accueil reste.
        setVisible(false);
        if (r.resultat === "plus_tard") toast(tx("carte.refusTemporaire"), "info");
      }
    } catch (e) {
      toastErreur(e instanceof Error && e.name !== "Error" ? new Error(tx("carte.erreur")) : e);
    } finally {
      setOccupe(false);
    }
  }

  if (!visible) return null;
  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl border border-ligne bg-white p-4 text-left" aria-labelledby={`proposer-rappel-${moment}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-clair text-orange-fonce">
          <BellRing className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={`proposer-rappel-${moment}`} className="text-base font-extrabold leading-snug text-encre">
            {tx(TITRES[moment])}
          </h3>
          <p className="text-sm leading-relaxed text-texte-pale">{tx(TEXTES[moment])}</p>
        </div>
      </div>
      {endpoint ? (
        <VerificationRappel endpoint={endpoint} autoEssai onPerdu={() => setEndpoint(null)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Bouton className="min-h-[48px]" icone={<BellRing className="h-4 w-4" />} chargement={occupe} onClick={() => void activer()}>
            {tx("proposer.bouton")}
          </Bouton>
          <Bouton
            variante="fantome"
            className="min-h-[48px]"
            onClick={() => {
              plusTard("proposer");
              setVisible(false);
            }}
          >
            {tx("carte.plusTard")}
          </Bouton>
        </div>
      )}
    </section>
  );
}
