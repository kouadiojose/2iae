// /enseigner/mon-cours/:coursId — les trois gros blocs d'UN cours, quand le formateur en a plusieurs (il a touché son
// carré sur l'accueil) : « Le cours », « Entrer dans le live », « Préparer le cours ». Gros bouton « Retour à mes cours ».
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { useTextes } from "@/lib/textes";
import { t as tEnseigner } from "@shared/textes/enseigner";
import { BandeCours, LienPlus, TroisBlocs, useAccueilSimple } from "./simple/blocs";

export default function PageMonCours({ coursId }: { coursId: string }) {
  const tx = useTextes(tEnseigner);
  const { data, error, refetch, isLoading } = useAccueilSimple();
  const c = data?.cours.find((x) => x.coursId === Number(coursId));
  return (
    <Page className="gap-6 sm:gap-8 [@media(max-height:700px)]:!gap-4 [@media(max-height:700px)]:!pt-4">
      <Link
        href="/enseigner"
        className="inline-flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[20px] border-2 border-ligne bg-white px-6 text-[22px] font-extrabold text-encre no-underline shadow-carte transition-[border-color,box-shadow] duration-150 hover:border-orange/60 hover:text-encre hover:shadow-survol sm:w-auto sm:self-start [@media(max-height:700px)]:min-h-[56px]"
      >
        <ArrowLeft className="h-7 w-7 text-orange-profond" strokeWidth={2.25} aria-hidden />
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
          <BandeCours c={c} />
          <TroisBlocs c={c} />
          <LienPlus aFaire={data.aFaire} />
        </>
      )}
    </Page>
  );
}
