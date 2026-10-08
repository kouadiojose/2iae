// « Le travail du campus » (chantier S1, demande de José du 8 octobre 2026) : le fil des séances tenues et ce que
// le campus en a fait, et les grands chiffres de la période. Contrat : shared/engagement/fil.ts ; routes :
// server/routes/fil.ts.
//
// Aucune règle n'est récrite ici, elles sont reprises telles quelles :
//   - séance tenue : démarrée (demarree_le), pas annulée, pas un essai de visio (direct immédiat sans prévenir),
//     cours pas en brouillon : exactement les séances que compte sqlAttendus (admin.ts) ;
//   - présence en trois états : sqlAttendus, COLONNES_RESUME et versResume (comme le pilotage), qui donnent les
//     mêmes attendus, présents et taux que le bilan de séance (feuillePresence) ; « inconnus » compte les états
//     « inconnu » (engagement/presence.ts), comme « Après la séance » ;
//   - QCM et exercice : les devoirs automatiques de la séance (devoirs_seances.devoir_ids), avec les mêmes
//     comptes qu'« Après la séance » (formateurs.ts, apresSeance) : envoyé aux étudiants du cours
//     (etudiantsDuCours), faits, moyenne des copies notées, notées, à revoir (corrections_auto), en attente ;
//   - vidéo prête comme « Après la séance » et la liste des replays (lien ou enregistrement d'une séance terminée),
//     vues des étudiants (vues_replay) ; cours résumé : etudes_seances.statut, ouvertures suivis_cours_complets ;
//   - formateur affiché : l'intervenant de l'emploi du temps, sinon le formateur du cours (animateursDes, live.ts).
// Vie scolaire, ou direction qui choisit un campus : les cours suivis par ce campus, et seuls ses étudiants comptent
// (présence, copies, destinataires, vues, ouvertures), comme la feuille de présence du bilan.
// Une séance en direct est déjà dans le fil (statut « en_direct », présence provisoire) ; un QCM ou un exercice
// masqué aux étudiants (non publié) n'y est pas : il n'a pas été envoyé.
//
// Grands chiffres de la période (séances à leur date réelle) : séances tenues ; cours résumés prêts de ces séances ;
// QCM et exercices envoyés (publiés et ouverts pendant la période, ceux des formateurs compris) ; copies d'exercice
// rendues, notées (note publiée) et notées par le campus pendant la période ; moyenne de toutes les notes publiées
// pendant la période, QCM compris, ramenées sur 20 ; présence de ces séances (même règle que le fil).
//
// Coût : une page du fil fait trois requêtes (la page, puis en parallèle le détail et la présence), quel que soit
// le nombre de séances ; les grands chiffres en font deux, en parallèle. Les deux sont gardés deux minutes par
// périmètre et par filtre, un seul calcul à la fois pour une même clé (comme le tableau de pilotage).
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { peut, perimetreSites } from "../auth";
import { COLONNES_RESUME, sqlAttendus, versResume } from "../routes/admin";
import { coursEnseignes } from "./formateurs";
import type { StatutSeance, Utilisateur } from "@shared/schema";
import type { StatutCorrige } from "@shared/engagement/corrections";
import type { EtatResume, FilSeance, FilSeances, ResumeTravail } from "@shared/engagement/fil";

/** Taille d'une page du fil, par défaut et au plus. */
export const LIMITE_FIL = 20;
export const LIMITE_FIL_MAX = 50;
/** Périodes des grands chiffres (jours). */
export const PERIODES_FIL = [7, 30] as const;
/** Durée de garde des calculs (comme /api/pilotage/tableau). */
const GARDE_MS = 2 * 60_000;
const JOUR_MS = 24 * 3_600_000;

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
/** Littéral SQL d'un tableau d'entiers (identifiants déjà validés). */
const entiers = (ids: readonly number[]) => sql`${`{${ids.map((i) => Math.trunc(i)).join(",")}}`}::int[]`;
const dixieme = (v: unknown) => (v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10);

