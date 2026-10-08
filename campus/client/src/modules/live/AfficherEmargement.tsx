// Studio (formateur et direction) : « Afficher l'émargement » remet le QR
// d'émargement en grand sur l'écran de toutes les salles, pendant une minute
// (chantier C6). Le QR s'affiche aussi tout seul au début du cours, à +15 et à
// +45 min ; jamais pendant un sondage : le bouton attend qu'il soit fermé.
import { useState } from "react";
import { QrCode } from "lucide-react";
import { post } from "@/lib/api";
import { useCanal } from "@/lib/flux";
import { useTextes } from "@/lib/textes";
import { Bouton } from "@/components/ui/bouton";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { toast, toastErreur } from "@/components/ui/toast";
import { t } from "@shared/textes/direct";
import type { AfficherEmargementDto } from "@shared/engagement/direct";
import type { EtatDirectDto } from "@shared/schema";

export function BoutonAfficherEmargement({ seanceId, etat }: { seanceId: number; etat: EtatDirectDto }) {
  const tx = useTextes(t);
  const [jusqua, setJusqua] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Un autre poste du Studio (direction, co-formateur) a pu le demander : on suit le canal de la séance.
  useCanal(`seance:${seanceId}`, (e) => {
    if (e.type === "emargement:afficher" && (e.data as AfficherEmargementDto)?.seanceId === seanceId) setJusqua(new Date((e.data as AfficherEmargementDto).afficheJusqua).getTime());
  });
  const maintenant = useMaintenant(1000);
  const restant = jusqua ? Math.ceil((jusqua - maintenant) / 1000) : 0;
  const sondageOuvert = Boolean(etat.sondage?.ouvert);
  if (etat.statut !== "en_direct") return null;
  const afficher = async () => {
    setEnvoi(true);
    try {
      const r = await post<AfficherEmargementDto>(`/api/seances/${seanceId}/afficher-emargement`);
      setJusqua(new Date(r.afficheJusqua).getTime());
      toast(tx("studio.afficher.ok"));
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <span title={sondageOuvert ? tx("studio.afficher.sondage") : `${tx("studio.afficher.aide")} ${tx("studio.afficher.auto")}`}>
      <Bouton variante={restant > 0 ? "nuit-actif" : "nuit"} icone={<QrCode className="h-4 w-4" />} onClick={afficher} chargement={envoi} disabled={sondageOuvert}>
        {restant > 0 ? tx("studio.afficher.encours", { v: { n: restant } }) : tx("studio.afficher")}
      </Bouton>
    </span>
  );
}
