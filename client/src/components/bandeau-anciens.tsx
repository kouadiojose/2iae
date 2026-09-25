// Appel aux anciens étudiants, visible en haut de chaque page du site.
// Un ancien qui passe sur www.2iae.com ne vient pas chercher une page
// « Témoignages » : il faut que l'invitation lui saute aux yeux dès la
// première seconde, quelle que soit la page où il atterrit.
import { Link } from "wouter";
import { Video } from "lucide-react";

export function BandeauAnciens() {
  return (
    <Link href="/temoignages">
      <div
        className="bg-[#E8720C] text-white px-4 py-2.5 text-center text-sm font-semibold cursor-pointer hover:bg-[#c96208] transition-colors"
        data-testid="bandeau-anciens"
      >
        <Video className="h-4 w-4 inline-block mr-2 -mt-0.5" />
        Vous êtes un ancien étudiant de 2IAE ?{" "}
        <span className="underline underline-offset-2">
          Filmez votre témoignage en une minute
        </span>{" "}
        — l'école fête ses 20 ans.
      </div>
    </Link>
  );
}
