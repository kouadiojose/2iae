// Module « showreel » : 30 secondes pour présenter chaque formateur.
//
// Éditeur (le formateur pour lui-même : cible « moi » ; la direction pour
// n'importe quel formateur : cible = identifiant du formateur) :
//   GET   /api/showreels/:cible             → ShowreelEditionDto (crée le brouillon de départ au besoin)
//   PATCH /api/showreels/:cible             → SaisieShowreel : plans, liens, PDF, photo, fuseau
//   POST  /api/showreels/:cible/lire        → lit les liens (sites personnels) et dit ce qui a été lu
//   POST  /api/showreels/:cible/composer    → ReponseComposition : l'IA (ou le compositeur de secours) compose
//   POST  /api/showreels/:cible/soumettre   → la direction envoie la présentation au formateur pour validation
//   POST  /api/showreels/:cible/valider     → le formateur valide (consent à la publication)
//   POST  /api/showreels/:cible/publier     → la direction publie (accord confirmé si le formateur n'a pas validé)
//   POST  /api/showreels/:cible/retirer     → retire la présentation en ligne (direction ou formateur)
// Direction :
//   GET   /api/pilotage/showreels           → ShowreelResumeDto[] (une ligne par formateur)
// Public :
//   GET   /api/public/presentations/:slug        → ShowreelPublicDto (version publiée seulement)
//   GET   /api/public/presentations/:slug/photo  → la photo publiée
//   GET   /api/public/presentations/:slug/apercu → l'image d'aperçu des liens partagés (JPEG 1200 × 630)
//   Page /formateurs/:slug/presentation : balises Open Graph (aperçu WhatsApp).
//
// Règles : les plans « campus » et « fin » sont résolus à la lecture depuis
// l'emploi du temps (jamais écrits par l'IA ni stockés en texte) ; la version
// en ligne est une copie figée ; un formateur n'est présenté qu'avec son
// consentement et la validation de la direction (CONCEPTION.md §9.10).
import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { config } from "../config";
import { exigerRole, moi, oublierUtilisateur } from "../auth";
import { route, invalide, interdit, introuvable, ErreurHttp, valider } from "../http";
import { enregistrerGardienFichier, urlFichier } from "../fichiers";
import { iaDisponible, raisonIndisponible, verifierQuota, ErreurIa } from "../ia";
import { notifier } from "../notifications";
import { prevenirSite } from "../site";
import { enregistrerMetaPage } from "../vite";
import { slugifier } from "./public";
import {
  analyserLien,
  assembler,
  composerAvecIa,
  composerSansIa,
  ErreurLecture,
  lireSite,
  nettoyer,
  nombreEnLettres,
  nouvelId,
  sansGuillemets,
  type ProfilComposition,
} from "../showreel-ia";
import {
  utilisateurs,
  fichiers,
  journal,
  sites,
  cours,
  coursFormateurs,
  sessionsProgramme,
  creneauxProgramme,
  exceptionsProgramme,
  showreels,
  FORMES_PHOTO,
  LIMITES_PLAN,
  PLANS_MAX,
  SOURCE_CAMPUS,
  SOURCE_PROFIL,
  TYPES_PLAN,
  estPlanCampus,
  rythmer,
  dureeTotale,
  verifierPlans,
  type Utilisateur,
  type Showreel,
  type PlanShowreel,
  type SourceShowreel,
  type VersionShowreel,
  type LienCampusShowreel,
  type FormateurShowreel,
  type ShowreelEditionDto,
  type ShowreelPublicDto,
  type ShowreelResumeDto,
  type RapportComposition,
  type ReponseComposition,
  type CreneauProgramme,
  type SessionProgramme,
} from "@shared/schema";

const FORMATEUR_OU_DIRECTION = exigerRole("formateur", "admin");
const DIRECTION = exigerRole("admin");
const NOM_CAMPUS = "Campus numérique 2IAE";

const nomAffiche = (u: Pick<Utilisateur, "prenom" | "nom">) => `${u.prenom} ${u.nom}`.replace(/\s+/g, " ").trim();
const sansAccents = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const urlCampus = (chemin: string) => `${config.urlCampus}${chemin}`;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Slug public d'un formateur (même règle que la vitrine) : celui de sa fiche, sinon « prenom-nom-<id> ». */
const slugFormateur = (u: Pick<Utilisateur, "id" | "slug" | "prenom" | "nom">) => u.slug || `${slugifier(`${u.prenom} ${u.nom}`)}-${u.id}`;

/** Un slug libre pour la fiche du formateur (comme au consentement dans le profil). */
async function slugDisponible(u: Utilisateur): Promise<string> {
  const base = slugifier(`${u.prenom} ${u.nom}`).slice(0, 60) || `formateur-${u.id}`;
  for (let i = 0; i < 20; i++) {
    const candidat = i === 0 ? base : `${base}-${i + 1}`;
    const [pris] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(and(eq(utilisateurs.slug, candidat), ne(utilisateurs.id, u.id)));
    if (!pris) return candidat;
  }
  return `${base}-${u.id}`;
}

// ── Lien avec le campus (emploi du temps) ──────────────────────────────────

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const fmtDateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Ce qu'il faut pour résoudre le lien de plusieurs formateurs en une fois. */
type ContexteCampus = {
  creneaux: { c: CreneauProgramme; s: SessionProgramme; cours: { titre: string; code: string; couleur: string } | null }[];
  exceptions: { sessionId: number; date: string; creneauId: number | null }[];
  campus: string[];
  maintenant: Date;
};

async function chargerContexteCampus(): Promise<ContexteCampus> {
  const maintenant = new Date();
  const aujourdhui = maintenant.toISOString().slice(0, 10); // Abidjan = UTC
  const [lignes, listeSites] = await Promise.all([
    db
      .select({ c: creneauxProgramme, s: sessionsProgramme, titre: cours.titre, code: cours.code, couleur: cours.couleur })
      .from(creneauxProgramme)
      .innerJoin(sessionsProgramme, eq(sessionsProgramme.id, creneauxProgramme.sessionId))
      .leftJoin(cours, eq(cours.id, creneauxProgramme.coursId))
      .where(and(eq(sessionsProgramme.statut, "publiee"), gte(sessionsProgramme.fin, aujourdhui), eq(creneauxProgramme.type, "cours")))
      .orderBy(asc(sessionsProgramme.debut), asc(creneauxProgramme.jour), asc(creneauxProgramme.heureDebut)),
    db.select({ nomCourt: sites.nomCourt }).from(sites).orderBy(asc(sites.ordre), asc(sites.id)),
  ]);
  const sessionIds = [...new Set(lignes.map((l) => l.s.id))];
  const exceptions = sessionIds.length
    ? await db
        .select({ sessionId: exceptionsProgramme.sessionId, date: exceptionsProgramme.date, creneauId: exceptionsProgramme.creneauId })
        .from(exceptionsProgramme)
        .where(inArray(exceptionsProgramme.sessionId, sessionIds))
    : [];
  return {
    creneaux: lignes.map((l) => ({ c: l.c, s: l.s, cours: l.titre ? { titre: l.titre, code: l.code ?? "", couleur: l.couleur ?? "#E4793A" } : null })),
    exceptions,
    campus: listeSites.map((x) => x.nomCourt),
    maintenant,
  };
}

