// Vérification des rappels sur ce téléphone (chantier C3) : un rappel d'essai,
// puis « L'as-tu reçu ? ». Oui : c'est vérifié (abonnements_push.recu). Non :
// le guide par marque, puis un nouvel essai. La nuit (ou au plafond du jour),
// l'essai part le matin : au retour, la question est posée directement.
import { useEffect, useRef, useState } from "react";
import { BellRing, Check, Moon, RotateCw } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { useTextes } from "@/lib/textes";
import { Bouton } from "@/components/ui/bouton";
import { toast, toastErreur } from "@/components/ui/toast";
import { GuideRappelsAndroid } from "./GuideRappelsAndroid";
import { essaiEnAttente, marqueRetenue, noterEssai, retenirMarque } from "./memoire";
import { t } from "@shared/textes/rappels";
import type { ResultatEssaiPush } from "@shared/schema";
import type { DemandeVerification, Marque } from "@shared/engagement/envois";

type Etape = "essai" | "envoi" | "question" | "nuit" | "plafond" | "guide" | "ok";

export function VerificationRappel({
  endpoint,
  autoEssai = false,
  recuInitial = null,
  onFini,
  onPerdu,
}: {
  /** Abonnement de ce téléphone (celui que le campus connaît). */
  endpoint: string;
  /** Envoyer l'essai tout de suite (juste après l'activation). */
  autoEssai?: boolean;
  /** Réponse déjà donnée : false ouvre directement le guide. */
  recuInitial?: boolean | null;
  onFini?: (recu: boolean) => void;
  /** Le campus ne connaît plus ce téléphone : l'appelant relit l'état (et propose de réactiver). */
  onPerdu?: () => void;
}) {
  const tx = useTextes(t);
  const enAttente = !autoEssai && recuInitial !== false && essaiEnAttente();
  const [etape, setEtape] = useState<Etape>(recuInitial === false ? "guide" : enAttente ? "question" : "essai");
  const [plusTard, setPlusTard] = useState(enAttente);
  const [occupe, setOccupe] = useState(false);
  const lance = useRef(false);

  async function envoyer() {
    setEtape("envoi");
    try {
      const r = await post<ResultatEssaiPush>("/api/push/test");
      setPlusTard(false);
      if (r.envoye) {
        noterEssai();
        setEtape("question");
      } else if (r.raison === "heures_calmes" || r.raison === "plafond") {
        noterEssai();
        setEtape(r.raison === "heures_calmes" ? "nuit" : "plafond");
      } else if (r.raison === "aucun_appareil") {
        setEtape("essai");
        onPerdu?.();
      } else {
        toast(tx("verif.indisponible"), "erreur");
        setEtape("essai");
      }
    } catch (e) {
      // Un essai vient de partir (une minute entre deux) : on pose la question.
      if (e instanceof ErreurApi && e.statut === 429) setEtape("question");
      else {
        toastErreur(e);
        setEtape("essai");
      }
    }
  }

  async function verifier(demande: DemandeVerification) {
    try {
      await post("/api/push/verification", demande);
      return true;
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 404) onPerdu?.();
      else toastErreur(e);
      return false;
    }
  }

  async function repondre(recu: boolean) {
    setOccupe(true);
    try {
      if (!(await verifier({ endpoint, recu, marque: marqueRetenue() }))) return;
      noterEssai(null);
      setEtape(recu ? "ok" : "guide");
      onFini?.(recu);
    } finally {
      setOccupe(false);
    }
  }

  function choisirMarque(marque: Marque) {
    retenirMarque(marque);
    void verifier({ endpoint, recu: false, marque });
  }

  useEffect(() => {
    if (!autoEssai || lance.current) return;
    lance.current = true;
    void envoyer();
  }, [autoEssai]);

  if (etape === "ok") {
    return (
      <p className="flex items-center gap-2.5 rounded-2xl bg-succes-clair px-4 py-3 text-[15px] font-semibold text-succes" role="status">
        <Check className="h-5 w-5 shrink-0" aria-hidden /> {tx("verif.ok")}
      </p>
    );
  }

  if (etape === "question") {
    return (
      <div className="flex flex-col gap-3" role="group" aria-label={tx(plusTard ? "verif.questionPlusTard" : "verif.question")}>
        <div>
          <p className="text-base font-bold leading-snug">{tx(plusTard ? "verif.questionPlusTard" : "verif.question")}</p>
          {!plusTard && <p className="text-sm text-texte-pale">{tx("verif.delai")}</p>}
        </div>
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
          <Bouton className="min-h-[48px]" icone={<Check className="h-5 w-5" />} chargement={occupe} onClick={() => void repondre(true)}>
            {tx("verif.oui")}
          </Bouton>
          <Bouton variante="contour" className="min-h-[48px]" disabled={occupe} onClick={() => void repondre(false)}>
            {tx("verif.non")}
          </Bouton>
        </div>
      </div>
    );
  }

  if (etape === "nuit" || etape === "plafond") {
    return (
      <p className="flex items-start gap-3 rounded-2xl bg-creme px-4 py-3 text-[15px] leading-relaxed" role="status">
        <Moon className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
        <span>{tx(etape === "nuit" ? "verif.nuit" : "verif.plafond")}</span>
      </p>
    );
  }

  if (etape === "guide") {
    return (
      <div className="flex flex-col gap-4">
        <GuideRappelsAndroid marqueInitiale={marqueRetenue()} onMarque={choisirMarque} />
        <Bouton variante="doux" className="min-h-[48px] self-start" icone={<RotateCw className="h-4 w-4" />} onClick={() => void envoyer()}>
          {tx("verif.renvoyer")}
        </Bouton>
      </div>
    );
  }

  return (
    <Bouton className="min-h-[48px] self-start" icone={<BellRing className="h-5 w-5" />} chargement={etape === "envoi"} onClick={() => void envoyer()}>
      {tx("verif.essai")}
    </Bouton>
  );
}
