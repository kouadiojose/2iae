// Côté formateur (plan d'engagement, chantier C7). Amendement de José du
// 8 octobre 2026 : les formateurs utilisent peu la plateforme et ne donnent
// presque pas de devoirs ; le QCM et l'exercice de la routine du soir arrivent
// aux étudiants SANS eux. Ici, on leur MONTRE ce que le campus a fait :
//
//   - « Après la séance » : présence (même calcul que le bilan, plus les
//     présences inconnues), participation, replay, cours complet, devoirs
//     envoyés et combien les ont faits, copies à corriger ;
//   - la correction rapide : copies en attente (les plus anciennes d'abord),
//     envoi d'une note à un seul étudiant, tout de suite ;
//   - la relecture FACULTATIVE des devoirs de l'IA (validations_devoirs_auto,
//     lue par proposables.ts) ;
//   - le travail de groupe du cours complet ouvert en devoir de dépôt ;
//   - un rappel du matin, à 8 h chez le formateur, du lundi au vendredi :
//     copies de SES devoirs en attente depuis 48 h, questions du salon sans
//     réponse depuis 24 h ; au plus trois fois pour un même lot, un jour sur
//     deux, puis plus rien tant que rien de nouveau n'arrive. La relecture des
//     QCM n'en déclenche jamais : elle est facultative.
//
// Décision D2 (revue de l'engagement) : les copies des exercices automatiques
// (routine du soir, devoirs_seances) ne relancent jamais le formateur et ne
// sont jamais son action principale « Corriger N copies ». Elles restent
// corrigeables s'il le souhaite : « facultatives », à part dans /corriger.
//
// Décision D6 (correction automatique, José, 8 octobre 2026) : le campus
// corrige lui-même les copies des devoirs qui ont un corrigé (corriges_devoirs,
// sqlCorrigeParLeCampus) : elles ne sont plus ni « à corriger » ni
// « facultatives ». Le travail du formateur devient : valider les corrigés du
// jour (server/corriges.ts), trancher les copies que le campus lui laisse
// (« à revoir ») et répondre aux demandes de relecture ; le rappel du matin en
// parle (plus des copies du campus).
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { enseigneCours, etudiantsDuCours, idsCoursAccessibles } from "../acces";
import { perimetreSites } from "../auth";
import { ErreurHttp, interdit, introuvable, invalide } from "../http";
import { iaDisponible } from "../ia";
import { notifier } from "../notifications";
import { publierUtilisateur } from "../temps-reel";
import { finEcheance } from "../evaluations-outils";
import { feuillePresence } from "../routes/live";
import { etatsPresence } from "./presence";
import { tableExiste } from "./tables";
import { DELAI_DEVOIR_AUTO_HEURES, sqlDevoirAutomatique, sqlDevoirProposable } from "./proposables";
import { sqlCorrigeParLeCampus } from "../corrections-socle";
import {
  corrigesDevoirs,
  cours,
  devoirs,
  devoirsSeances,
  etudesSeances,
  journal,
  questionsQuiz,
  rendus,
  seances,
  travauxGroupeDevoirs,
  utilisateurs,
  validationsDevoirsAuto,
  type CritereGrille,
  type DossierCours,
  type Seance,
  type Utilisateur,
} from "@shared/schema";
import type {
  ApresSeanceDto,
  ARelireDto,
  CopiesEnAttenteDto,
  DevoirAutoApres,
  DevoirAutoResume,
  EtatCoursComplet,
  GroupeCopies,
  ResumeEnseigner,
  StatutValidation,
  TravailDeGroupeDto,
} from "@shared/engagement/enseigner";
import { heureLocale, jourLocal } from "@shared/engagement/calendrier";
import { selonNombre, t } from "@shared/textes/enseigner";

const HEURE = 3_600_000;
const JOUR = 24 * HEURE;
/** « Après la séance » ne remonte pas au-delà : une séance plus ancienne n'est plus la dernière qui compte. */
const FRAICHEUR_SEANCE_JOURS = 21;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const vous = { registre: "vous" as const };

/** Note posée sur la copie ACTUELLE (même règle que le module évaluations : correctionAJour). */
const SQL_CORRECTION_A_JOUR = sql`(r.note IS NOT NULL AND r.corrige_le IS NOT NULL AND (r.rendu_le IS NULL OR r.corrige_le >= r.rendu_le))`;

async function tracer(utilisateurId: number, action: string, details: Record<string, unknown>) {
  await db.insert(journal).values({ utilisateurId, action, details });
}

/** Cours dont la personne corrige les copies et suit les séances : les siens (formateur), tous (direction), ceux de son campus (équipe). */
export async function coursEnseignes(u: Utilisateur): Promise<number[]> {
  const ids = await idsCoursAccessibles(u);
  if (u.role === "formateur" || u.role === "admin") return ids;
  const siens: number[] = [];
  for (const id of ids) if (await enseigneCours(u, id)) siens.push(id);
  return siens;
}

/** Littéral SQL d'un tableau d'entiers (identifiants déjà validés). */
const tableauEntiers = (ids: number[]) => sql`${`{${ids.map((i) => Math.trunc(i)).join(",")}}`}::int[]`;

// ── Devoirs de la routine du soir ───────────────────────────────────────────

type LigneDevoirAuto = {
  id: number;
  type: "quiz" | "depot";
  titre: string;
  publie: boolean;
  cree_le: string;
  date_limite: string;
  bareme: number;
  statut: StatutValidation | null;
  propose: boolean;
  /** Le campus corrige ses copies (il a un corrigé : D6). */
  par_campus: boolean;
};

/** Devoirs automatiques (avec la décision du formateur et la règle « proposable ») parmi ces identifiants. */
async function devoirsAutoParIds(ids: number[]): Promise<LigneDevoirAuto[]> {
  if (!ids.length) return [];
  const r = await db.execute<LigneDevoirAuto>(sql`
    SELECT d.id, d.type, d.titre, d.publie, d.cree_le, d.date_limite, d.bareme, v.statut,
           ${sqlDevoirProposable("d")} AS propose, ${sqlCorrigeParLeCampus("d")} AS par_campus
    FROM campus.devoirs d
    LEFT JOIN campus.validations_devoirs_auto v ON v.devoir_id = d.id
    WHERE d.id = ANY(${tableauEntiers(ids)})
    ORDER BY d.type DESC, d.id`);
  return r.rows;
}

function versResume(l: LigneDevoirAuto): DevoirAutoResume {
  const creeLe = new Date(l.cree_le).getTime();
  const proposeLe = !l.propose && l.publie && l.statut === null ? new Date(creeLe + DELAI_DEVOIR_AUTO_HEURES * HEURE).toISOString() : null;
  return {
    id: l.id,
    type: l.type,
    titre: l.titre,
    publie: l.publie,
    validation: l.statut,
    propose: l.propose,
    proposeLe,
    dateLimite: new Date(l.date_limite).toISOString(),
    bareme: Number(l.bareme),
  };
}

