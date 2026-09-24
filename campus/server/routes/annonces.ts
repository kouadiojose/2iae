// Annonces ciblées (tous les campus, un campus, une classe, un cours) et
// centre de notifications (la cloche de la coquille).
//
// Qui publie quoi :
//   - la direction vise n'importe qui et publie directement sur 2iae.com ;
//   - la vie scolaire d'un site ne vise que son site, ses classes et les
//     cours suivis uniquement par ses classes (perimetreSites) ;
//   - le formateur ne vise que ses cours, et propose au site (la direction valide).
// Une annonce « importante » sonne sur le téléphone (dans la limite du
// plafond quotidien) et reste en haut de l'accueil jusqu'à sa lecture.
//
// Ce fichier exporte aussi les outils de ciblage réutilisés par l'agenda
// (événements) et l'accueil.
import type { Express } from "express";
import { z } from "zod";
import { and, desc, eq, gt, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "../db";
import { exigerConnexion, exigerRole, moi, perimetreSites } from "../auth";
import { route, valider, idParam, introuvable, interdit, invalide, ErreurHttp } from "../http";
import { idsCoursAccessibles, enseigneCours, etudiantsDuCours, formateursDuCours } from "../acces";
import { notifier, compterNonLues } from "../notifications";
import { publier, publierUtilisateur } from "../temps-reel";
import { prevenirSite } from "../site";
import { compterMessagesNonLus } from "../messages-outils";
import {
  annonces,
  lecturesAnnonces,
  notifications,
  relancesAnnonces,
  utilisateurs,
  sites,
  classes,
  cours,
  coursClasses,
  journal,
  CIBLES,
  type Annonce,
  type Cible,
  type Utilisateur,
  type AnnonceDto,
  type AnnonceGestion,
  type LecturesAnnonce,
  type CiblesAnnonce,
  type DestinatairesAnnonce,
} from "@shared/schema";

// ═══ Outils de ciblage (annonces et événements) ═══════════════════════════

/** Une cible telle qu'elle est stockée (annonces, événements). */
export type CibleStockee = { cible: Cible; siteId: number | null; classeId: number | null; coursId: number | null };

/** Colonnes de ciblage d'une table (annonces ou événements). */
type ColonnesCible = { cible: PgColumn; siteId: PgColumn; classeId: PgColumn; coursId: PgColumn };

const faux = sql`false`;

/** Cours suivis par au moins une classe de ces sites (lecture, agenda). */
export async function coursDesSites(siteIds: number[]): Promise<number[]> {
  if (!siteIds.length) return [];
  const lignes = await db
    .selectDistinct({ id: coursClasses.coursId })
    .from(coursClasses)
    .innerJoin(classes, eq(classes.id, coursClasses.classeId))
    .where(inArray(classes.siteId, siteIds));
  return lignes.map((l) => l.id);
}

/** Classes de ces sites. */
export async function classesDesSites(siteIds: number[]): Promise<number[]> {
  if (!siteIds.length) return [];
  const lignes = await db.select({ id: classes.id }).from(classes).where(inArray(classes.siteId, siteIds));
  return lignes.map((l) => l.id);
}

/**
 * Un cours est dans le périmètre d'une vie scolaire si TOUTES les classes
 * qui le suivent sont de son site : sinon une annonce « cours » atteindrait
 * les étudiants d'autres campus.
 */
export async function coursDansPerimetre(coursId: number, siteIds: number[]): Promise<boolean> {
  const lignes = await db
    .select({ siteId: classes.siteId })
    .from(coursClasses)
    .innerJoin(classes, eq(classes.id, coursClasses.classeId))
    .where(eq(coursClasses.coursId, coursId));
  return lignes.length > 0 && lignes.every((l) => siteIds.includes(l.siteId));
}

/**
 * Condition SQL : lignes (annonces ou événements) qui visent cette personne,
 * c'est-à-dire ce qu'elle voit dans son fil et son agenda.
 */
export async function conditionCiblesPour(u: Utilisateur, t: ColonnesCible): Promise<SQL> {
  const tous = eq(t.cible, "tous");
  const parSite = (ids: number[]) => (ids.length ? and(eq(t.cible, "site"), inArray(t.siteId, ids))! : faux);
  const parClasse = (ids: number[]) => (ids.length ? and(eq(t.cible, "classe"), inArray(t.classeId, ids))! : faux);
  const parCours = (ids: number[]) => (ids.length ? and(eq(t.cible, "cours"), inArray(t.coursId, ids))! : faux);

  switch (u.role) {
    case "admin":
      return sql`true`;
    case "vie_scolaire": {
      const perimetre = perimetreSites(u);
      if (!perimetre) return sql`true`;
      const [cl, co] = await Promise.all([classesDesSites(perimetre), coursDesSites(perimetre)]);
      return or(tous, parSite(perimetre), parClasse(cl), parCours(co))!;
    }
    case "formateur": {
      const mesCours = await idsCoursAccessibles(u);
      return or(tous, parSite(u.siteId ? [u.siteId] : []), parCours(mesCours))!;
    }
    case "salle":
      return or(tous, parSite(u.siteId ? [u.siteId] : []))!;
    default: {
      const mesCours = await idsCoursAccessibles(u);
      return or(tous, parSite(u.siteId ? [u.siteId] : []), parClasse(u.classeId ? [u.classeId] : []), parCours(mesCours))!;
    }
  }
}

/** Personnes qui reçoivent une cible (notification, accusés de lecture). Jamais les écrans de salle. */
export async function destinatairesCible(c: CibleStockee): Promise<Utilisateur[]> {
  const actifs = and(eq(utilisateurs.actif, true), sql`${utilisateurs.role} <> 'salle'`);
  switch (c.cible) {
    case "tous":
      return db.select().from(utilisateurs).where(actifs);
    case "site":
      if (!c.siteId) return [];
      // Étudiants, vie scolaire et formateurs rattachés au site (pas la direction : elle voit tout sans être sonnée).
      return db
        .select()
        .from(utilisateurs)
        .where(and(actifs, eq(utilisateurs.siteId, c.siteId), sql`${utilisateurs.role} <> 'admin'`));
    case "classe":
      if (!c.classeId) return [];
      return db
        .select()
        .from(utilisateurs)
        .where(and(actifs, eq(utilisateurs.role, "etudiant"), eq(utilisateurs.classeId, c.classeId)));
    case "cours": {
      if (!c.coursId) return [];
      const [etudiants, formateurs] = await Promise.all([etudiantsDuCours(c.coursId), formateursDuCours(c.coursId)]);
      const parId = new Map<number, Utilisateur>();
      for (const p of [...etudiants, ...formateurs]) if (p.actif) parId.set(p.id, p);
      return [...parId.values()];
    }
  }
}

/** La cible est-elle dans ce que la personne administre ? (gérer une annonce ou un événement) */
export async function cibleDansPerimetre(u: Utilisateur, c: CibleStockee): Promise<boolean> {
  if (u.role === "admin") return true;
  if (u.role !== "vie_scolaire") return false;
  const perimetre = perimetreSites(u);
  if (!perimetre) return true;
  switch (c.cible) {
    case "tous":
      return false;
    case "site":
      return c.siteId !== null && perimetre.includes(c.siteId);
    case "classe": {
      if (!c.classeId) return false;
      const [cl] = await db.select({ siteId: classes.siteId }).from(classes).where(eq(classes.id, c.classeId));
      return Boolean(cl && perimetre.includes(cl.siteId));
    }
    case "cours":
      return c.coursId !== null && (await coursDansPerimetre(c.coursId, perimetre));
  }
}

export const schemaCible = z.object({
  cible: z.enum(CIBLES),
  siteId: z.number().int().positive().nullish(),
  classeId: z.number().int().positive().nullish(),
  coursId: z.number().int().positive().nullish(),
});

/**
 * Normalise et contrôle une cible saisie : garde seulement l'identifiant utile,
 * vérifie qu'il existe et que la personne a le droit de viser ce public.
 * `formateurAutorise` : le formateur peut viser ses cours (annonces), pas les événements.
 */
export async function verifierCible(
  u: Utilisateur,
  brute: z.infer<typeof schemaCible>,
  { formateurAutorise }: { formateurAutorise: boolean },
): Promise<CibleStockee> {
  const c: CibleStockee = {
    cible: brute.cible,
    siteId: brute.cible === "site" ? (brute.siteId ?? null) : null,
    classeId: brute.cible === "classe" ? (brute.classeId ?? null) : null,
    coursId: brute.cible === "cours" ? (brute.coursId ?? null) : null,
  };
  if (c.cible === "site" && !c.siteId) throw invalide("Choisissez le campus concerné.");
  if (c.cible === "classe" && !c.classeId) throw invalide("Choisissez la classe concernée.");
  if (c.cible === "cours" && !c.coursId) throw invalide("Choisissez le cours concerné.");

  if (c.siteId) {
    const [s] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, c.siteId));
    if (!s) throw introuvable("Campus");
  }
  if (c.classeId) {
    const [cl] = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, c.classeId));
    if (!cl) throw introuvable("Classe");
  }
  if (c.coursId) {
    const [co] = await db.select({ id: cours.id }).from(cours).where(eq(cours.id, c.coursId));
    if (!co) throw introuvable("Cours");
  }

  if (u.role === "formateur") {
    if (!formateurAutorise) throw interdit("Seule l'équipe du campus peut faire cela.");
    if (c.cible !== "cours") throw interdit("En tant que formateur, vous pouvez écrire aux étudiants de vos cours uniquement.");
    if (!(await enseigneCours(u, c.coursId!))) throw interdit("Vous n'enseignez pas ce cours.");
    return c;
  }
  if (!(await cibleDansPerimetre(u, c))) {
    if (c.cible === "tous") throw interdit("Votre compte est rattaché à un campus : choisissez ce campus, une de ses classes ou un de ses cours.");
    throw interdit("Ce public est en dehors de votre campus.");
  }
  return c;
}

