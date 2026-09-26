// Outils du module « programme » côté client : disposition de la grille
// (lignes horaires déduites des créneaux, bande « PAUSE », créneaux sur
// plusieurs lignes comme le « SÉMINAIRE » vertical du document papier),
// dates et heures en UTC explicite (Abidjan = GMT), fuseau du formateur.
import type { CreneauDto, OccurrenceDto, SessionDto, SemaineProgrammeDto, Moi } from "@shared/schema";

export const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOUR_MS = 86_400_000;

// ── Dates (jours civils « AAAA-MM-JJ », calculés en UTC) ───────────────────

const utc = (iso: string) => {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
};
export const isoJour = (d: Date) => d.toISOString().slice(0, 10);
export const ajouterJours = (iso: string, n: number) => isoJour(new Date(utc(iso).getTime() + n * JOUR_MS));
export function jourIso(iso: string): number {
  const j = utc(iso).getUTCDay();
  return j === 0 ? 7 : j;
}
export const lundiDe = (iso: string) => ajouterJours(iso, 1 - jourIso(iso));

/** « lundi 28 septembre » (« 2026 » en plus sur demande). */
export function libelleJour(iso: string, options: { annee?: boolean; majuscule?: boolean } = {}): string {
  const d = utc(iso);
  const n = d.getUTCDate();
  let t = `${JOURS[jourIso(iso)].toLowerCase()} ${n === 1 ? "1er" : n} ${MOIS[d.getUTCMonth()]}`;
  if (options.annee) t += ` ${d.getUTCFullYear()}`;
  return options.majuscule ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** « 28 septembre » */
export function jourMois(iso: string, annee = false): string {
  const d = utc(iso);
  const n = d.getUTCDate();
  return `${n === 1 ? "1er" : n} ${MOIS[d.getUTCMonth()]}${annee ? ` ${d.getUTCFullYear()}` : ""}`;
}

/** « Du lundi 28 septembre au samedi 10 octobre 2026 » */
export function periode(debut: string, fin: string): string {
  const memeAnnee = debut.slice(0, 4) === fin.slice(0, 4);
  return `Du ${libelleJour(debut, { annee: !memeAnnee })} au ${libelleJour(fin, { annee: true })}`;
}

export const ecartJours = (a: string, b: string) => Math.round((utc(b).getTime() - utc(a).getTime()) / JOUR_MS);

// ── Heures ─────────────────────────────────────────────────────────────────

export const minutes = (h: string) => {
  const [a, b] = h.split(":").map(Number);
  return a * 60 + b;
};
/** « 08:30 » → « 08h30 » (écriture du campus). */
export const hh = (h: string) => h.replace(":", "h");
/** « 08:30 » → « 8H30 » (écriture du document du service des études). */
export const hhPapier = (h: string) => h.replace(/^0(\d)/, "$1").replace(":", "H");
/** Heure d'Abidjan d'un instant ISO (Abidjan = UTC) : « 08h30 ». */
export const heureAbidjan = (iso: string) => hh(new Date(iso).toISOString().slice(11, 16));

/** Fuseau du formateur (colonne utilisateurs.fuseau de l'agent visio, tolérée absente). */
export function fuseauDe(moi: Moi | null | undefined): string | null {
  const f = (moi as (Moi & { fuseau?: string | null }) | null | undefined)?.fuseau;
  return f && f !== "Africa/Abidjan" && f !== "UTC" && f !== "Etc/UTC" && f !== "GMT" ? f : null;
}

/** « America/Toronto » → « Toronto ». */
export const villeDuFuseau = (f: string) => f.split("/").pop()!.replace(/_/g, " ");

/** Heure d'un instant dans un fuseau donné : « 04h30 ». */
export function heureDans(iso: string, fuseau: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: fuseau }).format(new Date(iso)).replace(":", "h");
  } catch {
    return heureAbidjan(iso);
  }
}

/** Jour civil d'un instant dans un fuseau (pour signaler « la veille chez vous »). */
function jourDans(iso: string, fuseau: string): string {
  try {
    const p = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: fuseau }).format(new Date(iso));
    return p;
  } catch {
    return iso.slice(0, 10);
  }
}

/** « 04h30 chez vous (Toronto) », avec « la veille » ou « le lendemain » si le jour change. */
export function chezVous(iso: string, fuseau: string): string {
  const jour = jourDans(iso, fuseau);
  const decalage = ecartJours(iso.slice(0, 10), jour);
  const quand = decalage < 0 ? " la veille" : decalage > 0 ? " le lendemain" : "";
  return `${heureDans(iso, fuseau)}${quand} chez vous (${villeDuFuseau(fuseau)})`;
}

// ── Textes ─────────────────────────────────────────────────────────────────