// ── Après la séance ─────────────────────────────────────────────────────────

/** Dernière séance tenue (ni essai de visio, ni séance non tenue) de ces cours, depuis trois semaines. */
async function derniereSeanceTenue(coursIds: number[]): Promise<Seance | null> {
  if (!coursIds.length) return null;
  const fin = sql`coalesce(${seances.termineeLe}, ${seances.demarreeLe})`;
  const [s] = await db
    .select()
    .from(seances)
    .where(
      and(
        inArray(seances.coursId, coursIds),
        eq(seances.statut, "terminee"),
        isNotNull(seances.demarreeLe),
        sql`${fin} > now() - make_interval(days => ${FRAICHEUR_SEANCE_JOURS})`,
        sql`NOT EXISTS (SELECT 1 FROM campus.directs_immediats di WHERE di.seance_id = ${seances.id} AND NOT di.prevenir)`,
      ),
    )
    .orderBy(desc(fin))
    .limit(1);
  return s ?? null;
}

/** Statistiques de révision de la séance (tables de C1, lues seulement si elles existent). Nul : pas encore mesuré. */
async function revisionDeLaSeance(seanceId: number): Promise<{ ouvertures: number | null; revision: ApresSeanceDto["coursComplet"]["revision"] }> {
  let ouvertures: number | null = null;
  let revision: ApresSeanceDto["coursComplet"]["revision"] = null;
  try {
    if (await tableExiste("suivis_cours_complets")) {
      const r = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM campus.suivis_cours_complets WHERE seance_id = ${seanceId}`);
      ouvertures = r.rows[0]?.n ?? 0;
    }
  } catch (e) {
    console.warn("[après la séance] suivis_cours_complets :", (e as Error).message);
  }
  try {
    if ((await tableExiste("reponses_revision")) && (await tableExiste("cartes_revision"))) {
      const [tot] = (
        await db.execute<{ etudiants: number; reponses: number }>(sql`
          SELECT count(DISTINCT rr.utilisateur_id)::int AS etudiants, count(*)::int AS reponses
          FROM campus.reponses_revision rr JOIN campus.cartes_revision c ON c.id = rr.carte_id
          WHERE c.seance_id = ${seanceId}`)
      ).rows;
      // La question la plus ratée, à partir de 5 étudiants (aucun chiffre sur un trop petit groupe).
      const [ratee] = (
        await db.execute<{ texte: string | null; taux: number }>(sql`
          SELECT COALESCE(c.contenu->>'question', c.contenu->>'recto', c.contenu->>'texte') AS texte,
                 round(100.0 * count(*) FILTER (WHERE NOT rr.juste) / count(*))::int AS taux
          FROM campus.reponses_revision rr JOIN campus.cartes_revision c ON c.id = rr.carte_id
          WHERE c.seance_id = ${seanceId}
          GROUP BY c.id
          HAVING count(DISTINCT rr.utilisateur_id) >= 5 AND count(*) FILTER (WHERE NOT rr.juste) > 0
          ORDER BY taux DESC, count(*) DESC
          LIMIT 1`)
      ).rows;
      revision = {
        etudiants: tot?.etudiants ?? 0,
        reponses: tot?.reponses ?? 0,
        plusRatee: ratee?.texte ? { texte: ratee.texte.slice(0, 160), tauxErreur: ratee.taux } : null,
        signalees: 0,
      };
      // Cartes signalées par les étudiants ou retirées comme suspectes : une information, jamais une tâche.
      try {
        const [s] = (
          await db.execute<{ n: number }>(sql`
            SELECT count(*)::int AS n FROM campus.cartes_revision WHERE seance_id = ${seanceId} AND (a_relire OR signalements > 0)`)
        ).rows;
        revision.signalees = s?.n ?? 0;
      } catch (e) {
        console.warn("[après la séance] cartes signalées :", (e as Error).message);
      }
    }
  } catch (e) {
    console.warn("[après la séance] révision :", (e as Error).message);
  }
  return { ouvertures, revision };
}

/** Ce que le campus a fait après cette séance (voir ApresSeanceDto). */
export async function apresSeance(u: Utilisateur, s: Seance): Promise<ApresSeanceDto> {
  const [c] = await db.select({ code: cours.code, titre: cours.titre }).from(cours).where(eq(cours.id, s.coursId));

  // Présence : la feuille du bilan de séance (mêmes attendus, mêmes présents), puis les états en trois temps.
  const feuille = await feuillePresence(u, s);
  const presents = feuille.filter((l) => l.statut === "salle" || l.statut === "en_ligne" || l.statut === "retard").length;
  const etats = await etatsPresence(
    s.id,
    feuille.map((l) => l.utilisateurId),
  );
  const inconnus = [...etats.values()].filter((e) => e === "inconnu").length;

  const [participation] = (
    await db.execute<{ questions: number; sondages: number; ouvertures: number }>(sql`
      SELECT (SELECT count(*)::int FROM campus.questions_live q WHERE q.seance_id = ${s.id} AND NOT q.masquee) AS questions,
             (SELECT count(*)::int FROM campus.sondages so WHERE so.seance_id = ${s.id} AND so.ouvert_le IS NOT NULL) AS sondages,
             (SELECT count(*)::int FROM campus.vues_replay vr JOIN campus.utilisateurs e ON e.id = vr.utilisateur_id
               WHERE vr.seance_id = ${s.id} AND e.role = 'etudiant') AS ouvertures`)
  ).rows;

  const [etude] = await db.select({ statut: etudesSeances.statut }).from(etudesSeances).where(eq(etudesSeances.seanceId, s.id));
  const etat: EtatCoursComplet = etude?.statut ?? "a_venir";
  const { ouvertures, revision } = etat === "prete" ? await revisionDeLaSeance(s.id) : { ouvertures: null, revision: null };

  // Devoirs de la routine du soir pour cette séance, avec ce qu'en ont fait les étudiants.
  const [lien] = await db.select({ ids: devoirsSeances.devoirIds }).from(devoirsSeances).where(eq(devoirsSeances.seanceId, s.id));
  const lignes = await devoirsAutoParIds(lien?.ids ?? []);
  let devoirsApres: DevoirAutoApres[] = [];
  if (lignes.length) {
    const destinataires = (await etudiantsDuCours(s.coursId)).length;
    const stats = await db.execute<{ devoir_id: number; faits: number; moyenne: number | null; a_corriger: number; notees: number; a_revoir: number }>(sql`
      SELECT r.devoir_id, count(*)::int AS faits,
             avg(r.note) FILTER (WHERE r.statut = 'corrige') AS moyenne,
             count(*) FILTER (WHERE r.statut = 'rendu' AND NOT ${SQL_CORRECTION_A_JOUR})::int AS a_corriger,
             count(*) FILTER (WHERE r.statut = 'corrige')::int AS notees,
             count(*) FILTER (WHERE r.statut = 'rendu' AND ca.etat = 'a_revoir')::int AS a_revoir
      FROM campus.rendus r
      LEFT JOIN campus.corrections_auto ca ON ca.rendu_id = r.id
      WHERE r.devoir_id = ANY(${tableauEntiers(lignes.map((l) => l.id))}) AND r.statut <> 'brouillon'
      GROUP BY r.devoir_id`);
    const statDe = new Map(stats.rows.map((x) => [x.devoir_id, x]));
    devoirsApres = lignes.map((l) => {
      const st = statDe.get(l.id);
      const faits = st?.faits ?? 0;
      // Exercice corrigé par le campus (D6) : rien « à corriger » pour le formateur ; notées, en attente, à revoir.
      const campus = l.type === "depot" && l.par_campus;
      return {
        ...versResume(l),
        destinataires,
        faits,
        moyenne: l.type === "quiz" && st?.moyenne !== null && st?.moyenne !== undefined ? Math.round(Number(st.moyenne) * 10) / 10 : null,
        aCorriger: campus ? 0 : (st?.a_corriger ?? 0),
        correction: campus
          ? { notees: st?.notees ?? 0, enAttente: Math.max(0, faits - (st?.notees ?? 0) - (st?.a_revoir ?? 0)), aRevoir: st?.a_revoir ?? 0 }
          : null,
      };
    });
  }

  return {
    seance: {
      id: s.id,
      titre: s.titre,
      coursId: s.coursId,
      coursCode: c?.code ?? "",
      coursTitre: c?.titre ?? "",
      debut: s.debut.toISOString(),
      termineeLe: iso(s.termineeLe),
    },
    presence: { attendus: feuille.length, presents, inconnus },
    participation: { questions: participation?.questions ?? 0, sondages: participation?.sondages ?? 0 },
    replay: { pret: Boolean(s.replayUrl || s.enregistrementId), ouvertures: participation?.ouvertures ?? 0 },
    coursComplet: { etat, ouvertures, revision },
    devoirs: devoirsApres,
  };
}

/**
 * Correction automatique (D6) : corrigés de ses cours à valider (devoirs publiés) et la prochaine échéance,
 * copies que le campus lui laisse (« à revoir », pas encore notées) et demandes de relecture ouvertes, dans le
 * périmètre de la personne (son campus pour l'équipe).
 */
async function resumeCorriges(u: Utilisateur, coursIds: number[]): Promise<NonNullable<ResumeEnseigner["corriges"]>> {
  if (!coursIds.length) return { aValider: 0, prochaineEcheance: null, aRevoir: 0, relectures: 0 };
  const ids = tableauEntiers(coursIds);
  const perimetre = perimetreSites(u);
  const duSite = perimetre ? sql`AND e.site_id = ANY(${tableauEntiers(perimetre)})` : sql``;
  const [l] = (
    await db.execute<{ a_valider: number; prochaine: Date | string | null; a_revoir: number; relectures: number }>(sql`
      SELECT c.a_valider, c.prochaine,
        (SELECT count(*)::int FROM campus.corrections_auto ca
          JOIN campus.rendus r ON r.id = ca.rendu_id
          JOIN campus.devoirs d ON d.id = r.devoir_id
          JOIN campus.utilisateurs e ON e.id = r.etudiant_id
          WHERE d.cours_id = ANY(${ids}) AND ca.etat = 'a_revoir' AND r.statut = 'rendu' ${duSite}) AS a_revoir,
        (SELECT count(*)::int FROM campus.demandes_relecture dr
          JOIN campus.rendus r ON r.id = dr.rendu_id
          JOIN campus.devoirs d ON d.id = r.devoir_id
          JOIN campus.utilisateurs e ON e.id = r.etudiant_id
          WHERE d.cours_id = ANY(${ids}) AND dr.statut = 'ouverte' ${duSite}) AS relectures
      FROM (SELECT count(*)::int AS a_valider, min(cd.echeance_le) AS prochaine
            FROM campus.corriges_devoirs cd JOIN campus.devoirs d ON d.id = cd.devoir_id
            WHERE d.cours_id = ANY(${ids}) AND d.publie AND cd.statut = 'propose') c`)
  ).rows;
  return { aValider: l?.a_valider ?? 0, prochaineEcheance: iso(l?.prochaine), aRevoir: l?.a_revoir ?? 0, relectures: l?.relectures ?? 0 };
}

/** Accueil du formateur : la dernière séance tenue (ou celle demandée), les copies, les corrigés, la relecture facultative. */
export async function resumeEnseigner(u: Utilisateur, seanceId?: number): Promise<ResumeEnseigner> {
  const ids = await coursEnseignes(u);
  let seance: Seance | null = null;
  if (seanceId) {
    const [s] = await db.select().from(seances).where(eq(seances.id, seanceId));
    if (!s) throw introuvable("Séance");
    if (!ids.includes(s.coursId)) throw interdit("Seul le formateur de ce cours peut voir la suite de cette séance.");
    if (!s.demarreeLe) throw new ErreurHttp(409, "Cette séance n'a pas encore été tenue.");
    seance = s;
  } else seance = await derniereSeanceTenue(ids);

  const [copies, aRelire, corriges] = await Promise.all([resumeCopies(u, ids), compterARelire(ids), resumeCorriges(u, ids)]);
  return { apres: seance ? await apresSeance(u, seance) : null, copies, corriges, aRelire };
}

// ── Copies à corriger ───────────────────────────────────────────────────────

type LigneCopie = {
  rendu_id: number;
  devoir_id: number;
  devoir_titre: string;
  cours_code: string;
  bareme: number;
  avec_grille: boolean;
  etudiant_id: number;
  prenom: string;
  nom: string;
  site_id: number | null;
  site: string | null;
  rendu_le: string;
  en_retard: boolean;
  a_jour: boolean;
  ia: boolean;
  /** Exercice de la routine du soir : correction facultative (D2). */
  automatique: boolean;
  /** Devoir corrigé par le campus (D6) : ses copies ne sont ni à corriger ni facultatives pour le formateur. */
  campus: boolean;
};

/**
 * Copies rendues et pas encore publiées de ces cours (à corriger, ou notées et
 * pas envoyées), dans le périmètre de la personne : celles des devoirs du
 * formateur d'abord, puis celles des exercices automatiques ; les plus
 * anciennes en premier.
 */
async function lignesCopies(u: Utilisateur, coursIds: number[], devoirId?: number): Promise<LigneCopie[]> {
  if (!coursIds.length) return [];
  const r = await db.execute<LigneCopie>(sql`
    SELECT r.id AS rendu_id, r.devoir_id, d.titre AS devoir_titre, c.code AS cours_code, d.bareme,
           jsonb_array_length(d.grille) > 0 AS avec_grille,
           e.id AS etudiant_id, e.prenom, e.nom, e.site_id, si.nom_court AS site,
           r.rendu_le, r.en_retard, ${SQL_CORRECTION_A_JOUR} AS a_jour, r.proposition_ia IS NOT NULL AS ia,
           ${sqlDevoirAutomatique("d")} AS automatique, ${sqlCorrigeParLeCampus("d")} AS campus
    FROM campus.rendus r
    JOIN campus.devoirs d ON d.id = r.devoir_id
    JOIN campus.cours c ON c.id = d.cours_id
    JOIN campus.utilisateurs e ON e.id = r.etudiant_id
    LEFT JOIN campus.sites si ON si.id = e.site_id
    WHERE d.cours_id = ANY(${tableauEntiers(coursIds)}) AND d.type = 'depot' AND r.statut = 'rendu'
      ${devoirId ? sql`AND d.id = ${devoirId}` : sql``}
    ORDER BY automatique ASC, r.rendu_le ASC NULLS LAST, r.id ASC`);
  const perimetre = perimetreSites(u);
  return perimetre ? r.rows.filter((l) => l.site_id !== null && perimetre.includes(l.site_id)) : r.rows;
}

async function resumeCopies(u: Utilisateur, coursIds: number[]): Promise<ResumeEnseigner["copies"]> {
  const lignes = await lignesCopies(u, coursIds);
  // Les copies que le campus corrige (D6) ne sont ni à corriger ni facultatives : celles qu'il laisse au
  // formateur comptent dans corriges.aRevoir. Une note posée par le formateur reste « à publier ».
  const sansNote = lignes.filter((l) => !l.a_jour && !l.campus);
  // « À corriger » : ses devoirs seulement ; les exercices automatiques sans corrigé sont facultatifs (D2).
  const aCorriger = sansNote.filter((l) => !l.automatique);
  return {
    aCorriger: aCorriger.length,
    aPublier: lignes.filter((l) => l.a_jour).length,
    plusAncienne: iso(aCorriger[0]?.rendu_le),
    facultatives: sansNote.length - aCorriger.length,
  };
}

/** Début du jour à Abidjan (GMT toute l'année : minuit UTC). */
const debutDuJour = (maintenant = new Date()) => new Date(`${jourLocal(maintenant)}T00:00:00Z`);

export async function copiesEnAttente(u: Utilisateur, devoirId?: number): Promise<CopiesEnAttenteDto> {
  const ids = await coursEnseignes(u);
  // Copies du campus (D6) : seulement celles que le formateur a notées lui-même et pas encore envoyées.
  const lignes = (await lignesCopies(u, ids, devoirId)).filter((l) => l.a_jour || !l.campus);
  const aCorriger = lignes.filter((l) => !l.a_jour);
  const groupes = new Map<number, GroupeCopies>();
  for (const l of lignes) {
    const g = groupes.get(l.devoir_id) ?? {
      devoirId: l.devoir_id,
      devoirTitre: l.devoir_titre,
      coursCode: l.cours_code,
      aCorriger: 0,
      aPublier: 0,
      plusAncienne: null,
      automatique: l.automatique,
    };
    if (l.a_jour) g.aPublier++;
    else {
      g.aCorriger++;
      g.plusAncienne ??= iso(l.rendu_le);
    }
    groupes.set(l.devoir_id, g);
  }
  const [{ n }] = (
    await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM campus.rendus
      WHERE correcteur_id = ${u.id} AND statut = 'corrige' AND maj_le >= ${debutDuJour().toISOString()}::timestamptz`)
  ).rows;
  return {
    copies: aCorriger.map((l) => ({
      renduId: l.rendu_id,
      devoirId: l.devoir_id,
      devoirTitre: l.devoir_titre,
      coursCode: l.cours_code,
      bareme: Number(l.bareme),
      avecGrille: l.avec_grille,
      etudiant: { id: l.etudiant_id, prenom: l.prenom, nom: l.nom, site: l.site },
      renduLe: new Date(l.rendu_le).toISOString(),
      enRetard: l.en_retard,
      propositionIa: l.ia,
      automatique: l.automatique,
    })),
    // Ses devoirs d'abord, puis les exercices du campus (facultatifs) ; dans chaque bloc, la plus ancienne copie d'abord.
    devoirs: [...groupes.values()].sort((a, b) => Number(a.automatique) - Number(b.automatique) || (a.plusAncienne ?? "9").localeCompare(b.plusAncienne ?? "9")),
    totalACorriger: aCorriger.filter((l) => !l.automatique).length,
    totalFacultatives: aCorriger.filter((l) => l.automatique).length,
    totalAPublier: lignes.length - aCorriger.length,
    iaDisponible: iaDisponible(),
    envoyeesAujourdhui: n ?? 0,
  };
}

