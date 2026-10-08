// Objectif du jour de l'étudiant (chantier C2, campus/ENGAGEMENT.md).
//
// Au premier passage de la journée (jour local de l'étudiant, minuit à
// Abidjan par défaut), le serveur choisit trois lignes au plus et les fige
// dans objectifs_jours.elements jusqu'au lendemain :
//   (a) la révision du jour, s'il y a aujourd'hui des cartes à revoir ou à
//       découvrir dans ses cours, ou s'il a déjà révisé aujourd'hui (tables de
//       C1) ; faite à 5 réponses dans la journée, ou dès qu'il a répondu et
//       qu'aucune carte n'est plus due ;
//   (b) le rattrapage de la dernière séance tenue de ses cours depuis 7 jours,
//       où il était attendu, à laquelle sa présence est « absent » (jamais
//       « inconnu » : amendement de José) et qu'il n'a pas encore rattrapée,
//       quand il y a de quoi rattraper (cours complet prêt ou vidéo) ; fait
//       seulement après un vrai travail (sqlSeanceRattrapee : quiz, fiches,
//       exercice, cartes ou replay regardé), jamais à l'ouverture ;
//       sinon « À retenir » du dernier cours complet, à lire sur place ;
//   (c) l'interrogation, sinon l'exercice à rendre, publié, ouvert, pas fait,
//       dû sous 7 jours et proposable (sqlDevoirProposable : un devoir de la
//       routine du soir attend le lendemain matin) ; à défaut « À retenir »,
//       s'il n'est pas déjà proposé. Une interrogation n'est faite qu'avec au
//       moins une réponse (sqlTentativeRepondue, même règle que les points du
//       registre de C5) : terminée vide, elle reste à faire tant qu'il lui
//       reste un essai, puis sort de l'objectif.
// Un objectif réduit à « À retenir » (une lecture qui se coche à l'ouverture)
// n'est pas proposé : un jour ne se valide jamais d'un seul toucher.
// Rien à proposer : aucune ligne n'est écrite (la table ne garde que des
// objectifs réellement proposés) et le choix est retenté 10 minutes plus tard.
//
// L'état « fait » est recalculé à chaque passage et seulement ajouté à
// objectifs_jours.faits. Le jour est validé une seule fois (UPDATE … WHERE
// valide_le IS NULL), même si l'accueil est rechargé dix fois.
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { idsCoursAccessibles } from "../acces";
import { sqlAttendus } from "../routes/admin";
import { planifier } from "../taches";
import { sqlEtatPresence } from "./presence";
import { sqlDevoirProposable } from "./proposables";
import { avecTraces, lireOuTaire, sqlSeanceRattrapee, tableUtilisable } from "./progression-cours";
import { jourLocal } from "@shared/engagement/calendrier";
import {
  CLE_OUVERTURE,
  MINUTES_RATTRAPAGE,
  MINUTES_RETENIR,
  MINUTES_REVISION,
  type ElementObjectif,
  type ElementObjectifDto,
  type Entrainement,
  type ObjectifDuJourDto,
} from "@shared/engagement/objectif";
import type { Utilisateur } from "@shared/schema";

const JOUR_MS = 86_400_000;
const FENETRE_RATTRAPAGE_JOURS = 7;
const FENETRE_DEVOIR_JOURS = 7;
const FENETRE_RETENIR_JOURS = 30;
/** Réponses de révision qui valident la ligne « Révision du jour ». */
const REPONSES_REVISION = 5;
/** Points « À retenir » renvoyés au plus, chacun raccourci : la réponse reste de quelques Ko. */
const POINTS_MAX = 8;
const POINT_LONGUEUR_MAX = 280;
/** Rapport estimé entre le cours complet compressé (gzip) et son JSON brut. */
const COMPRESSION = 0.35;
/** Conservation des objectifs (même durée que l'activité quotidienne). */
const CONSERVATION_JOURS = 400;

/** Étudiants sans rien à proposer aujourd'hui : on ne refait pas le choix avant 10 minutes. */
const RIEN_A_PROPOSER_MS = 10 * 60_000;
const rienAProposer = new Map<string, number>();

type Ligne = { elements: ElementObjectif[]; faits: string[]; valide_le: Date | string | null };

const vide = (jour: string): ObjectifDuJourDto => ({ jour, elements: [], faits: 0, total: 0, valideLe: null });
const iso = (d: Date | string | null) => (d === null ? null : new Date(d).toISOString());

