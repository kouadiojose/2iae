// /mon-campus : l'accueil du compte de campus. En haut, la bande crème : « ESPACE DU CAMPUS », « Campus de
// Yamoussoukro », la date et « Touchez le carré du cours. » ; puis UN GROS CARRÉ PAR COURS que suit le campus, dans un
// dégradé doux de sa couleur, le nom en très gros, et un repère simple : « En direct maintenant » (point vivant),
// « Salle ouverte · début à 8h30 », « Aujourd'hui à 8h30 », ou rien. D'abord « Aujourd'hui », puis « Les autres
// cours ». Rien d'autre autour : ni menu, ni cloche.
import { useTextes } from "@/lib/textes";
import { t as textesCampus } from "@shared/textes/campus";
import { type CarreCampusDto, type EspaceCampusDto } from "@shared/espace-campus";
import { Carre, EnTeteCampus, ErreurCampus, PageCampus, Patience, lienCampus, useApiCampus } from "./composants";

function Grille({ cours }: { cours: CarreCampusDto[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 [@media(max-height:800px)]:!gap-4">
      {cours.map((c) => (
        <Carre key={c.coursId} carre={c} href={lienCampus(`/mon-campus/cours/${c.coursId}`)} />
      ))}
    </div>
  );
}

export default function PageAccueilCampus() {
  const tx = useTextes(textesCampus);
  const { data, error, refetch, isLoading } = useApiCampus<EspaceCampusDto>("/api/mon-campus");
  const aujourdhui = data?.cours.filter((c) => c.repere) ?? [];
  const autres = data?.cours.filter((c) => !c.repere) ?? [];
  return (
    <PageCampus>
      <EnTeteCampus apercu={data?.apercu} campus={data?.campus.nomCourt} accueil={data ? { libelle: data.libelle, consigne: data.cours.length > 0 } : undefined} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 sm:px-8 sm:pt-10 [@media(max-height:800px)]:!gap-5 [@media(max-height:800px)]:!pt-4">
        {isLoading ? (
          <Patience />
        ) : error || !data ? (
          <ErreurCampus message={error instanceof Error ? error.message : undefined} onReessayer={() => void refetch()} />
        ) : data.cours.length === 0 ? (
          <div className="rounded-[28px] border-2 border-ligne bg-creme p-6 shadow-carte sm:p-8">
            <p className="text-[30px] font-black leading-tight">{tx("accueil.vide.titre")}</p>
            <p className="mt-2 text-[22px] text-texte-doux">{tx("accueil.vide.texte")}</p>
          </div>
        ) : (
          <>
            {aujourdhui.length > 0 && (
              <section className="flex flex-col gap-5 [@media(max-height:800px)]:gap-3" data-section="aujourdhui">
                {autres.length > 0 && <h2 className="text-[32px] leading-tight text-encre [@media(max-height:800px)]:text-[28px]">{tx("accueil.aujourdhui")}</h2>}
                <Grille cours={aujourdhui} />
              </section>
            )}
            {autres.length > 0 && (
              <section className="flex flex-col gap-5 [@media(max-height:800px)]:gap-3" data-section="autres">
                {aujourdhui.length > 0 && <h2 className="text-[32px] leading-tight text-encre [@media(max-height:800px)]:text-[28px]">{tx("accueil.autres")}</h2>}
                <Grille cours={autres} />
              </section>
            )}
          </>
        )}
      </main>
    </PageCampus>
  );
}
