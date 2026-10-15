// Le mur du cours (José, 15 octobre 2026 : « un blog pour poster mes liens, mes fichiers ») : droits et lectures
// communes (routes/mur.ts, page du cours, accueil du professeur, espace du campus). Un fil par cours : les
// professeurs du cours (principal ou autres) et la direction écrivent ; les étudiants du cours, l'équipe de son
// périmètre et l'espace du campus lisent. Jamais un écran « salle ».
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { peut, perimetreSites } from "./auth";
import { enseigneCours, peutVoirCours } from "./acces";
import { coursDansPerimetre } from "./routes/annonces";
import {
  classes,
  cours,
  coursClasses,
  fichiers,
  fichiersPublications,
  notifications,
  publicationsCours,
  sites,
  utilisateurs,
  type Cours,
  type PublicationCours,
  type Utilisateur,
} from "@shared/schema";
import type { MurDto, PublicationDto } from "@shared/mur";

/** Publications montrées par page. */
export const PAR_PAGE = 20;

/** Le lien du mur pour un étudiant (notifications, et « vu » à l'ouverture de l'onglet). */
export const lienMurEtudiant = (coursId: number) => `/cours/${coursId}?onglet=mur`;
export const lienMurProfesseur = (coursId: number) => `/enseigner/mon-cours/${coursId}/mur`;

/** Lire le mur (et ses fichiers, et le canal temps réel mur:<id>) : comme voir le cours, jamais un écran « salle ». */
export async function peutLireMur(u: Utilisateur, coursId: number): Promise<boolean> {
  if (u.role === "salle") return false; // idsCoursAccessibles donnerait tous les cours publiés
  return peutVoirCours(u, coursId);
}

/** Écrire : un professeur du cours (principal ou autre), ou la direction ; jamais sur un cours archivé. */
export async function peutPublierMur(u: Utilisateur, c: Pick<Cours, "id" | "statut">): Promise<boolean> {
  if (c.statut === "archive") return false;
  if (u.role === "admin") return true;
  return u.role === "formateur" && (await enseigneCours(u, c.id));
}

/**
 * Supprimer : l'auteur s'il lit encore le mur ; la direction ; l'équipe « annonces » dont le périmètre couvre toutes
 * les classes du cours (équipe du groupe : oui).
 */
export async function peutSupprimerPublication(u: Utilisateur, p: Pick<PublicationCours, "auteurId" | "coursId">): Promise<boolean> {
  if (u.role === "admin") return true;
  if (p.auteurId === u.id) return u.role === "formateur" ? enseigneCours(u, p.coursId) : peutLireMur(u, p.coursId);
  if (u.role === "vie_scolaire" && peut(u, "annonces")) {
    const perimetre = perimetreSites(u);
    if (!perimetre) return true;
    return coursDansPerimetre(p.coursId, perimetre);
  }
  return false;
}

/** « 1BTS Riviera · 2BTS Yopougon » (3 classes au plus), sinon « 6 classes · 5 campus » ; "" sans classe. */
export async function lecteursDuCours(coursId: number): Promise<string> {
  const lignes = await db
    .select({ nom: classes.nom, site: sites.nomCourt, siteId: classes.siteId })
    .from(coursClasses)
    .innerJoin(classes, eq(classes.id, coursClasses.classeId))
    .innerJoin(sites, eq(sites.id, classes.siteId))
    .where(eq(coursClasses.coursId, coursId))
    .orderBy(classes.nom);
  if (!lignes.length) return "";
  if (lignes.length <= 3) return lignes.map((l) => `${l.nom}${l.nom.includes(l.site) ? "" : ` ${l.site}`}`).join(" · ");
  const campus = new Set(lignes.map((l) => l.siteId)).size;
  return `${lignes.length} classes · ${campus} campus`;
}

/** Nombre de messages et date du dernier, par cours (une requête). */
export async function resumeMurs(coursIds: number[]): Promise<Map<number, { total: number; dernierLe: string | null }>> {
  const carte = new Map<number, { total: number; dernierLe: string | null }>();
  if (!coursIds.length) return carte;
  const lignes = await db
    .select({ coursId: publicationsCours.coursId, total: sql<number>`count(*)::int`, dernier: sql<Date | string | null>`max(${publicationsCours.creeLe})` })
    .from(publicationsCours)
    .where(inArray(publicationsCours.coursId, coursIds))
    .groupBy(publicationsCours.coursId);
  for (const l of lignes) carte.set(l.coursId, { total: Number(l.total), dernierLe: l.dernier ? new Date(l.dernier).toISOString() : null });
  return carte;
}

