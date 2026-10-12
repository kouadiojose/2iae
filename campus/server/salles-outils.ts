// Salles de conférence d'un campus (shared/salles.ts) : quel compte d'écran équipe quelle salle,
// et quels cours montre l'écran d'une salle selon son public (L1, L2, ou toutes les classes).
// Servi au live (routes/live.ts : choix du direct, séances du jour, temps réel), à l'installation
// des écrans (routes/lancement.ts) et au pilotage des salles (routes/salles.ts).
import { and, eq } from "drizzle-orm";
import { db, pool } from "./db";
import { classes, cours, coursClasses, utilisateurs, type Utilisateur } from "@shared/schema";
import { anneeDeClasse, estPublicSalle, nomDeSalle, salleDuCours, type PublicSalle } from "@shared/salles";

/**
 * Un compte « salle » qui compte comme l'écran réel d'une salle : jamais un compte de la démonstration (ses
 * cinq écrans fictifs sont semés « installés » et « vus » récemment, et la purge les supprime), sauf si un
 * vrai écran y a été installé avant que l'installation ne crée toujours un compte réel (la purge le garde alors).
 */
export const ECRAN_REEL = (e: string) =>
  `(coalesce(${e}.preferences->>'demo', 'false') <> 'true' OR EXISTS (SELECT 1 FROM campus.journal j WHERE j.action = 'ecran_installe' AND j.utilisateur_id = ${e}.id))`;

/** Public de l'écran d'une salle (null : toutes les classes, comme avant les salles). */
export const publicDe = (u: Pick<Utilisateur, "role" | "sallePublic"> | null | undefined): PublicSalle | null =>
  u?.role === "salle" && estPublicSalle(u.sallePublic) ? u.sallePublic : null;

/**
 * Le compte de l'écran de la salle n d'un campus. Salle 1 : celui qui porte le numéro 1, sinon l'écran
 * d'avant les salles le plus récemment vu (la règle d'avant, inchangée). Salles 2 et suivantes : le
 * compte créé par « Ajouter une salle ».
 */
export async function compteEcranSalle(siteId: number, numero = 1): Promise<Utilisateur | null> {
  const { rows } =
    numero === 1
      ? await pool.query<{ id: number }>(
          `SELECT e.id FROM campus.utilisateurs e
            WHERE e.role = 'salle' AND e.site_id = $1 AND e.actif AND ${ECRAN_REEL("e")} AND (e.salle_numero IS NULL OR e.salle_numero = 1)
            ORDER BY (e.salle_numero IS NOT NULL) DESC, (NOT e.doit_changer_mot_de_passe) DESC, e.derniere_connexion DESC NULLS LAST, e.id LIMIT 1`,
          [siteId],
        )
      : await pool.query<{ id: number }>(`SELECT e.id FROM campus.utilisateurs e WHERE e.role = 'salle' AND e.site_id = $1 AND e.actif AND e.salle_numero = $2 LIMIT 1`, [
          siteId,
          numero,
        ]);
  if (!rows[0]) return null;
  const [u] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, rows[0].id));
  return u ?? null;
}

/** Les salles d'un campus dans l'ordre : la salle 1 (compte null si son écran n'a jamais été préparé), puis les salles ajoutées. */
export async function sallesDuSite(siteId: number): Promise<{ numero: number; compte: Utilisateur | null }[]> {
  const [premiere, ajoutees] = await Promise.all([
    compteEcranSalle(siteId, 1),
    db
      .select()
      .from(utilisateurs)
      .where(and(eq(utilisateurs.role, "salle"), eq(utilisateurs.siteId, siteId), eq(utilisateurs.actif, true))),
  ]);
  const autres = ajoutees.filter((u) => (u.salleNumero ?? 0) >= 2).sort((a, b) => (a.salleNumero ?? 0) - (b.salleNumero ?? 0));
  return [{ numero: 1, compte: premiere }, ...autres.map((u) => ({ numero: u.salleNumero as number, compte: u }))];
}