async function lireLigne(utilisateurId: number, jour: string): Promise<Ligne | null> {
  const r = await db.execute<Ligne>(
    sql`SELECT elements, faits, valide_le FROM campus.objectifs_jours WHERE utilisateur_id = ${utilisateurId} AND jour = ${jour}::date`,
  );
  return r.rows[0] ?? null;
}

// ── Interrogations et devoirs : une seule règle pour « fait » ─────────────

/**
 * Tentative d'interrogation terminée avec au moins une réponse ; « alias »
 * désigne campus.tentatives_quiz. Même règle que les points du registre (C5,
 * registre.ts) : une tentative clôturée vide (« Terminer » sans répondre, ou
 * temps écoulé) ne compte pas. Le registre reprend cette fonction : la règle
 * n'est écrite qu'ici.
 */
export function sqlTentativeRepondue(alias: string): SQL {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`sqlTentativeRepondue : alias SQL invalide « ${alias} »`);
  const t = sql.raw(alias);
  return sql`(${t}.fin_le IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_each(${t}.reponses) e
    WHERE e.value NOT IN ('[]'::jsonb, 'null'::jsonb, '""'::jsonb, '{}'::jsonb)))`;
}

/**
 * Devoir fait par l'étudiant (alias de campus.devoirs) : interrogation avec une
 * tentative répondue ; exercice avec un rendu envoyé (hors brouillon). La copie
 * « corrigée » qu'une tentative vide crée dans rendus ne compte pas pour une
 * interrogation : elle n'y est dérivée que des tentatives.
 */
export function sqlDevoirFait(alias: string, etudiantId: number): SQL {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`sqlDevoirFait : alias SQL invalide « ${alias} »`);
  const d = sql.raw(alias);
  return sql`(CASE WHEN ${d}.type = 'quiz'
    THEN EXISTS (SELECT 1 FROM campus.tentatives_quiz tq WHERE tq.devoir_id = ${d}.id AND tq.etudiant_id = ${etudiantId} AND ${sqlTentativeRepondue("tq")})
    ELSE EXISTS (SELECT 1 FROM campus.rendus rr WHERE rr.devoir_id = ${d}.id AND rr.etudiant_id = ${etudiantId} AND rr.statut <> 'brouillon') END)`;
}

/** Interrogation dont tous les essais permis sont terminés (le serveur refuserait d'en commencer un autre). */
export function sqlEssaisEpuises(alias: string, etudiantId: number): SQL {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`sqlEssaisEpuises : alias SQL invalide « ${alias} »`);
  const d = sql.raw(alias);
  return sql`(${d}.type = 'quiz' AND (SELECT count(*) FROM campus.tentatives_quiz te
    WHERE te.devoir_id = ${d}.id AND te.etudiant_id = ${etudiantId} AND te.fin_le IS NOT NULL) >= ${d}.tentatives_max)`;
}

/**
 * Entraînement des interrogations préparées par la routine du soir
 * (devoirs_seances) : nombre de questions et meilleur score au quiz du cours
 * complet de leur séance (suivis_cours_complets, C1), null s'il ne s'est pas
 * encore entraîné. Une interrogation écrite par un formateur n'a pas d'entrée ;
 * sans la table de C1, rien. Partagé par l'accueil et l'objectif du jour.
 */
export async function entrainementsDesInterrogations(
  etudiantId: number,
  quizIds: number[],
): Promise<Map<number, { questions: number; entrainement: Entrainement }>> {
  const resultat = new Map<number, { questions: number; entrainement: Entrainement }>();
  if (!quizIds.length || !(await tableUtilisable("suivis_cours_complets", ["utilisateur_id", "seance_id", "quiz_meilleur", "quiz_total"]))) return resultat;
  return lireOuTaire(async () => {
    const r = await db.execute<{ devoir_id: number; questions: number; meilleur: number | null; total: number | null }>(sql`
      SELECT d.id AS devoir_id,
        (SELECT count(*) FROM campus.questions_quiz q WHERE q.devoir_id = d.id)::int AS questions,
        sc.quiz_meilleur::float8 AS meilleur, sc.quiz_total::float8 AS total
      FROM unnest(${`{${quizIds.join(",")}}`}::int[]) AS d(id)
      JOIN campus.devoirs_seances ds ON ds.devoir_ids @> jsonb_build_array(d.id)
      LEFT JOIN campus.suivis_cours_complets sc ON sc.seance_id = ds.seance_id AND sc.utilisateur_id = ${etudiantId}`);
    for (const l of r.rows) {
      if (!l.questions) continue;
      // Score borné au total : un score envoyé par le téléphone n'est pas recontrôlé par C1.
      const entrainement = l.meilleur !== null && l.total ? { score: Math.min(Math.round(l.meilleur), Math.round(l.total)), total: Math.round(l.total) } : null;
      resultat.set(l.devoir_id, { questions: l.questions, entrainement });
    }
    return resultat;
  }, resultat);
}

