// /reinitialiser/:jeton : le lien reçu par e-mail après « Code oublié ? ».
// Étudiant : le pavé à chiffres ; personnel : un mot de passe de 10 caractères.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Link2Off } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { accueilDuRole } from "@/lib/auth";
import { LienBouton } from "@/components/ui/bouton";
import { Squelette } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import type { Moi, EtatLienReinitialisation } from "@shared/schema";
import { CadrePublic } from "./composants/CadrePublic";
import { PaveCode } from "./composants/PaveCode";
import { FormulaireMotDePasse } from "./composants/FormulaireMotDePasse";
import { doitPasserParBienvenue, installerMoi } from "./outils";

export default function PageReinitialiser({ jeton }: { jeton: string }) {
  const [, naviguer] = useLocation();
  const { data: etat, error, isLoading } = useQuery<EtatLienReinitialisation>({
    queryKey: ["/api/compte/reinitialiser", jeton],
    retry: false,
    staleTime: Infinity,
  });
  const [occupe, setOccupe] = useState(false);
  const [erreurPave, setErreurPave] = useState<string | null>(null);
  const [remise, setRemise] = useState(0);

  async function enregistrer(nouveau: string) {
    const m = await post<Moi>("/api/compte/reinitialiser", { jeton, nouveau });
    installerMoi(m, true);
    toast(m.role === "etudiant" ? "Nouveau code enregistré. Te voilà connecté." : "Nouveau mot de passe enregistré.");
    naviguer(doitPasserParBienvenue(m) ? "/bienvenue" : accueilDuRole(m.role), { replace: true });
  }

  async function depuisPave(code: string) {
    setOccupe(true);
    setErreurPave(null);
    try {
      await enregistrer(code);
    } catch (e) {
      setErreurPave(e instanceof ErreurApi ? e.message : "Une erreur est survenue. Réessaie dans un instant.");
      setRemise((n) => n + 1);
      setOccupe(false);
    }
  }

  if (isLoading) {
    return (
      <CadrePublic>
        <div className="flex flex-col gap-4" aria-busy="true">
          <Squelette className="h-12 w-2/3" />
          <Squelette className="h-6 w-full" />
          <Squelette className="h-72 w-full" />
        </div>
      </CadrePublic>
    );
  }

  if (error || !etat) {
    return (
      <CadrePublic>
        <div className="flex flex-col gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-clair text-orange-fonce">
            <Link2Off className="h-7 w-7" />
          </span>
          <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Ce lien ne marche plus.</h1>
          <p className="text-base leading-relaxed text-texte-pale">
            {error instanceof ErreurApi ? error.message : "Ce lien a déjà servi ou a expiré."} Un lien « code oublié » ne sert qu'une fois, pendant 1 heure.
          </p>
          <LienBouton href="/mot-de-passe-oublie" taille="lg" className="mt-2 min-h-[56px] w-full text-[17px]">
            Refaire une demande
          </LienBouton>
          <LienBouton href="/connexion" variante="fantome" className="w-full">
            Revenir à la connexion
          </LienBouton>
        </div>
      </CadrePublic>
    );
  }

  return (
    <CadrePublic>
      {etat.codeChiffres ? (
        <div className="flex flex-col gap-2">
          <span className="etiquette text-center">Bonjour {etat.prenom}</span>
          <PaveCode
            mode="choix"
            titre="Choisis ton nouveau code"
            aide={`${etat.longueurMinimale} chiffres, comme pour Orange Money ou Wave. Ne le donne à personne.`}
            longueur={Math.max(6, etat.longueurMinimale)}
            onTermine={depuisPave}
            occupe={occupe}
            erreur={erreurPave}
            remise={remise}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="etiquette">Bonjour {etat.prenom}</span>
          <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Choisissez votre nouveau mot de passe.</h1>
          <p className="mb-4 text-base text-texte-pale">Vos autres appareils seront déconnectés.</p>
          <FormulaireMotDePasse minimum={etat.longueurMinimale} libelleBouton="Enregistrer mon mot de passe" onValider={(n) => enregistrer(n)} />
        </div>
      )}
    </CadrePublic>
  );
}
