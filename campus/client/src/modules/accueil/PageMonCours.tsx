// /enseigner/mon-cours/:coursId — les trois gros blocs d'UN cours, quand le formateur en a plusieurs (il a touché son
// carré sur l'accueil) : « Le cours », « Entrer dans le live », « Préparer le cours ». Gros bouton « Retour à mes cours ».
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { useTextes } from "@/lib/textes";
import { t as tEnseigner } from "@shared/textes/enseigner";
import { LienPlus, useAccueilSimple } from "./simple/blocs";
import { BandeDuCours, BlocsDuCours } from "./simple/blocs-cours";

export default function PageMonCours({ coursId }: { coursId: string }) {
  const tx = useTextes(tEnseigner);
  const { data, error, refetch, isLoading } = useAccueilSimple();
  const c = data?.cours.find((x) => x.coursId === Number(coursId));
  return (
    <Page className="gap-6 sm:gap-8">
      <Link
        href="/enseigner"
        className="inline-flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[20px] border-[3px] border-encre bg-white px-6 text-[22px] font-extrabold text-encre no-underline hover:bg-creme sm:w-auto sm:self-start"
      >
        <ArrowLeft className="h-7 w-7" aria-hidden />
        {tx("blocs.retour")}
      </Link>
      {isLoading ? (
        <p className="text-[24px] font-bold text-texte-doux" aria-busy="true">
          {tx("blocs.chargement")}
        </p>
      ) : error || !data || !c ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-[24px] font-bold">{tx("blocs.erreur")}</p>
          <button type="button" onClick={() => void refetch()} className="min-h-[64px] rounded-[20px] bg-orange px-8 text-[22px] font-black text-encre">
            {tx("blocs.reessayer")}
          </button>
        </div>
      ) : (
        <>
          <BandeDuCours c={c} />
          <BlocsDuCours c={c} />
          <LienPlus aFaire={data.aFaire} />
        </>
      )}
    </Page>
  );
}
