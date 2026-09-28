// Outils du module « programme » (emploi du temps) : calendrier en UTC
// explicite, construction des contrats, occurrences datées et génération
// idempotente des séances live à partir des créneaux.
//
// Abidjan vit à l'heure GMT toute l'année : l'heure d'Abidjan EST l'heure UTC.
// Tout se calcule donc en UTC explicite (Date.UTC, getUTC…), sans jamais
// dépendre du fuseau du serveur ni de celui du navigateur : « 2026-09-28 » et
// « 08:30 » donnent 2026-09-28T08:30:00Z, où que tourne le code.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { TransactionRollbackError } from "drizzle-orm/errors";
import { db } from "./db";
import * as visio from "./visio";
import {
  sessionsProgramme,
  sessionsClasses,
  creneauxProgramme,
  seancesCreneaux,
  exceptionsProgramme,
  classesProgramme,
  formateursProgramme,
  classes,
  sites,
  cours,
  coursClasses,
  coursFormateurs,
  seances,
  utilisateurs,
  rappelsLive,
  journal,
  statutOccurrenceDeSeance,
  type SessionProgramme,
  type CreneauProgramme,
  type ExceptionProgramme,
  type Utilisateur,
  type Seance,
  type Cours,
  type SessionDto,
  type CreneauDto,
  type CreneauEditionDto,
  type IntervenantDto,
  type OccurrenceDto,
  type SemaineProgrammeDto,
  type BilanPublication,
  type FournisseurVisio,
} from "@shared/schema";

export const JOUR_MS = 86_400_000;

// ── Calendrier (UTC explicite) ─────────────────────────────────────────────

export const NOMS_JOURS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-09-28 » → minuit UTC de ce jour. Lève une erreur si la date n'existe pas (31 février…). */
export function dateUtc(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Date invalide : ${iso}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    throw new Error(`Date inexistante : ${iso}`);
  }
  return d;
}

export function dateValide(iso: string): boolean {
  try {
    dateUtc(iso);
    return true;
  } catch {
    return false;
  }
}

/** Jour civil d'Abidjan (UTC) d'un instant : « 2026-09-28 ». */
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Aujourd'hui à Abidjan. */
export const aujourdhuiAbidjan = (maintenant: Date = new Date()) => isoDate(maintenant);

/** 1 = lundi … 7 = dimanche (ISO 8601). */
export function jourIsoDe(iso: string): number {
  const j = dateUtc(iso).getUTCDay();
  return j === 0 ? 7 : j;
}

export const ajouterJours = (iso: string, n: number) => isoDate(new Date(dateUtc(iso).getTime() + n * JOUR_MS));

/** Lundi de la semaine qui contient ce jour. */
export const lundiDe = (iso: string) => ajouterJours(iso, 1 - jourIsoDe(iso));

/** Nombre de jours entre deux dates (b - a). */
export const ecartJours = (a: string, b: string) => Math.round((dateUtc(b).getTime() - dateUtc(a).getTime()) / JOUR_MS);

/** Toutes les dates d'un jour de la semaine entre deux bornes incluses (traverse les changements de mois et d'année). */
export function datesDuJour(debut: string, fin: string, jour: number): string[] {
  const dates: string[] = [];
  let d = ajouterJours(debut, (jour - jourIsoDe(debut) + 7) % 7);
  while (d <= fin) {
    dates.push(d);
    d = ajouterJours(d, 7);
  }
  return dates;
}

/** « 08:30 » → 510 (minutes depuis minuit). */
export function minutes(heure: string): number {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}

/** Instant d'une date et d'une heure d'Abidjan : (« 2026-09-28 », « 08:30 ») → 2026-09-28T08:30:00Z. */
export const instant = (iso: string, heure: string) => new Date(dateUtc(iso).getTime() + minutes(heure) * 60_000);

