// Moteur de correction automatique des copies (chantier K2, décision de José du 8 octobre 2026 ; corrections
// de la revue du même soir, décisions D-A à D-E du coordinateur).
//
// Une copie de dépôt rendue est corrigée par le campus quand le corrigé de son devoir sert de barème (validé par
// le formateur, ou tacite au bout de 24 h : server/corrections-socle.ts) ET que la date limite du devoir est
// passée (D-A : une note, ses justifications et son commentaire tirés du corrigé ne partent jamais avant ; une
// copie en retard, rendue après, est corrigée tout de suite). Le suivi de chaque copie est dans
// corrections_auto : « en_file », « notee », « a_revoir » (avec sa raison) ou « erreur ».
//
//   - La copie est lue en pages (server/copies-pages.ts). Vidéo seule : « à revoir » (video), sans IA ; rien à
//     lire : « vide » ; seulement des fichiers que le campus ne lit pas : « format ». Un fichier que le bucket
//     ne rend pas : « erreur », réessayée.
//   - Sinon une demande part à l'IA (server/correction-ia.ts), sans quota, sous l'origine « copie:<id> », avec
//     la référence de la copie à recopier (D-C). En mode IA du soir, elle est gardée pour la routine : son
//     identifiant est rangé dans corrections_auto (demande_id), et les passages suivants relisent la réponse
//     par cet identifiant, SANS reconstruire la demande (lecture du bucket, conversions). Sans réponse : « soir ».
//   - La réponse est contrôlée : référence de la copie, chaque critère par son nom, points de 0 au maximum par
//     quarts. Un écart : la réponse est rejetée (« erreur », la demande est refaite), jamais ramenée en silence.
//   - Copie douteuse ou lue en partie (D-B) : consigne cachée (alerte), lisibilité « illisible » ou « partielle »,
//     vidéo ou son joints (même avec du texte ou des photos), fichier non lu, pages au-delà du maximum, texte
//     coupé : rien n'est publié, la copie est « à revoir » par le formateur (la proposition lui est gardée).
//     Une copie retenue pour elle-même ne repart jamais à l'IA sur un corrigé modifié, seulement si l'étudiant
//     la remplace ; une copie « alerte » remplacée reste « à revoir » (l'étudiant n'apprend pas l'alerte).
//   - Sinon la note est publiée comme une note de formateur (origine « campus », sans correcteur, détail
//     critère par critère AVEC justification, commentaire), seulement si rien n'a changé entre-temps (même
//     copie, encore « rendue » sans correction d'un formateur ou déjà notée par le campus, même version du
//     corrigé, date limite passée) : une note de formateur n'est jamais écrasée.
//   - Échec technique : « erreur », réessayée ; au bout de ESSAIS_MAX_CORRECTION essais, « à revoir » (echecs).
//     Une panne de l'API elle-même (réseau, crédit épuisé, saturation) ne compte pas d'essai.
// La tâche « correction-copies » (10 min) applique les réponses déjà données par la routine, et, hors mode IA
// du soir, corrige directement par l'API, à petit débit.
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { planifier } from "./taches";
import { notifier } from "./notifications";
import { publierUtilisateur } from "./temps-reel";
import { demanderJsonCout, ErreurIa, iaDisponible, travailDeFondPermis } from "./ia";
import { avecOrigine, estIaDuSoir, iaDuSoir, supprimerDemandesDe } from "./ia-soir";
import { corrigeChezLeCampus, echeanceValidation } from "./corrections-socle";
import { echeance } from "./evaluations-outils";
import { apercuCopie, copieLisible, lectureComplete, lireCopie, resumeApercu, resumeNonLus, type ApercuCopie } from "./copies-pages";
import {
  SYSTEME_CORRECTION_CAMPUS,
  LISIBILITES,
  contexteCorrection,
  grilleDe,
  memeReference,
  messageCopie,
  normaliser,
  noteDu,
  rapprocherCriteres,
  referenceCopie,
  schemaCorrectionCampus,
  type CorrectionCampusIa,
} from "./correction-ia";
import type { IssueEtude } from "./etude-cours";
import { formaterDate } from "@shared/textes";
import {
  correctionsAuto,
  corrigesDevoirs,
  cours,
  demandesIa,
  demandesRelecture,
  devoirs,
  fichiers,
  journal,
  rendus,
  utilisateurs,
  type CorrectionAuto,
  type CorrigeDevoir,
  type DemandeRelecture,
  type Devoir,
  type Fichier,
  type PropositionIa,
  type Rendu,
} from "@shared/schema";
import {
  ESSAIS_MAX_CORRECTION,
  STATUTS_CORRIGE_UTILISABLES,
  type EtatCorrection,
  type EtatCorrectionEtudiant,
  type RaisonARevoir,
  type RelectureEtudiant,
} from "@shared/engagement/corrections";

const MINUTE = 60_000;
/** Heure (Abidjan, GMT) à laquelle la routine du soir a fait le gros de son travail : la note arrive « ce soir ». */
const HEURE_ROUTINE = 21;
/** Hors mode IA du soir : copies corrigées par l'API à chaque passage de la tâche (toutes les 10 minutes). */
const COPIES_PAR_PASSAGE_API = 10;
/** Une demande de copie que plus aucune ligne ne référence est supprimée après ce délai (le temps d'être rangée). */
const DELAI_ORPHELINE = "5 minutes";

const origineDe = (renduId: number) => `copie:${renduId}`;

// ── Règles communes (SQL et lecture) ───────────────────────────────────────

/**
 * Un formateur a la main sur la copie ACTUELLE : il l'a notée ou a commencé à la corriger (note, commentaire,
 * vocal : PATCH /api/rendus/:id/correction pose correcteur_id et corrige_le). Une copie remplacée repart sans
 * correcteur (enregistrerRendu). Le campus ne touche plus jamais à une telle copie.
 */
export const formateurALaMain = (r: Pick<Rendu, "correcteurId" | "corrigeLe" | "renduLe">) =>
  r.correcteurId !== null && r.corrigeLe !== null && (!r.renduLe || r.corrigeLe.getTime() >= r.renduLe.getTime());

const sansFormateurSql = or(isNull(rendus.correcteurId), and(isNotNull(rendus.corrigeLe), isNotNull(rendus.renduLe), lt(rendus.corrigeLe, rendus.renduLe)))!;

/** Le campus peut (encore) poser la note : copie rendue sans formateur, ou copie déjà notée par le campus. */
const corrigeableSql = or(and(eq(rendus.statut, "rendu"), sansFormateurSql), and(eq(rendus.statut, "corrige"), eq(rendus.origineNote, "campus")))!;