/** Prochaine date de ce créneau (« 2026-09-28 »), en sautant les exceptions et ce qui est déjà fini. */
function prochaineDate(ctx: ContexteCampus, s: SessionProgramme, c: CreneauProgramme): string | null {
  const debut = new Date(`${s.debut}T00:00:00Z`);
  const jourActuel = new Date(`${ctx.maintenant.toISOString().slice(0, 10)}T00:00:00Z`);
  const fin = new Date(`${s.fin}T00:00:00Z`);
  for (let d = new Date(Math.max(debut.getTime(), jourActuel.getTime())); d <= fin; d = new Date(d.getTime() + 86_400_000)) {
    if (((d.getUTCDay() + 6) % 7) + 1 !== c.jour) continue;
    const date = d.toISOString().slice(0, 10);
    if (ctx.exceptions.some((e) => e.sessionId === s.id && e.date === date && (e.creneauId === null || e.creneauId === c.id))) continue;
    if (new Date(`${date}T${c.heureFin}:00Z`).getTime() <= ctx.maintenant.getTime()) continue;
    return date;
  }
  return null;
}

/** L'intervenant saisi par son seul nom sur l'emploi du temps (« M. Kouadio José ») correspond-il à ce compte ? */
function nomCorrespond(saisi: string, f: Pick<Utilisateur, "nom">): boolean {
  const nom = sansAccents(f.nom).trim();
  if (nom.length < 3) return false;
  return new RegExp(`(^|[^a-z])${nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(sansAccents(saisi));
}

/** « 08:30 » à Abidjan, le jour donné → la même heure dans un autre fuseau (« 04:30 »). */
function heureDans(date: string, heure: string, fuseau: string): string | null {
  try {
    const d = new Date(`${date}T${heure}:00Z`);
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: fuseau }).format(d);
  } catch {
    return null;
  }
}

function villeDuFuseau(fuseau: string): string {
  const fin = fuseau.split("/").pop() ?? fuseau;
  const traduites: Record<string, string> = { Montreal: "Montréal", Quebec: "Québec", New_York: "New York", Brussels: "Bruxelles", London: "Londres", Zurich: "Genève", Dubai: "Dubaï" };
  return traduites[fin] ?? fin.replace(/_/g, " ");
}

function lienCampusDe(ctx: ContexteCampus, f: Pick<Utilisateur, "id" | "nom">, fuseau: string | null, coursRepli: { titre: string; code: string; couleur: string } | null): LienCampusShowreel {
  let miens = ctx.creneaux.filter((l) => l.c.intervenantId === f.id);
  if (!miens.length) miens = ctx.creneaux.filter((l) => !l.c.intervenantId && nomCorrespond(l.c.intervenantNom, f));
  const vide: LienCampusShowreel = {
    origine: "aucune",
    cours: null,
    jour: null,
    jourLibelle: null,
    heureDebut: null,
    heureFin: null,
    heureDebutLocale: null,
    heureFinLocale: null,
    ville: null,
    public: null,
    mention: null,
    prochaineDate: null,
    prochaineDateLibelle: null,
    campus: ctx.campus,
  };
  const avecDates = miens.map((l) => ({ ...l, date: prochaineDate(ctx, l.s, l.c) }));
  const choisi = avecDates.filter((l) => l.date).sort((a, b) => `${a.date} ${a.c.heureDebut}`.localeCompare(`${b.date} ${b.c.heureDebut}`))[0];
  if (!choisi || !choisi.date) {
    if (coursRepli) return { ...vide, origine: "cours", cours: coursRepli, mention: miens[0]?.c.mention || null };
    return { ...vide, mention: miens[0]?.c.mention || null };
  }
  const { c, s, date } = choisi;
  let heureDebutLocale: string | null = null;
  let heureFinLocale: string | null = null;
  let ville: string | null = null;
  if (fuseau && fuseau !== "Africa/Abidjan") {
    const d = heureDans(date, c.heureDebut, fuseau);
    // Même heure qu'à Abidjan (Dakar, Londres l'hiver…) : inutile de la répéter.
    if (d && d !== c.heureDebut) {
      heureDebutLocale = d;
      heureFinLocale = heureDans(date, c.heureFin, fuseau);
      ville = villeDuFuseau(fuseau);
    }
  }
  return {
    origine: "emploi_du_temps",
    cours: choisi.cours ?? (c.titre ? { titre: c.titre, code: "", couleur: "#E4793A" } : coursRepli),
    jour: c.jour,
    jourLibelle: JOURS[c.jour] ?? null,
    heureDebut: c.heureDebut,
    heureFin: c.heureFin,
    heureDebutLocale,
    heureFinLocale,
    ville,
    public: s.public || null,
    mention: c.mention || null,
    prochaineDate: date,
    prochaineDateLibelle: fmtDateLongue.format(new Date(`${date}T12:00:00Z`)),
    campus: ctx.campus,
  };
}

/** Premier cours du formateur (principal ou co-formateur), quand l'emploi du temps ne le cite pas. */
async function coursDuFormateur(id: number): Promise<{ titre: string; code: string; couleur: string } | null> {
  const [c] = await db
    .select({ titre: cours.titre, code: cours.code, couleur: cours.couleur })
    .from(cours)
    .where(
      and(
        ne(cours.statut, "archive"),
        or(eq(cours.formateurId, id), inArray(cours.id, db.select({ id: coursFormateurs.coursId }).from(coursFormateurs).where(eq(coursFormateurs.formateurId, id)))),
      ),
    )
    .orderBy(sql`${cours.dateDebut} asc nulls last`, asc(cours.id))
    .limit(1);
  return c ?? null;
}

async function lienCampus(f: Utilisateur, fuseau: string | null, ctx?: ContexteCampus): Promise<LienCampusShowreel> {
  const contexte = ctx ?? (await chargerContexteCampus());
  const lien = lienCampusDe(contexte, f, fuseau, null);
  if (lien.origine !== "aucune") return lien;
  const repli = await coursDuFormateur(f.id);
  return repli ? lienCampusDe(contexte, f, fuseau, repli) : lien;
}

// ── Chargement, droits, DTO ────────────────────────────────────────────────

type Cible = { u: Utilisateur; f: Utilisateur; estMoi: boolean };

/** « moi » (le formateur connecté) ou l'identifiant d'un formateur (direction seulement ; 404 sinon). */
async function resoudreCible(req: Request): Promise<Cible> {
  const u = moi(req);
  const brut = String(req.params.cible);
  if (brut === "moi") {
    if (u.role !== "formateur") throw interdit("« Ma présentation » est réservée aux formateurs.");
    return { u, f: u, estMoi: true };
  }
  const id = Number(brut);
  if (!Number.isInteger(id) || id <= 0) throw invalide("Formateur inconnu.");
  if (u.role === "formateur") {
    if (id !== u.id) throw introuvable("Présentation");
    return { u, f: u, estMoi: true };
  }
  const [f] = await db.select().from(utilisateurs).where(and(eq(utilisateurs.id, id), eq(utilisateurs.role, "formateur")));
  if (!f) throw introuvable("Formateur");
  return { u, f, estMoi: false };
}

const profilDe = (f: Utilisateur): ProfilComposition => ({ nomAffiche: nomAffiche(f), titre: f.titre, localisation: f.localisation, bio: f.bio });

/** Le showreel du formateur ; à la première ouverture, un brouillon de départ fait de faits sûrs. */
async function chargerShowreel(f: Utilisateur, u: Utilisateur): Promise<Showreel> {
  const [s] = await db.select().from(showreels).where(eq(showreels.formateurId, f.id));
  if (s) return s;
  const campus = await lienCampus(f, f.fuseau);
  await db
    .insert(showreels)
    .values({
      formateurId: f.id,
      plans: composerSansIa(profilDe(f), campus),
      composition: "depart",
      composeLe: new Date(),
      composeParId: u.id,
      photoForme: "rond",
      majParId: u.id,
    })
    .onConflictDoNothing({ target: showreels.formateurId });
  const [cree] = await db.select().from(showreels).where(eq(showreels.formateurId, f.id));
  return cree;
}

const versionDe = (s: Pick<Showreel, "plans" | "photoFichierId" | "photoForme" | "fuseau">): VersionShowreel => ({
  plans: s.plans,
  photoFichierId: s.photoFichierId,
  photoForme: s.photoForme,
  fuseau: s.fuseau,
});

/** Forme canonique (clés triées) : PostgreSQL réordonne les clés des colonnes jsonb. */
function canonique(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonique((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** Égalité de contenu (les identifiants et durées comptent : ils font la présentation). */
const memeVersion = (a: VersionShowreel | null, b: VersionShowreel | null) => canonique(a) === canonique(b);

/** Visible du public : publiée, formateur actif, consentant et présenté sur le site. */
const visibleDuPublic = (s: Pick<Showreel, "versionPubliee">, f: Pick<Utilisateur, "actif" | "consentementSite" | "publierSurSite">) =>
  Boolean(s.versionPubliee && f.actif && f.consentementSite && f.publierSurSite);

async function nomsDe(ids: (number | null)[]): Promise<Map<number, string>> {
  const liste = [...new Set(ids.filter((x): x is number => typeof x === "number"))];
  if (!liste.length) return new Map();
  const lignes = await db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role }).from(utilisateurs).where(inArray(utilisateurs.id, liste));
  return new Map(lignes.map((l) => [l.id, l.role === "admin" ? `${nomAffiche(l)} (direction)` : nomAffiche(l)]));
}

async function versEdition(s: Showreel, c: Cible): Promise<ShowreelEditionDto> {
  const { f, u, estMoi } = c;
  const [campus, noms, photo] = await Promise.all([
    lienCampus(f, f.fuseau ?? s.fuseau),
    nomsDe([s.composeParId, s.publieParId, s.majParId]),
    s.photoFichierId ? db.select({ id: fichiers.id, mime: fichiers.mime }).from(fichiers).where(eq(fichiers.id, s.photoFichierId)).then((r) => r[0]) : Promise.resolve(undefined),
  ]);
  const enLigne = Boolean(s.versionPubliee);
  const modificationsNonPubliees = enLigne && !memeVersion(versionDe(s), s.versionPubliee);
  const direction = u.role === "admin";
  const verification = verifierPlans(s.plans);
  const slug = slugFormateur(f);
  const photoUrl = photo ? urlFichier(photo.id) : f.photoUrl;
  return {
    formateur: {
      id: f.id,
      prenom: f.prenom,
      nom: f.nom,
      nomAffiche: nomAffiche(f),
      photoUrl,
      photoForme: photo ? s.photoForme : "rond",
      campus,
      titre: f.titre,
      localisation: f.localisation,
      bio: f.bio,
      fuseau: f.fuseau,
      slug,
      consentementSite: f.consentementSite,
      proposeSurSite: f.proposeSurSite,
      publierSurSite: f.publierSurSite,
      actif: f.actif,
    },
    statut: s.statut,
    plans: s.plans,
    sources: s.sources,
    photo: photo ? { fichierId: photo.id, url: urlFichier(photo.id), mime: photo.mime } : null,
    photoForme: s.photoForme,
    fuseau: s.fuseau,
    imagePartage: s.imagePartageFichierId ? { fichierId: s.imagePartageFichierId, url: urlFichier(s.imagePartageFichierId) } : null,
    composition: s.composition,
    composeLe: iso(s.composeLe),
    composePar: s.composeParId ? (noms.get(s.composeParId) ?? null) : null,
    retouche: s.retouche,
    soumisLe: iso(s.soumisLe),
    valideLe: iso(s.valideLe),
    enLigne,
    publieLe: iso(s.publieLe),
    publiePar: s.publieParId ? (noms.get(s.publieParId) ?? null) : null,
    accordDirection: s.accordDirection,
    modificationsNonPubliees,
    urlPublique: visibleDuPublic(s, f) ? urlCampus(`/formateurs/${slug}/presentation`) : null,
    majLe: s.majLe.toISOString(),
    majPar: s.majParId ? (noms.get(s.majParId) ?? null) : null,
    ia: { disponible: iaDisponible(), raison: raisonIndisponible() },
    estMoi,
    peut: {
      modifier: true,
      composer: true,
      valider: estMoi && !(s.valideLe && s.statut !== "brouillon"),
      soumettre: direction && !estMoi && s.statut === "brouillon",
      publier: direction && f.actif && (!enLigne || modificationsNonPubliees || s.statut !== "publie"),
      retirer: enLigne && (direction || estMoi),
    },
    verification,
  };
}

async function journaliser(u: Utilisateur, action: string, details: Record<string, unknown>) {
  await db.insert(journal).values({ utilisateurId: u.id, action, details }).catch((e) => console.error("[showreel] journal :", e.message));
}

// ── Validation des saisies ─────────────────────────────────────────────────

const schemaPlan = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
  type: z.enum(TYPES_PLAN),
  surtitre: z.string().max(400).default(""),
  titre: z.string().max(400).default(""),
  texte: z.string().max(800).default(""),
  valeur: z.string().max(60).default(""),
  elements: z.array(z.object({ nom: z.string().max(300), detail: z.string().max(300).default("") })).max(12).default([]),
  sourceId: z.string().max(600).nullable().default(null),
  preuve: z.string().max(1200).default(""),
  aVerifier: z.boolean().default(false),
  duree: z.number().optional(),
});

const schemaSaisie = z.object({
  plans: z.array(schemaPlan).max(PLANS_MAX, `${PLANS_MAX} plans au plus.`).optional(),
  liens: z.array(z.object({ url: z.string().trim().min(1).max(500), afficher: z.boolean().optional() })).max(6, "six liens au plus").optional(),
  pdfFichierId: z.number().int().positive().nullable().optional(),
  photoFichierId: z.number().int().positive().nullable().optional(),
  photoForme: z.enum(FORMES_PHOTO).optional(),
  fuseau: z.string().trim().max(60).nullable().optional(),
  imagePartageFichierId: z.number().int().positive().nullable().optional(),
  origine: z.literal("import").optional(),
});

function fuseauValide(f: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: f });
    return /^[A-Za-z_]+\/[A-Za-z_\-/]+$/.test(f);
  } catch {
    return false;
  }
}

/** Plans reçus → plans propres : textes nettoyés et bornés, sources reconnues, campus et fin sans texte, 30 s au total. */
function plansPropres(recus: z.infer<typeof schemaPlan>[], sources: SourceShowreel[]): PlanShowreel[] {
  const identifiants = new Set([SOURCE_PROFIL, SOURCE_CAMPUS, ...sources.map((x) => x.id)]);
  const parUrl = new Map(sources.filter((x) => x.url).map((x) => [x.url!, x.id]));
  const ids = new Set<string>();
  let campusVu = false;
  let finVu = false;
  const plans: PlanShowreel[] = [];
  for (const p of recus) {
    if (p.type === "campus") {
      if (campusVu) continue;
      campusVu = true;
    }
    if (p.type === "fin") {
      if (finVu) continue;
      finVu = true;
    }
    let id = p.id && !ids.has(p.id) ? p.id : nouvelId();
    while (ids.has(id)) id = nouvelId();
    ids.add(id);
    let sourceId = p.sourceId;
    if (sourceId && /^https?:\/\//i.test(sourceId)) sourceId = parUrl.get(analyserLien(sourceId)?.url ?? "") ?? null;
    if (sourceId && !identifiants.has(sourceId)) sourceId = null;
    if (estPlanCampus(p.type)) {
      plans.push({ id, type: p.type, surtitre: "", titre: "", texte: "", valeur: "", elements: [], duree: 0, sourceId: SOURCE_CAMPUS, preuve: "", aVerifier: false });
      continue;
    }
    plans.push({
      id,
      type: p.type,
      surtitre: nettoyer(p.surtitre, LIMITES_PLAN.surtitre),
      titre: nettoyer(p.titre, LIMITES_PLAN.titre),
      texte: nettoyer(p.type === "citation" ? sansGuillemets(p.texte) : p.texte, LIMITES_PLAN.texte),
      valeur: nettoyer(p.valeur, LIMITES_PLAN.valeur),
      elements: p.elements
        .map((e) => ({ nom: nettoyer(e.nom, LIMITES_PLAN.elementNom), detail: nettoyer(e.detail, LIMITES_PLAN.elementDetail) }))
        .filter((e) => e.nom || e.detail)
        .slice(0, LIMITES_PLAN.elements),
      duree: 0,
      sourceId,
      preuve: nettoyer(p.preuve, 400),
      aVerifier: p.aVerifier,
    });
  }
  return rythmer(plans);
}

/** Liens saisis → sources : un lien déjà connu garde son identifiant et ce qui en a été lu. */
function sourcesDepuisLiens(liens: { url: string; afficher?: boolean }[], avant: SourceShowreel[]): SourceShowreel[] {
  const pdf = avant.filter((x) => x.type === "pdf");
  const connues = new Map(avant.filter((x) => x.url).map((x) => [x.url!, x]));
  let prochain = Math.max(0, ...avant.map((x) => Number(x.id.match(/^s(\d+)$/)?.[1] ?? 0))) + 1;
  const vues = new Set<string>();
  const liste: SourceShowreel[] = [];
  for (const l of liens) {
    const a = analyserLien(l.url);
    if (!a) throw invalide(`Ce lien n'est pas une adresse web valable : « ${l.url.slice(0, 80)} ».`);
    if (vues.has(a.url)) continue;
    vues.add(a.url);
    const deja = connues.get(a.url);
    if (deja) {
      liste.push({ ...deja, afficher: l.afficher ?? deja.afficher });
      continue;
    }
    liste.push({
      id: `s${prochain++}`,
      type: a.type,
      url: a.url,
      fichierId: null,
      nom: a.nom,
      afficher: l.afficher ?? true,
      etat: a.type === "site" ? "a_lire" : "non_lisible",
      message: messageNonLisible(a.type),
      luLe: null,
      pages: [],
      titrePage: null,
      caracteres: 0,
    });
  }
  return [...liste, ...pdf];
}