// ── Choix du jour ──────────────────────────────────────────────────────────

/**
 * Révision du jour, seulement si elle peut se cocher aujourd'hui : une carte à
 * revoir ou jamais vue dans ses cours (même condition que revisionFaite), ou
 * des réponses déjà données aujourd'hui. Sans le suivi de C1, des cartes
 * actives suffisent.
 */
async function choisirRevision(u: Utilisateur, coursIds: number[], jour: string): Promise<ElementObjectif | null> {
  if (!coursIds.length || !(await tableUtilisable("cartes_revision", ["id", "cours_id", "active"]))) return null;
  const ids = `{${coursIds.join(",")}}`;
  const suivi =
    (await tableUtilisable("revisions_etudiants", ["utilisateur_id", "carte_id", "prochaine_le"])) &&
    (await tableUtilisable("reponses_revision", ["utilisateur_id", "jour"]));
  const existe = await lireOuTaire(async () => {
    const r = await db.execute<{ existe: boolean }>(
      suivi
        ? sql`SELECT (EXISTS (
              SELECT 1 FROM campus.cartes_revision c
              LEFT JOIN campus.revisions_etudiants re ON re.carte_id = c.id AND re.utilisateur_id = ${u.id}
              WHERE c.cours_id = ANY(${ids}::int[]) AND c.active AND (re.carte_id IS NULL OR re.prochaine_le <= ${jour}))
            OR EXISTS (SELECT 1 FROM campus.reponses_revision rr WHERE rr.utilisateur_id = ${u.id} AND rr.jour = ${jour})) AS existe`
        : sql`SELECT EXISTS (SELECT 1 FROM campus.cartes_revision WHERE cours_id = ANY(${ids}::int[]) AND active) AS existe`,
    );
    return Boolean(r.rows[0]?.existe);
  }, false);
  return existe ? { cle: "revision", type: "revision", lien: "/reviser", minutes: MINUTES_REVISION } : null;
}

async function choisirRattrapage(u: Utilisateur, coursIds: number[], maintenant: Date): Promise<ElementObjectif | null> {
  if (!coursIds.length) return null;
  const r = await avecTraces((traces) =>
    db.execute<{ seance_id: number; debut: Date | string; code: string; titre: string; complet: boolean; taille: number | null }>(sql`
    SELECT a.seance_id, a.debut, c.code, c.titre,
      COALESCE(es.statut = 'prete' AND es.dossier IS NOT NULL, false) AS complet,
      octet_length(es.dossier::text) AS taille
    FROM (${sqlAttendus({ etudiantId: u.id, sites: null, depuis: new Date(maintenant.getTime() - FENETRE_RATTRAPAGE_JOURS * JOUR_MS) })}) a
    JOIN campus.cours c ON c.id = a.cours_id
    JOIN campus.seances se ON se.id = a.seance_id
    LEFT JOIN campus.etudes_seances es ON es.seance_id = a.seance_id
    WHERE a.cours_id = ANY(${`{${coursIds.join(",")}}`}::int[])
      AND se.statut = 'terminee'
      -- De quoi rattraper avec un vrai travail : un cours complet (quiz, fiches) ou la vidéo (une fiche seule ne se coche pas).
      AND ((es.statut = 'prete' AND es.dossier IS NOT NULL) OR se.replay_url IS NOT NULL OR se.enregistrement_id IS NOT NULL)
      AND ${sqlEtatPresence(sql`a.seance_id`, sql`a.uid`)} = 'absent'
      AND NOT ${sqlSeanceRattrapee(sql`a.seance_id`, sql`a.uid`, traces)}
    ORDER BY a.debut DESC
    LIMIT 1`),
  );
  const l = r.rows[0];
  if (!l) return null;
  return {
    cle: `rattrapage:${l.seance_id}`,
    type: "rattrapage",
    seanceId: l.seance_id,
    coursCode: l.code,
    coursTitre: l.titre,
    debut: new Date(l.debut).toISOString(),
    lien: l.complet ? `/mediatheque/cours/${l.seance_id}?depuis=accueil` : `/replays/${l.seance_id}`,
    minutes: MINUTES_RATTRAPAGE,
    ko: l.complet && l.taille ? Math.max(1, Math.round((l.taille * COMPRESSION) / 1024)) : null,
  };
}

