// Éditeur · Classes et campus : le résumé de la sélection, puis le choix des
// classes (sélection rapide par campus, par filière ou tout d'un coup).
import { Carte } from "@/components/ui/carte";
import { Chargement } from "@/components/ui/divers";
import { pluriel } from "@/lib/utils";
import { ChoixClasses } from "../ChoixClasses";
import { TitreSectionEditeur } from "./SectionInformations";
import type { OptionsEditionCours } from "@shared/schema";

export function SectionClasses({
  classeIds,
  onChange,
  options,
}: {
  classeIds: number[];
  onChange: (ids: number[]) => void;
  options: OptionsEditionCours | undefined;
}) {
  const choisies = new Set(classeIds);
  const toutes = options?.sites.flatMap((s) => s.classes.map((c) => ({ ...c, siteId: s.id }))) ?? [];
  const cochees = toutes.filter((c) => choisies.has(c.id));
  const nbCampus = new Set(cochees.map((c) => c.siteId)).size;
  const nbEtudiants = cochees.reduce((n, c) => n + c.effectif, 0);

  return (
    <Carte id="classes" className="scroll-mt-24 p-5 sm:p-7">
      <TitreSectionEditeur numero="02" titre="Classes et campus" texte="Les étudiants des classes cochées voient le cours dès qu'il est publié." />
      {!options ? (
        <Chargement lignes={2} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl bg-creme px-4 py-3 text-[15px] font-semibold">
            {cochees.length
              ? `${pluriel(cochees.length, "classe")} · ${pluriel(nbCampus, "campus", "campus")} · ${pluriel(nbEtudiants, "étudiant")}`
              : "Aucune classe cochée : personne ne verra le cours."}
          </p>
          <ChoixClasses sites={options.sites} classeIds={classeIds} onChange={onChange} />
        </div>
      )}
    </Carte>
  );
}