/** Années (L1, L2, ou null pour un autre niveau) des classes de ce campus qui suivent chaque cours publié. */
export async function anneesDesCoursDuSite(siteId: number, coursId?: number): Promise<Map<number, Set<PublicSalle | null>>> {
  const conditions = [eq(classes.siteId, siteId), eq(cours.statut, "publie")];
  if (coursId) conditions.push(eq(coursClasses.coursId, coursId));
  const lignes = await db
    .selectDistinct({ coursId: coursClasses.coursId, niveau: classes.niveau, nom: classes.nom })
    .from(coursClasses)
    .innerJoin(classes, eq(classes.id, coursClasses.classeId))
    .innerJoin(cours, eq(cours.id, coursClasses.coursId))
    .where(and(...conditions));
  const carte = new Map<number, Set<PublicSalle | null>>();
  for (const l of lignes) {
    const a = carte.get(l.coursId) ?? new Set<PublicSalle | null>();
    a.add(anneeDeClasse(l));
    carte.set(l.coursId, a);
  }
  return carte;
}

/** Une salle d'un campus et son écran (compte null : salle 1 dont l'écran n'a jamais été préparé). */
export type SalleDuSite = { numero: number; compte: Utilisateur | null; public: PublicSalle | null };

/**
 * Répartition des cours d'un campus entre ses salles (shared/salles.ts : salleDuCours), relue en base à
 * chaque appel : le nom et le public des salles sont toujours ceux du moment, même pour un écran resté
 * connecté pendant qu'on réglait sa salle.
 */
export async function repartitionDuSite(siteId: number): Promise<{
  salles: SalleDuSite[];
  annees: Map<number, Set<PublicSalle | null>>;
  /** Cours → numéro de la salle qui le montre (null : aucune salle ne convient). */
  salleDe: Map<number, number | null>;
}> {
  const [liste, annees] = await Promise.all([sallesDuSite(siteId), anneesDesCoursDuSite(siteId)]);
  const salles = liste.map((x) => ({ ...x, public: publicDe(x.compte) }));
  const salleDe = new Map<number, number | null>();
  for (const [id, a] of annees) salleDe.set(id, salleDuCours(salles, a));
  return { salles, annees, salleDe };
}

/** Salle regardée : celle d'un écran (son compte), ou, pour l'équipe sur /salle?site=, la première salle d'un public. */
export type RegardSalle = { compteId?: number | null; public?: PublicSalle | null };

/**
 * Cours publiés que suit un campus (une de ses classes y est rattachée). Sans salle précisée : tous (le code
 * d'émargement vaut pour le campus). Pour l'écran d'une salle : seulement les cours qui se tiennent dans
 * cette salle. Un écran qui n'est la salle de personne (ancien compte d'écran en double) garde la règle
 * d'avant : tous les cours du campus.
 */
export async function coursDuSite(siteId: number, regard?: RegardSalle | null): Promise<number[]> {
  if (!regard || (!regard.compteId && !regard.public)) return [...(await anneesDesCoursDuSite(siteId)).keys()];
  const { salles, salleDe } = await repartitionDuSite(siteId);
  const salle = regard.compteId ? salles.find((x) => x.compte?.id === regard.compteId) : salles.find((x) => x.public === regard.public);
  if (!salle) return [...salleDe.keys()];
  return [...salleDe.entries()].filter(([, n]) => n === salle.numero).map(([id]) => id);
}

/** Nom de la salle où ce cours se tient sur ce campus (confirmation d'émargement, Studio). */
export async function nomSalleDuCours(site: { id: number; salleConference: string }, coursId: number): Promise<string> {
  const { salles, salleDe } = await repartitionDuSite(site.id);
  const n = salleDe.get(coursId);
  const salle = salles.find((x) => x.numero === n);
  // Aucune salle qui convienne : le nom de la salle du campus, comme avant.
  return salle ? nomDeSalle(salle.compte, site) : site.salleConference;
}