function messageNonLisible(type: SourceShowreel["type"]): string | null {
  if (type === "linkedin") return "LinkedIn refuse toute lecture automatique : le lien sera affiché, et le contenu viendra du PDF du profil.";
  if (type === "reseau") return "Ce réseau ne se laisse pas lire automatiquement : le lien sera seulement affiché.";
  return null;
}

/** Fichier déposé pour ce showreel : par la personne connectée ou par le formateur lui-même. */
async function fichierSource(id: number, c: Cible, attendu: "pdf" | "photo") {
  const [f] = await db.select().from(fichiers).where(eq(fichiers.id, id));
  if (!f || (f.proprietaireId !== c.u.id && f.proprietaireId !== c.f.id)) throw invalide("Ce fichier n'a pas été reçu. Déposez-le à nouveau.");
  if (attendu === "pdf") {
    if (f.mime !== "application/pdf" || f.usage !== "source-profil") throw invalide("Déposez le profil au format PDF.");
    if (f.taille > 10 * 1024 * 1024) throw invalide("Ce PDF est trop lourd (10 Mo au plus).");
  } else {
    if (!/^image\/(jpeg|png|webp)$/.test(f.mime) || !["source-profil", "avatar"].includes(f.usage)) throw invalide("La photo doit être une image JPEG, PNG ou WebP.");
  }
  return f;
}

