// /mon-campus/cours/:coursId/notes : « Les notes ». Les notes PUBLIÉES des étudiants du campus, sur 20, en lecture :
// une ligne par étudiant (nom, classe, moyenne, puis chaque note). Champ « Chercher un nom » dès 15 étudiants.
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { t as textesCampus } from "@shared/textes/campus";
import { deCampus, type CoursCampusDto, type NotesCampusDto } from "@shared/espace-campus";
import { BoutonRetour, ErreurCampus, PageCampus, Patience, lienCampus, useApiCampus } from "./composants";

const note = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const sansAccents = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export default function PageNotesCampus({ coursId }: { coursId: string }) {
  const tx = useTextes(textesCampus);
  const id = Number(coursId);
  const { data: c } = useApiCampus<CoursCampusDto>(`/api/mon-campus/cours/${id}`);
  const { data, error, refetch, isLoading } = useApiCampus<NotesCampusDto>(`/api/mon-campus/cours/${id}/notes`);
  const [recherche, setRecherche] = useState("");
  const liste = useMemo(() => {
    const q = sansAccents(recherche.trim());
    return (data?.etudiants ?? []).filter((e) => !q || sansAccents(`${e.prenom} ${e.nom}`).includes(q) || sansAccents(`${e.nom} ${e.prenom}`).includes(q));
  }, [data, recherche]);
  const aucuneNote = data ? data.etudiants.every((e) => e.moyenne === null && Object.values(e.notes).every((n) => n === null)) : false;
  return (
    <PageCampus>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-5 sm:px-8 sm:pt-8">
        <div>
          <BoutonRetour href={lienCampus(`/mon-campus/cours/${id}`)} libelle={tx("retour")} />
        </div>
        <div>
          <h1 className="text-[40px] font-black leading-tight sm:text-[48px]">{tx("bloc.notes")}</h1>
          {c && <p className="text-[22px] text-texte-doux">{c.cours.titre}</p>}
          {data && <p className="mt-1 text-[22px] font-bold">{tx("notes.sousTitre", { v: { deCampus: deCampus(data.campus.nomCourt) } })}</p>}
        </div>
        {isLoading ? (
          <Patience />
        ) : error || !data ? (
          <ErreurCampus message={error instanceof Error ? error.message : undefined} onReessayer={() => void refetch()} />
        ) : aucuneNote ? (
          <p className="rounded-[24px] border-2 border-ligne bg-creme p-6 text-[24px] font-bold shadow-carte">{tx("notes.vide")}</p>
        ) : (
          <>
            {data.etudiants.length >= 15 && (
              <label className="flex min-h-[64px] items-center gap-3 rounded-[20px] border-2 border-ligne bg-white px-4 shadow-carte focus-within:border-orange/60">
                <Search className="h-7 w-7 shrink-0" aria-hidden />
                <span className="sr-only">{tx("notes.chercher")}</span>
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder={tx("notes.chercher")}
                  className="min-h-[56px] w-full bg-transparent text-[22px] outline-none placeholder:text-texte-gris"
                />
              </label>
            )}
            {liste.length === 0 ? (
              <p className="text-[22px] font-bold">{tx("notes.personne")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {liste.map((e) => {
                  const lignes = data.devoirs.filter((d) => e.notes[d.id] !== null && e.notes[d.id] !== undefined).map((d) => `${d.titre} : ${note(e.notes[d.id] as number)}/20`);
                  return (
                    <li key={e.id} className="flex flex-col gap-1 rounded-[22px] border-2 border-ligne bg-white px-5 py-4 shadow-carte" data-etudiant={e.id}>
                      <span className="break-words text-[22px] font-black">
                        {e.nom.toUpperCase()} {e.prenom}
                        {e.classe ? <span className="font-semibold text-texte-doux"> · {e.classe}</span> : null}
                      </span>
                      <span className="text-[20px] font-bold">{e.moyenne !== null ? tx("notes.moyenne", { v: { note: note(e.moyenne) } }) : tx("notes.aucune")}</span>
                      {lignes.length > 0 && <span className="text-[18px] leading-snug text-texte-doux">{lignes.join(" · ")}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>
    </PageCampus>
  );
}
