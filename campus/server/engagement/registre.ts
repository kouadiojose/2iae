// Registre des points (chantier C5) : chaque acte d'apprentissage déjà
// enregistré par le campus (présence, copie, interrogation, leçon, question en
// direct…) devient une ligne de campus.activites, par
// INSERT … SELECT … ON CONFLICT (cle) DO NOTHING. Aucune route existante n'est
// modifiée (live.ts, evaluations.ts, cours.ts restent tels quels) : le registre
// lit leurs tables. Les tables des autres chantiers (révision, cours complets,
// objectif du jour) ne sont lues que si elles existent (tableExiste) et ont
// les colonnes attendues ; sinon la source est simplement sautée.
//
// Chaque ligne porte le jour local de l'étudiant (son fuseau, Abidjan par
// défaut), la semaine ISO, sa classe à la date de l'acte (sqlClasseA) et son
// campus. Les plafonds (leçons par jour, questions par séance…) tiennent
// compte de ce qui est déjà inscrit : un passage rejoué ne crée ni doublon ni
// dépassement.
//
// Passages :
//   - toutes les 5 minutes, sur les 3 derniers jours, source par source ;
//   - au premier passage après le démarrage (2 minutes après), rattrapage
//     depuis la rentrée du 28 septembre, source par source ;
//   - à la demande pour une personne (sa page de progression), au plus une
//     fois par minute.
// Verrous PostgreSQL (pg_advisory_xact_lock) : un passage général prend le
// verrou du registre en exclusif ; un passage personnel le prend en partagé
// (les personnes passent en même temps) avec un verrou à son nom, et n'attend
// jamais : si un passage général est en cours, il est sauté (le passage des
// 5 minutes rattrape) et ne garde aucune connexion en attente. Deux passages
// qui écrivent pour la même personne ne tournent donc jamais ensemble : aucun
// plafond ne peut être dépassé.
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { ErreurHttp } from "../http";
import { planifier } from "../taches";
import { tableExiste } from "./tables";
import { attribuerBadges } from "./badges";
// Une tentative clôturée vide (« Terminer » sans répondre) ne rapporte rien : même règle que l'objectif du jour.
import { sqlTentativeRepondue } from "./objectif";
import { POINTS, PLAFONDS, MINUTES_PRESENCE, VOTES_QUESTION, REPLAY_MINUTES, FENETRE_JOURS, RENTREE } from "./bareme";
import { SQL_DUREE_REFERENCE, sqlClasseA } from "../routes/admin";
import { FUSEAU_PAR_DEFAUT } from "@shared/engagement/calendrier";
import { SEUIL_PRESENCE_EN_LIGNE } from "@shared/schema";
import type { TypeActivite } from "@shared/engagement/progression";

const JOUR_MS = 86_400_000;
/** Clé du verrou PostgreSQL des passages du registre (nombre arbitraire, propre à C5). */
const VERROU_REGISTRE = 51_031_001;
/** Espace des verrous par personne : pg_advisory_xact_lock(VERROU_PERSONNE, id de l'étudiant). */
const VERROU_PERSONNE = 51_031_002;
/** Avant le rattrapage général, attente au plus (sans connexion) de sa fin pour une personne jamais rattrapée. */
const ATTENTE_RATTRAPAGE_MS = 8_000;

type Executeur = Pick<typeof db, "execute">;
type Filtre = { depuis: Date; utilisateurId?: number };

/**
 * Une source : les actes candidats, une ligne par acte, avec les colonnes
 * uid, cle, type, points, fait_le (timestamptz), jour (date ou NULL : calculé
 * dans le fuseau de l'étudiant), cours_id, seance_id, objet_id.
 * plafond : nombre d'actes des types donnés par jour ou par séance.
 */
type Source = {
  nom: string;
  /** Table d'un autre chantier, et colonnes dont la source a besoin. */
  requiert?: Record<string, string[]>;
  plafond?: { par: "jour" | "seance"; max: number; types: TypeActivite[] };
  candidats: (f: Filtre) => SQL;
};

const depuisDe = (f: Filtre) => sql`${f.depuis.toISOString()}::timestamptz`;
const pourQui = (f: Filtre, colonne: SQL) => (f.utilisateurId ? sql`AND ${colonne} = ${f.utilisateurId}` : sql``);
const pts = (t: TypeActivite) => sql`${POINTS[t]}::int`;