// ── Lecture des liens ──────────────────────────────────────────────────────

const fmtJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Lit tous les sites personnels (en parallèle) ; LinkedIn et les réseaux restent des liens affichés. */
async function lireSources(sources: SourceShowreel[], extraits: Record<string, string>): Promise<{ sources: SourceShowreel[]; extraits: Record<string, string> }> {
  const nouveaux = { ...extraits };
  const lues = await Promise.all(
    sources.map(async (src): Promise<SourceShowreel> => {
      if (src.type === "linkedin" || src.type === "reseau") return { ...src, etat: "non_lisible", message: messageNonLisible(src.type) };
      if (src.type !== "site" || !src.url) return src;
      const maintenant = new Date();
      try {
        const l = await lireSite(src.url);
        nouveaux[src.id] = l.texte;
        return {
          ...src,
          etat: "lu",
          message: `Lu le ${fmtJour.format(maintenant)} : ${pluriel(l.pages.length, "page")}, ${new Intl.NumberFormat("fr-FR").format(l.caracteres)} caractères de texte.`,
          luLe: maintenant.toISOString(),
          pages: l.pages,
          titrePage: l.titre,
          caracteres: l.caracteres,
        };
      } catch (e) {
        delete nouveaux[src.id];
        const message = e instanceof ErreurLecture ? e.message : "Ce site n'a pas pu être lu. Réessayez plus tard, ou déposez un PDF.";
        if (!(e instanceof ErreurLecture)) console.error(`[showreel] lecture de ${src.url} :`, (e as Error).message);
        return { ...src, etat: "echec", message, luLe: maintenant.toISOString(), pages: [], titrePage: null, caracteres: 0 };
      }
    }),
  );
  // Les extraits des liens retirés ne sont pas gardés.
  for (const cle of Object.keys(nouveaux)) if (!lues.some((x) => x.id === cle)) delete nouveaux[cle];
  return { sources: lues, extraits: nouveaux };
}

