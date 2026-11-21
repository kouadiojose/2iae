// Emploi du temps des cours en ligne, première session 2026-2027 (document du service des études du 7 novembre 2026 :
// « EMPLOI DU TEMPS COURS EN LIGNE », 2BTS Industriel, 2BTS Tertiaire, 1BTS ; du lundi 9 novembre 2026 au 13 février
// 2027, 20 février pour les 2BTS Industriel).
//
// Jusqu'ici, l'équipe créait chaque séance à la main, semaine après semaine. Cette tâche tient l'emploi du temps à
// jour toute seule : chaque jour, elle s'assure que les séances des 14 prochains jours existent, dans les cours que
// l'équipe utilise déjà (mêmes titres : « TEEO INDUSTRIEL », « TEEO TERTIAIRE »…).
//   - Jamais de doublon : une séance du même cours le même jour, à trois heures près, suffit (créée à la main,
//     déplacée, ou annulée : une séance annulée n'est pas recréée).
//   - Les après-midi commencent à 13 h 30, après la pause (12 h 30 - 13 h 30), comme les séances déjà tenues.
//   - Pas de cours pendant les congés de fin d'année (du 21 décembre au 3 janvier : à ajuster ici si le calendrier
//     de l'école diffère).
//   - Le cours « CE » des 2BTS RHCOM (M. Dianda, lundi matin) n'existait pas sur le campus : il est créé une fois.
// Heures d'Abidjan (GMT). Pour changer un créneau : ce tableau, puis une mise en ligne.
import { and, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { classes, cours, coursClasses, journal, seances, utilisateurs } from "@shared/schema";
import { planifier } from "./taches";
import * as visio from "./visio";

type Creneau = { jour: number; heure: string; minutes: number; code: string; titre: string; fin: string };
const FIN = "2027-02-13";
const FIN_INDUSTRIEL = "2027-02-20";
const DEBUT = "2026-11-09";
const CONGES: [string, string][] = [["2026-12-21", "2027-01-03"]];
const HORIZON_JOURS = 14;

/** jour : 1 = lundi … 6 = samedi. */
export const CRENEAUX: Creneau[] = [
  // 2BTS Industriel (ATPA, ATPV, GBAT), tous les sites
  { jour: 3, heure: "08:30", minutes: 240, code: "TEEO", titre: "TEEO INDUSTRIEL", fin: FIN_INDUSTRIEL },
  { jour: 3, heure: "13:30", minutes: 210, code: "AG-IND", titre: "ANGLAIS INDUSTRIEL", fin: FIN_INDUSTRIEL },
  // 2BTS Tertiaire (RHCOM, GEC)
  { jour: 1, heure: "08:30", minutes: 240, code: "CE-RHCOM", titre: "CE · 2BTS RHCOM", fin: FIN },
  { jour: 2, heure: "08:30", minutes: 240, code: "AP-001", titre: "Anglais 2BTS Tertiaire", fin: FIN },
  { jour: 2, heure: "13:30", minutes: 210, code: "TEEO", titre: "TEEO TERTIAIRE", fin: FIN },
  // 1BTS, toutes les filières, tous les sites
  { jour: 1, heure: "08:30", minutes: 240, code: "DR-01", titre: "Droit des affaires", fin: FIN },
  { jour: 1, heure: "13:30", minutes: 210, code: "AG", titre: "Anglais 1BTS", fin: FIN },
  { jour: 3, heure: "08:30", minutes: 240, code: "TEEO-2BTS", titre: "TEEO 1BTS", fin: FIN },
];

/** Le cours « CE » des 2BTS RHCOM (M. Dianda), créé une fois si les classes existent. */
async function coursCe(): Promise<void> {
  const [deja] = await db.select({ id: cours.id }).from(cours).where(eq(cours.code, "CE-RHCOM"));
  if (deja) return;
  const [annee] = await db.select({ a: sql<string | null>`max(${classes.anneeScolaire})` }).from(classes);
  if (!annee?.a) return;
  const rhcom = await db.select().from(classes).where(and(eq(classes.anneeScolaire, annee.a), eq(classes.niveau, "2BTS"), ilike(classes.filiere, "Ressources Humaines%")));
  if (!rhcom.length) return;
  const [dianda] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(and(eq(utilisateurs.role, "formateur"), eq(utilisateurs.actif, true), ilike(utilisateurs.nom, "Dianda")));
  await db.transaction(async (tx) => {
    const [c] = await tx.insert(cours).values({ code: "CE-RHCOM", titre: "CE · 2BTS RHCOM", slug: "ce-2bts-rhcom", formateurId: dianda?.id ?? null, statut: "publie" }).returning();
    await tx.insert(coursClasses).values(rhcom.map((cl) => ({ coursId: c.id, classeId: cl.id }))).onConflictDoNothing();
    await tx.insert(journal).values({ utilisateurId: null, action: "cours_cree", details: { coursId: c.id, code: c.code, emploiDuTemps: true, classes: rhcom.map((cl) => cl.id) } });
    console.log(`[emploi-du-temps] cours CE-RHCOM créé (${rhcom.length} classes de 2BTS RHCOM${dianda ? ", M. Dianda" : ", sans formateur"}).`);
  });
}

/**
 * 21 novembre 2026 (José) : sur le terrain, l'emploi du temps n'est pas respecté, les cours se décident le jour même.
 * Créer les séances d'avance envoyait aux étudiants des rappels pour des cours qui n'auraient pas lieu : la création
 * automatique est arrêtée, et les séances créées par elle qui n'ont pas commencé sont retirées (elles sont notées au
 * journal). Le tableau des créneaux reste : il servira de « proposition du jour » à confirmer d'un geste.
 */
export async function tenirEmploiDuTemps(): Promise<void> {
  const lignes = await db.select({ details: journal.details }).from(journal).where(eq(journal.action, "seance_emploi_du_temps"));
  const ids = lignes.map((l) => Number((l.details as { seanceId?: number } | null)?.seanceId)).filter((x) => Number.isInteger(x) && x > 0);
  if (!ids.length) return;
  const retirees = await db
    .delete(seances)
    .where(and(inArray(seances.id, ids), eq(seances.statut, "planifiee"), isNull(seances.demarreeLe)))
    .returning({ id: seances.id });
  if (retirees.length) {
    await db.insert(journal).values({ utilisateurId: null, action: "seances_emploi_du_temps_retirees", details: { seances: retirees.map((r) => r.id) } });
    console.log(`[emploi-du-temps] ${retirees.length} séance(s) créée(s) d'avance et jamais commencée(s) : retirée(s).`);
  }
}

planifier("emploi-du-temps", 24 * 3600_000, tenirEmploiDuTemps);