/** « Tronc commun · 1BTS / 2BTS » → « TRONC COMMUN : 1BTS / 2BTS » (ligne imprimée « EMPLOI DU TEMPS … »). */
export function publicImprime(publicVise: string): string {
  const t = publicVise.trim();
  if (!t) return "";
  const i = t.indexOf(" · ");
  return (i >= 0 ? `${t.slice(0, i)} : ${t.slice(i + 3)}` : t).toUpperCase();
}

export const LIBELLES_STATUT_SESSION = { brouillon: "Brouillon", publiee: "Publiée", archivee: "Archivée" } as const;

/** Suggestion de titre pour une copie : « Première session » → « Deuxième session ». */
export function titreSuivant(titre: string): string {
  const ordinaux = ["Première", "Deuxième", "Troisième", "Quatrième", "Cinquième", "Sixième", "Septième", "Huitième", "Neuvième", "Dixième"];
  for (let i = 0; i < ordinaux.length - 1; i++) {
    const re = new RegExp(`^${ordinaux[i]}\\b`, "i");
    if (re.test(titre)) return titre.replace(re, ordinaux[i + 1]);
  }
  return `${titre} (copie)`;
}

/** Année académique en cours : de septembre à août. */
export function anneeAcademiqueCourante(aujourdhui: string): string {
  const a = Number(aujourdhui.slice(0, 4));
  const m = Number(aujourdhui.slice(5, 7));
  return m >= 8 ? `${a}-${a + 1}` : `${a - 1}-${a}`;
}

// ── Disposition de la grille ───────────────────────────────────────────────

export type LigneGrille = { cle: string; debut: string; fin: string; pause: boolean };
export type Placement = { cle: string; jour: number; debut: number; fin: number; creneaux: CreneauDto[] };
export type Disposition = {
  jours: number[];
  lignes: LigneGrille[];
  placements: Placement[];
  /** Cases vides (hors pause), pour « ajouter un créneau ». */
  vides: { jour: number; ligne: number }[];
  /** Bandes « PAUSE » : de la colonne jourDebut à jourFin (indices dans jours). */
  pauses: { ligne: number; de: number; a: number }[];
};

const LIGNES_PAR_DEFAUT = [
  { debut: "08:30", fin: "12:30" },
  { debut: "13:00", fin: "17:00" },
];

const contient = (a: { debut: string; fin: string }, b: { debut: string; fin: string }) =>
  minutes(a.debut) <= minutes(b.debut) && minutes(b.fin) <= minutes(a.fin) && !(a.debut === b.debut && a.fin === b.fin);
const recouvre = (a: { debut: string; fin: string }, b: { debut: string; fin: string }) => minutes(a.debut) < minutes(b.fin) && minutes(b.debut) < minutes(a.fin);

/**
 * Lignes = plages horaires distinctes des créneaux, sauf celles qui en
 * englobent au moins deux autres (une journée entière, par exemple) : ces
 * créneaux-là s'étendent sur toute la hauteur qu'ils couvrent. La pause
 * commune est une ligne à part, tracée sur toute la largeur sauf là où un
 * créneau la recouvre.
 */
