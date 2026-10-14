// « Pilotage · visio » : l'ouverture automatique des classes (demande de José du 14 octobre 2026). Par défaut
// active, 30 min avant ; la direction la coupe ou choisit 15, 30, 45 ou 60 min, d'un toucher (enregistré aussitôt).
// La vie scolaire voit le réglage sans le changer. Règle complète : shared/ouverture.ts et l'en-tête de
// server/routes/live.ts (tâche « live-ouverture-auto »).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DoorOpen } from "lucide-react";
import { put } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Carte } from "@/components/ui/carte";
import { Interrupteur } from "@/components/ui/champs";
import { Chargement, Erreur } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { DELAIS_OUVERTURE_AUTO, type ReglageOuvertureAuto, type ReglageOuvertureAutoDto } from "@shared/ouverture";

const CLE = "/api/visio/ouverture-auto";

export function CarteOuvertureAuto({ modifiable }: { modifiable: boolean }) {
  const { data, error, refetch } = useQuery<ReglageOuvertureAutoDto>({ queryKey: [CLE] });
  const [envoi, setEnvoi] = useState(false);
  if (error && !data) return <Erreur message={(error as Error).message} reessayer={() => void refetch()} />;
  if (!data) return <Chargement lignes={2} />;

  const changer = async (maj: Partial<ReglageOuvertureAuto>) => {
    const voulu: ReglageOuvertureAuto = { actif: data.actif, minutes: data.minutes, ...maj };
    setEnvoi(true);
    try {
      queryClient.setQueryData<ReglageOuvertureAutoDto>([CLE], await put<ReglageOuvertureAutoDto>(CLE, voulu));
      toast(voulu.actif ? `Chaque cours s'ouvrira tout seul ${voulu.minutes} min avant son début.` : "Ouverture automatique coupée : chaque formateur démarre sa classe.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Carte className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <DoorOpen className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
          <div className="min-w-0">
            <p id="libelle-ouverture-auto" className="text-[16px] font-extrabold leading-snug">
              Ouvrir chaque cours automatiquement {data.minutes} min avant son début (les salles règlent le son et l'image)
            </p>
            <p className="mt-1 text-[14px] leading-snug text-texte-pale">
              {data.actif
                ? "Les écrans des salles quittent la salle d'attente, les étudiants peuvent entrer, et le formateur trouve sa classe déjà ouverte. Le cours, les retards, la présence et l'enregistrement du replay partent toujours de l'heure prévue."
                : "Coupée : chaque classe attend que son formateur, ou la direction, la démarre. Les écrans des salles restent en salle d'attente jusque-là."}
            </p>
          </div>
        </div>
        <div className={cn("pt-1", (!modifiable || envoi) && "pointer-events-none opacity-60")}>
          <Interrupteur actif={data.actif} onChange={(v) => void changer({ actif: v })} libelle="Ouvrir chaque cours automatiquement avant son début" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-bold text-texte-doux">Combien de minutes avant le début ?</p>
        <div role="group" aria-label="Combien de minutes avant le début" className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
          {DELAIS_OUVERTURE_AUTO.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={data.minutes === m}
              disabled={!modifiable || !data.actif || envoi}
              onClick={() => data.minutes !== m && void changer({ minutes: m })}
              className={cn(
                "min-h-12 whitespace-nowrap rounded-full border px-2 text-[15px] font-bold tabular-nums transition-colors sm:min-w-[88px] sm:px-5",
                data.minutes === m ? "border-encre bg-encre text-white" : "border-ligne bg-white text-encre hover:bg-creme",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
      <p className="text-[13px] leading-snug text-texte-gris">
        À l'ouverture, chaque étudiant reçoit un seul rappel (« la classe est ouverte, le cours commence à 8h30 »), et les formateurs du cours sont prévenus. Une
        classe où personne ne vient animer finit « séance non tenue » : personne n'y est compté absent.
        {!modifiable && " Seule la direction modifie ce réglage."}
      </p>
    </Carte>
  );
}
