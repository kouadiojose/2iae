// /enseigner — l'accueil du formateur, trois gros blocs (José, 14 octobre 2026 au soir : « les professeurs aussi,
// considère-les comme des bébés : le professeur se connecte et il veut voir de gros blocs : Le cours, Entrer dans le
// live, Préparer le cours »).
//
// Un seul cours aujourd'hui (ou cette semaine) : directement la bande du cours et les trois blocs. Plusieurs : d'abord un
// gros carré par cours (/enseigner/mon-cours/:id, les trois blocs de ce cours). Tout le reste de l'ancien accueil (« À
// faire », « Mes séances », les réglages, les liens, le manuel, la carte des salles du jour de la double casquette) est
// sous le petit lien « Plus » (/enseigner/plus, PageEnseignerPlus) : rien ne disparaît du campus. La bascule de
// casquette reste dans l'en-tête.
import { Page } from "@/components/layout/coquille";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { jourLong } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { t as tEnseigner } from "@shared/textes/enseigner";
import { Etiquette } from "@/components/ui/gros-blocs";
import { majuscule } from "./outils";
import { BandeCours, CarreCours, LienPlus, TroisBlocs, useAccueilSimple } from "./simple/blocs";

export default function PageEnseigner() {
  const tx = useTextes(tEnseigner);
  const maintenant = useMaintenant(60_000);
  const { data, error, refetch, isLoading } = useAccueilSimple();
  const montres = data ? data.cours.filter((c) => data.montres.includes(c.coursId)) : [];
  const seul = data?.seul ? data.cours.find((c) => c.coursId === data.seul) : undefined;
  return (
    <Page className="gap-6 sm:gap-8">
      <header className="flex flex-col gap-2">
        <Etiquette>{majuscule(jourLong(maintenant))}</Etiquette>
        <h1 className="text-[40px] leading-[1.02] text-encre sm:text-[52px]">{data ? `${data.salutation} ${data.prenom}.` : " "}</h1>
      </header>
      {isLoading ? (
        <p className="text-[24px] font-bold text-texte-doux" aria-busy="true">
          {tx("blocs.chargement")}
        </p>
      ) : error || !data ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-[24px] font-bold">{tx("blocs.erreur")}</p>
          <button type="button" onClick={() => void refetch()} className="min-h-[64px] rounded-[20px] bg-orange px-8 text-[22px] font-black text-encre">
            {tx("blocs.reessayer")}
          </button>
        </div>
      ) : seul ? (
        <>
          <BandeCours c={seul} />
          <TroisBlocs c={seul} />
        </>
      ) : montres.length ? (
        <>
          <p className="inline-flex w-fit items-center rounded-full bg-creme px-5 py-3 text-[20px] font-bold shadow-carte">{tx("blocs.choisir")}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
            {montres.map((c) => (
              <CarreCours key={c.coursId} c={c} />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-[28px] border-2 border-ligne bg-creme p-6 shadow-carte sm:p-8">
          <p className="text-[30px] font-black leading-tight">{tx("blocs.aucun.titre")}</p>
          <p className="mt-2 text-[22px] text-texte-doux">{tx("blocs.aucun.texte")}</p>
        </div>
      )}
      {data && <LienPlus aFaire={data.aFaire} />}
    </Page>
  );
}
