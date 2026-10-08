// Fenêtre « Nouveau badge ! » sur « Ma progression » : les badges que
// l'étudiant n'a pas encore vus, une seule fois. « Super ! » les marque vus.
import { useState } from "react";
import { post } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { t } from "@shared/textes/progression";
import type { BadgeObtenu, ProgressionMoi } from "@shared/engagement/progression";
import { CLE_PROGRESSION } from "./donnees";
import { IconeBadge } from "./Pastilles";

export function NouveauBadge({ badges }: { badges: BadgeObtenu[] }) {
  const tx = useTextes(t);
  const nouveaux = badges.filter((b) => b.nouveau);
  const [ferme, setFerme] = useState(false);
  if (!nouveaux.length || ferme) return null;
  const vus = () => {
    setFerme(true);
    // L'affichage n'attend pas le réseau : la page se met à jour tout de suite, l'envoi suit.
    queryClient.setQueryData<ProgressionMoi>([CLE_PROGRESSION], (d) => d && { ...d, badges: { ...d.badges, obtenus: d.badges.obtenus.map((b) => ({ ...b, nouveau: false })) } });
    void post("/api/progression/badges/vus").catch(() => undefined);
  };
  return (
    <Fenetre
      ouverte
      onFermer={vus}
      titre={nouveaux.length === 1 ? tx("nouveau.titre1") : tx("nouveau.titre", { v: { n: nouveaux.length } })}
      pied={
        <Bouton onClick={vus} pleineLargeur className="min-h-12 sm:w-auto">
          {tx("nouveau.ok")}
        </Bouton>
      }
    >
      <ul className="flex flex-col gap-4 pb-2">
        {nouveaux.map((b) => (
          <li key={b.code} className="flex items-center gap-4">
            <IconeBadge code={b.code} taille={56} />
            <span className="flex flex-col">
              <span className="text-lg font-extrabold">{tx(`badge.${b.code}.nom`)}</span>
              <span className="text-[15px] text-texte-pale">{tx(`badge.${b.code}.desc`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Fenetre>
  );
}
