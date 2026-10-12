// Les salles de conférence d'un campus (shared/salles.ts), dans « Les campus » : chaque salle avec
// son nom, son public (L1, L2 ou toutes les classes) et l'état de son écran ; « Ajouter une salle »,
// « Régler » (nom, public) et le bouton de l'écran, qui ouvre l'installation de CETTE salle.
// Droits : ceux de l'installation des écrans (outils_campus).
import { useState } from "react";
import { MonitorSmartphone, Pencil, Plus, Trash2 } from "lucide-react";
import { PUBLICS_SALLE, nomSalleParDefaut, type PublicSalle, type SalleCampus, type SallesDuSite } from "@shared/salles";
import { t as textesSalles } from "@shared/textes/salles";
import { Bouton } from "@/components/ui/bouton";
import { Badge } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { Champ } from "@/components/ui/champs";
import { toast } from "@/components/ui/toast";
import { post, patch, suppr, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { relatif } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";

type Site = { id: number; nomCourt: string; salleConference: string };
export type EcranDeSalle = { id: number; nom: string; numero: number; salle: string };

/** « L1 · 1re année », « Toutes les classes ». */
export function usePublics() {
  const tx = useTextes(textesSalles);
  return {
    libelle: (p: PublicSalle | null) => (p === "L1" ? tx("public.L1") : p === "L2" ? tx("public.L2") : tx("public.tous")),
    detail: (p: PublicSalle | null) => (p === "L1" ? tx("public.L1.detail") : p === "L2" ? tx("public.L2.detail") : tx("public.tous.detail")),
  };
}

export function SallesDuCampus({ site, donnees, onEcran }: { site: Site; donnees: SallesDuSite | undefined; onEcran: (e: EcranDeSalle) => void }) {
  const tx = useTextes(textesSalles);
  const publics = usePublics();
  const [fenetre, setFenetre] = useState<SalleCampus | "nouvelle" | null>(null);
  const salles = donnees?.salles ?? [];
  return (
    <div className="flex flex-col gap-2 border-t border-ligne-douce pt-3">
      <div className="etiquette">{tx("campus.salles")}</div>
      <ul className="flex flex-col gap-2">
        {salles.map((s) => (
          <li key={s.numero} className="flex flex-col gap-2 rounded-xl bg-creme p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong className="text-[15px]">{s.nom}</strong>
              <Badge ton={s.public ? "encre" : "gris"}>{publics.libelle(s.public)}</Badge>
            </div>
            <div className={cn("text-sm", s.ecranInstalle ? "text-succes" : "text-alerte")}>
              {s.ecranInstalle ? (s.vuLe ? tx("campus.ecran.vu", { v: { quand: relatif(s.vuLe) } }) : tx("campus.ecran.installe")) : tx("campus.ecran.aInstaller")}
            </div>
            <div className="flex flex-wrap gap-2">
              <Bouton
                variante="encre"
                taille="sm"
                className="min-h-[44px]"
                icone={<MonitorSmartphone className="h-4 w-4" />}
                onClick={() => onEcran({ id: site.id, nom: site.nomCourt, numero: s.numero, salle: s.nom })}
                aria-label={`${tx("campus.installer")} · ${s.nom}`}
              >
                {tx("campus.installer")}
              </Bouton>
              <Bouton variante="contour" taille="sm" className="min-h-[44px]" icone={<Pencil className="h-4 w-4" />} onClick={() => setFenetre(s)} aria-label={`${tx("campus.regler")} · ${s.nom}`}>
                {tx("campus.regler")}
              </Bouton>
            </div>
          </li>
        ))}
      </ul>
      <Bouton variante="fantome" taille="sm" className="min-h-[44px] self-start" icone={<Plus className="h-4 w-4" />} onClick={() => setFenetre("nouvelle")}>
        {tx("campus.ajouter")}
      </Bouton>
      {fenetre && <FenetreSalle key={fenetre === "nouvelle" ? "nouvelle" : fenetre.numero} site={site} salle={fenetre} prochain={salles.length + 1} onFermer={() => setFenetre(null)} />}
    </div>
  );
}

function FenetreSalle({ site, salle, prochain, onFermer }: { site: Site; salle: SalleCampus | "nouvelle"; prochain: number; onFermer: () => void }) {
  const tx = useTextes(textesSalles);
  const publics = usePublics();
  const ajout = salle === "nouvelle";
  const [nom, setNom] = useState(ajout ? nomSalleParDefaut(prochain) : salle.numero === 1 && salle.nom === site.salleConference ? "" : salle.nom);
  const [pub, setPub] = useState<PublicSalle | null>(ajout ? null : salle.public);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const premiere = !ajout && salle.numero === 1;

  const apres = async () => {
    await rafraichir("/api/pilotage/salles", "/api/pilotage/rentree");
    onFermer();
  };
  const enregistrer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      if (ajout) {
        await post(`/api/pilotage/sites/${site.id}/salles`, { nom: nom.trim(), public: pub });
        toast(tx("toast.ajoutee"));
      } else {
        await patch(`/api/pilotage/sites/${site.id}/salles/${salle.numero}`, { nom: nom.trim(), public: pub });
        toast(tx("toast.enregistree"));
      }
      await apres();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : tx("erreur"));
    } finally {
      setEnvoi(false);
    }
  };
  const retirer = async () => {
    if (ajout || !window.confirm(tx("fenetre.retirer.confirmer", { v: { salle: salle.nom } }))) return;
    setEnvoi(true);
    try {
      await suppr(`/api/pilotage/sites/${site.id}/salles/${salle.numero}`);
      toast(tx("toast.retiree"));
      await apres();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : tx("erreur"));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre={ajout ? tx("fenetre.ajout.titre", { v: { campus: site.nomCourt } }) : tx("fenetre.reglage.titre", { v: { salle: salle.nom, campus: site.nomCourt } })}
      description={ajout ? tx("fenetre.ajout.description") : tx("fenetre.reglage.description")}
      pied={
        <Bouton onClick={() => void enregistrer()} chargement={envoi} disabled={!premiere && nom.trim().length < 2}>
          {ajout ? tx("fenetre.ajouter") : tx("fenetre.enregistrer")}
        </Bouton>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Champ
          libelle={tx("fenetre.nom")}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder={premiere ? site.salleConference : nomSalleParDefaut(prochain)}
          maxLength={60}
          aide={premiere ? `${tx("fenetre.nom.aide")} ${tx("fenetre.nom.aide1", { v: { nom: site.salleConference } })}` : tx("fenetre.nom.aide")}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[15px] font-bold">{tx("fenetre.public")}</legend>
          {[...PUBLICS_SALLE, null].map((p) => (
            <label
              key={p ?? "tous"}
              className={cn(
                "flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-4 py-2",
                pub === p ? "border-encre bg-orange-pale" : "border-ligne bg-white hover:border-orange",
              )}
            >
              <input type="radio" name="public-salle" className="h-5 w-5 accent-[#141414]" checked={pub === p} onChange={() => setPub(p)} />
              <span className="flex flex-col">
                <span className="font-bold">{publics.libelle(p)}</span>
                <span className="text-sm text-texte-pale">{publics.detail(p)}</span>
              </span>
            </label>
          ))}
          <p className="text-sm text-texte-pale">{tx("fenetre.public.aide")}</p>
        </fieldset>
        {erreur && (
          <p role="alert" className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">
            {erreur}
          </p>
        )}
        {!ajout && salle.numero > 1 && (
          <button type="button" onClick={() => void retirer()} className="flex min-h-[44px] items-center gap-2 self-start text-sm font-bold text-danger hover:text-encre">
            <Trash2 className="h-4 w-4" /> {tx("fenetre.retirer")}
          </button>
        )}
      </div>
    </Fenetre>
  );
}
