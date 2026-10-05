// Devoirs préparés par le campus à partir du cours complet d'une séance :
// - une interrogation en QCM, notée automatiquement (correction détaillée
//   visible après la date limite) ;
// - un exercice pratique à rendre en photo de la copie, en fichier ou en
//   courte vidéo, corrigé par le formateur (grille et corrigé fournis pour
//   l'aide à la correction).
// Le formateur du cours en est l'auteur : il peut les modifier, les dépublier
// ou les supprimer comme les siens. DEVOIRS_AUTO=non coupe la fonction.
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { cours, devoirs, devoirsSeances, questionsQuiz, type CritereGrille, type Devoir, type DossierCours, type Seance } from "@shared/schema";
import { finEcheance } from "./evaluations-outils";
import { annoncerSiOuvert } from "./routes/evaluations";

const actif = () => process.env.DEVOIRS_AUTO?.trim() !== "non";
/** Pas de devoirs notés pour une séance de plus de deux semaines (cours complet préparé tard, ou refait). */
const AGE_MAX_MS = 14 * 24 * 3600_000;

/** Le jour J + n à 23 h 59, heure d'Abidjan (GMT). */
function dansJours(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(23, 59, 0, 0);
  return finEcheance(d);
}

const dateCourte = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Crée les deux devoirs de la séance ; renvoie leurs identifiants et les
 * corrigés réservés au formateur (aucun devoir si le cours n'est pas publié).
 * Les questions et l'exercice notés sont différents de ceux d'entraînement du
 * cours complet, que les étudiants voient avec leurs corrigés.
 */
export async function creerDevoirsDuCours(s: Seance, d: DossierCours): Promise<{ devoirIds: number[]; corriges: Record<string, string> }> {
  const vide = { devoirIds: [] as number[], corriges: {} as Record<string, string> };
  if (!actif() || Date.now() - new Date(s.debut).getTime() > AGE_MAX_MS) return vide;
  const [c] = await db.select().from(cours).where(eq(cours.id, s.coursId));
  if (!c || c.statut !== "publie") return vide;
  const corriges: Record<string, string> = {};
  const auteurId = c.formateurId ?? null;
  const jour = dateCourte(s.debut);

  // 1. QCM noté automatiquement : jamais les questions du quiz d'entraînement, dont les réponses sont visibles.
  const questions = (d.interrogation ?? []).filter((q) => q.options.length >= 2 && q.options.length <= 10 && q.bonneReponse >= 0 && q.bonneReponse < q.options.length).slice(0, 15);
  // 2. Exercice pratique à rendre (photo, fichier ou vidéo) : jamais un exercice d'entraînement, dont le corrigé est visible.
  const exercice = d.devoirPratique;

  // Les deux devoirs et les questions ensemble, ou rien ; les annonces partent après.
  const crees = await db.transaction(async (tx) => {
    const faits: Devoir[] = [];
    if (questions.length >= 5) {
      const [quiz] = await tx
        .insert(devoirs)
        .values({
          coursId: c.id,
          auteurId,
          type: "quiz",
          titre: `QCM : ${s.titre}`.slice(0, 200),
          consigne: `Interrogation sur le cours du ${jour} (${questions.length} questions, une seule bonne réponse par question). Ta note sur 20 est calculée automatiquement dès que tu valides ; la correction détaillée s'affiche après la date limite. Tu as droit à deux essais : la meilleure note compte.\n\nRévise d'abord le cours complet dans la médiathèque.\n\n_Interrogation préparée par le campus d'après l'enregistrement du cours._`,
          dateLimite: dansJours(7),
          bareme: 20,
          coefficient: 1,
          accepteRetard: false,
          dureeMinutes: Math.max(10, questions.length * 2),
          tentativesMax: 2,
          correctionVisible: true,
          publie: true,
        })
        .returning();
      await tx.insert(questionsQuiz).values(
        questions.map((q, i) => ({
          devoirId: quiz.id,
          type: "qcm" as const,
          enonce: q.question.slice(0, 2000),
          options: q.options.map((o) => o.slice(0, 500)),
          bonnesReponses: [q.bonneReponse],
          explication: q.explication.slice(0, 2000) || null,
          points: 1,
          ordre: i,
        })),
      );
      faits.push(quiz);
    }
    if (exercice) {
      // La grille est visible des étudiants : le corrigé reste à part, pour le formateur et l'aide à la correction.
      const grille: CritereGrille[] = [
        { critere: "Compréhension du sujet", points: 4, description: "Le sujet et les notions du cours sont compris et bien utilisés." },
        { critere: "Démarche et raisonnement", points: 8, description: "Les étapes sont logiques, expliquées et appuyées sur le cours." },
        { critere: "Exactitude des résultats", points: 6, description: "Les réponses sont justes et complètes." },
        { critere: "Présentation et clarté", points: 2, description: "Copie lisible, ordonnée, ou vidéo claire et audible." },
      ];
      const consigne = [
        `## ${exercice.titre}`,
        exercice.enonce,
        exercice.consignes.length ? `**Ce que tu dois faire :**\n${exercice.consignes.map((x) => `- ${x}`).join("\n")}` : "",
        "**Comment rendre ton travail :** prends ta copie en photo (page par page), dépose un fichier (PDF, Word, Excel…) ou filme une courte vidéo (3 minutes au plus) où tu expliques ta démarche. Tu peux mélanger.",
        `_Exercice préparé par le campus d'après le cours du ${jour}. Noté sur 20 par ton formateur._`,
      ]
        .filter(Boolean)
        .join("\n\n");
      const [depot] = await tx
        .insert(devoirs)
        .values({
          coursId: c.id,
          auteurId,
          type: "depot",
          titre: `Exercice : ${exercice.titre}`.slice(0, 200),
          consigne,
          dateLimite: dansJours(10),
          bareme: 20,
          coefficient: 1,
          accepteRetard: true,
          grille,
          publie: true,
        })
        .returning();
      corriges[String(depot.id)] = exercice.corrige.slice(0, 8000);
      faits.push(depot);
    }
    return faits;
  });
  for (const devoir of crees) {
    await annoncerSiOuvert(devoir, c).catch((e) => console.warn(`[devoirs auto] annonce du devoir ${devoir.id} :`, (e as Error).message));
  }
  return { devoirIds: crees.map((x) => x.id), corriges };
}

/** Corrigé réservé au formateur d'un devoir créé par le campus, s'il y en a un. */
export async function corrigeDuDevoir(devoirId: number): Promise<string | null> {
  const [l] = await db
    .select({ corriges: devoirsSeances.corriges })
    .from(devoirsSeances)
    .where(sql`${devoirsSeances.devoirIds} @> ${JSON.stringify([devoirId])}::jsonb`);
  return l?.corriges?.[String(devoirId)] ?? null;
}
