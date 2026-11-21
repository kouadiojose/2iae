// Les deux gros boutons de départ (« Démarrer un cours », « Réunion ») et la liste « N cours attendent votre réponse »,
// partagés par l'accueil du formateur (PageEnseigner) et le tableau de pilotage (PageTableau). 21 novembre 2026.
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Play, Users } from "lucide-react";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { toastErreur } from "@/components/ui/toast";
import { useDemarrerUnCours } from "./demarrer";

type AConfirmerListe = { seances: { id: number; titre: string; coursTitre: string; debut: string }[] };

const BOUTON =
  "flex min-h-[84px] w-full items-center gap-4 rounded-[24px] px-5 py-4 text-left text-[24px] font-black leading-tight shadow-carte disabled:opacity-60 [@media(max-height:700px)]:!min-h-[68px] [@media(max-height:700px)]:!text-[20px]";

export function BlocDemarrer({ className }: { className?: string }) {
  const [, naviguer] = useLocation();
  const { demarrer, envoi } = useDemarrerUnCours();
  const [reunion, setReunion] = useState(false);
  const { data } = useQuery<AConfirmerListe>({ queryKey: ["/api/enseigner/a-confirmer"] });
  const attente = data?.seances ?? [];

  const lancerReunion = async () => {
    if (reunion) return;
    setReunion(true);
    try {
      const r = await post<{ seanceId: number }>("/api/reunions-equipe/demarrer", {});
      await rafraichir("/api/seances", "/api/live/en-cours");
      naviguer(`/live/${r.seanceId}`);
    } catch (e) {
      toastErreur(e);
      setReunion(false);
    }
  };

  return (
    <section className={className} aria-label="Démarrer" data-bloc-demarrer>
      {attente.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-[20px] border-2 border-orange bg-orange-clair px-5 py-4" role="status">
          <p className="text-[20px] font-black">
            {attente.length} cours attendent votre réponse
          </p>
          <ul className="flex flex-col gap-1">
            {attente.map((s) => (
              <li key={s.id}>
                <Link href={`/live/${s.id}`} className="min-h-[44px] text-[17px] font-bold text-encre underline underline-offset-4">
                  {s.titre}
                  {s.coursTitre && s.coursTitre !== s.titre ? ` · ${s.coursTitre}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => void demarrer()} disabled={envoi} className={`${BOUTON} bg-encre text-white`} data-demarrer-un-cours>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange text-encre">
            <Play className="h-6 w-6" strokeWidth={3} />
          </span>
          <span className="flex flex-col">
            Démarrer un cours
            <span className="text-[16px] font-semibold text-white/75">Tout de suite, sans rien remplir</span>
          </span>
        </button>
        <button type="button" onClick={() => void lancerReunion()} disabled={reunion} className={`${BOUTON} border-2 border-encre bg-white text-encre`} data-reunion-equipe>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange text-encre">
            <Users className="h-6 w-6" strokeWidth={3} />
          </span>
          <span className="flex flex-col">
            Réunion
            <span className="text-[16px] font-semibold text-texte-doux">Invisible des étudiants</span>
          </span>
        </button>
      </div>
      <Link href="/enseigner/nouveau" className="mt-2 inline-flex min-h-[44px] items-center text-[16px] font-bold text-orange-profond underline underline-offset-4">
        Faire un cours plus tard ou avec options
      </Link>
    </section>
  );
}
