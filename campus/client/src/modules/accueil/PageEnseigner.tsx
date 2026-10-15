// /enseigner — l'accueil du formateur, trois gros blocs (José, 14 octobre 2026 au soir : « les professeurs aussi,
// considère-les comme des bébés : le professeur se connecte et il veut voir de gros blocs : Le cours, Entrer dans le
// live, Préparer le cours »).
//
// Un seul cours aujourd'hui (ou cette semaine) : directement la bande du cours et les trois blocs. Plusieurs : d'abord un
// gros carré par cours (/enseigner/mon-cours/:id, les trois blocs de ce cours). Tout le reste de l'ancien accueil (« À
// faire », « Mes séances », les réglages, les liens, le manuel, la carte des salles du jour de la double casquette) est
// sous le petit lien « Plus » (/enseigner/plus, PageEnseignerPlus) : rien ne disparaît du campus. La bascule de
// casquette reste dans l'en-tête.
// 15 octobre 2026 (José) : les blocs d'un cours sont « Commencer le live », « Mes documents », « Le mur du cours »,
// « Vidéos et examens » et la ligne « Leçons, devoirs et notes » (simple/blocs-cours.tsx) ; plus aucun cours caché :
// ceux qui ne sont pas montrés viennent dessous, en « Mes autres cours ».
import { cn } from "@/lib/utils";
import { Page } from "@/components/layout/coquille";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { jourLong } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { t as tEnseigner } from "@shared/textes/enseigner";
import { Etiquette } from "@/components/ui/gros-blocs";
import { majuscule } from "./outils";
import { CarreCours, LienPlus, useAccueilSimple } from "./simple/blocs";
import { BandeDuCours, BlocsDuCours } from "./simple/blocs-cours";
import { t as tProf } from "@shared/textes/espace-prof";

export default function PageEnseigner() {
  const tx = useTextes(tEnseigner);
  const tp = useTextes(tProf);
  const maintenant = useMaintenant(60_000);
  const { data, error, refetch, isLoading } = useAccueilSimple();
  const montres = data ? data.cours.filter((c) => data.montres.includes(c.coursId)) : [];
  const seul = data?.seul ? data.cours.find((c) => c.coursId === data.seul) : undefined;
  // Plus aucun cours caché (José, 15 octobre 2026) : ceux qui ne sont pas « montrés » viennent dessous, en « Mes autres cours ».
  const autres = data ? data.cours.filter((c) => !data.montres.includes(c.coursId)) : [];
  return (
    <Page className="gap-4 pt-4 sm:gap-8 [@media(min-height:701px)_and_(max-height:800px)]:!gap-5 [@media(min-height:701px)_and_(max-height:800px)]:!pt-5 [@media(max-height:700px)]:!gap-3 [@media(max-height:700px)]:!pt-4">
      {/* Écran bas (1024×600) ou téléphone, un seul cours : la date s'efface et le « Bonjour » rétrécit, pour garder les
          quatre blocs du cours entiers à l'écran. */}
      <header className="flex flex-col gap-2 [@media(max-height:700px)]:!gap-1">
        <Etiquette className={seul ? "max-sm:hidden [@media(max-height:700px)]:hidden" : undefined}>{majuscule(jourLong(maintenant))}</Etiquette>
        <h1 className={cn("leading-[1.02] text-encre sm:text-[52px]", seul ? "text-[32px] [@media(max-height:700px)]:!text-[32px]" : "text-[40px]")}>
          {data ? `${data.salutation} ${data.prenom}.` : " "}
        </h1>
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
          <BandeDuCours c={seul} niveau="h2" />
          <BlocsDuCours c={seul} />
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
      ) : !data.cours.length ? (
        <div className="rounded-[28px] border-2 border-ligne bg-creme p-6 shadow-carte sm:p-8" data-aucun-cours>
          <p className="text-[30px] font-black leading-tight">{tp("blocs.aucunCours.titre")}</p>
          <p className="mt-2 text-[22px] text-texte-doux">{tp("blocs.aucunCours.texte")}</p>
        </div>
      ) : (
        <div className="rounded-[28px] border-2 border-ligne bg-creme p-6 shadow-carte sm:p-8">
          <p className="text-[30px] font-black leading-tight">{tx("blocs.aucun.titre")}</p>
          <p className="mt-2 text-[22px] text-texte-doux">{tx("blocs.aucun.texte")}</p>
        </div>
      )}
      {data && autres.length > 0 && (montres.length > 0 || seul) && (
        <section className="flex flex-col gap-4" data-autres-cours>
          <h2 className="text-[30px] text-encre">{tp("blocs.autres")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
            {autres.map((c) => (
              <CarreCours key={c.coursId} c={c} />
            ))}
          </div>
        </section>
      )}
      {data && <LienPlus aFaire={data.aFaire} />}
    </Page>
  );
}
