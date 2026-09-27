// Outils des pages publiques du campus (vitrine) : liens, formats, pages du
// site, et valeurs de secours quand l'API ne répond pas (la page ne reste
// jamais vide : elle affiche les faits réels livrés avec le code).
import { useEffect } from "react";
import type { VitrineLive } from "@shared/api";
import { FILIERES_BTS, SALLE_PAR_DEFAUT, type CampusPublic, type SitePublic, type SitePublicDto } from "@shared/schema";
import { CAMPUS_PAR_DEFAUT, CAMPUS_VIERGE, CONTENUS_PAR_DEFAUT } from "@shared/vitrine-contenus";

export const URL_SITE = "https://www.2iae.com";
export const URL_PREINSCRIPTION = `${URL_SITE}/preinscription`;

/** Lien vers la préinscription du site, avec la source (et le cours) pour le suivi des prospects. */
export function lienPreinscription(codeCours?: string, base = URL_PREINSCRIPTION): string {
  const p = new URLSearchParams({ source: "campus-numerique" });
  if (codeCours) p.set("cours", codeCours);
  return `${base}${base.includes("?") ? "&" : "?"}${p.toString()}`;
}

/** Partage WhatsApp pré-rempli (sans API payante). */
export const lienWhatsapp = (texte: string) => `https://wa.me/?text=${encodeURIComponent(texte)}`;

/** Message WhatsApp vers un numéro précis (chiffres avec indicatif, ou numéro affiché « +225 07… »). */
export function lienWhatsappVers(numero: string, texte?: string): string {
  let chiffres = numero.replace(/\D/g, "");
  if (chiffres.length === 10) chiffres = `225${chiffres}`;
  return `https://wa.me/${chiffres}${texte ? `?text=${encodeURIComponent(texte)}` : ""}`;
}

/** « +225 05 84 24 90 90 » → « tel:+2250584249090 ». */
export function lienTelephone(numero: string): string {
  let chiffres = numero.replace(/\D/g, "");
  if (chiffres.length === 10) chiffres = `225${chiffres}`;
  return `tel:+${chiffres}`;
}

/** « 2250747726729 » → « +225 07 47 72 67 29 ». */
export function numeroLisible(chiffres: string): string {
  const n = chiffres.replace(/\D/g, "");
  if (n.length === 13 && n.startsWith("225")) return `+225 ${n.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  return n ? `+${n}` : "";
}

/** 58.4 → « 58,40 % » (comme sur les affiches officielles). */
export const formatTaux = (t: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(t)}\u00a0%`;

/** « Lyon, France » → « Lyon ». */
export const ville = (localisation: string | null | undefined) => localisation?.split(",")[0]?.trim() || null;

/** « Abidjan · Yopougon », « Yamoussoukro »… */
export const nomCampus = (s: Pick<SitePublic, "ville" | "nomCourt">) => (s.ville && s.ville !== s.nomCourt ? `${s.ville} · ${s.nomCourt}` : s.nomCourt);

/**
 * Espaces insécables de la typographie française : jamais un « ? », un « % »
 * ou un « : » rejeté seul en début de ligne sur un petit écran.
 */
export function typo(texte: string): string {
  return texte.replace(/ ([?!:;%»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
}

/** Texte en paragraphes (séparés par une ligne vide). */
export const paragraphes = (texte: string) =>
  texte
    .split(/\n\s*\n/)
    .map((p) => typo(p.trim()))
    .filter(Boolean);

// ── Pages du site public ───────────────────────────────────────────────────

export type PagePublique = { href: string; libelle: string; description: string };

/** Navigation principale (en-tête). */
export const PAGES_PRINCIPALES: PagePublique[] = [
  { href: "/programme", libelle: "Emploi du temps", description: "Les cours en direct, jour par jour" },
  { href: "/cours-ouverts", libelle: "Cours", description: "Les cours présentés au public" },
  { href: "/formateurs", libelle: "Formateurs", description: "Ceux qui enseignent en direct" },
  { href: "/campus", libelle: "Campus", description: "Les cinq campus du Groupe 2IAE" },
  { href: "/le-direct", libelle: "Le direct", description: "Comment suivre un cours" },
];

/** Menu « Plus ». */
export const PAGES_SECONDAIRES: PagePublique[] = [
  { href: "/questions", libelle: "Questions fréquentes", description: "Connexion, forfait, parents" },
  { href: "/a-propos", libelle: "À propos", description: "Le Groupe 2IAE et son campus numérique" },
  { href: "/contact", libelle: "Contact", description: "Téléphones, WhatsApp, adresses" },
];

/** Une page est-elle active pour ce chemin (la page elle-même ou une de ses fiches) ? */
export const pageActive = (href: string, chemin: string) => chemin === href || chemin.startsWith(`${href}/`);

// ── Secours (API injoignable) ──────────────────────────────────────────────

const SITES_CONNUS = [
  { id: 1, slug: "riviera", nom: "Abidjan · Riviera Palmeraie", nomCourt: "Riviera", ville: "Abidjan" },
  { id: 2, slug: "yopougon", nom: "Abidjan · Yopougon", nomCourt: "Yopougon", ville: "Abidjan" },
  { id: 3, slug: "yamoussoukro", nom: "Yamoussoukro", nomCourt: "Yamoussoukro", ville: "Yamoussoukro" },
  { id: 4, slug: "azaguie", nom: "Azaguié · Université de l'Entrepreneuriat", nomCourt: "Azaguié", ville: "Azaguié" },
  { id: 5, slug: "mbatto", nom: "M'Batto", nomCourt: "M'Batto", ville: "M'Batto" },
];

/** Les cinq campus, si l'API ne répond pas. */
export const SITES_DE_SECOURS: SitePublic[] = SITES_CONNUS.map(({ id: _id, ...s }) => ({ ...s, salle: SALLE_PAR_DEFAUT, etudiants: 0 }));

/** Le site public tel que livré (faits réels), si l'API ne répond pas. */
export const SITE_DE_SECOURS: SitePublicDto = {
  accueil: CONTENUS_PAR_DEFAUT.accueil,
  apropos: CONTENUS_PAR_DEFAUT.apropos,
  questions: CONTENUS_PAR_DEFAUT.questions.liste.filter((q) => q.visible),
  contacts: CONTENUS_PAR_DEFAUT.contacts,
  confidentialite: CONTENUS_PAR_DEFAUT.confidentialite,
  campus: SITES_CONNUS.map((s): CampusPublic => {
    const c = CAMPUS_PAR_DEFAUT[s.slug] ?? CAMPUS_VIERGE;
    const destination = ["2IAE", c.adresse, c.localite, "Côte d'Ivoire"].filter(Boolean).join(", ");
    return {
      ...s,
      salle: SALLE_PAR_DEFAUT,
      salleNommee: false,
      whatsapp: CONTENUS_PAR_DEFAUT.contacts.whatsapp.replace(/\D/g, ""),
      whatsappCampus: false,
      adresse: c.adresse,
      localite: c.localite,
      telephone: c.telephone || null,
      photoUrl: c.photoUrl,
      itineraire: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
      filieres: c.filieres.map((code) => FILIERES_BTS.find((f) => f.code === code)!).filter(Boolean),
      resultat: c.resultat,
      presentation: c.presentation,
      etudiants: 0,
    };
  }),
  majLe: null,
};

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
