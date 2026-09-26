// Dates et heures : le campus vit à l'heure d'Abidjan (GMT, sans heure
// d'été). Les formateurs enseignent souvent depuis l'étranger (Canada,
// Allemagne, France…) : ils voient aussi l'heure de chez eux, selon le fuseau
// de leur compte (utilisateurs.fuseau), ou, tant qu'ils ne l'ont pas
// confirmé, celui que devine leur navigateur. Les étudiants et les écrans de
// salle gardent l'heure d'Abidjan seule.
import { villeDuFuseau, type Moi } from "@shared/schema";
import { queryClient } from "./queryClient";

export const FUSEAU_ABIDJAN = "Africa/Abidjan";

const d = (x: Date | string | number) => (x instanceof Date ? x : new Date(x));

export function heure(x: Date | string | number, fuseau = FUSEAU_ABIDJAN) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: fuseau }).format(d(x)).replace(":", "h");
}

/** Fuseau que devine le navigateur (« America/Toronto »), ou null. */
export function fuseauNavigateur(): string | null {
  try {
    const f = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return f && f !== "UTC" && f !== "Etc/UTC" ? f : null;
  } catch {
    return null;
  }
}

/**
 * Fuseau « de chez vous » de la personne connectée : celui de son compte,
 * sinon celui du navigateur. Null pour les étudiants, les écrans de salle et
 * les visiteurs : ils vivent à l'heure d'Abidjan.
 */
export function fuseauPersonnel(): string | null {
  const moi = queryClient.getQueryData<Moi | null>(["/api/auth/moi"]);
  if (!moi || moi.role === "etudiant" || moi.role === "salle") return null;
  return moi.fuseau ?? fuseauNavigateur();
}

/** Nom de ville d'un fuseau : « America/Toronto » → « Toronto ». */
export const villeFuseau = (fuseau: string) => villeDuFuseau(fuseau);

/** Date civile (AAAA-MM-JJ) dans un fuseau. */
const jourCivil = (x: Date | string | number, fuseau: string) => new Intl.DateTimeFormat("fr-CA", { timeZone: fuseau }).format(d(x));

/**
 * « 08h30 Abidjan · 04h30 chez vous (Toronto) » pour un formateur à
 * l'étranger ; « 08h30 Abidjan » pour les étudiants et à Abidjan.
 * Le jour est précisé quand il change (« 23h30 la veille chez vous »).
 */
export function heureDouble(x: Date | string | number, fuseau: string | null = fuseauPersonnel()) {
  const a = heure(x, FUSEAU_ABIDJAN);
  if (!fuseau || fuseau === FUSEAU_ABIDJAN) return `${a} Abidjan`;
  let l: string;
  try {
    l = heure(x, fuseau);
  } catch {
    return `${a} Abidjan`;
  }
  const ville = villeFuseau(fuseau);
  if (l === a) return `${a} Abidjan, même heure chez vous (${ville})`;
  const ja = jourCivil(x, FUSEAU_ABIDJAN);
  const jl = jourCivil(x, fuseau);
  const jour = jl < ja ? " la veille" : jl > ja ? " le lendemain" : "";
  return `${a} Abidjan · ${l}${jour} chez vous (${ville})`;
}

/** Heure « chez vous » seule (« 04h30 »), ou null si la personne vit à l'heure d'Abidjan. */
export function heureChezVous(x: Date | string | number, fuseau: string | null = fuseauPersonnel()) {
  if (!fuseau || fuseau === FUSEAU_ABIDJAN) return null;
  try {
    return heure(x, fuseau);
  } catch {
    return null;
  }
}

/** « lundi 28 septembre » dans un fuseau donné (le jour « chez vous »). */
export function jourLongDans(x: Date | string | number, fuseau: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: fuseau }).format(d(x));
}

/** « mardi 29 septembre » */
export function jourLong(x: Date | string | number) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU_ABIDJAN }).format(d(x));
}

/** « Mardi 29 septembre 2026 » */
export function dateComplete(x: Date | string | number) {
  const t = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: FUSEAU_ABIDJAN }).format(d(x));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** « 29 sept. » */
export function dateCourte(x: Date | string | number) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: FUSEAU_ABIDJAN }).format(d(x));
}

/** { jour: "02", mois: "OCT" } pour les pastilles de date. */
export function pastilleDate(x: Date | string | number) {
  const date = d(x);
  const jour = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", timeZone: FUSEAU_ABIDJAN }).format(date);
  const mois = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: FUSEAU_ABIDJAN }).format(date).replace(".", "").toUpperCase();
  return { jour, mois };
}

/** « Lundi 28 septembre · 08h30 Abidjan · 04h30 chez vous (Toronto) » (formateur), « Lundi 28 septembre · 08h30 Abidjan » (étudiant). */
export function dateEtHeure(x: Date | string | number) {
  const j = jourLong(x);
  return `${j.charAt(0).toUpperCase()}${j.slice(1)} · ${heureDouble(x)}`;
}

/** « il y a 5 min », « dans 3 jours », « hier »… */
export function relatif(x: Date | string | number, maintenant = Date.now()) {
  const ecart = d(x).getTime() - maintenant;
  const abs = Math.abs(ecart);
  const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  if (abs < 45_000) return ecart >= 0 ? "dans un instant" : "à l'instant";
  if (abs < 3_600_000) return rtf.format(Math.round(ecart / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(ecart / 3_600_000), "hour");
  if (abs < 7 * 86_400_000) return rtf.format(Math.round(ecart / 86_400_000), "day");
  return dateCourte(x);
}

/** Décompose une durée pour un compte à rebours. */
export function decompte(cible: Date | string | number, maintenant = Date.now()) {
  const ms = Math.max(0, d(cible).getTime() - maintenant);
  return {
    total: ms,
    jours: Math.floor(ms / 86_400_000),
    heures: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    secondes: Math.floor(ms / 1000) % 60,
  };
}

/** « 1:32:10 » ou « 58:44 » */
export function duree(secondes: number) {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor(secondes / 60) % 60;
  const s = Math.floor(secondes % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/** Valeur pour <input type="datetime-local"> (heure d'Abidjan = UTC). */
export function versChampDate(x: Date | string | number | null | undefined) {
  if (!x) return "";
  return d(x).toISOString().slice(0, 16);
}
/** Lit un <input type="datetime-local"> saisi à l'heure d'Abidjan (UTC). */
export function depuisChampDate(v: string) {
  return v ? new Date(`${v}:00Z`).toISOString() : null;
}

/** Salutation selon l'heure d'Abidjan. */
export function salutation(maintenant = new Date()) {
  const h = maintenant.getUTCHours();
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
}
