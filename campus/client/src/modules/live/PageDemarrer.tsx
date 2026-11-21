// /enseigner/demarrer : « Quel cours ? ». Affiché quand le campus ne devine pas le cours : un gros bouton par cours,
// et la classe s'ouvre aussitôt. Le reste (classes, horaire) se range à la fin du cours (ConfirmerSeance).
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { Page } from "@/components/layout/coquille";
import { toast, toastErreur } from "@/components/ui/toast";
import type { EtatDemarrage } from "./demarrer";

export default function PageDemarrer() {
  const [, naviguer] = useLocation();
  const { data, isLoading } = useQuery<EtatDemarrage>({ queryKey: ["/api/enseigner/demarrer"] });
  const [envoi, setEnvoi] = useState<number | null>(null);

  const demarrer = async (coursId: number, titre: string) => {
    if (envoi !== null) return;
    setEnvoi(coursId);
    try {
      const r = await post<{ seanceId: number; coursTitre: string }>("/api/enseigner/demarrer", { coursId });
      await rafraichir("/api/cours", "/api/seances", "/api/accueil", "/api/live/en-cours", "/api/agenda", "/api/enseigner/a-confirmer");
      toast(`Le cours « ${r.coursTitre || titre} » démarre. Pas le bon cours ? Vous corrigerez à la fin.`);
      naviguer(`/live/${r.seanceId}`);
    } catch (e) {
      toastErreur(e);
      setEnvoi(null);
    }
  };

  return (
    <Page className="max-w-[860px] gap-6 pb-24">
      <button type="button" onClick={() => naviguer("/enseigner")} className="-mb-2 flex min-h-[44px] items-center gap-2 self-start text-[18px] font-bold text-texte-doux">
        <ArrowLeft className="h-5 w-5" /> Retour
      </button>
      <h1 className="text-[40px] leading-[1.02] text-encre sm:text-[52px]">Quel cours ?</h1>
      {isLoading ? (
        <p className="text-[20px] font-bold text-texte-doux" aria-busy="true">
          Un instant…
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(data?.cours ?? []).map((c) => (
            <button
              key={c.coursId}
              type="button"
              disabled={envoi !== null}
              onClick={() => void demarrer(c.coursId, c.titre)}
              className="flex min-h-[72px] flex-col justify-center rounded-[22px] border-2 border-ligne bg-white px-5 py-3 text-left text-[22px] font-black leading-tight text-encre transition-colors hover:border-orange disabled:opacity-60"
            >
              <span className="break-words">{envoi === c.coursId ? "Ouverture de la classe…" : c.titre}</span>
              <span className="text-[15px] font-semibold text-texte-doux">{c.code}</span>
            </button>
          ))}
          <Link
            href="/enseigner/nouveau"
            className="flex min-h-[72px] items-center rounded-[22px] border-2 border-dashed border-ligne bg-creme px-5 py-3 text-[22px] font-black leading-tight text-encre no-underline hover:border-orange"
          >
            Un autre cours
          </Link>
        </div>
      )}
      {!isLoading && !data?.cours.length && <p className="text-[18px] text-texte-doux">Vous n'avez pas encore de cours : « Un autre cours » vous guide pas à pas.</p>}
      <Link href="/enseigner/nouveau" className="min-h-[44px] self-start text-[17px] font-bold text-orange-profond underline underline-offset-4">
        Programmer pour plus tard
      </Link>
    </Page>
  );
}
