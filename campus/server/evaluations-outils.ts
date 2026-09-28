// Outils du module évaluations : reçus de dépôt, correction automatique des
// interrogations, fin des tentatives. Certains servent à d'autres modules
// (interrogationEnCours met l'assistant IA en pause).
import crypto from "crypto";
import { and, asc, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { publierUtilisateur } from "./temps-reel";
import {
  devoirs,
  rendus,
  questionsQuiz,
  tentativesQuiz,
  type Devoir,
  type QuestionQuiz,
  type TentativeQuiz,
  type QuestionCorrigee,
} from "@shared/schema";

/** Marge accordée après la fin du chrono pour les réponses parties juste avant une coupure. */
export const MARGE_QUIZ_MS = 2 * 60_000;

// ── Reçus de dépôt ─────────────────────────────────────────────────────────

/** Alphabet lisible au téléphone : sans 0/O ni 1/I. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Fonction de tour du réseau de Feistel : HMAC du sel sur (tour, moitié). */
function tour(n: number, moitie: number): number {
  const h = crypto.createHmac("sha256", `recu-2iae:${config.sessionSecret}`).update(`${n}:${moitie}`).digest();
  return h.readUInt16BE(0) & 0x3ff;
}

/**
 * Numéro de reçu « 2IAE-4F7K » d'un rendu : stable (dérivé de l'identifiant
 * et d'un sel), impossible à deviner d'un rendu à l'autre, et UNIQUE — une
 * permutation de Feistel sur 20 bits transforme l'identifiant sans collision
 * (au-delà d'un million de rendus, le numéro prend un caractère de plus).
 */
export function recuPour(id: number): string {
  const bas = id & 0xfffff;
  let g = bas >> 10;
  let d = bas & 0x3ff;
  for (let n = 0; n < 4; n++) [g, d] = [d, g ^ tour(n, d)];
  let v = (g << 10) | d;
  let s = "";
  for (let i = 0; i < 4; i++) {
    s = ALPHABET[v & 31] + s;
    v >>= 5;
  }
  const haut = Math.floor(id / 0x100000);
  return `2IAE-${haut ? haut.toString(32).toUpperCase() : ""}${s}`;
}

// ── Correction automatique ─────────────────────────────────────────────────

/** « Côte d'Ivoire » → « cote d ivoire » : sans accents, sans casse, espaces réduits. */
export function normaliserReponse(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, " ")
    .replace(/[^\p{L}\p{N}.,+\-/%]+/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,]+|[\s.,]+$/g, "")
    .trim();
}

/** « 2,5 », « 2.5 », « 1 500 » → nombre (sinon null). */
function commeNombre(s: string): number | null {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

const indices = (r: (number | string)[] | null | undefined) =>
  [...new Set((r ?? []).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0))].sort((a, b) => a - b);

/** Corrige une question : tout ou rien (les choix multiples doivent être exactement les bons). */
export function corrigerQuestion(q: Pick<QuestionQuiz, "type" | "bonnesReponses" | "points">, reponse: (number | string)[] | null | undefined) {
  let juste = false;
  if (q.type === "reponse_courte") {
    const donnee = String(reponse?.[0] ?? "");
    const n = normaliserReponse(donnee);
    if (n) {
      juste = q.bonnesReponses.some((attendue) => {
        const a = String(attendue);
        const na = commeNombre(a);
        const nd = commeNombre(donnee);
        if (na !== null && nd !== null) return Math.abs(na - nd) < 1e-9;
        return normaliserReponse(a) === n;
      });
    }
  } else {
    const donnees = indices(reponse);
    const attendues = indices(q.bonnesReponses);
    if (q.type === "choix_multiple") juste = donnees.length > 0 && donnees.length === attendues.length && donnees.every((x, i) => x === attendues[i]);
    else juste = donnees.length === 1 && attendues.includes(donnees[0]);
  }
  return { juste, obtenu: juste ? q.points : 0 };
}

