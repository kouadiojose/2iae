// Révision du jour (chantier C1) : sélection des cartes, boîtes de chaque
// étudiant, réponses (y compris faites hors ligne), signalements, décisions du
// formateur et chiffres de la classe. Les routes sont dans routes/revision.ts.
//
// - Cours pris en compte : idsCoursAccessibles(u), cours publiés de sa classe
//   et inscriptions individuelles, jamais la médiathèque ouverte à tous.
// - Défi de la classe : 3 QCM de la dernière séance (14 jours au plus) qui a des
//   cartes, choisis par hachage (classe | jour) : les mêmes pour toute la classe.
// - Ensuite les cartes dues (boîte la plus basse d'abord), puis des nouvelles,
//   jusqu'à 5, plus 15 d'avance pour réviser sans réseau. Même (étudiant, jour) :
//   même sélection, mêmes options mélangées.
// - Le serveur recorrige toujours : le téléphone envoie l'index d'origine choisi.
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { idsCoursAccessibles, idsCoursMediatheque, etudiantsDuCours, formateursDuCours } from "../acces";
import { notifier } from "../notifications";
import { extraireCartes } from "./cartes";
import { ajouterJours, jourLocal, type Jour } from "@shared/engagement/calendrier";
import {
  ANOMALIE_MIN_ETUDIANTS,
  ANOMALIE_TAUX_ERREUR,
  CARTES_D_AVANCE,
  CARTES_DEFI,
  CARTES_PAR_JOUR,
  CARTES_PAR_SEANCE,
  DEFI_JOURS_MAX,
  DELAI_JOUR_REPONSE_MS,
  SEUIL_COLLECTIF,
  SIGNALEMENTS_RETRAIT,
  aleaDepuis,
  boiteApres,
  normaliserTexte,
  ordreMelange,
  type CarteDto,
  type ContenuCarte,
  type ContenuFiche,
  type ContenuQcm,
  type CoursCompletARevise,
  type DefiDto,
  type EvenementSuivi,
  type GenreCarte,
  type PaquetRevision,
  type ReponseRevisionEnvoi,
  type ResultatReponses,
  type RevisionClasseDto,
  type RevisionDuJour,
  type SourceCarte,
} from "@shared/engagement/revision";
import { t } from "@shared/textes/revision";
import type { DossierCours, Seance, Utilisateur } from "@shared/schema";

/** Poids maximal du paquet gardé sur le téléphone. */
const POIDS_MAX_PAQUET = 20 * 1024;

/** Tableau d'entiers PostgreSQL (vide compris) : ARRAY[1, 2]::int[]. */
const entiers = (ids: number[]): SQL => (ids.length ? sql`ARRAY[${sql.join(ids.map((i) => sql`${i}`), sql`, `)}]::int[]` : sql`'{}'::int[]`);

const jourDe = (u: Pick<Utilisateur, "fuseau">, d: Date | number = new Date()): Jour => jourLocal(d, u.fuseau);
const estQcm = (c: ContenuCarte): c is ContenuQcm => "options" in c;
const texteCarte = (c: ContenuCarte) => (estQcm(c) ? c.question : (c as ContenuFiche).recto);
const court = (texte: string, n = 90) => (texte.length > n ? `${texte.slice(0, n - 1).trimEnd()}…` : texte);

type LigneCarte = { id: number; genre: GenreCarte; contenu: ContenuCarte; seance_id: number; code: string; boite: number };

/** Carte telle que le téléphone la garde : options mélangées par Fisher-Yates avec la graine étudiant | carte | jour. */
function versCarteDto(l: LigneCarte, utilisateurId: number, jour: Jour): CarteDto {
  const base = { id: l.id, genre: l.genre, cours: l.code, seanceId: l.seance_id, boite: Number(l.boite) || 0 };
  const c = l.contenu;
  if (estQcm(c)) {
    const ordre = ordreMelange(c.options.length, aleaDepuis(`${utilisateurId}|${l.id}|${jour}`));
    return { ...base, question: c.question, options: ordre.map((i) => c.options[i]), ordre, bonne: ordre.indexOf(c.bonneReponse), explication: c.explication || undefined };
  }
  return { ...base, question: c.recto, verso: c.verso };
}

// ── Défi de la classe ──────────────────────────────────────────────────────

type Defi = { seanceId: number; seanceTitre: string; cours: string; lignes: LigneCarte[]; classeId: number | null };

