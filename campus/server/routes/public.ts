// Vitrine publique : ce que le campus montre au monde, sans compte.
//
//   GET /api/public/vitrine            → Vitrine (lue par le site www.2iae.com)
//   GET /api/public/cours/:slug        → fiche d'un cours annoncé
//   GET /api/public/formateurs/:slug   → fiche d'un formateur annoncé
//   GET /api/public/sites              → les cinq campus et leur salle
//   GET /api/public/site               → contenus du site public (accueil, à propos, questions,
//                                        contacts, confidentialité, campus), fusionnés avec les
//                                        valeurs par défaut tirées des faits réels
//   GET /api/public/campus/:slug       → un campus, ses cours annoncés, ses prochains lives
//   GET /api/public/en-direct          → le cours public en direct (indicateur de l'en-tête)
//   GET /api/public/images/:fichierId  → image d'un cours annoncé, photo d'un formateur annoncé
//                                        ou photo d'un campus (les fichiers déposés sont sinon
//                                        réservés aux comptes)
//   GET /sitemap.xml, GET /robots.txt  → pour les moteurs de recherche
//
// Back-office « Site public » (/pilotage/site) :
//   GET    /api/pilotage/site/contenus          → ContenusPilotage (direction et vie scolaire)
//   PUT    /api/pilotage/site/contenus/:cle     → enregistre un bloc (direction)
//   DELETE /api/pilotage/site/contenus/:cle     → rétablit le texte d'origine (direction)
//   PUT    /api/pilotage/site/campus/:slug      → adresse, photo, salle, WhatsApp… d'un campus (direction)
//   DELETE /api/pilotage/site/campus/:slug      → rétablit les informations d'origine d'un campus (direction)
//
// Tout est piloté par les cases « Annoncer sur 2iae.com » (publierSurSite)
// validées par la direction. Jamais une donnée nominative d'étudiant : la
// vitrine ne publie que des agrégats. Un formateur n'est nommé qu'avec son
// consentement (consentementSite), et sa fiche n'existe que s'il est annoncé.
//
// Chaque page publique du campus reçoit ses balises (titre, description, Open
// Graph) côté serveur : un lien partagé sur WhatsApp affiche une vraie carte
// d'aperçu, et les moteurs de recherche lisent un titre propre à la page.
import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import path from "path";
import fs from "fs";
import { z, type ZodTypeAny } from "zod";
import { and, asc, desc, eq, gte, inArray, isNull, like, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { config, estProduction } from "../config";
import { route, introuvable, idParam, invalide, valider } from "../http";
import { exigerRole, moi, normaliserTelephone } from "../auth";
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
  journal,
  contenusSite,
  CLES_CONTENUS,
  FILIERES_BTS,
  SALLES_INVENTEES,
  SALLE_PAR_DEFAUT,
  THEMES_QUESTIONS,
  type Cours,
  type Site,
  type Utilisateur,
  type SitePublic,
  type CampusCours,
  type CampusPublic,
  type CampusDetailPublic,
  type CampusPilotage,
  type CleContenu,
  type ContenuCampus,
  type ContenuContacts,
  type ContenusPilotage,
  type ContenusSite,
  type EnDirectPublic,
  type FicheCoursPublique,
  type FicheFormateurPublique,
  type SitePublicDto,
} from "@shared/schema";
import type { Vitrine, VitrineCours, VitrineFormateur, VitrineLive, VitrineAnnonce } from "@shared/api";
import { CAMPUS_PAR_DEFAUT, CAMPUS_VIERGE, CONTENUS_PAR_DEFAUT } from "@shared/vitrine-contenus";

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
    liste.push({ slug: l.slug, nomCourt: l.nomCourt, salle: salleAffichee(l.salle) });
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

// ── Contenus du site public (éditables depuis le back-office) ──────────────

/** Nom de salle affiché : un nom inventé pour la démonstration (ou vide) devient « Salle de conférence ». */
export function salleAffichee(nom: string | null | undefined): string {
  const n = nom?.trim();
  return n && !SALLES_INVENTEES.includes(n) ? n : SALLE_PAR_DEFAUT;
}
const salleNommee = (nom: string | null | undefined) => salleAffichee(nom) !== SALLE_PAR_DEFAUT;