/** Séance tenue (et pas annulée ensuite) d'un cours ouvert, hors essai de visio sans prévenir (comme sqlAttendus). */
const SQL_SEANCE_COMPTEE = sql`s.demarree_le IS NOT NULL AND s.statut <> 'annulee'
  AND NOT EXISTS (SELECT 1 FROM campus.cours c0 WHERE c0.id = s.cours_id AND c0.statut = 'brouillon')
  AND NOT EXISTS (SELECT 1 FROM campus.directs_immediats di WHERE di.seance_id = s.id AND NOT di.prevenir)`;

/** Minutes en ligne du seuil officiel de la séance (même calcul que le live et le pilotage). */
const SQL_SEUIL = sql`GREATEST(1, ceil((${SQL_DUREE_REFERENCE})::float8 * ${SEUIL_PRESENCE_EN_LIGNE}::float8))::int`;

/** L'étudiant suit ce cours : classe actuelle ou passée, ou inscription individuelle. */
const sqlSuitLeCours = (uid: SQL, coursId: SQL) => sql`${coursId} IN (
  SELECT cc.cours_id FROM campus.cours_classes cc
  WHERE cc.classe_id IN (SELECT e.classe_id FROM campus.utilisateurs e WHERE e.id = ${uid}
    UNION SELECT pc.classe_id FROM campus.passages_classes pc WHERE pc.utilisateur_id = ${uid})
  UNION SELECT i.cours_id FROM campus.inscriptions i WHERE i.utilisateur_id = ${uid})`;

