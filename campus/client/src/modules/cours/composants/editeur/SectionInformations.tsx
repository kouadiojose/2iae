// Éditeur · Informations : titre, description, objectifs, couleur (palette),
// dates, image et, pour l'équipe, le formateur du cours.
import { useRef, useState } from "react";
import { Check, ImagePlus, Trash2 } from "lucide-react";
import { Carte } from "@/components/ui/carte";
import { Champ, ZoneTexte, Selection } from "@/components/ui/champs";
import { Bouton } from "@/components/ui/bouton";
import { toastErreur } from "@/components/ui/toast";
import { televerser } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PALETTE_COURS, texteSur } from "../../outils";
import type { FormulaireCours } from "./formulaire";
import type { OptionsEditionCours } from "@shared/schema";

type Props = {
  form: FormulaireCours;
  modifier: (maj: Partial<FormulaireCours>) => void;
  erreurs: Partial<Record<keyof FormulaireCours, string>>;
  options: OptionsEditionCours | undefined;
};

export function TitreSectionEditeur({ numero, titre, texte }: { numero: string; titre: string; texte?: string }) {
  return (
    <div className="mb-5 flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">{numero}</span>
      <h2 className="text-2xl font-black tracking-serre">{titre}</h2>
      {texte && <p className="text-[15px] text-texte-pale">{texte}</p>}
    </div>
  );
}

export function SectionInformations({ form, modifier, erreurs, options }: Props) {
  const fichierRef = useRef<HTMLInputElement>(null);
  const [envoiImage, setEnvoiImage] = useState(false);

  async function choisirImage(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toastErreur(new Error("Choisissez une image (photo JPEG ou PNG)."));
      return;
    }
    setEnvoiImage(true);
    try {
      const [depose] = await televerser([f], "lecon");
      modifier({ imageUrl: depose.url });
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoiImage(false);
      if (fichierRef.current) fichierRef.current.value = "";
    }
  }

  return (
    <Carte id="informations" className="scroll-mt-24 p-5 sm:p-7">
      <TitreSectionEditeur numero="01" titre="Informations" texte="Ce que les étudiants lisent en arrivant sur le cours." />
      <div className="flex flex-col gap-5">
        <Champ
          libelle="Titre"
          value={form.titre}
          onChange={(e) => modifier({ titre: e.target.value })}
          erreur={erreurs.titre}
          maxLength={140}
          className="[&_input]:text-base"
        />
        <ZoneTexte
          libelle="Description"
          value={form.description}
          onChange={(e) => modifier({ description: e.target.value })}
          rows={4}
          aide="Quelques phrases : ce que le cours apporte et à qui il s'adresse. Mise en forme simple possible (**gras**, listes)."
          maxLength={6000}
          className="[&_textarea]:text-base"
        />
        <ZoneTexte
          libelle="Objectifs"
          value={form.objectifs}
          onChange={(e) => modifier({ objectifs: e.target.value })}
          rows={4}
          placeholder={"Expliquer ce qu'est un modèle de langage\nRédiger une consigne efficace"}
          aide="Un objectif par ligne. Ils s'affichent sous « À la fin, tu sauras »."
          maxLength={3000}
          className="[&_textarea]:text-base"
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-bold">Couleur du cours</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {PALETTE_COURS.map((c) => {
              const actif = form.couleur === c.valeur;
              return (
                <button
                  key={c.valeur}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  aria-label={c.nom}
                  title={c.nom}
                  onClick={() => modifier({ couleur: c.valeur })}
                  className={cn(
                    "grid h-12 place-items-center rounded-xl ring-offset-2 transition-shadow",
                    actif ? "ring-2 ring-encre" : "hover:ring-2 hover:ring-ligne-forte",
                    texteSur(c.valeur) === "encre" ? "text-encre" : "text-white",
                  )}
                  style={{ backgroundColor: c.valeur }}
                >
                  {actif && <Check className="h-5 w-5" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
          <p className="text-[13px] text-texte-gris">{PALETTE_COURS.find((c) => c.valeur === form.couleur)?.nom ?? "Couleur personnalisée"} · en-tête du cours et carte du site.</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ libelle="Début du cours" type="date" value={form.dateDebut} onChange={(e) => modifier({ dateDebut: e.target.value })} className="[&_input]:text-base" />
          <Champ libelle="Fin du cours" type="date" value={form.dateFin} onChange={(e) => modifier({ dateFin: e.target.value })} erreur={erreurs.dateFin} className="[&_input]:text-base" />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">Image</span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid h-24 w-40 shrink-0 place-items-center overflow-hidden rounded-xl border border-ligne" style={{ backgroundColor: form.couleur }}>
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="Image du cours" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className={cn("h-7 w-7", texteSur(form.couleur) === "encre" ? "text-encre/60" : "text-white/70")} />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fichierRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void choisirImage(e.target.files?.[0])} />
              <Bouton variante="contour" chargement={envoiImage} icone={<ImagePlus className="h-4 w-4" />} onClick={() => fichierRef.current?.click()} className="min-h-[48px]">
                {form.imageUrl ? "Changer l'image" : "Choisir une image"}
              </Bouton>
              {form.imageUrl && (
                <Bouton variante="fantome" icone={<Trash2 className="h-4 w-4" />} onClick={() => modifier({ imageUrl: "" })} className="min-h-[48px]">
                  Retirer
                </Bouton>
              )}
            </div>
          </div>
          <p className="text-[13px] text-texte-gris">Format paysage de préférence. Sans image, la couleur du cours s'affiche.</p>
          {erreurs.imageUrl && <p className="text-[13px] font-semibold text-danger">{erreurs.imageUrl}</p>}
        </div>

        {options?.peutChangerFormateur && (
          <Selection libelle="Formateur" value={form.formateurId} onChange={(e) => modifier({ formateurId: e.target.value })} aide="Il est prévenu quand un cours lui est confié." className="[&_select]:text-base">
            <option value="">Aucun formateur pour l'instant</option>
            {options.formateurs?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.prenom} {f.nom}
                {f.localisation ? ` · ${f.localisation}` : ""}
              </option>
            ))}
          </Selection>
        )}
      </div>
    </Carte>
  );
}