/** Libellés lisibles des cibles (« Campus Yopougon », « IA-101 · Initiation à l'IA »…), en lot. */
export async function libellesCibles(lignes: CibleStockee[]): Promise<(c: CibleStockee) => string> {
  const idsSites = [...new Set(lignes.map((l) => l.siteId).filter((x): x is number => Boolean(x)))];
  const idsClasses = [...new Set(lignes.map((l) => l.classeId).filter((x): x is number => Boolean(x)))];
  const idsCours = [...new Set(lignes.map((l) => l.coursId).filter((x): x is number => Boolean(x)))];
  const [ss, cl, co] = await Promise.all([
    idsSites.length ? db.select({ id: sites.id, nom: sites.nomCourt }).from(sites).where(inArray(sites.id, idsSites)) : [],
    idsClasses.length ? db.select({ id: classes.id, nom: classes.nom }).from(classes).where(inArray(classes.id, idsClasses)) : [],
    idsCours.length ? db.select({ id: cours.id, code: cours.code, titre: cours.titre }).from(cours).where(inArray(cours.id, idsCours)) : [],
  ]);
  const nomSite = new Map(ss.map((s) => [s.id, s.nom]));
  const nomClasse = new Map(cl.map((c) => [c.id, c.nom]));
  const nomCours = new Map(co.map((c) => [c.id, `${c.code} · ${c.titre}`]));
  return (c) => {
    switch (c.cible) {
      case "tous":
        return "Tous les campus";
      case "site":
        return `Campus ${nomSite.get(c.siteId!) ?? ""}`.trim();
      case "classe":
        return nomClasse.get(c.classeId!) ?? "Une classe";
      case "cours":
        return nomCours.get(c.coursId!) ?? "Un cours";
    }
  };
}