/** Même copie que celle lue (heure d'arrivée à la milliseconde, comme memeCopie dans routes/evaluations.ts). */
const memeCopieSql = (r: Pick<Rendu, "id" | "renduLe">): SQL =>
  and(eq(rendus.id, r.id), r.renduLe ? sql`date_trunc('milliseconds', ${rendus.renduLe}) = ${r.renduLe}` : isNull(rendus.renduLe))!;

const memeInstant = (a: Date | null | undefined, b: Date | null | undefined) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Corrigé qui sert de barème : validé ou tacite, et non vide. */
export const corrigeUtilisableLigne = (cd: Pick<CorrigeDevoir, "statut" | "contenu"> | null | undefined): boolean =>
  Boolean(cd && STATUTS_CORRIGE_UTILISABLES.includes(cd.statut) && cd.contenu.trim());

/**
 * Copie retenue « à revoir » pour elle-même (consigne cachée, illisible, vidéo, format, vide) : un corrigé modifié
 * n'y change rien, elle ne repart jamais à l'IA pour cela ; seul un remplacement par l'étudiant la relance.
 * Seuls les échecs techniques (« echecs ») sont refaits sur un nouveau corrigé.
 */
const retenueSurLaCopie = (ca: Pick<CorrectionAuto, "etat" | "raison">) => ca.etat === "a_revoir" && ca.raison !== "echecs";
/** Consigne cachée repérée : la copie reste « à revoir » jusqu'au formateur, même remplacée (alerte collante). */
const sousAlerte = (ca: Pick<CorrectionAuto, "etat" | "raison"> | null | undefined) => ca?.etat === "a_revoir" && ca.raison === "alerte";

/** La ligne de suivi vaut-elle pour cette copie et ce corrigé (sinon : copie remplacée ou corrigé modifié) ? */
const ligneAJour = (ca: CorrectionAuto, r: Pick<Rendu, "renduLe">, cd: Pick<CorrigeDevoir, "version"> | null | undefined) =>
  memeInstant(ca.renduLe, r.renduLe) && (!cd || ca.versionCorrige === cd.version || retenueSurLaCopie(ca));

/** La date limite du devoir est passée (fin d'échéance comprise) : le campus peut corriger (D-A). */
const apresEcheance = (d: Pick<Devoir, "dateLimite">, maintenant = Date.now()) => maintenant > echeance(d).getTime();

async function tracerCampus(action: string, details: Record<string, unknown>) {
  await db.insert(journal).values({ utilisateurId: null, action, details });
}

// ── Copies à corriger ──────────────────────────────────────────────────────

/** Demandes de copies que plus aucune ligne ne référence (copie remplacée, corrigé modifié, formateur) : supprimées. */
async function oublierDemandesOrphelines(): Promise<void> {
  await db.execute(sql`
    DELETE FROM campus.demandes_ia di
    WHERE di.origine LIKE 'copie:%' AND di.cree_le < now() - ${DELAI_ORPHELINE}::interval
      AND NOT EXISTS (SELECT 1 FROM campus.corrections_auto ca WHERE ca.demande_id = di.id)`);
}

/**
 * Copies que le campus doit (encore) corriger (alias r, d, cd, ca) : copies de dépôt de devoirs publiés dont la
 * date limite est passée (la minute couvre la fin d'échéance, finEcheance) et dont le corrigé sert de barème,
 * sans correction d'un formateur sur la copie actuelle, hors consigne cachée repérée (le formateur décide), et
 * dont le suivi est absent, en file, en erreur (essais restants) ou périmé (copie remplacée ; corrigé modifié,
 * sauf pour une copie retenue « à revoir » pour elle-même).
 */
const SQL_A_CORRIGER = sql`
      d.type = 'depot' AND d.publie AND d.date_limite + interval '1 minute' <= now()
      AND cd.statut IN ('valide', 'tacite') AND btrim(cd.contenu) <> ''
      AND (
        (r.statut = 'rendu' AND (r.correcteur_id IS NULL OR (r.corrige_le IS NOT NULL AND r.rendu_le IS NOT NULL AND r.corrige_le < r.rendu_le)))
        OR (r.statut = 'corrige' AND r.origine_note = 'campus')
      )
      AND NOT (ca.etat IS NOT DISTINCT FROM 'a_revoir' AND ca.raison IS NOT DISTINCT FROM 'alerte')
      AND (
        (ca.rendu_id IS NULL AND r.statut = 'rendu')
        OR ca.etat = 'en_file'
        OR (ca.etat = 'erreur' AND ca.tentatives < ${ESSAIS_MAX_CORRECTION})
        OR (ca.etat IN ('notee', 'a_revoir', 'erreur') AND (
          date_trunc('milliseconds', ca.rendu_le) IS DISTINCT FROM date_trunc('milliseconds', r.rendu_le)
          OR (ca.version_corrige IS DISTINCT FROM cd.version AND NOT (ca.etat = 'a_revoir' AND ca.raison IS DISTINCT FROM 'echecs'))))
      )`;

/** Copies à corriger ce tour-ci, les plus anciennes d'abord, au plus « limite » (voir SQL_A_CORRIGER). */
export async function copiesACorriger(limite: number): Promise<number[]> {
  await oublierDemandesOrphelines();
  const { rows } = await db.execute<{ id: number }>(sql`
    SELECT r.id
    FROM campus.rendus r
    JOIN campus.devoirs d ON d.id = r.devoir_id
    JOIN campus.corriges_devoirs cd ON cd.devoir_id = d.id
    LEFT JOIN campus.corrections_auto ca ON ca.rendu_id = r.id
    WHERE ${SQL_A_CORRIGER}
    ORDER BY r.rendu_le ASC NULLS FIRST, r.id ASC
    LIMIT ${Math.max(0, Math.trunc(limite))}`);
  return rows.map((l) => Number(l.id));
}

/**
 * Copies encore à préparer pour la routine du soir : à corriger, sans demande qui attend déjà sa réponse (celles-là
 * sont dans les demandes en attente). Le tour le dit (aSuivre) : la routine relance le tour tant qu'il en reste.
 */
