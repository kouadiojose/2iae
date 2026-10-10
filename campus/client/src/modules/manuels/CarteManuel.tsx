// Carte « Mon manuel illustré » de l'accueil étudiant, sous « Ton campus en vidéo ». Une ligne comme les autres
// liens de la colonne (couverture, titre, pages et poids) : pas de bouton orange, celui de « À faire maintenant »
// reste le seul de l'écran (CONCEPTION.md, règle 1), et la carte ne repousse pas « Mes cours ». Toujours là
// (contrairement à la carte des vidéos, qu'on peut masquer) : c'est l'aide de l'étudiant.
// Toucher la ligne ouvre le PDF. « Télécharger le manuel » le garde dans les téléchargements du téléphone, où il
// s'ouvre ensuite sans réseau ; le campus, lui, ne le garde pas (client/public/sw.js). La couverture du manuel
// renvoie à ce lien. Le PDF ne se charge qu'au toucher (petits forfaits) ; la couverture est un JPEG de quelques Ko.
import { ArrowUpRight, Download } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/manuels";
import { MANUELS } from "./manuels";

export function CarteManuel() {
  const tx = useTextes(t);
  const m = MANUELS.etudiants;
  return (
    <section aria-labelledby="titre-manuel" className="flex flex-col rounded-2xl border border-ligne bg-white">
      <a
        href={m.pdf}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[76px] items-center gap-3.5 rounded-t-2xl px-4 py-3 text-encre no-underline transition-colors hover:bg-creme hover:text-encre"
      >
        <img src={m.couverture} alt="" width={300} height={425} loading="lazy" className="h-[60px] w-[42px] shrink-0 rounded-md border border-ligne object-cover" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="titre-manuel" className="text-[17px] font-extrabold leading-snug">
            {tx("carte.titre")}
          </h2>
          <span className="font-mono text-[13px] font-semibold text-orange-fonce">{tx("infos", { v: { pages: m.pages, poids: m.poids } })}</span>
          <span className="text-sm leading-snug text-texte-pale">{tx("carte.forfait")}</span>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
      </a>
      <a
        href={m.pdf}
        download
        className="flex min-h-[48px] items-center gap-2 rounded-b-2xl border-t border-ligne px-4 text-[15px] font-bold text-encre no-underline transition-colors hover:bg-creme hover:text-encre"
      >
        <Download className="h-[18px] w-[18px] shrink-0 text-orange-fonce" aria-hidden />
        {tx("carte.telecharger")}
      </a>
    </section>
  );
}
