// Justifier (ou retirer la justification d') une absence à une séance.
import { useEffect, useState } from "react";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { ZoneTexte } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";

export type CibleJustification = {
  seanceId: number;
  seanceTitre: string;
  etudiantId: number;
  nom: string;
  justification: string | null;
};

const MOTIFS = ["Certificat médical", "Coupure d'électricité", "Pas de réseau dans le quartier", "Décès dans la famille", "Convocation officielle"];

export function FenetreJustifier({ cible, onFermer }: { cible: CibleJustification | null; onFermer: () => void }) {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => setTexte(cible?.justification ?? ""), [cible]);
  if (!cible) return null;

  const envoyer = async (justification: string | null) => {
    setEnvoi(true);
    try {
      await post("/api/pilotage/presences/justifier", { seanceId: cible.seanceId, etudiantId: cible.etudiantId, justification });
      toast(justification ? "Absence justifiée" : "Justification retirée");
      await rafraichir("/api/pilotage/presences", `/api/pilotage/etudiants/${cible.etudiantId}`, "/api/pilotage/tableau", "/api/pilotage/a-contacter");
      onFermer();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre={cible.justification ? "Modifier la justification" : "Justifier l'absence"}
      description={`${cible.nom} · ${cible.seanceTitre}. Une absence justifiée ne compte pas dans le taux de présence.`}
      pied={
        <>
          {cible.justification && (
            <Bouton variante="fantome" onClick={() => envoyer(null)} disabled={envoi}>
              Retirer la justification
            </Bouton>
          )}
          <Bouton onClick={() => envoyer(texte.trim())} chargement={envoi} disabled={!texte.trim()}>
            Enregistrer
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {MOTIFS.map((m) => (
            <button key={m} type="button" onClick={() => setTexte(m)} className="min-h-[40px] rounded-full border border-ligne px-3 text-sm font-semibold text-texte-doux hover:border-orange hover:text-encre">
              {m}
            </button>
          ))}
        </div>
        <ZoneTexte libelle="Motif" value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} maxLength={300} placeholder="Ex. : certificat médical du 22 septembre, remis à la vie scolaire." />
      </div>
    </Fenetre>
  );
}