export const SOURCES: Source[] = [
  {
    nom: "présences",
    candidats: (f) => sql`
      SELECT p.utilisateur_id AS uid, 'presence:' || s.id || ':' || p.utilisateur_id AS cle, 'presence'::text AS type, ${pts("presence")} AS points,
        COALESCE(p.arrivee_salle_le, s.demarree_le, s.debut) AS fait_le, NULL::date AS jour, s.cours_id, s.id AS seance_id, s.id AS objet_id
      FROM campus.presences p JOIN campus.seances s ON s.id = p.seance_id
      WHERE ${SQL_SEANCE_COMPTEE} AND NULLIF(p.justification, '') IS NULL
        AND (p.mode = 'salle' OR p.minutes >= LEAST(${MINUTES_PRESENCE}::int, ${SQL_SEUIL}))
        AND s.debut >= ${depuisDe(f)} ${pourQui(f, sql`p.utilisateur_id`)}`,
  },
  {
    nom: "présences au seuil",
    candidats: (f) => sql`
      SELECT p.utilisateur_id AS uid, 'presence-seuil:' || s.id || ':' || p.utilisateur_id AS cle, 'presence_seuil'::text AS type, ${pts("presence_seuil")} AS points,
        COALESCE(p.arrivee_salle_le, s.demarree_le, s.debut) AS fait_le, NULL::date AS jour, s.cours_id, s.id AS seance_id, s.id AS objet_id
      FROM campus.presences p JOIN campus.seances s ON s.id = p.seance_id
      WHERE ${SQL_SEANCE_COMPTEE} AND NULLIF(p.justification, '') IS NULL
        AND (p.mode = 'salle' OR p.minutes >= ${SQL_SEUIL})
        AND s.debut >= ${depuisDe(f)} ${pourQui(f, sql`p.utilisateur_id`)}`,
  },
  {
    // Premier dépôt : la clé est la même à l'heure et en retard, le premier inscrit reste.
    nom: "copies",
    candidats: (f) => sql`
      SELECT r.etudiant_id AS uid, 'devoir:' || r.devoir_id || ':' || r.etudiant_id AS cle,
        CASE WHEN r.en_retard THEN 'devoir_retard' ELSE 'devoir' END AS type,
        CASE WHEN r.en_retard THEN ${pts("devoir_retard")} ELSE ${pts("devoir")} END AS points,
        r.rendu_le AS fait_le, NULL::date AS jour, d.cours_id, NULL::int AS seance_id, d.id AS objet_id
      FROM campus.rendus r JOIN campus.devoirs d ON d.id = r.devoir_id
      WHERE d.type = 'depot' AND r.statut IN ('rendu', 'corrige') AND r.rendu_le IS NOT NULL
        AND r.rendu_le >= ${depuisDe(f)} ${pourQui(f, sql`r.etudiant_id`)}`,
  },
  {
    nom: "interrogations",
    candidats: (f) => sql`
      SELECT t.etudiant_id AS uid, 'quiz:' || t.devoir_id || ':' || t.etudiant_id AS cle, 'quiz'::text AS type, ${pts("quiz")} AS points,
        min(t.fin_le) AS fait_le, NULL::date AS jour, d.cours_id, NULL::int AS seance_id, d.id AS objet_id
      FROM campus.tentatives_quiz t JOIN campus.devoirs d ON d.id = t.devoir_id
      WHERE ${sqlTentativeRepondue("t")} AND t.fin_le >= ${depuisDe(f)} ${pourQui(f, sql`t.etudiant_id`)}
      GROUP BY t.etudiant_id, t.devoir_id, d.cours_id, d.id`,
  },
  {
    nom: "interrogations réussies",
    candidats: (f) => sql`
      SELECT t.etudiant_id AS uid, 'quiz-reussi:' || t.devoir_id || ':' || t.etudiant_id AS cle, 'quiz_reussi'::text AS type, ${pts("quiz_reussi")} AS points,
        min(t.fin_le) AS fait_le, NULL::date AS jour, d.cours_id, NULL::int AS seance_id, d.id AS objet_id
      FROM campus.tentatives_quiz t JOIN campus.devoirs d ON d.id = t.devoir_id
      WHERE ${sqlTentativeRepondue("t")} AND t.note IS NOT NULL AND d.bareme > 0 AND t.note >= d.bareme / 2.0
        AND t.fin_le >= ${depuisDe(f)} ${pourQui(f, sql`t.etudiant_id`)}
      GROUP BY t.etudiant_id, t.devoir_id, d.cours_id, d.id`,
  },
  {
    nom: "leçons",
    plafond: { par: "jour", max: PLAFONDS.leconsParJour, types: ["lecon"] },
    candidats: (f) => sql`
      SELECT pr.utilisateur_id AS uid, 'lecon:' || pr.lecon_id || ':' || pr.utilisateur_id AS cle, 'lecon'::text AS type, ${pts("lecon")} AS points,
        pr.terminee_le AS fait_le, NULL::date AS jour, l.cours_id, NULL::int AS seance_id, l.id AS objet_id
      FROM campus.progressions pr JOIN campus.lecons l ON l.id = pr.lecon_id
      WHERE pr.terminee_le >= ${depuisDe(f)} ${pourQui(f, sql`pr.utilisateur_id`)}`,
  },
  {
    nom: "questions en direct",
    plafond: { par: "seance", max: PLAFONDS.questionsParSeance, types: ["question"] },
    candidats: (f) => sql`
      SELECT q.auteur_id AS uid, 'question:' || q.id AS cle, 'question'::text AS type, ${pts("question")} AS points,
        q.cree_le AS fait_le, NULL::date AS jour, s.cours_id, s.id AS seance_id, q.id AS objet_id
      FROM campus.questions_live q JOIN campus.seances s ON s.id = q.seance_id
      WHERE NOT q.masquee AND q.cree_le >= ${depuisDe(f)} ${pourQui(f, sql`q.auteur_id`)}`,
  },
  {
    nom: "questions soutenues",
    plafond: { par: "seance", max: PLAFONDS.questionsParSeance, types: ["question_votee"] },
    candidats: (f) => sql`
      SELECT q.auteur_id AS uid, 'question-votee:' || q.id AS cle, 'question_votee'::text AS type, ${pts("question_votee")} AS points,
        q.cree_le AS fait_le, NULL::date AS jour, s.cours_id, s.id AS seance_id, q.id AS objet_id
      FROM campus.questions_live q JOIN campus.seances s ON s.id = q.seance_id
      WHERE NOT q.masquee AND q.cree_le >= ${depuisDe(f)} ${pourQui(f, sql`q.auteur_id`)}
        AND (SELECT count(*) FROM campus.votes_questions v WHERE v.question_id = q.id AND v.utilisateur_id <> q.auteur_id) >= ${VOTES_QUESTION}`,
  },
  {
    // Les réponses aux sondages n'ont pas d'heure : on prend le lancement du sondage (sinon la séance).
    nom: "sondages",
    plafond: { par: "seance", max: PLAFONDS.sondagesParSeance, types: ["sondage"] },
    candidats: (f) => sql`
      SELECT rs.utilisateur_id AS uid, 'sondage:' || rs.sondage_id || ':' || rs.utilisateur_id AS cle, 'sondage'::text AS type, ${pts("sondage")} AS points,
        COALESCE(so.ouvert_le, s.demarree_le, s.debut) AS fait_le, NULL::date AS jour, s.cours_id, s.id AS seance_id, so.id AS objet_id
      FROM campus.reponses_sondages rs JOIN campus.sondages so ON so.id = rs.sondage_id JOIN campus.seances s ON s.id = so.seance_id
      WHERE COALESCE(so.ouvert_le, s.demarree_le, s.debut) >= ${depuisDe(f)} ${pourQui(f, sql`rs.utilisateur_id`)}`,
  },
  {
    // Un ressenti par séance, quel que soit le nombre de clics, et seulement avec une vraie participation à
    // cette séance déjà inscrite (présence, question ou sondage) : un emoji touché seul ne rapporte rien.
    // Les sources de ces actes passent avant celle-ci.
    nom: "ressentis",
    candidats: (f) => sql`
      SELECT r.utilisateur_id AS uid, 'ressenti:' || r.seance_id || ':' || r.utilisateur_id AS cle, 'ressenti'::text AS type, ${pts("ressenti")} AS points,
        min(r.cree_le) AS fait_le, NULL::date AS jour, s.cours_id, s.id AS seance_id, s.id AS objet_id
      FROM campus.ressentis r JOIN campus.seances s ON s.id = r.seance_id
      WHERE r.cree_le >= ${depuisDe(f)} ${pourQui(f, sql`r.utilisateur_id`)}
        AND EXISTS (SELECT 1 FROM campus.activites a WHERE a.utilisateur_id = r.utilisateur_id AND a.seance_id = r.seance_id
          AND a.type IN ('presence', 'question', 'sondage'))
      GROUP BY r.utilisateur_id, r.seance_id, s.cours_id, s.id`,
  },
  {
    // Séance de ses cours où il n'a pas été compté présent, et replay où il est resté ou revenu.
    nom: "replays",
    plafond: { par: "jour", max: PLAFONDS.replaysParJour, types: ["replay"] },
    candidats: (f) => sql`
      SELECT v.utilisateur_id AS uid, 'replay:' || v.seance_id || ':' || v.utilisateur_id AS cle, 'replay'::text AS type, ${pts("replay")} AS points,
        v.derniere_vue AS fait_le, NULL::date AS jour, s.cours_id, s.id AS seance_id, s.id AS objet_id
      FROM campus.vues_replay v JOIN campus.seances s ON s.id = v.seance_id
      WHERE ${SQL_SEANCE_COMPTEE} AND v.derniere_vue >= v.premiere_vue + make_interval(mins => ${REPLAY_MINUTES}::int)
        AND v.derniere_vue >= ${depuisDe(f)} ${pourQui(f, sql`v.utilisateur_id`)}
        AND NOT EXISTS (SELECT 1 FROM campus.presences p WHERE p.seance_id = s.id AND p.utilisateur_id = v.utilisateur_id
          AND NULLIF(p.justification, '') IS NULL AND (p.mode = 'salle' OR p.minutes >= ${MINUTES_PRESENCE}::int))
        AND ${sqlSuitLeCours(sql`v.utilisateur_id`, sql`s.cours_id`)}`,
  },
  {
    // C1 (révision du jour) : chaque carte revue, juste ou non (décision D4 : les points paient l'effort, jamais
    // la seule réponse « Je savais »), une fois par carte et par jour, au jour où elle a été revue (même hors
    // ligne). Refaire le quiz du cours complet ne recompte pas une carte déjà revue ce jour-là.
    // La condition sur rr.jour (redondante avec recu_le : une réponse compte au plus 48 h en arrière) sert l'index.
    nom: "révision",
    requiert: { reponses_revision: ["utilisateur_id", "carte_id", "jour", "repondu_le", "recu_le"], cartes_revision: ["id", "cours_id", "seance_id"] },
    plafond: { par: "jour", max: PLAFONDS.revisionsParJour, types: ["revision"] },
    candidats: (f) => sql`
      SELECT rr.utilisateur_id AS uid, 'revision:' || rr.utilisateur_id || ':' || rr.carte_id || ':' || rr.jour::text AS cle,
        'revision'::text AS type, ${pts("revision")} AS points,
        min(rr.repondu_le) AS fait_le, rr.jour::date AS jour, cr.cours_id, cr.seance_id, rr.carte_id AS objet_id
      FROM campus.reponses_revision rr LEFT JOIN campus.cartes_revision cr ON cr.id = rr.carte_id
      WHERE rr.recu_le >= ${depuisDe(f)} AND rr.jour >= (${depuisDe(f)} AT TIME ZONE 'UTC')::date - 4 ${pourQui(f, sql`rr.utilisateur_id`)}
        -- Carte déjà payée ce jour-là sous une autre clé (lignes écrites avant la règle D4, une par réponse juste).
        AND NOT EXISTS (SELECT 1 FROM campus.activites a WHERE a.utilisateur_id = rr.utilisateur_id AND a.jour = rr.jour
          AND a.type = 'revision' AND a.objet_id = rr.carte_id)
      GROUP BY rr.utilisateur_id, rr.carte_id, rr.jour, cr.cours_id, cr.seance_id`,
  },
  {
    // C1 (cours complet suivi) : quiz d'entraînement terminé, une fois par séance.
    nom: "entraînement",
    requiert: { suivis_cours_complets: ["utilisateur_id", "seance_id", "ouvert_le", "revu_le", "quiz_meilleur", "quiz_total"] },
    candidats: (f) => sql`
      SELECT sc.utilisateur_id AS uid, 'entrainement:' || sc.seance_id || ':' || sc.utilisateur_id AS cle, 'entrainement'::text AS type, ${pts("entrainement")} AS points,
        COALESCE(sc.revu_le, sc.ouvert_le) AS fait_le, NULL::date AS jour, s.cours_id, s.id AS seance_id, s.id AS objet_id
      FROM campus.suivis_cours_complets sc JOIN campus.seances s ON s.id = sc.seance_id
      WHERE sc.quiz_total > 0 AND sc.quiz_meilleur IS NOT NULL AND COALESCE(sc.revu_le, sc.ouvert_le) >= ${depuisDe(f)} ${pourQui(f, sql`sc.utilisateur_id`)}`,
  },
  {
    // C2 (objectif du jour) : jour validé, s'il compte aussi un acte d'apprentissage déjà inscrit ce jour-là
    // (révision, copie, interrogation, présence, replay…) : une ouverture ou un clic seuls ne valent pas de
    // points. Sinon le jour validé attend : il est inscrit dès qu'un tel acte arrive (même hors ligne).
    // Dernière source : les actes du jour sont déjà inscrits.
    nom: "objectif du jour",
    requiert: { objectifs_jours: ["utilisateur_id", "jour", "valide_le"] },
    candidats: (f) => sql`
      SELECT oj.utilisateur_id AS uid, 'objectif:' || oj.utilisateur_id || ':' || oj.jour::text AS cle, 'objectif'::text AS type, ${pts("objectif")} AS points,
        oj.valide_le AS fait_le, oj.jour::date AS jour, NULL::int AS cours_id, NULL::int AS seance_id, NULL::int AS objet_id
      FROM campus.objectifs_jours oj
      WHERE oj.valide_le IS NOT NULL AND oj.valide_le >= ${depuisDe(f)} ${pourQui(f, sql`oj.utilisateur_id`)}
        AND EXISTS (SELECT 1 FROM campus.activites a WHERE a.utilisateur_id = oj.utilisateur_id AND a.jour = oj.jour::date
          AND a.type NOT IN ('objectif', 'ressenti'))`,
  },
];

