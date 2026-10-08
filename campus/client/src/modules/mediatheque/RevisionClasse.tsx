// En tête du cours complet, pour le formateur du cours et la direction : la
// révision de la classe (« Révisé par 34 étudiants sur 176 · 7,8/12 en moyenne ·
// questions les plus ratées : 3, 7 et 11 », à partir de 5 étudiants) et les
// questions signalées ou très ratées, retirées en attendant leur décision.
// Jamais de note ni de nom d'étudiant.
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, PlayCircle } from "lucide-react";
import { put } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { Bouton } from "@/components/ui/bouton";
import { Badge } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { t } from "@shared/textes/revision";
import { SEUIL_COLLECTIF, type RevisionClasseDto } from "@shared/engagement/revision";

const minute = (s: number) => `${Math.floor(s / 60)} min`;
const virgule = (n: number) => String(n).replace(".", ",");

/** « 3, 7 et 11 » */
function liste(n: number[]) {
  if (n.length < 2) return n.join("");
  return `${n.slice(0, -1).join(", ")} et ${n[n.length - 1]}`;
}

export function RevisionClasse({ seanceId }: { seanceId: number }) {
  const tx = useTextes(t);
  const cle = `/api/seances/${seanceId}/revision-classe`;
  const { data } = useQuery<RevisionClasseDto>({ queryKey: [cle], staleTime: 60_000, retry: false });
  const [enCours, setEnCours] = useState<number | null>(null);
  if (!data) return null;

  const decider = async (id: number, decision: "reactiver" | "retirer") => {
    setEnCours(id);
    try {
      await put(`/api/revision/cartes/${id}`, { decision });
      toast(decision === "reactiver" ? tx("classe.reactivee") : tx("classe.retiree"));
      await queryClient.invalidateQueries({ queryKey: [cle] });
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnCours(null);
    }
  };

  const ratees = data.plusRatees ?? [];
  return (
    <section className="sans-impression flex flex-col gap-3 rounded-2xl border border-ligne bg-creme p-4" aria-label={tx("classe.titre")}>
      <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">
        <BarChart3 className="h-4 w-4" aria-hidden />
        {tx("classe.titre")}
      </p>
      {data.revisePar >= SEUIL_COLLECTIF ? (
        <p className="text-[15px] leading-relaxed">
          <span className="font-extrabold">{tx("classe.resume", { v: { n: data.revisePar, sur: data.inscrits } })}</span>
          {data.moyenneQuiz && <> · {tx("classe.moyenne", { v: { moyenne: virgule(data.moyenneQuiz.moyenne), sur: data.moyenneQuiz.sur } })}</>}
          {ratees.length > 0 && <> · {tx("classe.ratees", { v: { liste: liste(ratees.map((r) => r.position)) } })}</>}
        </p>
      ) : (
        <p className="text-[15px] text-texte-pale">{tx("classe.attente", { v: { seuil: SEUIL_COLLECTIF, n: data.revisePar } })}</p>
      )}
      {ratees.some((r) => r.notion) && (
        <ul className="flex flex-col gap-1.5">
          {ratees
            .filter((r) => r.notion)
            .map((r) => (
              <li key={r.position}>
                <Link href={`/replays/${seanceId}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold">
                  <PlayCircle className="h-4 w-4 shrink-0" aria-hidden />
                  {tx("classe.question", { v: { n: r.position } })} ({r.tauxErreur} %) :{" "}
                  {tx("classe.notion", { v: { titre: r.notion!.titre, minute: minute(r.notion!.debutSecondes) } })}
                </Link>
              </li>
            ))}
        </ul>
      )}
      <p className="text-xs text-texte-gris">{tx("classe.jamaisNom")}</p>

      {data.aRelire.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-ligne pt-3">
          <p className="flex items-center gap-2 font-extrabold">
            <AlertTriangle className="h-4 w-4 text-alerte" aria-hidden />
            {tx("classe.aRelire")}
          </p>
          <p className="text-sm text-texte-pale">{tx("classe.aRelireTexte")}</p>
          <ul className="flex flex-col gap-2">
            {data.aRelire.map((q) => (
              <li key={q.id} className="flex flex-col gap-2 rounded-xl bg-white p-3">
                <p className="text-[15px] font-semibold leading-snug">
                  {q.position > 0 && <span className="font-mono text-xs text-texte-gris">{tx("classe.question", { v: { n: q.position } })} · </span>}
                  {q.question}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {q.signalements > 0 && <Badge ton="alerte">{tx("classe.signalee", { v: { n: q.signalements } })}</Badge>}
                  {q.tauxErreur !== null && <Badge ton="danger">{tx("classe.ratee", { v: { taux: q.tauxErreur } })}</Badge>}
                  {q.decision === "retiree" && <Badge ton="gris">{tx("classe.gardee")}</Badge>}
                </div>
                {q.motifs.length > 0 && <p className="text-sm text-texte-pale">« {q.motifs.join(" » · « ")} »</p>}
                <div className="flex flex-wrap gap-2">
                  <Bouton taille="sm" variante="contour" className="min-h-11" chargement={enCours === q.id} onClick={() => void decider(q.id, "reactiver")}>
                    {tx("classe.reactiver")}
                  </Bouton>
                  {q.decision !== "retiree" && (
                    <Bouton taille="sm" variante="fantome" className="min-h-11" disabled={enCours === q.id} onClick={() => void decider(q.id, "retirer")}>
                      {tx("classe.garder")}
                    </Bouton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
