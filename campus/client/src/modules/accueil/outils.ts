// Petits outils partagés par les modules accueil, agenda et annonces.
import type { Moi } from "@shared/schema";
import { maintenantServeur } from "@/lib/horloge";

/** On tutoie les étudiants, on vouvoie les formateurs et l'équipe. */
export const tutoie = (moi: Pick<Moi, "role">) => moi.role === "etudiant";

/** Première lettre en majuscule (« jeudi 24 septembre » → « Jeudi 24 septembre »). */
export const majuscule = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Adresse complète d'une page du campus, pour un partage hors du campus (WhatsApp). */
export const adresseCampus = (chemin: string) => `${window.location.origin}${chemin}`;

/** Lien WhatsApp avec un texte prêt à envoyer (la personne choisit elle-même le destinataire). */
export const lienWhatsApp = (texte: string) => `https://wa.me/?text=${encodeURIComponent(texte)}`;

/** Texte brut court à partir du Markdown (aperçus de liste, partage WhatsApp). */
export function extrait(markdown: string, longueur = 160): string {
  const brut = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Les puces deviennent « · » pour que les éléments d'une liste restent séparés une fois sur une ligne.
    .replace(/^\s{0,3}([-*•]|\d+[.)])\s+/gm, "· ")
    .replace(/^\s{0,3}(#{1,6}|>)\s+/gm, "")
    .replace(/^\s*(-{3,}|\*{3,})\s*$/gm, " ")
    .replace(/(\*\*|__|\*|`)(.+?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
  if (brut.length <= longueur) return brut;
  const coupe = brut.slice(0, longueur);
  return `${coupe.slice(0, Math.max(coupe.lastIndexOf(" "), longueur - 20)).trim()}…`;
}

/** Types d'événements temps réel qui changent ce qu'affiche l'accueil. */
export const EVENEMENTS_ACCUEIL = new Set(["notification", "annonce", "live", "agenda", "message", "devoir", "seance"]);

const JOUR_MS = 86_400_000;
const formatJourSemaine = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "Africa/Abidjan" });
const formatJourMois = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Abidjan" });

/**
 * « aujourd'hui », « demain », « jeudi » (dans les 6 jours), sinon « jeudi 9 octobre ».
 * Les jours sont ceux d'Abidjan (GMT, donc les jours UTC).
 */
export function jourRelatif(x: string | Date, maintenant: number = maintenantServeur()): string {
  const d = x instanceof Date ? x : new Date(x);
  const ecart = Math.floor(d.getTime() / JOUR_MS) - Math.floor(maintenant / JOUR_MS);
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "demain";
  if (ecart === -1) return "hier";
  if (ecart > 1 && ecart < 7) return formatJourSemaine.format(d);
  return formatJourMois.format(d);
}