export async function copiesAPreparer(): Promise<number> {
  const { rows } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n
    FROM campus.rendus r
    JOIN campus.devoirs d ON d.id = r.devoir_id
    JOIN campus.corriges_devoirs cd ON cd.devoir_id = d.id
    LEFT JOIN campus.corrections_auto ca ON ca.rendu_id = r.id
    WHERE ${SQL_A_CORRIGER}
      AND NOT (ca.etat = 'en_file' AND ca.demande_id IS NOT NULL
               AND EXISTS (SELECT 1 FROM campus.demandes_ia di WHERE di.id = ca.demande_id AND di.repondu_le IS NULL))`);
  return Number(rows[0]?.n ?? 0);
}

// ── Corriger une copie ─────────────────────────────────────────────────────

type Contexte = { r: Rendu; d: Devoir; c: { code: string; titre: string; formateurId: number | null }; ca: CorrectionAuto | null; cd: CorrigeDevoir | null };

async function charger(renduId: number): Promise<Contexte | null> {
  const [l] = await db
    .select({ r: rendus, d: devoirs, c: { code: cours.code, titre: cours.titre, formateurId: cours.formateurId }, ca: correctionsAuto, cd: corrigesDevoirs })
    .from(rendus)
    .innerJoin(devoirs, eq(devoirs.id, rendus.devoirId))
    .innerJoin(cours, eq(cours.id, devoirs.coursId))
    .leftJoin(correctionsAuto, eq(correctionsAuto.renduId, rendus.id))
    .leftJoin(corrigesDevoirs, eq(corrigesDevoirs.devoirId, devoirs.id))
    .where(eq(rendus.id, renduId));
  return l ?? null;
}

/**
 * Le campus peut-il corriger cette copie maintenant ? Jamais avant la date limite (D-A) : c'est le garde-fou
 * commun au tour de la routine, à la tâche de 10 minutes et à toute demande déjà gardée.
 */
function corrigeable({ r, d, cd }: Contexte): boolean {
  if (d.type !== "depot" || !d.publie || !corrigeUtilisableLigne(cd) || !apresEcheance(d)) return false;
  return (r.statut === "rendu" && !formateurALaMain(r)) || (r.statut === "corrige" && r.origineNote === "campus");
}

const contexteDe = ({ d, c }: Contexte, cd: CorrigeDevoir) => contexteCorrection({ cours: c, devoir: d, corrige: cd.contenu, campus: true });

/** Raison d'une copie à revoir qui contient ce que le campus ne lit pas : vidéo (le formateur la regarde) ou format. */
const raisonNonLue = (a: Pick<ApercuCopie, "videos">): RaisonARevoir => (a.videos ? "video" : "format");

/** Qui paie la correction par l'API (comptabilité du mois, jamais le quota du jour) : le formateur du cours, sinon la direction. */
async function payeurDe(x: Contexte): Promise<number | undefined> {
  if (x.c.formateurId) return x.c.formateurId;
  const [admin] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true))).limit(1);
  return admin?.id;
}

/** Fichiers de la copie, dans l'ordre où l'étudiant les a rendus. */
async function fichiersDe(r: Rendu): Promise<Fichier[]> {
  if (!r.fichierIds.length) return [];
  const liste = await db.select().from(fichiers).where(inArray(fichiers.id, r.fichierIds));
  const ordre = new Map(r.fichierIds.map((id, i) => [id, i]));
  return liste.sort((a, b) => (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0));
}

type ChampsLigne = Partial<Omit<CorrectionAuto, "renduId" | "devoirId" | "creeLe">> & { etat: EtatCorrection };

/** Range l'état de la copie (une ligne par copie), pour la copie lue et le corrigé employé. */
async function poserLigne(x: Contexte, cd: CorrigeDevoir, champs: ChampsLigne) {
  const valeurs = { renduLe: x.r.renduLe, versionCorrige: cd.version, majLe: new Date(), ...champs };
  await db
    .insert(correctionsAuto)
    .values({ renduId: x.r.id, devoirId: x.d.id, ...valeurs })
    .onConflictDoUpdate({ target: correctionsAuto.renduId, set: valeurs });
}

/** La copie a changé sous nos yeux (remplacée, prise en main) : la demande est oubliée, la ligne repart en file. */
async function copieChangee(renduId: number): Promise<IssueEtude> {
  await supprimerDemandesDe(origineDe(renduId));
  await db.update(correctionsAuto).set({ etat: "en_file", demandeId: null, majLe: new Date() }).where(eq(correctionsAuto.renduId, renduId));
  return "rien";
}

/** Copies traitées en ce moment par ce processus : le tour de la routine et la tâche planifiée ne se croisent pas. */
const enCours = new Set<number>();
/** L'API refuse tous les appels (crédit, panne, saturation) : la tâche s'arrête sans user les essais des copies. */
let pauseApiJusqua = 0;

/** Corrige une copie (ou garde sa demande pour la routine du soir) ; « prete » quand la note est publiée. */
export async function corrigerCopie(renduId: number): Promise<IssueEtude> {
  if (enCours.has(renduId)) return "rien";
  enCours.add(renduId);
  try {
    return await avecOrigine(origineDe(renduId), () => corriger(renduId));
  } catch (e) {
    console.error(`[correction] copie ${renduId} :`, (e as Error).message);
    return "erreur";
  } finally {
    enCours.delete(renduId);
  }
}

async function corriger(renduId: number): Promise<IssueEtude> {
  const x = await charger(renduId);
  if (!x) return "rien";
  const { r, ca, cd } = x;
  if (!cd || !corrigeable(x)) {
    // Plus l'affaire du campus (formateur, devoir dépublié, corrigé retiré) : la demande en attente ne sert plus.
    if (ca?.demandeId) {
      await supprimerDemandesDe(origineDe(r.id));
      await db.update(correctionsAuto).set({ demandeId: null, majLe: new Date() }).where(eq(correctionsAuto.renduId, r.id));
    }
    return "rien";
  }
  // Consigne cachée repérée : la copie reste « à revoir », même remplacée ou sur un nouveau corrigé (alerte
  // collante) ; seul le formateur la sort de là, en la prenant en main (copiePriseEnMain).
  if (sousAlerte(ca)) {
    if (!memeInstant(ca!.renduLe, r.renduLe)) await garderAlerte(r.id, r.renduLe);
    return "rien";
  }
  const aJour = ca ? ligneAJour(ca, r, cd) : false;
  // Déjà notée ou retenue pour cette copie et ce corrigé : rien à refaire (la décision revient au formateur).
  if (ca && aJour && (ca.etat === "notee" || ca.etat === "a_revoir")) return "rien";

  // 1. Une demande attend la routine du soir : sa réponse est relue par son identifiant, sans la reconstruire.
  // Le contexte (lourd à relire : la demande porte les pages en images) n'est lu que d'une demande répondue.
  if (ca?.demandeId && aJour && ca.etat === "en_file") {
    const [dem] = await db
      .select({
        id: demandesIa.id,
        reponse: demandesIa.reponse,
        reponduLe: demandesIa.reponduLe,
        contexte: sql<string | null>`case when ${demandesIa.reponduLe} is not null then ${demandesIa.requete} ->> 'contexte' end`,
      })
      .from(demandesIa)
      .where(eq(demandesIa.id, ca.demandeId));
    if (dem && !dem.reponduLe && iaDuSoir()) return "soir";
    if (dem?.reponduLe && dem.contexte === contexteDe(x, cd)) return appliquer(x, cd, dem.reponse, ca.detail);
  }
  // Demande disparue, copie remplacée, devoir ou corrigé modifiés depuis (consigne, grille…), ou API revenue :
  // toute demande déjà gardée pour cette copie ne sert plus (remettreEnFile oublie son identifiant sans la
  // supprimer) : la routine ne la verra plus, elle est refaite.
  await supprimerDemandesDe(origineDe(r.id));
  if (ca?.demandeId) await db.update(correctionsAuto).set({ demandeId: null, majLe: new Date() }).where(eq(correctionsAuto.renduId, r.id));

  // 2. Lecture de la copie.
  const copie = await lireCopie(r.texte, await fichiersDe(r));
  // Un fichier que le bucket (ou le volume) n'a pas rendu : panne passagère le plus souvent. Aucune demande ne
  // part sur une copie incomplète, la copie est réessayée (« erreur ») ; au bout des essais, « à revoir » (echecs).
  const indisponibles = copie.nonLus.filter((n) => n.raison === "indisponible");
  if (indisponibles.length) return echec(x, cd, new Error(`fichier momentanément illisible (bucket) : ${indisponibles.map((n) => n.nom).join(", ")}`));
  const nonLus = resumeNonLus(copie);
  if (!copieLisible(copie)) {
    const raison: RaisonARevoir = copie.videos ? "video" : copie.nonLus.length || copie.audios || copie.pagesEnTrop ? "format" : "vide";
    const detail =
      raison === "video"
        ? `Copie rendue en vidéo, sans texte ni page à lire. ${nonLus ?? ""}`.trim()
        : raison === "vide"
          ? "Rien à lire : ni texte, ni page."
          : (nonLus ?? "Fichiers que le campus ne sait pas lire.");
    return aRevoir(x, cd, raison, detail, null);
  }

  // 3. Demande à l'IA (gardée pour la routine du soir, ou envoyée à l'API). Une copie lue en partie (vidéo ou son
  // joints, fichier non lu, pages en trop, texte coupé) part quand même : la proposition est gardée pour le
  // formateur, la note n'est jamais publiée (« detail » de la ligne en file, puis appliquer).
  try {
    const { resultat } = await demanderJsonCout<CorrectionCampusIa>({
      systeme: SYSTEME_CORRECTION_CAMPUS,
      contexte: contexteDe(x, cd),
      messages: [{ role: "user", content: messageCopie(copie, { campus: true, reference: referenceCopie(r) }) }],
      schema: schemaCorrectionCampus(grilleDe(x.d)),
      effort: "medium",
      maxTokens: 4000,
      utilisateurId: await payeurDe(x),
      sansQuota: true,
    });
    return await appliquer(x, cd, resultat, lectureComplete(copie) ? null : nonLus);
  } catch (e) {
    if (estIaDuSoir(e)) {
      const demandeId =
        e.demandeId ??
        (
          await db
            .select({ id: demandesIa.id })
            .from(demandesIa)
            .where(and(eq(demandesIa.origine, origineDe(r.id)), isNull(demandesIa.reponduLe)))
            .orderBy(sql`${demandesIa.id} DESC`)
            .limit(1)
        )[0]?.id ??
        null;
      // « detail » d'une copie en file : ce que le campus n'a pas lu (la note ne sera alors pas publiée).
      await poserLigne(x, cd, { etat: "en_file", raison: null, detail: lectureComplete(copie) ? null : nonLus, demandeId, tentatives: aJour ? (ca?.tentatives ?? 0) : 0 });
      return "soir";
    }
    return echec(x, cd, e);
  }
}

/**
 * Contrôle d'une réponse de l'IA pour une copie : référence de la copie, critères de la grille (chacun par son
 * nom), points de 0 au maximum. Renvoie les écarts (vides si la réponse est recevable) ; le format général est
 * contrôlé avant (schéma). Rien n'y est jamais « ramené » en silence : un écart rejette la réponse.
 */
function ecartsReponse(x: Pick<Contexte, "r" | "d">, ia: Partial<CorrectionCampusIa>): { ecarts: string[]; rapproche: ReturnType<typeof rapprocherCriteres> } {
  const grille = grilleDe(x.d);
  const rapproche = rapprocherCriteres(grille, Array.isArray(ia.detail) ? ia.detail : []);
  const ecarts: string[] = [];
  // Le message ne dit pas la référence attendue : une réponse rangée dans le mauvais dossier doit être refaite.
  if (!memeReference(ia.reference, referenceCopie(x.r))) ecarts.push("réponse.reference : ce n'est pas la référence de la copie de cette demande (réponse écrite pour une autre copie ?) : relire la copie de cette demande et refaire la réponse");
  const rappel = `${grille.length} ligne${grille.length > 1 ? "s" : ""}, dans l'ordre : ${grille.map((g) => `« ${g.critere} » (${g.points} points)`).join(" ; ")}`;
  for (const c of rapproche.manquants) ecarts.push(`réponse.detail : critère « ${c} » absent (${rappel})`);
  for (const c of rapproche.parRang) ecarts.push(`réponse.detail : critère « ${c} » mal nommé (${rappel})`);
  for (const c of rapproche.horsBornes) {
    const g = grille.find((l) => l.critere === c)!;
    const brut = (ia.detail ?? []).find((l) => l && typeof l === "object" && normaliser(l.critere) === normaliser(c))?.obtenu;
    ecarts.push(`réponse.detail : « ${c} » : ${brut ?? "?"} points, hors du barème (de 0 à ${g.points}, par quarts de point)`);
  }
  return { ecarts, rapproche };
}

