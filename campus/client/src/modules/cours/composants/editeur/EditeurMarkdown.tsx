// Éditeur Markdown minimal : « Écrire » / « Aperçu », quatre boutons de mise
// en forme. Le rendu est celui que verront les étudiants (Markdown du campus).
import { useRef, useState } from "react";
import { Bold, Heading2, List, Quote } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

export function EditeurMarkdown({ valeur, onChange, libelle = "Contenu de la leçon" }: { valeur: string; onChange: (v: string) => void; libelle?: string }) {
  const [mode, setMode] = useState<"ecrire" | "apercu">("ecrire");
  const zone = useRef<HTMLTextAreaElement>(null);

  /** Entoure la sélection (gras) ou préfixe les lignes sélectionnées (titre, liste, citation). */
  function inserer(avant: string, apres = "", enDebutDeLigne = false) {
    const t = zone.current;
    if (!t) return;
    const { selectionStart: debut, selectionEnd: fin } = t;
    let nouveau: string;
    let curseur: number;
    if (enDebutDeLigne) {
      const debutLigne = valeur.lastIndexOf("\n", debut - 1) + 1;
      const bloc = valeur.slice(debutLigne, fin);
      const prefixe = bloc
        .split("\n")
        .map((l) => `${avant}${l}`)
        .join("\n");
      nouveau = valeur.slice(0, debutLigne) + prefixe + valeur.slice(fin);
      curseur = debutLigne + prefixe.length;
    } else {
      const choisi = valeur.slice(debut, fin) || "texte";
      nouveau = valeur.slice(0, debut) + avant + choisi + apres + valeur.slice(fin);
      curseur = debut + avant.length + choisi.length + apres.length;
    }
    onChange(nouveau);
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(curseur, curseur);
    });
  }

  const outils = [
    { icone: Heading2, libelle: "Titre", action: () => inserer("## ", "", true) },
    { icone: Bold, libelle: "Gras", action: () => inserer("**", "**") },
    { icone: List, libelle: "Liste", action: () => inserer("- ", "", true) },
    { icone: Quote, libelle: "Citation", action: () => inserer("> ", "", true) },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{libelle}</span>
        <div role="tablist" className="flex rounded-xl bg-creme p-1">
          {(["ecrire", "apercu"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn("min-h-[40px] rounded-lg px-4 text-sm font-bold", mode === m ? "bg-white text-encre shadow-sm" : "text-texte-pale hover:text-encre")}
            >
              {m === "ecrire" ? "Écrire" : "Aperçu"}
            </button>
          ))}
        </div>
      </div>
      {mode === "ecrire" ? (
        <div className="overflow-hidden rounded-xl border border-ligne focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/20">
          <div className="flex gap-1 border-b border-ligne-douce bg-creme/60 px-2 py-1.5">
            {outils.map((o) => (
              <button
                key={o.libelle}
                type="button"
                onClick={o.action}
                className="grid h-10 w-10 place-items-center rounded-lg text-texte-doux hover:bg-white hover:text-encre"
                aria-label={o.libelle}
                title={o.libelle}
              >
                <o.icone className="h-[18px] w-[18px]" />
              </button>
            ))}
          </div>
          <textarea
            ref={zone}
            value={valeur}
            onChange={(e) => onChange(e.target.value)}
            rows={12}
            aria-label={libelle}
            placeholder={"## Une idée par partie\n\nÉcrivez simplement. Des exemples d'ici parlent mieux : un maquis, une coopérative de cacao, le marché d'Adjamé…\n\n- une liste\n- à puces"}
            className="block w-full resize-y bg-white px-4 py-3 text-base leading-relaxed text-encre outline-none placeholder:text-texte-gris"
          />
        </div>
      ) : (
        <div className="min-h-[200px] rounded-xl border border-ligne bg-white px-4 py-2">
          {valeur.trim() ? <Markdown source={valeur} className="text-base" /> : <p className="py-6 text-center text-texte-gris">Rien à afficher pour l'instant.</p>}
        </div>
      )}
      <p className="text-[13px] text-texte-gris">## Titre · **gras** · *italique* · - liste · &gt; citation · [texte](https://lien)</p>
    </div>
  );
}