// ── Page publique : balises Open Graph ─────────────────────────────────────

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type Publiee = { f: Utilisateur; s: Showreel; version: VersionShowreel; slug: string };

/** Formateur par son slug public (ou « prenom-nom-<id> »), avec sa présentation visible du public. */
async function presentationPubliee(slug: string): Promise<Publiee | null> {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  const conditions = and(eq(utilisateurs.role, "formateur"), eq(utilisateurs.actif, true), eq(utilisateurs.consentementSite, true), eq(utilisateurs.publierSurSite, true));
  let [ligne] = await db.select({ f: utilisateurs, s: showreels }).from(utilisateurs).innerJoin(showreels, eq(showreels.formateurId, utilisateurs.id)).where(and(conditions, eq(utilisateurs.slug, slug)));
  if (!ligne) {
    const id = Number(slug.match(/-(\d+)$/)?.[1]);
    if (id) {
      [ligne] = await db.select({ f: utilisateurs, s: showreels }).from(utilisateurs).innerJoin(showreels, eq(showreels.formateurId, utilisateurs.id)).where(and(conditions, eq(utilisateurs.id, id)));
      if (ligne && slugFormateur(ligne.f) !== slug) return null;
    }
  }
  if (!ligne?.s.versionPubliee) return null;
  return { f: ligne.f, s: ligne.s, version: ligne.s.versionPubliee, slug: slugFormateur(ligne.f) };
}

/** Photo publique : celle de la présentation, sinon la photo du profil (servie par la vitrine, le formateur étant publié). */
async function photoPublique(p: Publiee): Promise<{ url: string; mime: string } | null> {
  if (p.version.photoFichierId) {
    const [f] = await db.select({ mime: fichiers.mime }).from(fichiers).where(eq(fichiers.id, p.version.photoFichierId));
    if (f) return { url: urlCampus(`/api/public/presentations/${p.slug}/photo?v=${p.version.photoFichierId}`), mime: f.mime };
  }
  const id = Number(p.f.photoUrl?.match(/^\/api\/fichiers\/(\d+)/)?.[1]);
  if (id) {
    const [f] = await db.select({ mime: fichiers.mime }).from(fichiers).where(eq(fichiers.id, id));
    if (f) return { url: urlCampus(`/api/public/images/${id}`), mime: f.mime };
  }
  return null;
}

async function versPublic(p: Publiee): Promise<ShowreelPublicDto> {
  const [campus, photo] = await Promise.all([lienCampus(p.f, p.f.fuseau ?? p.version.fuseau), photoPublique(p)]);
  const formateur: FormateurShowreel = {
    id: p.f.id,
    prenom: p.f.prenom,
    nom: p.f.nom,
    nomAffiche: nomAffiche(p.f),
    photoUrl: photo?.url ?? null,
    photoForme: p.version.photoFichierId ? p.version.photoForme : "rond",
    campus,
  };
  return {
    slug: p.slug,
    formateur,
    scenes: p.version.plans,
    duree: dureeTotale(p.version.plans),
    liens: p.s.sources.filter((x) => x.afficher && x.url && x.type !== "pdf").map((x) => ({ nom: x.nom, url: x.url!, type: x.type })),
    publieLe: (p.s.publieLe ?? p.s.majLe).toISOString(),
    urlPage: urlCampus(`/formateurs/${p.slug}/presentation`),
    urlFiche: urlCampus(`/formateurs/${p.slug}`),
  };
}