/**
 * Envoie à l'étudiant la note posée sur SA copie (une seule copie, sans
 * attendre « Publier les notes ») : même effet que la publication du module
 * évaluations pour cette copie. La note doit avoir été enregistrée sur la copie
 * actuelle (PATCH /api/rendus/:id/correction) ; une copie remplacée entre-temps
 * n'est pas publiée.
 */
export async function envoyerNote(u: Utilisateur, renduId: number): Promise<{ envoyee: boolean }> {
  const [ligne] = await db
    .select({ r: rendus, d: devoirs, c: { code: cours.code }, e: { id: utilisateurs.id, siteId: utilisateurs.siteId } })
    .from(rendus)
    .innerJoin(devoirs, eq(devoirs.id, rendus.devoirId))
    .innerJoin(cours, eq(cours.id, devoirs.coursId))
    .innerJoin(utilisateurs, eq(utilisateurs.id, rendus.etudiantId))
    .where(eq(rendus.id, renduId));
  if (!ligne) throw introuvable("Copie");
  if (!(await enseigneCours(u, ligne.d.coursId))) throw interdit("Seul le formateur du cours peut envoyer cette note.");
  const perimetre = perimetreSites(u);
  if (perimetre && (ligne.e.siteId === null || !perimetre.includes(ligne.e.siteId))) throw interdit("Cet étudiant n'est pas rattaché à votre campus.");
  if (ligne.r.statut === "corrige") return { envoyee: false };
  if (ligne.r.statut !== "rendu") throw new ErreurHttp(409, "Cette copie n'a pas encore été rendue.");
  const r = await db.execute<{ id: number }>(sql`
    UPDATE campus.rendus r SET statut = 'corrige', maj_le = now()
    WHERE r.id = ${renduId} AND r.statut = 'rendu' AND ${SQL_CORRECTION_A_JOUR}
    RETURNING r.id`);
  if (!r.rows.length) throw new ErreurHttp(409, "Enregistrez d'abord une note pour cette copie (elle a peut-être été remplacée par l'étudiant).");
  // Jamais la note dans la notification (écran verrouillé, téléphones partagés).
  await notifier([ligne.r.etudiantId], { type: "note", titre: "Nouvelle note disponible", corps: `${ligne.c.code} · « ${ligne.d.titre} »`, lien: `/devoirs/${ligne.d.id}` });
  publierUtilisateur(ligne.r.etudiantId, "devoir-corrige", { devoirId: ligne.d.id });
  await tracer(u.id, "publier_notes", { devoirId: ligne.d.id, nombre: 1, etudiants: [ligne.r.etudiantId], correctionRapide: true });
  return { envoyee: true };
}