// ── Garde-fous des sources ─────────────────────────────────────────────────

const colonnesConnues = new Map<string, { colonnes: Set<string>; le: number }>();
const sourcesSignalees = new Set<string>();

/** Colonnes d'une table du schéma campus (gardées 10 minutes, comme tableExiste). */
async function colonnesDe(table: string): Promise<Set<string>> {
  const connu = colonnesConnues.get(table);
  if (connu && Date.now() - connu.le < 10 * 60_000) return connu.colonnes;
  const r = await db.execute<{ c: string }>(
    sql`SELECT column_name AS c FROM information_schema.columns WHERE table_schema = 'campus' AND table_name = ${table}`,
  );
  const colonnes = new Set(r.rows.map((l) => l.c));
  colonnesConnues.set(table, { colonnes, le: Date.now() });
  return colonnes;
}

/** La source peut-elle tourner ? Une table d'un autre chantier absente ou différente : elle est sautée. */
async function sourceDisponible(s: Source): Promise<boolean> {
  for (const [table, attendues] of Object.entries(s.requiert ?? {})) {
    if (!(await tableExiste(table))) return false;
    const presentes = await colonnesDe(table);
    const manquantes = attendues.filter((c) => !presentes.has(c));
    if (manquantes.length) {
      if (!sourcesSignalees.has(s.nom)) {
        sourcesSignalees.add(s.nom);
        console.warn(`[progression] source « ${s.nom} » sautée : colonnes absentes dans ${table} (${manquantes.join(", ")}).`);
      }
      return false;
    }
  }
  return true;
}

