// Qui a le droit de voir quoi. Toutes les routes passent par ces fonctions :
// un étudiant ne voit que les cours de sa classe (ou ceux où il est inscrit),
// un formateur ne gère que ses cours, la direction voit tout, la vie scolaire
// d'un campus voit les cours suivis par son campus et ne modifie que ceux
// suivis uniquement par son campus (CONCEPTION §9.5).
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "./db";
import { estEquipe, perimetreSites } from "./auth";
import { ErreurHttp, introuvable } from "./http";
import {
  cours,
  coursClasses,
  classes,
  coursFormateurs,
  inscriptions,
  utilisateurs,
  seances,
  devoirs,
  type Utilisateur,
  type Cours,
} from "@shared/schema";

/** Sites des classes qui suivent un cours. */
async function sitesDuCours(coursId: number): Promise<number[]> {
  const lignes = await db
    .select({ siteId: classes.siteId })
    .from(coursClasses)
    .innerJoin(classes, eq(classes.id, coursClasses.classeId))
    .where(eq(coursClasses.coursId, coursId));
  return lignes.map((l) => l.siteId);
}

/** Identifiants des cours visibles par cette personne. */
export async function idsCoursAccessibles(u: Utilisateur): Promise<number[]> {
  if (estEquipe(u)) {
    const perimetre = perimetreSites(u);
    const tous = await db.select({ id: cours.id }).from(cours);
    if (!perimetre) return tous.map((l) => l.id);
    // Vie scolaire d'un campus : cours suivis par son campus, et cours sans classe (brouillons).
    const lignes = await db
      .select({ coursId: coursClasses.coursId, siteId: classes.siteId })
      .from(coursClasses)
      .innerJoin(classes, eq(classes.id, coursClasses.classeId));
    const sitesParCours = new Map<number, number[]>();
    for (const l of lignes) sitesParCours.set(l.coursId, [...(sitesParCours.get(l.coursId) ?? []), l.siteId]);
    return tous
      .map((l) => l.id)
      .filter((id) => {
        const sites = sitesParCours.get(id);
        return !sites || sites.some((s) => perimetre.includes(s));
      });
  }
  if (u.role === "formateur") {
    const lignes = await db
      .select({ id: cours.id })
      .from(cours)
      .where(
        or(
          eq(cours.formateurId, u.id),
          inArray(cours.id, db.select({ id: coursFormateurs.coursId }).from(coursFormateurs).where(eq(coursFormateurs.formateurId, u.id))),
        ),
      );
    return lignes.map((l) => l.id);
  }
  if (u.role === "salle") {
    // L'écran d'une salle de conférence peut diffuser n'importe quel cours publié.
    const lignes = await db.select({ id: cours.id }).from(cours).where(eq(cours.statut, "publie"));
    return lignes.map((l) => l.id);
  }
  // Étudiant : cours de sa classe + inscriptions individuelles, publiés uniquement.
  const parClasse = u.classeId
    ? db.select({ id: coursClasses.coursId }).from(coursClasses).where(eq(coursClasses.classeId, u.classeId))
    : null;
  const individuels = db.select({ id: inscriptions.coursId }).from(inscriptions).where(eq(inscriptions.utilisateurId, u.id));
  const lignes = await db
    .select({ id: cours.id })
    .from(cours)
    .where(
      and(
        eq(cours.statut, "publie"),
        parClasse ? or(inArray(cours.id, parClasse), inArray(cours.id, individuels)) : inArray(cours.id, individuels),
      ),
    );
  return lignes.map((l) => l.id);
}

/** La personne peut-elle consulter ce cours ? */
export async function peutVoirCours(u: Utilisateur, coursId: number): Promise<boolean> {
  if (estEquipe(u)) {
    const perimetre = perimetreSites(u);
    if (!perimetre) return true;
    const sites = await sitesDuCours(coursId);
    return !sites.length || sites.some((s) => perimetre.includes(s));
  }
  const ids = await idsCoursAccessibles(u);
  return ids.includes(coursId);
}