/**
 * Pour la route de la routine (POST /api/travaux-ia/demandes/:id/reponse) : écarts d'une réponse de copie, avant
 * de la garder, pour que la routine la corrige tout de suite (sans perdre un essai ni une nuit). Rien pour une
 * autre demande, une copie disparue, ou une demande devenue périmée (devoir ou corrigé modifiés : le moteur la
 * refait de toute façon).
 */
export async function ecartsReponseCopie(origine: string, contexteDemande: string | undefined, reponse: unknown): Promise<string[]> {
  const m = /^copie:(\d+)$/.exec(origine);
  if (!m) return [];
  const x = await charger(Number(m[1]));
  if (!x?.cd || contexteDemande !== contexteDe(x, x.cd)) return [];
  return ecartsReponse(x, (reponse ?? {}) as Partial<CorrectionCampusIa>).ecarts;
}

/** Contrôle la réponse de l'IA, puis publie la note ou met la copie « à revoir ». « nonLus » : lecture incomplète. */
async function appliquer(x: Contexte, cd: CorrigeDevoir, reponse: unknown, nonLus: string | null): Promise<IssueEtude> {
  const ia = reponse as Partial<CorrectionCampusIa> | null;
  if (!ia || typeof ia !== "object" || !Array.isArray(ia.detail) || !(LISIBILITES as readonly unknown[]).includes(ia.lisibilite)) {
    return echec(x, cd, new Error("réponse de l'IA hors du format demandé"));
  }
  // Référence fausse, critère absent ou mal nommé, points hors du barème : réponse rejetée, demande refaite.
  const { ecarts, rapproche } = ecartsReponse(x, ia);
  if (ecarts.length) return echec(x, cd, new Error(`réponse rejetée : ${ecarts.join(" ; ")}`));
  const { lignes } = rapproche;
  const note = noteDu(lignes, x.d.bareme);
  const commentaire = String(ia.commentaire ?? "").trim().slice(0, 2000);
  const alerte = String(ia.alerte ?? "").trim().slice(0, 500);
  const remarque = String(ia.remarque ?? "").trim().slice(0, 500);
  const proposition: PropositionIa = { note, detail: lignes, commentaire, alerte: alerte || null, creeLe: new Date().toISOString() };
  if (alerte) return aRevoir(x, cd, "alerte", `Consigne adressée à l'IA repérée dans la copie : ${alerte}`, proposition);
  if (ia.lisibilite === "illisible") return aRevoir(x, cd, "illisible", remarque || "Copie difficile à lire.", proposition);
  if (ia.lisibilite === "partielle") return aRevoir(x, cd, "illisible", `Lecture partielle : ${remarque || "un passage de la copie est difficile à lire."}`, proposition);
  // Lecture incomplète : celle de la lecture (ligne en file, ou lecture qui vient d'avoir lieu), et en dernier
  // contrôle ce que les seuls types des fichiers disent (vidéo, son, format jamais lu, texte trop long).
  const apercu = apercuCopie(x.r.texte, await fichiersDe(x.r));
  const manque = nonLus ?? resumeApercu(apercu);
  if (manque) return aRevoir(x, cd, raisonNonLue(apercu), manque, proposition);
  return publier(x, cd, { note, lignes, commentaire, detail: remarque || null });
}