let fuseauxValides: { liste: string[]; le: number } | null = null;

/**
 * Fuseaux des étudiants reconnus par PostgreSQL (gardés une heure) : un fuseau
 * mal saisi ne doit jamais faire échouer un passage, il retombe sur Abidjan.
 */
async function fuseauxEtudiants(): Promise<string[]> {
  if (fuseauxValides && Date.now() - fuseauxValides.le < 3600_000) return fuseauxValides.liste;
  const r = await db.execute<{ nom: string }>(sql`
    SELECT DISTINCT u.fuseau AS nom FROM campus.utilisateurs u
    WHERE u.role = 'etudiant' AND u.fuseau IS NOT NULL AND u.fuseau IN (SELECT name FROM pg_timezone_names)`);
  fuseauxValides = { liste: [FUSEAU_PAR_DEFAUT, ...r.rows.map((l) => l.nom)], le: Date.now() };
  return fuseauxValides.liste;
}

/** Tableau de textes PostgreSQL en un seul paramètre. */
const textes = (liste: string[]) => sql`${`{${liste.map((x) => `"${x.replace(/["\\]/g, "\\$&")}"`).join(",")}}`}::text[]`;

// ── Inscription ────────────────────────────────────────────────────────────

/**
 * Inscrit les actes nouveaux d'une source. Les candidats déjà inscrits (même
 * clé) sont écartés avant de compter le plafond ; le rang d'un acte dans sa
 * journée (ou sa séance) s'ajoute à ce qui est déjà inscrit. Renvoie les
 * étudiants qui ont reçu des points.
 */
