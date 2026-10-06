// Choix des classes d'un cours, rangées par campus puis par filière, avec la
// sélection rapide : toutes les classes, toute une filière (sur tous les
// campus ou dans un campus), tout un campus. Les sélections rapides ne
// touchent que les campus que la personne peut modifier (la vie scolaire d'un
// campus ne coche que les classes du sien). Éditeur du cours et pilotage.
import { useEffect, useId, useRef } from "react";
import { CheckCheck, Lock, MapPin, X } from "lucide-react";
import { CaseACocher } from "@/components/ui/champs";
import { Bouton } from "@/components/ui/bouton";
import { cn, pluriel } from "@/lib/utils";
import { classeSansSite } from "../outils";
import type { OptionsEditionCours } from "@shared/schema";

type Classe = OptionsEditionCours["sites"][number]["classes"][number];

/** Classes regroupées par filière : le tronc commun d'abord, puis les filières dans l'ordre alphabétique. */
function parFiliere(classes: Classe[]): { filiere: string; classes: Classe[] }[] {
  const groupes = new Map<string, Classe[]>();
  for (const c of classes) groupes.set(c.filiere, [...(groupes.get(c.filiere) ?? []), c]);
  const rang = (f: string) => (/^tronc commun$/i.test(f.trim()) ? 0 : 1);
  return [...groupes]
    .map(([filiere, cs]) => ({ filiere, classes: cs }))
    .sort((a, b) => rang(a.filiere) - rang(b.filiere) || a.filiere.localeCompare(b.filiere, "fr", { sensitivity: "base" }));
}

/** Case d'un groupe : cochée si tout est coché, à moitié si une partie l'est. */
function CaseGroupe({ etat, onChange, libelle, aide, disabled }: { etat: "tout" | "partie" | "rien"; onChange: () => void; libelle: string; aide: string; disabled?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = etat === "partie";
  }, [etat]);
  return (
    <label htmlFor={id} className={cn("flex min-h-[44px] cursor-pointer items-center gap-3", disabled && "cursor-not-allowed opacity-60")}>
      <input ref={ref} id={id} type="checkbox" className="h-5 w-5 shrink-0 accent-[#E4793A]" checked={etat === "tout"} disabled={disabled} onChange={onChange} />
      <span className="flex flex-col">
        <span className="text-[15px] font-extrabold text-encre">{libelle}</span>
        <span className="text-[13px] text-texte-gris">{aide}</span>
      </span>
    </label>
  );
}