/** Texte brut court à partir du Markdown (aperçus, notifications, WhatsApp). */
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

/** Canal temps réel qui atteint le public d'une cible (null : cours, envoyé personne par personne). */
export function canalCible(c: CibleStockee): string | null {
  if (c.cible === "tous") return "tous";
  if (c.cible === "site" && c.siteId) return `site:${c.siteId}`;
  if (c.cible === "classe" && c.classeId) return `classe:${c.classeId}`;
  return null;
}

// ═══ Annonces ═════════════════════════════════════════════════════════════

const enLigne = (maintenant: Date) =>
  and(lte(annonces.publieeLe, maintenant), or(isNull(annonces.expireLe), gt(annonces.expireLe, maintenant)))!;

/** La personne peut-elle modifier, supprimer, relancer et voir les lectures ? */
export async function peutGererAnnonce(u: Utilisateur, a: Annonce): Promise<boolean> {
  if (a.auteurId === u.id) return true;
  return cibleDansPerimetre(u, a);
}

/** Annonces visibles par la personne (fil, accueil), épinglées puis importantes d'abord. */
export async function annoncesPour(u: Utilisateur, options: { limite?: number; importantesSeulement?: boolean } = {}) {
  const maintenant = new Date();
  const cibles = await conditionCiblesPour(u, annonces);
  const conditions = [enLigne(maintenant), or(cibles, eq(annonces.auteurId, u.id))!];
  if (options.importantesSeulement) conditions.push(or(eq(annonces.importante, true), eq(annonces.epinglee, true))!);
  return db
    .select({
      annonce: annonces,
      auteur: { id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role, photoUrl: utilisateurs.photoUrl },
      luLe: lecturesAnnonces.luLe,
    })
    .from(annonces)
    .innerJoin(utilisateurs, eq(utilisateurs.id, annonces.auteurId))
    .leftJoin(lecturesAnnonces, and(eq(lecturesAnnonces.annonceId, annonces.id), eq(lecturesAnnonces.utilisateurId, u.id)))
    .where(and(...conditions))
    .orderBy(desc(annonces.epinglee), desc(annonces.importante), desc(annonces.publieeLe))
    .limit(options.limite ?? 100);
}

