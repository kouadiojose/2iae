// Banque de cartes de la révision du jour (chantier C1) : la matière existe
// déjà, sans aucun appel d'IA. Chaque cours complet prêt (etudes_seances au
// statut « prete ») donne ses cartes : les questions du quiz (QCM), les fiches
// mémo et le glossaire (fiches à retourner). Les sondages du direct qui ont une
// bonne réponse (lancés par le formateur, puis fermés) deviennent aussi des QCM.
// L'interrogation notée et le devoir pratique ne sont JAMAIS extraits.
//
// Une carte est identifiée par sha256(séance | source | texte normalisé) : un
// cours complet refait garde les cartes (et les boîtes des étudiants) de ses
// questions inchangées ; celles qui ont disparu du dossier sortent de la
// révision (active = false). Une carte retirée (a_relire) reste retirée tant
// que le formateur ne l'a pas réactivée. etude-cours.ts n'est pas modifié : la
// banque ne fait que lire ce qu'il écrit.
//
// Un sondage qui reprend une question déjà en banque dans le même cours (les 3
// questions de rappel du direct viennent du quiz du dernier cours complet) ne
// crée pas de seconde carte : pas de doublon dans les « nouvelles », pas de
// boîte séparée, et une question retirée ne revient jamais par ce détour.
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { planifier } from "../taches";
import type { DossierCours } from "@shared/schema";
import { normaliserTexte, type ContenuCarte, type GenreCarte, type SourceCarte } from "@shared/engagement/revision";

export type CarteExtraite = { cle: string; source: SourceCarte; position: number; genre: GenreCarte; contenu: ContenuCarte };

/** Clé stable d'une carte. */
export function cleCarte(seanceId: number, source: SourceCarte, texte: string): string {
  return createHash("sha256").update(`${seanceId}|${source}|${normaliserTexte(texte)}`).digest("hex");
}

const texteValide = (t: unknown): t is string => typeof t === "string" && t.trim().length > 0;

/**
 * La question d'un sondage reprend-elle une question déjà en banque ? Même
 * texte normalisé, ou même début quand la question a été coupée (« … ») pour
 * tenir dans un sondage (300 caractères, route des questions de rappel).
 */
export function memeQuestion(sondage: string, enBanque: string): boolean {
  const a = normaliserTexte(sondage);
  const b = normaliserTexte(enBanque);
  if (!a || !b) return false;
  if (a === b) return true;
  return sondage.trim().endsWith("…") && a.length >= 40 && b.startsWith(a);
}

/** Cartes d'un dossier de cours complet, dans l'ordre du dossier (une question en double n'en donne qu'une). */
export function extraireCartes(seanceId: number, d: DossierCours): CarteExtraite[] {
  const cartes: CarteExtraite[] = [];
  (d.quiz ?? []).forEach((q, position) => {
    const options = Array.isArray(q?.options) ? q.options.filter(texteValide) : [];
    if (!texteValide(q?.question) || options.length < 2 || options.length !== q.options.length) return;
    if (!Number.isInteger(q.bonneReponse) || q.bonneReponse < 0 || q.bonneReponse >= options.length) return;
    cartes.push({
      cle: cleCarte(seanceId, "quiz", q.question),
      source: "quiz",
      position,
      genre: "qcm",
      contenu: { question: q.question.trim(), options, bonneReponse: q.bonneReponse, explication: q.explication?.trim() ?? "" },
    });
  });
  (d.fiches ?? []).forEach((f, position) => {
    if (!texteValide(f?.recto) || !texteValide(f?.verso)) return;
    cartes.push({ cle: cleCarte(seanceId, "fiche", f.recto), source: "fiche", position, genre: "fiche", contenu: { recto: f.recto.trim(), verso: f.verso.trim() } });
  });
  (d.glossaire ?? []).forEach((g, position) => {
    if (!texteValide(g?.terme) || !texteValide(g?.definition)) return;
    cartes.push({
      cle: cleCarte(seanceId, "glossaire", g.terme),
      source: "glossaire",
      position,
      genre: "fiche",
      contenu: { recto: g.terme.trim(), verso: g.definition.trim() },
    });
  });
  const vues = new Set<string>();
  return cartes.filter((c) => !vues.has(c.cle) && Boolean(vues.add(c.cle)));
}

export type BilanBanque = { inserees: number; misesAJour: number; desactivees: number };

/**
 * Écrit les cartes d'un dossier : nouvelles cartes insérées, cartes connues
 * remises à jour (et de nouveau proposées, sauf si elles sont retirées), cartes
 * disparues du dossier sorties de la révision.
 */
