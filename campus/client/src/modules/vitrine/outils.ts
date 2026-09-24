// Outils des pages publiques du campus (vitrine).
import { useEffect } from "react";
import type { VitrineLive } from "@shared/api";
import type { SitePublic } from "@shared/schema";

export const URL_SITE = "https://www.2iae.com";
export const URL_PREINSCRIPTION = `${URL_SITE}/preinscription`;

/** Lien vers la préinscription du site, avec la source (et le cours) pour le suivi des prospects. */
export function lienPreinscription(codeCours?: string): string {
  const p = new URLSearchParams({ source: "campus-numerique" });
  if (codeCours) p.set("cours", codeCours);
  return `${URL_PREINSCRIPTION}?${p.toString()}`;
}

/** Partage WhatsApp pré-rempli (sans API payante). */
export const lienWhatsapp = (texte: string) => `https://wa.me/?text=${encodeURIComponent(texte)}`;

/** « Lyon, France » → « Lyon ». */
export const ville = (localisation: string | null | undefined) => localisation?.split(",")[0]?.trim() || null;

/** « Abidjan · Yopougon », « Yamoussoukro »… */
export const nomCampus = (s: Pick<SitePublic, "ville" | "nomCourt">) => (s.ville && s.ville !== s.nomCourt ? `${s.ville} · ${s.nomCourt}` : s.nomCourt);

/** Les cinq campus, si l'API ne répond pas (la page ne reste jamais vide). */
export const SITES_DE_SECOURS: SitePublic[] = [
  { slug: "riviera", nom: "Abidjan · Riviera Palmeraie", nomCourt: "Riviera", ville: "Abidjan", salle: "Salle Palmeraie", etudiants: 0 },
  { slug: "yopougon", nom: "Abidjan · Yopougon", nomCourt: "Yopougon", ville: "Abidjan", salle: "Salle Kédjénou", etudiants: 0 },
  { slug: "yamoussoukro", nom: "Yamoussoukro", nomCourt: "Yamoussoukro", ville: "Yamoussoukro", salle: "Salle Baoulé", etudiants: 0 },
  { slug: "azaguie", nom: "Azaguié", nomCourt: "Azaguié", ville: "Azaguié", salle: "Salle Agro-pastorale", etudiants: 0 },
  { slug: "mbatto", nom: "M'Batto", nomCourt: "M'Batto", ville: "M'Batto", salle: "Salle Akwaba", etudiants: 0 },
];

/** Un effectif ne s'affiche publiquement qu'à partir de ce seuil (un « 2 inscrits » desservirait le campus). */
export const SEUIL_EFFECTIF = 10;

/** Le live à mettre en avant : celui en direct, sinon le prochain qui n'est pas terminé. */
export function liveAMettreEnAvant(lives: VitrineLive[], maintenant: number): VitrineLive | null {
  const direct = lives.find((l) => l.enDirect);
  if (direct) return direct;
  const aVenir = lives
    .filter((l) => new Date(l.debut).getTime() + l.dureeMinutes * 60_000 > maintenant)
    .sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());
  return aVenir[0] ?? null;
}

/** Titre de l'onglet pendant la navigation dans l'application (le serveur le pose au premier chargement). */
export function useTitreDocument(titre: string | null | undefined) {
  useEffect(() => {
    if (!titre) return;
    const avant = document.title;
    document.title = titre;
    return () => {
      document.title = avant;
    };
  }, [titre]);
}

/** Défilement doux vers une section de la page (ancres « #salle-live »…). */
export function allerA(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduit ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}
