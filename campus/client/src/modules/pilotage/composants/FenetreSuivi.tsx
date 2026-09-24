// Note de suivi (appel, entretien, parent prévenu…) sur un étudiant.
import { useState } from "react";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { ZoneTexte } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";

const MODELES = ["Appelé(e) : tout va bien.", "Message WhatsApp envoyé, en attente de réponse.", "Parent prévenu.", "Problème de téléphone ou de réseau.", "Nouvelle fiche remise."];

export function FenetreSuivi({ etudiant, onFermer }: { etudiant: { id: number; prenom: string; nom: string } | null; onFermer: () => void }) {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  if (!etudiant) return null;
  const enregistrer = async () => {
    setEnvoi(true);
    try {
      await post(`/api/pilotage/etudiants/${etudiant.id}/suivis`, { texte });
      toast("Suivi enregistré");
      await rafraichir("/api/pilotage/a-contacter", `/api/pilotage/etudiants/${etudiant.id}`);
      setTexte("");
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
      titre="Noter un suivi"
      description={`${etudiant.prenom} ${etudiant.nom} · visible par la vie scolaire et la direction, jamais par l'étudiant.`}
      pied={
        <Bouton onClick={enregistrer} chargement={envoi} disabled={texte.trim().length < 2}>
          Enregistrer le suivi
        </Bouton>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {MODELES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setTexte((t) => (t ? `${t} ${m}` : m))}
              className="min-h-[40px] rounded-full border border-ligne px-3 text-sm font-semibold text-texte-doux hover:border-orange hover:text-encre"
            >
              {m}
            </button>
          ))}
        </div>
        <ZoneTexte libelle="Ce qui s'est passé" value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} maxLength={2000} placeholder="Ex. : appelée ce matin, son téléphone est en réparation jusqu'à jeudi." />
      </div>
    </Fenetre>
  );
}
