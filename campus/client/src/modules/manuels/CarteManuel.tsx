// Carte « Mon manuel illustré » de l'accueil étudiant, sous « Ton campus en vidéo » : la couverture, le
// nombre de pages, le poids et un seul bouton. Toujours là (contrairement à la carte des vidéos, qu'on peut
// masquer) : c'est l'aide de l'étudiant. Le PDF ne se charge qu'au toucher (petits forfaits) ; la couverture
// est un JPEG de quelques Ko.
import { ArrowUpRight } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { LienBouton } from "@/components/ui/bouton";
import { t } from "@shared/textes/manuels";
import { MANUELS } from "./manuels";

export function CarteManuel() {
  const tx = useTextes(t);
  const m = MANUELS.etudiants;
  return (
    <section aria-labelledby="titre-manuel" className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4">
      <div className="flex gap-4">
        {/* La couverture ouvre aussi le manuel (même lien que le bouton, ignoré par les lecteurs d'écran). */}
        <a href={m.pdf} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden className="shrink-0">
          <img
            src={m.couverture}
            alt=""
            width={300}
            height={425}
            loading="lazy"
            className="h-[120px] w-[85px] rounded-lg border border-ligne object-cover shadow-[0_2px_8px_rgba(20,20,20,0.12)]"
          />
        </a>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-mono text-[11px] font-semibold text-orange-fonce">{tx("carte.infos", { v: { pages: m.pages, poids: m.poids } })}</span>
          <h2 id="titre-manuel" className="text-[17px] font-extrabold leading-snug">
            {tx("carte.titre")}
          </h2>
          <p className="text-sm leading-snug text-texte-pale">{tx("carte.texte")}</p>
        </div>
      </div>
      <LienBouton href={m.pdf} externe className="min-h-[52px] w-full">
        {tx("carte.ouvrir")} <ArrowUpRight className="h-5 w-5" aria-hidden />
      </LienBouton>
      <p className="text-center text-xs text-texte-gris">{tx("carte.forfait")}</p>
    </section>
  );
}