/** Publie la note du campus, si la copie n'a pas changé ; l'étudiant est prévenu (jamais la note dans la notification). */
async function publier(
  x: Contexte,
  cd: CorrigeDevoir,
  n: { note: number; lignes: ReturnType<typeof rapprocherCriteres>["lignes"]; commentaire: string; detail: string | null },
): Promise<IssueEtude> {
  const { r, d, c } = x;
  const maintenant = new Date();
  const dejaPubliee = r.statut === "corrige";
  const maj = await db.transaction(async (tx) => {
    // Le corrigé employé est-il toujours le barème (même version, validé ou tacite), et la date limite passée ?
    // Verrou partagé : une modification du corrigé attend la fin de la publication, puis la remet en file
    // (remettreEnFile la voit « notee »). Sinon (corrigé, barème ou date limite changés pendant la correction) :
    // rien n'est publié, la copie repart en file.
    const [actuel] = await tx
      .select({ version: corrigesDevoirs.version, statut: corrigesDevoirs.statut, contenu: corrigesDevoirs.contenu })
      .from(corrigesDevoirs)
      .where(eq(corrigesDevoirs.devoirId, d.id))
      .for("share");
    const [dv] = await tx.select({ dateLimite: devoirs.dateLimite, publie: devoirs.publie, bareme: devoirs.bareme }).from(devoirs).where(eq(devoirs.id, d.id));
    if (!actuel || actuel.version !== cd.version || !corrigeUtilisableLigne(actuel)) return null;
    if (!dv || !dv.publie || dv.bareme !== d.bareme || !apresEcheance(dv)) return null;
    const [ligne] = await tx
      .update(rendus)
      .set({ note: n.note, noteDetail: n.lignes, commentaire: n.commentaire || null, statut: "corrige", origineNote: "campus", correcteurId: null, corrigeLe: maintenant, majLe: maintenant })
      .where(and(memeCopieSql(r), corrigeableSql))
      .returning();
    if (!ligne) return null;
    const valeurs = { etat: "notee" as const, raison: null, detail: n.detail, renduLe: r.renduLe, versionCorrige: cd.version, demandeId: null, tentatives: 0, noteCampus: n.note, majLe: maintenant };
    await tx.insert(correctionsAuto).values({ renduId: r.id, devoirId: d.id, ...valeurs }).onConflictDoUpdate({ target: correctionsAuto.renduId, set: valeurs });
    return ligne;
  });
  // Copie remplacée ou prise en main par un formateur pendant la correction : rien n'est publié.
  if (!maj) return copieChangee(r.id);
  await supprimerDemandesDe(origineDe(r.id));
  await tracerCampus(dejaPubliee ? "note_campus_modifiee" : "note_campus", {
    renduId: r.id,
    devoirId: d.id,
    etudiantId: r.etudiantId,
    note: n.note,
    ...(dejaPubliee ? { ancienneNote: r.note } : {}),
    versionCorrige: cd.version,
  });
  if (!dejaPubliee) await notifier([r.etudiantId], { type: "note", titre: "Nouvelle note disponible", corps: `${c.code} · « ${d.titre} »`, lien: `/devoirs/${d.id}` });
  else if (r.note !== n.note) await notifier([r.etudiantId], { type: "note", titre: "Note mise à jour", corps: `« ${d.titre} »`, lien: `/devoirs/${d.id}` });
  publierUtilisateur(r.etudiantId, "devoir-corrige", { devoirId: d.id });
  return "prete";
}

/**
 * La copie est « à revoir » par le formateur : rien n'est publié (une note du campus déjà publiée, sur un
 * corrigé antérieur, reste visible). La proposition de l'IA, s'il y en a une, est gardée pour le formateur.
 */
