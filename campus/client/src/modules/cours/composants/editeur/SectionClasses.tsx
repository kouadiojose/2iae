// Éditeur · Classes et campus : une case par classe, rangées par campus. La
// vie scolaire d'un campus ne coche que les classes du sien.
import { Lock, MapPin } from "lucide-react";
import { Carte } from "@/components/ui/carte";
import { CaseACocher } from "@/components/ui/champs";
import { Chargement } from "@/components/ui/divers";
import { pluriel } from "@/lib/utils";
import { classeSansSite } from "../../outils";
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
  const basculer = (id: number, oui: boolean) => {
    const s = new Set(choisies);
    if (oui) s.add(id);
    else s.delete(id);
    onChange([...s].sort((a, b) => a - b));
  };

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
          <div className="grid gap-3 sm:grid-cols-2">
            {options.sites.map((s) => (
              <fieldset key={s.id} className="flex flex-col gap-3 rounded-2xl border border-ligne p-4" disabled={!s.modifiable}>
                <legend className="flex items-center gap-2 px-1 text-base font-extrabold">
                  <MapPin className="h-4 w-4 text-orange-fonce" /> {s.nomCourt}
                </legend>
                {!s.modifiable && (
                  <p className="-mt-1 inline-flex items-center gap-1.5 text-[13px] text-texte-gris">
                    <Lock className="h-3.5 w-3.5" /> Géré par la vie scolaire de ce campus
                  </p>
                )}
                {s.classes.length ? (
                  s.classes.map((c) => (
                    <div key={c.id} className="flex min-h-[48px] items-center">
                      <CaseACocher
                        checked={choisies.has(c.id)}
                        onChange={(v) => basculer(c.id, v)}
                        disabled={!s.modifiable}
                        libelle={classeSansSite(c.nom, s.nomCourt)}
                        aide={`${c.niveau} · ${pluriel(c.effectif, "étudiant")}`}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-[14px] text-texte-gris">Aucune classe dans ce campus pour l'instant.</p>
                )}
              </fieldset>
            ))}
          </div>
        </div>
      )}
    </Carte>
  );
}