async function inscrire(ex: Executeur, source: Source, f: Filtre, fuseaux: string[]): Promise<number[]> {
  const p = source.plafond;
  const partition = p?.par === "seance" ? sql`n.seance_id` : sql`n.jour`;
  const condition = !p
    ? sql`true`
    : p.par === "jour"
      ? sql`n.rn + (SELECT count(*) FROM campus.activites a WHERE a.utilisateur_id = n.uid AND a.jour = n.jour AND a.type = ANY(${textes(p.types)})) <= ${p.max}`
      : sql`n.seance_id IS NOT NULL AND n.rn + (SELECT count(*) FROM campus.activites a WHERE a.utilisateur_id = n.uid AND a.seance_id = n.seance_id AND a.type = ANY(${textes(p.types)})) <= ${p.max}`;
  const r = await ex.execute<{ uid: number }>(sql`
    WITH cand AS (${source.candidats(f)}),
    nouv AS (SELECT c.* FROM cand c WHERE c.fait_le IS NOT NULL AND NOT EXISTS (SELECT 1 FROM campus.activites a WHERE a.cle = c.cle)),
    prep AS (
      SELECT nv.uid, nv.cle, nv.type, nv.points, nv.fait_le, nv.cours_id, nv.seance_id, nv.objet_id, u.site_id, h.classe_id,
        COALESCE(nv.jour, (nv.fait_le AT TIME ZONE CASE WHEN u.fuseau = ANY(${textes(fuseaux)}) THEN u.fuseau ELSE ${FUSEAU_PAR_DEFAUT} END)::date) AS jour
      FROM nouv nv
      JOIN campus.utilisateurs u ON u.id = nv.uid AND u.role = 'etudiant'
      ${sqlClasseA(sql`nv.fait_le`)}
    ),
    num AS (SELECT n.*, row_number() OVER (PARTITION BY n.uid, ${partition} ORDER BY n.fait_le, n.cle) AS rn FROM prep n)
    INSERT INTO campus.activites (cle, utilisateur_id, type, points, jour, semaine, site_id, classe_id, cours_id, seance_id, objet_id, fait_le)
    SELECT n.cle, n.uid, n.type, n.points, n.jour, to_char(n.jour, 'IYYY"-W"IW'), n.site_id, n.classe_id, n.cours_id, n.seance_id, n.objet_id, n.fait_le
    FROM num n
    WHERE ${condition}
    ON CONFLICT (cle) DO NOTHING
    RETURNING utilisateur_id AS uid`);
  return r.rows.map((l) => l.uid);
}

export type BilanRegistre = {
  inscrits: number;
  etudiants: number[];
  parSource: Record<string, number>;
  /** Passage personnel sauté : un passage général tenait le verrou (rien n'a été inscrit). */
  saute: boolean;
  /** Actes retirés : présences et replays d'un direct annulé après son démarrage. */
  retires: number;
};

/**
 * Verrou d'une transaction du registre. Passage général : verrou exclusif (il
 * n'attend que les passages personnels en cours, qui durent quelques dizaines
 * de millisecondes). Passage personnel : verrou partagé et verrou à son nom,
 * pris seulement s'ils sont libres ; sinon false, sans attendre.
 */