// ── Périmètre et filtres ────────────────────────────────────────────────────

export type FiltresFil = { coursId?: number; formateurId?: number; siteId?: number };

/**
 * Ce que la personne regarde : les cours (null : tous ceux que les campus permettent), les campus dont on compte les
 * étudiants (null : tous), et les filtres. Formateur : les cours qu'il enseigne, co-formateurs compris
 * (coursEnseignes). Équipe : les cours suivis par ses campus, ou sans classe (comme idsCoursAccessibles) ; la
 * direction peut choisir un campus, la vie scolaire reste dans le sien.
 */
type Cadre = {
  coursIds: number[] | null;
  sites: number[] | null;
  coursId: number | null;
  formateurId: number | null;
};

/** La clé de garde (tout ce dont dépend le calcul) et le cadre, lu seulement pour un vrai calcul. */
type Demande = { cle: string; cadre: () => Promise<Cadre> };

function demandeDe(u: Utilisateur, f: FiltresFil): Demande {
  const perimetre = perimetreSites(u);
  const sites = f.siteId ? (perimetre ? perimetre.filter((s) => s === f.siteId) : [f.siteId]) : perimetre;
  const formateur = u.role === "formateur";
  const base = { sites, coursId: f.coursId ?? null, formateurId: f.formateurId ?? null };
  return {
    // Équipe : le calcul ne dépend que des campus et des filtres (la direction et la vie scolaire du groupe le partagent).
    cle: JSON.stringify([formateur ? `F${u.id}` : "E", sites, base.coursId, base.formateurId]),
    cadre: async () => ({ ...base, coursIds: formateur ? await coursEnseignes(u) : null }),
  };
}

/** Conditions sur le cours (alias c) : périmètre, filtres de cours, de formateur (principal ou co-formateur) et de campus. */
function conditionsCours(k: Cadre): SQL[] {
  const conds: SQL[] = [sql`c.statut <> 'brouillon'`];
  if (k.coursIds) conds.push(sql`c.id = ANY(${entiers(k.coursIds)})`);
  if (k.coursId) conds.push(sql`c.id = ${k.coursId}`);
  if (k.sites) {
    // Cours suivi par une classe de ces campus, ou sans classe (inscriptions individuelles) : idsCoursAccessibles.
    conds.push(sql`(EXISTS (SELECT 1 FROM campus.cours_classes cc JOIN campus.classes cl ON cl.id = cc.classe_id
        WHERE cc.cours_id = c.id AND cl.site_id = ANY(${entiers(k.sites)}))
      OR NOT EXISTS (SELECT 1 FROM campus.cours_classes cc WHERE cc.cours_id = c.id))`);
  }
  return conds;
}

/** Séances tenues (alias s, cours c) du cadre : les mêmes que sqlAttendus, plus le filtre de formateur. */
function conditionsSeances(k: Cadre): SQL[] {
  const conds = [
    ...conditionsCours(k),
    sql`s.demarree_le IS NOT NULL`,
    sql`s.statut <> 'annulee'`,
    sql`NOT EXISTS (SELECT 1 FROM campus.directs_immediats di WHERE di.seance_id = s.id AND NOT di.prevenir)`,
  ];
  if (k.formateurId) {
    const f = k.formateurId;
    conds.push(sql`(c.formateur_id = ${f}
      OR EXISTS (SELECT 1 FROM campus.cours_formateurs cf WHERE cf.cours_id = c.id AND cf.formateur_id = ${f})
      OR EXISTS (SELECT 1 FROM campus.seances_creneaux scf JOIN campus.creneaux_programme cpf ON cpf.id = scf.creneau_id
        WHERE scf.seance_id = s.id AND cpf.intervenant_id = ${f}))`);
  }
  return conds;
}

