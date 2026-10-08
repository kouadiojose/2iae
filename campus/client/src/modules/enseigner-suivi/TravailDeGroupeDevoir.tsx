// Emplacement du dépôt du travail de groupe dans le cours complet (chantier
// C7, placé par le socle C0 dans l'onglet « Travail de groupe »).
//
// Formateur du cours (ou direction) : « Ouvrir le travail de groupe en
// devoir » crée un BROUILLON (sujet, rôles, livrable, date limite proposée)
// qu'il relit dans l'éditeur des devoirs avant de le publier ; ensuite, le
// nombre de copies rendues. Étudiant : une fois le devoir publié, « Rendre le
// travail de ton groupe » mène au vrai devoir à dépôt (photo, fichier ou
// texte, reçu, envoi possible hors ligne). Rien tant qu'il n'est pas publié.
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, FilePlus2, PenLine } from "lucide-react";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { formaterDate } from "@shared/textes";
import { selonNombre, t } from "@shared/textes/enseigner";
import type { TravailDeGroupeDto } from "@shared/engagement/enseigner";

export function TravailDeGroupeDevoir({ seanceId, etudiant }: { seanceId: number; etudiant: boolean }) {
  const tx = useTextes(t);
  const [, naviguer] = useLocation();
  const cle = `/api/seances/${seanceId}/travail-de-groupe`;
  const { data } = useQuery<TravailDeGroupeDto>({ queryKey: [cle] });
  const [envoi, setEnvoi] = useState(false);
  if (!data) return null;

  if (etudiant) {
    if (!data.devoirId || !data.lien) return null;
    if (data.monRendu) {
      return (
        <div className="flex flex-col gap-2 rounded-2xl bg-succes-clair p-3 sm:flex-row sm:items-center">
          <p className="flex flex-1 items-center gap-2 text-[15px] font-bold text-succes">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
            {tx("groupe.rendu", { v: { recu: data.monRendu.recu ?? "" } })}
          </p>
          <LienBouton href={data.lien} variante="contour" className="min-h-[48px]">
            {tx("groupe.voirRendu")}
          </LienBouton>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <LienBouton href={data.lien} taille="lg" className="min-h-[56px] w-full">
          {tx("groupe.rendre")} <ArrowRight className="h-5 w-5" aria-hidden />
        </LienBouton>
        {data.dateLimite && <p className="text-center text-sm text-texte-pale">{tx("groupe.rendre.aide", { v: { date: formaterDate(data.dateLimite, { style: "jour" }) } })}</p>}
      </div>
    );
  }

  // Formateur, direction : le devoir existe déjà.
  if (data.devoirId) {
    if (!data.lien) return null;
    return data.publie ? (
      <div className="flex flex-col gap-2 rounded-2xl bg-creme p-3 sm:flex-row sm:items-center">
        <p className="flex flex-1 items-center gap-2 text-[15px] font-bold">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-succes" aria-hidden />
          {selonNombre(tx, "groupe.publie", data.rendus ?? 0)}
        </p>
        <LienBouton href={data.lien} variante="contour" className="min-h-[48px]">
          {tx("groupe.voirCopies")}
        </LienBouton>
      </div>
    ) : (
      <div className="flex flex-col gap-2 rounded-2xl bg-orange-pale p-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-[15px] font-semibold">{tx("groupe.brouillon")}</p>
        <LienBouton href={data.lien} icone={<PenLine className="h-4 w-4" />} className="min-h-[48px]">
          {tx("groupe.relire")}
        </LienBouton>
      </div>
    );
  }
  if (!data.peutCreer) return null;

  async function ouvrir() {
    setEnvoi(true);
    try {
      const r = await post<TravailDeGroupeDto>(cle);
      queryClient.setQueryData([cle], r);
      toast(tx("groupe.cree"));
      if (r.lien) naviguer(r.lien);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Bouton variante="encre" icone={<FilePlus2 className="h-4 w-4" />} chargement={envoi} onClick={() => void ouvrir()} className="min-h-[52px] w-full sm:w-auto sm:self-start">
        {tx("groupe.ouvrir")}
      </Bouton>
      <p className="text-[13px] text-texte-gris">{tx("groupe.ouvrir.aide")}</p>
    </div>
  );
}
