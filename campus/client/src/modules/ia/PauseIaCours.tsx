// « IA en pause » sur un cours : pendant un devoir ou un examen, le formateur
// coupe l'assistant (et la bibliothèque) pour tous les étudiants du cours, pour
// une durée choisie. Le serveur refuse alors leurs questions (423).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, PauseCircle, PlayCircle } from "lucide-react";
import type { DemandePauseIa, PauseIaCours as EtatPause } from "@shared/schema/ext-ia";
import { put } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { heure } from "@/lib/dates";
import { Bouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { Champ } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const DUREES: { valeur: DemandePauseIa["duree"]; libelle: string }[] = [
  { valeur: 60, libelle: "1 heure" },
  { valeur: 120, libelle: "2 heures" },
  { valeur: 180, libelle: "3 heures" },
  { valeur: "soir", libelle: "Jusqu'à ce soir" },
  { valeur: "sans_fin", libelle: "Jusqu'à ce que je la rouvre" },
];

export function PauseIaCours({ coursId, className }: { coursId: number; className?: string }) {
  const cle = [`/api/cours/${coursId}/ia-pause`];
  const { data } = useQuery<EtatPause>({ queryKey: cle, refetchInterval: 60_000 });
  const [ouverte, setOuverte] = useState(false);
  const [duree, setDuree] = useState<DemandePauseIa["duree"]>(120);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async (demande: DemandePauseIa) => {
    setEnvoi(true);
    try {
      const etat = await put<EtatPause>(`/api/cours/${coursId}/ia-pause`, demande);
      queryClient.setQueryData(cle, etat);
      toast(etat.active ? "IA en pause pour les étudiants de ce cours." : "IA rouverte pour les étudiants de ce cours.");
      setOuverte(false);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  if (!data) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3",
        data.active ? "border-alerte/40 bg-alerte-clair" : "border-ligne bg-white",
        className,
      )}
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", data.active ? "bg-alerte text-white" : "bg-creme text-orange-fonce")}>
        {data.active ? <PauseCircle className="h-5 w-5" aria-hidden /> : <Sparkles className="h-5 w-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{data.active ? "IA en pause pour vos étudiants" : "IA ouverte pour vos étudiants"}</p>
        <p className="text-sm text-texte-pale">
          {data.active
            ? `${data.sansFin ? "Jusqu'à ce que vous la rouvriez" : `Jusqu'à ${heure(data.jusqua!).replace(":", "h")}`}${data.motif ? ` · ${data.motif}` : ""}. Assistant et bibliothèque refusent leurs questions.`
            : "Devoir ou examen ? Mettez l'assistant et la bibliothèque en pause pendant l'épreuve."}
        </p>
      </div>
      {data.active ? (
        <Bouton variante="contour" icone={<PlayCircle className="h-4 w-4" />} chargement={envoi} onClick={() => void envoyer({ duree: "fin" })}>
          Rouvrir l'IA
        </Bouton>
      ) : (
        <Bouton variante="contour" icone={<PauseCircle className="h-4 w-4" />} onClick={() => setOuverte(true)}>
          Mettre l'IA en pause
        </Bouton>
      )}

      <Fenetre ouverte={ouverte} onFermer={() => setOuverte(false)} titre="Mettre l'IA en pause">
        <div className="flex flex-col gap-4">
          <p className="text-[15px] text-texte-pale">
            Les étudiants de ce cours ne pourront plus interroger l'assistant ni la bibliothèque, quel que soit le cours depuis lequel ils essaient. Ils voient le motif et l'heure de reprise.
          </p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-bold">Durée</legend>
            {DUREES.map((d) => (
              <label key={String(d.valeur)} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4", duree === d.valeur ? "border-orange bg-orange/5" : "border-ligne")}>
                <input type="radio" name="duree-pause-ia" checked={duree === d.valeur} onChange={() => setDuree(d.valeur)} className="h-4 w-4 accent-orange" />
                <span className="text-[15px]">{d.libelle}</span>
              </label>
            ))}
          </fieldset>
          <Champ libelle="Motif (facultatif)" placeholder="Devoir surveillé, examen…" maxLength={80} value={motif} onChange={(e) => setMotif(e.target.value)} />
          <Bouton icone={<PauseCircle className="h-4 w-4" />} chargement={envoi} onClick={() => void envoyer({ duree, motif: motif.trim() || undefined })}>
            Mettre en pause
          </Bouton>
        </div>
      </Fenetre>
    </div>
  );
}
