// Grille de critères d'un devoir (sert à la correction et à l'aide de l'IA).
// Le total doit égaler le barème : la note est la somme des critères.
import { Plus, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import type { CritereGrille } from "@shared/schema";
import { nombre } from "../outils";

export function EditeurGrille({
  grille,
  onChange,
  bareme,
  onBareme,
}: {
  grille: CritereGrille[];
  onChange: (g: CritereGrille[]) => void;
  bareme: number;
  onBareme: (b: number) => void;
}) {
  const total = Math.round(grille.reduce((s, c) => s + (Number(c.points) || 0), 0) * 100) / 100;
  const maj = (i: number, champ: Partial<CritereGrille>) => onChange(grille.map((c, j) => (j === i ? { ...c, ...champ } : c)));
  return (
    <div className="flex flex-col gap-3">
      {grille.length === 0 && (
        <p className="rounded-xl bg-creme px-4 py-3 text-sm text-texte-pale">
          Sans grille, vous mettez une note globale. Avec une grille, vous notez critère par critère : la note est plus juste et plus facile à expliquer.
        </p>
      )}
      {grille.map((c, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-2xl border border-ligne p-3">
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-bold text-texte-pale">Critère {i + 1}</span>
              <input
                value={c.critere}
                onChange={(e) => maj(i, { critere: e.target.value })}
                placeholder="Ex. : Clients bien décrits"
                className="min-h-[48px] w-full rounded-xl border border-ligne px-3 text-[15px] outline-none focus:border-orange"
              />
            </label>
            <label className="flex w-24 flex-col gap-1">
              <span className="text-xs font-bold text-texte-pale">Points</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={Number.isFinite(c.points) ? c.points : ""}
                onChange={(e) => maj(i, { points: e.target.value === "" ? 0 : Number(e.target.value) })}
                className="min-h-[48px] w-full rounded-xl border border-ligne px-3 text-[15px] tabular-nums outline-none focus:border-orange"
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(grille.filter((_, j) => j !== i))}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-danger hover:bg-danger-clair"
              aria-label={`Retirer le critère ${i + 1}`}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
          <input
            value={c.description ?? ""}
            onChange={(e) => maj(i, { description: e.target.value || undefined })}
            placeholder="Ce qui est attendu (facultatif, visible des étudiants)"
            className="min-h-[44px] w-full rounded-xl border border-ligne-douce bg-creme/50 px-3 text-sm outline-none focus:border-orange"
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} onClick={() => onChange([...grille, { critere: "", points: 5 }])} className="min-h-[48px]">
          Ajouter un critère
        </Bouton>
        {grille.length > 0 && (
          <span className={`text-sm font-semibold ${Math.abs(total - bareme) < 0.001 ? "text-succes" : "text-danger"}`}>
            Total : {nombre(total)} / {nombre(bareme)} points
          </span>
        )}
      </div>
      {grille.length > 0 && Math.abs(total - bareme) >= 0.001 && total > 0 && (
        <Bouton variante="contour" taille="sm" onClick={() => onBareme(total)} className="self-start">
          Mettre le barème à {nombre(total)}
        </Bouton>
      )}
    </div>
  );
}