async function metaPresentation(url: string): Promise<string | null> {
  const chemin = url.split(/[?#]/)[0].replace(/\/+$/, "");
  const m = chemin.match(/^\/formateurs\/([^/]+)\/presentation$/);
  if (!m) return null;
  const p = await presentationPubliee(decodeURIComponent(m[1]));
  if (!p) return null;
  const dto = await versPublic(p);
  const ouverture = dto.scenes.find((x) => x.type === "ouverture");
  const c = dto.formateur.campus;
  const rendezVous = c.cours && c.jourLibelle && c.heureDebut ? `${c.cours.titre}, le ${c.jourLibelle.toLowerCase()} à ${c.heureDebut.replace(":", "h")}, en direct dans les ${nombreEnLettres(c.campus.length)} campus 2IAE.` : "Formateur du campus numérique 2IAE, en direct dans les campus du groupe.";
  const titre = `${dto.formateur.nomAffiche} en 30 secondes · ${NOM_CAMPUS}`;
  const description = [ouverture?.texte, rendezVous].filter(Boolean).join(". ").replace(/\.\./g, ".");
  const photo = await photoPublique(p);
  const alt = `${dto.formateur.nomAffiche}, formateur du campus numérique 2IAE`;
  const image = p.s.imagePartageFichierId
    ? { url: urlCampus(`/api/public/presentations/${p.slug}/apercu?v=${p.s.imagePartageFichierId}`), alt, largeur: 1200, hauteur: 630 }
    : photo && /^image\/(png|jpeg)$/.test(photo.mime)
      ? { url: photo.url, alt }
      : { url: urlCampus("/og-campus.png"), alt: "Campus numérique 2IAE : un cours, cinq campus, en direct.", largeur: 1200, hauteur: 630 };
  const d = description.length > 200 ? `${description.slice(0, 197)}…` : description;
  return [
    `<title>${echapper(titre)}</title>`,
    `<meta name="description" content="${echapper(d)}" />`,
    `<link rel="canonical" href="${echapper(dto.urlPage)}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:site_name" content="${NOM_CAMPUS}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${echapper(titre)}" />`,
    `<meta property="og:description" content="${echapper(d)}" />`,
    `<meta property="og:url" content="${echapper(dto.urlPage)}" />`,
    `<meta property="og:image" content="${echapper(image.url)}" />`,
    ...("largeur" in image ? [`<meta property="og:image:width" content="${image.largeur}" />`, `<meta property="og:image:height" content="${image.hauteur}" />`] : []),
    `<meta property="og:image:alt" content="${echapper(image.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${echapper(titre)}" />`,
    `<meta name="twitter:description" content="${echapper(d)}" />`,
    `<meta name="twitter:image" content="${echapper(image.url)}" />`,
  ].join("\n    ");
}

// ── Routes ─────────────────────────────────────────────────────────────────

async function envoyerFichier(res: Response, id: number) {
  const [f] = await db.select().from(fichiers).where(eq(fichiers.id, id));
  if (!f || !/^image\/(jpeg|png|webp)$/.test(f.mime)) throw introuvable("Photo");
  const chemin = path.resolve(config.dossierFichiers, f.cle);
  if (!chemin.startsWith(config.dossierFichiers) || !fs.existsSync(chemin)) throw introuvable("Photo");
  res.setHeader("Content-Type", f.mime);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  fs.createReadStream(chemin)
    .on("error", () => res.destroy())
    .pipe(res);
}

export function enregistrerShowreel(app: Express) {
  enregistrerMetaPage(metaPresentation);

  // Un formateur lit les fichiers de SA présentation, même déposés par la direction.
  enregistrerGardienFichier("source-profil", async (u, f) => {
    if (u.role !== "formateur") return false;
    const [s] = await db.select({ photo: showreels.photoFichierId, sources: showreels.sources }).from(showreels).where(eq(showreels.formateurId, u.id));
    return Boolean(s && (s.photo === f.id || s.sources.some((x) => x.fichierId === f.id)));
  });

  // ── Éditeur ──────────────────────────────────────────────────────────────

  app.get(
    "/api/showreels/:cible",
    FORMATEUR_OU_DIRECTION,
    route(async (req, res) => {
      const c = await resoudreCible(req);
      res.json(await versEdition(await chargerShowreel(c.f, c.u), c));
    }),
  );

  app.patch(
    "/api/showreels/:cible",
    FORMATEUR_OU_DIRECTION,
    route(async (req, res) => {
      const c = await resoudreCible(req);
      const d = valider(schemaSaisie, req.body);
      if (d.origine === "import" && c.u.role !== "admin") throw interdit("Seule la direction dépose une présentation toute prête.");
      const s = await chargerShowreel(c.f, c.u);
      const maj: Partial<typeof showreels.$inferInsert> = {};

      let sources = s.sources;
      if (d.liens !== undefined) {
        sources = sourcesDepuisLiens(d.liens, sources);
        maj.sources = sources;
        maj.extraits = Object.fromEntries(Object.entries(s.extraits).filter(([k]) => sources.some((x) => x.id === k)));
      }
      if (d.pdfFichierId !== undefined) {
        sources = sources.filter((x) => x.type !== "pdf");
        if (d.pdfFichierId !== null) {
          const f = await fichierSource(d.pdfFichierId, c, "pdf");
          sources.push({
            id: "pdf",
            type: "pdf",
            url: null,
            fichierId: f.id,
            nom: f.nomOriginal.slice(0, 80),
            afficher: false,
            etat: "a_lire",
            message: "Il sera transmis à l'assistant IA lors de la composition.",
            luLe: null,
            pages: [],
            titrePage: null,
            caracteres: 0,
          });
        }
        maj.sources = sources;
      }
      if (d.photoFichierId !== undefined) {
        maj.photoFichierId = d.photoFichierId === null ? null : (await fichierSource(d.photoFichierId, c, "photo")).id;
      }
      if (d.photoForme !== undefined) maj.photoForme = d.photoForme;
      if (d.imagePartageFichierId !== undefined) {
        if (c.u.role !== "admin") throw interdit("L'image d'aperçu est déposée par la direction.");
        if (d.imagePartageFichierId === null) maj.imagePartageFichierId = null;
        else {
          const f = await fichierSource(d.imagePartageFichierId, c, "photo");
          if (!/^image\/(jpeg|png)$/.test(f.mime)) throw invalide("L'image d'aperçu doit être un JPEG ou un PNG (WhatsApp ne lit pas le WebP).");
          maj.imagePartageFichierId = f.id;
        }
      }
      if (d.fuseau !== undefined) {
        if (d.fuseau && !fuseauValide(d.fuseau)) throw invalide("Fuseau horaire inconnu (exemple : America/Toronto).");
        maj.fuseau = d.fuseau || null;
      }
      if (d.plans !== undefined) maj.plans = plansPropres(d.plans, sources);

      const apres = versionDe({ plans: maj.plans ?? s.plans, photoFichierId: maj.photoFichierId !== undefined ? maj.photoFichierId : s.photoFichierId, photoForme: maj.photoForme ?? s.photoForme, fuseau: maj.fuseau !== undefined ? maj.fuseau : s.fuseau });
      const contenuChange = !memeVersion(apres, versionDe(s));
      if (d.origine === "import") {
        maj.composition = "import";
        maj.composeLe = new Date();
        maj.composeParId = c.u.id;
        maj.retouche = false;
      } else if (d.plans !== undefined && canonique(maj.plans) !== canonique(s.plans)) {
        maj.retouche = true;
      }
      // Une version modifiée doit être validée à nouveau (la version en ligne, elle, ne change pas).
      if (contenuChange) {
        // Revenu exactement à la version en ligne : rien à valider ni à republier.
        const commeEnLigne = memeVersion(apres, s.versionPubliee);
        maj.statut = commeEnLigne ? "publie" : "brouillon";
        maj.valideLe = null;
        maj.soumisLe = null;
      }
      if (!Object.keys(maj).length) return res.json(await versEdition(s, c));
      maj.majLe = new Date();
      maj.majParId = c.u.id;
      const [ecrit] = await db.update(showreels).set(maj).where(eq(showreels.id, s.id)).returning();
      if (d.origine === "import") await journaliser(c.u, "showreel_importe", { formateurId: c.f.id, plans: ecrit.plans.length });
      res.json(await versEdition(ecrit, c));
    }),
  );

  app.post(
    "/api/showreels/:cible/lire",
    FORMATEUR_OU_DIRECTION,
    route(async (req, res) => {
      const c = await resoudreCible(req);
      const s = await chargerShowreel(c.f, c.u);
      if (!s.sources.some((x) => x.url)) throw invalide("Ajoutez d'abord un lien.");
      const lu = await lireSources(s.sources, s.extraits);
      const [ecrit] = await db.update(showreels).set({ sources: lu.sources, extraits: lu.extraits }).where(eq(showreels.id, s.id)).returning();
      res.json(await versEdition(ecrit, c));
    }),
  );

  app.post(
    "/api/showreels/:cible/composer",
    FORMATEUR_OU_DIRECTION,
    route(async (req, res) => {
      const c = await resoudreCible(req);
      const s = await chargerShowreel(c.f, c.u);
      const vous = c.estMoi ? { profil: "votre profil", liens: "Vos liens et votre PDF sont gardés" } : { profil: "son profil", liens: "Ses liens et son PDF sont gardés" };
      const lu = await lireSources(s.sources, s.extraits);
      let sources = lu.sources;
      const campus = await lienCampus(c.f, c.f.fuseau ?? s.fuseau);
      const profil = profilDe(c.f);
      const sites = sources.filter((x) => x.type === "site" && x.etat === "lu" && lu.extraits[x.id]).map((x) => ({ id: x.id, url: x.url!, nom: x.nom, texte: lu.extraits[x.id] }));
      const sourcePdf = sources.find((x) => x.type === "pdf" && x.fichierId);
      let pdf: { id: string; nom: string; base64: string } | null = null;
      if (sourcePdf?.fichierId) {
        const [f] = await db.select().from(fichiers).where(eq(fichiers.id, sourcePdf.fichierId));
        const chemin = f ? path.resolve(config.dossierFichiers, f.cle) : "";
        if (f && chemin.startsWith(config.dossierFichiers) && fs.existsSync(chemin)) {
          pdf = { id: sourcePdf.id, nom: f.nomOriginal, base64: (await fs.promises.readFile(chemin)).toString("base64") };
        } else {
          sources = sources.map((x) => (x.id === sourcePdf.id ? { ...x, etat: "echec", message: "Ce PDF n'est plus disponible : déposez-le à nouveau." } : x));
        }
      }

      let rapport: RapportComposition;
      let plans: PlanShowreel[];
      const aucuneSource = !sites.length && !pdf;
      if (iaDisponible() && !aucuneSource) {
        try {
          try {
            await verifierQuota(c.u.id);
          } catch (e) {
            if (e instanceof ErreurIa && e.statut === 429) throw new ErreurHttp(429, "La limite quotidienne de l'assistant IA est atteinte pour ce compte. Réessayez demain.");
            throw e;
          }
          const r = await composerAvecIa({ profil, sites, pdf }, c.u.id);
          plans = assembler(r.plans);
          const maintenant = new Date().toISOString();
          if (pdf) sources = sources.map((x) => (x.id === pdf!.id ? { ...x, etat: "lu", luLe: maintenant, message: `Transmis à l'assistant IA le ${fmtJour.format(new Date())}.` } : x));
          const noms = [...sites.map((x) => x.nom), ...(pdf ? ["le PDF du profil"] : [])];
          const aVerifier = plans.filter((p) => p.aVerifier).length;
          rapport = {
            mode: "ia",
            raison: null,
            message: `Présentation composée par l'assistant IA à partir de ${noms.join(" et ")}. Relisez chaque plan : rien n'est publié sans validation.`,
            manques: r.manques,
            aVerifier,
            sources,
          };
        } catch (e) {
          if (e instanceof ErreurHttp) throw e;
          console.error("[showreel] composition IA impossible :", (e as Error).message);
          const raison = raisonIndisponible() ?? "erreur";
          plans = composerSansIa(profil, campus);
          rapport = {
            mode: "secours",
            raison,
            message:
              raison === "panne"
                ? `L'assistant IA est momentanément indisponible. La présentation a été composée à partir de ${vous.profil} et de l'emploi du temps. ${vous.liens} : relancez la composition dans quelques minutes.`
                : `L'assistant IA n'a pas pu composer la présentation cette fois-ci. Elle a été composée à partir de ${vous.profil} et de l'emploi du temps. ${vous.liens} : relancez la composition plus tard.`,
            manques: [],
            aVerifier: 0,
            sources,
          };
        }
      } else {
        plans = composerSansIa(profil, campus);
        const raison = raisonIndisponible();
        const ajouter = aucuneSource ? " Ajoutez aussi un site personnel ou le PDF du profil LinkedIn : l'assistant composera à partir de ces sources." : ` ${vous.liens} : relancez la composition quand l'assistant sera de retour.`;
        rapport = {
          mode: "secours",
          raison,
          message:
            raison === "panne"
              ? `L'assistant IA est momentanément indisponible (compte en pause). La présentation a été composée sans IA, à partir de ${vous.profil} et de l'emploi du temps.${ajouter}`
              : raison === "configuration"
                ? `L'assistant IA n'est pas activé sur le campus pour le moment. La présentation a été composée sans IA, à partir de ${vous.profil} et de l'emploi du temps.${ajouter}`
                : `Aucune source lisible pour l'instant : la présentation reprend ${vous.profil} et l'emploi du temps. Ajoutez un site personnel ou le PDF du profil LinkedIn, puis composez à nouveau.`,
          manques: [],
          aVerifier: 0,
          sources,
        };
      }

      const [ecrit] = await db
        .update(showreels)
        .set({
          plans,
          sources,
          extraits: lu.extraits,
          composition: rapport.mode,
          composeLe: new Date(),
          composeParId: c.u.id,
          retouche: false,
          statut: "brouillon",
          valideLe: null,
          soumisLe: null,
          majLe: new Date(),
          majParId: c.u.id,
        })
        .where(eq(showreels.id, s.id))
        .returning();
      await journaliser(c.u, "showreel_compose", { formateurId: c.f.id, mode: rapport.mode, raison: rapport.raison, plans: plans.length });
      const reponse: ReponseComposition = { showreel: await versEdition(ecrit, c), rapport };
      res.json(reponse);
    }),
  );

  app.post(
    "/api/showreels/:cible/soumettre",
    DIRECTION,
    route(async (req, res) => {
      const c = await resoudreCible(req);
      const s = await chargerShowreel(c.f, c.u);
      const { bloquants } = verifierPlans(s.plans);
      if (bloquants.length) throw invalide(bloquants[0]);
      const [ecrit] = await db.update(showreels).set({ statut: "a_valider", soumisLe: new Date(), majLe: new Date(), majParId: c.u.id }).where(eq(showreels.id, s.id)).returning();
      await notifier([c.f.id], {
        type: "systeme",
        titre: "Votre présentation de 30 secondes est prête",
        corps: "La direction l'a préparée. Relisez-la, retouchez-la si besoin, puis validez-la pour qu'elle soit publiée.",
        lien: "/profil/presentation",
        push: false,
      });
      await journaliser(c.u, "showreel_soumis", { formateurId: c.f.id });
      res.json(await versEdition(ecrit, c));
    }),
  );

  app.post(
    "/api/showreels/:cible/valider",
    FORMATEUR_OU_DIRECTION,
    route(async (req, res) => {
      const c = await resoudreCible(req);
      if (!c.estMoi) throw interdit("Seul le formateur peut valider sa présentation. La direction peut la publier en confirmant avoir son accord.");
      const s = await chargerShowreel(c.f, c.u);
      const { bloquants } = verifierPlans(s.plans);
      if (bloquants.length) throw invalide(bloquants[0]);
      const maintenant = new Date();
      const [ecrit] = await db.update(showreels).set({ statut: "a_valider", valideLe: maintenant, majLe: maintenant, majParId: c.u.id }).where(eq(showreels.id, s.id)).returning();
      // Valider, c'est consentir à la publication : la fiche est proposée, la direction publie (§9.10).
      const majProfil: Partial<typeof utilisateurs.$inferInsert> = { consentementSite: true };
      if (!c.f.publierSurSite) majProfil.proposeSurSite = true;
      if (!c.f.slug) majProfil.slug = await slugDisponible(c.f);
      await db.update(utilisateurs).set(majProfil).where(eq(utilisateurs.id, c.f.id));
      oublierUtilisateur(c.f.id);
      const admins = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true)));
      await notifier(
        admins.map((a) => a.id),
        { type: "systeme", titre: `${nomAffiche(c.f)} a validé sa présentation de 30 secondes`, corps: "Relisez-la et publiez-la sur sa page.", lien: `/pilotage/formateurs/${c.f.id}/presentation`, push: false },
      );
      await journaliser(c.u, "showreel_valide", { formateurId: c.f.id });
      const [f] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, c.f.id));
      res.json(await versEdition(ecrit, { ...c, f, u: c.estMoi ? f : c.u }));
    }),
  );

  app.post(
    "/api/showreels/:cible/publier",
    DIRECTION,
    route(async (req, res) => {
      const c = await resoudreCible(req);
      const d = valider(z.object({ accordConfirme: z.boolean().optional() }), req.body ?? {});
      const s = await chargerShowreel(c.f, c.u);
      if (!c.f.actif) throw invalide("Ce compte est désactivé : réactivez-le avant de publier.");
      const { bloquants } = verifierPlans(s.plans);
      if (bloquants.length) throw invalide(bloquants[0]);
      if (!s.valideLe && !d.accordConfirme) {
        throw new ErreurHttp(409, `${nomAffiche(c.f)} n'a pas encore validé cette version dans le campus : confirmez que vous avez son accord pour la publier.`);
      }
      const maintenant = new Date();
      const [ecrit] = await db
        .update(showreels)
        .set({ statut: "publie", versionPubliee: versionDe(s), publieLe: maintenant, publieParId: c.u.id, accordDirection: !s.valideLe, majLe: maintenant, majParId: c.u.id })
        .where(eq(showreels.id, s.id))
        .returning();
      // La présentation vit sur la fiche publique du formateur : consentement, publication et slug.
      const majProfil: Partial<typeof utilisateurs.$inferInsert> = { consentementSite: true, publierSurSite: true, proposeSurSite: false };
      if (!c.f.annonceLe) majProfil.annonceLe = maintenant;
      if (!c.f.slug) majProfil.slug = await slugDisponible(c.f);
      // Un profil sans photo reprend celle de la présentation (même visage sur la fiche, les cours et le direct).
      if (!c.f.photoUrl && s.photoFichierId) majProfil.photoUrl = `/api/public/presentations/${majProfil.slug ?? c.f.slug}/photo?v=${s.photoFichierId}`;
      await db.update(utilisateurs).set(majProfil).where(eq(utilisateurs.id, c.f.id));
      oublierUtilisateur(c.f.id);
      prevenirSite("présentation d'un formateur publiée");
      const [f] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, c.f.id));
      await notifier([f.id], {
        type: "systeme",
        titre: "Votre présentation de 30 secondes est en ligne",
        corps: "Elle se voit sur votre page du site du campus. Vous pouvez la partager sur WhatsApp.",
        lien: `/formateurs/${slugFormateur(f)}/presentation`,
        push: false,
      });
      await journaliser(c.u, "showreel_publie", { formateurId: c.f.id, accordDirection: !s.valideLe, valideLe: iso(s.valideLe) });
      res.json(await versEdition(ecrit, { ...c, f }));
    }),
  );

  app.post(
    "/api/showreels/:cible/retirer",
    FORMATEUR_OU_DIRECTION,
    route(async (req, res) => {
      const c = await resoudreCible(req);
      const s = await chargerShowreel(c.f, c.u);
      if (!s.versionPubliee) throw invalide("Cette présentation n'est pas en ligne.");
      const [ecrit] = await db
        .update(showreels)
        .set({ versionPubliee: null, publieLe: null, publieParId: null, accordDirection: false, statut: "brouillon", valideLe: null, soumisLe: null, majLe: new Date(), majParId: c.u.id })
        .where(eq(showreels.id, s.id))
        .returning();
      prevenirSite("présentation d'un formateur retirée");
      await journaliser(c.u, "showreel_retire", { formateurId: c.f.id, par: c.estMoi ? "formateur" : "direction" });
      res.json(await versEdition(ecrit, c));
    }),
  );

  // ── Direction : tous les formateurs ──────────────────────────────────────

  app.get(
    "/api/pilotage/showreels",
    DIRECTION,
    route(async (_req, res) => {
      const [lignes, ctx] = await Promise.all([
        db
          .select({ f: utilisateurs, s: showreels })
          .from(utilisateurs)
          .leftJoin(showreels, eq(showreels.formateurId, utilisateurs.id))
          .where(eq(utilisateurs.role, "formateur"))
          .orderBy(sql`${utilisateurs.actif} desc`, asc(utilisateurs.nom), asc(utilisateurs.prenom)),
        chargerContexteCampus(),
      ]);
      const liste: ShowreelResumeDto[] = [];
      for (const { f, s } of lignes) {
        const campus = lienCampusDe(ctx, f, f.fuseau ?? s?.fuseau ?? null, null);
        liste.push({
          formateurId: f.id,
          prenom: f.prenom,
          nom: f.nom,
          nomAffiche: nomAffiche(f),
          titre: f.titre,
          photoUrl: f.photoUrl,
          actif: f.actif,
          statut: s?.statut ?? "aucun",
          enLigne: Boolean(s?.versionPubliee),
          modificationsNonPubliees: Boolean(s?.versionPubliee && !memeVersion(versionDe(s), s.versionPubliee)),
          composition: s?.composition ?? null,
          composeLe: iso(s?.composeLe),
          valideLe: iso(s?.valideLe),
          publieLe: iso(s?.publieLe),
          majLe: iso(s?.majLe),
          nbPlans: s?.plans.length ?? 0,
          nbSources: s?.sources.length ?? 0,
          cours: campus.cours?.titre ?? null,
          jourLibelle: campus.jourLibelle,
          heureDebut: campus.heureDebut,
          urlPublique: s && visibleDuPublic(s, f) ? urlCampus(`/formateurs/${slugFormateur(f)}/presentation`) : null,
        });
      }
      res.json(liste);
    }),
  );

  // ── Public ───────────────────────────────────────────────────────────────

  // Les présentations en ligne, des plus récentes aux plus anciennes (accueil du site public).
  app.get(
    "/api/public/presentations",
    route(async (_req, res) => {
      const lignes = await db
        .select({ f: utilisateurs, s: showreels })
        .from(utilisateurs)
        .innerJoin(showreels, eq(showreels.formateurId, utilisateurs.id))
        .where(
          and(
            eq(utilisateurs.role, "formateur"),
            eq(utilisateurs.actif, true),
            eq(utilisateurs.consentementSite, true),
            eq(utilisateurs.publierSurSite, true),
            isNotNull(showreels.publieLe),
          ),
        )
        .orderBy(desc(showreels.publieLe))
        .limit(6);
      const liste = await Promise.all(
        lignes.filter((l) => l.s.versionPubliee).map((l) => versPublic({ f: l.f, s: l.s, version: l.s.versionPubliee!, slug: slugFormateur(l.f) })),
      );
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(liste);
    }),
  );

  app.get(
    "/api/public/presentations/:slug",
    route(async (req, res) => {
      const p = await presentationPubliee(String(req.params.slug));
      if (!p) throw introuvable("Présentation");
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(await versPublic(p));
    }),
  );

  app.get(
    "/api/public/presentations/:slug/apercu",
    route(async (req, res) => {
      const p = await presentationPubliee(String(req.params.slug));
      if (!p?.s.imagePartageFichierId) throw introuvable("Image");
      await envoyerFichier(res, p.s.imagePartageFichierId);
    }),
  );

  app.get(
    "/api/public/presentations/:slug/photo",
    route(async (req, res) => {
      const p = await presentationPubliee(String(req.params.slug));
      if (!p?.version.photoFichierId) throw introuvable("Photo");
      await envoyerFichier(res, p.version.photoFichierId);
    }),
  );
}
