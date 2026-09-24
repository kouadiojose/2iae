// Carte d'identité du profil : photo (changer, retirer), nom, classe, campus.
import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { patch, televerser, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Avatar } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { nomComplet } from "@/lib/utils";
import { LIBELLES_ROLES, type Moi } from "@shared/schema";
import { majMoi, tuOuVous } from "../../outils";
import { Ligne } from "./Section";

export function CartePhoto({ moi }: { moi: Moi }) {
  const t = tuOuVous(moi);
  const champ = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);

  async function changer(f: File | undefined) {
    if (champ.current) champ.current.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast(t("Choisis une photo.", "Choisissez une photo."), "erreur");
    setEnvoi(true);
    try {
      const [fichier] = await televerser([f], "avatar");
      majMoi(await patch<Moi>("/api/compte/profil", { photoFichierId: fichier.id }));
      toast(t("Ta photo est à jour.", "Votre photo est à jour."));
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : t("La photo n'a pas pu être envoyée. Réessaie.", "La photo n'a pas pu être envoyée."), "erreur");
    } finally {
      setEnvoi(false);
    }
  }

  async function retirer() {
    setEnvoi(true);
    try {
      majMoi(await patch<Moi>("/api/compte/profil", { photoFichierId: null }));
      toast(t("Photo retirée.", "Photo retirée."));
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Une erreur est survenue.", "erreur");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="rounded-[22px] border border-ligne bg-white p-5 sm:p-6">
      <div className="flex items-center gap-4 lg:flex-col lg:items-start">
        <div className="relative">
          <Avatar prenom={moi.prenom} nom={moi.nom} photo={moi.photoUrl} taille={96} className="ring-4 ring-creme" />
          <button
            type="button"
            onClick={() => champ.current?.click()}
            disabled={envoi}
            className="absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full bg-encre text-white ring-4 ring-white hover:bg-orange hover:text-encre disabled:opacity-60"
            aria-label={t("Changer ma photo", "Changer ma photo")}
          >
            <Camera className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="min-w-0">
          <p className="text-[22px] font-black leading-tight tracking-serre">{nomComplet(moi)}</p>
          <p className="font-mono text-xs text-texte-gris">
            {LIBELLES_ROLES[moi.role]}
            {moi.site ? ` · ${moi.site.nomCourt}` : ""}
          </p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-ligne-douce border-t border-ligne-douce">
        {moi.classe && <Ligne libelle="Classe">{moi.classe.nom}</Ligne>}
        {moi.site && <Ligne libelle="Campus">{moi.site.nom}</Ligne>}
        {moi.matricule && <Ligne libelle="Matricule">{moi.matricule}</Ligne>}
        {moi.titre && moi.role === "formateur" && <Ligne libelle="Titre">{moi.titre}</Ligne>}
      </dl>
      <input ref={champ} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void changer(e.target.files?.[0])} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Bouton variante="doux" icone={<Camera className="h-4 w-4" />} chargement={envoi} onClick={() => champ.current?.click()} className="min-h-[48px] flex-1 whitespace-nowrap">
          {moi.photoUrl ? "Changer ma photo" : "Ajouter ma photo"}
        </Bouton>
        {moi.photoUrl && (
          <Bouton variante="fantome" icone={<Trash2 className="h-4 w-4" />} disabled={envoi} onClick={() => void retirer()} className="min-h-[48px]">
            Retirer
          </Bouton>
        )}
      </div>
      {moi.role === "etudiant" && <p className="mt-3 text-[13px] leading-snug text-texte-gris">Une photo où l'on voit bien ton visage aide tes formateurs à te reconnaître.</p>}
    </div>
  );
}