export function ChoixClasses({ sites, classeIds, onChange }: { sites: OptionsEditionCours["sites"]; classeIds: Iterable<number>; onChange: (ids: number[]) => void }) {
  const choisies = new Set(classeIds);
  const appliquer = (s: Set<number>) => onChange([...s].sort((a, b) => a - b));
  const basculer = (id: number, oui: boolean) => {
    const s = new Set(choisies);
    if (oui) s.add(id);
    else s.delete(id);
    appliquer(s);
  };
  const etatDe = (ids: number[]): "tout" | "partie" | "rien" => {
    const n = ids.filter((id) => choisies.has(id)).length;
    return n === 0 ? "rien" : n === ids.length ? "tout" : "partie";
  };
  /** Tout coché : on décoche le groupe ; sinon on le coche en entier. */
  const basculerGroupe = (ids: number[]) => {
    if (!ids.length) return;
    const s = new Set(choisies);
    const tout = ids.every((id) => s.has(id));
    for (const id of ids) {
      if (tout) s.delete(id);
      else s.add(id);
    }
    appliquer(s);
  };

  const sitesModifiables = sites.filter((s) => s.modifiable);
  const idsModifiables = sitesModifiables.flatMap((s) => s.classes.map((c) => c.id));
  const filieres = parFiliere(sitesModifiables.flatMap((s) => s.classes)).map((g) => ({
    filiere: g.filiere,
    ids: g.classes.map((c) => c.id),
    campus: sitesModifiables.filter((s) => s.classes.some((c) => c.filiere === g.filiere)).length,
  }));
  const plusieursCampus = sitesModifiables.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {idsModifiables.length > 1 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-ligne p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[15px] font-extrabold">Sélection rapide</span>
            <Bouton
              taille="sm"
              variante={etatDe(idsModifiables) === "tout" ? "encre" : "doux"}
              icone={<CheckCheck className="h-4 w-4" />}
              onClick={() => appliquer(new Set([...choisies, ...idsModifiables]))}
            >
              {plusieursCampus ? `Tous les campus, toutes les classes (${idsModifiables.length})` : `Toutes les classes (${idsModifiables.length})`}
            </Bouton>
            {idsModifiables.some((id) => choisies.has(id)) && (
              <Bouton
                taille="sm"
                variante="fantome"
                icone={<X className="h-4 w-4" />}
                onClick={() => appliquer(new Set([...choisies].filter((id) => !idsModifiables.includes(id))))}
              >
                Tout décocher
              </Bouton>
            )}
          </div>
          {filieres.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-texte-gris">
                {plusieursCampus ? "Toute une filière, sur tous les campus : touchez-la pour la cocher, touchez-la encore pour la décocher." : "Toute une filière : touchez-la pour la cocher, touchez-la encore pour la décocher."}
              </span>
              <div className="flex flex-wrap gap-2">
                {filieres.map((f) => {
                  const etat = etatDe(f.ids);
                  return (
                    <button
                      key={f.filiere}
                      type="button"
                      onClick={() => basculerGroupe(f.ids)}
                      aria-pressed={etat === "tout"}
                      className={cn(
                        "rounded-2xl border-[1.5px] px-3 py-1.5 text-left text-[13px] font-semibold transition-colors",
                        etat === "tout" && "border-orange bg-orange text-encre",
                        etat === "partie" && "border-orange bg-orange-pale text-encre",
                        etat === "rien" && "border-ligne bg-white text-texte-doux hover:border-orange hover:text-encre",
                      )}
                    >
                      {f.filiere}
                      <span className="ml-1.5 font-mono text-[11px] opacity-75">
                        {pluriel(f.ids.length, "classe")}
                        {plusieursCampus ? ` · ${pluriel(f.campus, "campus", "campus")}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {sites.map((s) => {
          const idsSite = s.classes.map((c) => c.id);
          const etatSite = etatDe(idsSite);
          return (
            <fieldset key={s.id} className="flex flex-col gap-2 rounded-2xl border border-ligne p-4" disabled={!s.modifiable}>
              <legend className="flex items-center gap-2 px-1 text-base font-extrabold">
                <MapPin className="h-4 w-4 text-orange-fonce" /> {s.nomCourt}
              </legend>
              {!s.modifiable ? (
                <p className="-mt-1 inline-flex items-center gap-1.5 text-[13px] text-texte-gris">
                  <Lock className="h-3.5 w-3.5" /> Géré par la vie scolaire de ce campus
                </p>
              ) : (
                idsSite.length > 1 && (
                  <div className="-mt-1 mb-1">
                    <Bouton taille="sm" variante={etatSite === "tout" ? "encre" : "contour"} onClick={() => basculerGroupe(idsSite)}>
                      {etatSite === "tout" ? `Décocher tout ${s.nomCourt}` : `Tout le campus ${s.nomCourt} (${idsSite.length})`}
                    </Bouton>
                  </div>
                )
              )}
              {s.classes.length ? (
                parFiliere(s.classes).map((g) =>
                  g.classes.length === 1 ? (
                    <div key={g.filiere} className="flex min-h-[48px] items-center">
                      <CaseACocher
                        checked={choisies.has(g.classes[0].id)}
                        onChange={(v) => basculer(g.classes[0].id, v)}
                        disabled={!s.modifiable}
                        libelle={classeSansSite(g.classes[0].nom, s.nomCourt)}
                        aide={`${g.classes[0].niveau} · ${pluriel(g.classes[0].effectif, "étudiant")}`}
                      />
                    </div>
                  ) : (
                    <div key={g.filiere} className="flex flex-col border-t border-ligne-douce pt-2 first:border-t-0 first:pt-0">
                      <CaseGroupe
                        etat={etatDe(g.classes.map((c) => c.id))}
                        onChange={() => basculerGroupe(g.classes.map((c) => c.id))}
                        disabled={!s.modifiable}
                        libelle={g.filiere}
                        aide={`Toute la filière · ${pluriel(g.classes.length, "classe")}`}
                      />
                      <div className="flex flex-col pl-8">
                        {g.classes.map((c) => (
                          <div key={c.id} className="flex min-h-[44px] items-center">
                            <CaseACocher
                              checked={choisies.has(c.id)}
                              onChange={(v) => basculer(c.id, v)}
                              disabled={!s.modifiable}
                              libelle={c.niveau || classeSansSite(c.nom, s.nomCourt)}
                              aide={pluriel(c.effectif, "étudiant")}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )
              ) : (
                <p className="text-[14px] text-texte-gris">Aucune classe dans ce campus pour l'instant.</p>
              )}
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
