// /enseigner/mon-cours/:coursId — les gros blocs d'UN cours, quand le professeur en a plusieurs (il a touché son carré
// sur l'accueil) : « Commencer le live », « Mes documents », « Le mur du cours », « Vidéos et examens » et la ligne
// « Leçons, devoirs et notes » (simple/blocs-cours.tsx). Gros bouton « Retour à mes cours ».
import { Page } from "@/components/layout/coquille";
import { RetourGros } from "@/components/ui/gros-blocs";
import { useTextes } from "@/lib/textes";
import { t as tEnseigner } from "@shared/textes/enseigner";
import { LienPlus, useAccueilSimple } from "./simple/blocs";
import { BandeDuCours, BlocsDuCours } from "./simple/blocs-cours";

export default function PageMonCours({ coursId }: { coursId: string }) {
  const tx = useTextes(tEnseigner);
  const { data, error, refetch, isLoading } = useAccueilSimple();
  const c = data?.cours.find((x) => x.coursId === Number(coursId));
  return (
    <Page className="gap-4 pt-4 sm:gap-8 [@media(min-height:701px)_and_(max-height:800px)]:!gap-5 [@media(min-height:701px)_and_(max-height:800px)]:!pt-5 [@media(max-height:700px)]:!gap-3 [@media(max-height:700px)]:!pt-4">
      <RetourGros href="/enseigner">{tx("blocs.retour")}</RetourGros>
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