async function choisirDevoir(u: Utilisateur, coursIds: number[], maintenant: Date): Promise<ElementObjectif | null> {
  if (!coursIds.length) return null;
  const r = await db.execute<{
    id: number;
    type: "quiz" | "depot";
    titre: string;
    date_limite: Date | string;
    duree_minutes: number | null;
    code: string;
    cours_titre: string;
    questions: number;
  }>(sql`
    SELECT d.id, d.type, d.titre, d.date_limite, d.duree_minutes, c.code, c.titre AS cours_titre,
      (SELECT count(*) FROM campus.questions_quiz q WHERE q.devoir_id = d.id)::int AS questions
    FROM campus.devoirs d
    JOIN campus.cours c ON c.id = d.cours_id
    WHERE d.cours_id = ANY(${`{${coursIds.join(",")}}`}::int[])
      AND d.publie
      AND (d.ouverture_le IS NULL OR d.ouverture_le <= ${maintenant.toISOString()}::timestamptz)
      AND d.date_limite > ${maintenant.toISOString()}::timestamptz
      AND d.date_limite <= ${new Date(maintenant.getTime() + FENETRE_DEVOIR_JOURS * JOUR_MS).toISOString()}::timestamptz
      AND ${sqlDevoirProposable("d")}
      -- Pas encore fait (une interrogation terminée vide reste à faire), et encore faisable (un essai restant).
      AND NOT ${sqlDevoirFait("d", u.id)}
      AND NOT ${sqlEssaisEpuises("d", u.id)}
      AND (d.type <> 'quiz' OR EXISTS (SELECT 1 FROM campus.questions_quiz q WHERE q.devoir_id = d.id))
    ORDER BY (d.type = 'quiz') DESC, d.date_limite ASC, d.id ASC
    LIMIT 1`);
  const d = r.rows[0];
  if (!d) return null;
  const quiz = d.type === "quiz";
  // Durée estimée : 8 minutes pour 10 questions, jamais plus que le chrono de l'interrogation.
  const estimee = Math.max(3, Math.round(d.questions * 0.8));
  return {
    cle: `devoir:${d.id}`,
    type: "devoir",
    devoirId: d.id,
    genre: d.type,
    coursCode: d.code,
    coursTitre: d.cours_titre,
    titre: d.titre,
    dateLimite: new Date(d.date_limite).toISOString(),
    questions: quiz ? d.questions : null,
    minutes: quiz ? Math.min(estimee, d.duree_minutes ?? estimee) : null,
    lien: quiz ? `/quiz/${d.id}` : `/devoirs/${d.id}`,
  };
}

/** « À retenir » du dernier cours complet de ses cours (30 jours), pas encore lu depuis l'objectif, hors séance exclue. */
async function choisirRetenir(u: Utilisateur, coursIds: number[], maintenant: Date, sauf: number | null): Promise<ElementObjectif | null> {
  if (!coursIds.length) return null;
  const r = await db.execute<{ id: number; debut: Date | string; code: string; titre: string }>(sql`
    SELECT s.id, s.debut, c.code, c.titre
    FROM campus.etudes_seances es
    JOIN campus.seances s ON s.id = es.seance_id
    JOIN campus.cours c ON c.id = s.cours_id
    WHERE s.cours_id = ANY(${`{${coursIds.join(",")}}`}::int[])
      AND es.statut = 'prete'
      AND s.statut = 'terminee'
      AND s.debut >= ${new Date(maintenant.getTime() - FENETRE_RETENIR_JOURS * JOUR_MS).toISOString()}::timestamptz
      AND s.id <> ${sauf ?? 0}
      AND (CASE WHEN jsonb_typeof(es.dossier -> 'aRetenir') = 'array' THEN jsonb_array_length(es.dossier -> 'aRetenir') ELSE 0 END) > 0
      AND NOT EXISTS (SELECT 1 FROM campus.objectifs_jours oj WHERE oj.utilisateur_id = ${u.id}
        AND oj.faits @> jsonb_build_array('retenir:' || s.id::text))
    ORDER BY s.debut DESC
    LIMIT 1`);
  const l = r.rows[0];
  if (!l) return null;
  return {
    cle: `retenir:${l.id}`,
    type: "retenir",
    seanceId: l.id,
    coursCode: l.code,
    coursTitre: l.titre,
    debut: new Date(l.debut).toISOString(),
    lien: `/mediatheque/cours/${l.id}?depuis=accueil`,
    minutes: MINUTES_RETENIR,
  };
}

