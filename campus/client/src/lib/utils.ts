import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}

export function initiales(prenom?: string | null, nom?: string | null) {
  return `${(prenom || "").trim().charAt(0)}${(nom || "").trim().charAt(0)}`.toUpperCase() || "?";
}

export function nomComplet(p: { prenom: string; nom: string } | null | undefined) {
  return p ? `${p.prenom} ${p.nom}` : "";
}

/** « Aya K. » */
export function nomCourt(p: { prenom: string; nom: string } | null | undefined) {
  return p ? `${p.prenom} ${p.nom.charAt(0)}.` : "";
}

export function taille(octets: number) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

export function pluriel(n: number, singulier: string, pluriel?: string) {
  return `${n} ${n > 1 ? pluriel ?? `${singulier}s` : singulier}`;
}

/** Note sur 20 affichée à la française : « 14,5 ». */
export function note(n: number | null | undefined, sur = 20) {
  if (n === null || n === undefined) return "–";
  return `${(Math.round(n * 10) / 10).toString().replace(".", ",")}/${sur}`;
}