async function aRevoir(x: Contexte, cd: CorrigeDevoir, raison: RaisonARevoir, detail: string, proposition: PropositionIa | null, tentatives = 0): Promise<IssueEtude> {
  const { r, d } = x;
  if (proposition) {
    const [maj] = await db
      .update(rendus)
      .set({ propositionIa: proposition, majLe: new Date() })
      .where(and(memeCopieSql(r), corrigeableSql))
      .returning({ id: rendus.id });
    if (!maj) return copieChangee(r.id);
  }
  await poserLigne(x, cd, {
    etat: "a_revoir",
    raison,
    detail: detail.slice(0, 1000),
    demandeId: null,
    noteCampus: r.statut === "corrige" ? r.note : (proposition?.note ?? null),
    tentatives,
  });
  await supprimerDemandesDe(origineDe(r.id));
  await tracerCampus("copie_a_revoir", { renduId: r.id, devoirId: d.id, etudiantId: r.etudiantId, raison, noteProposee: proposition?.note ?? null });
  // Copie illisible que l'étudiant peut encore remplacer (avant l'échéance) : il est invité à renvoyer une photo nette.
  const fin = echeance(d);
  const maintenant = new Date();
  if (raison === "illisible" && r.statut === "rendu" && maintenant.getTime() <= fin.getTime() && (!d.ouvertureLe || d.ouvertureLe <= maintenant)) {
    await notifier([r.etudiantId], {
      type: "devoir",
      titre: "Ta copie est difficile à lire",
      corps: `« ${d.titre} » : remplace-la par une photo nette avant le ${formaterDate(fin, { style: "jourHeure" })} (heure d'Abidjan).`,
      lien: `/devoirs/${d.id}`,
      expireLe: fin,
    });
  }
  return "rien";
}

/**
 * Panne de l'API elle-même (et non de la demande de cette copie) : réseau, clé, crédit épuisé (402 « billing », ou
 * 400 « credit balance is too low », comme le repère fetchSurveille dans ia.ts), saturation, erreur du service.
 */
function erreurGlobale(e: unknown): boolean {
  if (e instanceof ErreurIa) return e.statut === 503 || e.statut === 429;
  if (e instanceof Anthropic.APIConnectionError) return true;
  if (e instanceof Anthropic.APIError) {
    if (e.status === 400) return /credit balance|billing/i.test(e.message);
    return e.status === undefined || [401, 402, 403, 408, 429].includes(e.status) || e.status >= 500;
  }
  return false;
}

/** Échec technique : la copie sera réessayée ; au bout de ESSAIS_MAX_CORRECTION essais, elle passe « à revoir ». */
async function echec(x: Contexte, cd: CorrigeDevoir, e: unknown): Promise<IssueEtude> {
  const message = (e as Error)?.message ?? String(e);
  // La réponse refusée ne doit pas resservir : la demande sera refaite au prochain essai.
  await supprimerDemandesDe(origineDe(x.r.id));
  // L'API refuse tout (crédit épuisé, clé refusée, panne, saturation, réseau) : ce n'est pas la faute de la
  // copie, l'essai ne compte pas (sinon une panne d'une heure enverrait toutes les copies « à revoir »).
  if (erreurGlobale(e)) {
    pauseApiJusqua = Date.now() + 30 * MINUTE;
    console.warn(`[correction] API indisponible (${message.slice(0, 120)}) : correction des copies en pause 30 minutes.`);
    await poserLigne(x, cd, { etat: "en_file", raison: null, detail: null, demandeId: null });
    return "erreur";
  }
  const tentatives = (x.ca && ligneAJour(x.ca, x.r, cd) ? x.ca.tentatives : 0) + 1;
  console.warn(`[correction] copie ${x.r.id}, essai ${tentatives} sur ${ESSAIS_MAX_CORRECTION} :`, message.slice(0, 300));
  if (tentatives >= ESSAIS_MAX_CORRECTION) {
    await aRevoir(x, cd, "echecs", `Le campus n'a pas pu corriger cette copie (${ESSAIS_MAX_CORRECTION} essais). Dernière erreur : ${message.slice(0, 300)}`, null, tentatives);
    return "erreur";
  }
  await poserLigne(x, cd, { etat: "erreur", raison: null, detail: message.slice(0, 500), demandeId: null, tentatives });
  return "erreur";
}

// ── Événements venus d'ailleurs (routes/evaluations.ts, routes/corrections-copies.ts) ──

/**
 * Un formateur prend la main sur une copie (note, commentaire, relecture) : la demande en attente ne sert plus,
 * et le suivi n'a plus lieu d'être, sauf une note du campus déjà publiée (sa note reste dans note_campus,
 * pour l'écart). Une note de formateur n'est jamais reprise par le campus.
 */
export async function copiePriseEnMain(renduId: number): Promise<void> {
  const [ca] = await db.select().from(correctionsAuto).where(eq(correctionsAuto.renduId, renduId));
  if (!ca) return;
  await supprimerDemandesDe(origineDe(renduId));
  if (ca.etat === "notee") await db.update(correctionsAuto).set({ demandeId: null, majLe: new Date() }).where(eq(correctionsAuto.renduId, renduId));
  else await db.delete(correctionsAuto).where(eq(correctionsAuto.renduId, renduId));
}

/**
 * Copie « alerte » remplacée : elle reste « à revoir » pour la nouvelle copie (heure de remise mise à jour), avec
 * la trace de l'alerte pour le formateur ; la proposition de l'ancienne copie n'est pas gardée.
 */
async function garderAlerte(renduId: number, renduLe: Date | null): Promise<void> {
  await db
    .update(correctionsAuto)
    .set({
      renduLe,
      demandeId: null,
      noteCampus: null,
      detail: sql`left('Copie remplacée après une consigne adressée à l''IA. ' || coalesce(${correctionsAuto.detail}, ''), 1000)`,
      majLe: new Date(),
    })
    .where(and(eq(correctionsAuto.renduId, renduId), eq(correctionsAuto.etat, "a_revoir"), eq(correctionsAuto.raison, "alerte")));
}

/**
 * L'étudiant (ou la vie scolaire) a remplacé la copie : elle repart en correction, la demande de l'ancienne est
 * supprimée. Sauf une copie où une consigne adressée à l'IA a été repérée : elle reste « à revoir » (alerte
 * collante), le formateur décide ; l'étudiant n'en apprend rien de plus (raison générique).
 */
export async function copieRemplacee(renduId: number): Promise<void> {
  await supprimerDemandesDe(origineDe(renduId));
  const [ca] = await db.select({ etat: correctionsAuto.etat, raison: correctionsAuto.raison }).from(correctionsAuto).where(eq(correctionsAuto.renduId, renduId));
  if (sousAlerte(ca)) {
    const [r] = await db.select({ renduLe: rendus.renduLe }).from(rendus).where(eq(rendus.id, renduId));
    await garderAlerte(renduId, r?.renduLe ?? null);
    await tracerCampus("copie_alerte_remplacee", { renduId });
    return;
  }
  await db
    .update(correctionsAuto)
    .set({ etat: "en_file", raison: null, detail: null, demandeId: null, tentatives: 0, noteCampus: null, majLe: new Date() })
    .where(eq(correctionsAuto.renduId, renduId));
}

// ── Lecture pour les écrans (DTO de routes/evaluations.ts) ─────────────────