/** Le défi du jour : les mêmes questions pour toute la classe (sans classe : pour tous les inscrits du cours). */
async function defiDe(u: Utilisateur, jour: Jour, ids: number[]): Promise<Defi | null> {
  if (!ids.length) return null;
  let coursDuDefi = ids;
  if (u.classeId) {
    const { rows } = await db.execute<{ cours_id: number }>(sql`SELECT cours_id FROM campus.cours_classes WHERE classe_id = ${u.classeId}`);
    const deLaClasse = new Set(rows.map((r) => r.cours_id));
    coursDuDefi = ids.filter((id) => deLaClasse.has(id));
    if (!coursDuDefi.length) return null;
  }
  const { rows: seances } = await db.execute<{ id: number; titre: string; cours_id: number; code: string }>(sql`
    SELECT s.id, s.titre, s.cours_id, c.code
    FROM campus.seances s JOIN campus.cours c ON c.id = s.cours_id
    WHERE s.cours_id = ANY(${entiers(coursDuDefi)})
      AND s.debut <= now() AND s.debut >= now() - make_interval(days => ${DEFI_JOURS_MAX})
      AND EXISTS (SELECT 1 FROM campus.cartes_revision k WHERE k.seance_id = s.id AND k.active AND k.genre = 'qcm')
    ORDER BY s.debut DESC LIMIT 1`);
  const s = seances[0];
  if (!s) return null;
  const graine = u.classeId ? `defi|classe:${u.classeId}|${jour}` : `defi|cours:${s.cours_id}|${jour}`;
  const { rows: lignes } = await db.execute<LigneCarte>(sql`
    SELECT k.id, k.genre, k.contenu, k.seance_id, ${s.code}::text AS code, COALESCE(re.boite, 0) AS boite
    FROM campus.cartes_revision k
    LEFT JOIN campus.revisions_etudiants re ON re.carte_id = k.id AND re.utilisateur_id = ${u.id}
    WHERE k.seance_id = ${s.id} AND k.active AND k.genre = 'qcm'
    ORDER BY md5(${graine} || k.id::text) LIMIT ${CARTES_DEFI}`);
  if (!lignes.length) return null;
  return { seanceId: s.id, seanceTitre: s.titre, cours: s.code, lignes, classeId: u.classeId };
}

/** Défi relevé (toutes ses questions répondues aujourd'hui depuis le défi) et, dans une classe de 5 ou plus, combien l'ont relevé. */
async function etatDefi(u: Utilisateur, jour: Jour, d: Defi): Promise<{ fait: boolean; releve: { n: number; sur: number } | null }> {
  const ids = entiers(d.lignes.map((l) => l.id));
  const besoin = d.lignes.length;
  const { rows } = await db.execute<{ n: number }>(sql`
    SELECT count(DISTINCT carte_id)::int AS n FROM campus.reponses_revision
    WHERE utilisateur_id = ${u.id} AND jour = ${jour} AND origine = 'defi' AND carte_id = ANY(${ids})`);
  const fait = (rows[0]?.n ?? 0) >= besoin;
  if (!d.classeId) return { fait, releve: null };
  const { rows: classe } = await db.execute<{ sur: number; n: number }>(sql`
    WITH membres AS (SELECT id FROM campus.utilisateurs WHERE classe_id = ${d.classeId} AND role = 'etudiant' AND actif)
    SELECT (SELECT count(*) FROM membres)::int AS sur,
      (SELECT count(*) FROM (
        SELECT r.utilisateur_id FROM campus.reponses_revision r
        WHERE r.utilisateur_id IN (SELECT id FROM membres) AND r.jour = ${jour} AND r.origine = 'defi' AND r.carte_id = ANY(${ids})
        GROUP BY r.utilisateur_id HAVING count(DISTINCT r.carte_id) >= ${besoin}) t)::int AS n`);
  const sur = classe[0]?.sur ?? 0;
  return { fait, releve: sur >= SEUIL_COLLECTIF ? { n: classe[0]?.n ?? 0, sur } : null };
}

// ── Cartes du jour ─────────────────────────────────────────────────────────

async function cartesDues(u: Utilisateur, jour: Jour, ids: number[], exclues: number[], limite: number) {
  const { rows } = await db.execute<LigneCarte>(sql`
    SELECT k.id, k.genre, k.contenu, k.seance_id, c.code, re.boite
    FROM campus.revisions_etudiants re
    JOIN campus.cartes_revision k ON k.id = re.carte_id
    JOIN campus.cours c ON c.id = k.cours_id
    WHERE re.utilisateur_id = ${u.id} AND re.prochaine_le <= ${jour} AND k.active
      AND k.cours_id = ANY(${entiers(ids)}) AND NOT (k.id = ANY(${entiers(exclues)}))
    ORDER BY re.boite, re.prochaine_le, md5(${`${u.id}|${jour}`} || k.id::text)
    LIMIT ${limite}`);
  return rows;
}