/**
 * La personne enseigne-t-elle ce cours, ou peut-elle agir dessus comme
 * l'équipe (séances, devoirs, modération) ? La vie scolaire d'un campus ne le
 * peut que pour les cours suivis uniquement par son campus.
 */
export async function enseigneCours(u: Utilisateur, coursId: number): Promise<boolean> {
  if (estEquipe(u)) {
    const perimetre = perimetreSites(u);
    if (!perimetre) return true;
    const sites = await sitesDuCours(coursId);
    return sites.every((s) => perimetre.includes(s));
  }
  if (u.role !== "formateur") return false;
  const [c] = await db.select({ formateurId: cours.formateurId }).from(cours).where(eq(cours.id, coursId));
  if (!c) return false;
  if (c.formateurId === u.id) return true;
  const [co] = await db
    .select({ x: sql`1` })
    .from(coursFormateurs)
    .where(and(eq(coursFormateurs.coursId, coursId), eq(coursFormateurs.formateurId, u.id)));
  return Boolean(co);
}

/** Charge un cours visible par la personne, ou lève 404/403. */
export async function coursVisible(u: Utilisateur, coursId: number): Promise<Cours> {
  const [c] = await db.select().from(cours).where(eq(cours.id, coursId));
  if (!c) throw introuvable("Cours");
  if (!(await peutVoirCours(u, coursId))) {
    throw new ErreurHttp(403, u.role === "etudiant" ? "Tu n'es pas inscrit à ce cours." : "Ce cours ne fait pas partie de vos cours.");
  }
  return c;
}

/** Charge un cours que la personne enseigne, ou lève 404/403. */
export async function coursEnseigne(u: Utilisateur, coursId: number): Promise<Cours> {
  const [c] = await db.select().from(cours).where(eq(cours.id, coursId));
  if (!c) throw introuvable("Cours");
  if (!(await enseigneCours(u, coursId))) {
    throw new ErreurHttp(403, u.role === "etudiant" ? "Cette action est réservée au formateur du cours." : "Seul le formateur de ce cours peut faire cela.");
  }
  return c;
}

/** Étudiants inscrits à un cours (par leur classe ou individuellement). */
export async function etudiantsDuCours(coursId: number): Promise<Utilisateur[]> {
  return db
    .select()
    .from(utilisateurs)
    .where(
      and(
        eq(utilisateurs.role, "etudiant"),
        eq(utilisateurs.actif, true),
        or(
          inArray(utilisateurs.classeId, db.select({ id: coursClasses.classeId }).from(coursClasses).where(eq(coursClasses.coursId, coursId))),
          inArray(utilisateurs.id, db.select({ id: inscriptions.utilisateurId }).from(inscriptions).where(eq(inscriptions.coursId, coursId))),
        ),
      ),
    );
}

/** Formateurs d'un cours (principal + co-formateurs). */
export async function formateursDuCours(coursId: number): Promise<Utilisateur[]> {
  const [c] = await db.select({ formateurId: cours.formateurId }).from(cours).where(eq(cours.id, coursId));
  const coIds = (await db.select({ id: coursFormateurs.formateurId }).from(coursFormateurs).where(eq(coursFormateurs.coursId, coursId))).map(
    (l) => l.id,
  );
  const ids = [...new Set([...(c?.formateurId ? [c.formateurId] : []), ...coIds])];
  if (!ids.length) return [];
  return db.select().from(utilisateurs).where(inArray(utilisateurs.id, ids));
}

/** Cours d'une séance live, avec contrôle d'accès. */
export async function seanceVisible(u: Utilisateur, seanceId: number) {
  const [s] = await db.select().from(seances).where(eq(seances.id, seanceId));
  if (!s) throw introuvable("Séance");
  await coursVisible(u, s.coursId);
  return s;
}

/** Devoir visible (publié pour les étudiants), avec contrôle d'accès. */
export async function devoirVisible(u: Utilisateur, devoirId: number) {
  const [d] = await db.select().from(devoirs).where(eq(devoirs.id, devoirId));
  if (!d) throw introuvable("Devoir");
  await coursVisible(u, d.coursId);
  if (u.role === "etudiant" && !d.publie) throw introuvable("Devoir");
  return d;
}