export async function ecrireCartesSeance(seanceId: number, coursId: number, d: DossierCours): Promise<BilanBanque> {
  const cartes = extraireCartes(seanceId, d);
  let inserees = 0;
  let misesAJour = 0;
  if (cartes.length) {
    const valeurs = sql.join(
      cartes.map((c) => sql`(${c.cle}, ${coursId}, ${seanceId}, ${c.source}, ${c.position}, ${c.genre}, ${JSON.stringify(c.contenu)}::jsonb)`),
      sql`, `,
    );
    const { rows } = await db.execute<{ insere: boolean }>(sql`
      INSERT INTO campus.cartes_revision (cle, cours_id, seance_id, source, position, genre, contenu)
      VALUES ${valeurs}
      ON CONFLICT (cle) DO UPDATE SET
        cours_id = excluded.cours_id, position = excluded.position, contenu = excluded.contenu,
        active = NOT campus.cartes_revision.a_relire, maj_le = now()
      RETURNING (xmax = 0) AS insere`);
    inserees = rows.filter((r) => r.insere).length;
    misesAJour = rows.length - inserees;
  }
  const cles = cartes.map((c) => c.cle);
  const { rowCount } = await db.execute(sql`
    UPDATE campus.cartes_revision SET active = false
    WHERE seance_id = ${seanceId} AND source IN ('quiz', 'fiche', 'glossaire') AND active
      AND NOT (cle = ANY(${sql`ARRAY[${sql.join(cles.length ? cles.map((c) => sql`${c}`) : [sql`''`], sql`, `)}]::text[]`}))`);
  return { inserees, misesAJour, desactivees: rowCount ?? 0 };
}

/** Dossiers sans carte valable déjà lus depuis le démarrage (séance → fin de préparation) : on n'y revient pas. */
const passes = new Map<number, number>();
let dernierSondage = 0;

/**
 * Un passage de la banque. Ne lit le dossier (plusieurs dizaines de Ko) que des
 * cours complets nouveaux ou refaits depuis la dernière écriture de leurs cartes.
 */
export async function passerBanque(): Promise<BilanBanque & { dossiers: number; sondages: number }> {
  const bilan = { inserees: 0, misesAJour: 0, desactivees: 0, dossiers: 0, sondages: 0 };
  const { rows: aLire } = await db.execute<{ seance_id: number; cours_id: number; fin: string | null }>(sql`
    SELECT e.seance_id, s.cours_id, e.fin
    FROM campus.etudes_seances e
    JOIN campus.seances s ON s.id = e.seance_id
    WHERE e.statut = 'prete' AND e.dossier IS NOT NULL
      AND COALESCE(e.fin, e.debut) > COALESCE(
        (SELECT max(c.maj_le) FROM campus.cartes_revision c WHERE c.seance_id = e.seance_id AND c.source <> 'sondage'),
        '-infinity'::timestamptz)`);
  for (const l of aLire) {
    const fin = l.fin ? new Date(l.fin).getTime() : 0;
    // Dossier sans carte valable : déjà lu une fois depuis le démarrage, on n'y revient pas.
    if (passes.get(l.seance_id) === fin) continue;
    const { rows } = await db.execute<{ dossier: DossierCours }>(sql`SELECT dossier FROM campus.etudes_seances WHERE seance_id = ${l.seance_id} AND statut = 'prete'`);
    const dossier = rows[0]?.dossier;
    if (!dossier) continue;
    const b = await ecrireCartesSeance(l.seance_id, l.cours_id, dossier);
    passes.set(l.seance_id, fin);
    bilan.dossiers++;
    bilan.inserees += b.inserees;
    bilan.misesAJour += b.misesAJour;
    bilan.desactivees += b.desactivees;
  }

  // Sondages du direct qui servent de question de cours : lancés, fermés, avec une bonne réponse.
  const { rows: sondages } = await db.execute<{ id: number; seance_id: number; cours_id: number; question: string; options: string[]; bonne_reponse: number; explication: string | null }>(sql`
    SELECT so.id, so.seance_id, s.cours_id, so.question, so.options, so.bonne_reponse, so.explication
    FROM campus.sondages so JOIN campus.seances s ON s.id = so.seance_id
    WHERE so.id > ${dernierSondage} AND so.bonne_reponse IS NOT NULL AND so.ouvert_le IS NOT NULL AND NOT so.ouvert
    ORDER BY so.id LIMIT 500`);
  let valables = sondages.filter(
    (so) => texteValide(so.question) && Array.isArray(so.options) && so.options.length >= 2 && so.bonne_reponse >= 0 && so.bonne_reponse < so.options.length,
  );
  if (valables.length) {
    // Questions déjà en banque dans ces cours : QCM du quiz ou d'un autre sondage, actives ou retirées
    // (une carte a_relire compte aussi : elle ne doit pas revenir sous une autre clé). Les cartes des
    // dossiers prêts viennent d'être écrites par la boucle ci-dessus.
    const cours = [...new Set(valables.map((so) => so.cours_id))];
    const { rows: connues } = await db.execute<{ cours_id: number; question: string | null }>(sql`
      SELECT cours_id, contenu->>'question' AS question FROM campus.cartes_revision
      WHERE genre = 'qcm' AND cours_id = ANY(ARRAY[${sql.join(cours.map((c) => sql`${c}`), sql`, `)}]::int[])`);
    const parCours = new Map<number, string[]>();
    const ajouter = (coursId: number, question: string) => parCours.set(coursId, [...(parCours.get(coursId) ?? []), question]);
    for (const k of connues) if (k.question) ajouter(k.cours_id, k.question);
    // Dans l'ordre des sondages : la même question lancée dans deux séances du cours ne donne qu'une carte.
    valables = valables.filter((so) => {
      if ((parCours.get(so.cours_id) ?? []).some((q) => memeQuestion(so.question, q))) return false;
      ajouter(so.cours_id, so.question);
      return true;
    });
  }
  if (valables.length) {
    const vues = new Set<string>();
    const valeurs = valables
      .map((so) => ({ so, cle: cleCarte(so.seance_id, "sondage", so.question) }))
      .filter(({ cle }) => !vues.has(cle) && Boolean(vues.add(cle)))
      .map(({ so, cle }) => {
        const contenu: ContenuCarte = { question: so.question.trim(), options: so.options, bonneReponse: so.bonne_reponse, explication: so.explication?.trim() ?? "" };
        return sql`(${cle}, ${so.cours_id}, ${so.seance_id}, 'sondage', ${so.id}, 'qcm', ${JSON.stringify(contenu)}::jsonb)`;
      });
    const { rowCount } = await db.execute(sql`
      INSERT INTO campus.cartes_revision (cle, cours_id, seance_id, source, position, genre, contenu)
      VALUES ${sql.join(valeurs, sql`, `)}
      ON CONFLICT (cle) DO NOTHING`);
    bilan.sondages = rowCount ?? 0;
  }
  if (sondages.length) dernierSondage = sondages[sondages.length - 1].id;
  return bilan;
}

