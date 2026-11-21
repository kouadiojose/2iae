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
import { and, eq, gte, ilike, lt, sql } from "drizzle-orm";
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
const CRENEAUX: Creneau[] = [
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

export async function tenirEmploiDuTemps(): Promise<void> {
  const maintenant = Date.now();
  const auj = new Date().toISOString().slice(0, 10);
  if (auj > FIN_INDUSTRIEL) return;
  await coursCe();
  const parCode = new Map((await db.select().from(cours)).map((c) => [c.code, c]));
  let creees = 0;
  for (let j = 0; j <= HORIZON_JOURS; j++) {
    const jour = new Date(maintenant + j * 86_400_000);
    const date = jour.toISOString().slice(0, 10);
    if (date < DEBUT || CONGES.some(([de, a]) => date >= de && date <= a)) continue;
    const numero = jour.getUTCDay(); // 0 = dimanche
    for (const cr of CRENEAUX) {
      if (cr.jour !== numero || date > cr.fin) continue;
      const c = parCode.get(cr.code);
      if (!c || c.statut === "archive") continue;
      const debut = new Date(`${date}T${cr.heure}:00Z`);
      if (debut.getTime() < maintenant + 30 * 60_000) continue;
      const [proche] = await db
        .select({ id: seances.id })
        .from(seances)
        .where(and(eq(seances.coursId, c.id), gte(seances.debut, new Date(debut.getTime() - 3 * 3600_000)), lt(seances.debut, new Date(debut.getTime() + 3 * 3600_000))))
        .limit(1);
      if (proche) continue;
      const [s] = await db
        .insert(seances)
        .values({ coursId: c.id, titre: cr.titre, description: "", debut, dureeMinutes: cr.minutes, fournisseur: visio.fournisseurImpose(), lienExterne: null, plan: [] })
        .returning({ id: seances.id });
      await db.insert(journal).values({ utilisateurId: null, action: "seance_emploi_du_temps", details: { seanceId: s.id, coursId: c.id, code: c.code, debut: debut.toISOString() } });
      creees++;
      console.log(`[emploi-du-temps] ${c.code} « ${cr.titre} » : séance du ${date} à ${cr.heure} créée.`);
    }
  }
  if (creees) console.log(`[emploi-du-temps] ${creees} séance(s) créée(s) pour les ${HORIZON_JOURS} prochains jours.`);
}

planifier("emploi-du-temps", 6 * 3600_000, tenirEmploiDuTemps);
