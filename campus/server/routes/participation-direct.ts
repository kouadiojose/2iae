// Directs, chantier C6 du plan d'engagement (campus/ENGAGEMENT.md) :
// émargement et participation en salle, puis présence en ligne.
//
// Les étudiants suivent le cours ENSEMBLE dans la salle de conférence de leur
// campus, devant l'écran de la salle, et personne ne les émargeait. L'écran
// prend donc l'émargement en charge tout seul (QR plein écran au démarrage,
// puis vers +15 et +45 min : PageSalle) ; ce fichier y ajoute :
//   - un rappel unique sur le téléphone des étudiants au démarrage du direct
//     (« Tu es en salle ? Scanne le QR de l'écran »), salle par salle, dès que
//     l'écran de la salle est connecté : priorité « action », jamais la nuit ;
//   - « Afficher l'émargement » (Studio, formateur et direction) : le QR
//     revient une minute en grand sur toutes les salles (événement temps réel
//     « emargement:afficher » du canal de la séance) ;
//   - GET /api/seances/:id/emargement-salle : ce que l'écran de salle lit pour
//     son QR plein écran (demande du Studio en cours, campus du classement) ;
//   - GET /api/seances/:id/questions-rappel : 3 questions tirées du quiz du
//     dernier cours complet du même cours (le formateur décide de les lancer) ;
//   - GET /api/mes-presences et GET /api/seances/:id/ma-presence : la présence
//     de l'étudiant en trois états (server/engagement/presence.ts).
//
// Rien ici ne touche au flux de la visio, à la radio ni aux battements : le
// live (routes/live.ts) reste tel quel.
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, moi } from "../auth";
import { route, idParam, interdit, ErreurHttp } from "../http";
import { etudiantsAttendusSeance, seanceVisible } from "../acces";
import { publier, utilisateursSur } from "../temps-reel";
import { notifier, HEURES_CALMES } from "../notifications";
import { planifier } from "../taches";
import { sqlEtatPresence, type EtatPresence } from "../engagement/presence";
import { SQL_DUREE_REFERENCE, sqlAttendus } from "./admin";
import { canal, seanceAnimee } from "./live";
import { heureLocale } from "@shared/engagement/calendrier";
import { SEUIL_PRESENCE_EN_LIGNE, type Utilisateur } from "@shared/schema";
import {
  DUREE_EMARGEMENT_MS,
  REPORT_MAX_EMARGEMENT_MS,
  type AfficherEmargementDto,
  type EmargementSalleDto,
  type LignePresenceDirectDto,
  type MaPresenceDirectDto,
  type MesPresencesDto,
  type QuestionRappelDto,
  type QuestionsRappelDto,
} from "@shared/engagement/direct";
import { t } from "@shared/textes/direct";

const MINUTE = 60_000;
/** Nombre de questions de rappel proposées au formateur. */
const NB_QUESTIONS_RAPPEL = 3;
/** Séances listées dans « Mes présences ». */
const NB_PRESENCES = 20;

// ── Petits outils ──────────────────────────────────────────────────────────

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

function exigerEtudiant(u: Utilisateur) {
  if (u.role !== "etudiant") throw interdit(t("erreur.etudiant"));
}

/** Heures calmes (21 h à 6 h) dans le fuseau de la personne, Abidjan par défaut. */
const nuitPour = (fuseau: string | null, maintenant: Date) => {
  const h = heureLocale(maintenant, fuseau);
  return h >= HEURES_CALMES.debut || h < HEURES_CALMES.fin;
};

/** Campus dont une classe suit ce cours : ceux dont l'écran de salle montre le cours. */
async function sitesDuCours(coursId: number): Promise<number[]> {
  const r = await db.execute<{ site_id: number }>(sql`
    SELECT DISTINCT cl.site_id FROM campus.cours_classes cc
    JOIN campus.classes cl ON cl.id = cc.classe_id
    JOIN campus.cours c ON c.id = cc.cours_id AND c.statut = 'publie'
    WHERE cc.cours_id = ${coursId} AND cl.site_id IS NOT NULL
    ORDER BY cl.site_id`);
  return r.rows.map((l) => Number(l.site_id));
}

// ── Rappel unique au démarrage du direct ───────────────────────────────────