async function verrouiller(ex: Executeur, f: Filtre): Promise<boolean> {
  if (!f.utilisateurId) {
    await ex.execute(sql`SELECT pg_advisory_xact_lock(${VERROU_REGISTRE}::bigint)`);
    return true;
  }
  const { rows } = await ex.execute<{ ok: boolean }>(sql`
    SELECT (pg_try_advisory_xact_lock_shared(${VERROU_REGISTRE}::bigint)
      AND pg_try_advisory_xact_lock(${VERROU_PERSONNE}::int, ${f.utilisateurId}::int)) AS ok`);
  return rows[0]?.ok === true;
}

/**
 * Présences et replays d'un direct annulé après son démarrage : la séance ne
 * compte plus (SQL_SEANCE_COMPTEE), ses points sortent du registre. Passages
 * généraux seulement ; rien à faire, et une seule petite requête, s'il n'y a
 * aucune séance annulée ainsi dans la fenêtre.
 */
async function retirerSeancesAnnulees(ex: Executeur, f: Filtre): Promise<number> {
  const { rows } = await ex.execute<{ id: number; debut: string }>(sql`
    SELECT s.id, s.debut FROM campus.seances s
    WHERE s.statut = 'annulee' AND s.demarree_le IS NOT NULL AND s.debut >= ${depuisDe(f)} - interval '1 day'`);
  if (!rows.length) return 0;
  const premier = rows.map((r) => new Date(r.debut).getTime()).reduce((a, b) => Math.min(a, b));
  // La semaine (index) borne la recherche : une semaine avant la première séance annulée, pour les fuseaux en retard.
  const r = await ex.execute(sql`
    DELETE FROM campus.activites a
    WHERE a.seance_id = ANY(ARRAY[${sql.join(rows.map((l) => sql`${l.id}`), sql`, `)}]::int[])
      AND a.type IN ('presence', 'presence_seuil', 'replay')
      AND a.semaine >= to_char((${new Date(premier).toISOString()}::timestamptz AT TIME ZONE 'UTC')::date - 7, 'IYYY"-W"IW')`);
  return r.rowCount ?? 0;
}

/**
 * Un passage du registre sur une fenêtre (et éventuellement pour une seule
 * personne), dans une transaction verrouillée. « parSource » (passages
 * généraux) : une transaction par source, pour ne tenir le verrou que le temps
 * d'une source. Un passage personnel tient en une transaction ; s'il ne peut
 * pas prendre ses verrous, il est sauté (bilan.saute).
 */
export async function passerRegistre(f: Filtre, options: { parSource?: boolean } = {}): Promise<BilanRegistre> {
  const fuseaux = await fuseauxEtudiants();
  const disponibles: Source[] = [];
  for (const s of SOURCES) if (await sourceDisponible(s)) disponibles.push(s);
  const bilan: BilanRegistre = { inscrits: 0, etudiants: [], parSource: {}, saute: false, retires: 0 };
  const touches = new Set<number>();
  type Etape = (ex: Executeur) => Promise<void>;
  const etapes: Etape[] = disponibles.map((s) => async (ex) => {
    const uids = await inscrire(ex, s, f, fuseaux);
    bilan.parSource[s.nom] = uids.length;
    bilan.inscrits += uids.length;
    for (const u of uids) touches.add(u);
  });
  if (!f.utilisateurId) etapes.unshift(async (ex) => void (bilan.retires = await retirerSeancesAnnulees(ex, f)));
  const enTransaction = (liste: Etape[]) =>
    db.transaction(async (tx) => {
      if (!(await verrouiller(tx, f))) {
        bilan.saute = true;
        return;
      }
      for (const e of liste) await e(tx);
    });
  if (options.parSource && !f.utilisateurId) {
    for (const e of etapes) await enTransaction([e]);
  } else {
    await enTransaction(etapes);
  }
  bilan.etudiants = [...touches];
  if (bilan.etudiants.length) await attribuerBadges(bilan.etudiants);
  return bilan;
}

/** Rattrapage depuis la rentrée (lundi 28 septembre 2026, 0 h à Abidjan), source par source. */
export function rattraperDepuisRentree(): Promise<BilanRegistre> {
  return passerRegistre({ depuis: new Date(`${RENTREE}T00:00:00Z`) }, { parSource: true });
}

