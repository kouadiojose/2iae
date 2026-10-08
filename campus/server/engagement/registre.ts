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
//   - toutes les 5 minutes, sur les 3 derniers jours ;
//   - au premier passage après le démarrage (2 minutes après), rattrapage
//     depuis la rentrée du 28 septembre, source par source ;
//   - à la demande pour une personne (sa page de progression), au plus une
//     fois par minute.
// Un verrou PostgreSQL (pg_advisory_xact_lock) sérialise les passages : deux
// passages simultanés ne peuvent pas dépasser un plafond.
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { planifier } from "../taches";
import { tableExiste } from "./tables";
import { attribuerBadges } from "./badges";
import { POINTS, PLAFONDS, MINUTES_PRESENCE, VOTES_QUESTION, REPLAY_MINUTES, FENETRE_JOURS, RENTREE } from "./bareme";
import { SQL_DUREE_REFERENCE, sqlClasseA } from "../routes/admin";
import { FUSEAU_PAR_DEFAUT } from "@shared/engagement/calendrier";
import { SEUIL_PRESENCE_EN_LIGNE } from "@shared/schema";
import type { TypeActivite } from "@shared/engagement/progression";

const JOUR_MS = 86_400_000;
/** Clé du verrou PostgreSQL des passages du registre (nombre arbitraire, propre à C5). */
const VERROU_REGISTRE = 51_031_001;

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