/** Devoirs (alias d, cours c) du cadre : le filtre de formateur porte sur le cours. */
function conditionsDevoirs(k: Cadre): SQL[] {
  const conds = conditionsCours(k);
  if (k.formateurId) {
    const f = k.formateurId;
    conds.push(sql`(c.formateur_id = ${f} OR EXISTS (SELECT 1 FROM campus.cours_formateurs cf WHERE cf.cours_id = c.id AND cf.formateur_id = ${f}))`);
  }
  return conds;
}

const et = (conds: SQL[]) => sql.join(conds, sql` AND `);

/** Étudiants (alias e) des campus regardés ; rien à ajouter pour tout le groupe. */
const duSite = (k: Cadre) => (k.sites ? sql`AND e.site_id = ANY(${entiers(k.sites)})` : sql``);

// ── Garde des calculs ───────────────────────────────────────────────────────

const gardes = new Map<string, { le: number; promesse: Promise<unknown> }>();
/** Au-delà, les calculs périmés sont oubliés tout de suite (chaque curseur et chaque filtre fait une clé). */
const GARDES_MAX = 500;
function oublierPerimes() {
  const limite = Date.now() - GARDE_MS;
  for (const [cle, g] of gardes) if (g.le < limite) gardes.delete(cle);
}
setInterval(oublierPerimes, GARDE_MS).unref();

/** Calcul gardé GARDE_MS par clé ; les visites simultanées attendent le même calcul ; un échec n'est pas gardé. */
function garde<T>(cle: string, calcul: () => Promise<T>): Promise<T> {
  const connu = gardes.get(cle);
  if (connu && Date.now() - connu.le < GARDE_MS) return connu.promesse as Promise<T>;
  if (gardes.size >= GARDES_MAX) oublierPerimes();
  if (gardes.size >= GARDES_MAX) gardes.clear();
  const promesse = calcul();
  gardes.set(cle, { le: Date.now(), promesse });
  promesse.catch(() => gardes.get(cle)?.promesse === promesse && gardes.delete(cle));
  return promesse;
}

// ── Le fil des séances ──────────────────────────────────────────────────────

type LignePage = {
  id: number;
  titre: string;
  debut: Date;
  demarree_le: Date;
  terminee_le: Date | null;
  statut: StatutSeance;
  cours_id: number;
  cours_code: string;
  cours_titre: string;
  cours_couleur: string;
  video_prete: boolean;
  formateur_id: number | null;
  formateur_prenom: string | null;
  formateur_nom: string | null;
  /** Date réelle à la microseconde : le curseur de la page suivante. */
  curseur: string;
};

type DevoirFil = {
  id: number;
  type: "quiz" | "depot";
  titre: string;
  bareme: number;
  corrige: StatutCorrige | null;
  faits: number;
  notees: number;
  a_revoir: number;
  moyenne: number | null;
};

type LigneDetail = {
  seance_id: number;
  etude: EtatResume | null;
  ouvertures: number;
  vues: number;
  questions: number;
  sondages: number;
  destinataires: number;
  devoirs: DevoirFil[];
};

/** Une ligne de COLONNES_RESUME (attendus et statuts), lue par versResume. */
type ComptesPresence = NonNullable<Parameters<typeof versResume>[0]>;
type LignePresence = { seance_id: number; inconnus_etats: number } & ComptesPresence;

/** Ce que la personne peut ouvrir (les liens), décidé à chaque visite : le calcul gardé n'en dépend pas. */
type Droits = { copies: boolean; seance: boolean };

export function droitsFil(u: Utilisateur): Droits {
  return {
    // Copies d'un devoir : formateurs, direction, et l'équipe qui a le droit « notes » (routes du client).
    copies: u.role !== "vie_scolaire" || peut(u, "notes"),
    // Page de la séance (préparer, bilan) : formateur du cours, direction, équipe du programme.
    seance: u.role === "formateur" || u.role === "admin" || (u.role === "vie_scolaire" && peut(u, "programme")),
  };
}

type PageBrute = { lignes: LignePage[]; details: Map<number, LigneDetail>; presences: Map<number, LignePresence>; suivant: string | null };