/** Cartes jamais vues : une par séance à tour de rôle (la plus récente d'abord), pour mêler les cours. */
async function cartesNouvelles(u: Utilisateur, jour: Jour, ids: number[], exclues: number[], limite: number) {
  if (limite <= 0) return [];
  const { rows } = await db.execute<LigneCarte>(sql`
    SELECT id, genre, contenu, seance_id, code, 0 AS boite FROM (
      SELECT k.id, k.genre, k.contenu, k.seance_id, c.code, s.debut,
        row_number() OVER (PARTITION BY k.seance_id ORDER BY md5(${`${u.id}|${jour}`} || k.id::text)) AS rang
      FROM campus.cartes_revision k
      JOIN campus.seances s ON s.id = k.seance_id
      JOIN campus.cours c ON c.id = k.cours_id
      WHERE k.active AND k.cours_id = ANY(${entiers(ids)}) AND NOT (k.id = ANY(${entiers(exclues)}))
        AND NOT EXISTS (SELECT 1 FROM campus.revisions_etudiants re WHERE re.utilisateur_id = ${u.id} AND re.carte_id = k.id)
    ) n
    ORDER BY rang, debut DESC, id
    LIMIT ${limite}`);
  return rows;
}

async function comptes(u: Utilisateur, jour: Jour, ids: number[]) {
  const { rows } = await db.execute<{ dues: number; faites: number; prochaine: string | null; nouvelles: number }>(sql`
    SELECT
      (SELECT count(*) FROM campus.revisions_etudiants re JOIN campus.cartes_revision k ON k.id = re.carte_id
        WHERE re.utilisateur_id = ${u.id} AND re.prochaine_le <= ${jour} AND k.active AND k.cours_id = ANY(${entiers(ids)}))::int AS dues,
      (SELECT count(*) FROM campus.reponses_revision WHERE utilisateur_id = ${u.id} AND jour = ${jour})::int AS faites,
      (SELECT min(re.prochaine_le)::text FROM campus.revisions_etudiants re JOIN campus.cartes_revision k ON k.id = re.carte_id
        WHERE re.utilisateur_id = ${u.id} AND re.prochaine_le > ${jour} AND k.active AND k.cours_id = ANY(${entiers(ids)})) AS prochaine,
      (SELECT count(*) FROM (SELECT 1 FROM campus.cartes_revision k
        WHERE k.active AND k.cours_id = ANY(${entiers(ids)})
          AND NOT EXISTS (SELECT 1 FROM campus.revisions_etudiants re WHERE re.utilisateur_id = ${u.id} AND re.carte_id = k.id)
        LIMIT ${CARTES_PAR_JOUR + CARTES_D_AVANCE}) x)::int AS nouvelles`);
  return rows[0] ?? { dues: 0, faites: 0, prochaine: null, nouvelles: 0 };
}

/** Le paquet de la révision du jour, ou d'une seule séance (« Réviser ce cours en 5 min »). */
export async function paquetRevision(u: Utilisateur, seance?: Pick<Seance, "id" | "coursId">): Promise<PaquetRevision> {
  const jour = jourDe(u);
  const base = { utilisateurId: u.id, jour, genereLe: new Date().toISOString(), seanceId: seance?.id ?? null };
  let defi: DefiDto | null = null;
  let lignes: LigneCarte[] = [];
  let parJour = CARTES_PAR_JOUR;
  let dues = 0;
  let faites = 0;
  let prochaine: Jour | null = null;
  if (seance) {
    parJour = CARTES_PAR_SEANCE;
    const { rows } = await db.execute<LigneCarte & { due: boolean }>(sql`
      SELECT k.id, k.genre, k.contenu, k.seance_id, c.code, COALESCE(re.boite, 0) AS boite, COALESCE(re.prochaine_le <= ${jour}, false) AS due
      FROM campus.cartes_revision k
      JOIN campus.cours c ON c.id = k.cours_id
      LEFT JOIN campus.revisions_etudiants re ON re.carte_id = k.id AND re.utilisateur_id = ${u.id}
      WHERE k.seance_id = ${seance.id} AND k.active
      ORDER BY COALESCE(re.prochaine_le <= ${jour}, false) DESC, (re.carte_id IS NULL) DESC, re.boite NULLS FIRST, re.prochaine_le NULLS FIRST,
        md5(${`${u.id}|${jour}`} || k.id::text)
      LIMIT ${CARTES_PAR_JOUR + CARTES_D_AVANCE}`);
    lignes = rows;
    dues = rows.filter((r) => r.due).length;
  } else {
    const ids = await idsCoursAccessibles(u);
    const d = await defiDe(u, jour, ids);
    if (d) {
      const etat = await etatDefi(u, jour, d);
      defi = { cours: d.cours, seanceTitre: d.seanceTitre, cartes: d.lignes.map((l) => versCarteDto(l, u.id, jour)), ...etat };
    }
    const exclues = d?.lignes.map((l) => l.id) ?? [];
    const total = CARTES_PAR_JOUR + CARTES_D_AVANCE;
    const lesDues = await cartesDues(u, jour, ids, exclues, total);
    lignes = [...lesDues, ...(await cartesNouvelles(u, jour, ids, exclues, total - lesDues.length))];
    const c = await comptes(u, jour, ids);
    dues = c.dues;
    faites = c.faites;
    prochaine = c.prochaine;
  }
  const paquet: PaquetRevision = { ...base, defi, cartes: lignes.map((l) => versCarteDto(l, u.id, jour)), parJour, dues, faitesAujourdhui: faites, prochaine };
  // Budget du téléphone : au-delà de 20 Ko, on garde moins de cartes d'avance.
  while (paquet.cartes.length > parJour && Buffer.byteLength(JSON.stringify(paquet)) > POIDS_MAX_PAQUET) paquet.cartes.pop();
  return paquet;
}

