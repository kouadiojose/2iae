// Attribution automatique des classes d'un cours (21 novembre 2026, José : « les étudiants de Licence n'ont pas accès
// aux cours qui leur ont été faits. L'IA doit repérer de quelle classe il s'agit et l'attribuer tout de suite »).
//
// Un étudiant ne voit un cours que si sa classe y est rattachée (cours_classes). Un cours créé par un formateur sans
// cocher de classe, ou fait pour les Licences mais rattaché aux seuls BTS, restait invisible pour eux. Cette tâche
// passe au démarrage puis toutes les dix minutes :
//   1. elle lit le titre, le code, la description du cours et les titres de ses séances, et y repère les classes
//      nommées (« Licence 3 », « L3 », « 2BTS », « BTS 1 », « BTS »…) ;
//   2. cours sans aucune classe : elle rattache les classes repérées (tous les campus) ; rien de repéré : elle demande
//      à l'IA (titre, description, séances) ; le cours en brouillon qui a des séances est publié ;
//   3. cours qui nomme une Licence (ou un BTS) sans aucune classe de ce niveau : elle ajoute ces classes.
// Elle ajoute, elle ne retire jamais. Chaque rattachement est écrit au journal, et les nouveaux étudiants sont
// prévenus. Le compte rendu part dans le journal du serveur (« [classes-cours] »).
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { classes, cours, coursClasses, inscriptions, journal, seances, utilisateurs } from "@shared/schema";
import { etudiantsDuCours } from "./acces";
import { notifier } from "./notifications";
import { demanderJson, iaDisponible } from "./ia";
import { planifier } from "./taches";

/** « Licence 3 » → « L3 », « 1BTS » et « BTS 1 » → « BTS1 » ; autre niveau (Certificat…) : null. */
export function cleNiveau(niveau: string): string | null {
  const l = /licence\s*([123])/i.exec(niveau) ?? /^L\s*([123])$/i.exec(niveau.trim());
  if (l) return `L${l[1]}`;
  const b = /([12])\s*BTS/i.exec(niveau) ?? /BTS\s*([12])/i.exec(niveau);
  if (b) return `BTS${b[1]}`;
  return null;
}

/** Les niveaux nommés dans un texte : « cours des L3 », « Licence 3 », « 2e année BTS », « BTS » (les deux années). */
export function niveauxNommes(texte: string): Set<string> {
  const t = texte.normalize("NFD").replace(/\p{M}/gu, "");
  const cles = new Set<string>();
  for (const m of t.matchAll(/\blicences?\s*(?:pro(?:fessionnelles?)?\s*)?([123])\b/gi)) cles.add(`L${m[1]}`);
  for (const m of t.matchAll(/\bL\s?([123])\b/g)) cles.add(`L${m[1]}`);
  for (const m of t.matchAll(/\b([12])\s*(?:e|re|ere|eme|nde)?\s*(?:annees?\s*(?:de\s*)?)?BTS\b/gi)) cles.add(`BTS${m[1]}`);
  for (const m of t.matchAll(/\bBTS\s*([12])\b/gi)) cles.add(`BTS${m[1]}`);
  // « Licence » sans chiffre : toutes les licences ; « BTS » sans chiffre : les deux années.
  if (![...cles].some((c) => c.startsWith("L")) && /\blicences?\b|\bLP\b|\bLIC\b/i.test(t)) cles.add("L*");
  if (![...cles].some((c) => c.startsWith("BTS")) && /\bBTS\b/i.test(t)) cles.add("BTS*");
  return cles;
}

const correspond = (cle: string | null, voulues: Set<string>) => Boolean(cle && (voulues.has(cle) || (cle.startsWith("L") && voulues.has("L*")) || (cle.startsWith("BTS") && voulues.has("BTS*"))));

async function demanderALIa(c: { code: string; titre: string; description: string }, titresSeances: string[], formateur: string | null): Promise<Set<string>> {
  if (!iaDisponible()) return new Set();
  try {
    const r = await demanderJson<{ niveaux: string[] }>({
      systeme:
        "Tu ranges les cours d'une école (Groupe 2IAE, Côte d'Ivoire) dans les classes qui doivent les suivre. Réponds par les niveaux concernés parmi : BTS1, BTS2, L1, L2, L3. " +
        "Ne réponds un niveau que si le cours le nomme ou le désigne clairement (« licence », « L3 », « 2e année BTS », « BTS »…). Dans le doute, réponds une liste vide.",
      messages: [{ role: "user", content: `Cours ${c.code} : ${c.titre}\nDescription : ${c.description.slice(0, 1500) || "(aucune)"}\nSéances : ${titresSeances.slice(0, 20).join(" ; ") || "(aucune)"}\nFormateur : ${formateur ?? "(inconnu)"}` }],
      schema: { type: "object", properties: { niveaux: { type: "array", items: { type: "string", enum: ["BTS1", "BTS2", "L1", "L2", "L3"] } } }, required: ["niveaux"], additionalProperties: false },
      maxTokens: 200,
    });
    return new Set(r.niveaux ?? []);
  } catch (e) {
    console.warn(`[classes-cours] IA indisponible pour ${c.code} :`, (e as Error).message);
    return new Set();
  }
}

let premierPassage = true;

