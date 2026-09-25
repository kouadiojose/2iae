// Vitrine publique : ce que le campus montre au monde, sans compte.
//
//   GET /api/public/vitrine            → Vitrine (lue par le site www.2iae.com)
//   GET /api/public/cours/:slug        → fiche d'un cours annoncé
//   GET /api/public/formateurs/:slug   → fiche d'un formateur annoncé
//   GET /api/public/sites              → les cinq campus et leur salle
//   GET /api/public/images/:fichierId  → image d'un cours annoncé ou photo d'un formateur
//                                        annoncé (les fichiers déposés sont sinon réservés aux comptes)
//
// Tout est piloté par les cases « Annoncer sur 2iae.com » (publierSurSite)
// validées par la direction. Jamais une donnée nominative d'étudiant : la
// vitrine ne publie que des agrégats. Un formateur n'est nommé qu'avec son
// consentement (consentementSite), et sa fiche n'existe que s'il est annoncé.
//
// Les pages publiques du campus (/, /cours-ouverts/:slug, /formateurs/:slug)
// reçoivent aussi leurs balises Open Graph côté serveur : un lien partagé sur
// WhatsApp affiche une vraie carte d'aperçu.
import type { Express, Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { and, asc, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { config, estProduction } from "../config";
import { route, introuvable, idParam } from "../http";
import { surChangementPublication } from "../site";
import { enregistrerMetaPage } from "../vite";
import {
  cours,
  coursClasses,
  coursFormateurs,
  classes,
  sites,
  utilisateurs,
  seances,
  annonces,
  modules,
  lecons,
  fichiers,
  type Cours,
  type Utilisateur,
  type SitePublic,
  type CampusCours,
  type FicheCoursPublique,
  type FicheFormateurPublique,
} from "@shared/schema";
import type { Vitrine, VitrineCours, VitrineFormateur, VitrineLive, VitrineAnnonce } from "@shared/api";

const JOUR = 86_400_000;
/** Un cours reste annoncé jusqu'à 30 jours après son début. */
const FENETRE_COURS_COMMENCE = 30 * JOUR;
/** Les lives publics des 14 prochains jours. */
const FENETRE_LIVES = 14 * JOUR;
/** Cache mémoire de la vitrine (le site garde aussi sa propre copie). */
const DUREE_CACHE_MS = 60_000;

export const NOM_CAMPUS = "Campus numérique 2IAE";

// ── Petits outils ──────────────────────────────────────────────────────────

/** « Karim Diallo » → « karim-diallo ». */
export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // accents détachés par NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Adresse absolue vers une page du campus (le site affiche ces liens tels quels). */
const urlCampus = (chemin: string) => `${config.urlCampus}${chemin}`;

/** Slug public d'un formateur : celui de sa fiche, sinon « prenom-nom-<id> ». */
function slugFormateur(u: Pick<Utilisateur, "id" | "slug" | "prenom" | "nom">): string {
  return u.slug || `${slugifier(`${u.prenom} ${u.nom}`)}-${u.id}`;
}

/** Identifiant de fichier d'une URL interne « /api/fichiers/12 ». */
function idFichierInterne(url: string | null): number | null {
  const m = url?.match(/^\/api\/fichiers\/(\d+)(?:[/?#]|$)/);
  return m ? Number(m[1]) : null;
}

/** Adresse publique d'une image déposée sur le campus (voir GET /api/public/images/:fichierId). */
const routeImage = (id: number) => `/api/public/images/${id}`;

/**
 * Rend une image utilisable hors du campus : les fichiers internes
 * (/api/fichiers/:id) sont réservés aux comptes connectés, on passe donc par
 * la route publique des images, qui vérifie la publication. L'identifiant
 * change avec l'image : les caches ne gardent jamais une ancienne photo.
 */
function imagePublique(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  const id = idFichierInterne(url);
  if (id) return urlCampus(routeImage(id));
  return url.startsWith("/") ? urlCampus(url) : null;
}

/** Accroche d'un cours pour le site : la phrase choisie, sinon le début de la description. */
function accrocheDe(c: Pick<Cours, "accrocheSite" | "description">): string {
  const choisie = c.accrocheSite?.trim();
  if (choisie) return choisie;
  const texte = c.description
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (texte.length <= 160) return texte;
  const coupe = texte.slice(0, 157);
  return `${coupe.slice(0, Math.max(coupe.lastIndexOf(" "), 120))}…`;
}

// ── Qui est public ? ───────────────────────────────────────────────────────

/** Cours annoncés affichés par la vitrine : à venir, ou commencés depuis moins de 30 jours. */
function filtreCoursVitrine(maintenant: Date) {
  return and(
    eq(cours.publierSurSite, true),
    ne(cours.statut, "archive"),
    or(isNull(cours.dateDebut), gte(cours.dateDebut, new Date(maintenant.getTime() - FENETRE_COURS_COMMENCE))),
    or(isNull(cours.dateFin), gte(cours.dateFin, maintenant)),
  );
}

/** Formateurs dont la fiche peut paraître : annoncés par la direction ET consentants. */
const filtreFormateurPublic = and(
  eq(utilisateurs.role, "formateur"),
  eq(utilisateurs.actif, true),
  eq(utilisateurs.publierSurSite, true),
  eq(utilisateurs.consentementSite, true),
);

/** Lives publics : en direct, ou pas encore terminés et dans les 14 prochains jours. */
function filtreLivesPublics(maintenant: Date) {
  return and(
    eq(seances.publierSurSite, true),
    ne(cours.statut, "archive"),
    or(
      eq(seances.statut, "en_direct"),
      and(
        eq(seances.statut, "planifiee"),
        sql`${seances.debut} <= ${new Date(maintenant.getTime() + FENETRE_LIVES).toISOString()}::timestamptz`,
        sql`${seances.debut} + (${seances.dureeMinutes} * interval '1 minute') > ${maintenant.toISOString()}::timestamptz`,
      ),
    ),
  );
}

// ── Construction des cartes ────────────────────────────────────────────────

type LigneFormateur = Pick<Utilisateur, "id" | "slug" | "prenom" | "nom" | "titre" | "localisation" | "bio" | "photoUrl" | "annonceLe">;

const colonnesFormateur = {
  id: utilisateurs.id,
  slug: utilisateurs.slug,
  prenom: utilisateurs.prenom,
  nom: utilisateurs.nom,
  titre: utilisateurs.titre,
  localisation: utilisateurs.localisation,
  bio: utilisateurs.bio,
  photoUrl: utilisateurs.photoUrl,
  annonceLe: utilisateurs.annonceLe,
};

/** Nombre de campus (sites distincts des classes inscrites) par cours. */
async function campusParCours(ids: number[]): Promise<Map<number, CampusCours[]>> {
  const carte = new Map<number, CampusCours[]>();
  if (!ids.length) return carte;
  const lignes = await db
    .selectDistinct({ coursId: coursClasses.coursId, slug: sites.slug, nomCourt: sites.nomCourt, salle: sites.salleConference, ordre: sites.ordre })
    .from(coursClasses)
    .innerJoin(classes, eq(classes.id, coursClasses.classeId))
    .innerJoin(sites, eq(sites.id, classes.siteId))
    .where(inArray(coursClasses.coursId, ids))
    .orderBy(asc(sites.ordre));
  for (const l of lignes) {
    const liste = carte.get(l.coursId) ?? [];
    liste.push({ slug: l.slug, nomCourt: l.nomCourt, salle: l.salle });
    carte.set(l.coursId, liste);
  }
  return carte;
}

type Catalogue = { cours: VitrineCours[]; formateurs: VitrineFormateur[] };

/** Cours annoncés et formateurs annoncés, reliés entre eux. */
async function construireCatalogue(maintenant: Date): Promise<Catalogue> {
  const [lignes, formateursPublics] = await Promise.all([
    db
      .select()
      .from(cours)
      .where(filtreCoursVitrine(maintenant))
      .orderBy(sql`${cours.dateDebut} asc nulls last`, asc(cours.titre)),
    db
      .select(colonnesFormateur)
      .from(utilisateurs)
      .where(filtreFormateurPublic)
      .orderBy(sql`${utilisateurs.annonceLe} desc nulls last`, asc(utilisateurs.nom)),
  ]);
  const ids = lignes.map((c) => c.id);
  const [campus, coFormateurs] = await Promise.all([
    campusParCours(ids),
    ids.length ? db.select().from(coursFormateurs).where(inArray(coursFormateurs.coursId, ids)) : Promise.resolve([]),
  ]);

  // Fiches des formateurs annoncés ; la même fiche est partagée par les cartes de leurs cours.
  const fiches = new Map<number, VitrineFormateur>();
  for (const f of formateursPublics) fiches.set(f.id, versVitrineFormateur(f, []));

  // Chaque formateur liste ses cours annoncés (principal ou co-formateur).
  const formateursDuCours = new Map<number, number[]>(lignes.map((c) => [c.id, c.formateurId ? [c.formateurId] : []]));
  for (const cf of coFormateurs) formateursDuCours.get(cf.coursId)?.push(cf.formateurId);
  for (const c of lignes) {
    for (const fid of formateursDuCours.get(c.id) ?? []) fiches.get(fid)?.cours.push({ code: c.code, titre: c.titre, slug: c.slug });
  }

  const cartesCours: VitrineCours[] = lignes.map((c) => ({
    code: c.code,
    slug: c.slug,
    titre: c.titre,
    accroche: accrocheDe(c),
    imageUrl: imagePublique(c.imageUrl),
    couleur: c.couleur,
    dateDebut: c.dateDebut?.toISOString() ?? null,
    dateFin: c.dateFin?.toISOString() ?? null,
    formateur: c.formateurId ? (fiches.get(c.formateurId) ?? null) : null,
    nbCampus: campus.get(c.id)?.length ?? 0,
    url: urlCampus(`/cours-ouverts/${c.slug}`),
  }));

  return { cours: cartesCours, formateurs: [...fiches.values()] };
}

function versVitrineFormateur(f: LigneFormateur, listeCours: VitrineFormateur["cours"]): VitrineFormateur {
  const slug = slugFormateur(f);
  return {
    slug,
    prenom: f.prenom,
    nom: f.nom,
    titre: f.titre,
    localisation: f.localisation,
    bio: f.bio,
    photoUrl: imagePublique(f.photoUrl),
    annonceLe: f.annonceLe?.toISOString() ?? null,
    cours: listeCours,
    url: urlCampus(`/formateurs/${slug}`),
  };
}

/** Lives publics (tous, ou ceux de certains cours), le direct en premier. */
async function livesPublics(maintenant: Date, coursIds?: number[]): Promise<VitrineLive[]> {
  if (coursIds && !coursIds.length) return [];
  const lignes = await db
    .select({
      id: seances.id,
      titre: seances.titre,
      debut: seances.debut,
      dureeMinutes: seances.dureeMinutes,
      statut: seances.statut,
      coursCode: cours.code,
      coursTitre: cours.titre,
      coursSlug: cours.slug,
      coursAnnonce: cours.publierSurSite,
      fPrenom: utilisateurs.prenom,
      fNom: utilisateurs.nom,
      fLocalisation: utilisateurs.localisation,
      fConsentement: utilisateurs.consentementSite,
    })
    .from(seances)
    .innerJoin(cours, eq(cours.id, seances.coursId))
    .leftJoin(utilisateurs, eq(utilisateurs.id, cours.formateurId))
    .where(coursIds ? and(filtreLivesPublics(maintenant), inArray(seances.coursId, coursIds)) : filtreLivesPublics(maintenant))
    .orderBy(sql`case when ${seances.statut} = 'en_direct' then 0 else 1 end`, asc(seances.debut))
    .limit(30);
  return lignes.map((l) => ({
    id: l.id,
    titre: l.titre,
    coursCode: l.coursCode,
    coursTitre: l.coursTitre,
    debut: l.debut.toISOString(),
    dureeMinutes: l.dureeMinutes,
    enDirect: l.statut === "en_direct",
    // Le nom du formateur n'est cité qu'avec son consentement.
    formateur: l.fPrenom && l.fConsentement ? { prenom: l.fPrenom, nom: l.fNom!, localisation: l.fLocalisation } : null,
    // Un cours annoncé a sa fiche publique ; sinon, le lien mène au live (connexion demandée).
    url: urlCampus(l.coursAnnonce ? `/cours-ouverts/${l.coursSlug}` : `/live/${l.id}`),
  }));
}

async function annoncesPubliques(maintenant: Date): Promise<VitrineAnnonce[]> {
  const lignes = await db
    .select({ id: annonces.id, titre: annonces.titre, corps: annonces.corps, publieeLe: annonces.publieeLe })
    .from(annonces)
    .where(and(eq(annonces.publierSurSite, true), or(isNull(annonces.expireLe), gte(annonces.expireLe, maintenant))))
    .orderBy(desc(annonces.publieeLe))
    .limit(10);
  return lignes.map((a) => ({ ...a, publieeLe: a.publieeLe.toISOString() }));
}

/** Chiffres agrégés : jamais un nom, seulement des totaux. */
async function chiffres(): Promise<Vitrine["chiffres"]> {
  const [r] = await db
    .execute<{ etudiants: number; formateurs: number; cours: number; heures: number }>(
      sql`
    select
      (select count(*)::int from ${utilisateurs} where ${utilisateurs.role} = 'etudiant' and ${utilisateurs.actif}) as etudiants,
      (select count(*)::int from ${utilisateurs} where ${utilisateurs.role} = 'formateur' and ${utilisateurs.actif}) as formateurs,
      (select count(*)::int from ${cours} where ${cours.statut} = 'publie') as cours,
      (select coalesce(floor(sum(
         coalesce(extract(epoch from (${seances.termineeLe} - ${seances.demarreeLe})) / 3600.0, ${seances.dureeMinutes} / 60.0)
       )), 0)::int from ${seances} where ${seances.statut} = 'terminee') as heures
  `,
    )
    .then((res) => res.rows);
  return { etudiants: r.etudiants, formateurs: r.formateurs, cours: r.cours, heuresDeDirect: r.heures };
}

async function sitesCampus() {
  return db.select().from(sites).orderBy(asc(sites.ordre));
}

// ── Vitrine (avec cache mémoire) ───────────────────────────────────────────

let cache: { valeur: Vitrine; expire: number } | null = null;
let enCours: Promise<Vitrine> | null = null;

async function construireVitrine(): Promise<Vitrine> {
  const maintenant = new Date();
  const [catalogue, lives, listeAnnonces, totaux, listeSites] = await Promise.all([
    construireCatalogue(maintenant),
    livesPublics(maintenant),
    annoncesPubliques(maintenant),
    chiffres(),
    sitesCampus(),
  ]);
  return {
    campus: {
      nom: NOM_CAMPUS,
      url: config.urlCampus,
      sites: listeSites.map((s) => ({ nom: s.nom, salle: s.salleConference })),
    },
    cours: catalogue.cours,
    formateurs: catalogue.formateurs,
    lives: lives.slice(0, 20),
    annonces: listeAnnonces,
    chiffres: totaux,
    genereLe: maintenant.toISOString(),
  };
}

/** Vitrine en cache 60 s ; les appels simultanés partagent le même calcul. */
export async function lireVitrine(): Promise<Vitrine> {
  if (cache && cache.expire > Date.now()) return cache.valeur;
  if (!enCours) {
    enCours = construireVitrine()
      .then((valeur) => {
        cache = { valeur, expire: Date.now() + DUREE_CACHE_MS };
        return valeur;
      })
      .finally(() => {
        enCours = null;
      });
  }
  return enCours;
}

/** Oublie la vitrine en cache (après une publication, si un module le souhaite). */
export function oublierVitrine() {
  cache = null;
}
// Toute publication qui change (cours, formateur, live, annonce) passe par prevenirSite().
surChangementPublication(oublierVitrine);

// ── Fiches ─────────────────────────────────────────────────────────────────

/** Cours dont la fiche publique existe : annoncé et non archivé (même au-delà de la fenêtre de la vitrine). */
async function coursAnnonceParSlug(slug: string): Promise<Cours | undefined> {
  const [c] = await db
    .select()
    .from(cours)
    .where(and(eq(cours.slug, slug), eq(cours.publierSurSite, true), ne(cours.statut, "archive")))
    .limit(1);
  return c;
}

/** Formateur annoncé par son slug (colonne slug, ou repli « prenom-nom-<id> »). */
async function formateurAnnonceParSlug(slug: string): Promise<LigneFormateur | undefined> {
  const [parSlug] = await db
    .select(colonnesFormateur)
    .from(utilisateurs)
    .where(and(filtreFormateurPublic, eq(utilisateurs.slug, slug)))
    .limit(1);
  if (parSlug) return parSlug;
  const m = slug.match(/-(\d+)$/);
  if (!m) return undefined;
  const [parId] = await db
    .select(colonnesFormateur)
    .from(utilisateurs)
    .where(and(filtreFormateurPublic, eq(utilisateurs.id, Number(m[1]))))
    .limit(1);
  return parId && slugFormateur(parId) === slug ? parId : undefined;
}

/** Fiche d'un formateur annoncé telle que la vitrine la publie (avec ses cours annoncés). */
async function ficheVitrineDe(f: LigneFormateur): Promise<VitrineFormateur> {
  const vitrine = await lireVitrine();
  return vitrine.formateurs.find((x) => x.slug === slugFormateur(f)) ?? versVitrineFormateur(f, []);
}

async function ficheCours(slug: string): Promise<FicheCoursPublique | null> {
  const c = await coursAnnonceParSlug(slug);
  if (!c) return null;
  const maintenant = new Date();
  const [campus, chapitres, lives, formateur] = await Promise.all([
    campusParCours([c.id]),
    db
      .select({
        titre: modules.titre,
        lecons: sql<number>`(count(${lecons.id}) filter (where ${lecons.publiee}))::int`,
      })
      .from(modules)
      .leftJoin(lecons, eq(lecons.moduleId, modules.id))
      .where(eq(modules.coursId, c.id))
      .groupBy(modules.id, modules.titre, modules.ordre)
      .orderBy(asc(modules.ordre), asc(modules.id)),
    livesPublics(maintenant, [c.id]),
    c.formateurId
      ? db
          .select(colonnesFormateur)
          .from(utilisateurs)
          .where(and(filtreFormateurPublic, eq(utilisateurs.id, c.formateurId)))
          .limit(1)
      : Promise.resolve([] as LigneFormateur[]),
  ]);
  const listeCampus = campus.get(c.id) ?? [];
  return {
    coursId: c.id,
    code: c.code,
    slug: c.slug,
    titre: c.titre,
    accroche: accrocheDe(c),
    imageUrl: imagePublique(c.imageUrl),
    couleur: c.couleur,
    dateDebut: c.dateDebut?.toISOString() ?? null,
    dateFin: c.dateFin?.toISOString() ?? null,
    formateur: formateur[0] ? await ficheVitrineDe(formateur[0]) : null,
    nbCampus: listeCampus.length,
    url: urlCampus(`/cours-ouverts/${c.slug}`),
    description: c.description,
    objectifs: c.objectifs
      .split("\n")
      .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
      .filter(Boolean),
    programme: chapitres,
    campus: listeCampus,
    lives,
  };
}

async function ficheFormateur(slug: string): Promise<FicheFormateurPublique | null> {
  const f = await formateurAnnonceParSlug(slug);
  if (!f) return null;
  const [fiche, vitrine, siens] = await Promise.all([
    ficheVitrineDe(f),
    lireVitrine(),
    // Tous ses cours (principal ou co-formateur) : ses lives publics peuvent concerner un cours non annoncé.
    db
      .select({ id: cours.id })
      .from(cours)
      .where(
        or(
          eq(cours.formateurId, f.id),
          inArray(cours.id, db.select({ id: coursFormateurs.coursId }).from(coursFormateurs).where(eq(coursFormateurs.formateurId, f.id))),
        ),
      ),
  ]);
  const slugs = new Set(fiche.cours.map((c) => c.slug));
  return {
    ...fiche,
    coursDetail: vitrine.cours.filter((c) => slugs.has(c.slug)),
    lives: await livesPublics(
      new Date(),
      siens.map((c) => c.id),
    ),
  };
}

// ── Lecture d'une image publique ───────────────────────────────────────────

/**
 * Une image déposée n'est publique que si elle est l'image d'un cours annoncé
 * (non archivé) ou la photo d'un formateur annoncé ET consentant.
 */
async function imagePubliee(id: number): Promise<boolean> {
  const motif = `/api/fichiers/${id}%`;
  const [coursLies, formateursLies] = await Promise.all([
    db
      .select({ url: cours.imageUrl })
      .from(cours)
      .where(and(eq(cours.publierSurSite, true), ne(cours.statut, "archive"), sql`${cours.imageUrl} like ${motif}`)),
    db
      .select({ url: utilisateurs.photoUrl })
      .from(utilisateurs)
      .where(and(filtreFormateurPublic, sql`${utilisateurs.photoUrl} like ${motif}`)),
  ]);
  // « like » laisse passer /api/fichiers/120 pour 12 : on revérifie l'identifiant exact.
  return [...coursLies, ...formateursLies].some((l) => idFichierInterne(l.url) === id);
}

async function envoyerImage(res: Response, id: number) {
  if (!(await imagePubliee(id))) throw introuvable("Image");
  const [f] = await db.select().from(fichiers).where(eq(fichiers.id, id));
  if (!f || !f.mime.startsWith("image/") || f.mime === "image/svg+xml") throw introuvable("Image");
  const chemin = path.resolve(config.dossierFichiers, f.cle);
  if (!chemin.startsWith(config.dossierFichiers) || !fs.existsSync(chemin)) throw introuvable("Image");
  res.setHeader("Content-Type", f.mime);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  fs.createReadStream(chemin)
    .on("error", () => res.destroy())
    .pipe(res);
}

// ── CORS : le site www.2iae.com lit la vitrine depuis le navigateur ────────

const originesAutorisees = new Set([...config.originesSite, new URL(config.urlCampus).origin]);

function origineAutorisee(origine: string): boolean {
  if (originesAutorisees.has(origine)) return true;
  // En développement, le site tourne souvent sur un autre port de la machine.
  return !estProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine);
}

function cors(req: Request, res: Response, next: NextFunction) {
  const origine = req.headers.origin;
  res.vary("Origin");
  if (origine && origineAutorisee(origine)) {
    res.setHeader("Access-Control-Allow-Origin", origine);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
}

// ── Balises des pages publiques (aperçus WhatsApp, moteurs de recherche) ───

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type ImagePartage = { url: string; alt: string; largeur?: number; hauteur?: number };

/** Image de partage par défaut (PNG 1200 × 630 : WhatsApp et Facebook ignorent le SVG). */
const IMAGE_CAMPUS = (): ImagePartage => ({
  url: urlCampus("/og-campus.png"),
  alt: "Campus numérique 2IAE : un cours, cinq campus, en direct.",
  largeur: 1200,
  hauteur: 630,
});

/**
 * Image propre à un cours ou à un formateur pour l'aperçu, si c'est une vraie
 * photo PNG ou JPEG (jamais un SVG) ; sinon l'image du campus.
 */
async function imagePartage(url: string | null, alt: string): Promise<ImagePartage> {
  if (!url) return IMAGE_CAMPUS();
  if (/^https?:\/\/.+\.(png|jpe?g)(\?.*)?$/i.test(url)) return { url, alt };
  const id = idFichierInterne(url);
  if (id) {
    const [f] = await db.select({ mime: fichiers.mime }).from(fichiers).where(eq(fichiers.id, id));
    if (f && /^image\/(png|jpeg)$/.test(f.mime)) return { url: urlCampus(routeImage(id)), alt };
  }
  return IMAGE_CAMPUS();
}

function balises(p: { titre: string; description: string; chemin: string; type?: "website" | "profile" | "article"; image?: ImagePartage }): string {
  const url = urlCampus(p.chemin);
  const image = p.image ?? IMAGE_CAMPUS();
  const t = echapper(p.titre);
  const d = echapper(p.description.length > 200 ? `${p.description.slice(0, 197)}…` : p.description);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${echapper(url)}" />`,
    `<meta property="og:type" content="${p.type ?? "website"}" />`,
    `<meta property="og:site_name" content="${NOM_CAMPUS}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${echapper(url)}" />`,
    `<meta property="og:image" content="${echapper(image.url)}" />`,
    ...(image.largeur && image.hauteur
      ? [`<meta property="og:image:width" content="${image.largeur}" />`, `<meta property="og:image:height" content="${image.hauteur}" />`]
      : []),
    `<meta property="og:image:alt" content="${echapper(image.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${echapper(image.url)}" />`,
  ].join("\n    ");
}

const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });

async function metaPage(url: string): Promise<string | null> {
  const chemin = decodeURIComponent(url.split(/[?#]/)[0]).replace(/\/+$/, "") || "/";
  if (chemin === "/") {
    return balises({
      titre: `${NOM_CAMPUS} · Un cours. Cinq campus. En direct.`,
      description:
        "Les étudiants de Riviera Palmeraie, Yopougon, Yamoussoukro, Azaguié et M'Batto suivent les mêmes formateurs en direct, depuis leur téléphone, leur ordinateur ou la salle de conférence de leur campus.",
      chemin: "/",
    });
  }
  const mCours = chemin.match(/^\/cours-ouverts\/([^/]+)$/);
  if (mCours) {
    const c = await coursAnnonceParSlug(mCours[1]);
    if (!c) return null;
    const campus = (await campusParCours([c.id])).get(c.id)?.length ?? 0;
    const quand = c.dateDebut && c.dateDebut.getTime() > Date.now() ? ` Dès le ${fmtDate.format(c.dateDebut)}.` : "";
    const ou = campus > 1 ? ` En direct dans ${campus} campus 2IAE.` : " En direct au campus numérique 2IAE.";
    return balises({
      titre: `${c.titre} · ${NOM_CAMPUS}`,
      description: `${accrocheDe(c)}${quand}${ou}`,
      chemin: `/cours-ouverts/${c.slug}`,
      type: "article",
      image: await imagePartage(c.imageUrl, c.titre),
    });
  }
  const mFormateur = chemin.match(/^\/formateurs\/([^/]+)$/);
  if (mFormateur) {
    const f = await formateurAnnonceParSlug(mFormateur[1]);
    if (!f) return null;
    const qui = [f.titre, f.localisation ? `depuis ${f.localisation}` : null].filter(Boolean).join(", ");
    const bio = f.bio?.trim() || `Formateur du campus numérique 2IAE${f.localisation ? `, en direct depuis ${f.localisation}` : ""}.`;
    return balises({
      titre: `${f.prenom} ${f.nom}${qui ? ` · ${qui}` : ""}`,
      description: bio,
      chemin: `/formateurs/${slugFormateur(f)}`,
      type: "profile",
      image: await imagePartage(f.photoUrl, `${f.prenom} ${f.nom}`),
    });
  }
  return null;
}

// ── Routes ─────────────────────────────────────────────────────────────────

export function enregistrerPublic(app: Express) {
  app.use("/api/public", cors);
  enregistrerMetaPage(metaPage);

  app.get(
    "/api/public/vitrine",
    route(async (_req, res) => {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(await lireVitrine());
    }),
  );

  app.get(
    "/api/public/sites",
    route(async (_req, res) => {
      const [liste, comptes] = await Promise.all([
        sitesCampus(),
        db
          .select({ siteId: utilisateurs.siteId, n: sql<number>`count(*)::int` })
          .from(utilisateurs)
          .where(and(eq(utilisateurs.role, "etudiant"), eq(utilisateurs.actif, true)))
          .groupBy(utilisateurs.siteId),
      ]);
      const parSite = new Map(comptes.map((c) => [c.siteId, c.n]));
      const reponse: SitePublic[] = liste.map((s) => ({
        slug: s.slug,
        nom: s.nom,
        nomCourt: s.nomCourt,
        ville: s.ville,
        salle: s.salleConference,
        etudiants: parSite.get(s.id) ?? 0,
      }));
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(reponse);
    }),
  );

  app.get(
    "/api/public/cours/:slug",
    route(async (req, res) => {
      const fiche = await ficheCours(String(req.params.slug));
      if (!fiche) throw introuvable("Cours");
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(fiche);
    }),
  );

  app.get(
    "/api/public/formateurs/:slug",
    route(async (req, res) => {
      const fiche = await ficheFormateur(String(req.params.slug));
      if (!fiche) throw introuvable("Formateur");
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(fiche);
    }),
  );

  // Image d'un cours annoncé ou photo d'un formateur annoncé (le site et WhatsApp l'affichent sans compte).
  app.get(
    "/api/public/images/:fichierId",
    route(async (req, res) => {
      await envoyerImage(res, idParam(req, "fichierId"));
    }),
  );
}