/** Le résumé léger : y a-t-il une révision à faire, et le défi est-il relevé ? */
export async function revisionDuJour(u: Utilisateur): Promise<RevisionDuJour> {
  const jour = jourDe(u);
  const ids = await idsCoursAccessibles(u);
  const vide: RevisionDuJour = { jour, disponible: false, dues: 0, nouvelles: 0, aFaire: 0, faitesAujourdhui: 0, defi: null, prochaine: null };
  if (!ids.length) return vide;
  const [c, d] = await Promise.all([comptes(u, jour, ids), defiDe(u, jour, ids)]);
  const defi = d ? { cours: d.cours, ...(await etatDefi(u, jour, d)) } : null;
  const disponible = c.dues + c.nouvelles > 0 || Boolean(c.prochaine) || Boolean(defi);
  return {
    jour,
    disponible,
    dues: c.dues,
    nouvelles: c.nouvelles,
    aFaire: Math.min(CARTES_PAR_JOUR, c.dues + c.nouvelles),
    faitesAujourdhui: c.faites,
    defi,
    prochaine: c.dues ? null : c.prochaine,
  };
}

// ── Réponses ───────────────────────────────────────────────────────────────

/**
 * Enregistre un lot de réponses (40 au plus), recorrigées ici. Idempotent sur
 * (étudiant, clé d'envoi) : un lot renvoyé par la file hors ligne n'est jamais
 * compté deux fois. Une réponse faite sans réseau compte pour le jour où elle a
 * été faite si elle arrive sous 48 h, sinon pour le jour de réception.
 */