const arrondi = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Corrige une tentative entière ; note ramenée au barème du devoir. */
export function corrigerTentative(questions: QuestionQuiz[], reponses: TentativeQuiz["reponses"], bareme: number) {
  let score = 0;
  let total = 0;
  const detail: QuestionCorrigee[] = questions.map((q) => {
    const maReponse = reponses[String(q.id)] ?? null;
    const { juste, obtenu } = corrigerQuestion(q, maReponse);
    score += obtenu;
    total += q.points;
    return {
      id: q.id,
      type: q.type,
      enonce: q.enonce,
      options: q.options,
      points: q.points,
      bonnesReponses: q.bonnesReponses,
      explication: q.explication,
      maReponse,
      juste,
      obtenu,
    };
  });
  const note = total > 0 ? arrondi((score / total) * bareme) : 0;
  return { score: arrondi(score), total: arrondi(total), note, detail };
}

// ── Échéances ──────────────────────────────────────────────────────────────

/**
 * Règle de l'échéance « avant 23h59 » : une date limite saisie à la minute
 * près (secondes et millisecondes nulles) sur une minute 59 — 23:59, 17:59… —
 * court jusqu'à la FIN de cette minute, hh:59:59.999. Une copie reçue à
 * 23 h 59 min 30 s est donc à l'heure. Les autres échéances (10:00, 17:30…)
 * restent exactes : « avant 10h00 » s'arrête à 10:00:00.000.
 *
 * Les échéances sont enregistrées ainsi à la saisie (création et modification
 * d'un devoir) ; la règle est aussi appliquée à la lecture (echeance) pour
 * celles enregistrées à hh:59:00.000 avant elle. Idempotente.
 */
export function finEcheance(date: Date): Date {
  if (date.getUTCMinutes() === 59 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0) return new Date(date.getTime() + 59_999);
  return date;
}

/** Échéance effective d'un devoir (voir finEcheance) : c'est elle qui décide du retard et de la clôture. */
export const echeance = (d: Pick<Devoir, "dateLimite">) => finEcheance(d.dateLimite);

// ── Tentatives ─────────────────────────────────────────────────────────────

/** Fin d'une tentative commencée maintenant : durée du quiz, plafonnée à la date limite. */
export function finPrevuePour(d: Pick<Devoir, "dureeMinutes" | "dateLimite">, debut: Date): Date {
  const limite = echeance(d).getTime();
  const parDuree = d.dureeMinutes ? debut.getTime() + d.dureeMinutes * 60_000 : limite;
  return new Date(Math.min(parDuree, limite));
}

/** Fin effective d'une tentative (les anciennes lignes sans fin prévue sont recalculées). */
export const finDe = (t: Pick<TentativeQuiz, "finPrevueLe" | "debutLe">, d: Pick<Devoir, "dureeMinutes" | "dateLimite">) =>
  t.finPrevueLe ?? finPrevuePour(d, t.debutLe);

/**
 * Interrogation (quiz) en cours pour cet étudiant : tentative non terminée
 * dont le temps n'est pas écoulé. L'assistant IA se met en pause tant
 * qu'elle existe.
 */
export async function interrogationEnCours(etudiantId: number): Promise<{ devoirId: number; coursId: number } | null> {
  const lignes = await db
    .select({ t: tentativesQuiz, d: devoirs })
    .from(tentativesQuiz)
    .innerJoin(devoirs, eq(devoirs.id, tentativesQuiz.devoirId))
    .where(and(eq(tentativesQuiz.etudiantId, etudiantId), isNull(tentativesQuiz.finLe)));
  const maintenant = Date.now();
  const enCours = lignes.find((l) => finDe(l.t, l.d).getTime() + MARGE_QUIZ_MS > maintenant);
  return enCours ? { devoirId: enCours.d.id, coursId: enCours.d.coursId } : null;
}

/** Meilleure note des tentatives terminées d'un étudiant (null s'il n'en a aucune). */
export async function meilleureNoteQuiz(devoirId: number, etudiantId: number): Promise<{ note: number | null; premiere: Date | null; faites: number }> {
  const faites = await db
    .select({ note: tentativesQuiz.note, finLe: tentativesQuiz.finLe })
    .from(tentativesQuiz)
    .where(and(eq(tentativesQuiz.devoirId, devoirId), eq(tentativesQuiz.etudiantId, etudiantId), isNotNull(tentativesQuiz.finLe)))
    .orderBy(asc(tentativesQuiz.finLe));
  const notes = faites.map((f) => f.note ?? 0);
  return { note: notes.length ? Math.max(...notes) : null, premiere: faites[0]?.finLe ?? null, faites: faites.length };
}