async function calculerPage(k: Cadre, avant: string | null, limite: number): Promise<PageBrute> {
  if (k.coursIds && !k.coursIds.length) return { lignes: [], details: new Map(), presences: new Map(), suivant: null };
  const conds = conditionsSeances(k);
  if (avant) conds.push(sql`s.demarree_le < ${avant}::timestamptz`);
  // 1. La page : les séances tenues, de la plus récente à la plus ancienne (date réelle), une de plus pour savoir s'il y a une suite.
  const page = await db.execute<LignePage>(sql`
    SELECT s.id, s.titre, s.debut, s.demarree_le, s.terminee_le, s.statut, s.cours_id,
           c.code AS cours_code, c.titre AS cours_titre, c.couleur AS cours_couleur,
           (s.statut = 'terminee' AND (NULLIF(s.replay_url, '') IS NOT NULL OR NULLIF(s.enregistrement_id, '') IS NOT NULL)) AS video_prete,
           f.id AS formateur_id, f.prenom AS formateur_prenom, f.nom AS formateur_nom,
           to_char(s.demarree_le AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS curseur
    FROM campus.seances s
    JOIN campus.cours c ON c.id = s.cours_id
    LEFT JOIN campus.seances_creneaux sc ON sc.seance_id = s.id
    LEFT JOIN campus.creneaux_programme cp ON cp.id = sc.creneau_id
    LEFT JOIN campus.utilisateurs f ON f.id = COALESCE(cp.intervenant_id, c.formateur_id)
    WHERE ${et(conds)}
    ORDER BY s.demarree_le DESC, s.id DESC
    LIMIT ${limite + 1}`);
  let lignes = page.rows.slice(0, limite);
  if (page.rows.length > limite) {
    // Le curseur est une date : des séances démarrées au même instant restent ensemble sur la page suivante.
    const coupe = page.rows[limite].curseur;
    const avantLaCoupe = lignes.filter((l) => l.curseur !== coupe);
    if (avantLaCoupe.length) lignes = avantLaCoupe;
  }
  const suivant = page.rows.length > limite ? lignes[lignes.length - 1].curseur : null;
  if (!lignes.length) return { lignes, details: new Map(), presences: new Map(), suivant };

  const ids = entiers(lignes.map((l) => l.id));
  const coursIds = entiers([...new Set(lignes.map((l) => l.cours_id))]);
  const dates = lignes.map((l) => new Date(l.demarree_le).getTime());
  const [details, presences] = await Promise.all([
    // 2. Le détail de toutes les séances de la page, en une requête.
    db.execute<LigneDetail>(sql`
      WITH lien AS (
        -- Devoirs automatiques publiés de chaque séance (devoirs_seances) : le premier QCM, le premier exercice.
        SELECT ds.seance_id, d.id, d.type, d.titre, d.bareme, cd.statut AS corrige,
               row_number() OVER (PARTITION BY ds.seance_id, d.type ORDER BY d.id) AS rang
        FROM campus.devoirs_seances ds
        CROSS JOIN LATERAL jsonb_array_elements_text(ds.devoir_ids) AS x(id)
        JOIN campus.devoirs d ON d.id = x.id::int
        LEFT JOIN campus.corriges_devoirs cd ON cd.devoir_id = d.id
        WHERE ds.seance_id = ANY(${ids}) AND d.publie
      ),
      choisis AS (SELECT * FROM lien WHERE rang = 1),
      stats AS (
        -- Mêmes comptes qu'« Après la séance » : copies hors brouillon, notées (publiées), à revoir (correction du campus).
        SELECT r.devoir_id, count(*)::int AS faits,
               count(*) FILTER (WHERE r.statut = 'corrige')::int AS notees,
               count(*) FILTER (WHERE r.statut = 'rendu' AND ca.etat = 'a_revoir')::int AS a_revoir,
               avg(r.note) FILTER (WHERE r.statut = 'corrige') AS moyenne
        FROM campus.rendus r
        JOIN campus.utilisateurs e ON e.id = r.etudiant_id
        LEFT JOIN campus.corrections_auto ca ON ca.rendu_id = r.id
        WHERE r.devoir_id IN (SELECT id FROM choisis) AND r.statut <> 'brouillon' ${duSite(k)}
        GROUP BY r.devoir_id
      ),
      destinataires AS (
        -- Étudiants actifs du cours, par leur classe ou une inscription (etudiantsDuCours).
        SELECT x.cours_id, count(DISTINCT x.uid)::int AS n
        FROM (
          SELECT cc.cours_id, e.id AS uid FROM campus.cours_classes cc JOIN campus.utilisateurs e ON e.classe_id = cc.classe_id
          WHERE cc.cours_id = ANY(${coursIds})
          UNION SELECT i.cours_id, i.utilisateur_id FROM campus.inscriptions i WHERE i.cours_id = ANY(${coursIds})
        ) x
        JOIN campus.utilisateurs e ON e.id = x.uid AND e.role = 'etudiant' AND e.actif ${duSite(k)}
        GROUP BY x.cours_id
      )
      SELECT s.id AS seance_id,
        (SELECT es.statut FROM campus.etudes_seances es WHERE es.seance_id = s.id) AS etude,
        (SELECT count(*)::int FROM campus.suivis_cours_complets scc
          ${k.sites ? sql`JOIN campus.utilisateurs e ON e.id = scc.utilisateur_id` : sql``}
          WHERE scc.seance_id = s.id ${duSite(k)}) AS ouvertures,
        (SELECT count(*)::int FROM campus.vues_replay vr JOIN campus.utilisateurs e ON e.id = vr.utilisateur_id
          WHERE vr.seance_id = s.id AND e.role = 'etudiant' ${duSite(k)}) AS vues,
        (SELECT count(*)::int FROM campus.questions_live q WHERE q.seance_id = s.id AND NOT q.masquee) AS questions,
        (SELECT count(*)::int FROM campus.sondages so WHERE so.seance_id = s.id AND so.ouvert_le IS NOT NULL) AS sondages,
        COALESCE(de.n, 0) AS destinataires,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', ch.id, 'type', ch.type, 'titre', ch.titre, 'bareme', ch.bareme, 'corrige', ch.corrige,
            'faits', COALESCE(st.faits, 0), 'notees', COALESCE(st.notees, 0), 'a_revoir', COALESCE(st.a_revoir, 0),
            'moyenne', st.moyenne) ORDER BY ch.type DESC, ch.id)
          FROM choisis ch LEFT JOIN stats st ON st.devoir_id = ch.id WHERE ch.seance_id = s.id), '[]'::json) AS devoirs
      FROM campus.seances s
      LEFT JOIN destinataires de ON de.cours_id = s.cours_id
      WHERE s.id = ANY(${ids})`),
    // 3. La présence en trois états de toutes les séances de la page (la règle du pilotage et du bilan).
    db.execute<LignePresence>(sql`
      SELECT a.seance_id, ${COLONNES_RESUME}, count(*) FILTER (WHERE a.etat = 'inconnu')::int AS inconnus_etats
      FROM (${sqlAttendus({ depuis: new Date(Math.min(...dates)), jusqua: new Date(Math.max(...dates) + 1), sites: k.sites, inclureEnCours: true })}) a
      WHERE a.seance_id = ANY(${ids})
      GROUP BY a.seance_id`),
  ]);
  return {
    lignes,
    details: new Map(details.rows.map((d) => [d.seance_id, d])),
    presences: new Map(presences.rows.map((p) => [p.seance_id, p])),
    suivant,
  };
}

