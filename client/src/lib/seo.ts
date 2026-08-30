// Référencement par page : titre, description et canonique sont posés au
// montage de chaque page publique (le socle global vit dans index.html).
import { useEffect } from "react";

const SITE = "https://www.2iae.com";

export function usePageMeta(titre: string, description: string, chemin: string) {
  useEffect(() => {
    document.title = titre;

    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = document.createElement("meta");
      desc.setAttribute("name", "description");
      document.head.appendChild(desc);
    }
    desc.setAttribute("content", description);

    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement("link");
      canon.setAttribute("rel", "canonical");
      document.head.appendChild(canon);
    }
    canon.setAttribute("href", SITE + chemin);
  }, [titre, description, chemin]);
}
