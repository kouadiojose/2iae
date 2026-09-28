// /profil/presentation : « Ma présentation », 30 secondes pour se présenter
// aux étudiants des cinq campus (sur sa page du site, à partager sur WhatsApp).
import { ArrowLeft } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { EditeurPresentation } from "./EditeurPresentation";

export default function PageMaPresentation() {
  return (
    <Page large>
      <EnTetePage
        etiquette="Votre compte"
        titre="Ma présentation"
        sousTitre="30 secondes pour vous présenter aux étudiants des cinq campus : sur votre page du site du campus, et à partager sur WhatsApp."
        actions={
          <LienBouton href="/profil" variante="fantome" icone={<ArrowLeft className="h-4 w-4" />}>
            Mon profil
          </LienBouton>
        }
      />
      <EditeurPresentation cible="moi" />
    </Page>
  );
}