function versFilSeance(l: LignePage, d: LigneDetail | undefined, p: LignePresence | undefined, droits: Droits): FilSeance {
  const etat: EtatResume = d?.etude ?? "a_venir";
  const devoirs = d?.devoirs ?? [];
  const destinataires = d?.destinataires ?? 0;
  const lienDevoir = (id: number) => (droits.copies ? `/enseigner/devoirs/${id}/copies` : `/devoirs/${id}`);
  const quiz = devoirs.find((x) => x.type === "quiz");
  const depot = devoirs.find((x) => x.type === "depot");
  const resume = versResume(p);
  return {
    id: l.id,
    titre: l.titre,
    debut: new Date(l.debut).toISOString(),
    demarreeLe: iso(l.demarree_le),
    termineeLe: iso(l.terminee_le),
    statut: l.statut,
    cours: { id: l.cours_id, code: l.cours_code, titre: l.cours_titre, couleur: l.cours_couleur },
    formateur: l.formateur_id !== null ? { id: l.formateur_id, prenom: l.formateur_prenom ?? "", nom: l.formateur_nom ?? "" } : null,
    video: { pret: l.video_prete, vues: d?.vues ?? 0, lien: l.video_prete ? `/replays/${l.id}` : null },
    resume: { etat, ouvertures: d?.ouvertures ?? 0, lien: etat === "prete" ? `/mediatheque/cours/${l.id}` : null },
    qcm: quiz
      ? {
          devoirId: quiz.id,
          titre: quiz.titre,
          envoyeA: destinataires,
          faits: quiz.faits,
          moyenne: dixieme(quiz.moyenne),
          bareme: Number(quiz.bareme),
          corrige: quiz.corrige,
          lien: lienDevoir(quiz.id),
        }
      : null,
    exercice: depot
      ? {
          devoirId: depot.id,
          titre: depot.titre,
          envoyeA: destinataires,
          rendues: depot.faits,
          notees: depot.notees,
          enAttente: Math.max(0, depot.faits - depot.notees - depot.a_revoir),
          aRevoir: depot.a_revoir,
          moyenne: dixieme(depot.moyenne),
          bareme: Number(depot.bareme),
          corrige: depot.corrige,
          lien: lienDevoir(depot.id),
        }
      : null,
    presence: { attendus: resume.attendus, presents: resume.presents, inconnus: p?.inconnus_etats ?? 0, taux: resume.taux },
    participation: { questions: d?.questions ?? 0, sondages: d?.sondages ?? 0 },
    lienSeance: droits.seance ? `/enseigner/seances/${l.id}` : null,
  };
}