/**
 * Les lignes du jour, dans l'ordre : révision, rattrapage (ou « À retenir »),
 * devoir (ou « À retenir »). Aucune ligne s'il n'y a pas au moins un acte
 * d'apprentissage à faire (révision, rattrapage ou devoir) : « À retenir » se
 * coche à l'ouverture et ne fait pas, seul, un objectif du jour.
 */
export async function choisirElements(u: Utilisateur, coursIds: number[], maintenant: Date): Promise<ElementObjectif[]> {
  const [revision, rattrapage, devoir] = await Promise.all([
    choisirRevision(u, coursIds, jourLocal(maintenant, u.fuseau)),
    choisirRattrapage(u, coursIds, maintenant),
    choisirDevoir(u, coursIds, maintenant),
  ]);
  // « À retenir » ne vient qu'une fois, et jamais pour la séance déjà proposée en rattrapage.
  const retenir =
    !rattrapage || !devoir ? await choisirRetenir(u, coursIds, maintenant, rattrapage?.type === "rattrapage" ? rattrapage.seanceId : null) : null;
  const elements: ElementObjectif[] = [];
  if (revision) elements.push(revision);
  if (rattrapage) elements.push(rattrapage);
  else if (retenir) elements.push(retenir);
  if (devoir) elements.push(devoir);
  else if (retenir && rattrapage) elements.push(retenir);
  return elements.some((e) => e.type !== "retenir") ? elements : [];
}

// ── État du jour ───────────────────────────────────────────────────────────

type Etat = { fait: boolean; retire?: boolean; points?: string[]; entrainement?: Entrainement };

/** Ce que l'étudiant a fait de chaque ligne, d'après les traces existantes (et les ouvertures notées). */
async function etatsElements(u: Utilisateur, jour: string, elements: ElementObjectif[], faitsConnus: Set<string>): Promise<Map<string, Etat>> {
  const etats = new Map<string, Etat>();
  const travaux: Promise<void>[] = [];

  if (elements.some((e) => e.type === "revision")) {
    travaux.push(
      (async () => {
        etats.set("revision", { fait: faitsConnus.has("revision") || (await lireOuTaire(() => revisionFaite(u, jour), false)) });
      })(),
    );
  }

  const devoirs = elements.flatMap((e) => (e.type === "devoir" ? [e.devoirId] : []));
  if (devoirs.length) {
    travaux.push(
      (async () => {
        const r = await db.execute<{ id: number; type: string; publie: boolean; fait: boolean; epuise: boolean }>(sql`
          SELECT d.id, d.type, d.publie, ${sqlDevoirFait("d", u.id)} AS fait, ${sqlEssaisEpuises("d", u.id)} AS epuise
          FROM campus.devoirs d WHERE d.id = ANY(${`{${devoirs.join(",")}}`}::int[])`);
        const de = new Map(r.rows.map((l) => [l.id, l]));
        // Interrogations de la routine du soir pas encore faites : l'entraînement sur leur cours complet.
        const aFaire = r.rows.filter((l) => l.type === "quiz" && !l.fait && !faitsConnus.has(`devoir:${l.id}`)).map((l) => l.id);
        const entrainements = await entrainementsDesInterrogations(u.id, aFaire);
        for (const id of devoirs) {
          const l = de.get(id);
          const cle = `devoir:${id}`;
          // Fait reste fait ; un devoir supprimé ou dépublié depuis ce matin sort de l'objectif, comme
          // une interrogation terminée sans réponse à qui il ne reste plus d'essai (le jour reste validable).
          if (faitsConnus.has(cle) || l?.fait) etats.set(cle, { fait: true });
          else {
            const e = entrainements.get(id);
            etats.set(cle, { fait: false, retire: !l || !l.publie || l.epuise, ...(e ? { entrainement: e.entrainement } : {}) });
          }
        }
      })(),
    );
  }

  const rattrapages = elements.flatMap((e) => (e.type === "rattrapage" ? [e.seanceId] : []));
  if (rattrapages.length) {
    travaux.push(
      (async () => {
        const r = await avecTraces((traces) =>
          db.execute<{ id: number; rattrapee: boolean }>(sql`
          SELECT x.id, ${sqlSeanceRattrapee(sql`x.id`, sql`${u.id}::int`, traces)} AS rattrapee
          FROM campus.seances x WHERE x.id = ANY(${`{${rattrapages.join(",")}}`}::int[])`),
        );
        const de = new Map(r.rows.map((l) => [l.id, l.rattrapee]));
        for (const id of rattrapages) {
          const cle = `rattrapage:${id}`;
          if (faitsConnus.has(cle) || de.get(id)) etats.set(cle, { fait: true });
          else etats.set(cle, { fait: false, retire: !de.has(id) });
        }
      })(),
    );
  }

  const retenirs = elements.flatMap((e) => (e.type === "retenir" ? [e.seanceId] : []));
  if (retenirs.length) {
    travaux.push(
      (async () => {
        const r = await db.execute<{ seance_id: number; points: unknown }>(sql`
          SELECT seance_id, dossier -> 'aRetenir' AS points FROM campus.etudes_seances
          WHERE seance_id = ANY(${`{${retenirs.join(",")}}`}::int[]) AND statut = 'prete'`);
        const de = new Map(r.rows.map((l) => [l.seance_id, l.points]));
        for (const id of retenirs) {
          const cle = `retenir:${id}`;
          const points = Array.isArray(de.get(id))
            ? (de.get(id) as unknown[])
                .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
                .slice(0, POINTS_MAX)
                .map((p) => (p.length > POINT_LONGUEUR_MAX ? `${p.slice(0, POINT_LONGUEUR_MAX - 1).trimEnd()}…` : p))
            : [];
          // Cours complet refait ou retiré : la ligne reste si elle est déjà lue, sinon elle sort.
          etats.set(cle, { fait: faitsConnus.has(cle), retire: !faitsConnus.has(cle) && !points.length, points });
        }
      })(),
    );
  }

  await Promise.all(travaux);
  return etats;
}

