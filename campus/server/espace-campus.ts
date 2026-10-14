// Outils de l'espace du campus (routes/espace-campus.ts) et de l'accueil à trois blocs du formateur
// (routes/accueil.ts : /api/enseigner/accueil-simple) : la « séance du moment » de chaque cours, en deux requêtes.
//
// Séance du moment d'un cours, hors essais de visio (direct immédiat sans étudiants prévenus), dans l'ordre :
//   1. la séance en direct (deux : d'abord celle dont le cours a commencé, puis la plus anciennement démarrée) ;
//   2. sinon, la plus proche séance prévue pas finie (aujourd'hui seulement pour le campus) ;
//   3. campus : sinon, la dernière séance d'aujourd'hui terminée ou annulée (« fini », « annulé ») ;
//   4. sinon, aucune ; `prochaine` = la première séance prévue après aujourd'hui (campus), ou plus tard (formateur).
// Deux séances du même cours à la même heure (deux sessions) : `choix` les donne toutes les deux, la personne choisit.
// Une classe en direct FINIE que personne n'anime plus (`finieSansAnimateur`, routes/live.ts) ne cache pas la séance
// suivante du même cours dans l'heure qui précède son début : la salle voit le bon cours (son compte à rebours, son code
// de présence) et le formateur ouvre la bonne séance ; la classe finie se ferme toute seule (fermerLesClassesVides).
import { and, asc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "./db";
import { seances, type Seance } from "@shared/schema";
import { AVANCE_MAX_OUVERTURE_MIN, classeOuverteEnAvance, debutDuCours } from "@shared/ouverture";
import { heureSimple, type RepereCarre } from "@shared/espace-campus";

const MINUTE = 60_000;
const JOUR = 86_400_000;
/** La séance suivante du même cours passe devant une classe finie dans l'heure qui précède son début. */
const AVANCE_OUVERTURE_MS = AVANCE_MAX_OUVERTURE_MIN * MINUTE;

export type MomentCours = {
  /** La séance à montrer (null : aucune aujourd'hui pour le campus, aucune à venir pour le formateur). */
  seance: Seance | null;
  /** Deux séances du même cours à la même heure : toutes, pour choisir (null sinon). */
  choix: Seance[] | null;
  /** Prochaine séance prévue après la journée (campus) ou après la séance du moment (formateur). */
  prochaine: Seance | null;
  /** Séances du cours en direct en ce moment (pour « jamais deux séances du même cours en direct »). */
  enDirect: Seance[];
};

export const finPrevueMs = (s: Pick<Seance, "debut" | "dureeMinutes">) => s.debut.getTime() + s.dureeMinutes * MINUTE;

/** Début (UTC = Abidjan) du jour de cet instant. */
export const debutDuJour = (t: number) => Math.floor(t / JOUR) * JOUR;

const sansEssai = sql`NOT EXISTS (SELECT 1 FROM campus.directs_immediats dx WHERE dx.seance_id = ${seances.id} AND NOT dx.prevenir)`;

/**
 * Séance du moment de chaque cours (règle en tête du fichier). `jour` : le campus regarde la journée d'Abidjan
 * (une séance prévue demain n'est pas « aujourd'hui ») ; le formateur regarde sans limite de jour.
 */
export async function seancesDuMoment(
  coursIds: number[],
  maintenant: number,
  { jour = true, finieSansAnimateur }: { jour?: boolean; finieSansAnimateur?: (s: Seance) => Promise<boolean> } = {},
): Promise<Map<number, MomentCours>> {
  const carte = new Map<number, MomentCours>();
  const ids = [...new Set(coursIds)];
  if (!ids.length) return carte;
  const d0 = new Date(debutDuJour(maintenant));
  const d1 = new Date(debutDuJour(maintenant) + JOUR);
  const t = new Date(maintenant).toISOString();
  const [lignes, suivantes] = await Promise.all([
    db
      .select()
      .from(seances)
      .where(
        and(
          inArray(seances.coursId, ids),
          sansEssai,
          jour ? or(eq(seances.statut, "en_direct"), and(gte(seances.debut, d0), lt(seances.debut, d1))) : eq(seances.statut, "en_direct"),
        ),
      )
      .orderBy(asc(seances.debut), asc(seances.id)),
    // Prochaine séance prévue pas finie de chaque cours : après la journée (campus), ou dès maintenant (formateur).
    db
      .selectDistinctOn([seances.coursId])
      .from(seances)
      .where(
        and(
          inArray(seances.coursId, ids),
          eq(seances.statut, "planifiee"),
          sansEssai,
          jour ? gte(seances.debut, d1) : sql`${seances.debut} + make_interval(mins => ${seances.dureeMinutes}) > ${t}::timestamptz`,
        ),
      )
      .orderBy(seances.coursId, asc(seances.debut), asc(seances.id)),
  ]);
  const suivante = new Map(suivantes.map((s) => [s.coursId, s]));
  for (const id of ids) {
    const siennes = lignes.filter((s) => s.coursId === id);
    const enDirect = siennes
      .filter((s) => s.statut === "en_direct")
      .sort(
        (a, b) =>
          Number(debutDuCours(a).getTime() > maintenant) - Number(debutDuCours(b).getTime() > maintenant) ||
          (a.demarreeLe?.getTime() ?? 0) - (b.demarreeLe?.getTime() ?? 0) ||
          a.id - b.id,
      );
    const prevues = siennes.filter((s) => s.statut === "planifiee" && finPrevueMs(s) > maintenant);
    let seance: Seance | null = enDirect[0] ?? null;
    let prochaine: Seance | null = jour ? (suivante.get(id) ?? null) : null;
    if (seance && finieSansAnimateur) {
      const enCours = seance;
      const apres = (jour ? prevues : [suivante.get(id)].filter((x): x is Seance => Boolean(x))).find(
        (p) => p.debut.getTime() > enCours.debut.getTime() && p.debut.getTime() - AVANCE_OUVERTURE_MS <= maintenant,
      );
      if (apres && (await finieSansAnimateur(enCours))) seance = apres;
    }
    if (!seance) {
      if (jour) {
        seance = prevues[0] ?? null;
        if (!seance) {
          const passees = siennes.filter((s) => s.statut === "terminee" || s.statut === "annulee");
          seance = passees[passees.length - 1] ?? null;
        }
      } else {
        seance = suivante.get(id) ?? null;
      }
    }
    // Deux séances du même cours à la même heure (deux sessions), en direct ou prévues : la personne choisit.
    const memeHeure = seance && (seance.statut === "en_direct" || seance.statut === "planifiee")
      ? [...enDirect, ...prevues].filter((s, i, tous) => s.debut.getTime() === seance!.debut.getTime() && tous.findIndex((x) => x.id === s.id) === i)
      : [];
    if (!jour && seance && !prochaine) prochaine = seance;
    carte.set(id, { seance, choix: memeHeure.length >= 2 ? memeHeure.sort((a, b) => a.id - b.id) : null, prochaine, enDirect });
  }
  return carte;
}

/** Repère d'un carré (campus) : en direct (cours commencé), classe ouverte avant l'heure, prévu aujourd'hui, ou rien. */
export function repereDe(s: Seance | null, maintenant: number): { repere: RepereCarre; heure: string | null } {
  if (!s) return { repere: null, heure: null };
  const heure = heureSimple(s.debut);
  if (s.statut === "en_direct") {
    if (classeOuverteEnAvance(s, maintenant)) return { repere: "ouvert", heure };
    return { repere: "direct", heure };
  }
  if (s.statut === "planifiee" && finPrevueMs(s) > maintenant && debutDuJour(s.debut.getTime()) === debutDuJour(maintenant)) return { repere: "aujourdhui", heure };
  return { repere: null, heure: null };
}

/** Ordre des carrés : en direct, puis ouvert, puis aujourd'hui (par heure), puis les autres (par titre). */
export function trierCarres<T extends { repere: RepereCarre; titre: string }>(liste: T[], heureDe: (c: T) => number): T[] {
  const rang = (r: RepereCarre) => (r === "direct" ? 0 : r === "ouvert" ? 1 : r === "aujourdhui" ? 2 : 3);
  return [...liste].sort((a, b) => rang(a.repere) - rang(b.repere) || (a.repere && b.repere ? heureDe(a) - heureDe(b) : 0) || a.titre.localeCompare(b.titre, "fr"));
}
