// La question de fin de cours (21 novembre 2026) : « C'était : Marketing digital, pour BTS 1 ? ». Tant que le formateur
// n'a pas répondu, rien n'est envoyé aux étudiants (replay, résumé, devoirs, ressources). Affiché en tête de
// FinDeSeance pour celui qui peut répondre (seance.aConfirmer). Personnel vouvoyé.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Users } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { toast, toastErreur } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { OptionsEditionCours } from "@shared/schema";
import { Choix, useChoixClasses } from "./choix-classes";

type Devinette = {
  coursId: number;
  coursTitre: string;
  classes: { id: number; nom: string }[];
  classesAAjouter: { id: number; nom: string }[];
  etudiantsIdentifies: number;
  etudiantsDuCoursPresents: number;
  dureeMinutes: number;
  suggestion: "cours" | "reunion";
  phrase: string;
};
type Reponse = { devinette: Devinette; mesCours: { coursId: number; titre: string }[] };
export type IssueConfirmation = "cours" | "reunion";

function NouveauCours({ envoi, onValider, onRetour }: { envoi: boolean; onValider: (titre: string, classeIds: number[]) => void; onRetour: () => void }) {
  const { data: options } = useQuery<OptionsEditionCours>({ queryKey: ["/api/cours/options"] });
  const { classeIds, vue } = useChoixClasses(options);
  const [titre, setTitre] = useState("");
  const manque = titre.trim().length < 3 ? "Donnez un nom au cours." : !classeIds.length ? "Choisissez pour qui était le cours." : null;
  return (
    <div className="flex flex-col gap-3 text-left">
      <label className="flex flex-col gap-2">
        <span className="text-[18px] font-black">Le nom du cours</span>
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          maxLength={140}
          placeholder="Par exemple : Droit des affaires"
          className="min-h-[56px] rounded-[16px] border-2 border-ligne bg-white px-4 text-[20px] font-bold outline-none focus:border-orange"
        />
      </label>
      {vue}
      {manque && <p className="text-[15px] font-bold text-texte-doux">{manque}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(manque) || envoi}
          onClick={() => onValider(titre.trim(), classeIds)}
          className="min-h-[56px] flex-1 rounded-[18px] bg-orange px-5 text-[18px] font-black text-encre disabled:opacity-50"
        >
          {envoi ? "Un instant…" : "Ranger dans ce nouveau cours"}
        </button>
        <button type="button" onClick={onRetour} className="min-h-[56px] rounded-[18px] border-2 border-ligne px-5 text-[17px] font-bold">
          Retour
        </button>
      </div>
    </div>
  );
}

export function ConfirmerSeance({ seanceId, fait, onFait }: { seanceId: number; fait: IssueConfirmation | null; onFait: (issue: IssueConfirmation) => void }) {
  const { data } = useQuery<Reponse>({ queryKey: [`/api/seances/${seanceId}/confirmation`], enabled: fait === null, retry: false });
  const [vue, setVue] = useState<"question" | "corriger" | "nouveau">("question");
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (fait) {
    return (
      <div role="status" className="flex w-full items-center gap-3 rounded-[22px] bg-white px-5 py-4 text-left text-encre">
        <Check className="h-6 w-6 shrink-0 text-orange-profond" strokeWidth={3} />
        <p className="text-[18px] font-bold">
          {fait === "reunion" ? "Rangé dans les réunions : seuls les participants le verront." : "Merci. Les étudiants recevront le replay et le résumé."}
        </p>
      </div>
    );
  }
  if (!data) return null;
  const d = data.devinette;

  const repondre = async (corps: Record<string, unknown>, issue: IssueConfirmation) => {
    setEnvoi(true);
    setMessage(null);
    try {
      await post(`/api/seances/${seanceId}/confirmation`, corps);
      await rafraichir(`/api/seances/${seanceId}`, "/api/enseigner/a-confirmer", "/api/replays", "/api/cours", "/api/accueil");
      onFait(issue);
    } catch (e) {
      // Un cours sans aucune classe : il faut dire pour qui il était.
      if (e instanceof ErreurApi && (e.details as { code?: string } | undefined)?.code === "sans_classe") {
        setMessage(e.message);
        setVue("corriger");
        toast(e.message, "erreur");
      } else toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  const reunion = d.suggestion === "reunion";
  return (
    <div className="flex w-full flex-col gap-3 rounded-[24px] bg-white p-5 text-left text-encre shadow-carte" data-confirmer-seance>
      {vue === "question" && (
        <>
          <p className="text-[24px] font-black leading-tight">{d.phrase}</p>
          <p className="flex items-center gap-2 text-[16px] font-semibold text-texte-doux">
            <Users className="h-4 w-4" aria-hidden />
            {d.etudiantsIdentifies} étudiant{d.etudiantsIdentifies > 1 ? "s" : ""} identifié{d.etudiantsIdentifies > 1 ? "s" : ""} · {d.dureeMinutes} min
          </p>
          <p className="text-[15px] text-texte-doux">Rien n'est envoyé aux étudiants tant que vous n'avez pas répondu.</p>
          {message && <p className="rounded-[14px] bg-orange-clair px-4 py-3 text-[16px] font-bold">{message}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={envoi}
              onClick={() => void repondre({ choix: "oui" }, "cours")}
              className={cn("min-h-[60px] rounded-[18px] px-4 text-[20px] font-black disabled:opacity-60", reunion ? "border-2 border-ligne bg-white" : "bg-orange text-encre shadow-carte")}
            >
              Oui
            </button>
            <button type="button" disabled={envoi} onClick={() => setVue("corriger")} className="min-h-[60px] rounded-[18px] border-2 border-ligne bg-white px-4 text-[20px] font-black disabled:opacity-60">
              Corriger
            </button>
            <button
              type="button"
              disabled={envoi}
              onClick={() => void repondre({ choix: "reunion" }, "reunion")}
              className={cn("min-h-[60px] rounded-[18px] px-4 text-[18px] font-black disabled:opacity-60", reunion ? "bg-orange text-encre shadow-carte" : "border-2 border-ligne bg-white")}
            >
              C'était une réunion
            </button>
          </div>
        </>
      )}
      {vue === "corriger" && (
        <>
          <p className="text-[22px] font-black leading-tight">C'était quel cours ?</p>
          {message && <p className="rounded-[14px] bg-orange-clair px-4 py-3 text-[16px] font-bold">{message}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.mesCours.map((c) => (
              <Choix key={c.coursId} actif={false} onClick={() => void repondre({ choix: "corriger", coursId: c.coursId }, "cours")}>
                {c.titre}
              </Choix>
            ))}
            <Choix actif={false} onClick={() => setVue("nouveau")} icone={<Plus className="h-6 w-6" strokeWidth={3} />}>
              Un nouveau cours
            </Choix>
          </div>
          <button type="button" onClick={() => setVue("question")} className="min-h-[44px] self-start text-[17px] font-bold text-orange-profond underline underline-offset-4">
            Retour
          </button>
        </>
      )}
      {vue === "nouveau" && (
        <NouveauCours envoi={envoi} onRetour={() => setVue("corriger")} onValider={(titreCours, classeIds) => void repondre({ choix: "corriger", titreCours, classeIds }, "cours")} />
      )}
    </div>
  );
}