/** Révision du jour faite : 5 réponses aujourd'hui, ou au moins une et plus aucune carte due (tables de C1). */
async function revisionFaite(u: Utilisateur, jour: string): Promise<boolean> {
  if (!(await tableUtilisable("reponses_revision", ["utilisateur_id", "jour"]))) return false;
  const r = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM campus.reponses_revision WHERE utilisateur_id = ${u.id} AND jour = ${jour}`,
  );
  const reponses = r.rows[0]?.n ?? 0;
  if (reponses >= REPONSES_REVISION) return true;
  if (reponses === 0) return false;
  const dues =
    (await tableUtilisable("revisions_etudiants", ["utilisateur_id", "carte_id", "prochaine_le"])) &&
    (await tableUtilisable("cartes_revision", ["id", "cours_id", "active"]));
  if (!dues) return false;
  const coursIds = await idsCoursAccessibles(u);
  if (!coursIds.length) return true;
  const d = await db.execute<{ due: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM campus.cartes_revision c
      LEFT JOIN campus.revisions_etudiants re ON re.carte_id = c.id AND re.utilisateur_id = ${u.id}
      WHERE c.cours_id = ANY(${`{${coursIds.join(",")}}`}::int[]) AND c.active AND (re.carte_id IS NULL OR re.prochaine_le <= ${jour})
    ) AS due`);
  return !d.rows[0]?.due;
}

// ── Objectif du jour ───────────────────────────────────────────────────────

