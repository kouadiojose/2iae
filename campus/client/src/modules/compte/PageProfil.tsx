// /profil : photo, coordonnées, préférences (#preferences), rappels, agenda,
// charte, code secret et appareils ; pour les formateurs, la fiche publiée
// sur 2iae.com. Chaque bloc s'enregistre seul : pas de grand formulaire.
import { useEffect } from "react";
import { HelpCircle, LogOut } from "lucide-react";
import { useMoiConnecte, seDeconnecter } from "@/lib/auth";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { InviteInstallation } from "@/modules/pwa/InviteInstallation";
import { tuOuVous } from "./outils";
import { CartePhoto } from "./composants/profil/CartePhoto";
import { Coordonnees } from "./composants/profil/Coordonnees";
import { Preferences, Rappels } from "./composants/profil/Preferences";
import { Agenda } from "./composants/profil/Agenda";
import { Charte, Securite } from "./composants/profil/Securite";
import { FicheSite } from "./composants/profil/FicheSite";

/** Ouvre le bloc désigné par l'ancre (#preferences depuis le menu du compte). */
function useAncre() {
  useEffect(() => {
    const aller = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      // Laisse le temps au bloc d'être affiché.
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    };
    aller();
    // wouter signale ses navigations par des événements pushState / replaceState.
    const evenements = ["hashchange", "pushState", "replaceState"];
    evenements.forEach((e) => window.addEventListener(e, aller));
    return () => evenements.forEach((e) => window.removeEventListener(e, aller));
  }, []);
}

export default function PageProfil() {
  const moi = useMoiConnecte();
  const t = tuOuVous(moi);
  useAncre();

  return (
    <Page>
      <EnTetePage etiquette={t("Ton compte", "Votre compte")} titre="Mon profil" sousTitre={t("Ta photo, tes contacts, tes préférences et la sécurité de ton compte.", "Photo, coordonnées, préférences et sécurité du compte.")} />
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <CartePhoto moi={moi} />
          <div className="hidden flex-col gap-2 lg:flex">
            <LienBouton href="/bienvenue?visite=1" variante="fantome" icone={<HelpCircle className="h-4 w-4" />} className="justify-start">
              Revoir la visite guidée
            </LienBouton>
            <Bouton variante="fantome" icone={<LogOut className="h-4 w-4" />} className="justify-start text-danger hover:text-danger" onClick={() => void seDeconnecter()}>
              Se déconnecter
            </Bouton>
          </div>
        </aside>
        <div className="flex min-w-0 flex-col gap-5">
          <Coordonnees moi={moi} />
          {moi.role === "formateur" && <FicheSite moi={moi} />}
          <Preferences moi={moi} />
          <Rappels moi={moi} />
          <InviteInstallation />
          <Agenda moi={moi} />
          <Charte moi={moi} />
          <Securite moi={moi} />
          <div className="flex flex-col gap-2 lg:hidden">
            <LienBouton href="/bienvenue?visite=1" variante="doux" taille="lg" icone={<HelpCircle className="h-5 w-5" />} className="min-h-[52px]">
              Revoir la visite guidée
            </LienBouton>
            <Bouton variante="fantome" taille="lg" icone={<LogOut className="h-5 w-5" />} className="min-h-[52px] text-danger hover:text-danger" onClick={() => void seDeconnecter()}>
              Se déconnecter
            </Bouton>
          </div>
        </div>
      </div>
    </Page>
  );
}