/**
 * Termine une tentative (bouton « Terminer » ou temps écoulé) : correction
 * automatique, puis la meilleure note devient la copie « corrigée » de
 * l'interrogation (une ligne de rendus, avec son reçu). Sans effet si la
 * tentative est déjà terminée : renvoie alors null.
 *
 * Clôture et note se décident sur la même lecture des réponses, sous le verrou
 * de la ligne (SELECT … FOR UPDATE) : une réponse de dernière seconde est soit
 * enregistrée AVANT (et comptée dans la note), soit refusée après (« déjà
 * terminée ») — jamais acceptée puis ignorée par la note.
 */
export async function terminerTentative(tentativeId: number, horsDelai = false) {
  const [ligne] = await db
    .select({ t: tentativesQuiz, d: devoirs })
    .from(tentativesQuiz)
    .innerJoin(devoirs, eq(devoirs.id, tentativesQuiz.devoirId))
    .where(eq(tentativesQuiz.id, tentativeId));
  if (!ligne || ligne.t.finLe) return null;
  const { d } = ligne;
  const questions = await db.select().from(questionsQuiz).where(eq(questionsQuiz.devoirId, d.id)).orderBy(asc(questionsQuiz.ordre), asc(questionsQuiz.id));
  const cloture = await db.transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(tentativesQuiz)
      .where(and(eq(tentativesQuiz.id, tentativeId), isNull(tentativesQuiz.finLe)))
      .for("update");
    if (!t) return null; // terminée entre-temps par une autre requête
    const resultat = corrigerTentative(questions, t.reponses, d.bareme);
    // La fin retenue ne dépasse jamais la fin prévue (+ marge) : un « Terminer » tardif ne donne pas de temps en plus.
    const finMax = new Date(finDe(t, d).getTime() + MARGE_QUIZ_MS);
    const fin = new Date(Math.min(Date.now(), finMax.getTime()));
    await tx.update(tentativesQuiz).set({ finLe: fin, score: resultat.score, note: resultat.note }).where(eq(tentativesQuiz.id, t.id));
    return { t, resultat, fin };
  });
  if (!cloture) return null;
  const { t, resultat, fin } = cloture;

  const meilleure = await meilleureNoteQuiz(d.id, t.etudiantId);
  const [rendu] = await db
    .insert(rendus)
    .values({
      devoirId: d.id,
      etudiantId: t.etudiantId,
      statut: "corrige",
      renduLe: meilleure.premiere ?? fin,
      enRetard: false,
      note: meilleure.note,
      corrigeLe: new Date(),
    })
    .onConflictDoUpdate({
      target: [rendus.devoirId, rendus.etudiantId],
      set: { statut: "corrige", note: meilleure.note, corrigeLe: new Date(), majLe: new Date() },
    })
    .returning();
  if (!rendu.recu) await db.update(rendus).set({ recu: recuPour(rendu.id) }).where(eq(rendus.id, rendu.id));
  publierUtilisateur(t.etudiantId, "quiz-termine", { devoirId: d.id, tentativeId: t.id });
  return { ...resultat, devoir: d, meilleureNote: meilleure.note ?? resultat.note, faites: meilleure.faites, horsDelai };
}

/** Termine les tentatives dont le temps (et la marge) est écoulé : l'étudiant a fermé l'onglet ou perdu le réseau. */
export async function cloturerTentativesExpirees(): Promise<number> {
  const ouvertes = await db
    .select({ t: tentativesQuiz, d: devoirs })
    .from(tentativesQuiz)
    .innerJoin(devoirs, eq(devoirs.id, tentativesQuiz.devoirId))
    .where(isNull(tentativesQuiz.finLe));
  const maintenant = Date.now();
  let n = 0;
  for (const { t, d } of ouvertes) {
    if (finDe(t, d).getTime() + MARGE_QUIZ_MS < maintenant) {
      if (await terminerTentative(t.id, true)) n++;
    }
  }
  return n;
}