const derniersPassagesPersonne = new Map<number, number>();
/** Passage personnel en cours : une seconde demande de la même personne l'attend (sans connexion) au lieu d'en lancer un autre. */
const passagesEnCours = new Map<number, Promise<{ saute: boolean }>>();
/** Avant le rattrapage général : personnes dont un passage personnel a déjà rattrapé le registre depuis la rentrée. */
const personnesRattrapees = new Set<number>();
const DEMARRAGE = Date.now();
let rattrapageFait = false;
let rattrapageEnCours: Promise<unknown> | null = null;
const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Passage pour une personne (sa page « Ma progression », le gain du jour) :
 * au plus une fois par minute ; sinon rien. Les actes d'il y a quelques
 * secondes apparaissent ainsi sans attendre le passage des 5 minutes.
 * Il n'attend jamais le verrou : pendant un passage général, il est sauté
 * ({ saute: true }) et le prochain affichage réessaiera.
 */
export function rafraichirPersonne(utilisateurId: number): Promise<{ saute: boolean }> {
  const enCours = passagesEnCours.get(utilisateurId);
  if (enCours) return enCours;
  const maintenant = Date.now();
  if (maintenant - (derniersPassagesPersonne.get(utilisateurId) ?? 0) < 60_000) return Promise.resolve({ saute: false });
  derniersPassagesPersonne.set(utilisateurId, maintenant);
  if (derniersPassagesPersonne.size > 5000) {
    for (const [id, le] of derniersPassagesPersonne) if (maintenant - le > 60_000) derniersPassagesPersonne.delete(id);
  }
  const passage = rafraichir(utilisateurId, maintenant).finally(() => passagesEnCours.delete(utilisateurId));
  passagesEnCours.set(utilisateurId, passage);
  return passage;
}

async function rafraichir(utilisateurId: number, maintenant: number): Promise<{ saute: boolean }> {
  // Tant que le rattrapage général n'est pas fait (2 minutes après le démarrage), le sien part de la rentrée :
  // ses semaines ne seront jamais jugées sur un registre incomplet.
  const complet = rattrapageFait || personnesRattrapees.has(utilisateurId);
  const depuis = complet ? new Date(maintenant - FENETRE_JOURS * JOUR_MS) : new Date(`${RENTREE}T00:00:00Z`);
  let bilan: BilanRegistre;
  try {
    bilan = await passerRegistre({ depuis, utilisateurId });
  } catch (e) {
    derniersPassagesPersonne.delete(utilisateurId);
    throw e;
  }
  if (!bilan.saute) {
    if (!rattrapageFait) personnesRattrapees.add(utilisateurId);
    return { saute: false };
  }
  // Un passage général tient le verrou : le prochain affichage réessaiera (et le passage des 5 minutes rattrape).
  derniersPassagesPersonne.delete(utilisateurId);
  if (complet) return { saute: true };
  // Registre jamais rattrapé pour cette personne, pendant le rattrapage général : on attend un peu sa fin
  // (sans tenir de connexion), sinon on demande de réessayer plutôt que de juger ses semaines dessus.
  const attente = rattrapageEnCours;
  if (attente) await Promise.race([attente.catch(() => undefined), pause(ATTENTE_RATTRAPAGE_MS)]);
  if (rattrapageFait) return { saute: false };
  throw new ErreurHttp(503, "Ta progression se met à jour : réessaie dans un instant.");
}

/** Le registre a-t-il été rattrapé depuis la rentrée depuis le démarrage ? La Coupe attend ce moment. */
export const rattrapageTermine = () => rattrapageFait;

// ── Tâches planifiées ──────────────────────────────────────────────────────

// Rattrapage depuis la rentrée, une fois par démarrage, 2 minutes après (le
// campus finit de démarrer, les migrations sont passées). Rejouable sans
// risque : il rattrape aussi ce qu'un arrêt de plus de 3 jours aurait manqué.
planifier("progression-rattrapage", 60_000, async () => {
  if (rattrapageFait || Date.now() - DEMARRAGE < 2 * 60_000) return;
  const debut = Date.now();
  const passage = rattraperDepuisRentree();
  rattrapageEnCours = passage;
  try {
    const bilan = await passage;
    rattrapageFait = true;
    personnesRattrapees.clear();
    console.log(`[progression] rattrapage depuis la rentrée : ${bilan.inscrits} actes inscrits, ${bilan.etudiants.length} étudiants (${Date.now() - debut} ms).`);
  } finally {
    rattrapageEnCours = null;
  }
});

// Source par source : le verrou n'est tenu que le temps d'une source, les passages personnels passent entre deux.
planifier("progression-registre", 5 * 60_000, async () => {
  if (!rattrapageFait) return;
  await passerRegistre({ depuis: new Date(Date.now() - FENETRE_JOURS * JOUR_MS) }, { parSource: true });
});