type LigneAnnonce = Awaited<ReturnType<typeof annoncesPour>>[number];

async function versDtos(u: Utilisateur, lignes: LigneAnnonce[]): Promise<AnnonceDto[]> {
  const libelle = await libellesCibles(lignes.map((l) => l.annonce));
  return Promise.all(
    lignes.map(async ({ annonce: a, auteur, luLe }) => ({
      id: a.id,
      titre: a.titre,
      corps: a.corps,
      cible: a.cible,
      cibleLibelle: libelle(a),
      siteId: a.siteId,
      classeId: a.classeId,
      coursId: a.coursId,
      importante: a.importante,
      epinglee: a.epinglee,
      proposeSurSite: a.proposeSurSite,
      publierSurSite: a.publierSurSite,
      publieeLe: a.publieeLe.toISOString(),
      expireLe: a.expireLe?.toISOString() ?? null,
      auteur,
      lue: Boolean(luLe) || a.auteurId === u.id,
      gerable: await peutGererAnnonce(u, a),
    })),
  );
}

/** Charge une annonce que la personne a le droit de lire (ou de gérer), sinon 404. */
async function annonceLisible(u: Utilisateur, id: number): Promise<{ annonce: Annonce; gerable: boolean }> {
  const [a] = await db.select().from(annonces).where(eq(annonces.id, id));
  if (!a) throw introuvable("Annonce");
  const gerable = await peutGererAnnonce(u, a);
  if (gerable) return { annonce: a, gerable };
  const cibles = await conditionCiblesPour(u, annonces);
  const [visible] = await db.select({ id: annonces.id }).from(annonces).where(and(eq(annonces.id, id), cibles));
  // Même réponse qu'une annonce inexistante : on ne révèle pas ce qui ne nous concerne pas.
  if (!visible) throw introuvable("Annonce");
  const maintenant = new Date();
  if (a.publieeLe > maintenant) throw introuvable("Annonce");
  if (a.expireLe && a.expireLe <= maintenant) throw new ErreurHttp(404, "Cette annonce n'est plus en ligne.");
  return { annonce: a, gerable };
}

/** Chiffres de lecture d'une annonce, à partir de ses destinataires actuels. */
async function lecturesDe(a: Annonce): Promise<LecturesAnnonce> {
  const destinataires = (await destinatairesCible(a)).filter((p) => p.id !== a.auteurId);
  const lectures = await db.select({ id: lecturesAnnonces.utilisateurId }).from(lecturesAnnonces).where(eq(lecturesAnnonces.annonceId, a.id));
  const ontLu = new Set(lectures.map((l) => l.id));
  const nomsSites = new Map((await db.select({ id: sites.id, nom: sites.nomCourt, ordre: sites.ordre }).from(sites)).map((s) => [s.id, s]));

  const parSite = new Map<string, { site: string; lus: number; total: number; ordre: number }>();
  for (const p of destinataires) {
    const s = p.siteId ? nomsSites.get(p.siteId) : undefined;
    const cle = s?.nom ?? (p.role === "formateur" ? "Formateurs" : "Sans campus");
    const ligne = parSite.get(cle) ?? { site: cle, lus: 0, total: 0, ordre: s?.ordre ?? 99 };
    ligne.total++;
    if (ontLu.has(p.id)) ligne.lus++;
    parSite.set(cle, ligne);
  }
  const nonLus = destinataires
    .filter((p) => !ontLu.has(p.id))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr") || x.prenom.localeCompare(y.prenom, "fr"))
    .map((p) => {
      const s = p.siteId ? nomsSites.get(p.siteId)?.nom : null;
      return `${p.prenom} ${p.nom}${s ? ` (${s})` : ""}`;
    });
  const [relance] = await db
    .select({ creeLe: relancesAnnonces.creeLe })
    .from(relancesAnnonces)
    .where(eq(relancesAnnonces.annonceId, a.id))
    .orderBy(desc(relancesAnnonces.creeLe))
    .limit(1);
  return {
    lus: destinataires.length - nonLus.length,
    total: destinataires.length,
    nonLus,
    parSite: [...parSite.values()].sort((x, y) => x.ordre - y.ordre).map(({ site, lus, total }) => ({ site, lus, total })),
    derniereRelance: relance?.creeLe.toISOString() ?? null,
  };
}