/**
 * Au démarrage d'un direct (dans ses 10 premières minutes), chaque salle dont
 * l'écran est connecté déclenche UNE fois le rappel de ses étudiants attendus
 * qui ne sont pas encore émargés : « Tu es en salle ? Scanne le QR de
 * l'écran ». Une ligne par salle dans rappels_live (« emargement:<site> »,
 * clé primaire : un seul envoi, même si deux passages se croisent). Un
 * étudiant n'appartient qu'à un campus : il reçoit ce rappel une seule fois
 * par séance. Jamais pour un essai de visio ; jamais la nuit (heures calmes
 * dans le fuseau de l'étudiant) ; priorité « action » (politique d'envoi, C3).
 * Une salle sans écran allumé ne reçoit rien : il n'y aurait pas de QR à scanner.
 */
export async function envoyerRappelsEmargement(maintenant = new Date()): Promise<number> {
  const directs = await db.execute<{ id: number; titre: string; cours_id: number; code: string; debut: Date | string; duree_minutes: number }>(sql`
    SELECT s.id, s.titre, s.cours_id, c.code, s.debut, s.duree_minutes
    FROM campus.seances s JOIN campus.cours c ON c.id = s.cours_id
    WHERE s.statut = 'en_direct'
      AND s.demarree_le > ${new Date(maintenant.getTime() - REPORT_MAX_EMARGEMENT_MS).toISOString()}::timestamptz
      AND NOT EXISTS (SELECT 1 FROM campus.directs_immediats di WHERE di.seance_id = s.id AND NOT di.prevenir)`);
  let envoyes = 0;
  for (const s of directs.rows) {
    const ecrans = new Set(
      utilisateursSur(canal(s.id))
        .filter((x) => x.role === "salle" && x.siteId)
        .map((x) => x.siteId as number),
    );
    if (!ecrans.size) continue;
    const salles = (await sitesDuCours(s.cours_id)).filter((site) => ecrans.has(site));
    if (!salles.length) continue;
    let attendus: Utilisateur[] | null = null;
    for (const site of salles) {
      const pris = await db.execute(sql`
        INSERT INTO campus.rappels_live (seance_id, type) VALUES (${s.id}, ${`emargement:${site}`})
        ON CONFLICT DO NOTHING RETURNING seance_id`);
      if (!pris.rows.length) continue;
      attendus ??= await etudiantsAttendusSeance({ coursId: s.cours_id, debut: new Date(s.debut), dureeMinutes: s.duree_minutes });
      const candidats = attendus.filter((e) => e.siteId === site && !nuitPour(e.fuseau, maintenant));
      if (!candidats.length) continue;
      const emarges = await db.execute<{ uid: number }>(sql`
        SELECT utilisateur_id AS uid FROM campus.presences WHERE seance_id = ${s.id} AND mode = 'salle'`);
      const deja = new Set(emarges.rows.map((l) => Number(l.uid)));
      const ids = candidats.filter((e) => !deja.has(e.id)).map((e) => e.id);
      if (!ids.length) continue;
      await notifier(ids, {
        type: "presence",
        titre: t("rappel.titre", { registre: "tu" }),
        corps: t("rappel.corps", { registre: "tu", v: { titre: s.titre, code: s.code } }),
        lien: `/emargement?seance=${s.id}`,
        priorite: "action",
      });
      envoyes += ids.length;
    }
  }
  return envoyes;
}

// Toutes les 15 s : le rappel arrive pendant que l'écran montre encore le QR du démarrage (une minute).
planifier("direct-rappel-emargement", 15_000, async () => {
  await envoyerRappelsEmargement();
});

// ── « Afficher l'émargement » (Studio) ─────────────────────────────────────

/**
 * Demandes du Studio en cours, par séance : fin de l'affichage (heure du
 * serveur). En mémoire, comme l'état du temps réel (une seule instance) : une
 * demande ne dure qu'une minute.
 */
const demandes = new Map<number, number>();

function demandeEnCours(seanceId: number, maintenant = Date.now()): number | null {
  const fin = demandes.get(seanceId);
  if (fin && fin > maintenant) return fin;
  if (fin) demandes.delete(seanceId);
  return null;
}

// ── Questions de rappel ────────────────────────────────────────────────────

type QuestionQuiz = { question: string; options: string[]; bonneReponse: number; explication: string };

const normaliser = (s: string) => s.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
const couper = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** Question du quiz utilisable comme sondage du live (2 à 5 réponses, bonne réponse parmi elles), aux longueurs du sondage. */
function versSondage(q: unknown): QuestionQuiz | null {
  if (!q || typeof q !== "object") return null;
  const x = q as Partial<QuestionQuiz>;
  if (typeof x.question !== "string" || !x.question.trim() || !Array.isArray(x.options)) return null;
  const options = x.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).map((o) => couper(o.trim(), 120));
  if (options.length < 2 || options.length > 5 || options.length !== x.options.length) return null;
  const bonne = Number(x.bonneReponse);
  if (!Number.isInteger(bonne) || bonne < 0 || bonne >= options.length) return null;
  return { question: couper(x.question.trim(), 300), options, bonneReponse: bonne, explication: couper(typeof x.explication === "string" ? x.explication.trim() : "", 600) };
}