/**
 * Identifiants des cartes d'un cours complet, dans l'ordre du dossier (quiz et
 * fiches) : le cours complet enregistre ses réponses sur les mêmes cartes que la
 * révision. Un dossier tout juste prêt est écrit dans la banque sans attendre.
 */
export async function cartesDuDossier(seanceId: number, coursId: number, d: DossierCours): Promise<{ quiz: (number | null)[]; fiches: (number | null)[] }> {
  const clesQuiz = (d.quiz ?? []).map((q) => (texteValide(q?.question) ? cleCarte(seanceId, "quiz", q.question) : ""));
  const clesFiches = (d.fiches ?? []).map((f) => (texteValide(f?.recto) ? cleCarte(seanceId, "fiche", f.recto) : ""));
  const toutes = [...clesQuiz, ...clesFiches].filter(Boolean);
  if (!toutes.length) return { quiz: clesQuiz.map(() => null), fiches: clesFiches.map(() => null) };
  const lire = async () => {
    const { rows } = await db.execute<{ id: number; cle: string; active: boolean }>(
      sql`SELECT id, cle, active FROM campus.cartes_revision WHERE cle = ANY(ARRAY[${sql.join(toutes.map((c) => sql`${c}`), sql`, `)}]::text[])`,
    );
    return new Map(rows.map((r) => [r.cle, r]));
  };
  let connues = await lire();
  if (toutes.some((c) => !connues.has(c))) {
    await ecrireCartesSeance(seanceId, coursId, d);
    connues = await lire();
  }
  // Une carte retirée (signalée, très ratée) n'enregistre plus de réponses.
  const id = (cle: string) => {
    const c = cle ? connues.get(cle) : undefined;
    return c?.active ? c.id : null;
  };
  return { quiz: clesQuiz.map(id), fiches: clesFiches.map(id) };
}

if (process.env.REVISION_BANQUE !== "non") {
  planifier("revision-cartes", 10 * 60_000, async () => {
    const b = await passerBanque();
    if (b.dossiers || b.sondages) {
      console.log(`[révision] banque : ${b.dossiers} cours complet(s) lu(s), ${b.inserees} carte(s) créée(s), ${b.misesAJour} mise(s) à jour, ${b.desactivees} sortie(s), ${b.sondages} sondage(s).`);
    }
  });
}
