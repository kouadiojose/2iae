// Calendrier de l'engagement : LA définition du jour et de la semaine, en
// fonctions pures (serveur et client, aucune dépendance). Points, séries,
// objectif du jour, rappels, Coupe et tableau de pilotage la partagent : un
// même acte tombe le même jour partout.
//
// - Un jour est une date civile « AAAA-MM-JJ » dans le fuseau de la personne
//   (utilisateurs.fuseau ; Abidjan, GMT toute l'année, par défaut).
// - Une semaine va du lundi au dimanche et porte le numéro ISO 8601
//   (« 2026-W41 ») : la semaine 1 est celle du premier jeudi de janvier, donc
//   le 1er janvier peut appartenir à la dernière semaine de l'année d'avant.
// - Les calculs sur les jours se font sur la date civile, en UTC : aucun
//   décalage d'heure d'été ne peut faire sauter ou doubler un jour.

/** Une date civile « AAAA-MM-JJ ». */
export type Jour = string;
/** Une semaine ISO « AAAA-Www ». */
export type SemaineIso = string;

export const FUSEAU_PAR_DEFAUT = "Africa/Abidjan";

const JOUR_MS = 86_400_000;
const formats = new Map<string, Intl.DateTimeFormat>();

/** Format du fuseau, gardé en mémoire ; un fuseau inconnu ou mal saisi retombe sur Abidjan. */
function formatDe(fuseau: string | null | undefined): Intl.DateTimeFormat {
  const nom = fuseau || FUSEAU_PAR_DEFAUT;
  let f = formats.get(nom);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-CA", { timeZone: nom, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    } catch {
      return formatDe(FUSEAU_PAR_DEFAUT);
    }
    formats.set(nom, f);
  }
  return f;
}

function morceaux(d: Date | string | number, fuseau?: string | null) {
  const parts = formatDe(fuseau).formatToParts(d instanceof Date ? d : new Date(d));
  const v = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return { jour: `${v("year")}-${v("month")}-${v("day")}`, heure: Number(v("hour")), minute: Number(v("minute")) };
}

/** Jour local (« AAAA-MM-JJ ») d'un instant, dans le fuseau donné. */
export const jourLocal = (d: Date | string | number, fuseau: string | null = FUSEAU_PAR_DEFAUT): Jour => morceaux(d, fuseau).jour;

/** Heure locale (0 à 23) d'un instant, dans le fuseau donné. */
export const heureLocale = (d: Date | string | number, fuseau: string | null = FUSEAU_PAR_DEFAUT): number => morceaux(d, fuseau).heure;

/** Minutes écoulées depuis minuit, heure locale (0 à 1439) : pour les fenêtres « entre 16 h 40 et 17 h 10 ». */
export function minutesLocales(d: Date | string | number, fuseau: string | null = FUSEAU_PAR_DEFAUT): number {
  const m = morceaux(d, fuseau);
  return m.heure * 60 + m.minute;
}

const versUtc = (jour: Jour): number => {
  const [a, m, j] = jour.split("-").map(Number);
  return Date.UTC(a, m - 1, j);
};
const depuisUtc = (ms: number): Jour => new Date(ms).toISOString().slice(0, 10);
/** Rang du jour dans sa semaine : 0 pour lundi … 6 pour dimanche. */
const rangDansSemaine = (jour: Jour) => (new Date(versUtc(jour)).getUTCDay() + 6) % 7;

/** Vrai pour une chaîne « AAAA-MM-JJ » qui désigne une vraie date (paramètre d'URL, champ JSON). */
export function estJour(x: unknown): x is Jour {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  return depuisUtc(versUtc(x)) === x;
}

/** Le jour n jours plus tard (n négatif : plus tôt). */
export const ajouterJours = (jour: Jour, n: number): Jour => depuisUtc(versUtc(jour) + n * JOUR_MS);

/** Nombre de jours de « de » à « a » (positif si « a » est après « de »). */
export const ecartJours = (de: Jour, a: Jour): number => Math.round((versUtc(a) - versUtc(de)) / JOUR_MS);

export const estDimanche = (jour: Jour): boolean => rangDansSemaine(jour) === 6;

/** Le lundi de la semaine du jour (le jour lui-même si c'est un lundi). */
export const lundiDe = (jour: Jour): Jour => ajouterJours(jour, -rangDansSemaine(jour));

/** Semaine ISO du jour : « 2026-W41 ». L'année est celle du jeudi de la semaine. */
export function semaineIso(jour: Jour): SemaineIso {
  const jeudi = ajouterJours(jour, 3 - rangDansSemaine(jour));
  const annee = jeudi.slice(0, 4);
  const numero = Math.floor(ecartJours(`${annee}-01-01`, jeudi) / 7) + 1;
  return `${annee}-W${String(numero).padStart(2, "0")}`;
}