export const versRelectureEtudiant = (dr: DemandeRelecture): RelectureEtudiant => ({
  id: dr.id,
  statut: dr.statut,
  motif: dr.motif,
  creeLe: dr.creeLe.toISOString(),
  reponse: dr.reponse,
  traiteeLe: dr.traiteeLe?.toISOString() ?? null,
  noteAvant: dr.noteAvant,
  noteApres: dr.noteApres,
});

/** Dernière demande de relecture de chaque copie d'une liste. */
export async function relecturesDesCopies(renduIds: number[]): Promise<Map<number, DemandeRelecture>> {
  if (!renduIds.length) return new Map();
  const lignes = await db.select().from(demandesRelecture).where(inArray(demandesRelecture.renduId, renduIds)).orderBy(desc(demandesRelecture.creeLe), desc(demandesRelecture.id));
  const parCopie = new Map<number, DemandeRelecture>();
  for (const l of lignes) if (!parCopie.has(l.renduId)) parCopie.set(l.renduId, l);
  return parCopie;
}

/** Suivi des copies d'une liste (une seule requête). */
export async function suiviDesCopies(renduIds: number[]): Promise<Map<number, CorrectionAuto>> {
  if (!renduIds.length) return new Map();
  const lignes = await db.select().from(correctionsAuto).where(inArray(correctionsAuto.renduId, renduIds));
  return new Map(lignes.map((l) => [l.renduId, l]));
}

