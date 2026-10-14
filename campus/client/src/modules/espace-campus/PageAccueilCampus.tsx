// /mon-campus : l'accueil du compte de campus. En haut « Campus de Yamoussoukro », puis UN GROS CARRÉ PAR COURS
// que suit le campus, en couleur, le nom en très gros, et un repère simple : « En direct maintenant », « Salle
// ouverte · début à 8h30 », « Aujourd'hui à 8h30 », ou rien. Rien d'autre autour : ni menu, ni cloche.
import { useTextes } from "@/lib/textes";
import { t as textesCampus } from "@shared/textes/campus";
import { deCampus, type EspaceCampusDto } from "@shared/espace-campus";
import { Carre, EnTeteCampus, ErreurCampus, PageCampus, Patience, lienCampus, useApiCampus } from "./composants";

export default function PageAccueilCampus() {
  const tx = useTextes(textesCampus);
  const { data, error, refetch, isLoading } = useApiCampus<EspaceCampusDto>("/api/mon-campus");
  return (
    <PageCampus>
      <EnTeteCampus apercu={data?.apercu} campus={data?.campus.nomCourt} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 sm:px-8 sm:pt-8">
        {isLoading ? (
          <Patience />
        ) : error || !data ? (
          <ErreurCampus message={error instanceof Error ? error.message : undefined} onReessayer={() => void refetch()} />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-[40px] font-black leading-[1.05] sm:text-[56px]">{tx("accueil.titre", { v: { deCampus: deCampus(data.campus.nomCourt) } })}</h1>
              <p className="text-[22px] text-texte-doux">{data.libelle}</p>
              {data.cours.length > 0 && <p className="text-[22px] font-bold">{tx("accueil.consigne")}</p>}
            </div>
            {data.cours.length === 0 ? (
              <div className="rounded-[24px] border-[3px] border-encre p-6 sm:p-8">
                <p className="text-[30px] font-black leading-tight">{tx("accueil.vide.titre")}</p>
                <p className="mt-2 text-[22px] text-texte-doux">{tx("accueil.vide.texte")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {data.cours.map((c) => (
                  <Carre key={c.coursId} carre={c} href={lienCampus(`/mon-campus/cours/${c.coursId}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </PageCampus>
  );
}