export async function attribuerClassesDesCours(): Promise<void> {
  const [derniere] = await db.select({ annee: sql<string | null>`max(${classes.anneeScolaire})` }).from(classes);
  if (!derniere?.annee) return;
  const toutes = await db.select().from(classes).where(eq(classes.anneeScolaire, derniere.annee));
  const effectifs = await db
    .select({ classeId: utilisateurs.classeId, n: sql<number>`count(*)::int` })
    .from(utilisateurs)
    .where(and(eq(utilisateurs.role, "etudiant"), eq(utilisateurs.actif, true)))
    .groupBy(utilisateurs.classeId);
  const effectifDe = new Map(effectifs.map((e) => [e.classeId, e.n]));
  const liste = await db.select().from(cours).where(ne(cours.statut, "archive"));
  const depuis = new Date(Date.now() - 90 * 86_400_000);

  for (const c of liste) {
    const liees = await db.select({ classeId: coursClasses.classeId }).from(coursClasses).where(eq(coursClasses.coursId, c.id));
    const lieesIds = new Set(liees.map((l) => l.classeId));
    const [{ n: inscrits }] = await db.select({ n: sql<number>`count(*)::int` }).from(inscriptions).where(eq(inscriptions.coursId, c.id));
    const sc = await db.select({ titre: seances.titre }).from(seances).where(and(eq(seances.coursId, c.id), gte(seances.debut, depuis))).orderBy(desc(seances.debut)).limit(40);
    const clesLiees = new Set(toutes.filter((cl) => lieesIds.has(cl.id)).map((cl) => cleNiveau(cl.niveau)).filter(Boolean) as string[]);
    // Le titre, le code et les titres des séances seulement : une description qui évoque « la licence après le BTS »
    // ne désigne pas une classe.
    const texte = [c.code, c.titre, ...sc.map((s) => s.titre)].join("\n");
    let nommes = niveauxNommes(texte);
    const sansClasse = lieesIds.size === 0 && inscrits === 0;

    if (premierPassage) {
      const etudiants = lieesIds.size ? toutes.filter((cl) => lieesIds.has(cl.id)).reduce((t, cl) => t + (effectifDe.get(cl.id) ?? 0), 0) : 0;
      console.log(`[classes-cours] ${c.code} « ${c.titre} » (${c.statut}) · ${sc.length} séance(s) · classes : ${[...clesLiees].sort().join(", ") || "aucune"} (${lieesIds.size}, ${etudiants} étudiants) · nomme : ${[...nommes].join(", ") || "rien"}`);
    }

    let parIa = false;
    if (sansClasse && !nommes.size && (sc.length > 0 || c.statut === "publie")) {
      const [f] = c.formateurId ? await db.select({ prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(eq(utilisateurs.id, c.formateurId)) : [];
      nommes = await demanderALIa(c, sc.map((s) => s.titre), f ? `${f.prenom} ${f.nom}` : null);
      parIa = nommes.size > 0;
    }
    if (!nommes.size) {
      if (sansClasse && sc.length > 0 && premierPassage) console.warn(`[classes-cours] ${c.code} : aucune classe, et rien ne dit pour qui est ce cours. À attribuer à la main (Mes cours, « Pour qui ? »).`);
      continue;
    }
    // Familles nommées qui n'ont encore aucune classe sur le cours (Licence nommée, aucune licence rattachée…).
    const manquantes = new Set<string>();
    for (const cle of nommes) {
      const famille = cle.startsWith("L") ? "L" : "BTS";
      const dejaLa = [...clesLiees].some((x) => (cle.endsWith("*") ? x.startsWith(famille) : x === cle));
      if (!dejaLa) manquantes.add(cle);
    }
    if (!manquantes.size) continue;
    const aAjouter = toutes.filter((cl) => !lieesIds.has(cl.id) && correspond(cleNiveau(cl.niveau), manquantes));
    if (!aAjouter.length) continue;

    const avant = new Set((await etudiantsDuCours(c.id)).map((e) => e.id));
    await db.transaction(async (tx) => {
      await tx.insert(coursClasses).values(aAjouter.map((cl) => ({ coursId: c.id, classeId: cl.id }))).onConflictDoNothing();
      if (c.statut === "brouillon" && sc.length > 0) await tx.update(cours).set({ statut: "publie", majLe: new Date() }).where(eq(cours.id, c.id));
      await tx.insert(journal).values({ utilisateurId: null, action: "cours_classes_auto", details: { coursId: c.id, code: c.code, niveaux: [...manquantes], classes: aAjouter.map((cl) => cl.id), parIa } });
    });
    const nouveaux = (await etudiantsDuCours(c.id)).filter((e) => !avant.has(e.id)).map((e) => e.id);
    const publie = c.statut === "publie" || sc.length > 0;
    if (publie && nouveaux.length) {
      await notifier(nouveaux, { type: "cours", titre: `Nouveau cours : ${c.titre}`, corps: `Le cours ${c.code} est ouvert pour ta classe : leçons, séances et replays t'attendent.`, lien: `/cours/${c.id}` });
    }
    console.log(`[classes-cours] ${c.code} « ${c.titre} » : ${aAjouter.length} classe(s) ajoutée(s) (${[...manquantes].join(", ")}${parIa ? ", repéré par l'IA" : ""}), ${nouveaux.length} étudiant(s) de plus${c.statut === "brouillon" && sc.length > 0 ? ", cours publié" : ""}.`);
  }
  premierPassage = false;
}

planifier("classes-des-cours", 10 * 60_000, attribuerClassesDesCours);
