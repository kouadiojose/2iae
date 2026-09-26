// Étape 2 de l'éditeur : la photo (portrait rond ou silhouette détourée) et
// la ville affichée pour l'heure du cours « chez vous ».
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { patch, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Erreur } from "@/components/ui/divers";
import { Selection } from "@/components/ui/champs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { FUSEAUX_UTILES, type FormePhoto, type ShowreelEditionDto } from "@shared/schema";
import { photoTransparente, preparerPhoto, televerserSource } from "../outils";
import { Bloc, textes } from "./communs";

function Apercu({ url, forme, initiales }: { url: string | null; forme: FormePhoto; initiales: string }) {
  return (
    <div className="relative grid h-40 w-40 shrink-0 place-items-center overflow-hidden rounded-[22px] bg-encre">
      <span className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange" aria-hidden />
      {url && forme === "detoure" ? (
        <img src={url} alt="" className="absolute bottom-0 left-1/2 h-[92%] w-auto max-w-none -translate-x-1/2 object-contain" />
      ) : url ? (
        <img src={url} alt="" className="relative h-24 w-24 rounded-full object-cover ring-2 ring-white" />
      ) : (
        <span className="relative text-4xl font-black tracking-serre text-encre">{initiales}</span>
      )}
    </div>
  );
}

export function Photo({ d, surMaj }: { d: ShowreelEditionDto; surMaj: (x: ShowreelEditionDto) => void }) {
  const { t, votre } = textes(d);
  const cible = d.estMoi ? "moi" : String(d.formateur.id);
  const entree = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const url = d.photo?.url ?? d.formateur.photoUrl;
  const initiales = `${d.formateur.prenom.length > 2 ? d.formateur.prenom[0] : ""}${d.formateur.nom[0] ?? ""}`.toUpperCase();

  async function enregistrer(corps: Record<string, unknown>, message?: string) {
    setErreur(null);
    try {
      surMaj(await patch<ShowreelEditionDto>(`/api/showreels/${cible}`, corps));
      if (message) toast(message);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "L'enregistrement n'a pas abouti. Réessayez.");
    }
  }

  async function choisir(f: File | undefined) {
    if (!f) return;
    if (!/^image\//.test(f.type)) return setErreur("Choisissez une image (JPEG, PNG ou WebP).");
    setEnvoi(true);
    setErreur(null);
    try {
      const transparente = await photoTransparente(f);
      const legere = await preparerPhoto(f);
      const recu = await televerserSource(legere);
      await enregistrer({ photoFichierId: recu.id, photoForme: transparente ? "detoure" : "rond" }, transparente ? "Photo détourée reçue : elle se pose sur le décor." : "Photo reçue.");
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "La photo n'a pas été reçue. Réessayez.");
    } finally {
      setEnvoi(false);
      if (entree.current) entree.current.value = "";
    }
  }

  const fuseauProfil = d.formateur.fuseau;
  const c = d.formateur.campus;
  return (
    <Bloc id="photo" numero={2} titre="Photo et heure locale" description={t("Une photo nette de votre visage. Une photo détourée (fond transparent) se pose sur le décor orange.", "Une photo nette de son visage. Une photo détourée (fond transparent) se pose sur le décor orange.")}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Apercu url={url} forme={d.photo ? d.photoForme : "rond"} initiales={initiales} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <input ref={entree} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="photo-presentation" onChange={(e) => void choisir(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Bouton variante={url ? "contour" : "principal"} icone={<ImagePlus className="h-4 w-4" />} chargement={envoi} onClick={() => entree.current?.click()}>
              {d.photo ? "Changer la photo" : "Choisir une photo"}
            </Bouton>
            {d.photo && (
              <Bouton variante="fantome" icone={<Trash2 className="h-4 w-4" />} onClick={() => void enregistrer({ photoFichierId: null }, "Photo retirée.")}>
                Retirer
              </Bouton>
            )}
          </div>
          {!d.photo && d.formateur.photoUrl && <p className="text-[14px] text-texte-pale">{t("En attendant, la photo de votre profil est utilisée.", "En attendant, la photo de son profil est utilisée.")}</p>}
          {d.photo && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-bold">Forme</legend>
              {(
                [
                  ["rond", "Portrait rond", "Pour une photo ordinaire, cadrée sur le visage."],
                  ["detoure", "Silhouette détourée", "Pour une photo sans fond (PNG ou WebP transparent)."],
                ] as const
              ).map(([valeur, libelle, aide]) => (
                <label key={valeur} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3", d.photoForme === valeur ? "border-orange bg-orange-pale" : "border-ligne")}>
                  <input type="radio" name="forme-photo" className="mt-1 h-4 w-4 accent-[#E4793A]" checked={d.photoForme === valeur} onChange={() => void enregistrer({ photoForme: valeur })} />
                  <span className="flex flex-col">
                    <span className="text-[15px] font-semibold">{libelle}</span>
                    <span className="text-[13px] text-texte-gris">{aide}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="mt-1 rounded-xl bg-creme p-3">
            {fuseauProfil ? (
              <p className="text-[14px] text-texte-doux">
                Heure locale : {t("votre fuseau", "son fuseau")} ({fuseauProfil.split("/").pop()?.replace(/_/g, " ")}) vient de {votre} profil.
                {c.heureDebutLocale && c.ville ? ` Le cours est affiché « ${c.heureDebutLocale.replace(":", "h")} à ${c.ville} ».` : ""}
              </p>
            ) : (
              <Selection
                libelle="Ville affichée pour l'heure du cours"
                aide={c.heureDebutLocale && c.ville ? `La présentation affiche « ${c.heureDebutLocale.replace(":", "h")} à ${c.ville} » à côté de l'heure d'Abidjan.` : "Facultatif : l'heure du cours chez le formateur, à côté de l'heure d'Abidjan."}
                value={d.fuseau ?? ""}
                onChange={(e) => void enregistrer({ fuseau: e.target.value || null })}
              >
                <option value="">Aucune (heure d'Abidjan seulement)</option>
                {FUSEAUX_UTILES.filter((f) => f.fuseau !== "Africa/Abidjan").map((f) => (
                  <option key={f.fuseau} value={f.fuseau}>
                    {f.ville} ({f.pays})
                  </option>
                ))}
              </Selection>
            )}
          </div>
          {erreur && <Erreur message={erreur} />}
        </div>
      </div>
    </Bloc>
  );
}