/** « 8h30 », « 8:30 », « 08.30 » → « 08:30 » ; null si illisible. */
export function normaliserHeure(brut: string): string | null {
  const m = /^\s*(\d{1,2})\s*[:hH.]\s*(\d{2})?\s*$/.exec(brut);
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2] ?? "0");
  if (h > 23 || mn > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

/** « 08:30 » → « 08h30 » (écriture du campus). */
export const heureLisible = (h: string) => h.replace(":", "h");

/** « lundi 28 septembre » (calculé en UTC, sans Intl ni fuseau). */
export function libelleDate(iso: string, avecAnnee = false): string {
  const d = dateUtc(iso);
  const txt = `${NOMS_JOURS[jourIsoDe(iso)]} ${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${NOMS_MOIS[d.getUTCMonth()]}`;
  return avecAnnee ? `${txt} ${d.getUTCFullYear()}` : txt;
}

/** Deux intervalles horaires se chevauchent-ils (bornes exclues) ? */
export const chevauchent = (a: { heureDebut: string; heureFin: string }, b: { heureDebut: string; heureFin: string }) =>
  minutes(a.heureDebut) < minutes(b.heureFin) && minutes(b.heureDebut) < minutes(a.heureFin);

/** Classe du tronc commun BTS (1re ou 2e année) : « BTS 1 », « 1BTS », « BTS · 2e année »… */
export function estTroncCommun(c: { niveau: string; nom: string }): boolean {
  const t = `${c.niveau} ${c.nom}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!/\bbts\b|\dbts\b/.test(t)) return false;
  return /\bbts\s*[12]\b|\b[12]\s*bts\b|\b[12]\s*(re|ere|e|eme|nde)?\s*annee\b|\btronc commun\b/.test(t);
}

/** Durée en minutes d'un créneau. */
export const dureeCreneau = (c: { heureDebut: string; heureFin: string }) => minutes(c.heureFin) - minutes(c.heureDebut);

// ── Personnes ──────────────────────────────────────────────────────────────

function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Fiche publique d'un formateur (même règle que la vitrine : annoncé ET consentant). */
const slugPublic = (u: Utilisateur) => (u.publierSurSite && u.consentementSite ? u.slug || `${slugifier(`${u.prenom} ${u.nom}`)}-${u.id}` : null);

function versIntervenant(u: Utilisateur, nomSaisi: string, publique: boolean): IntervenantDto {
  const consent = u.consentementSite && u.publierSurSite;
  return {
    id: u.id,
    nom: nomSaisi.trim() || `${u.prenom} ${u.nom}`,
    prenom: u.prenom,
    nomFamille: u.nom,
    titre: u.titre,
    localisation: !publique || consent ? u.localisation : null,
    photoUrl: !publique || consent ? u.photoUrl : null,
    slug: slugPublic(u),
  };
}

// ── Chargement et contrats ─────────────────────────────────────────────────

type Contexte = {
  classesDe: Map<number, SessionDto["classes"]>;
  creneauxDe: Map<number, CreneauProgramme[]>;
  exceptionsDe: Map<number, ExceptionProgramme[]>;
  coursDe: Map<number, Cours>;
  personnes: Map<number, Utilisateur>;
};

async function charger(sessionIds: number[]): Promise<Contexte> {
  const ctx: Contexte = { classesDe: new Map(), creneauxDe: new Map(), exceptionsDe: new Map(), coursDe: new Map(), personnes: new Map() };
  if (!sessionIds.length) return ctx;
  const [lignesClasses, lignesCreneaux, lignesExceptions] = await Promise.all([
    db
      .select({ sessionId: sessionsClasses.sessionId, id: classes.id, nom: classes.nom, siteId: classes.siteId, site: sites.nomCourt, ordre: sites.ordre })
      .from(sessionsClasses)
      .innerJoin(classes, eq(classes.id, sessionsClasses.classeId))
      .innerJoin(sites, eq(sites.id, classes.siteId))
      .where(inArray(sessionsClasses.sessionId, sessionIds))
      .orderBy(asc(sites.ordre), asc(classes.nom)),
    db
      .select()
      .from(creneauxProgramme)
      .where(inArray(creneauxProgramme.sessionId, sessionIds))
      .orderBy(asc(creneauxProgramme.jour), asc(creneauxProgramme.heureDebut), asc(creneauxProgramme.ordre), asc(creneauxProgramme.id)),
    db.select().from(exceptionsProgramme).where(inArray(exceptionsProgramme.sessionId, sessionIds)).orderBy(asc(exceptionsProgramme.date)),
  ]);
  for (const l of lignesClasses) {
    const liste = ctx.classesDe.get(l.sessionId) ?? [];
    liste.push({ id: l.id, nom: l.nom, siteId: l.siteId, site: l.site });
    ctx.classesDe.set(l.sessionId, liste);
  }
  for (const c of lignesCreneaux) ctx.creneauxDe.set(c.sessionId, [...(ctx.creneauxDe.get(c.sessionId) ?? []), c]);
  for (const e of lignesExceptions) ctx.exceptionsDe.set(e.sessionId, [...(ctx.exceptionsDe.get(e.sessionId) ?? []), e]);
  const coursIds = [...new Set(lignesCreneaux.map((c) => c.coursId).filter((x): x is number => x !== null))];
  const personnesIds = [...new Set(lignesCreneaux.map((c) => c.intervenantId).filter((x): x is number => x !== null))];
  const [listeCours, listePersonnes] = await Promise.all([
    coursIds.length ? db.select().from(cours).where(inArray(cours.id, coursIds)) : Promise.resolve([] as Cours[]),
    personnesIds.length ? db.select().from(utilisateurs).where(inArray(utilisateurs.id, personnesIds)) : Promise.resolve([] as Utilisateur[]),
  ]);
  for (const c of listeCours) ctx.coursDe.set(c.id, c);
  for (const p of listePersonnes) ctx.personnes.set(p.id, p);
  return ctx;
}

function versCreneau(c: CreneauProgramme, ctx: Contexte, publique: boolean): CreneauDto {
  const co = c.coursId ? ctx.coursDe.get(c.coursId) : undefined;
  const p = c.intervenantId ? ctx.personnes.get(c.intervenantId) : undefined;
  const intervenant = p ? versIntervenant(p, c.intervenantNom, publique) : null;
  return {
    id: c.id,
    jour: c.jour,
    heureDebut: c.heureDebut,
    heureFin: c.heureFin,
    type: c.type,
    libelle: co?.titre || c.titre || (c.type === "seminaire" ? "Séminaire" : c.type === "evenement" ? "Événement" : "Cours à préciser"),
    cours: co ? { id: co.id, code: co.code, titre: co.titre, slug: co.slug, couleur: co.couleur } : null,
    intervenant,
    intervenantNom: intervenant?.nom ?? c.intervenantNom.trim(),
    mention: c.mention.trim() || p?.titre?.trim() || "",
    fournisseur: c.fournisseur,
  };
}

function versSession(s: SessionProgramme, ctx: Contexte, publique: boolean): SessionDto {
  return {
    id: s.id,
    anneeAcademique: s.anneeAcademique,
    titre: s.titre,
    public: s.public,
    debut: s.debut,
    fin: s.fin,
    pause: s.pauseDebut && s.pauseFin ? { debut: s.pauseDebut, fin: s.pauseFin } : null,
    note: s.note,
    signataire: s.signataire,
    statut: s.statut,
    publieeLe: s.publieeLe?.toISOString() ?? null,
    classes: ctx.classesDe.get(s.id) ?? [],
    creneaux: (ctx.creneauxDe.get(s.id) ?? []).map((c) => versCreneau(c, ctx, publique)),
    exceptions: (ctx.exceptionsDe.get(s.id) ?? []).map((e) => ({ id: e.id, date: e.date, creneauId: e.creneauId, motif: e.motif })),
  };
}

/** Sessions au format des contrats (publique : rien que ce qui peut s'afficher sans compte). */
export async function sessionsVersDto(liste: SessionProgramme[], publique: boolean): Promise<SessionDto[]> {
  const ctx = await charger(liste.map((s) => s.id));
  return liste.map((s) => versSession(s, ctx, publique));
}

/** Nombre de séances liées à chaque créneau. */
async function seancesParCreneau(creneauIds: number[]): Promise<Map<number, number>> {
  if (!creneauIds.length) return new Map();
  const lignes = await db
    .select({ creneauId: seancesCreneaux.creneauId, n: sql<number>`count(*)::int` })
    .from(seancesCreneaux)
    .where(inArray(seancesCreneaux.creneauId, creneauIds))
    .groupBy(seancesCreneaux.creneauId);
  return new Map(lignes.map((l) => [l.creneauId, l.n]));
}

/** Créneaux pour l'éditeur : valeurs résolues et valeurs saisies. */
export async function creneauxEdition(s: SessionProgramme): Promise<{ session: SessionDto; creneaux: CreneauEditionDto[]; nbSeances: number }> {
  const ctx = await charger([s.id]);
  const session = versSession(s, ctx, false);
  const bruts = ctx.creneauxDe.get(s.id) ?? [];
  const nb = await seancesParCreneau(bruts.map((c) => c.id));
  const creneaux = bruts.map((c, i) => ({
    ...session.creneaux[i],
    titreSaisi: c.titre,
    mentionSaisie: c.mention,
    intervenantNomSaisi: c.intervenantNom,
    nbSeances: nb.get(c.id) ?? 0,
  }));
  return { session, creneaux, nbSeances: [...nb.values()].reduce((a, b) => a + b, 0) };
}

// ── Occurrences datées ─────────────────────────────────────────────────────

type LienSeance = { seanceId: number; statut: Seance["statut"]; motif: string | null; debut: Date; dureeMinutes: number; horaireRetouche: boolean };

async function liensDesCreneaux(creneauIds: number[]): Promise<Map<string, LienSeance>> {
  const carte = new Map<string, LienSeance>();
  if (!creneauIds.length) return carte;
  const lignes = await db
    .select({
      creneauId: seancesCreneaux.creneauId,
      date: seancesCreneaux.date,
      seanceId: seances.id,
      statut: seances.statut,
      motif: seances.motifAnnulation,
      debut: seances.debut,
      dureeMinutes: seances.dureeMinutes,
      retouches: seancesCreneaux.retouches,
    })
    .from(seancesCreneaux)
    .innerJoin(seances, eq(seances.id, seancesCreneaux.seanceId))
    .where(inArray(seancesCreneaux.creneauId, creneauIds));
  for (const l of lignes) {
    carte.set(`${l.creneauId}|${l.date}`, {
      seanceId: l.seanceId,
      statut: l.statut,
      motif: l.motif,
      debut: l.debut,
      dureeMinutes: l.dureeMinutes,
      horaireRetouche: l.retouches.includes("horaire"),
    });
  }
  return carte;
}

/** Exception qui touche ce créneau à cette date (la sienne, ou celle de toute la journée). */
function exceptionPour(exceptions: SessionDto["exceptions"], creneauId: number, date: string) {
  return exceptions.find((e) => e.date === date && e.creneauId === creneauId) ?? exceptions.find((e) => e.date === date && e.creneauId === null) ?? null;
}

/**
 * Occurrences datées des sessions (toutes, ou dans [depuis, jusqua]) : une par
 * créneau et par date de la période, avec l'état de sa séance live.
 */
export async function occurrencesDe(sessions: SessionDto[], options: { depuis?: string; jusqua?: string; maintenant?: Date } = {}): Promise<OccurrenceDto[]> {
  const maintenant = options.maintenant ?? new Date();
  const liens = await liensDesCreneaux(sessions.flatMap((s) => s.creneaux.map((c) => c.id)));
  const resultat: OccurrenceDto[] = [];
  for (const s of sessions) {
    const debut = options.depuis && options.depuis > s.debut ? options.depuis : s.debut;
    const fin = options.jusqua && options.jusqua < s.fin ? options.jusqua : s.fin;
    if (debut > fin) continue;
    for (const c of s.creneaux) {
      for (const date of datesDuJour(debut, fin, c.jour)) {
        const lien = liens.get(`${c.id}|${date}`);
        const exception = exceptionPour(s.exceptions, c.id, date);
        // Séance déplacée à la main par son formateur (retouche gardée) : l'emploi du temps montre son horaire réel.
        const reelle = lien && !exception && lien.statut !== "annulee" && lien.horaireRetouche;
        const d = reelle ? lien.debut : instant(date, c.heureDebut);
        const f = reelle ? new Date(lien.debut.getTime() + lien.dureeMinutes * 60_000) : instant(date, c.heureFin);
        const jourReel = reelle ? isoDate(d) : date;
        let statut: OccurrenceDto["statut"];
        let motif: string | null = null;
        if (exception) {
          statut = "annulee";
          motif = exception.motif || "Pas de cours ce jour-là";
        } else if (lien) {
          statut = statutOccurrenceDeSeance(lien.statut);
          motif = lien.statut === "annulee" ? lien.motif : null;
        } else {
          statut = f.getTime() < maintenant.getTime() ? "terminee" : "prevue";
        }
        resultat.push({
          date: jourReel,
          creneauId: c.id,
          debut: d.toISOString(),
          fin: f.toISOString(),
          libelle: c.libelle,
          intervenant: c.intervenantNom || null,
          seanceId: lien?.seanceId ?? null,
          statut,
          sessionId: s.id,
          jour: jourReel === date ? c.jour : jourIsoDe(jourReel),
          type: c.type,
          couleur: c.cours?.couleur ?? null,
          coursCode: c.cours?.code ?? null,
          mention: c.mention,
          intervenantId: c.intervenant?.id ?? null,
          motif,
        });
      }
    }
  }
  return resultat.sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin) || a.creneauId - b.creneauId);
}

/**
 * La semaine à montrer en tête (« Cette semaine ») : celle d'aujourd'hui si
 * elle a des occurrences, sinon la première semaine à venir qui en a.
 */
export async function semaineAMontrer(sessions: SessionDto[], maintenant = new Date()): Promise<SemaineProgrammeDto | null> {
  const aujourdhui = aujourdhuiAbidjan(maintenant);
  const lundi = lundiDe(aujourdhui);
  const dimanche = ajouterJours(lundi, 6);
  const cette = await occurrencesDe(sessions, { depuis: lundi, jusqua: dimanche, maintenant });
  if (cette.length) return { debut: lundi, fin: dimanche, nature: "cette-semaine", occurrences: cette };
  const futures = sessions.filter((s) => s.fin > dimanche && s.creneaux.length).sort((a, b) => a.debut.localeCompare(b.debut));
  for (const s of futures) {
    const premiere = (await occurrencesDe([s], { depuis: ajouterJours(dimanche, 1), maintenant }))[0];
    if (!premiere) continue;
    const l = lundiDe(premiere.date);
    const d = ajouterJours(l, 6);
    return { debut: l, fin: d, nature: "a-venir", occurrences: await occurrencesDe(sessions, { depuis: l, jusqua: d, maintenant }) };
  }
  return null;
}

/** Les prochaines occurrences (séances à venir ou en cours), toutes sessions confondues. */
export async function prochainesOccurrences(sessions: SessionDto[], n = 10, maintenant = new Date()): Promise<OccurrenceDto[]> {
  const toutes = await occurrencesDe(sessions, { depuis: aujourdhuiAbidjan(maintenant), maintenant });
  return toutes.filter((o) => new Date(o.fin).getTime() > maintenant.getTime()).slice(0, n);
}

/**
 * Intervenant de séances engendrées par l'emploi du temps (le vendredi, ce
 * n'est pas forcément le formateur principal du cours). Utile au live et à
 * la vitrine pour nommer la bonne personne.
 */
export async function intervenantsDesSeances(seanceIds: number[]): Promise<Map<number, { id: number | null; nom: string; mention: string }>> {
  const carte = new Map<number, { id: number | null; nom: string; mention: string }>();
  if (!seanceIds.length) return carte;
  const lignes = await db
    .select({
      seanceId: seancesCreneaux.seanceId,
      intervenantId: creneauxProgramme.intervenantId,
      nomSaisi: creneauxProgramme.intervenantNom,
      mention: creneauxProgramme.mention,
      prenom: utilisateurs.prenom,
      nom: utilisateurs.nom,
      titre: utilisateurs.titre,
    })
    .from(seancesCreneaux)
    .innerJoin(creneauxProgramme, eq(creneauxProgramme.id, seancesCreneaux.creneauId))
    .leftJoin(utilisateurs, eq(utilisateurs.id, creneauxProgramme.intervenantId))
    .where(inArray(seancesCreneaux.seanceId, seanceIds));
  for (const l of lignes) {
    const nom = l.nomSaisi.trim() || (l.prenom ? `${l.prenom} ${l.nom}` : "");
    if (nom) carte.set(l.seanceId, { id: l.intervenantId, nom, mention: l.mention.trim() || l.titre?.trim() || "" });
  }
  return carte;
}

/**
 * Classes destinataires de la session d'où vient chaque séance engendrée par
 * l'emploi du temps (absente : séance créée à la main). De quoi limiter les
 * rappels, le « En direct » et les présences attendues aux classes de la
 * session plutôt qu'à toutes celles qui suivent le cours.
 */
export async function classesDesSeances(seanceIds: number[]): Promise<Map<number, number[]>> {
  const carte = new Map<number, number[]>();
  if (!seanceIds.length) return carte;
  const lignes = await db
    .select({ seanceId: seancesCreneaux.seanceId, classeId: sessionsClasses.classeId })
    .from(seancesCreneaux)
    .innerJoin(creneauxProgramme, eq(creneauxProgramme.id, seancesCreneaux.creneauId))
    .leftJoin(sessionsClasses, eq(sessionsClasses.sessionId, creneauxProgramme.sessionId))
    .where(inArray(seancesCreneaux.seanceId, seanceIds));
  for (const l of lignes) carte.set(l.seanceId, [...(carte.get(l.seanceId) ?? []), ...(l.classeId !== null ? [l.classeId] : [])]);
  return carte;
}

// ── Génération des séances (publication idempotente) ───────────────────────

/** Verrou applicatif des publications (pg_advisory_xact_lock(clé, sessionId)). */
const VERROU_PUBLICATION = 20_260_928;

/** Motif des séances annulées par l'archivage : « Publier » après « Désarchiver » les rétablit. */
export const MOTIF_ARCHIVAGE = "Emploi du temps retiré par la direction des études";

/** Ce qu'une retouche à la main protège de la mise à jour des séances (seances_creneaux.retouches). */
export const CHAMPS_RETOUCHE = ["titre", "horaire", "visio", "description"] as const;
export type ChampRetouche = (typeof CHAMPS_RETOUCHE)[number];

/** Lien d'une séance avec l'emploi du temps (null : séance créée à la main). */
export async function lienEmploiDuTemps(seanceId: number): Promise<{ creneauId: number; date: string } | null> {
  const [l] = await db.select({ creneauId: seancesCreneaux.creneauId, date: seancesCreneaux.date }).from(seancesCreneaux).where(eq(seancesCreneaux.seanceId, seanceId));
  return l ?? null;
}

/**
 * Retouche à la main d'une séance engendrée par l'emploi du temps (PATCH
 * /api/seances/:id) : la mise à jour des séances ne réalignera plus ces
 * champs sur le créneau. Sans effet sur une séance créée à la main.
 */
export async function noterRetouches(seanceId: number, champs: ChampRetouche[]): Promise<void> {
  if (!champs.length) return;
  await db
    .update(seancesCreneaux)
    .set({ retouches: sql`array(select distinct unnest(${seancesCreneaux.retouches} || ${sql.param(champs)}::text[]) order by 1)` })
    .where(eq(seancesCreneaux.seanceId, seanceId));
}

export const titreSeance = (titreCours: string, date: string) => `${titreCours} · ${libelleDate(date)}`;

function descriptionSeance(s: SessionProgramme, c: CreneauProgramme, intervenant: string, mention: string): string {
  const qui = intervenant ? `Avec ${intervenant}${mention ? `, ${mention.charAt(0).toLowerCase()}${mention.slice(1)}` : ""}.` : "";
  const quand = `Emploi du temps ${s.anneeAcademique} · ${s.titre}${s.public ? ` (${s.public})` : ""} : chaque ${NOMS_JOURS[c.jour]} de ${heureLisible(c.heureDebut)} à ${heureLisible(c.heureFin)}, heure d'Abidjan.`;
  return [qui, quand].filter(Boolean).join("\n");
}

export type ChangementSeance = { seanceId: number; coursId: number; creneauId: number; date: string; nature: "creee" | "modifiee" | "annulee" | "retablie"; motif?: string };

export type ResultatSynchro = BilanPublication & {
  changements: ChangementSeance[];
  /** Intervenants (comptes) dont au moins une séance a changé (l'ancien et le nouveau quand l'intervenant change). */
  intervenantsTouches: number[];
  coursTouches: number[];
};

type OptionsSynchro = {
  maintenant?: Date;
  /** Ne traiter que ces paires (créneau, date) : exception posée ou levée. */
  filtre?: (creneauId: number, date: string) => boolean;
  /** Rétablir les séances annulées avec ce motif (levée d'une exception, republication après archivage). */
  ranimerMotif?: string;
  /** Première publication ou mise à jour : rattache les cours et marque la session synchronisée. */
  complete: boolean;
  /** Passe la session à « publiée » dans la même transaction (bouton « Publier »). */
  publier?: boolean;
  /** Aperçu : tout est calculé puis la transaction est annulée (rien n'est écrit). */
  essai?: boolean;
  auteurId: number | null;
  /**
   * Campus de l'auteur (vie scolaire d'un campus), null pour la direction.
   * Défense en profondeur : un cours suivi par une classe d'un autre campus
   * n'est alors ni programmé, ni rattaché, ni publié, ni doté de formateurs.
   */
  perimetre?: number[] | null;
};

type Executeur = Pick<typeof db, "execute">;

/** Sites des classes qui suivent chacun de ces cours. */
async function sitesDesCours(ex: Executeur, coursIds: number[]): Promise<Map<number, number[]>> {
  const carte = new Map<number, number[]>();
  if (!coursIds.length) return carte;
  const { rows } = await ex.execute<{ cours_id: number; site_id: number }>(sql`
    select distinct cc.cours_id, cl.site_id from campus.cours_classes cc join campus.classes cl on cl.id = cc.classe_id
    where cc.cours_id in (${sql.join(coursIds.map((id) => sql`${id}`), sql`, `)})`);
  for (const l of rows) carte.set(l.cours_id, [...(carte.get(l.cours_id) ?? []), l.site_id]);
  return carte;
}

/** Cours qu'une vie scolaire limitée à ces campus ne peut pas programmer : suivis par une classe d'un autre campus (même règle qu'enseigneCours). */
export async function coursHorsPerimetre(coursIds: number[], perimetre: number[] | null | undefined, ex: Executeur = db): Promise<number[]> {
  if (!perimetre || !coursIds.length) return [];
  const sitesDe = await sitesDesCours(ex, [...new Set(coursIds)]);
  return [...new Set(coursIds)].filter((id) => (sitesDe.get(id) ?? []).some((s) => !perimetre.includes(s)));
}

/**
 * Classes qui suivent les cours des créneaux d'une session sans en être
 * destinataires, et qui le resteront après la mise à jour (cochées à la main,
 * ou voulues par une autre session publiée) : les séances de la session leur
 * sont aussi montrées et rappelées, et elles y sont attendues.
 */
export async function avertissementsClassesHorsSession(sessionId: number, ex: Executeur = db): Promise<string[]> {
  const { rows } = await ex.execute<{ titre: string; nom: string }>(sql`
    select co.titre, cl.nom
    from campus.cours_classes cc
    join campus.cours co on co.id = cc.cours_id
    join campus.classes cl on cl.id = cc.classe_id
    where co.statut <> 'archive'
      and cc.cours_id in (select cr.cours_id from campus.creneaux_programme cr where cr.session_id = ${sessionId} and cr.cours_id is not null)
      and cc.classe_id not in (select sc.classe_id from campus.sessions_classes sc where sc.session_id = ${sessionId})
      and (
        not exists (select 1 from campus.classes_programme cp where cp.cours_id = cc.cours_id and cp.classe_id = cc.classe_id)
        or exists (
          select 1 from campus.creneaux_programme cr2
          join campus.sessions_programme s2 on s2.id = cr2.session_id
          join campus.sessions_classes sc2 on sc2.session_id = s2.id
          where cr2.cours_id = cc.cours_id and sc2.classe_id = cc.classe_id and s2.id <> ${sessionId} and s2.publiee_le is not null
        )
      )
    order by co.titre, cl.nom`);
  const parCours = new Map<string, string[]>();
  for (const l of rows) parCours.set(l.titre, [...(parCours.get(l.titre) ?? []), l.nom]);
  return [...parCours.entries()].map(([titre, noms]) => {
    const n = noms.length;
    return `« ${titre} » est aussi suivi par ${n} classe${n > 1 ? "s" : ""} hors de cette session (${noms.slice(0, 3).join(", ")}${n > 3 ? "…" : ""}) : les séances de cette session leur seront aussi montrées et rappelées. Pour un groupe à part, utilisez un cours distinct.`;
  });
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Défait ce que les publications ont rattaché et que plus aucune session ne
 * veut : classes d'un cours (plus aucune session publiée, même archivée, ne
 * réunit ce cours et cette classe : ses étudiants gardent sinon l'accès au
 * cours) et formateurs (plus aucun créneau de ce cours dans une session
 * publiée non archivée). Les rattachements faits à la main ne sont jamais
 * touchés. Une vie scolaire de campus ne défait rien sur un cours partagé
 * avec un autre campus.
 */
async function detacherObsoletes(tx: Transaction, sessionId: number, perimetre: number[] | null): Promise<void> {
  const { rows: classesObsoletes } = await tx.execute<{ cours_id: number; classe_id: number }>(sql`
    select cp.cours_id, cp.classe_id from campus.classes_programme cp
    where not exists (
      select 1 from campus.creneaux_programme cr
      join campus.sessions_programme s on s.id = cr.session_id
      join campus.sessions_classes sc on sc.session_id = s.id
      where cr.cours_id = cp.cours_id and sc.classe_id = cp.classe_id and (s.publiee_le is not null or s.id = ${sessionId})
    )`);
  const { rows: formateursObsoletes } = await tx.execute<{ cours_id: number; formateur_id: number; principal: boolean }>(sql`
    select fp.cours_id, fp.formateur_id, fp.principal from campus.formateurs_programme fp
    where not exists (
      select 1 from campus.creneaux_programme cr
      join campus.sessions_programme s on s.id = cr.session_id
      where cr.cours_id = fp.cours_id and cr.intervenant_id = fp.formateur_id and s.statut <> 'archivee' and (s.publiee_le is not null or s.id = ${sessionId})
    )`);
  const hors = new Set(await coursHorsPerimetre([...classesObsoletes, ...formateursObsoletes].map((l) => l.cours_id), perimetre, tx));
  for (const l of classesObsoletes) {
    if (hors.has(l.cours_id)) continue;
    // La ligne de classes_programme part avec le rattachement (cascade).
    await tx.delete(coursClasses).where(and(eq(coursClasses.coursId, l.cours_id), eq(coursClasses.classeId, l.classe_id)));
  }
  for (const l of formateursObsoletes) {
    if (hors.has(l.cours_id)) continue;
    const oublier = () =>
      tx.delete(formateursProgramme).where(and(eq(formateursProgramme.coursId, l.cours_id), eq(formateursProgramme.formateurId, l.formateur_id)));
    if (!l.principal) {
      await tx.delete(coursFormateurs).where(and(eq(coursFormateurs.coursId, l.cours_id), eq(coursFormateurs.formateurId, l.formateur_id)));
      await oublier();
      continue;
    }
    const [co] = await tx.select({ formateurId: cours.formateurId }).from(cours).where(eq(cours.id, l.cours_id));
    if (!co || co.formateurId !== l.formateur_id) {
      // La direction a nommé un autre formateur principal depuis : ce n'est plus l'affaire de l'emploi du temps.
      await oublier();
      continue;
    }
    // Formateur principal nommé par l'emploi du temps et remplacé partout : l'intervenant actuel prend sa place.
    const { rows: releve } = await tx.execute<{ id: number }>(sql`
      select u.id from campus.creneaux_programme cr
      join campus.sessions_programme s on s.id = cr.session_id
      join campus.utilisateurs u on u.id = cr.intervenant_id
      where cr.cours_id = ${l.cours_id} and u.role = 'formateur' and s.statut <> 'archivee' and (s.publiee_le is not null or s.id = ${sessionId})
      order by (s.id = ${sessionId}) desc, s.debut, cr.jour, cr.heure_debut
      limit 1`);
    if (!releve[0]) continue;
    const suivant = releve[0].id;
    await tx.update(cours).set({ formateurId: suivant, majLe: new Date() }).where(eq(cours.id, l.cours_id));
    await oublier();
    await tx.delete(coursFormateurs).where(and(eq(coursFormateurs.coursId, l.cours_id), eq(coursFormateurs.formateurId, suivant)));
    await tx
      .insert(formateursProgramme)
      .values({ coursId: l.cours_id, formateurId: suivant, principal: true })
      .onConflictDoUpdate({ target: [formateursProgramme.coursId, formateursProgramme.formateurId], set: { principal: true } });
  }
}

/**
 * Crée, met à jour ou annule les séances live d'une session publiée pour
 * qu'elles correspondent exactement à ses créneaux. Idempotent : relancée sans
 * changement, elle ne fait rien. Ne touche jamais une séance en direct,
 * terminée ou déjà passée, ni ce qu'un formateur a retouché à la main.
 * Sérialisée par session (verrou) et protégée par l'index unique (créneau,
 * date) : deux publications simultanées ne créent jamais deux fois la même
 * séance.
 */
export async function synchroniserSession(sessionId: number, o: OptionsSynchro): Promise<ResultatSynchro> {
  const maintenant = o.maintenant ?? new Date();
  const garde = o.filtre ?? (() => true);
  let apercu: ResultatSynchro | null = null;
  try {
    return await executer();
  } catch (e) {
    if (e instanceof TransactionRollbackError && apercu) return apercu;
    throw e;
  }
  function executer() {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${VERROU_PUBLICATION}, ${sessionId})`);
    const [s] = await tx.select().from(sessionsProgramme).where(eq(sessionsProgramme.id, sessionId));
    if (!s) throw new Error("Session introuvable");
    const premiere = !s.publieeLe;
    if (o.publier && s.statut !== "publiee") {
      await tx.update(sessionsProgramme).set({ statut: "publiee" }).where(eq(sessionsProgramme.id, s.id));
      s.statut = "publiee";
    }
    const creneaux = await tx.select().from(creneauxProgramme).where(eq(creneauxProgramme.sessionId, s.id)).orderBy(asc(creneauxProgramme.jour), asc(creneauxProgramme.heureDebut));
    const exceptions = await tx.select().from(exceptionsProgramme).where(eq(exceptionsProgramme.sessionId, s.id));
    const classeIds = (await tx.select({ id: sessionsClasses.classeId }).from(sessionsClasses).where(eq(sessionsClasses.sessionId, s.id))).map((l) => l.id);
    const creneauIds = creneaux.map((c) => c.id);
    const liens = creneauIds.length
      ? await tx
          .select({ creneauId: seancesCreneaux.creneauId, date: seancesCreneaux.date, retouches: seancesCreneaux.retouches, intervenantId: seancesCreneaux.intervenantId, seance: seances })
          .from(seancesCreneaux)
          .innerJoin(seances, eq(seances.id, seancesCreneaux.seanceId))
          .where(inArray(seancesCreneaux.creneauId, creneauIds))
      : [];
    const coursIds = [...new Set(creneaux.map((c) => c.coursId).filter((x): x is number => x !== null))];
    const listeCours = coursIds.length ? await tx.select().from(cours).where(inArray(cours.id, coursIds)) : [];
    const coursDe = new Map(listeCours.map((c) => [c.id, c]));
    const horsPerimetre = new Set(await coursHorsPerimetre(coursIds, o.perimetre, tx));
    const personnesIds = [...new Set(creneaux.map((c) => c.intervenantId).filter((x): x is number => x !== null))];
    const personnes = new Map(
      (personnesIds.length ? await tx.select().from(utilisateurs).where(inArray(utilisateurs.id, personnesIds)) : []).map((p) => [p.id, p]),
    );
    const publique = s.statut === "publiee";

    const bilan: ResultatSynchro = {
      seancesCreees: 0,
      seancesMisesAJour: 0,
      seancesAnnulees: 0,
      creneauxIgnores: 0,
      seancesInchangees: 0,
      avertissements: [],
      premiere,
      etudiantsPrevenus: 0,
      intervenantsPrevenus: 0,
      changements: [],
      intervenantsTouches: [],
      coursTouches: [],
    };
    const touches = new Set<number>();
    const coursTouches = new Set<number>();
    const retouchesGardees: string[] = [];
    let datesPassees = 0;
    const aVenir = (se: Pick<Seance, "debut">) => se.debut.getTime() > maintenant.getTime();
    const noter = (ch: ChangementSeance, c: CreneauProgramme, ancienIntervenant?: number | null) => {
      bilan.changements.push(ch);
      if (c.intervenantId) touches.add(c.intervenantId);
      if (ancienIntervenant) touches.add(ancienIntervenant);
      coursTouches.add(ch.coursId);
    };
    const annuler = async (se: Seance, c: CreneauProgramme, date: string, motif: string) => {
      await tx.update(seances).set({ statut: "annulee", motifAnnulation: motif, publierSurSite: false }).where(and(eq(seances.id, se.id), eq(seances.statut, "planifiee")));
      bilan.seancesAnnulees++;
      noter({ seanceId: se.id, coursId: se.coursId, creneauId: c.id, date, nature: "annulee", motif }, c);
    };
    const exceptionDe = (c: CreneauProgramme, date: string) =>
      exceptions.find((e) => e.date === date && e.creneauId === c.id) ?? exceptions.find((e) => e.date === date && e.creneauId === null);
    const libelleCreneau = (c: CreneauProgramme) => `${NOMS_JOURS[c.jour].charAt(0).toUpperCase()}${NOMS_JOURS[c.jour].slice(1)} ${heureLisible(c.heureDebut)}–${heureLisible(c.heureFin)}`;

    for (const c of creneaux) {
      const co = c.coursId ? coursDe.get(c.coursId) : undefined;
      if (co && horsPerimetre.has(co.id)) {
        bilan.avertissements.push(`${libelleCreneau(c)} : le cours ${co.code} concerne d'autres campus, seule la direction peut le programmer.`);
        continue;
      }
      const mesLiens = liens.filter((l) => l.creneauId === c.id && garde(c.id, l.date));
      const attendues = new Set<string>();
      if (!co) {
        if (c.type === "cours" && o.complete) {
          bilan.creneauxIgnores++;
          bilan.avertissements.push(`${libelleCreneau(c)} : aucun cours choisi, aucune séance créée.`);
        }
      } else if (co.statut === "archive") {
        if (o.complete) bilan.avertissements.push(`${libelleCreneau(c)} : le cours ${co.code} est archivé, aucune séance créée.`);
      } else {
        for (const date of datesDuJour(s.debut, s.fin, c.jour)) if (garde(c.id, date) && !exceptionDe(c, date)) attendues.add(date);
      }
      const p = c.intervenantId ? personnes.get(c.intervenantId) : undefined;
      const nomIntervenant = c.intervenantNom.trim() || (p ? `${p.prenom} ${p.nom}` : "");
      const mention = c.mention.trim() || p?.titre?.trim() || "";
      const duree = dureeCreneau(c);
      const fournisseurVoulu: FournisseurVisio | null = c.fournisseur === "daily" && !visio.dailyDisponible() ? visio.fournisseurParDefaut() : c.fournisseur;
      const description = descriptionSeance(s, c, nomIntervenant, mention);

      // 1. Le cours du créneau a changé : les séances de l'ancien cours libèrent leur date (celles encore prévues sont annulées).
      //    Une séance déjà annulée de l'ancien cours ne bloque plus la date et ne sera jamais rétablie à la place du nouveau.
      const restants: typeof mesLiens = [];
      for (const l of mesLiens) {
        const autreCours = co && l.seance.coursId !== co.id && aVenir(l.seance);
        if (autreCours && l.seance.statut === "planifiee") {
          await annuler(l.seance, c, l.date, `Remplacé par ${co.titre} dans l'emploi du temps`);
          await tx.delete(seancesCreneaux).where(eq(seancesCreneaux.seanceId, l.seance.id));
        } else if (autreCours && l.seance.statut === "annulee") {
          await tx.delete(seancesCreneaux).where(eq(seancesCreneaux.seanceId, l.seance.id));
        } else restants.push(l);
      }
      const parDate = new Map(restants.map((l) => [l.date, l]));

      // 2. Dates attendues sans séance, et séances dont la date ne correspond plus à rien.
      const manquantes = [...attendues].filter((d) => !parDate.has(d)).sort();
      const orphelines = restants.filter((l) => !attendues.has(l.date)).sort((a, b) => a.date.localeCompare(b.date));

      // 3. Même semaine : on déplace la séance prévue (elle garde son plan, ses diapos et ses sondages préparés).
      //    Horaire retouché à la main : la séance reste où le formateur l'a mise, seul son lien suit le créneau.
      const deplacees = new Set<number>();
      if (co) {
        for (const l of orphelines) {
          if (l.seance.statut !== "planifiee" || !aVenir(l.seance) || l.seance.coursId !== co.id) continue;
          const i = manquantes.findIndex((d) => lundiDe(d) === lundiDe(l.date) && instant(d, c.heureFin).getTime() > maintenant.getTime());
          if (i < 0) continue;
          const date = manquantes.splice(i, 1)[0];
          await tx.update(seancesCreneaux).set({ date }).where(eq(seancesCreneaux.seanceId, l.seance.id));
          deplacees.add(l.seance.id);
          parDate.set(date, { ...l, date });
          const r = new Set(l.retouches);
          if (r.has("horaire")) {
            retouchesGardees.push(`${l.seance.titre} (horaire)`);
            bilan.seancesInchangees++;
            continue;
          }
          await tx
            .update(seances)
            .set({
              ...(!r.has("titre") && { titre: titreSeance(co.titre, date) }),
              debut: instant(date, c.heureDebut),
              dureeMinutes: duree,
              ...(fournisseurVoulu && !r.has("visio") && { fournisseur: fournisseurVoulu }),
              ...(!r.has("description") && { description }),
              publierSurSite: publique,
              proposeSurSite: publique || l.seance.proposeSurSite,
            })
            .where(eq(seances.id, l.seance.id));
          if (l.intervenantId !== c.intervenantId) await tx.update(seancesCreneaux).set({ intervenantId: c.intervenantId }).where(eq(seancesCreneaux.seanceId, l.seance.id));
          await tx.delete(rappelsLive).where(eq(rappelsLive.seanceId, l.seance.id));
          bilan.seancesMisesAJour++;
          noter({ seanceId: l.seance.id, coursId: co.id, creneauId: c.id, date, nature: "modifiee" }, c, l.intervenantId);
        }
      }

      // 4. Les orphelines restantes (date hors période, exception, créneau sans cours) : annulées si elles sont encore à venir.
      for (const l of orphelines) {
        if (deplacees.has(l.seance.id)) continue;
        if (l.seance.statut !== "planifiee" || !aVenir(l.seance)) continue;
        const ex = exceptionDe(c, l.date);
        const motif = ex
          ? ex.motif || "Pas de cours ce jour-là"
          : !co
            ? "Ce créneau n'a plus de cours dans l'emploi du temps"
            : l.date < s.debut || l.date > s.fin
              ? "Date en dehors de la session"
              : "Ce cours n'a plus lieu ce jour-là";
        await annuler(l.seance, c, l.date, motif);
      }

      // 5. Séances existantes à la bonne date : rétablies si besoin, puis alignées sur le créneau (seulement prévues et à venir),
      //    sauf ce que le formateur a retouché à la main.
      if (co) {
        for (const date of attendues) {
          const l = parDate.get(date);
          if (!l || deplacees.has(l.seance.id)) continue;
          const se = l.seance;
          const r = new Set(l.retouches);
          let retablie = false;
          if (se.statut === "annulee" && o.ranimerMotif !== undefined && se.motifAnnulation === o.ranimerMotif && se.coursId === co.id && aVenir(se)) {
            await tx.update(seances).set({ statut: "planifiee", motifAnnulation: null }).where(eq(seances.id, se.id));
            retablie = true;
          } else if (se.statut !== "planifiee" || !aVenir(se)) {
            bilan.seancesInchangees++;
            continue;
          }
          const cible = { titre: titreSeance(co.titre, date), debut: instant(date, c.heureDebut), dureeMinutes: duree, fournisseur: fournisseurVoulu ?? se.fournisseur };
          const ecarts = {
            titre: se.titre !== cible.titre,
            horaire: se.debut.getTime() !== cible.debut.getTime() || se.dureeMinutes !== cible.dureeMinutes,
            visio: se.fournisseur !== cible.fournisseur,
          };
          const voulu: Partial<typeof seances.$inferInsert> = {
            ...(ecarts.titre && !r.has("titre") && { titre: cible.titre }),
            ...(ecarts.horaire && !r.has("horaire") && { debut: cible.debut, dureeMinutes: cible.dureeMinutes }),
            ...(ecarts.visio && !r.has("visio") && { fournisseur: cible.fournisseur }),
            ...(!r.has("description") && se.description !== description && { description }),
          };
          const differe = (ecarts.titre && !r.has("titre")) || (ecarts.horaire && !r.has("horaire")) || (ecarts.visio && !r.has("visio"));
          // Un intervenant remplacé (ou retiré) change la séance ; un lien encore sans intervenant noté (séance d'avant ce suivi,
          // ou créneau qui n'en avait pas) le reçoit sans bruit.
          const intervenantChange = l.intervenantId !== null && l.intervenantId !== c.intervenantId;
          const intervenantANoter = l.intervenantId !== c.intervenantId;
          const gardees = (["titre", "horaire", "visio"] as const).filter((k) => ecarts[k] && r.has(k));
          if (gardees.length) retouchesGardees.push(`${se.titre} (${gardees.join(", ")})`);
          const visibilite = retablie || se.publierSurSite !== publique || (publique && !se.proposeSurSite);
          if (Object.keys(voulu).length || visibilite) {
            await tx
              .update(seances)
              .set({ ...voulu, publierSurSite: publique, proposeSurSite: publique || se.proposeSurSite })
              .where(eq(seances.id, se.id));
          }
          if (intervenantANoter) await tx.update(seancesCreneaux).set({ intervenantId: c.intervenantId }).where(eq(seancesCreneaux.seanceId, se.id));
          if (voulu.debut) await tx.delete(rappelsLive).where(eq(rappelsLive.seanceId, se.id));
          if (retablie || differe || intervenantChange) {
            bilan.seancesMisesAJour++;
            noter({ seanceId: se.id, coursId: co.id, creneauId: c.id, date, nature: retablie ? "retablie" : "modifiee" }, c, intervenantChange ? l.intervenantId : null);
          } else bilan.seancesInchangees++;
        }

        // 6. Création des séances manquantes (jamais dans le passé).
        for (const date of manquantes) {
          if (instant(date, c.heureFin).getTime() <= maintenant.getTime()) {
            datesPassees++;
            continue;
          }
          const [se] = await tx
            .insert(seances)
            .values({
              coursId: co.id,
              titre: titreSeance(co.titre, date),
              description,
              debut: instant(date, c.heureDebut),
              dureeMinutes: duree,
              fournisseur: fournisseurVoulu ?? visio.fournisseurParDefaut(),
              publierSurSite: publique,
              proposeSurSite: publique,
            })
            .returning();
          await tx.insert(seancesCreneaux).values({ seanceId: se.id, creneauId: c.id, date, intervenantId: c.intervenantId });
          bilan.seancesCreees++;
          noter({ seanceId: se.id, coursId: co.id, creneauId: c.id, date, nature: "creee" }, c);
        }
      }

      if (o.complete) {
        if (c.type === "cours" && co && !c.intervenantId) {
          bilan.avertissements.push(
            c.intervenantNom.trim()
              ? `${libelleCreneau(c)} : ${c.intervenantNom.trim()} n'a pas de compte sur le campus, il ne pourra pas ouvrir sa classe en direct.`
              : `${libelleCreneau(c)} : aucun intervenant choisi.`,
          );
        }
      }
    }
    if (datesPassees) bilan.avertissements.push(`${datesPassees} date${datesPassees > 1 ? "s" : ""} déjà passée${datesPassees > 1 ? "s" : ""} : aucune séance créée dans le passé.`);
    if (retouchesGardees.length) {
      bilan.avertissements.push(
        retouchesGardees.length <= 3
          ? `Retouché à la main par le formateur, gardé tel quel : ${retouchesGardees.join(" ; ")}.`
          : `${retouchesGardees.length} séances retouchées à la main par le formateur sont gardées telles quelles (${retouchesGardees.slice(0, 3).join(" ; ")}…).`,
      );
    }

    // Rattachements : classes destinataires, cours publiés, intervenants formateurs du cours. Chaque ligne créée ici est
    // notée (classes_programme, formateurs_programme) pour être défaite quand plus aucune session ne la veut.
    if (o.complete) {
      if (!classeIds.length) bilan.avertissements.push("Aucune classe destinataire : aucun étudiant n'est prévenu, les cours ne sont rattachés à aucune classe.");
      for (const co of listeCours) {
        if (co.statut === "archive" || horsPerimetre.has(co.id)) continue;
        if (classeIds.length) {
          const ajoutees = await tx
            .insert(coursClasses)
            .values(classeIds.map((classeId) => ({ coursId: co.id, classeId })))
            .onConflictDoNothing()
            .returning({ classeId: coursClasses.classeId });
          if (ajoutees.length) await tx.insert(classesProgramme).values(ajoutees.map((a) => ({ coursId: co.id, classeId: a.classeId }))).onConflictDoNothing();
        }
        const intervenantsDuCours = creneaux.filter((c) => c.coursId === co.id && c.intervenantId).map((c) => personnes.get(c.intervenantId!)!).filter((p) => p && p.role === "formateur");
        const majCours: Partial<typeof cours.$inferInsert> = {};
        if (co.statut === "brouillon") majCours.statut = "publie";
        // Cours sans formateur principal : le premier intervenant le devient (il faut quelqu'un pour le cours).
        let principal = co.formateurId;
        if (!principal && intervenantsDuCours[0]) {
          principal = intervenantsDuCours[0].id;
          majCours.formateurId = principal;
          await tx
            .insert(formateursProgramme)
            .values({ coursId: co.id, formateurId: principal, principal: true })
            .onConflictDoUpdate({ target: [formateursProgramme.coursId, formateursProgramme.formateurId], set: { principal: true } });
        }
        if (Object.keys(majCours).length) await tx.update(cours).set({ ...majCours, majLe: maintenant }).where(eq(cours.id, co.id));
        const co_formateurs = [...new Set(intervenantsDuCours.map((p) => p.id))].filter((id) => id !== principal);
        if (co_formateurs.length) {
          const ajoutes = await tx
            .insert(coursFormateurs)
            .values(co_formateurs.map((formateurId) => ({ coursId: co.id, formateurId })))
            .onConflictDoNothing()
            .returning({ formateurId: coursFormateurs.formateurId });
          if (ajoutes.length) await tx.insert(formateursProgramme).values(ajoutes.map((a) => ({ coursId: co.id, formateurId: a.formateurId }))).onConflictDoNothing();
        }
      }
      await detacherObsoletes(tx, s.id, o.perimetre ?? null);
      bilan.avertissements.push(...(await avertissementsClassesHorsSession(s.id, tx)));
      await tx
        .update(sessionsProgramme)
        .set({ synchroniseeLe: maintenant, ...(s.statut === "publiee" && !s.publieeLe ? { publieeLe: maintenant } : {}) })
        .where(eq(sessionsProgramme.id, s.id));
      await tx.insert(journal).values({
        utilisateurId: o.auteurId,
        action: bilan.premiere ? "programme_publie" : "programme_mis_a_jour",
        details: {
          sessionId: s.id,
          creees: bilan.seancesCreees,
          modifiees: bilan.seancesMisesAJour,
          annulees: bilan.seancesAnnulees,
          ignores: bilan.creneauxIgnores,
        },
      });
    }
    bilan.intervenantsTouches = [...touches];
    bilan.coursTouches = [...coursTouches];
    if (o.essai) {
      apercu = bilan;
      tx.rollback();
    }
    return bilan;
  });
  }
}