/** Numéro pour wa.me : un numéro ivoirien (10 chiffres) reçoit l'indicatif 225. */
function numeroWa(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const n = normaliserTelephone(tel);
  if (n.length === 10) return `225${n}`;
  if (n.length >= 11 && n.length <= 15) return n;
  return null;
}

/** Itinéraire Google Maps construit depuis l'adresse publiée (ou le lien choisi par la direction). */
function itineraire(c: Pick<ContenuCampus, "adresse" | "localite" | "lienCarte">, nomCampus: string): string {
  if (c.lienCarte) return c.lienCarte;
  const destination = ["2IAE", c.adresse || nomCampus, c.localite, "Côte d'Ivoire"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

// Schémas de validation : un champ enregistré qui ne passe plus (ancien format)
// est simplement ignoré au profit de la valeur par défaut.
const texte = (max: number) => z.string().trim().max(max, `${max} caractères au maximum`);
const texteRequis = (max: number) => texte(max).min(1, "à remplir");
const telephone = z
  .string()
  .trim()
  .max(30)
  .regex(/^\+?[\d\s.()-]{8,30}$/, "numéro illisible (ex. +225 07 47 72 67 29)");
const adresseWeb = z
  .string()
  .trim()
  .max(500)
  .regex(/^https:\/\/[^\s]+$/, "adresse web complète attendue (https://…)");
const CODES_FILIERES = FILIERES_BTS.map((f) => f.code) as [string, ...string[]];

const SCHEMAS: { [K in CleContenu]: z.ZodObject<Record<string, ZodTypeAny>> } = {
  accueil: z.object({ etiquette: texte(120), titre: texteRequis(160), sousTitre: texte(400) }),
  apropos: z.object({
    chapeau: texte(400),
    groupe: texte(4000),
    campusNumerique: texte(4000),
    chiffres: z.array(z.object({ valeur: texteRequis(20), libelle: texteRequis(120) })).max(6, "6 chiffres au maximum"),
  }),
  questions: z.object({
    liste: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]{1,60}$/),
          theme: z.enum(THEMES_QUESTIONS),
          question: texteRequis(200),
          reponse: texteRequis(1500),
          visible: z.boolean(),
        }),
      )
      .max(40, "40 questions au maximum")
      .refine((l) => new Set(l.map((q) => q.id)).size === l.length, "deux questions portent le même identifiant"),
  }),
  contacts: z.object({
    telephones: z.array(telephone).max(4, "4 numéros au maximum"),
    whatsapp: telephone.or(z.literal("")),
    email: z.string().trim().max(120).email("adresse e-mail invalide").or(z.literal("")),
    facebook: adresseWeb.or(z.literal("")),
    siteWeb: adresseWeb,
    preinscription: adresseWeb,
    bureauCanada: texte(200),
    rc: texte(80),
    agrement: texte(80),
  }),
  confidentialite: z.object({
    responsable: texteRequis(160),
    contact: texteRequis(160),
    conservation: texteRequis(3000),
    miseAJour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date attendue (AAAA-MM-JJ)"),
  }),
};

const schemaCampus = z.object({
  adresse: texte(300),
  localite: texte(120),
  telephone: telephone.or(z.literal("")),
  photoUrl: z.string().trim().max(300).nullable(),
  lienCarte: adresseWeb.or(z.literal("")),
  filieres: z.array(z.enum(CODES_FILIERES)).max(12),
  resultat: z.object({ libelle: texteRequis(40), taux: z.number().min(0).max(100) }).nullable(),
  presentation: texte(1500),
});

/** Valeur par défaut, remplacée champ par champ par ce qui est enregistré (et encore valide). */
function fusionner<T extends Record<string, unknown>>(schema: z.ZodObject<Record<string, ZodTypeAny>>, defaut: T, stocke: unknown): T {
  if (!stocke || typeof stocke !== "object") return defaut;
  const resultat: Record<string, unknown> = { ...defaut };
  for (const [champ, sousSchema] of Object.entries(schema.shape)) {
    if (!(champ in (stocke as Record<string, unknown>))) continue;
    const r = sousSchema.safeParse((stocke as Record<string, unknown>)[champ]);
    if (r.success) resultat[champ] = r.data;
  }
  return resultat as T;
}