export async function enregistrerReponses(u: Utilisateur, reponses: ReponseRevisionEnvoi[], recu = new Date()): Promise<ResultatReponses> {
  const idsCartes = [...new Set(reponses.map((r) => r.carteId))];
  if (!idsCartes.length) return { enregistrees: 0, doublons: 0, ignorees: 0 };
  const { rows: cartes } = await db.execute<{ id: number; cours_id: number; genre: GenreCarte; contenu: ContenuCarte }>(
    sql`SELECT id, cours_id, genre, contenu FROM campus.cartes_revision WHERE id = ANY(${entiers(idsCartes)})`,
  );
  const parId = new Map(cartes.map((c) => [c.id, c]));
  const permis = new Set(await idsCoursMediatheque(u));
  const maintenant = recu.getTime();

  type Valide = { carteId: number; juste: boolean; origine: string; jour: Jour; reponduLe: Date; cle: string };
  const valides: Valide[] = [];
  for (const r of reponses) {
    const c = parId.get(r.carteId);
    if (!c || !permis.has(c.cours_id)) continue;
    let juste: boolean;
    if (estQcm(c.contenu)) {
      if (!Number.isInteger(r.choix)) continue;
      juste = r.choix === c.contenu.bonneReponse;
    } else {
      if (typeof r.savait !== "boolean") continue;
      juste = r.savait;
    }
    // Horloge du téléphone : une heure dans le futur est ramenée à la réception.
    const fait = Number.isFinite(r.reponduLe) && r.reponduLe <= maintenant + 5 * 60_000 ? Math.min(r.reponduLe, maintenant) : maintenant;
    const jour = maintenant - fait <= DELAI_JOUR_REPONSE_MS ? jourDe(u, fait) : jourDe(u, maintenant);
    valides.push({ carteId: c.id, juste, origine: r.origine, jour, reponduLe: new Date(fait), cle: r.cle });
  }
  const ignorees = reponses.length - valides.length;
  if (!valides.length) return { enregistrees: 0, doublons: 0, ignorees };

  const nouvelles = await db.transaction(async (tx) => {
    const { rows: inserees } = await tx.execute<{ carte_id: number; juste: boolean; jour: string; repondu_le: string }>(sql`
      INSERT INTO campus.reponses_revision (utilisateur_id, carte_id, juste, origine, jour, repondu_le, cle_envoi, classe_id, site_id)
      VALUES ${sql.join(
        valides.map((v) => sql`(${u.id}, ${v.carteId}, ${v.juste}, ${v.origine}, ${v.jour}, ${v.reponduLe.toISOString()}::timestamptz, ${v.cle}, ${u.classeId}, ${u.siteId})`),
        sql`, `,
      )}
      ON CONFLICT (utilisateur_id, cle_envoi) DO NOTHING
      RETURNING carte_id, juste, jour::text AS jour, repondu_le`);
    if (!inserees.length) return inserees;

    // Boîtes : réponses appliquées dans l'ordre où elles ont été faites.
    const touchees = [...new Set(inserees.map((r) => r.carte_id))];
    const { rows: etats } = await tx.execute<{ carte_id: number; boite: number; prochaine_le: string; bonnes: number; erreurs: number; derniere_le: string }>(sql`
      SELECT carte_id, boite, prochaine_le::text AS prochaine_le, bonnes, erreurs, derniere_le
      FROM campus.revisions_etudiants WHERE utilisateur_id = ${u.id} AND carte_id = ANY(${entiers(touchees)}) FOR UPDATE`);
    type Etat = { boite: number; prochaine: Jour; bonnes: number; erreurs: number; derniere: number };
    const etat = new Map<number, Etat>(
      etats.map((e) => [e.carte_id, { boite: e.boite, prochaine: e.prochaine_le, bonnes: e.bonnes, erreurs: e.erreurs, derniere: new Date(e.derniere_le).getTime() }]),
    );
    for (const r of [...inserees].sort((a, b) => new Date(a.repondu_le).getTime() - new Date(b.repondu_le).getTime())) {
      const quand = new Date(r.repondu_le).getTime();
      const avant = etat.get(r.carte_id) ?? null;
      const compte = { bonnes: (avant?.bonnes ?? 0) + (r.juste ? 1 : 0), erreurs: (avant?.erreurs ?? 0) + (r.juste ? 0 : 1) };
      // Réponse plus ancienne que la dernière connue (arrivée en retard) : comptée, sans déplacer la carte.
      if (avant && quand < avant.derniere) {
        etat.set(r.carte_id, { ...avant, ...compte });
        continue;
      }
      const b = boiteApres(avant ? { boite: avant.boite, prochaine: avant.prochaine } : null, r.juste, r.jour, ajouterJours);
      etat.set(r.carte_id, { boite: b.boite, prochaine: b.prochaine, ...compte, derniere: quand });
    }
    await tx.execute(sql`
      INSERT INTO campus.revisions_etudiants (utilisateur_id, carte_id, boite, prochaine_le, bonnes, erreurs, derniere_le)
      VALUES ${sql.join(
        [...etat].map(([carteId, e]) => sql`(${u.id}, ${carteId}, ${e.boite}, ${e.prochaine}::date, ${e.bonnes}, ${e.erreurs}, ${new Date(e.derniere).toISOString()}::timestamptz)`),
        sql`, `,
      )}
      ON CONFLICT (utilisateur_id, carte_id) DO UPDATE SET
        boite = excluded.boite, prochaine_le = excluded.prochaine_le, bonnes = excluded.bonnes,
        erreurs = excluded.erreurs, derniere_le = excluded.derniere_le`);
    return inserees;
  });

  const rateesQcm = [...new Set(nouvelles.filter((r) => !r.juste).map((r) => r.carte_id))].filter((id) => parId.get(id)?.genre === "qcm");
  if (rateesQcm.length) await verifierAnomalies(rateesQcm).catch((e) => console.error("[révision] anomalies :", (e as Error).message));
  return { enregistrees: nouvelles.length, doublons: valides.length - nouvelles.length, ignorees };
}

/**
 * Question ratée par au moins 70 % d'au moins 10 étudiants (première réponse de
 * chacun, depuis la dernière décision du formateur) : la routine du soir a pu se
 * tromper. Elle sort de la révision et le formateur est prévenu.
 */
async function verifierAnomalies(carteIds: number[]) {
  const { rows } = await db.execute<{ id: number; n: number; erreurs: number }>(sql`
    SELECT p.carte_id AS id, count(*)::int AS n, count(*) FILTER (WHERE NOT p.juste)::int AS erreurs
    FROM (
      SELECT DISTINCT ON (r.utilisateur_id, r.carte_id) r.carte_id, r.juste
      FROM campus.reponses_revision r JOIN campus.cartes_revision k ON k.id = r.carte_id
      WHERE r.carte_id = ANY(${entiers(carteIds)}) AND k.genre = 'qcm' AND k.active AND (k.relue_le IS NULL OR r.repondu_le > k.relue_le)
      ORDER BY r.utilisateur_id, r.carte_id, r.repondu_le
    ) p
    GROUP BY p.carte_id
    HAVING count(*) >= ${ANOMALIE_MIN_ETUDIANTS} AND count(*) FILTER (WHERE NOT p.juste) >= ${ANOMALIE_TAUX_ERREUR}::float * count(*)`);
  for (const r of rows) await retirerCarte(r.id, { raison: "ratee", taux: Math.round((100 * r.erreurs) / r.n) });
}