/** GET /api/fil/seances : une page du fil, dans le périmètre de la personne. */
export async function filSeances(u: Utilisateur, f: FiltresFil & { avant?: string; limite?: number }): Promise<FilSeances> {
  const demande = demandeDe(u, f);
  const limite = Math.min(LIMITE_FIL_MAX, Math.max(1, f.limite ?? LIMITE_FIL));
  const avant = f.avant ?? null;
  const brut = await garde(`fil|${demande.cle}|${avant}|${limite}`, async () => calculerPage(await demande.cadre(), avant, limite));
  const droits = droitsFil(u);
  return {
    seances: brut.lignes.map((l) => versFilSeance(l, brut.details.get(l.id), brut.presences.get(l.id), droits)),
    suivant: brut.suivant,
  };
}

// ── Les grands chiffres de la période ───────────────────────────────────────

type LigneChiffres = {
  seances: number;
  resumes: number;
  qcm: number;
  exercices: number;
  rendues: number;
  notees: number;
  campus: number;
  moyenne: number | null;
};

async function calculerResume(k: Cadre, jours: number): Promise<ResumeTravail> {
  const depuis = new Date(Date.now() - jours * JOUR_MS);
  const vide: ResumeTravail = {
    depuis: depuis.toISOString(),
    jours,
    seancesTenues: 0,
    coursResumes: 0,
    qcmEnvoyes: 0,
    exercicesEnvoyes: 0,
    copiesRendues: 0,
    copiesNotees: 0,
    noteesParLeCampus: 0,
    moyenneSur20: null,
    presence: { presents: 0, attendus: 0, taux: null },
  };
  if (k.coursIds && !k.coursIds.length) return vide;
  const d0 = sql`${depuis.toISOString()}::timestamptz`;
  // Les séances tenues de la période (date réelle), mêmes règles que le fil.
  const tenues = sql`SELECT s.id FROM campus.seances s JOIN campus.cours c ON c.id = s.cours_id
    WHERE ${et(conditionsSeances(k))} AND s.demarree_le >= ${d0}`;
  const [chiffres, presence] = await Promise.all([
    db.execute<LigneChiffres>(sql`
      WITH tenues AS (${tenues}),
      envoyes AS (
        -- QCM et exercices envoyés pendant la période : publiés et ouverts (ceux du campus comme ceux des formateurs).
        SELECT count(*) FILTER (WHERE d.type = 'quiz')::int AS qcm, count(*) FILTER (WHERE d.type = 'depot')::int AS exercices
        FROM campus.devoirs d JOIN campus.cours c ON c.id = d.cours_id
        WHERE ${et(conditionsDevoirs(k))} AND d.publie
          AND COALESCE(d.ouverture_le, d.cree_le) >= ${d0} AND COALESCE(d.ouverture_le, d.cree_le) <= now()
      ),
      copies AS (
        -- Copies d'exercice rendues et notées (note publiée) pendant la période, dont par le campus ; moyenne de
        -- toutes les notes publiées de la période (QCM compris), ramenées sur 20.
        SELECT count(*) FILTER (WHERE d.type = 'depot' AND r.rendu_le >= ${d0})::int AS rendues,
               count(*) FILTER (WHERE d.type = 'depot' AND r.statut = 'corrige' AND r.corrige_le >= ${d0})::int AS notees,
               count(*) FILTER (WHERE d.type = 'depot' AND r.statut = 'corrige' AND r.corrige_le >= ${d0} AND r.origine_note = 'campus')::int AS campus,
               avg(r.note / d.bareme * 20) FILTER (WHERE r.statut = 'corrige' AND r.corrige_le >= ${d0} AND r.note IS NOT NULL AND d.bareme > 0) AS moyenne
        FROM campus.rendus r
        JOIN campus.devoirs d ON d.id = r.devoir_id
        JOIN campus.cours c ON c.id = d.cours_id
        JOIN campus.utilisateurs e ON e.id = r.etudiant_id
        WHERE ${et(conditionsDevoirs(k))} AND r.statut <> 'brouillon' AND (r.rendu_le >= ${d0} OR r.corrige_le >= ${d0}) ${duSite(k)}
      )
      SELECT (SELECT count(*)::int FROM tenues) AS seances,
             (SELECT count(*)::int FROM tenues t JOIN campus.etudes_seances es ON es.seance_id = t.id WHERE es.statut = 'prete') AS resumes,
             envoyes.qcm, envoyes.exercices, copies.rendues, copies.notees, copies.campus, copies.moyenne
      FROM envoyes, copies`),
    db.execute<ComptesPresence>(sql`
      SELECT ${COLONNES_RESUME}
      FROM (${sqlAttendus({ depuis, sites: k.sites, inclureEnCours: true })}) a
      WHERE a.seance_id IN (${tenues})`),
  ]);
  const c = chiffres.rows[0];
  const p = versResume(presence.rows[0]);
  return {
    ...vide,
    seancesTenues: c?.seances ?? 0,
    coursResumes: c?.resumes ?? 0,
    qcmEnvoyes: c?.qcm ?? 0,
    exercicesEnvoyes: c?.exercices ?? 0,
    copiesRendues: c?.rendues ?? 0,
    copiesNotees: c?.notees ?? 0,
    noteesParLeCampus: c?.campus ?? 0,
    moyenneSur20: dixieme(c?.moyenne),
    presence: { presents: p.presents, attendus: p.attendus, taux: p.taux },
  };
}

/** GET /api/fil/resume : les grands chiffres de la période, dans le périmètre de la personne. */
export async function resumeTravail(u: Utilisateur, f: FiltresFil & { jours: number }): Promise<ResumeTravail> {
  const demande = demandeDe(u, f);
  return garde(`resume|${demande.cle}|${f.jours}`, async () => calculerResume(await demande.cadre(), f.jours));
}