/** L'objectif du jour de l'étudiant : choisi et figé au premier passage, puis mis à jour. */
export async function objectifDuJour(u: Utilisateur, maintenant: Date = new Date()): Promise<ObjectifDuJourDto> {
  const jour = jourLocal(maintenant, u.fuseau);
  let ligne = await lireLigne(u.id, jour);

  if (!ligne) {
    const cle = `${u.id}|${jour}`;
    const dernier = rienAProposer.get(cle);
    if (dernier && maintenant.getTime() - dernier < RIEN_A_PROPOSER_MS) return vide(jour);
    const elements = await choisirElements(u, await idsCoursAccessibles(u), maintenant);
    if (!elements.length) {
      if (rienAProposer.size > 5000) rienAProposer.clear();
      rienAProposer.set(cle, maintenant.getTime());
      return vide(jour);
    }
    rienAProposer.delete(cle);
    // Deux passages simultanés : le premier écrit, le second relit la même sélection.
    await db.execute(sql`
      INSERT INTO campus.objectifs_jours (utilisateur_id, jour, elements, site_id, classe_id)
      VALUES (${u.id}, ${jour}::date, ${JSON.stringify(elements)}::jsonb, ${u.siteId}, ${u.classeId})
      ON CONFLICT (utilisateur_id, jour) DO NOTHING`);
    ligne = await lireLigne(u.id, jour);
    if (!ligne) return vide(jour);
  }

  const elements = Array.isArray(ligne.elements) ? ligne.elements : [];
  const faitsConnus = new Set(Array.isArray(ligne.faits) ? ligne.faits : []);
  const etats = await etatsElements(u, jour, elements, faitsConnus);

  const nouveaux = [...etats].filter(([cle, e]) => e.fait && !faitsConnus.has(cle)).map(([cle]) => cle);
  if (nouveaux.length) {
    // Ajout seulement, sans doublon, même si une ouverture arrive en même temps.
    await db.execute(sql`
      UPDATE campus.objectifs_jours SET faits = faits || COALESCE((
        SELECT jsonb_agg(k) FROM jsonb_array_elements_text(${JSON.stringify(nouveaux)}::jsonb) k
        WHERE NOT faits @> jsonb_build_array(k)), '[]'::jsonb)
      WHERE utilisateur_id = ${u.id} AND jour = ${jour}::date`);
  }

  const visibles: ElementObjectifDto[] = elements
    .filter((e) => !etats.get(e.cle)?.retire)
    .map((e) => {
      const etat = etats.get(e.cle);
      return {
        ...e,
        fait: Boolean(etat?.fait),
        ...(e.type === "retenir" ? { points: etat?.points ?? [] } : {}),
        ...(etat?.entrainement !== undefined ? { entrainement: etat.entrainement } : {}),
      };
    });
  // Plus aucun acte d'apprentissage à faire ni fait (devoir retiré, essais épuisés…) : « À retenir » seul ne fait pas un objectif.
  if (!ligne.valide_le && !visibles.some((e) => e.type !== "retenir")) return vide(jour);
  const faits = visibles.filter((e) => e.fait).length;

  let valideLe = ligne.valide_le;
  if (!valideLe && visibles.length && faits === visibles.length) {
    // Écrit une seule fois : le premier passage qui voit tout fait gagne, les suivants relisent.
    const r = await db.execute<{ valide_le: Date | string }>(sql`
      UPDATE campus.objectifs_jours SET valide_le = now()
      WHERE utilisateur_id = ${u.id} AND jour = ${jour}::date AND valide_le IS NULL
      RETURNING valide_le`);
    valideLe = r.rows[0]?.valide_le ?? (await lireLigne(u.id, jour))?.valide_le ?? null;
  }

  return { jour, elements: visibles, faits, total: visibles.length, valideLe: iso(valideLe) };
}

/**
 * Note l'ouverture d'une ligne qui n'a pas d'autre trace : « À retenir » lu
 * sur l'accueil (CLE_OUVERTURE). Un rattrapage ne se coche jamais ainsi : il
 * faut un vrai travail (sqlSeanceRattrapee). Faux si la clé ne fait pas partie
 * de l'objectif du jour.
 */
export async function noterOuverture(u: Utilisateur, cle: string, maintenant: Date = new Date()): Promise<boolean> {
  if (!CLE_OUVERTURE.test(cle)) return false;
  const jour = jourLocal(maintenant, u.fuseau);
  const r = await db.execute(sql`
    UPDATE campus.objectifs_jours
    SET faits = CASE WHEN faits @> jsonb_build_array(${cle}::text) THEN faits ELSE faits || jsonb_build_array(${cle}::text) END
    WHERE utilisateur_id = ${u.id} AND jour = ${jour}::date
      AND elements @> jsonb_build_array(jsonb_build_object('cle', ${cle}::text))
    RETURNING 1`);
  return (r.rowCount ?? r.rows.length) > 0;
}

// Ménage quotidien : les objectifs de plus de 400 jours.
planifier("objectif-du-jour-menage", 24 * 3600_000, async () => {
  await db.execute(sql`DELETE FROM campus.objectifs_jours WHERE jour < current_date - ${CONSERVATION_JOURS}::int`);
});
