// /inscription-professeur : un professeur crée son compte lui-même (sans lien de la direction). Le compte attend la
// validation de l'administration (Pilotage › Comptes, réactiver) ; le guide pas à pas part à la validation.
import { useState } from "react";
import { Clock3 } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { CadrePublic } from "./composants/CadrePublic";
import { Formulaire } from "./PageInscriptionFormateur";

const INFO = { prenom: "", nom: "", email: null, telephone: null, titre: null, localisation: null, expireLe: "", ficheExistante: false, minimumMotDePasse: 10 };

export default function PageInscriptionProfesseur() {
  const [enAttente, setEnAttente] = useState<string | null>(null);
  if (enAttente !== null)
    return (
      <CadrePublic>
        <div className="flex flex-col gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-clair text-orange-fonce">
            <Clock3 className="h-7 w-7" />
          </span>
          <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Merci, {enAttente}.</h1>
          <p className="text-base leading-relaxed text-texte-pale">
            Votre compte est créé. L'administration du Groupe 2IAE doit maintenant le valider. Vous recevrez un e-mail dès que c'est fait, avec votre guide pas à pas ; vous
            pourrez alors vous connecter avec votre adresse e-mail et votre mot de passe.
          </p>
          <LienBouton href="/connexion" taille="lg" variante="contour" className="mt-2 min-h-[56px] w-full text-[17px]">
            Retour à la connexion
          </LienBouton>
        </div>
      </CadrePublic>
    );
  return (
    <CadrePublic>
      <Formulaire info={INFO} onEnAttente={setEnAttente} />
    </CadrePublic>
  );
}
