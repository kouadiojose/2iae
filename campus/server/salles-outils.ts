// Salles de conférence d'un campus (shared/salles.ts) : quel compte d'écran équipe quelle salle,
// et quels cours montre l'écran d'une salle selon son public (L1, L2, ou toutes les classes).
// Servi au live (routes/live.ts : choix du direct, séances du jour, temps réel), à l'installation
// des écrans (routes/lancement.ts) et au pilotage des salles (routes/salles.ts).
import { and, eq } from "drizzle-orm";
import { db, pool } from "./db";
import { classes, cours, coursClasses, utilisateurs, type Utilisateur } from "@shared/schema";
import { anneeDeClasse, estPublicSalle, nomDeSalle, salleMontreCours, type PublicSalle } from "@shared/salles";

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

/**
 * Cours publiés que suit un campus (une de ses classes y est rattachée) : ce que montre l'écran de sa salle.
 * Avec un public (salle L1 ou L2) : seulement ceux que suivent des classes de ce niveau, plus les cours
 * communs aux deux niveaux et ceux des autres niveaux (shared/salles.ts : salleMontreCours).
 */
export async function coursDuSite(siteId: number, publicSalle?: PublicSalle | null): Promise<number[]> {
  const annees = await anneesDesCoursDuSite(siteId);
  return [...annees.entries()].filter(([, a]) => salleMontreCours(publicSalle, a)).map(([id]) => id);
}

/**
 * Nom de la salle où ce cours se tient sur ce campus (confirmation d'émargement, dont le code vaut pour
 * le campus) : la seule salle équipée dont le public correspond ; sinon (une seule salle, ou plusieurs
 * qui le montrent, comme un cours commun) le nom de la salle du campus, comme avant.
 */
export async function nomSalleDuCours(site: { id: number; salleConference: string }, coursId: number): Promise<string> {
  const salles = (await sallesDuSite(site.id)).filter((s): s is { numero: number; compte: Utilisateur } => Boolean(s.compte));
  if (salles.length <= 1) return nomDeSalle(salles[0]?.compte, site);
  const annees = (await anneesDesCoursDuSite(site.id, coursId)).get(coursId) ?? new Set<PublicSalle | null>();
  const montrent = salles.filter((s) => salleMontreCours(publicDe(s.compte), annees));
  return montrent.length === 1 ? nomDeSalle(montrent[0].compte, site) : site.salleConference;
}