/** Retire une carte de la révision (une seule fois) et prévient les formateurs du cours dans la cloche, sans rappel sur le téléphone. */
async function retirerCarte(carteId: number, motif: { raison: "signalee"; n: number } | { raison: "ratee"; taux: number }) {
  const { rows } = await db.execute<{ seance_id: number; cours_id: number; contenu: ContenuCarte; code: string }>(sql`
    UPDATE campus.cartes_revision k SET a_relire = true, active = false
    FROM campus.cours c
    WHERE k.id = ${carteId} AND NOT k.a_relire AND c.id = k.cours_id
    RETURNING k.seance_id, k.cours_id, k.contenu, c.code`);
  const k = rows[0];
  if (!k) return false;
  const formateurs = (await formateursDuCours(k.cours_id)).filter((f) => f.actif).map((f) => f.id);
  const v = { cours: k.code, question: court(texteCarte(k.contenu), 80) };
  await notifier(formateurs, {
    type: "cours",
    titre: t("notif.titre", { registre: "vous" }),
    corps: motif.raison === "signalee" ? t("notif.signalee", { registre: "vous", v: { ...v, n: motif.n } }) : t("notif.ratee", { registre: "vous", v: { ...v, taux: motif.taux } }),
    lien: `/mediatheque/cours/${k.seance_id}`,
    push: false,
  });
  return true;
}

// ── Signalements et décisions du formateur ─────────────────────────────────

export type CarteChargee = { id: number; cle: string; cours_id: number; seance_id: number; source: SourceCarte; a_relire: boolean };

export async function chargerCarte(id: number): Promise<CarteChargee | null> {
  const { rows } = await db.execute<CarteChargee>(sql`SELECT id, cle, cours_id, seance_id, source, a_relire FROM campus.cartes_revision WHERE id = ${id}`);
  return rows[0] ?? null;
}

/** « Signaler une erreur » : un signalement par étudiant ; au 3e, la carte est retirée et les formateurs prévenus. */
export async function signalerCarte(u: Utilisateur, carte: CarteChargee, motif: string): Promise<{ deja: boolean; retiree: boolean }> {
  const { rows } = await db.execute(sql`
    INSERT INTO campus.signalements_cartes (carte_id, utilisateur_id, motif) VALUES (${carte.id}, ${u.id}, ${motif.slice(0, 300)})
    ON CONFLICT DO NOTHING RETURNING carte_id`);
  if (!rows.length) return { deja: true, retiree: false };
  const { rows: maj } = await db.execute<{ signalements: number; a_relire: boolean }>(
    sql`UPDATE campus.cartes_revision SET signalements = signalements + 1 WHERE id = ${carte.id} RETURNING signalements, a_relire`,
  );
  const n = maj[0]?.signalements ?? 0;
  const retiree = n >= SIGNALEMENTS_RETRAIT && !maj[0]?.a_relire ? await retirerCarte(carte.id, { raison: "signalee", n }) : false;
  return { deja: false, retiree };
}

/**
 * Décision du formateur sur une carte retirée : la réactiver (les signalements
 * repartent de zéro, les erreurs d'avant ne comptent plus) ou la garder retirée.
 * Une carte disparue du dossier refait reste hors de la révision.
 */
export async function deciderCarte(carte: CarteChargee, decision: "reactiver" | "retirer"): Promise<void> {
  if (decision === "retirer") {
    await db.execute(sql`UPDATE campus.cartes_revision SET a_relire = true, active = false, relue_le = now() WHERE id = ${carte.id}`);
    return;
  }
  let presente = true;
  if (carte.source !== "sondage") {
    const { rows } = await db.execute<{ dossier: DossierCours | null }>(sql`SELECT dossier FROM campus.etudes_seances WHERE seance_id = ${carte.seance_id} AND statut = 'prete'`);
    const dossier = rows[0]?.dossier;
    presente = dossier ? extraireCartes(carte.seance_id, dossier).some((c) => c.cle === carte.cle) : true;
  }
  await db.transaction(async (tx) => {
    await tx.execute(sql`UPDATE campus.cartes_revision SET a_relire = false, active = ${presente}, relue_le = now(), signalements = 0 WHERE id = ${carte.id}`);
    await tx.execute(sql`DELETE FROM campus.signalements_cartes WHERE carte_id = ${carte.id}`);
  });
}

// ── Chiffres de la classe (formateur du cours, direction) ──────────────────