/** Notifications du mur pas encore lues par cette personne (lien du mur de ce cours). */
export async function nonLusMur(u: Pick<Utilisateur, "id">, coursId: number): Promise<number> {
  const [l] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.utilisateurId, u.id), eq(notifications.lien, lienMurEtudiant(coursId)), isNull(notifications.luLe)));
  return Number(l?.n ?? 0);
}

/** CoursDetail.mur : null si la personne ne lit pas le mur. */
export async function resumeMurPour(u: Utilisateur, coursId: number): Promise<{ total: number; nonLus: number } | null> {
  if (!(await peutLireMur(u, coursId))) return null;
  const total = (await resumeMurs([coursId])).get(coursId)?.total ?? 0;
  return { total, nonLus: u.role === "etudiant" ? await nonLusMur(u, coursId) : 0 };
}

/** Une page du mur d'un cours, du plus récent au plus ancien (avant : id de la dernière publication déjà montrée). */
export async function murDuCours(
  u: Utilisateur,
  c: Cours,
  { avant, lectureSeule = false }: { avant?: number | null; lectureSeule?: boolean } = {},
): Promise<MurDto> {
  const lignes = await db
    .select({ p: publicationsCours, prenom: utilisateurs.prenom, nom: utilisateurs.nom, photoUrl: utilisateurs.photoUrl, role: utilisateurs.role })
    .from(publicationsCours)
    .innerJoin(utilisateurs, eq(utilisateurs.id, publicationsCours.auteurId))
    .where(and(eq(publicationsCours.coursId, c.id), avant ? lt(publicationsCours.id, avant) : undefined))
    .orderBy(desc(publicationsCours.id))
    .limit(PAR_PAGE + 1);
  const page = lignes.slice(0, PAR_PAGE);
  const ids = page.map((l) => l.p.id);
  const joints = ids.length
    ? await db
        .select({ publicationId: fichiersPublications.publicationId, ordre: fichiersPublications.ordre, f: fichiers })
        .from(fichiersPublications)
        .innerJoin(fichiers, eq(fichiers.id, fichiersPublications.fichierId))
        .where(inArray(fichiersPublications.publicationId, ids))
        .orderBy(fichiersPublications.ordre)
    : [];
  const resume = (await resumeMurs([c.id])).get(c.id) ?? { total: 0, dernierLe: null };
  const publications: PublicationDto[] = [];
  for (const l of page) {
    publications.push({
      id: l.p.id,
      auteur: { id: l.p.auteurId, nom: `${l.prenom} ${l.nom}`.trim(), photoUrl: l.photoUrl, etiquette: l.role === "admin" ? "direction" : "professeur" },
      texte: l.p.texte,
      liens: (l.p.liens ?? []).map((x) => ({ url: x.url, titre: x.titre, site: siteDe(x.url), youtubeId: x.youtubeId })),
      fichiers: joints
        .filter((j) => j.publicationId === l.p.id)
        .map((j) => ({ id: j.f.id, nom: j.f.nomOriginal, mime: j.f.mime, taille: j.f.taille, url: `/api/fichiers/${j.f.id}`, image: /^image\//.test(j.f.mime) })),
      creeLe: l.p.creeLe.toISOString(),
      peutSupprimer: !lectureSeule && (await peutSupprimerPublication(u, l.p)),
    });
  }
  return {
    cours: { id: c.id, code: c.code, titre: c.titre, couleur: c.couleur, statut: c.statut },
    peutPublier: !lectureSeule && (await peutPublierMur(u, c)),
    lecteurs: await lecteursDuCours(c.id),
    total: resume.total,
    dernierLe: resume.dernierLe,
    publications,
    suite: lignes.length > PAR_PAGE ? (page.at(-1)?.p.id ?? null) : null,
  };
}

/** « youtube.com », « exemple.ci » : le site d'un lien, lisible. */
export function siteDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Le cours du mur, ou rien (404 côté route). */
export async function coursDuMur(coursId: number): Promise<Cours | undefined> {
  const [c] = await db.select().from(cours).where(eq(cours.id, coursId));
  return c;
}