const defautCampus = (slug: string): ContenuCampus => CAMPUS_PAR_DEFAUT[slug] ?? CAMPUS_VIERGE;

type LigneContenu = typeof contenusSite.$inferSelect;
type EtatContenus = { contenus: ContenusSite; campus: Map<string, ContenuCampus>; lignes: Map<string, LigneContenu> };

let cacheContenus: EtatContenus | null = null;

/** Tous les contenus, fusionnés avec les valeurs par défaut (en mémoire jusqu'à la prochaine modification). */
async function lireContenus(): Promise<EtatContenus> {
  if (cacheContenus) return cacheContenus;
  const lignes = await db.select().from(contenusSite);
  const parCle = new Map(lignes.map((l) => [l.cle, l]));
  const contenus = {} as Record<CleContenu, unknown>;
  for (const cle of CLES_CONTENUS) contenus[cle] = fusionner(SCHEMAS[cle], CONTENUS_PAR_DEFAUT[cle], parCle.get(cle)?.valeur);
  const campus = new Map<string, ContenuCampus>();
  for (const l of lignes) {
    if (l.cle.startsWith("campus.")) {
      const slug = l.cle.slice("campus.".length);
      campus.set(slug, fusionner(schemaCampus, defautCampus(slug), l.valeur));
    }
  }
  cacheContenus = { contenus: contenus as ContenusSite, campus, lignes: parCle };
  return cacheContenus;
}

let cacheSite: { valeur: SitePublicDto; expire: number } | null = null;

/** Oublie les contenus et le site public en cache : la modification se voit aussitôt. */
function oublierContenus() {
  cacheContenus = null;
  cacheSite = null;
}
// Un cours ou un live publié change le nombre de campus, les salles…
surChangementPublication(() => {
  cacheSite = null;
});

function versCampusPublic(s: Site, contenu: ContenuCampus, etudiants: number, contacts: ContenuContacts): CampusPublic {
  const waGroupe = numeroWa(contacts.whatsapp);
  // Le numéro du groupe recopié sur un campus n'est pas « la vie scolaire du campus ».
  const waCampus = numeroWa(s.whatsappVieScolaire);
  const propre = Boolean(waCampus && waCampus !== waGroupe);
  return {
    id: s.id,
    slug: s.slug,
    nom: s.nom,
    nomCourt: s.nomCourt,
    ville: s.ville,
    salle: salleAffichee(s.salleConference),
    salleNommee: salleNommee(s.salleConference),
    whatsapp: waCampus ?? waGroupe ?? "",
    whatsappCampus: propre,
    adresse: contenu.adresse,
    localite: contenu.localite,
    telephone: contenu.telephone || null,
    // Les photos livrées avec le campus restent relatives ; une photo téléversée passe par la route publique des images.
    photoUrl: contenu.photoUrl?.startsWith("/images/") ? contenu.photoUrl : imagePublique(contenu.photoUrl),
    itineraire: itineraire(contenu, s.nom),
    filieres: contenu.filieres.map((code) => FILIERES_BTS.find((f) => f.code === code)).filter((f): f is (typeof FILIERES_BTS)[number] => Boolean(f)),
    resultat: contenu.resultat,
    presentation: contenu.presentation,
    etudiants,
  };
}

async function effectifsParSite(): Promise<Map<number | null, number>> {
  const comptes = await db
    .select({ siteId: utilisateurs.siteId, n: sql<number>`count(*)::int` })
    .from(utilisateurs)
    .where(and(eq(utilisateurs.role, "etudiant"), eq(utilisateurs.actif, true)))
    .groupBy(utilisateurs.siteId);
  return new Map(comptes.map((c) => [c.siteId, c.n]));
}

