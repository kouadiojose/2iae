// Choisir « pour qui » (niveau puis filière, tous campus confondus), sorti de PageFaireUnCours pour servir aussi à
// l'écran de fin de séance (ConfirmerSeance : « Un nouveau cours »). Comportement identique à celui de « Faire un cours ».
import { useMemo, useState, type ReactNode } from "react";
import { Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OptionsEditionCours } from "@shared/schema";

/** Un gros choix à toucher (56 px au moins), coché quand il est choisi. */
export function Choix({ actif, onClick, children, sous, icone, className }: { actif: boolean; onClick: () => void; children: ReactNode; sous?: ReactNode; icone?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        "flex min-h-[64px] items-center gap-3 rounded-[20px] border-2 px-5 py-3 text-left text-[20px] font-black leading-tight transition-colors",
        actif ? "border-orange bg-orange text-encre shadow-carte" : "border-ligne bg-white text-encre hover:border-orange",
        className,
      )}
    >
      {icone && <span className="shrink-0">{icone}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="break-words">{children}</span>
        {sous && <span className={cn("text-[15px] font-semibold", actif ? "text-encre/80" : "text-texte-doux")}>{sous}</span>}
      </span>
      {actif && <Check className="h-6 w-6 shrink-0" strokeWidth={3} />}
    </button>
  );
}

const basculer = (liste: string[], v: string) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);

/**
 * Le sélecteur de classes : l'état (niveaux, filières cochées), les identifiants de classes choisis, l'effectif, la
 * remise à zéro et le bloc « Pour qui ? » à afficher.
 */
export function useChoixClasses(options: OptionsEditionCours | undefined) {
  const [niveaux, setNiveaux] = useState<string[]>([]);
  /** Filières cochées, « niveau|filière ». Aucune pour un niveau : toutes ses filières. */
  const [filieres, setFilieres] = useState<string[]>([]);
  const [affiner, setAffiner] = useState(false);
  /** Les classes sans étudiant restent repliées (« Voir les autres classes »). */
  const [toutes, setToutes] = useState(false);

  // Les classes que la personne peut choisir, regroupées par niveau puis par filière, tous campus confondus.
  const parNiveau = useMemo(() => {
    const m = new Map<string, { effectif: number; filieres: Map<string, { effectif: number; ids: number[] }> }>();
    for (const s of options?.sites ?? []) {
      if (!s.modifiable) continue;
      for (const c of s.classes) {
        const n = m.get(c.niveau) ?? { effectif: 0, filieres: new Map() };
        const f = n.filieres.get(c.filiere) ?? { effectif: 0, ids: [] };
        f.effectif += c.effectif;
        f.ids.push(c.id);
        n.effectif += c.effectif;
        n.filieres.set(c.filiere, f);
        m.set(c.niveau, n);
      }
    }
    // Les classes qui ont des étudiants d'abord, les plus nombreuses en tête.
    return [...m.entries()].sort((a, b) => b[1].effectif - a[1].effectif || a[0].localeCompare(b[0], "fr"));
  }, [options]);

  const classeIds = useMemo(() => {
    const ids: number[] = [];
    for (const [niveau, n] of parNiveau) {
      if (!niveaux.includes(niveau)) continue;
      const cochees = [...n.filieres.keys()].filter((f) => filieres.includes(`${niveau}|${f}`));
      for (const [f, x] of n.filieres) if (!cochees.length || cochees.includes(f)) ids.push(...x.ids);
    }
    return ids;
  }, [parNiveau, niveaux, filieres]);
  const effectif = useMemo(() => {
    let t = 0;
    for (const [niveau, n] of parNiveau) {
      if (!niveaux.includes(niveau)) continue;
      const cochees = [...n.filieres.keys()].filter((f) => filieres.includes(`${niveau}|${f}`));
      for (const [f, x] of n.filieres) if (!cochees.length || cochees.includes(f)) t += x.effectif;
    }
    return t;
  }, [parNiveau, niveaux, filieres]);

  const reinitialiser = () => {
    setNiveaux([]);
    setFilieres([]);
  };

  const vue = (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-[20px] font-black">
        <Users className="h-5 w-5" /> Pour qui ?
      </span>
      <p className="text-[16px] text-texte-doux">Tous les campus sont compris. Touchez une ou plusieurs classes.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {parNiveau
          .filter(([niveau, n]) => toutes || n.effectif > 0 || niveaux.includes(niveau) || !parNiveau.some(([, x]) => x.effectif > 0))
          .map(([niveau, n]) => (
            <Choix
              key={niveau}
              actif={niveaux.includes(niveau)}
              onClick={() => {
                setNiveaux((l) => basculer(l, niveau));
                setFilieres((l) => l.filter((x) => !x.startsWith(`${niveau}|`)));
              }}
              sous={`${n.effectif} étudiant${n.effectif > 1 ? "s" : ""} · ${n.filieres.size} filière${n.filieres.size > 1 ? "s" : ""}`}
            >
              {niveau}
            </Choix>
          ))}
      </div>
      {!parNiveau.length && <p className="text-[18px] font-bold text-texte-doux">Les classes arrivent…</p>}
      {!toutes && parNiveau.some(([, n]) => n.effectif > 0) && parNiveau.some(([, n]) => n.effectif === 0) && (
        <button type="button" onClick={() => setToutes(true)} className="min-h-[44px] self-start text-[17px] font-bold text-orange-profond underline underline-offset-4">
          Voir les autres classes
        </button>
      )}
      {niveaux.length > 0 && (
        <>
          <button type="button" onClick={() => setAffiner((v) => !v)} className="min-h-[44px] self-start text-[17px] font-bold text-orange-profond underline underline-offset-4">
            {affiner ? "Garder toutes les filières" : "Seulement certaines filières ?"}
          </button>
          {affiner &&
            parNiveau
              .filter(([niveau]) => niveaux.includes(niveau))
              .map(([niveau, n]) => (
                <div key={niveau} className="flex flex-col gap-2">
                  <span className="text-[16px] font-black uppercase tracking-wide text-texte-doux">{niveau}</span>
                  <div className="flex flex-wrap gap-2">
                    {[...n.filieres.entries()]
                      .sort((a, b) => a[0].localeCompare(b[0], "fr"))
                      .map(([f, x]) => {
                        const cle = `${niveau}|${f}`;
                        const actif = filieres.includes(cle);
                        return (
                          <button
                            key={cle}
                            type="button"
                            aria-pressed={actif}
                            onClick={() => setFilieres((l) => basculer(l, cle))}
                            className={cn("min-h-[48px] rounded-full border-2 px-4 text-[16px] font-bold", actif ? "border-orange bg-orange text-encre" : "border-ligne bg-white")}
                          >
                            {f} · {x.effectif}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
          <p className="rounded-[16px] bg-white px-4 py-3 text-[18px] font-bold" role="status">
            {effectif} étudiant{effectif > 1 ? "s" : ""} suivront ce cours.
          </p>
        </>
      )}
    </div>
  );

  return { classeIds, effectif, reinitialiser, vue };
}
