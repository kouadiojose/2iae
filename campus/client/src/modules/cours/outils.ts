// Petits outils du module cours : couleurs lisibles, vidéos YouTube, types de
// leçon, dates des cours.
import { FileText, PlayCircle, FileDown, Link2, Paperclip, type LucideIcon } from "lucide-react";
import { dateCourte } from "@/lib/dates";
import type { TypeLecon, StatutCours } from "@shared/schema";

/** Palette proposée au formateur pour la couleur de son cours. */
export const PALETTE_COURS: { valeur: string; nom: string }[] = [
  { valeur: "#E4793A", nom: "Orange 2IAE" },
  { valeur: "#A34C17", nom: "Terre" },
  { valeur: "#D4A017", nom: "Ocre" },
  { valeur: "#1F8A5B", nom: "Vert" },
  { valeur: "#2563A6", nom: "Bleu" },
  { valeur: "#6D4AA8", nom: "Violet" },
  { valeur: "#C2416B", nom: "Hibiscus" },
  { valeur: "#141414", nom: "Encre" },
];

function luminance(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0.5;
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/** Le texte le plus lisible sur une couleur de cours : encre ou blanc (contraste le plus élevé). */
export function texteSur(hex: string): "encre" | "blanc" {
  const l = luminance(hex);
  const contrasteBlanc = 1.05 / (l + 0.05);
  const contrasteEncre = (l + 0.05) / (luminance("#141414") + 0.05);
  return contrasteEncre >= contrasteBlanc ? "encre" : "blanc";
}

/** Identifiant d'une vidéo YouTube (watch, youtu.be, shorts, embed, live). */
export function idYoutube(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(url);
  return m ? m[1] : null;
}

/**
 * Poids estimé d'une vidéo YouTube en qualité basse (360p ≈ 0,55 Mbit/s,
 * soit environ 4 Mo par minute). Une estimation, affichée comme telle.
 */
export function poidsVideoEstime(minutes: number | null | undefined): number | null {
  if (!minutes || minutes <= 0) return null;
  return Math.max(1, Math.round(minutes * 4));
}

export const TYPES_LECON_INFOS: Record<TypeLecon, { libelle: string; icone: LucideIcon; aide: string }> = {
  texte: { libelle: "Texte", icone: FileText, aide: "Une leçon à lire, écrite ici." },
  video: { libelle: "Vidéo", icone: PlayCircle, aide: "Une vidéo YouTube ou un fichier vidéo, chargé seulement à la demande." },
  pdf: { libelle: "PDF", icone: FileDown, aide: "Un support PDF à ouvrir ou télécharger." },
  lien: { libelle: "Lien", icone: Link2, aide: "Une ressource sur un autre site." },
  fichier: { libelle: "Fichier", icone: Paperclip, aide: "Un document à télécharger (Word, Excel, diaporama…)." },
};

export const LIBELLES_STATUT: Record<StatutCours, string> = {
  brouillon: "Brouillon",
  publie: "Publié",
  archive: "Archivé",
};

/** « Du 6 oct. au 18 déc. », « Dès le 6 oct. », ou null. */
export function periodeCours(debut: string | null, fin: string | null): string | null {
  if (debut && fin) return `Du ${dateCourte(debut)} au ${dateCourte(fin)}`;
  if (debut) return `Dès le ${dateCourte(debut)}`;
  if (fin) return `Jusqu'au ${dateCourte(fin)}`;
  return null;
}

/** Nom de classe sans le campus en suffixe (« BTS … · 1re année · Yopougon » → « BTS … · 1re année »). */
export function classeSansSite(nom: string, site: string): string {
  const echappe = site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return nom.replace(new RegExp(`\\s*·\\s*${echappe}\\s*$`), "");
}

/** Objectifs saisis une ligne par objectif → liste propre. */
export function listeObjectifs(objectifs: string): string[] {
  return objectifs
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);
}

/** « 10 min », « 1 h 20 ». */
export function dureeLecon(minutes: number | null | undefined): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/**
 * Typographie française pour l'affichage : espace insécable fine avant
 * « ; : ! ? » et à l'intérieur des guillemets, pour ne jamais laisser un
 * « » » orphelin en début de ligne sur un petit écran. Les blocs de code
 * sont laissés tels quels.
 */
export function typographie(source: string): string {
  return source
    .split(/(```[\s\S]*?```)/g)
    .map((morceau, i) =>
      i % 2 === 1
        ? morceau
        : morceau
            .replace(/ ([;:!?»])/g, " $1")
            .replace(/« /g, "« "),
    )
    .join("");
}