/** Prochain passage de la routine du soir (21 h à Abidjan) après cet instant. */
function prochainSoir(apres: Date): Date {
  const d = new Date(apres);
  d.setUTCHours(HEURE_ROUTINE, 0, 0, 0);
  if (d.getTime() <= apres.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Ce que les écrans lisent du corrigé d'un devoir (la ligne complète de corriges_devoirs convient). */
type LigneCorrige = Pick<
  CorrigeDevoir,
  "statut" | "contenu" | "version" | "echeanceLe" | "valideLe" | "majLe" | "creeLe" | "messageEnvoyeLe" | "rappelEnvoyeLe"
>;

/**
 * Quand l'étudiant peut attendre sa note : le campus ne corrige qu'après la date limite du devoir (D-A), et
 * quand le corrigé sert de barème. Donc le premier tour de la routine du soir qui suit à la fois la date limite,
 * l'arrivée de la copie et le moment où le corrigé sert de barème (tenu pour bon 24 h après le message du jour,
 * qui part à 7 h quand il est prêt la nuit) : « le soir qui suit la date limite » d'ordinaire, « ce soir » pour
 * une copie en retard. Hors mode IA du soir, l'API corrige dans le quart d'heure qui suit.
 * Le calcul part de dates fixées (date limite, arrivée de la copie, dates du corrigé), jamais de l'heure
 * qu'il est : la date annoncée ne recule pas de jour en jour quand le circuit prend du retard. Passée, l'écran
 * dit « très bientôt » ; un corrigé bloqué (D-G) ne promet plus rien (etatPourEtudiant).
 */
export function noteAttendueLe(cd: LigneCorrige | null, d: Pick<Devoir, "dateLimite">, renduLe: Date | null = null): Date | null {
  if (!cd) return null;
  const apres = (t: Date) => (iaDuSoir() ? prochainSoir(t) : new Date(t.getTime() + 15 * MINUTE));
  const depart = (t: Date) => new Date(Math.max(t.getTime(), renduLe?.getTime() ?? 0, echeance(d).getTime()));
  // Barème depuis sa validation (ou sa dernière modification) : copies en file, ou à refaire sur un corrigé modifié.
  if (corrigeUtilisableLigne(cd)) return apres(depart(cd.valideLe ?? cd.majLe));
  if (cd.statut === "propose" && cd.echeanceLe) return apres(depart(cd.echeanceLe));
  // Pas encore proposé au formateur : le message du jour part dès qu'il est prêt (proposé depuis majLe), ou le
  // campus le rédige d'abord (en préparation depuis creeLe : au tour du soir qui suit, en mode IA du soir).
  const pret = cd.statut === "en_preparation" ? (iaDuSoir() ? prochainSoir(cd.creeLe) : cd.creeLe) : cd.majLe;
  return apres(depart(echeanceValidation(pret)));
}

/**
 * Ce que l'aperçu d'une copie (types de fichiers, texte) dit déjà de sa correction, dès le dépôt : vidéo jointe
 * (le formateur la regarde), rien à lire, ou ce que le campus ne lit jamais (son, format, texte trop long). Nul
 * quand le campus pourra la corriger lui-même.
 */
export function raisonPrevue(a: ApercuCopie): RaisonARevoir | null {
  if (a.videos) return "video";
  if (!a.aLire && !a.audios && !a.jamaisLus) return "vide";
  if (a.audios || a.jamaisLus || a.texteCoupe) return "format";
  return null;
}

/** Raison montrée à l'étudiant : une consigne cachée repérée ne lui est pas dite (message générique). */
const raisonPourEtudiant = (raison: RaisonARevoir | null): RaisonARevoir | null => (raison === "alerte" ? null : raison);

/**
 * État de la correction par le campus, vu par l'étudiant (RenduEtudiant.correctionAuto), dès le dépôt : « en
 * file » avec l'heure à laquelle attendre la note (après la date limite), ou « à revoir » avec sa raison (dès
 * le dépôt pour une copie que le campus ne lira pas : vidéo, son, format, vide ; une consigne cachée repérée
 * n'est pas dite). Une note du campus déjà publiée dont le corrigé a changé reste visible, la copie est « en
 * file » (le campus la relit). Nul quand le campus n'est pas concerné (devoir sans corrigé, formateur qui a la
 * main, corrigé bloqué : D-G, c'est le formateur qui note) ou quand la note publiée est définitive. Une erreur
 * technique reste « en file » pour lui (réessayée).
 */
export function etatPourEtudiant(
  r: Pick<Rendu, "statut" | "renduLe" | "correcteurId" | "corrigeLe" | "origineNote">,
  ca: CorrectionAuto | null | undefined,
  cd: LigneCorrige | null | undefined,
  d: Pick<Devoir, "dateLimite" | "publie">,
  maintenant = new Date(),
  apercu: ApercuCopie | null = null,
): EtatCorrectionEtudiant | null {
  if (!cd) return null;
  const enFile = (): EtatCorrectionEtudiant => ({ etat: "en_file", raison: null, attendueLe: noteAttendueLe(cd, d, r.renduLe)?.toISOString() ?? null });
  if (r.statut === "corrige") {
    // Recorrection d'une note du campus (corrigé modifié) : seulement tant qu'elle est à faire.
    if (r.origineNote !== "campus" || !ca) return null;
    const aFaire = !ligneAJour(ca, r, cd) || ca.etat === "en_file" || ca.etat === "erreur";
    return aFaire && corrigeUtilisableLigne(cd) ? enFile() : null;
  }
  if (r.statut !== "rendu" || formateurALaMain(r)) return null;
  // Alerte collante : même remplacée, la copie reste « à revoir » (sans dire pourquoi).
  if (sousAlerte(ca)) return { etat: "a_revoir", raison: null, attendueLe: null };
  const valable = ca && ligneAJour(ca, r, cd) ? ca : null;
  if (valable?.etat === "a_revoir") return { etat: "a_revoir", raison: raisonPourEtudiant(valable.raison), attendueLe: null };
  // Corrigé bloqué (D-G : en préparation depuis 48 h, rédaction abandonnée, devoir masqué) : la copie revient au
  // formateur, qui la note ; le campus ne promet plus de note.
  if (!corrigeChezLeCampus(cd, d.publie, maintenant)) return null;
  // Avant le passage du campus : ce que l'aperçu dit déjà (pas « ta note arrive ce soir » pour une vidéo).
  const prevue = apercu ? raisonPrevue(apercu) : null;
  if (prevue) return { etat: "a_revoir", raison: prevue, attendueLe: null };
  return enFile();
}

/**
 * État vu par le formateur (CopieResume, CopieDetail) : « en file » tant que le campus doit encore la corriger.
 * Corrigé bloqué (D-G) : une copie sans suivi à jour (ou seulement en file) n'est plus « en file » mais à
 * corriger par le formateur (nul), comme dans ses compteurs (sqlCorrigeParLeCampus) ; une copie déjà notée ou
 * retenue par le campus le reste.
 */
export function etatPourFormateur(
  r: Pick<Rendu, "statut" | "renduLe" | "correcteurId" | "corrigeLe" | "origineNote">,
  ca: CorrectionAuto | null | undefined,
  cd: LigneCorrige | null | undefined,
  d: Pick<Devoir, "publie">,
  maintenant = new Date(),
): { etat: EtatCorrection; raison: RaisonARevoir | null; detail: string | null; noteCampus: number | null } | null {
  if (!cd || r.statut === "brouillon") return null;
  const chezLeCampus = corrigeChezLeCampus(cd, d.publie, maintenant);
  if (ca?.etat === "notee") {
    // Note du campus publiée, à refaire sur un corrigé modifié : « en file » ; sinon « notée » (même si le
    // formateur l'a changée depuis : note_campus garde la note du campus, pour l'écart).
    if (r.statut === "corrige" && r.origineNote === "campus" && !ligneAJour(ca, r, cd) && chezLeCampus) return { etat: "en_file", raison: null, detail: null, noteCampus: ca.noteCampus };
    return { etat: "notee", raison: null, detail: ca.detail, noteCampus: ca.noteCampus };
  }
  if (r.statut === "corrige" && r.origineNote === "campus" && ca) {
    // Recorrection (corrigé modifié) retenue « à revoir » ou en file : la note publiée du campus reste visible.
    if (ligneAJour(ca, r, cd) && ca.etat === "a_revoir") return { etat: "a_revoir", raison: ca.raison, detail: ca.detail, noteCampus: ca.noteCampus };
    return chezLeCampus ? { etat: "en_file", raison: null, detail: null, noteCampus: ca.noteCampus } : null;
  }
  if (r.statut !== "rendu" || formateurALaMain(r)) return null;
  // Alerte collante (copie remplacée après une consigne adressée à l'IA) : toujours « à revoir ».
  if (sousAlerte(ca)) return { etat: "a_revoir", raison: ca!.raison, detail: ca!.detail, noteCampus: ca!.noteCampus };
  const valable = ca && ligneAJour(ca, r, cd) ? ca : null;
  if (valable?.etat === "a_revoir") return { etat: "a_revoir", raison: valable.raison, detail: valable.detail, noteCampus: valable.noteCampus };
  // Sans suivi à jour, en file, ou en reprise après une erreur technique : « en file » tant que le campus s'en
  // occupe ; corrigé bloqué : rien, la copie est à corriger par le formateur.
  return chezLeCampus ? { etat: "en_file", raison: null, detail: null, noteCampus: valable?.etat === "en_file" ? valable.noteCampus : null } : null;
}

// ── Tâche planifiée ────────────────────────────────────────────────────────

/**
 * Les réponses que la routine du soir a déjà données sont appliquées (note publiée ou copie à revoir). Appelé par
 * la tâche de 10 minutes et au début de chaque tour : les places du tour vont alors à de nouvelles copies, et
 * une réponse rejetée est redemandée le soir même.
 */
export async function appliquerReponsesCopies(limite = 300): Promise<{ id: number; issue: IssueEtude }[]> {
  await oublierDemandesOrphelines();
  const { rows } = await db.execute<{ rendu_id: number }>(sql`
    SELECT ca.rendu_id FROM campus.corrections_auto ca
    JOIN campus.demandes_ia di ON di.id = ca.demande_id
    WHERE ca.etat = 'en_file' AND di.repondu_le IS NOT NULL
    ORDER BY di.repondu_le ASC LIMIT ${Math.max(0, Math.trunc(limite))}`);
  const issues: { id: number; issue: IssueEtude }[] = [];
  for (const l of rows) issues.push({ id: Number(l.rendu_id), issue: await corrigerCopie(Number(l.rendu_id)) });
  return issues;
}

/**
 * Toutes les 10 minutes : les réponses que la routine du soir a déjà données sont appliquées (la note part
 * sans attendre le tour suivant) ; hors mode IA du soir, quelques copies sont corrigées par l'API (le passage
 * s'arrête dès que l'API refuse tout : crédit épuisé, clé refusée, panne).
 */
export async function passerCorrections(): Promise<{ appliquees: number; corrigees: number }> {
  const appliquees = (await appliquerReponsesCopies()).filter((x) => x.issue !== "soir").length;
  let corrigees = 0;
  if (!iaDuSoir() && iaDisponible() && Date.now() >= pauseApiJusqua && (await travailDeFondPermis())) {
    for (const id of await copiesACorriger(COPIES_PAR_PASSAGE_API)) {
      if (Date.now() < pauseApiJusqua || !iaDisponible()) break;
      if ((await corrigerCopie(id)) === "prete") corrigees++;
    }
  }
  return { appliquees, corrigees };
}

planifier("correction-copies", 10 * MINUTE, async () => {
  const { appliquees, corrigees } = await passerCorrections();
  if (appliquees || corrigees) console.log(`[correction] ${appliquees} réponse(s) de la routine appliquée(s), ${corrigees} copie(s) corrigée(s) par l'API.`);
});