/** Prévient les destinataires d'une annonce (cloche, temps réel, téléphone si importante). */
async function diffuser(a: Annonce, titre = a.importante ? `Important : ${a.titre}` : a.titre, ids?: number[]) {
  const cibles = ids ?? (await destinatairesCible(a)).map((p) => p.id).filter((id) => id !== a.auteurId);
  await notifier(cibles, { type: "annonce", titre, corps: extrait(a.corps, 140), lien: `/annonces/${a.id}`, push: a.importante || Boolean(ids) });
  const canal = canalCible(a);
  if (canal) publier(canal, "annonce", { id: a.id });
  else for (const id of cibles) publierUtilisateur(id, "annonce", { id: a.id });
  return cibles.length;
}

const schemaAnnonce = schemaCible.extend({
  titre: z.string().trim().min(3, "le titre est trop court").max(120, "120 caractères au plus"),
  corps: z.string().trim().min(1, "écrivez le message").max(2000, "2 000 caractères au plus"),
  importante: z.boolean().default(false),
  epinglee: z.boolean().default(false),
  expireLe: z.string().datetime({ offset: true }).nullish(),
  /** Case « Publier / Proposer sur 2iae.com ». */
  surSite: z.boolean().default(false),
});

const schemaModification = schemaAnnonce.partial().extend({ cible: z.enum(CIBLES).optional() });

/** Publication sur le site : la direction publie, les autres proposent. */
function champsSite(u: Utilisateur, surSite: boolean) {
  if (u.role === "admin") return { publierSurSite: surSite, proposeSurSite: false };
  // Décocher retire aussi une annonce déjà validée (l'auteur reste maître de son texte).
  return surSite ? { proposeSurSite: true } : { proposeSurSite: false, publierSurSite: false };
}

function dateExpiration(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (d.getTime() <= Date.now()) throw invalide("La date de retrait doit être dans le futur.");
  return d;
}