/** Notion du cours la plus proche d'une question (mots communs), pour renvoyer au bon passage de l'enregistrement. */
function notionProche(texte: string, notions: DossierCours["notions"]): { titre: string; debutSecondes: number } | null {
  const mots = new Set(normaliserTexte(texte).split(" ").filter((m) => m.length >= 6));
  let meilleure: { titre: string; debutSecondes: number; score: number } | null = null;
  for (const n of notions ?? []) {
    if (!n?.titre || !(n.debutSecondes > 0)) continue;
    const score = normaliserTexte(n.titre)
      .split(" ")
      .filter((m) => m.length >= 6 && mots.has(m)).length;
    if (score > 0 && (!meilleure || score > meilleure.score)) meilleure = { titre: n.titre, debutSecondes: n.debutSecondes, score };
  }
  return meilleure ? { titre: meilleure.titre, debutSecondes: meilleure.debutSecondes } : null;
}

export async function revisionClasse(s: Pick<Seance, "id" | "coursId">): Promise<RevisionClasseDto> {
  const [inscrits, { rows: compte }, { rows: quiz }, { rows: dossiers }] = await Promise.all([
    etudiantsDuCours(s.coursId).then((l) => l.length),
    db.execute<{ n: number }>(sql`
      SELECT count(DISTINCT r.utilisateur_id)::int AS n FROM campus.reponses_revision r
      JOIN campus.cartes_revision k ON k.id = r.carte_id WHERE k.seance_id = ${s.id}`),
    db.execute<{ n: number; moyenne: number | null }>(sql`
      SELECT count(*)::int AS n, avg(quiz_meilleur::float / quiz_total) AS moyenne
      FROM campus.suivis_cours_complets WHERE seance_id = ${s.id} AND quiz_total > 0`),
    db.execute<{ dossier: DossierCours | null }>(sql`SELECT dossier FROM campus.etudes_seances WHERE seance_id = ${s.id} AND statut = 'prete'`),
  ]);
  const dossier = dossiers[0]?.dossier ?? null;
  const revisePar = compte[0]?.n ?? 0;
  const assez = revisePar >= SEUIL_COLLECTIF;

  // Première réponse de chaque étudiant à chaque carte de la séance.
  const { rows: parCarte } = await db.execute<{
    id: number;
    source: SourceCarte;
    position: number;
    contenu: ContenuCarte;
    a_relire: boolean;
    relue_le: string | null;
    signalements: number;
    n: number;
    erreurs: number;
  }>(sql`
    SELECT k.id, k.source, k.position, k.contenu, k.a_relire, k.relue_le, k.signalements,
      count(p.carte_id)::int AS n, count(p.carte_id) FILTER (WHERE NOT p.juste)::int AS erreurs
    FROM campus.cartes_revision k
    LEFT JOIN (
      SELECT DISTINCT ON (r.utilisateur_id, r.carte_id) r.carte_id, r.juste
      FROM campus.reponses_revision r JOIN campus.cartes_revision kk ON kk.id = r.carte_id
      WHERE kk.seance_id = ${s.id}
      ORDER BY r.utilisateur_id, r.carte_id, r.repondu_le
    ) p ON p.carte_id = k.id
    WHERE k.seance_id = ${s.id} AND (k.a_relire OR k.genre = 'qcm')
    GROUP BY k.id`);

  const nbQuiz = dossier?.quiz?.length ?? 0;
  const moyenneQuiz =
    assez && (quiz[0]?.n ?? 0) >= SEUIL_COLLECTIF && quiz[0]?.moyenne != null && nbQuiz
      ? { moyenne: Math.round(quiz[0].moyenne * nbQuiz * 10) / 10, sur: nbQuiz, etudiants: quiz[0].n }
      : null;
  const plusRatees = assez
    ? parCarte
        .filter((k) => k.source === "quiz" && k.n >= SEUIL_COLLECTIF && k.erreurs / k.n >= 0.3)
        .sort((a, b) => b.erreurs / b.n - a.erreurs / a.n || a.position - b.position)
        .slice(0, 3)
        .map((k) => {
          const c = k.contenu as ContenuQcm;
          return {
            position: k.position + 1,
            question: court(c.question, 140),
            tauxErreur: Math.round((100 * k.erreurs) / k.n),
            notion: dossier ? notionProche(`${c.question} ${c.explication}`, dossier.notions) : null,
          };
        })
    : null;

  const aRelire = parCarte.filter((k) => k.a_relire);
  const motifs = aRelire.length
    ? (
        await db.execute<{ carte_id: number; motif: string }>(sql`
          SELECT DISTINCT carte_id, motif FROM campus.signalements_cartes WHERE carte_id = ANY(${entiers(aRelire.map((k) => k.id))}) AND motif <> ''`)
      ).rows
    : [];
  return {
    inscrits,
    revisePar,
    moyenneQuiz,
    plusRatees,
    aRelire: aRelire
      .map((k) => ({
        id: k.id,
        source: k.source,
        position: k.source === "sondage" ? 0 : k.position + 1,
        question: court(texteCarte(k.contenu), 200),
        signalements: k.signalements,
        tauxErreur: k.n >= ANOMALIE_MIN_ETUDIANTS ? Math.round((100 * k.erreurs) / k.n) : null,
        motifs: motifs.filter((m) => m.carte_id === k.id).map((m) => m.motif),
        decision: k.relue_le ? ("retiree" as const) : null,
      }))
      .sort((a, b) => Number(a.decision !== null) - Number(b.decision !== null) || a.position - b.position),
  };
}