/** Séance tenue d'un cours ouvert, hors essai de visio sans prévenir (comme sqlAttendus). */
const SQL_SEANCE_COMPTEE = sql`s.demarree_le IS NOT NULL
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

/** Interrogation avec au moins une réponse (une tentative clôturée vide ne rapporte rien). */
const sqlAuMoinsUneReponse = sql`EXISTS (SELECT 1 FROM jsonb_each(t.reponses) e WHERE e.value NOT IN ('[]'::jsonb, 'null'::jsonb, '""'::jsonb, '{}'::jsonb))`;

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
      WHERE t.fin_le IS NOT NULL AND ${sqlAuMoinsUneReponse} AND t.fin_le >= ${depuisDe(f)} ${pourQui(f, sql`t.etudiant_id`)}
      GROUP BY t.etudiant_id, t.devoir_id, d.cours_id, d.id`,
  },
  {
    nom: "interrogations réussies",
    candidats: (f) => sql`
      SELECT t.etudiant_id AS uid, 'quiz-reussi:' || t.devoir_id || ':' || t.etudiant_id AS cle, 'quiz_reussi'::text AS type, ${pts("quiz_reussi")} AS points,
        min(t.fin_le) AS fait_le, NULL::date AS jour, d.cours_id, NULL::int AS seance_id, d.id AS objet_id
      FROM campus.tentatives_quiz t JOIN campus.devoirs d ON d.id = t.devoir_id
      WHERE t.fin_le IS NOT NULL AND ${sqlAuMoinsUneReponse} AND t.note IS NOT NULL AND d.bareme > 0 AND t.note >= d.bareme / 2.0
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
    // Un ressenti par séance, quel que soit le nombre de clics.
    nom: "ressentis",
    candidats: (f) => sql`
      SELECT r.utilisateur_id AS uid, 'ressenti:' || r.seance_id || ':' || r.utilisateur_id AS cle, 'ressenti'::text AS type, ${pts("ressenti")} AS points,
        min(r.cree_le) AS fait_le, NULL::date AS jour, s.cours_id, s.id AS seance_id, s.id AS objet_id
      FROM campus.ressentis r JOIN campus.seances s ON s.id = r.seance_id
      WHERE r.cree_le >= ${depuisDe(f)} ${pourQui(f, sql`r.utilisateur_id`)}
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
    // C1 (révision du jour) : bonnes réponses, au jour où elles ont été faites (même hors ligne).
    nom: "révision",
    requiert: { reponses_revision: ["id", "utilisateur_id", "carte_id", "juste", "jour", "repondu_le", "recu_le"], cartes_revision: ["id", "cours_id", "seance_id"] },
    plafond: { par: "jour", max: PLAFONDS.revisionsParJour, types: ["revision"] },
    candidats: (f) => sql`
      SELECT rr.utilisateur_id AS uid, 'revision:' || rr.id AS cle, 'revision'::text AS type, ${pts("revision")} AS points,
        rr.repondu_le AS fait_le, rr.jour::date AS jour, cr.cours_id, cr.seance_id, rr.carte_id AS objet_id
      FROM campus.reponses_revision rr LEFT JOIN campus.cartes_revision cr ON cr.id = rr.carte_id
      WHERE rr.juste AND rr.recu_le >= ${depuisDe(f)} ${pourQui(f, sql`rr.utilisateur_id`)}`,
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
    // C2 (objectif du jour) : jour validé.
    nom: "objectif du jour",
    requiert: { objectifs_jours: ["utilisateur_id", "jour", "valide_le"] },
    candidats: (f) => sql`
      SELECT oj.utilisateur_id AS uid, 'objectif:' || oj.utilisateur_id || ':' || oj.jour::text AS cle, 'objectif'::text AS type, ${pts("objectif")} AS points,
        oj.valide_le AS fait_le, oj.jour::date AS jour, NULL::int AS cours_id, NULL::int AS seance_id, NULL::int AS objet_id
      FROM campus.objectifs_jours oj
      WHERE oj.valide_le IS NOT NULL AND oj.valide_le >= ${depuisDe(f)} ${pourQui(f, sql`oj.utilisateur_id`)}`,
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

export type BilanRegistre = { inscrits: number; etudiants: number[]; parSource: Record<string, number> };

/**
 * Un passage du registre sur une fenêtre (et éventuellement pour une seule
 * personne), dans une transaction verrouillée. « parSource » : une
 * transaction par source (rattrapage), pour ne pas bloquer longtemps.
 */
export async function passerRegistre(f: Filtre, options: { parSource?: boolean } = {}): Promise<BilanRegistre> {
  const fuseaux = await fuseauxEtudiants();
  const disponibles: Source[] = [];
  for (const s of SOURCES) if (await sourceDisponible(s)) disponibles.push(s);
  const bilan: BilanRegistre = { inscrits: 0, etudiants: [], parSource: {} };
  const touches = new Set<number>();
  const passer = async (ex: Executeur, s: Source) => {
    const uids = await inscrire(ex, s, f, fuseaux);
    bilan.parSource[s.nom] = uids.length;
    bilan.inscrits += uids.length;
    for (const u of uids) touches.add(u);
  };
  const verrouiller = (ex: Executeur) => ex.execute(sql`SELECT pg_advisory_xact_lock(${VERROU_REGISTRE})`);
  if (options.parSource) {
    for (const s of disponibles)
      await db.transaction(async (tx) => {
        await verrouiller(tx);
        await passer(tx, s);
      });
  } else {
    await db.transaction(async (tx) => {
      await verrouiller(tx);
      for (const s of disponibles) await passer(tx, s);
    });
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
const DEMARRAGE = Date.now();
let rattrapageFait = false;

/**
 * Passage pour une personne (sa page « Ma progression », le gain du jour) :
 * au plus une fois par minute ; sinon rien. Les actes d'il y a quelques
 * secondes apparaissent ainsi sans attendre le passage des 5 minutes.
 */
export async function rafraichirPersonne(utilisateurId: number): Promise<void> {
  const maintenant = Date.now();
  if (maintenant - (derniersPassagesPersonne.get(utilisateurId) ?? 0) < 60_000) return;
  derniersPassagesPersonne.set(utilisateurId, maintenant);
  if (derniersPassagesPersonne.size > 5000) {
    for (const [id, le] of derniersPassagesPersonne) if (maintenant - le > 60_000) derniersPassagesPersonne.delete(id);
  }
  // Tant que le rattrapage général n'est pas fait (2 minutes après le démarrage), le sien part de la rentrée :
  // ses semaines ne seront jamais jugées sur un registre incomplet.
  const depuis = rattrapageFait ? new Date(maintenant - FENETRE_JOURS * JOUR_MS) : new Date(`${RENTREE}T00:00:00Z`);
  await passerRegistre({ depuis, utilisateurId });
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
  const bilan = await rattraperDepuisRentree();
  rattrapageFait = true;
  console.log(`[progression] rattrapage depuis la rentrée : ${bilan.inscrits} actes inscrits, ${bilan.etudiants.length} étudiants (${Date.now() - debut} ms).`);
});

planifier("progression-registre", 5 * 60_000, async () => {
  if (!rattrapageFait) return;
  await passerRegistre({ depuis: new Date(Date.now() - FENETRE_JOURS * JOUR_MS) });
});