export function disposer(session: Pick<SessionDto, "creneaux" | "pause">, options: { lignesParDefaut?: boolean } = {}): Disposition {
  const creneaux = session.creneaux;
  const jours = [1, 2, 3, 4, 5, 6, ...(creneaux.some((c) => c.jour === 7) ? [7] : [])];
  const plages = new Map<string, { debut: string; fin: string }>();
  for (const c of creneaux) plages.set(`${c.heureDebut}-${c.heureFin}`, { debut: c.heureDebut, fin: c.heureFin });
  if (!creneaux.length && options.lignesParDefaut) for (const p of LIGNES_PAR_DEFAUT) plages.set(`${p.debut}-${p.fin}`, p);
  const toutes = [...plages.values()];
  const pause = session.pause;
  const autres = (p: { debut: string; fin: string }) => [...toutes, ...(pause ? [pause] : [])].filter((q) => contient(p, q)).length;
  const lignes: LigneGrille[] = toutes.filter((p) => autres(p) < 2).map((p) => ({ cle: `${p.debut}-${p.fin}`, debut: p.debut, fin: p.fin, pause: false }));
  if (pause) lignes.push({ cle: "pause", debut: pause.debut, fin: pause.fin, pause: true });
  lignes.sort((a, b) => minutes(a.debut) - minutes(b.debut) || minutes(a.fin) - minutes(b.fin) || Number(a.pause) - Number(b.pause));

  // Place chaque créneau sur sa ligne, ou sur toutes les lignes qu'il recouvre.
  const bruts: Placement[] = creneaux.map((c) => {
    const exacte = lignes.findIndex((l) => !l.pause && l.debut === c.heureDebut && l.fin === c.heureFin);
    if (exacte >= 0) return { cle: String(c.id), jour: c.jour, debut: exacte, fin: exacte, creneaux: [c] };
    const idx = lignes.map((l, i) => (recouvre(l, { debut: c.heureDebut, fin: c.heureFin }) ? i : -1)).filter((i) => i >= 0);
    const debut = idx.length ? Math.min(...idx) : 0;
    return { cle: String(c.id), jour: c.jour, debut, fin: idx.length ? Math.max(...idx) : debut, creneaux: [c] };
  });
  // Deux créneaux qui occupent les mêmes cases le même jour partagent une seule case (chevauchement confirmé).
  const placements: Placement[] = [];
  for (const p of bruts) {
    let courant = p;
    for (;;) {
      const i = placements.findIndex((q) => q.jour === courant.jour && q.debut <= courant.fin && courant.debut <= q.fin);
      if (i < 0) break;
      const q = placements.splice(i, 1)[0];
      courant = {
        cle: `${q.cle}+${courant.cle}`,
        jour: courant.jour,
        debut: Math.min(q.debut, courant.debut),
        fin: Math.max(q.fin, courant.fin),
        creneaux: [...q.creneaux, ...courant.creneaux].sort((a, b) => minutes(a.heureDebut) - minutes(b.heureDebut)),
      };
    }
    placements.push(courant);
  }
  const occupe = new Set<string>();
  for (const p of placements) for (let l = p.debut; l <= p.fin; l++) occupe.add(`${p.jour}|${l}`);
  const vides: Disposition["vides"] = [];
  const pauses: Disposition["pauses"] = [];
  lignes.forEach((l, i) => {
    if (!l.pause) {
      for (const j of jours) if (!occupe.has(`${j}|${i}`)) vides.push({ jour: j, ligne: i });
      return;
    }
    let de = -1;
    jours.forEach((j, k) => {
      const libre = !occupe.has(`${j}|${i}`);
      if (libre && de < 0) de = k;
      if ((!libre || k === jours.length - 1) && de >= 0) {
        pauses.push({ ligne: i, de, a: libre ? k : k - 1 });
        de = -1;
      }
    });
  });
  return { jours, lignes, placements, vides, pauses };
}

/** Un créneau qui s'affiche en lettres verticales (« SÉMINAIRE » sur toute la journée) ? */
export function estVertical(p: Placement): boolean {
  if (p.creneaux.length !== 1 || p.fin - p.debut < 1) return false;
  const c = p.creneaux[0];
  return !c.intervenantNom && !c.mention && c.libelle.replace(/\s/g, "").length <= 12;
}

// ── Semaines ───────────────────────────────────────────────────────────────

/** La semaine à montrer à partir d'occurrences : celle d'aujourd'hui, sinon la première semaine à venir. */
export function semaineDepuis(occurrences: OccurrenceDto[], aujourdhui: string): SemaineProgrammeDto | null {
  const lundi = lundiDe(aujourdhui);
  const dimanche = ajouterJours(lundi, 6);
  const cette = occurrences.filter((o) => o.date >= lundi && o.date <= dimanche);
  if (cette.length) return { debut: lundi, fin: dimanche, nature: "cette-semaine", occurrences: cette };
  const suivante = occurrences.find((o) => o.date > dimanche);
  if (!suivante) return null;
  const l = lundiDe(suivante.date);
  const d = ajouterJours(l, 6);
  return { debut: l, fin: d, nature: "a-venir", occurrences: occurrences.filter((o) => o.date >= l && o.date <= d) };
}

/** Regroupe des occurrences par semaine (lundi → occurrences). */
export function parSemaine(occurrences: OccurrenceDto[]): { lundi: string; occurrences: OccurrenceDto[] }[] {
  const carte = new Map<string, OccurrenceDto[]>();
  for (const o of occurrences) {
    const l = lundiDe(o.date);
    carte.set(l, [...(carte.get(l) ?? []), o]);
  }
  return [...carte.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([lundi, os]) => ({ lundi, occurrences: os }));
}

/** Regroupe des occurrences par jour. */
export function parJour(occurrences: OccurrenceDto[]): { date: string; occurrences: OccurrenceDto[] }[] {
  const carte = new Map<string, OccurrenceDto[]>();
  for (const o of occurrences) carte.set(o.date, [...(carte.get(o.date) ?? []), o]);
  return [...carte.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, os]) => ({ date, occurrences: os }));
}

/** Session en cours ou à venir la plus proche (sinon la première). */
export function sessionParDefaut<T extends Pick<SessionDto, "id" | "debut" | "fin">>(sessions: T[], aujourdhui: string): T | undefined {
  return sessions.find((s) => s.debut <= aujourdhui && s.fin >= aujourdhui) ?? sessions.find((s) => s.debut > aujourdhui) ?? sessions[0];
}