// ── Relecture facultative des devoirs de l'IA ───────────────────────────────

/** Devoirs automatiques encore ouverts de ces cours, sans décision ou « à revoir ». */
async function idsDevoirsARelire(coursIds: number[], avecARevoir: boolean): Promise<{ id: number; seance_id: number }[]> {
  if (!coursIds.length) return [];
  const r = await db.execute<{ id: number; seance_id: number }>(sql`
    SELECT d.id, ds.seance_id
    FROM campus.devoirs_seances ds
    JOIN campus.seances s ON s.id = ds.seance_id
    CROSS JOIN LATERAL jsonb_array_elements_text(ds.devoir_ids) AS x(id)
    JOIN campus.devoirs d ON d.id = x.id::int
    LEFT JOIN campus.validations_devoirs_auto v ON v.devoir_id = d.id
    WHERE s.cours_id = ANY(${tableauEntiers(coursIds)}) AND d.date_limite > now()
      AND (v.statut IS NULL ${avecARevoir ? sql`OR v.statut = 'a_revoir'` : sql``})
    ORDER BY d.cree_le DESC, d.id
    LIMIT 40`);
  return r.rows;
}

async function compterARelire(coursIds: number[]): Promise<number> {
  return (await idsDevoirsARelire(coursIds, false)).length;
}