export function enregistrerAnnonces(app: Express) {
  // ── Centre de notifications (contrat de la coquille) ─────────────────────
  app.get(
    "/api/notifications",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const liste = await db
        .select()
        .from(notifications)
        .where(eq(notifications.utilisateurId, u.id))
        .orderBy(desc(notifications.creeLe), desc(notifications.id))
        .limit(30);
      res.json(liste);
    }),
  );

  app.get(
    "/api/notifications/compteur",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const [nonLues, messagesNonLus] = await Promise.all([
        compterNonLues(u.id),
        // Le compteur de messages appartient au module messages : un incident chez lui ne doit pas éteindre la cloche.
        compterMessagesNonLus(u).catch(() => 0),
      ]);
      res.json({ nonLues, messagesNonLus });
    }),
  );

  app.post(
    "/api/notifications/tout-lu",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const lues = await db
        .update(notifications)
        .set({ luLe: new Date() })
        .where(and(eq(notifications.utilisateurId, u.id), isNull(notifications.luLe)))
        .returning({ id: notifications.id });
      // Les autres onglets ouverts remettent leur cloche à zéro.
      publierUtilisateur(u.id, "notification", { lues: lues.length });
      res.json({ ok: true, lues: lues.length });
    }),
  );

  app.post(
    "/api/notifications/:id/lu",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const [n] = await db
        .update(notifications)
        .set({ luLe: sql`coalesce(${notifications.luLe}, now())` })
        .where(and(eq(notifications.id, id), eq(notifications.utilisateurId, u.id)))
        .returning({ id: notifications.id });
      if (!n) throw introuvable("Notification");
      res.json({ ok: true });
    }),
  );

  // ── Fil des annonces ─────────────────────────────────────────────────────
  app.get(
    "/api/annonces",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      res.json(await versDtos(u, await annoncesPour(u)));
    }),
  );

  // Ce que la personne peut viser (formulaire de création).
  app.get(
    "/api/annonces/cibles",
    exigerRole("admin", "vie_scolaire", "formateur"),
    route(async (req, res) => {
      const u = moi(req);
      const reponse: CiblesAnnonce = { tous: false, sites: [], classes: [], cours: [], publieSurSite: u.role === "admin" };
      if (u.role === "formateur") {
        const ids = await idsCoursAccessibles(u);
        reponse.cours = ids.length
          ? await db.select({ id: cours.id, code: cours.code, titre: cours.titre }).from(cours).where(inArray(cours.id, ids)).orderBy(cours.code)
          : [];
        return res.json(reponse);
      }
      const perimetre = perimetreSites(u);
      reponse.tous = perimetre === null;
      reponse.sites = await db
        .select({ id: sites.id, nom: sites.nomCourt })
        .from(sites)
        .where(perimetre ? inArray(sites.id, perimetre) : undefined)
        .orderBy(sites.ordre);
      reponse.classes = await db
        .select({ id: classes.id, nom: classes.nom, siteId: classes.siteId })
        .from(classes)
        .where(perimetre ? inArray(classes.siteId, perimetre) : undefined)
        .orderBy(classes.nom);
      const tousCours = await db.select({ id: cours.id, code: cours.code, titre: cours.titre }).from(cours).where(sql`${cours.statut} <> 'archive'`).orderBy(cours.code);
      reponse.cours = perimetre
        ? (await Promise.all(tousCours.map(async (c) => ((await coursDansPerimetre(c.id, perimetre)) ? c : null)))).filter((c): c is (typeof tousCours)[number] => c !== null)
        : tousCours;
      res.json(reponse);
    }),
  );

  // « Sera reçue par 342 étudiants et 12 membres du personnel ».
  app.get(
    "/api/annonces/destinataires",
    exigerRole("admin", "vie_scolaire", "formateur"),
    route(async (req, res) => {
      const u = moi(req);
      const nombre = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));
      const brute = valider(schemaCible, {
        cible: req.query.cible,
        siteId: nombre(req.query.siteId),
        classeId: nombre(req.query.classeId),
        coursId: nombre(req.query.coursId),
      });
      const cible = await verifierCible(u, brute, { formateurAutorise: true });
      const liste = (await destinatairesCible(cible)).filter((p) => p.id !== u.id);
      const etudiants = liste.filter((p) => p.role === "etudiant").length;
      const reponse: DestinatairesAnnonce = { etudiants, personnel: liste.length - etudiants, total: liste.length };
      res.json(reponse);
    }),
  );

  // Liste de gestion : pilotage (périmètre) et « Mes annonces » du formateur, avec accusés de lecture.
  app.get(
    "/api/annonces/gestion",
    exigerRole("admin", "vie_scolaire", "formateur"),
    route(async (req, res) => {
      const u = moi(req);
      let condition: SQL | undefined;
      if (u.role === "formateur") condition = eq(annonces.auteurId, u.id);
      else if (u.role === "vie_scolaire" && perimetreSites(u)) {
        const perimetre = perimetreSites(u)!;
        const [cl, co] = await Promise.all([classesDesSites(perimetre), coursDesSites(perimetre)]);
        condition = or(
          eq(annonces.auteurId, u.id),
          and(eq(annonces.cible, "site"), inArray(annonces.siteId, perimetre)),
          cl.length ? and(eq(annonces.cible, "classe"), inArray(annonces.classeId, cl)) : undefined,
          co.length ? and(eq(annonces.cible, "cours"), inArray(annonces.coursId, co)) : undefined,
        );
      }
      const lignes = await db
        .select({
          annonce: annonces,
          auteur: { id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role, photoUrl: utilisateurs.photoUrl },
          luLe: lecturesAnnonces.luLe,
        })
        .from(annonces)
        .innerJoin(utilisateurs, eq(utilisateurs.id, annonces.auteurId))
        .leftJoin(lecturesAnnonces, and(eq(lecturesAnnonces.annonceId, annonces.id), eq(lecturesAnnonces.utilisateurId, u.id)))
        .where(condition)
        .orderBy(desc(annonces.publieeLe))
        .limit(100);
      // Un cours partagé entre campus apparaît en lecture seule pour la vie scolaire d'un site : on ne garde que ce qu'elle gère.
      const dtos = (await versDtos(u, lignes)).filter((d) => d.gerable);
      const parId = new Map(lignes.map((l) => [l.annonce.id, l.annonce]));
      const maintenant = Date.now();
      const resultat: AnnonceGestion[] = await Promise.all(
        dtos.map(async (d) => {
          const l = await lecturesDe(parId.get(d.id)!);
          return { ...d, lus: l.lus, total: l.total, expiree: Boolean(d.expireLe && new Date(d.expireLe).getTime() <= maintenant), derniereRelance: l.derniereRelance };
        }),
      );
      res.json(resultat);
    }),
  );

  app.get(
    "/api/annonces/:id",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const { annonce } = await annonceLisible(u, idParam(req));
      const lignes = await db
        .select({
          annonce: annonces,
          auteur: { id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role, photoUrl: utilisateurs.photoUrl },
          luLe: lecturesAnnonces.luLe,
        })
        .from(annonces)
        .innerJoin(utilisateurs, eq(utilisateurs.id, annonces.auteurId))
        .leftJoin(lecturesAnnonces, and(eq(lecturesAnnonces.annonceId, annonces.id), eq(lecturesAnnonces.utilisateurId, u.id)))
        .where(eq(annonces.id, annonce.id));
      const [dto] = await versDtos(u, lignes);
      res.json(dto);
    }),
  );

  app.post(
    "/api/annonces/:id/lue",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const { annonce } = await annonceLisible(u, idParam(req));
      await db.insert(lecturesAnnonces).values({ annonceId: annonce.id, utilisateurId: u.id }).onConflictDoNothing();
      // La notification de la cloche qui menait ici est lue elle aussi.
      await db
        .update(notifications)
        .set({ luLe: new Date() })
        .where(and(eq(notifications.utilisateurId, u.id), eq(notifications.lien, `/annonces/${annonce.id}`), isNull(notifications.luLe)));
      res.json({ ok: true });
    }),
  );

  app.get(
    "/api/annonces/:id/lectures",
    exigerRole("admin", "vie_scolaire", "formateur"),
    route(async (req, res) => {
      const u = moi(req);
      const { annonce, gerable } = await annonceLisible(u, idParam(req));
      if (!gerable) throw interdit("Seuls l'auteur et l'équipe du campus voient les lectures.");
      res.json(await lecturesDe(annonce));
    }),
  );

  app.post(
    "/api/annonces",
    exigerRole("admin", "vie_scolaire", "formateur"),
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(schemaAnnonce, req.body);
      const cible = await verifierCible(u, d, { formateurAutorise: true });
      const [a] = await db
        .insert(annonces)
        .values({
          auteurId: u.id,
          titre: d.titre,
          corps: d.corps,
          ...cible,
          importante: d.importante,
          epinglee: d.epinglee,
          expireLe: dateExpiration(d.expireLe),
          ...champsSite(u, d.surSite),
        })
        .returning();
      const nombre = await diffuser(a);
      await db.insert(journal).values({ utilisateurId: u.id, action: "annonce.publiee", details: { annonceId: a.id, cible: a.cible, destinataires: nombre } });
      if (a.publierSurSite) prevenirSite("annonce publiée");
      res.status(201).json({ id: a.id, destinataires: nombre });
    }),
  );

  app.patch(
    "/api/annonces/:id",
    exigerRole("admin", "vie_scolaire", "formateur"),
    route(async (req, res) => {
      const u = moi(req);
      const [a] = await db.select().from(annonces).where(eq(annonces.id, idParam(req)));
      if (!a || !(await peutGererAnnonce(u, a))) throw introuvable("Annonce");
      const d = valider(schemaModification, req.body);
      const cible = d.cible
        ? await verifierCible(u, { cible: d.cible, siteId: d.siteId, classeId: d.classeId, coursId: d.coursId }, { formateurAutorise: true })
        : {};
      const [maj] = await db
        .update(annonces)
        .set({
          ...(d.titre !== undefined && { titre: d.titre }),
          ...(d.corps !== undefined && { corps: d.corps }),
          ...cible,
          ...(d.importante !== undefined && { importante: d.importante }),
          ...(d.epinglee !== undefined && { epinglee: d.epinglee }),
          ...(d.expireLe !== undefined && { expireLe: dateExpiration(d.expireLe) }),
          ...(d.surSite !== undefined && champsSite(u, d.surSite)),
        })
        .where(eq(annonces.id, a.id))
        .returning();
      await db.insert(journal).values({ utilisateurId: u.id, action: "annonce.modifiee", details: { annonceId: a.id } });
      if (a.publierSurSite || maj.publierSurSite) prevenirSite("annonce modifiée");
      const canal = canalCible(maj);
      if (canal) publier(canal, "annonce", { id: maj.id });
      res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/annonces/:id",
    exigerRole("admin", "vie_scolaire", "formateur"),
    route(async (req, res) => {
      const u = moi(req);
      const [a] = await db.select().from(annonces).where(eq(annonces.id, idParam(req)));
      if (!a || !(await peutGererAnnonce(u, a))) throw introuvable("Annonce");
      await db.delete(annonces).where(eq(annonces.id, a.id));
      // Les notifications qui y menaient ne mèneraient plus nulle part : on les retire des cloches.
      await db.delete(notifications).where(eq(notifications.lien, `/annonces/${a.id}`));
      await db.insert(journal).values({ utilisateurId: u.id, action: "annonce.supprimee", details: { annonceId: a.id, titre: a.titre } });
      if (a.publierSurSite) prevenirSite("annonce retirée");
      const canal = canalCible(a);
      if (canal) publier(canal, "annonce", { id: a.id, supprimee: true });
      res.json({ ok: true });
    }),
  );

  // Relance : renvoie la notification (et un rappel sur le téléphone) à ceux qui n'ont pas lu.
  app.post(
    "/api/annonces/:id/relancer",
    exigerRole("admin", "vie_scolaire", "formateur"),
    route(async (req, res) => {
      const u = moi(req);
      const [a] = await db.select().from(annonces).where(eq(annonces.id, idParam(req)));
      if (!a || !(await peutGererAnnonce(u, a))) throw introuvable("Annonce");
      if (a.expireLe && a.expireLe <= new Date()) throw invalide("Cette annonce a expiré : elle n'est plus visible des étudiants.");
      const [derniere] = await db
        .select({ creeLe: relancesAnnonces.creeLe })
        .from(relancesAnnonces)
        .where(eq(relancesAnnonces.annonceId, a.id))
        .orderBy(desc(relancesAnnonces.creeLe))
        .limit(1);
      const attente = derniere ? 60 - Math.floor((Date.now() - derniere.creeLe.getTime()) / 60_000) : 0;
      if (attente > 0) throw new ErreurHttp(429, `Une relance vient d'être envoyée. Vous pourrez relancer dans ${attente} min.`);
      const destinataires = (await destinatairesCible(a)).filter((p) => p.id !== a.auteurId);
      const ontLu = new Set(
        (await db.select({ id: lecturesAnnonces.utilisateurId }).from(lecturesAnnonces).where(eq(lecturesAnnonces.annonceId, a.id))).map((l) => l.id),
      );
      const nonLus = destinataires.filter((p) => !ontLu.has(p.id)).map((p) => p.id);
      if (!nonLus.length) return res.json({ ok: true, relances: 0 });
      await diffuser(a, `Rappel : ${a.titre}`, nonLus);
      await db.insert(relancesAnnonces).values({ annonceId: a.id, auteurId: u.id, destinataires: nonLus.length });
      await db.insert(journal).values({ utilisateurId: u.id, action: "annonce.relancee", details: { annonceId: a.id, destinataires: nonLus.length } });
      res.json({ ok: true, relances: nonLus.length });
    }),
  );

  // Validation par la direction d'une annonce proposée pour 2iae.com (ou retrait).
  app.post(
    "/api/annonces/:id/site",
    exigerRole("admin"),
    route(async (req, res) => {
      const u = moi(req);
      const { publier: publierSite } = valider(z.object({ publier: z.boolean() }), req.body);
      const [a] = await db
        .update(annonces)
        .set({ publierSurSite: publierSite, proposeSurSite: false })
        .where(eq(annonces.id, idParam(req)))
        .returning();
      if (!a) throw introuvable("Annonce");
      await db.insert(journal).values({ utilisateurId: u.id, action: publierSite ? "annonce.site.publiee" : "annonce.site.retiree", details: { annonceId: a.id } });
      prevenirSite(publierSite ? "annonce publiée" : "annonce retirée");
      res.json({ ok: true });
    }),
  );
}