// ── Onglet « Réviser » d'un cours, suivi du cours complet ──────────────────

export async function coursCompletsDuCours(u: Utilisateur, coursId: number): Promise<CoursCompletARevise[]> {
  const etudiant = u.role === "etudiant";
  const jour = jourDe(u);
  const { rows } = await db.execute<{
    id: number;
    titre: string;
    debut: string;
    cartes: number;
    a_revoir: number | null;
    ouvert: boolean | null;
    quiz_meilleur: number | null;
    quiz_total: number | null;
  }>(sql`
    SELECT s.id, s.titre, s.debut,
      (SELECT count(*) FROM campus.cartes_revision k WHERE k.seance_id = s.id AND k.active)::int AS cartes,
      ${
        etudiant
          ? sql`(SELECT count(*) FROM campus.revisions_etudiants re JOIN campus.cartes_revision k ON k.id = re.carte_id
              WHERE k.seance_id = s.id AND k.active AND re.utilisateur_id = ${u.id} AND re.prochaine_le <= ${jour})::int`
          : sql`NULL::int`
      } AS a_revoir,
      ${etudiant ? sql`(sc.utilisateur_id IS NOT NULL)` : sql`NULL::boolean`} AS ouvert,
      sc.quiz_meilleur, sc.quiz_total
    FROM campus.seances s
    JOIN campus.etudes_seances e ON e.seance_id = s.id AND e.statut = 'prete'
    LEFT JOIN campus.suivis_cours_complets sc ON sc.seance_id = s.id AND sc.utilisateur_id = ${u.id}
    WHERE s.cours_id = ${coursId}
    ORDER BY s.debut DESC LIMIT 60`);
  return rows.map((r) => ({
    seanceId: r.id,
    titre: r.titre,
    debut: new Date(r.debut).toISOString(),
    cartes: r.cartes,
    aRevoir: r.a_revoir,
    ouvert: r.ouvert,
    quiz: etudiant && r.quiz_total ? { meilleur: r.quiz_meilleur ?? 0, total: r.quiz_total } : null,
  }));
}

/** Suivi du cours complet : ouverture, fiche vue, exercice fait (ou difficile), corrigé vu, quiz terminé (meilleur score gardé). */
export async function noterSuivi(u: Utilisateur, seanceId: number, e: EvenementSuivi): Promise<void> {
  let maj: SQL = sql``;
  switch (e.evenement) {
    case "ouverture":
      break;
    case "fiche":
      maj = sql`, fiches_vues = campus.suivis_cours_complets.fiches_vues + 1`;
      break;
    case "exercice":
    case "corrige": {
      const champ = e.evenement === "exercice" ? { etat: e.etat } : { corrige: true };
      maj = sql`, exercices_faits = campus.suivis_cours_complets.exercices_faits || jsonb_build_object(${String(e.index)}::text,
        COALESCE(campus.suivis_cours_complets.exercices_faits -> ${String(e.index)}::text, '{}'::jsonb) || ${JSON.stringify(champ)}::jsonb)`;
      break;
    }
    case "quiz":
      maj = sql`, quiz_total = CASE WHEN campus.suivis_cours_complets.quiz_meilleur IS NULL OR ${e.score} >= campus.suivis_cours_complets.quiz_meilleur
          THEN ${e.total} ELSE campus.suivis_cours_complets.quiz_total END,
        quiz_meilleur = GREATEST(COALESCE(campus.suivis_cours_complets.quiz_meilleur, 0), ${e.score})`;
      break;
  }
  const initial = {
    fiches: e.evenement === "fiche" ? 1 : 0,
    exercices: e.evenement === "exercice" ? { [e.index]: { etat: e.etat } } : e.evenement === "corrige" ? { [e.index]: { corrige: true } } : {},
    meilleur: e.evenement === "quiz" ? e.score : null,
    total: e.evenement === "quiz" ? e.total : null,
  };
  await db.execute(sql`
    INSERT INTO campus.suivis_cours_complets (utilisateur_id, seance_id, fiches_vues, exercices_faits, quiz_meilleur, quiz_total)
    VALUES (${u.id}, ${seanceId}, ${initial.fiches}, ${JSON.stringify(initial.exercices)}::jsonb, ${initial.meilleur}, ${initial.total})
    ON CONFLICT (utilisateur_id, seance_id) DO UPDATE SET revu_le = now() ${maj}`);
}