/** Rend publiques (ou non) toutes les séances engendrées par une session (publication, retrait, archivage). */
export async function visibiliteSeances(sessionId: number, publique: boolean): Promise<number> {
  const ids = (
    await db
      .select({ id: seancesCreneaux.seanceId })
      .from(seancesCreneaux)
      .innerJoin(creneauxProgramme, eq(creneauxProgramme.id, seancesCreneaux.creneauId))
      .where(eq(creneauxProgramme.sessionId, sessionId))
  ).map((l) => l.id);
  if (!ids.length) return 0;
  const maj = await db
    .update(seances)
    .set(publique ? { publierSurSite: true, proposeSurSite: true } : { publierSurSite: false })
    .where(and(inArray(seances.id, ids), publique ? inArray(seances.statut, ["planifiee", "en_direct"]) : sql`true`))
    .returning({ id: seances.id });
  return maj.length;
}

/** Séances prévues et à venir d'une session (annulées à l'archivage). */
export async function seancesAVenirDeSession(sessionId: number, maintenant = new Date()) {
  return db
    .select({ seance: seances, creneauId: seancesCreneaux.creneauId, date: seancesCreneaux.date })
    .from(seancesCreneaux)
    .innerJoin(creneauxProgramme, eq(creneauxProgramme.id, seancesCreneaux.creneauId))
    .innerJoin(seances, eq(seances.id, seancesCreneaux.seanceId))
    .where(and(eq(creneauxProgramme.sessionId, sessionId), eq(seances.statut, "planifiee"), sql`${seances.debut} > ${maintenant.toISOString()}::timestamptz`));
}