export async function devoirsARelire(u: Utilisateur): Promise<ARelireDto> {
  const ids = await coursEnseignes(u);
  const liste = await idsDevoirsARelire(ids, true);
  if (!liste.length) return { devoirs: [] };
  const seanceDe = new Map(liste.map((l) => [l.id, l.seance_id]));
  const lignes = await devoirsAutoParIds(liste.map((l) => l.id));
  const details = await db
    .select({ id: devoirs.id, consigne: devoirs.consigne, creeLe: devoirs.creeLe, code: cours.code, seanceTitre: seances.titre })
    .from(devoirs)
    .innerJoin(cours, eq(cours.id, devoirs.coursId))
    .innerJoin(devoirsSeances, sql`${devoirsSeances.devoirIds} @> jsonb_build_array(${devoirs.id})`)
    .innerJoin(seances, eq(seances.id, devoirsSeances.seanceId))
    .where(inArray(devoirs.id, lignes.map((l) => l.id)));
  const detailDe = new Map(details.map((d) => [d.id, d]));
  const idsQuiz = lignes.filter((l) => l.type === "quiz").map((l) => l.id);
  const questions = idsQuiz.length
    ? await db.select().from(questionsQuiz).where(inArray(questionsQuiz.devoirId, idsQuiz)).orderBy(asc(questionsQuiz.ordre), asc(questionsQuiz.id))
    : [];
  return {
    devoirs: lignes
      .map((l) => {
        const d = detailDe.get(l.id);
        return {
          ...versResume(l),
          coursCode: d?.code ?? "",
          seanceId: seanceDe.get(l.id) ?? 0,
          seanceTitre: d?.seanceTitre ?? "",
          creeLe: (d?.creeLe ?? new Date(l.cree_le)).toISOString(),
          questions: questions
            .filter((q) => q.devoirId === l.id)
            .map((q) => ({
              id: q.id,
              enonce: q.enonce,
              options: q.options,
              bonnes: q.bonnesReponses.filter((b): b is number => typeof b === "number"),
              explication: q.explication,
            })),
          consigne: l.type === "depot" && d ? d.consigne.slice(0, 600) : null,
        };
      })
      .sort((a, b) => b.creeLe.localeCompare(a.creeLe)),
  };
}

/**
 * Décision du formateur du cours (ou de la direction) sur un devoir de la
 * routine du soir. Statut nul : la décision est retirée, la règle du délai
 * s'applique de nouveau.
 */
export async function validerDevoirAuto(u: Utilisateur, devoirId: number, statut: StatutValidation | null, remarque: string | null): Promise<DevoirAutoResume> {
  const [d] = await db.select().from(devoirs).where(eq(devoirs.id, devoirId));
  if (!d) throw introuvable("Devoir");
  const autorise = u.role === "admin" || (u.role === "formateur" && (await enseigneCours(u, d.coursId)));
  if (!autorise) throw interdit("Seuls le formateur du cours et la direction peuvent relire ce devoir.");
  const [lien] = await db
    .select({ seanceId: devoirsSeances.seanceId })
    .from(devoirsSeances)
    .where(sql`${devoirsSeances.devoirIds} @> jsonb_build_array(${devoirId}::int)`);
  if (!lien) throw invalide("Ce devoir n'a pas été créé par le campus : il est déjà le vôtre.");
  if (statut === null) await db.delete(validationsDevoirsAuto).where(eq(validationsDevoirsAuto.devoirId, devoirId));
  else {
    const valeurs = { statut, parId: u.id, le: new Date(), remarque: remarque?.trim() || null };
    await db.insert(validationsDevoirsAuto).values({ devoirId, ...valeurs }).onConflictDoUpdate({ target: validationsDevoirsAuto.devoirId, set: valeurs });
  }
  await tracer(u.id, "devoir_auto_relu", { devoirId, seanceId: lien.seanceId, statut });
  const [l] = await devoirsAutoParIds([devoirId]);
  return versResume(l);
}

// ── Travail de groupe du cours complet ──────────────────────────────────────

const dateCourte = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });

/** Le jour J + n à 23 h 59, heure d'Abidjan (GMT), comme les devoirs du campus. */
function dansJours(n: number, depuis = new Date()): Date {
  const d = new Date(depuis);
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(23, 59, 0, 0);
  return finEcheance(d);
}

