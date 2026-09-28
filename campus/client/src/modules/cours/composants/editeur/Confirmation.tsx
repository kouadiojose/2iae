// Fenêtre de confirmation (suppression, publication) : jamais de
// window.confirm, illisible sur téléphone.
import type { ReactNode } from "react";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton, type VarianteBouton } from "@/components/ui/bouton";

export function Confirmation({
  ouverte,
  onFermer,
  titre,
  texte,
  libelle,
  variante = "principal",
  chargement,
  onConfirmer,
  children,
}: {
  ouverte: boolean;
  onFermer: () => void;
  titre: string;
  texte?: ReactNode;
  libelle: string;
  variante?: VarianteBouton;
  chargement?: boolean;
  onConfirmer: () => void;
  children?: ReactNode;
}) {
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre={titre}
      description={texte}
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer} className="min-h-[48px]">
            Annuler
          </Bouton>
          <Bouton variante={variante} chargement={chargement} onClick={onConfirmer} className="min-h-[48px]">
            {libelle}
          </Bouton>
        </>
      }
    >
      {children}
    </Fenetre>
  );
}