// ═══════════════════════════════════════════════════════════════════════════
export function enregistrerParticipationDirect(app: Express) {
  // Écran de salle : demande du Studio en cours et campus du classement.
  app.get(
    "/api/seances/:id/emargement-salle",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      if (u.role === "etudiant") throw interdit("Cet état sert à l'écran de la salle.");
      const s = await seanceVisible(u, idParam(req));
      const fin = demandeEnCours(s.id);
      res.setHeader("Cache-Control", "no-store");
      res.json({ seanceId: s.id, afficheJusqua: iso(fin ? new Date(fin) : null), sitesDuCours: await sitesDuCours(s.coursId) } satisfies EmargementSalleDto);
    }),
  );

  // Studio : remettre le QR d'émargement en grand sur toutes les salles, une minute.
  app.post(
    "/api/seances/:id/afficher-emargement",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceAnimee(u, idParam(req));
      if (s.statut !== "en_direct") throw new ErreurHttp(409, t("erreur.afficher.direct"));
      // Jamais de QR pendant un sondage : il cacherait la question et ses résultats.
      const ouvert = await db.execute(sql`SELECT 1 FROM campus.sondages WHERE seance_id = ${s.id} AND ouvert AND ouvert_le IS NOT NULL LIMIT 1`);
      if (ouvert.rows.length) throw new ErreurHttp(409, t("erreur.afficher.sondage"));
      const maintenant = Date.now();
      // Double clic, ou deux personnes au Studio : la minute en cours vaut pour tous.
      const fin = demandeEnCours(s.id, maintenant) ?? maintenant + DUREE_EMARGEMENT_MS;
      if (!demandes.has(s.id)) {
        demandes.set(s.id, fin);
        for (const [id, f] of demandes) if (f < maintenant - 60 * MINUTE) demandes.delete(id);
        publier(canal(s.id), "emargement:afficher", { seanceId: s.id, afficheJusqua: new Date(fin).toISOString() } satisfies AfficherEmargementDto);
      }
      res.json({ seanceId: s.id, afficheJusqua: new Date(fin).toISOString() } satisfies AfficherEmargementDto);
    }),
  );

  // Studio : 3 questions de rappel tirées du quiz du dernier cours complet prêt du même cours.
  app.get(
    "/api/seances/:id/questions-rappel",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceAnimee(u, idParam(req));
      const sources = await db.execute<{ seance_id: number; titre: string; debut: Date | string; quiz: unknown }>(sql`
        SELECT x.id AS seance_id, x.titre, x.debut, e.dossier->'quiz' AS quiz
        FROM campus.etudes_seances e JOIN campus.seances x ON x.id = e.seance_id
        WHERE x.cours_id = ${s.coursId} AND x.id <> ${s.id} AND e.statut = 'prete'
          AND x.debut < ${s.debut.toISOString()}::timestamptz
          AND jsonb_typeof(e.dossier->'quiz') = 'array' AND jsonb_array_length(e.dossier->'quiz') > 0
        ORDER BY x.debut DESC LIMIT 1`);
      const source = sources.rows[0];
      res.setHeader("Cache-Control", "private, no-cache");
      if (!source) return res.json({ source: null, questions: [] } satisfies QuestionsRappelDto);
      const quiz = (Array.isArray(source.quiz) ? source.quiz : []).map(versSondage).filter((q): q is QuestionQuiz => q !== null);
      // À tour de rôle : d'abord les questions jamais lancées dans une autre séance du cours.
      const lancees = await db.execute<{ seance_id: number; question: string }>(sql`
        SELECT so.seance_id, so.question FROM campus.sondages so JOIN campus.seances x ON x.id = so.seance_id
        WHERE x.cours_id = ${s.coursId}`);
      const ailleurs = new Set(lancees.rows.filter((l) => l.seance_id !== s.id).map((l) => normaliser(l.question)));
      const ici = new Set(lancees.rows.filter((l) => l.seance_id === s.id).map((l) => normaliser(l.question)));
      const neuves = quiz.filter((q) => !ailleurs.has(normaliser(q.question)));
      const reserve = neuves.length >= NB_QUESTIONS_RAPPEL ? neuves : [...neuves, ...quiz.filter((q) => ailleurs.has(normaliser(q.question)))];
      const depart = reserve.length ? s.id % reserve.length : 0;
      const choisies = Array.from({ length: Math.min(NB_QUESTIONS_RAPPEL, reserve.length) }, (_, i) => reserve[(depart + i) % reserve.length]);
      const questions: QuestionRappelDto[] = choisies.map((q) => ({ ...q, parIa: true, dejaLancee: ici.has(normaliser(q.question)) }));
      res.json({ source: { seanceId: source.seance_id, titre: source.titre, debut: new Date(source.debut).toISOString() }, questions } satisfies QuestionsRappelDto);
    }),
  );

  // Étudiant : sa présence à une séance, en trois états (sortie du direct, fin de séance).
  app.get(
    "/api/seances/:id/ma-presence",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      exigerEtudiant(u);
      const s = await seanceVisible(u, idParam(req));
      const r = await db.execute<{ etat: EtatPresence | null; minutes: number | null; seuil: number; en_salle: boolean | null; site: string | null; arrivee: Date | string | null }>(sql`
        SELECT ${sqlEtatPresence(sql`s.id`, sql`${u.id}::int`)} AS etat,
          p.minutes, (p.mode = 'salle') AS en_salle, si.nom_court AS site, COALESCE(p.arrivee_salle_le, p.arrivee_le) AS arrivee,
          GREATEST(1, ceil((${SQL_DUREE_REFERENCE})::float8 * ${SEUIL_PRESENCE_EN_LIGNE}::float8))::int AS seuil
        FROM campus.seances s
        LEFT JOIN campus.presences p ON p.seance_id = s.id AND p.utilisateur_id = ${u.id}
        LEFT JOIN campus.sites si ON si.id = p.site_id
        WHERE s.id = ${s.id}`);
      const l = r.rows[0];
      res.setHeader("Cache-Control", "private, no-cache");
      res.json({
        seanceId: s.id,
        etat: l?.etat ?? "inconnu",
        minutes: Number(l?.minutes ?? 0),
        seuil: Number(l?.seuil ?? 1),
        enSalle: Boolean(l?.en_salle),
        site: l?.en_salle ? (l.site ?? null) : null,
        arriveeSalle: l?.en_salle ? iso(l.arrivee) : null,
      } satisfies MaPresenceDirectDto);
    }),
  );

  // Étudiant : ses 20 dernières séances tenues, avec l'état de présence, le replay et le cours complet.
  app.get(
    "/api/mes-presences",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      exigerEtudiant(u);
      const r = await db.execute<{
        seance_id: number;
        titre: string;
        cours_id: number;
        cours_code: string;
        cours_titre: string;
        debut: Date | string;
        minutes: number;
        etat: EtatPresence | null;
        en_salle: boolean | null;
        replay: boolean;
        cours_complet: "prete" | "en_cours" | "erreur" | null;
      }>(sql`
        SELECT a.seance_id, a.seance_titre AS titre, a.cours_id, a.cours_code, c.titre AS cours_titre, a.debut, a.minutes,
          ${sqlEtatPresence(sql`a.seance_id`, sql`a.uid`)} AS etat,
          (p.mode = 'salle') AS en_salle,
          (s.statut = 'terminee' AND (s.replay_url IS NOT NULL OR s.enregistrement_id IS NOT NULL OR s.resume_valide OR length(trim(s.transcription)) > 0)) AS replay,
          e.statut AS cours_complet
        FROM (${sqlAttendus({ etudiantId: u.id, sites: null })}) a
        JOIN campus.seances s ON s.id = a.seance_id
        JOIN campus.cours c ON c.id = a.cours_id
        LEFT JOIN campus.presences p ON p.seance_id = a.seance_id AND p.utilisateur_id = a.uid
        LEFT JOIN campus.etudes_seances e ON e.seance_id = a.seance_id
        ORDER BY a.debut DESC, a.seance_id DESC
        LIMIT ${NB_PRESENCES}`);
      const seances: LignePresenceDirectDto[] = r.rows.map((l) => ({
        seanceId: l.seance_id,
        titre: l.titre,
        coursId: l.cours_id,
        coursCode: l.cours_code,
        coursTitre: l.cours_titre,
        debut: new Date(l.debut).toISOString(),
        etat: l.etat ?? "inconnu",
        minutes: Number(l.minutes ?? 0),
        enSalle: Boolean(l.en_salle),
        replay: Boolean(l.replay),
        coursComplet: l.cours_complet === "prete" || l.cours_complet === "en_cours" ? l.cours_complet : null,
      }));
      res.setHeader("Cache-Control", "private, no-cache");
      res.json({ seances } satisfies MesPresencesDto);
    }),
  );
}