/** Consigne du devoir (lue par les étudiants : tutoiement), à partir du travail de groupe du cours complet. */
function consigneTravailDeGroupe(g: DossierCours["travailDeGroupe"], s: Seance): string {
  return [
    `## ${g.sujet}`,
    g.roles.length ? `${t("groupe.devoir.roles")}\n${g.roles.map((r) => `- **${r.role}** : ${r.mission}`).join("\n")}` : "",
    t("groupe.devoir.livrable", { v: { livrable: g.livrable } }),
    t("groupe.devoir.comment"),
    t("groupe.devoir.origine", { v: { jour: dateCourte(s.debut) } }),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Le formateur du cours (ou la direction) peut-il ouvrir le travail de groupe en devoir ? */
async function peutOuvrirTravail(u: Utilisateur, s: Seance): Promise<boolean> {
  if (u.role === "etudiant" || u.role === "salle") return false;
  return enseigneCours(u, s.coursId);
}

export async function travailDeGroupe(u: Utilisateur, s: Seance): Promise<TravailDeGroupeDto> {
  const [lien] = await db
    .select({ d: devoirs })
    .from(travauxGroupeDevoirs)
    .innerJoin(devoirs, eq(devoirs.id, travauxGroupeDevoirs.devoirId))
    .where(eq(travauxGroupeDevoirs.seanceId, s.id));
  const d = lien?.d;
  if (u.role === "etudiant") {
    // Rien tant que le formateur ne l'a pas publié (et ouvert).
    if (!d || !d.publie || (d.ouvertureLe && d.ouvertureLe.getTime() > Date.now())) {
      return { devoirId: null, publie: false, lien: null, peutCreer: false, dateLimite: null, rendus: null, monRendu: null };
    }
    const [mien] = await db
      .select({ recu: rendus.recu, renduLe: rendus.renduLe, statut: rendus.statut })
      .from(rendus)
      .where(and(eq(rendus.devoirId, d.id), eq(rendus.etudiantId, u.id)));
    return {
      devoirId: d.id,
      publie: true,
      lien: `/devoirs/${d.id}`,
      peutCreer: false,
      dateLimite: finEcheance(d.dateLimite).toISOString(),
      rendus: null,
      monRendu: mien && mien.statut !== "brouillon" ? { recu: mien.recu, renduLe: iso(mien.renduLe) } : null,
    };
  }
  const peut = await peutOuvrirTravail(u, s);
  if (!d) {
    const [etude] = await db.select({ statut: etudesSeances.statut }).from(etudesSeances).where(eq(etudesSeances.seanceId, s.id));
    return { devoirId: null, publie: false, lien: null, peutCreer: peut && etude?.statut === "prete", dateLimite: null, rendus: null, monRendu: null };
  }
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(rendus)
    .where(and(eq(rendus.devoirId, d.id), sql`${rendus.statut} <> 'brouillon'`));
  return {
    devoirId: d.id,
    publie: d.publie,
    lien: peut ? (d.publie ? `/enseigner/devoirs/${d.id}/copies` : `/enseigner/devoirs/${d.id}`) : null,
    peutCreer: false,
    dateLimite: finEcheance(d.dateLimite).toISOString(),
    rendus: n,
    monRendu: null,
  };
}

/**
 * Crée le devoir de dépôt du travail de groupe, en BROUILLON (publie = false) :
 * le formateur le relit dans l'éditeur des devoirs, puis le publie ; les
 * étudiants ne sont prévenus qu'à ce moment-là (annoncerSiOuvert du module
 * évaluations). Un seul par séance.
 */
export async function ouvrirTravailDeGroupe(u: Utilisateur, s: Seance): Promise<TravailDeGroupeDto> {
  if (!(await peutOuvrirTravail(u, s))) throw interdit("Seul le formateur du cours peut ouvrir ce travail de groupe en devoir.");
  const [etude] = await db.select().from(etudesSeances).where(eq(etudesSeances.seanceId, s.id));
  const g = etude?.statut === "prete" ? etude.dossier?.travailDeGroupe : undefined;
  if (!g?.sujet) throw new ErreurHttp(409, "Le cours complet de cette séance n'est pas encore prêt.");
  const grille: CritereGrille[] = [
    { critere: t("groupe.critere.contenu"), points: 8 },
    { critere: t("groupe.critere.roles"), points: 4 },
    { critere: t("groupe.critere.livrable"), points: 6 },
    { critere: t("groupe.critere.presentation"), points: 2 },
  ];
  const deja = () => new ErreurHttp(409, "Le travail de groupe de cette séance est déjà ouvert en devoir.");
  const [existant] = await db.select({ id: travauxGroupeDevoirs.devoirId }).from(travauxGroupeDevoirs).where(eq(travauxGroupeDevoirs.seanceId, s.id));
  if (existant) throw deja();
  const cree = await db.transaction(async (tx) => {
    const [d] = await tx
      .insert(devoirs)
      .values({
        coursId: s.coursId,
        auteurId: u.id,
        type: "depot",
        titre: t("groupe.devoir.titre", { v: { sujet: g.sujet } }).slice(0, 200),
        consigne: consigneTravailDeGroupe(g, s),
        dateLimite: dansJours(10),
        bareme: 20,
        coefficient: 1,
        accepteRetard: true,
        grille,
        publie: false,
      })
      .returning();
    const [reserve] = await tx.insert(travauxGroupeDevoirs).values({ seanceId: s.id, devoirId: d.id }).onConflictDoNothing().returning();
    // Ouvert au même instant par un autre toucher : la transaction est annulée, rien n'est créé.
    if (!reserve) throw deja();
    // Le dossier du cours complet n'a pas de corrigé du travail de groupe : le campus le rédigera une fois le
    // devoir publié (routine du soir), puis l'enverra au formateur pour validation (D6). Le formateur peut aussi
    // l'écrire lui-même dans l'éditeur du devoir avant de publier.
    await tx.insert(corrigesDevoirs).values({ devoirId: d.id, source: "campus", statut: "en_preparation" }).onConflictDoNothing();
    return d;
  });
  await tracer(u.id, "devoir_cree", { devoirId: cree.id, coursId: s.coursId, titre: cree.titre, type: "depot", travailDeGroupe: s.id });
  return travailDeGroupe(u, s);
}

// ── Rappel du matin des formateurs ──────────────────────────────────────────

/** Heure locale du rappel, du lundi au vendredi. */
const HEURE_RAPPEL = 8;
/** Une copie rendue depuis plus longtemps est « en attente ». */
const ATTENTE_COPIE_MS = 48 * HEURE;
/** Une question du salon sans réponse depuis plus longtemps est rappelée (au-delà de 14 jours, elle est oubliée). */
const ATTENTE_SALON_MS = 24 * HEURE;
const OUBLI_SALON_JOURS = 14;
/**
 * Un même lot (rien de nouveau depuis le dernier rappel) n'est rappelé que
 * trois fois au plus, à deux jours d'écart au moins (lundi, mercredi,
 * vendredi), puis plus rien tant qu'une nouvelle copie ne passe pas 48 h,
 * qu'un étudiant n'écrit pas de nouveau dans le salon, que le campus ne laisse
 * pas une nouvelle copie au formateur ou qu'une relecture n'est pas demandée.
 */
export const RAPPELS_PAR_LOT = 3;
export const ECART_RAPPELS_JOURS = 2;

/**
 * Marque du rappel dans le lien de la notification, vérifiée dans la table
 * notifications : le jour local (un rappel par jour au plus) et le lot de
 * chaque partie (horodatage en ms de l'élément le plus récent qui attendait,
 * 0 si la partie n'y était pas).
 */
const MARQUE = "rappel-formateur=";
const marque = (jour: string, lots: Lots) =>
  `${MARQUE}${jour}&copies=${lots.copies}&salon=${lots.salon}&revoir=${lots.revoir}&relectures=${lots.relectures}`;

/** 0 = dimanche … 6 = samedi, pour un jour « AAAA-MM-JJ ». */
const jourDeSemaine = (jour: string) => new Date(`${jour}T12:00:00Z`).getUTCDay();
/** Jours entre deux jours « AAAA-MM-JJ ». */
const ecartJours = (de: string, a: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / JOUR);

/**
 * Les parties du rappel : copies de ses devoirs sans corrigé, questions du salon, et (D6) copies que le campus
 * lui laisse (« à revoir ») et demandes de relecture.
 */
type Lots = { copies: number; salon: number; revoir: number; relectures: number };
/** Un rappel déjà envoyé : son jour local et les lots qu'il portait. */
export type RappelPasse = { jour: string } & Lots;

type Attente = {
  copies: number;
  plusAncienne: Date | null;
  questions: number;
  coursSalon: number | null;
  /** Copies que le campus n'a pas notées seul (consigne cachée, page illisible, vidéo…). */
  aRevoir: number;
  /** Demandes de relecture ouvertes. */
  relectures: number;
  /** Corrigés envoyés avant aujourd'hui et toujours sans réponse (mentionnés, jamais rappelés seuls). */
  corriges: number;
  /** Élément le plus récent de chaque partie (horodatage en ms ; 0 : rien n'attend). */
  lots: Lots;
};

/**
 * Ce qui attend ce formateur (cours publiés seulement) : copies de SES devoirs
 * rendues depuis plus de 48 h (jamais celles des exercices automatiques : D2,
 * ni celles que le campus corrige : D6), questions du salon sans réponse
 * depuis 24 h, copies que le campus lui laisse, demandes de relecture, et
 * corrigés qui attendent sa validation depuis la veille.
 */
export async function attenteFormateur(formateurId: number, maintenant = new Date()): Promise<Attente> {
  const mesCours = sql`(SELECT c.id FROM campus.cours c WHERE c.formateur_id = ${formateurId}
    UNION SELECT cf.cours_id FROM campus.cours_formateurs cf WHERE cf.formateur_id = ${formateurId})`;
  const [copies] = (
    await db.execute<{ n: number; plus_ancienne: string | null; plus_recente: string | null }>(sql`
      SELECT count(*)::int AS n, min(r.rendu_le) AS plus_ancienne, max(r.rendu_le) AS plus_recente
      FROM campus.rendus r
      JOIN campus.devoirs d ON d.id = r.devoir_id
      JOIN campus.cours co ON co.id = d.cours_id AND co.statut = 'publie'
      WHERE d.cours_id IN ${mesCours} AND d.type = 'depot' AND r.statut = 'rendu' AND NOT ${SQL_CORRECTION_A_JOUR}
        AND NOT ${sqlDevoirAutomatique("d")} AND NOT ${sqlCorrigeParLeCampus("d")}
        AND r.rendu_le < ${new Date(maintenant.getTime() - ATTENTE_COPIE_MS).toISOString()}::timestamptz`)
  ).rows;
  // Salon « Questions du cours » dont le dernier message (non supprimé) vient d'un étudiant.
  const salons = await db.execute<{ cours_id: number; cree_le: string }>(sql`
    SELECT co.cours_id, dernier.cree_le
    FROM campus.conversations co
    CROSS JOIN LATERAL (
      SELECT m.auteur_id, m.cree_le FROM campus.messages m
      WHERE m.conversation_id = co.id AND NOT m.supprime
      ORDER BY m.cree_le DESC LIMIT 1) dernier
    JOIN campus.utilisateurs a ON a.id = dernier.auteur_id
    WHERE co.type = 'cours' AND co.cours_id IN ${mesCours} AND a.role = 'etudiant'
      AND dernier.cree_le < ${new Date(maintenant.getTime() - ATTENTE_SALON_MS).toISOString()}::timestamptz
      AND dernier.cree_le > ${new Date(maintenant.getTime() - OUBLI_SALON_JOURS * JOUR).toISOString()}::timestamptz
    ORDER BY dernier.cree_le ASC`);
  // Correction automatique (D6) : copies laissées au formateur, relectures, corrigés proposés avant aujourd'hui.
  const [auto] = (
    await db.execute<{ a_revoir: number; revoir_recente: string | null; relectures: number; relecture_recente: string | null; corriges: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM campus.corrections_auto ca JOIN campus.rendus r ON r.id = ca.rendu_id
          JOIN campus.devoirs d ON d.id = r.devoir_id JOIN campus.cours co ON co.id = d.cours_id AND co.statut = 'publie'
          WHERE d.cours_id IN ${mesCours} AND ca.etat = 'a_revoir' AND r.statut = 'rendu') AS a_revoir,
        (SELECT max(ca.maj_le) FROM campus.corrections_auto ca JOIN campus.rendus r ON r.id = ca.rendu_id
          JOIN campus.devoirs d ON d.id = r.devoir_id JOIN campus.cours co ON co.id = d.cours_id AND co.statut = 'publie'
          WHERE d.cours_id IN ${mesCours} AND ca.etat = 'a_revoir' AND r.statut = 'rendu') AS revoir_recente,
        (SELECT count(*)::int FROM campus.demandes_relecture dr JOIN campus.rendus r ON r.id = dr.rendu_id
          JOIN campus.devoirs d ON d.id = r.devoir_id JOIN campus.cours co ON co.id = d.cours_id AND co.statut = 'publie'
          WHERE d.cours_id IN ${mesCours} AND dr.statut = 'ouverte') AS relectures,
        (SELECT max(dr.cree_le) FROM campus.demandes_relecture dr JOIN campus.rendus r ON r.id = dr.rendu_id
          JOIN campus.devoirs d ON d.id = r.devoir_id JOIN campus.cours co ON co.id = d.cours_id AND co.statut = 'publie'
          WHERE d.cours_id IN ${mesCours} AND dr.statut = 'ouverte') AS relecture_recente,
        (SELECT count(*)::int FROM campus.corriges_devoirs cd JOIN campus.devoirs d ON d.id = cd.devoir_id
          JOIN campus.cours co ON co.id = d.cours_id AND co.statut = 'publie'
          WHERE d.cours_id IN ${mesCours} AND d.publie AND cd.statut = 'propose'
            AND cd.message_envoye_le < ${debutDuJour(maintenant).toISOString()}::timestamptz) AS corriges`)
  ).rows;
  const n = copies?.n ?? 0;
  const derniereQuestion = salons.rows.at(-1)?.cree_le;
  return {
    copies: n,
    plusAncienne: copies?.plus_ancienne ? new Date(copies.plus_ancienne) : null,
    questions: salons.rows.length,
    coursSalon: salons.rows[0]?.cours_id ?? null,
    aRevoir: auto?.a_revoir ?? 0,
    relectures: auto?.relectures ?? 0,
    corriges: auto?.corriges ?? 0,
    lots: {
      copies: n && copies?.plus_recente ? new Date(copies.plus_recente).getTime() : 0,
      salon: derniereQuestion ? new Date(derniereQuestion).getTime() : 0,
      revoir: auto?.a_revoir && auto.revoir_recente ? new Date(auto.revoir_recente).getTime() : 0,
      relectures: auto?.relectures && auto.relecture_recente ? new Date(auto.relecture_recente).getTime() : 0,
    },
  };
}

/**
 * Faut-il rappeler cette partie (copies, salon, copies à revoir, relectures)
 * aujourd'hui ? « lot » : horodatage de son élément le plus récent qui attend ;
 * « passes » : les rappels déjà envoyés, du plus récent au plus ancien. Un lot
 * plus récent que tout ce qui a déjà été rappelé ouvre une nouvelle série ;
 * sinon, au plus RAPPELS_PAR_LOT rappels dans la série, à ECART_RAPPELS_JOURS
 * jours d'écart.
 */
export function partieARappeler(partie: keyof Lots, lot: number, jour: string, passes: RappelPasse[]): boolean {
  if (!lot) return false;
  const avec = passes.filter((p) => p[partie] > 0);
  if (!avec.length) return true;
  const dejaRappele = Math.max(...avec.map((p) => p[partie]));
  if (lot > dejaRappele) return true;
  // La série a commencé au premier rappel qui portait ce lot ; elle compte tous ceux de cette partie depuis.
  let debut = 0;
  avec.forEach((p, i) => {
    if (p[partie] === dejaRappele) debut = i;
  });
  if (debut + 1 >= RAPPELS_PAR_LOT) return false;
  return ecartJours(avec[0].jour, jour) >= ECART_RAPPELS_JOURS;
}

/** Les rappels du matin déjà envoyés à ce formateur, du plus récent au plus ancien. */
async function rappelsPasses(formateurId: number): Promise<RappelPasse[]> {
  const r = await db.execute<{ lien: string }>(sql`
    SELECT lien FROM campus.notifications
    WHERE utilisateur_id = ${formateurId} AND position(${MARQUE} in coalesce(lien, '')) > 0
    ORDER BY cree_le DESC, id DESC
    LIMIT 30`);
  const passes: RappelPasse[] = [];
  for (const { lien } of r.rows) {
    const m = /rappel-formateur=(\d{4}-\d{2}-\d{2})(?:&copies=(\d+)&salon=(\d+))?(?:&revoir=(\d+)&relectures=(\d+))?/.exec(lien);
    // Rappel d'avant les lots (copies et salon mêlés) : il compte pour le jour, pas pour une série.
    if (m) passes.push({ jour: m[1], copies: Number(m[2] ?? 0), salon: Number(m[3] ?? 0), revoir: Number(m[4] ?? 0), relectures: Number(m[5] ?? 0) });
  }
  return passes;
}

/**
 * Tâche planifiée (toutes les 15 minutes) : à 8 h dans le fuseau de chaque
 * formateur (Abidjan par défaut), du lundi au vendredi, un seul rappel s'il a
 * des demandes de relecture, des copies que le campus lui laisse, des copies
 * de ses devoirs en attente depuis 48 h ou des questions du salon sans
 * réponse ; chaque partie au plus trois fois pour un même lot (voir
 * partieARappeler). La partie la plus pressée fait le titre, les autres
 * suivent en une phrase, avec les corrigés qui attendent sa validation depuis
 * la veille (jamais rappelés seuls : le message du jour et son rappel s'en
 * chargent). Au plus un par jour : la marque du jour est dans le lien.
 * Priorité « action », pas d'e-mail (quota partagé avec le site).
 * « maintenant » se règle pour les essais (horloge simulée).
 */
export async function envoyerRelancesFormateurs(maintenant = new Date()): Promise<number[]> {
  const formateurs = await db
    .select({ id: utilisateurs.id, fuseau: utilisateurs.fuseau })
    .from(utilisateurs)
    .where(and(eq(utilisateurs.role, "formateur"), eq(utilisateurs.actif, true)));
  const prevenus: number[] = [];
  for (const f of formateurs) {
    if (heureLocale(maintenant, f.fuseau) !== HEURE_RAPPEL) continue;
    const jour = jourLocal(maintenant, f.fuseau);
    const rang = jourDeSemaine(jour);
    if (rang === 0 || rang === 6) continue;
    const passes = await rappelsPasses(f.id);
    if (passes.some((p) => p.jour === jour)) continue;
    const a = await attenteFormateur(f.id, maintenant);
    const nombres = {
      relectures: partieARappeler("relectures", a.lots.relectures, jour, passes) ? a.relectures : 0,
      revoir: partieARappeler("revoir", a.lots.revoir, jour, passes) ? a.aRevoir : 0,
      copies: partieARappeler("copies", a.lots.copies, jour, passes) ? a.copies : 0,
      salon: partieARappeler("salon", a.lots.salon, jour, passes) ? a.questions : 0,
    };
    // Dans l'ordre de ce qui presse le plus : un étudiant qui attend une réponse, puis une note à décider.
    const parties = (["relectures", "revoir", "copies", "salon"] as const).filter((p) => nombres[p] > 0);
    if (!parties.length) continue;
    const lots: Lots = {
      copies: nombres.copies ? a.lots.copies : 0,
      salon: nombres.salon ? a.lots.salon : 0,
      revoir: nombres.revoir ? a.lots.revoir : 0,
      relectures: nombres.relectures ? a.lots.relectures : 0,
    };
    const [premiere, ...autres] = parties;
    let titre: string;
    let corps: string;
    let lien: string;
    if (premiere === "relectures" || premiere === "revoir") {
      titre = selonNombre(t, `rappel.${premiere}.titre`, nombres[premiere], vous);
      corps = t(premiere === "relectures" ? "rappel.relectures.corps" : "rappel.revoir.corps", vous);
      lien = `/enseigner/a-revoir?${marque(jour, lots)}`;
    } else if (premiere === "copies") {
      const jours = a.plusAncienne ? Math.max(2, Math.floor((maintenant.getTime() - a.plusAncienne.getTime()) / JOUR)) : 2;
      titre = selonNombre(t, "rappel.copies.titre", nombres.copies, vous);
      corps = t("rappel.copies.corps", { ...vous, v: { jours } });
      lien = `/corriger?${marque(jour, lots)}`;
    } else {
      titre = selonNombre(t, "rappel.salon.titre", nombres.salon, vous);
      corps = t("rappel.salon.corps", vous);
      lien = `/messages/cours/${a.coursSalon}?${marque(jour, lots)}`;
    }
    for (const p of autres) corps += ` ${selonNombre(t, p === "relectures" ? "rappel.relectures.enPlus" : p === "revoir" ? "rappel.revoir.enPlus" : p === "copies" ? "rappel.copies.enPlus" : "rappel.salon.enPlus", nombres[p], vous)}`;
    if (a.corriges) corps += ` ${selonNombre(t, "rappel.corriges.enPlus", a.corriges, vous)}`;
    await notifier([f.id], { type: premiere === "salon" ? "message" : "devoir", titre, corps, lien, priorite: "action" });
    prevenus.push(f.id);
  }
  return prevenus;
}