async function construireSite(): Promise<SitePublicDto> {
  const [{ contenus, campus, lignes }, listeSites, effectifs] = await Promise.all([lireContenus(), sitesCampus(), effectifsParSite()]);
  const dates = [...lignes.values()].map((l) => l.majLe.getTime());
  return {
    accueil: contenus.accueil,
    apropos: contenus.apropos,
    questions: contenus.questions.liste.filter((q) => q.visible),
    contacts: contenus.contacts,
    confidentialite: contenus.confidentialite,
    campus: listeSites.map((s) => versCampusPublic(s, campus.get(s.slug) ?? defautCampus(s.slug), effectifs.get(s.id) ?? 0, contenus.contacts)),
    majLe: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
  };
}

/** Site public en cache 60 s (vidé à chaque modification du back-office). */
export async function lireSitePublic(): Promise<SitePublicDto> {
  if (cacheSite && cacheSite.expire > Date.now()) return cacheSite.valeur;
  const valeur = await construireSite();
  cacheSite = { valeur, expire: Date.now() + 60_000 };
  return valeur;
}

/** Un campus, ses cours annoncés (suivis par une de ses classes) et les prochains lives publics de ses cours. */
async function detailCampus(slug: string): Promise<CampusDetailPublic | null> {
  const site = (await lireSitePublic()).campus.find((c) => c.slug === slug);
  if (!site) return null;
  const [vitrine, lignes] = await Promise.all([
    lireVitrine(),
    db
      .selectDistinct({ slug: cours.slug, code: cours.code })
      .from(coursClasses)
      .innerJoin(classes, eq(classes.id, coursClasses.classeId))
      .innerJoin(sites, eq(sites.id, classes.siteId))
      .innerJoin(cours, eq(cours.id, coursClasses.coursId))
      .where(and(eq(sites.slug, slug), ne(cours.statut, "archive"))),
  ]);
  const slugs = new Set(lignes.map((l) => l.slug));
  const codes = new Set(lignes.map((l) => l.code));
  return {
    campus: site,
    cours: vitrine.cours.filter((c) => slugs.has(c.slug)),
    lives: vitrine.lives.filter((l) => codes.has(l.coursCode)).slice(0, 8),
  };
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
      sites: listeSites.map((s) => ({ nom: s.nom, salle: salleAffichee(s.salleConference) })),
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
  const [coursLies, formateursLies, campusLies] = await Promise.all([
    db
      .select({ url: cours.imageUrl })
      .from(cours)
      .where(and(eq(cours.publierSurSite, true), ne(cours.statut, "archive"), sql`${cours.imageUrl} like ${motif}`)),
    db
      .select({ url: utilisateurs.photoUrl })
      .from(utilisateurs)
      .where(and(filtreFormateurPublic, sql`${utilisateurs.photoUrl} like ${motif}`)),
    // Photo d'un campus choisie par la direction dans « Site public ».
    db
      .select({ url: sql<string | null>`${contenusSite.valeur}->>'photoUrl'` })
      .from(contenusSite)
      .where(and(like(contenusSite.cle, "campus.%"), sql`${contenusSite.valeur}->>'photoUrl' like ${motif}`)),
  ]);
  // « like » laisse passer /api/fichiers/120 pour 12 : on revérifie l'identifiant exact.
  return [...coursLies, ...formateursLies, ...campusLies].some((l) => idFichierInterne(l.url) === id);
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

/** Chemin propre d'une URL (« /campus/yopougon/?x » → « /campus/yopougon »). */
const cheminDe = (url: string) => {
  try {
    return decodeURIComponent(url.split(/[?#]/)[0]).replace(/\/+$/, "") || "/";
  } catch {
    return url.split(/[?#]/)[0] || "/";
  }
};

const fmtTaux = (t: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(t)} %`;

/** Données structurées de l'établissement (moteurs de recherche), sur l'accueil. */
async function donneesStructurees(): Promise<string> {
  const { contenus } = await lireContenus();
  const c = contenus.contacts;
  const json = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Groupe Écoles 2IAE International",
    alternateName: "Institut International des Affaires en Entrepreneuriat",
    slogan: "2IAE, entreprendre pour devenir l'élite de demain.",
    foundingDate: "2006",
    url: c.siteWeb,
    logo: urlCampus("/logo-2iae-hd.png"),
    email: c.email || undefined,
    telephone: c.telephones[0] || undefined,
    sameAs: [c.facebook, c.siteWeb].filter(Boolean),
  };
  return `<script type="application/ld+json">${JSON.stringify(json).replace(/</g, "\\u003c")}</script>`;
}

/** Pages dont le contenu dépend d'un enregistrement (cours, formateur, campus). */
async function metaPage(url: string): Promise<string | null> {
  const chemin = cheminDe(url);
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
  const mCampus = chemin.match(/^\/campus\/([^/]+)$/);
  if (mCampus) {
    const c = (await lireSitePublic()).campus.find((x) => x.slug === mCampus[1]);
    if (!c) return null;
    const morceaux = [
      [c.adresse, c.localite].filter(Boolean).join(", "),
      c.resultat ? `${fmtTaux(c.resultat.taux)} d'admis au ${c.resultat.libelle}` : null,
      c.filieres.length ? `Filières : ${c.filieres.map((f) => f.code).join(", ")}` : null,
      "Les cours en direct du campus numérique, dans sa salle de conférence.",
    ].filter(Boolean);
    const photo = c.photoUrl && /\.(jpe?g|png)$/i.test(c.photoUrl) ? { url: c.photoUrl.startsWith("/") ? urlCampus(c.photoUrl) : c.photoUrl, alt: `Campus 2IAE ${c.nomCourt}` } : undefined;
    return balises({ titre: `Campus 2IAE ${c.nom}`, description: `${morceaux.join(". ")}`.replace(/\.\./g, "."), chemin: `/campus/${c.slug}`, image: photo });
  }
  return null;
}

/** Pages fixes du site public (consultées en repli : un module peut préciser les siennes). */
async function metaPagesFixes(url: string): Promise<string | null> {
  const chemin = cheminDe(url);
  if (chemin === "/") {
    const { contenus } = await lireContenus();
    const titre = contenus.accueil.titre.split("\n").map((l) => l.trim()).filter(Boolean).join(" ");
    return `${balises({ titre: `${NOM_CAMPUS} · ${titre}`, description: contenus.accueil.sousTitre, chemin: "/" })}\n    ${await donneesStructurees()}`;
  }
  const fixes: Record<string, { titre: string; description: string | (() => Promise<string>) }> = {
    "/programme": {
      titre: `Emploi du temps · ${NOM_CAMPUS}`,
      description: "L'emploi du temps officiel des cours en direct du Groupe 2IAE : jours, heures, cours et intervenants, à l'heure d'Abidjan.",
    },
    "/cours-ouverts": {
      titre: `Les cours en direct · ${NOM_CAMPUS}`,
      description: "Les cours du campus numérique 2IAE, suivis en direct dans les cinq campus et sur téléphone : programme, formateur et prochaines séances.",
    },
    "/formateurs": {
      titre: `Les formateurs · ${NOM_CAMPUS}`,
      description: "Ils enseignent en direct aux cinq campus du Groupe 2IAE, où qu'ils soient dans le monde.",
    },
    "/campus": {
      titre: "Les cinq campus du Groupe 2IAE",
      description:
        "Abidjan Riviera Palmeraie, Abidjan Yopougon, Yamoussoukro, Azaguié et M'Batto : adresses, filières, résultats au BTS 2026, contacts et salle de conférence.",
    },
    "/le-direct": {
      titre: `Suivre un cours en direct · ${NOM_CAMPUS}`,
      description:
        "Dans la salle de conférence de son campus, au téléphone (son et diapos, environ 12 à 15 Mo par heure) ou à l'ordinateur : comment suivre les cours du campus numérique.",
    },
    "/questions": {
      titre: `Questions fréquentes · ${NOM_CAMPUS}`,
      description: "Première connexion, code oublié, forfait internet, téléphone partagé, relevé des parents : les réponses, et la vie scolaire sur WhatsApp.",
    },
    "/a-propos": {
      titre: "À propos · Groupe Écoles 2IAE International",
      description: async () => (await lireContenus()).contenus.apropos.chapeau,
    },
    "/contact": {
      titre: "Contact · Groupe Écoles 2IAE International",
      description: "Téléphones, WhatsApp, e-mail et adresses des cinq campus du Groupe 2IAE. Préinscription en ligne.",
    },
    "/confidentialite": {
      titre: `Confidentialité · ${NOM_CAMPUS}`,
      description: "Ce que le campus numérique collecte, pourquoi, qui y a accès, combien de temps, et vos droits (loi ivoirienne n° 2013-450).",
    },
  };
  const page = fixes[chemin];
  if (!page) return null;
  return balises({ titre: page.titre, description: typeof page.description === "string" ? page.description : await page.description(), chemin });
}

// ── Moteurs de recherche : sitemap.xml et robots.txt ───────────────────────

const PAGES_FIXES = ["/", "/programme", "/cours-ouverts", "/formateurs", "/campus", "/le-direct", "/questions", "/a-propos", "/contact", "/confidentialite"];

/** Pages de l'application réservées aux comptes (ou porteuses d'un jeton) : jamais indexées. */
const CHEMINS_PRIVES = [
  "/api/",
  "/accueil",
  "/enseigner",
  "/cours/",
  "/live/",
  "/direct",
  "/replays/",
  "/devoirs",
  "/quiz/",
  "/notes",
  "/corrections",
  "/messages",
  "/assistant",
  "/agenda",
  "/annonces",
  "/emploi-du-temps",
  "/profil",
  "/bienvenue",
  "/pilotage",
  "/salle",
  "/emargement/",
  "/releve/",
  "/activer/",
  "/reinitialiser/",
  "/mot-de-passe-oublie",
  "/hors-ligne",
  "/visio/",
];

async function sitemap(): Promise<string> {
  const [vitrine, site, coursAnnonces] = await Promise.all([
    lireVitrine(),
    lireSitePublic(),
    db
      .select({ slug: cours.slug, majLe: cours.majLe })
      .from(cours)
      .where(and(eq(cours.publierSurSite, true), ne(cours.statut, "archive"))),
  ]);
  const jour = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const entrees: { chemin: string; majLe?: string | null; priorite: string }[] = [
    ...PAGES_FIXES.map((chemin) => ({ chemin, priorite: chemin === "/" ? "1.0" : "0.8", majLe: chemin === "/" ? jour(site.majLe) : null })),
    ...coursAnnonces.map((c) => ({ chemin: `/cours-ouverts/${c.slug}`, majLe: jour(c.majLe), priorite: "0.7" })),
    ...vitrine.formateurs.map((f) => ({ chemin: `/formateurs/${f.slug}`, majLe: jour(f.annonceLe), priorite: "0.6" })),
    ...site.campus.map((c) => ({ chemin: `/campus/${c.slug}`, priorite: "0.7" })),
  ];
  const xml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entrees.map(
      (e) => `  <url><loc>${xml(urlCampus(e.chemin === "/" ? "/" : e.chemin))}</loc>${e.majLe ? `<lastmod>${e.majLe}</lastmod>` : ""}<priority>${e.priorite}</priority></url>`,
    ),
    "</urlset>",
    "",
  ].join("\n");
}

const robots = () =>
  ["User-agent: *", "Allow: /", ...CHEMINS_PRIVES.map((c) => `Disallow: ${c}`), "", `Sitemap: ${urlCampus("/sitemap.xml")}`, ""].join("\n");

// ── Back-office « Site public » ────────────────────────────────────────────

const EQUIPE = exigerRole("admin", "vie_scolaire");
/** Réservé à la direction. */
const DIRECTION: RequestHandler = (req, res, next) => {
  if (!req.utilisateur) return res.status(401).json({ message: "Connectez-vous pour continuer." });
  if (req.utilisateur.role !== "admin") return res.status(403).json({ message: "Réservé à la direction." });
  next();
};

async function journaliser(u: Pick<Utilisateur, "id">, action: string, details: Record<string, unknown>) {
  await db.insert(journal).values({ utilisateurId: u.id, action, details });
}

async function nomsAuteurs(ids: (number | null)[]): Promise<Map<number, string>> {
  const uniques = [...new Set(ids.filter((i): i is number => typeof i === "number"))];
  if (!uniques.length) return new Map();
  const lignes = await db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(inArray(utilisateurs.id, uniques));
  return new Map(lignes.map((l) => [l.id, `${l.prenom} ${l.nom}`]));
}

async function etatPilotage(u: Utilisateur): Promise<ContenusPilotage> {
  const [{ contenus, campus, lignes }, listeSites] = await Promise.all([lireContenus(), sitesCampus()]);
  const auteurs = await nomsAuteurs([...lignes.values()].map((l) => l.majParId));
  const modifications: ContenusPilotage["modifications"] = {};
  for (const cle of CLES_CONTENUS) {
    const l = lignes.get(cle);
    if (l) modifications[cle] = { le: l.majLe.toISOString(), par: l.majParId ? (auteurs.get(l.majParId) ?? null) : null };
  }
  const listeCampus: CampusPilotage[] = listeSites.map((s) => {
    const l = lignes.get(`campus.${s.slug}`);
    return {
      id: s.id,
      slug: s.slug,
      nom: s.nom,
      nomCourt: s.nomCourt,
      salleConference: s.salleConference,
      whatsappVieScolaire: s.whatsappVieScolaire,
      contenu: campus.get(s.slug) ?? defautCampus(s.slug),
      defaut: defautCampus(s.slug),
      majLe: l?.majLe.toISOString() ?? null,
      majPar: l?.majParId ? (auteurs.get(l.majParId) ?? null) : null,
    };
  });
  return { contenus, defauts: CONTENUS_PAR_DEFAUT, campus: listeCampus, modifications, peutModifier: u.role === "admin" };
}

const cleValide = (brut: string): CleContenu => {
  if (!(CLES_CONTENUS as readonly string[]).includes(brut)) throw introuvable("Bloc de contenu");
  return brut as CleContenu;
};

/**
 * Photo d'un campus : une image livrée avec le campus (/images/…), ou une photo
 * téléversée pour le site (usage « site », PNG, JPEG ou WebP). Jamais un autre
 * fichier déposé : une copie d'étudiant ne peut pas devenir publique par erreur.
 */
async function verifierPhoto(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (/^\/images\/[a-z0-9-]+\.(jpe?g|png|webp)$/i.test(url)) return url;
  const id = idFichierInterne(url);
  if (!id) throw invalide("photoUrl : photo inconnue.");
  const [f] = await db.select({ usage: fichiers.usage, mime: fichiers.mime }).from(fichiers).where(eq(fichiers.id, id));
  if (!f || f.usage !== "site" || !/^image\/(jpeg|png|webp)$/.test(f.mime)) throw invalide("photoUrl : cette photo n'a pas été téléversée pour le site.");
  return `/api/fichiers/${id}`;
}

/** Retire l'aperçu des cartes de 2iae.com et du site public : tout se voit aussitôt. */
function apresModification() {
  oublierContenus();
  oublierVitrine();
}

// ── Routes ─────────────────────────────────────────────────────────────────

export function enregistrerPublic(app: Express) {
  app.use("/api/public", cors);
  enregistrerMetaPage(metaPage);
  enregistrerMetaPage(metaPagesFixes, { repli: true });

  app.get(
    "/sitemap.xml",
    route(async (_req, res) => {
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.type("application/xml").send(await sitemap());
    }),
  );

  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.type("text/plain").send(robots());
  });

  app.get(
    "/api/public/vitrine",
    route(async (_req, res) => {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(await lireVitrine());
    }),
  );

  // Contenus du site public : « no-cache » + ETag, pour qu'une modification du back-office se voie aussitôt.
  app.get(
    "/api/public/site",
    route(async (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.json(await lireSitePublic());
    }),
  );

  app.get(
    "/api/public/campus/:slug",
    route(async (req, res) => {
      const detail = await detailCampus(String(req.params.slug));
      if (!detail) throw introuvable("Campus");
      res.setHeader("Cache-Control", "no-cache");
      res.json(detail);
    }),
  );

  app.get(
    "/api/public/en-direct",
    route(async (_req, res) => {
      const l = (await lireVitrine()).lives.find((x) => x.enDirect);
      const reponse: EnDirectPublic = { live: l ? { id: l.id, titre: l.titre, coursTitre: l.coursTitre, coursCode: l.coursCode } : null };
      res.setHeader("Cache-Control", "public, max-age=30");
      res.json(reponse);
    }),
  );

  app.get(
    "/api/public/sites",
    route(async (_req, res) => {
      const [liste, effectifs] = await Promise.all([sitesCampus(), effectifsParSite()]);
      const reponse: SitePublic[] = liste.map((s) => ({
        slug: s.slug,
        nom: s.nom,
        nomCourt: s.nomCourt,
        ville: s.ville,
        salle: salleAffichee(s.salleConference),
        etudiants: effectifs.get(s.id) ?? 0,
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

  // Image d'un cours annoncé, photo d'un formateur annoncé ou d'un campus (le site et WhatsApp l'affichent sans compte).
  app.get(
    "/api/public/images/:fichierId",
    route(async (req, res) => {
      await envoyerImage(res, idParam(req, "fichierId"));
    }),
  );

  // ── Back-office « Site public » ──────────────────────────────────────────

  app.get(
    "/api/pilotage/site/contenus",
    EQUIPE,
    route(async (req, res) => {
      res.json(await etatPilotage(moi(req)));
    }),
  );

  app.put(
    "/api/pilotage/site/contenus/:cle",
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const cle = cleValide(String(req.params.cle));
      const valeur = valider(SCHEMAS[cle], req.body) as Record<string, unknown>;
      await db
        .insert(contenusSite)
        .values({ cle, valeur, majParId: u.id })
        .onConflictDoUpdate({ target: contenusSite.cle, set: { valeur, majParId: u.id, majLe: new Date() } });
      apresModification();
      await journaliser(u, "site_public_modifie", { cle });
      res.json(await etatPilotage(u));
    }),
  );

  app.delete(
    "/api/pilotage/site/contenus/:cle",
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const cle = cleValide(String(req.params.cle));
      await db.delete(contenusSite).where(eq(contenusSite.cle, cle));
      apresModification();
      await journaliser(u, "site_public_retabli", { cle });
      res.json(await etatPilotage(u));
    }),
  );

  app.put(
    "/api/pilotage/site/campus/:slug",
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const [s] = await db.select().from(sites).where(eq(sites.slug, String(req.params.slug)));
      if (!s) throw introuvable("Campus");
      const d = valider(
        schemaCampus.extend({
          salleConference: texteRequis(80),
          whatsappVieScolaire: telephone.or(z.literal("")).nullable(),
        }),
        req.body,
      );
      const { salleConference, whatsappVieScolaire, ...contenu } = d;
      const wa = whatsappVieScolaire ? numeroWa(whatsappVieScolaire) : null;
      if (whatsappVieScolaire && !wa) throw invalide("whatsappVieScolaire : numéro illisible (10 chiffres, ex. 07 47 72 67 29).");
      const valeur = { ...contenu, photoUrl: await verifierPhoto(contenu.photoUrl) };
      await db.transaction(async (tx) => {
        await tx
          .update(sites)
          .set({ salleConference: salleConference.replace(/\s+/g, " "), whatsappVieScolaire: wa })
          .where(eq(sites.id, s.id));
        await tx
          .insert(contenusSite)
          .values({ cle: `campus.${s.slug}`, valeur, majParId: u.id })
          .onConflictDoUpdate({ target: contenusSite.cle, set: { valeur, majParId: u.id, majLe: new Date() } });
      });
      apresModification();
      await journaliser(u, "site_public_campus_modifie", { siteId: s.id, slug: s.slug });
      res.json(await etatPilotage(u));
    }),
  );

  app.delete(
    "/api/pilotage/site/campus/:slug",
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const [s] = await db.select().from(sites).where(eq(sites.slug, String(req.params.slug)));
      if (!s) throw introuvable("Campus");
      await db.delete(contenusSite).where(eq(contenusSite.cle, `campus.${s.slug}`));
      apresModification();
      await journaliser(u, "site_public_campus_retabli", { siteId: s.id, slug: s.slug });
      res.json(await etatPilotage(u));
    }),
  );
}
