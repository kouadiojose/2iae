// Devoir donné en direct depuis le Studio (demande de José du 12 octobre 2026 : « je veux créer le devoir pendant le
// cours, en direct : ils répondent, moi, je vois directement »). Feuille sans import de server/routes/* (pas de
// cycle entre évaluations et live, comme projection-copies.ts) : lecture du lien séance-devoir, état public du
// devoir pour la classe, groupe d'un étudiant pour un devoir en groupe, compteur public regroupé.
//
// Règles :
//   - rien de nominatif sur le canal « seance:<id> » (ouvert aux écrans de salle et aux formateurs invités) :
//     titre, consigne, date limite et compteurs seulement ;
//   - le groupe d'un étudiant pour un devoir en groupe est la ligne membres_groupes de la répartition du devoir
//     (devoirs_direct.session_groupes_id), jamais une liste envoyée par le client ; elle reste après la fermeture
//     des groupes, elle disparaît si l'étudiant quitte son groupe ou est ramené en classe ;
//   - un groupe qui contient un écran de salle ne répond pas en groupe (jusqu'à 40 étudiants émargés derrière).
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { inscritsParmi } from "./acces";
import { publier } from "./temps-reel";
import { echeance } from "./evaluations-outils";
import { CONSIGNE_DIRECT_MAX } from "@shared/devoir-direct";
import {
  devoirs,
  devoirsDirect,
  groupesTravail,
  membresGroupes,
  rendus,
  utilisateurs,
  type CompteurDevoirDirectDto,
  type Devoir,
  type DevoirDirect,
  type DevoirDirectDto,
  type GroupeDevoirDto,
  type MonRenduDirectDto,
  type PourGroupe,
  type PourGroupeDto,
  type Rendu,
  type RoleSeance,
  type Seance,
  type Utilisateur,
  estEcran,
} from "@shared/schema";

const canalSeance = (seanceId: number) => `seance:${seanceId}`;
/** « Awa K. » : prénom et initiale, la seule forme nominative montrée entre étudiants. */
export const prenomInitiale = (u: Pick<Utilisateur, "prenom" | "nom">) => `${u.prenom.trim()} ${u.nom.trim() ? `${u.nom.trim().charAt(0).toUpperCase()}.` : ""}`.trim();

// ── Lecture ────────────────────────────────────────────────────────────────

/** Lien séance-devoir d'un devoir, ou null (devoir ordinaire). */
export async function devoirDirectDe(devoirId: number): Promise<DevoirDirect | null> {
  const [dd] = await db.select().from(devoirsDirect).where(eq(devoirsDirect.devoirId, devoirId));
  return dd ?? null;
}

/** Dernier devoir donné en direct dans la séance (devoir publié), ou null. Un seul est montré à la fois. */
export async function dernierDevoirDirect(seanceId: number): Promise<{ dd: DevoirDirect; d: Devoir } | null> {
  const [l] = await db
    .select({ dd: devoirsDirect, d: devoirs })
    .from(devoirsDirect)
    .innerJoin(devoirs, eq(devoirs.id, devoirsDirect.devoirId))
    .where(and(eq(devoirsDirect.seanceId, seanceId), eq(devoirs.publie, true)))
    .orderBy(desc(devoirsDirect.creeLe), desc(devoirsDirect.devoirId))
    .limit(1);
  return l ?? null;
}

type Compteurs = { copies: number; groupes: number; individuelles: number };

/** Copies rendues (non brouillon), groupes distincts parmi elles, copies sans groupe : tous sites. */
export async function compteurs(devoirId: number): Promise<Compteurs> {
  const { rows } = await db.execute<{ copies: number; groupes: number; individuelles: number }>(sql`
    SELECT count(*)::int AS copies,
           count(DISTINCT pour_groupe->>'groupeId')::int AS groupes,
           (count(*) FILTER (WHERE pour_groupe IS NULL))::int AS individuelles
    FROM campus.rendus WHERE devoir_id = ${devoirId} AND statut <> 'brouillon'`);
  const l = rows[0];
  return { copies: Number(l?.copies ?? 0), groupes: Number(l?.groupes ?? 0), individuelles: Number(l?.individuelles ?? 0) };
}

const consigneCourte = (c: string) => (c.length > CONSIGNE_DIRECT_MAX ? `${c.slice(0, CONSIGNE_DIRECT_MAX - 1).trimEnd()}…` : c);

/** Copie rendue pour un groupe, telle qu'un écran la montre à « lecteurId ». */
export const versPourGroupeDto = (p: PourGroupe | null | undefined, lecteurId: number): PourGroupeDto | null =>
  p ? { groupeId: p.groupeId, nom: p.nom, parNom: p.parNom, parMoi: p.parId === lecteurId } : null;

/** Ma copie (non brouillon) de ce devoir, pour la carte de l'étudiant. */
export const versMonRendu = (r: Pick<Rendu, "statut" | "renduLe" | "majLe" | "recu" | "enRetard" | "pourGroupe">, lecteurId: number): MonRenduDirectDto | null =>
  r.statut === "brouillon"
    ? null
    : { statut: r.statut, renduLe: (r.renduLe ?? r.majLe).toISOString(), recu: r.recu, enRetard: r.enRetard, pourGroupe: versPourGroupeDto(r.pourGroupe, lecteurId) };

export function versDto(dd: DevoirDirect, d: Devoir, c: Compteurs, monRendu: MonRenduDirectDto | null): DevoirDirectDto {
  return {
    id: d.id,
    titre: d.titre,
    consigne: consigneCourte(d.consigne),
    dateLimite: echeance(d).toISOString(),
    accepteRetard: d.accepteRetard,
    enGroupe: dd.enGroupe,
    creeLe: dd.creeLe.toISOString(),
    copies: c.copies,
    groupes: c.groupes,
    individuelles: c.individuelles,
    monRendu,
  };
}

/** État public du devoir en direct d'un devoir donné (monRendu nul), ou null si ce n'est pas un devoir en direct. */
export async function dtoPublic(dd: DevoirDirect, d: Devoir): Promise<DevoirDirectDto> {
  return versDto(dd, d, await compteurs(d.id), null);
}

/** Pour GET /api/seances/:id/direct : le dernier devoir en direct, avec la copie de l'étudiant (étudiant seulement). */
export async function devoirDirectPour(u: Pick<Utilisateur, "id">, role: RoleSeance, s: Pick<Seance, "id">): Promise<DevoirDirectDto | null> {
  const dernier = await dernierDevoirDirect(s.id);
  if (!dernier) return null;
  let monRendu: MonRenduDirectDto | null = null;
  if (role === "etudiant") {
    const [r] = await db.select().from(rendus).where(and(eq(rendus.devoirId, dernier.d.id), eq(rendus.etudiantId, u.id), ne(rendus.statut, "brouillon")));
    monRendu = r ? versMonRendu(r, u.id) : null;
  }
  return versDto(dernier.dd, dernier.d, await compteurs(dernier.d.id), monRendu);
}

/** Publie à toute la classe le dernier devoir en direct de la séance (ou null : plus aucun). */
export async function publierDevoirDirect(seanceId: number): Promise<DevoirDirectDto | null> {
  const dernier = await dernierDevoirDirect(seanceId);
  const dto = dernier ? await dtoPublic(dernier.dd, dernier.d) : null;
  publier(canalSeance(seanceId), "devoir-direct", dto);
  return dto;
}

// ── Groupe d'un étudiant pour un devoir en groupe ──────────────────────────

/** Dernière réponse rendue pour un groupe : la copie de son auteur si elle porte cette heure, sinon une copie de cette réponse. */
export async function derniereReponseGroupe(devoirId: number, groupeId: number): Promise<Rendu | null> {
  const lignes = await db
    .select()
    .from(rendus)
    .where(and(eq(rendus.devoirId, devoirId), ne(rendus.statut, "brouillon"), isNotNull(rendus.renduLe), sql`${rendus.pourGroupe}->>'groupeId' = ${String(groupeId)}`))
    .orderBy(desc(rendus.renduLe), asc(rendus.id));
  const plusRecente = lignes[0];
  if (!plusRecente?.renduLe) return null;
  const t = plusRecente.renduLe.getTime();
  const memeReponse = lignes.filter((r) => r.renduLe?.getTime() === t);
  return memeReponse.find((r) => r.pourGroupe?.parId === r.etudiantId) ?? plusRecente;
}

export type SituationGroupe =
  /** Le devoir n'est pas un devoir en direct en groupe (ou sa répartition a été effacée). */
  | { etat: "pas_en_groupe" }
  /** Devoir en groupe, mais l'étudiant n'a pas de groupe dans sa répartition (resté en classe, quitté, ramené). */
  | { etat: "sans_groupe"; dd: DevoirDirect & { sessionGroupesId: number } }
  /** Son groupe contient un écran de salle : chacun répond pour soi. */
  | { etat: "salle"; dd: DevoirDirect & { sessionGroupesId: number }; groupeId: number; nom: string }
  | {
      etat: "groupe";
      dd: DevoirDirect & { sessionGroupesId: number };
      sessionId: number;
      groupeId: number;
      nom: string;
      /** Étudiants actifs, inscrits au cours, triés par identifiant (l'étudiant compris s'il est inscrit). */
      membres: Utilisateur[];
      actuelle: { renduLe: Date; parId: number; parNom: string; rendu: Rendu } | null;
    };

/** Où en est cet étudiant pour ce devoir en groupe (règles 5.1 de la spécification). */
export async function situationGroupe(d: Pick<Devoir, "id" | "coursId">, etudiantId: number): Promise<SituationGroupe> {
  const dd = await devoirDirectDe(d.id);
  if (!dd || !dd.enGroupe || dd.sessionGroupesId === null) return { etat: "pas_en_groupe" };
  const ddg = dd as DevoirDirect & { sessionGroupesId: number };
  const [m] = await db
    .select({ groupeId: membresGroupes.groupeId, nom: groupesTravail.nom })
    .from(membresGroupes)
    .innerJoin(groupesTravail, eq(groupesTravail.id, membresGroupes.groupeId))
    .where(and(eq(membresGroupes.sessionId, dd.sessionGroupesId), eq(membresGroupes.utilisateurId, etudiantId)));
  if (!m) return { etat: "sans_groupe", dd: ddg };
  const personnes = await db
    .select({ u: utilisateurs })
    .from(membresGroupes)
    .innerJoin(utilisateurs, eq(utilisateurs.id, membresGroupes.utilisateurId))
    .where(eq(membresGroupes.groupeId, m.groupeId));
  if (personnes.some((p) => estEcran(p.u))) return { etat: "salle", dd: ddg, groupeId: m.groupeId, nom: m.nom };
  // Inscription vérifiée pour les seuls membres du groupe (pas tout le cours : chaque étudiant relit son groupe).
  const candidats = personnes.filter((p) => p.u.role === "etudiant" && p.u.actif).map((p) => p.u.id);
  const inscrits = await inscritsParmi(d.coursId, candidats);
  const membres = personnes
    .map((p) => p.u)
    .filter((u) => u.role === "etudiant" && u.actif && inscrits.has(u.id))
    .sort((a, b) => a.id - b.id);
  const r = await derniereReponseGroupe(d.id, m.groupeId);
  const actuelle = r?.renduLe && r.pourGroupe ? { renduLe: r.renduLe, parId: r.pourGroupe.parId, parNom: r.pourGroupe.parNom, rendu: r } : null;
  return { etat: "groupe", dd: ddg, sessionId: dd.sessionGroupesId, groupeId: m.groupeId, nom: m.nom, membres, actuelle };
}

/** Groupe de l'étudiant pour un devoir en groupe (null : devoir pas en groupe, pas de groupe, groupe avec une salle). */
export async function groupeDuDevoir(d: Pick<Devoir, "id" | "coursId">, etudiantId: number) {
  const g = await situationGroupe(d, etudiantId);
  return g.etat === "groupe" ? g : null;
}

/**
 * Pour GET /api/seances/:id/groupes (étudiant) : son groupe pour le dernier devoir en direct de la séance, s'il
 * est en groupe, même après la fermeture des groupes. Camarades en prénom et initiale ; la dernière réponse du
 * groupe, même s'il n'en a pas la copie (membre arrivé après).
 */
export async function groupeDevoirPour(seanceId: number, u: Pick<Utilisateur, "id" | "role">): Promise<GroupeDevoirDto | null> {
  if (u.role !== "etudiant") return null;
  const dernier = await dernierDevoirDirect(seanceId);
  if (!dernier || !dernier.dd.enGroupe) return null;
  const g = await groupeDuDevoir(dernier.d, u.id);
  if (!g) return null;
  return {
    devoirId: dernier.d.id,
    groupeId: g.groupeId,
    nom: g.nom,
    membres: g.membres.filter((m) => m.id !== u.id).map(prenomInitiale),
    copie: g.actuelle ? { parNom: g.actuelle.parNom, parMoi: g.actuelle.parId === u.id, renduLe: g.actuelle.renduLe.toISOString() } : null,
  };
}

// ── Compteur public, regroupé ──────────────────────────────────────────────

const compteursEnAttente = new Map<number, NodeJS.Timeout>();

/**
 * Une copie vient d'être rendue : si le devoir est un devoir en direct, le compteur public part sur le canal de la
 * séance, une fois par devoir toutes les 500 ms au plus (une réponse de groupe ou 300 réponses en deux minutes ne
 * font pas une rafale). Rien de nominatif : trois nombres. Les étudiants ne relisent rien sur ce compteur.
 */
export function signalerRenduDirect(devoirId: number, delaiMs = 500) {
  if (compteursEnAttente.has(devoirId)) return;
  compteursEnAttente.set(
    devoirId,
    setTimeout(() => {
      compteursEnAttente.delete(devoirId);
      void (async () => {
        const dd = await devoirDirectDe(devoirId);
        if (!dd) return;
        const c = await compteurs(devoirId);
        const dto: CompteurDevoirDirectDto = { devoirId, ...c };
        publier(canalSeance(dd.seanceId), "devoir-direct:compteur", dto);
      })().catch((e) => console.error("[devoir-direct] compteur :", (e as Error).message));
    }, delaiMs),
  );
}

// ── File en mémoire par groupe ─────────────────────────────────────────────

export class DelaiGroupeDepasse extends Error {}
const filesGroupes = new Map<string, Promise<unknown>>();
const ATTENTE_FILE_GROUPE_MS = 35_000;

/**
 * Réponses d'un même groupe pour un même devoir : l'une après l'autre (le serveur n'a qu'une instance, comme
 * enSerie de projection-copies.ts). Seule l'attente est bornée (35 s) : une réponse qui n'a pas pu commencer est
 * refusée sans rien écrire (DelaiGroupeDepasse, « ta réponse n'est pas partie », et c'est vrai). Une réponse
 * commencée va jusqu'au bout, la suivante l'attend : la transaction est bornée par la base elle-même
 * (lock_timeout et statement_timeout dans enregistrerRendus), qui l'annule entièrement si elle dépasse.
 */
export function enSerieGroupe<T>(cle: string, travail: () => Promise<T>, attenteMaxMs = ATTENTE_FILE_GROUPE_MS): Promise<T> {
  const avant = filesGroupes.get(cle) ?? Promise.resolve();
  let abandonnee = false;
  let minuteur: NodeJS.Timeout | undefined;
  const execution = avant.then(() => {
    clearTimeout(minuteur);
    if (abandonnee) throw new DelaiGroupeDepasse("attente dépassée");
    return travail();
  });
  const attente = new Promise<never>((_ok, ko) => {
    minuteur = setTimeout(() => {
      abandonnee = true;
      ko(new DelaiGroupeDepasse("attente dépassée"));
    }, attenteMaxMs);
  });
  // La file avance à la fin réelle de cette tâche (ou de la précédente, si celle-ci n'a jamais commencé).
  const fin = execution.then(
    () => undefined,
    () => undefined,
  );
  filesGroupes.set(cle, fin);
  void fin.then(() => {
    if (filesGroupes.get(cle) === fin) filesGroupes.delete(cle);
  });
  return Promise.race([execution, attente]);
}

// ── Changer de groupe soi-même pendant un devoir en groupe ─────────────────

/**
 * Répartition « au choix des étudiants » : un étudiant change de groupe quand il veut. Pour qu'il ne puisse ni prendre
 * la réponse d'un autre groupe (« Avoir la copie de mon groupe »), ni la remplacer pour tous ses membres, ni répondre
 * pour deux groupes, il n'entre pas de lui-même dans un groupe qui a déjà rendu un devoir en direct de cette
 * répartition, ni dans un autre groupe quand il a déjà une copie rendue avec le sien. Le formateur, lui, place qui il
 * veut. Revenir en classe reste possible : il y répond seul, pour sa seule copie.
 */
export async function refusChangementGroupe(sessionId: number, cibleGroupeId: number, etudiantId: number): Promise<"groupe_rendu" | "rendu_ailleurs" | null> {
  const { rows } = await db.execute<{ cible: boolean; ailleurs: boolean }>(sql`
    WITH dd AS (
      SELECT x.devoir_id FROM campus.devoirs_direct x JOIN campus.devoirs d ON d.id = x.devoir_id
      WHERE x.session_groupes_id = ${sessionId} AND x.en_groupe AND d.publie
    )
    SELECT
      EXISTS (SELECT 1 FROM campus.rendus r WHERE r.devoir_id IN (SELECT devoir_id FROM dd) AND r.statut <> 'brouillon'
              AND r.pour_groupe->>'groupeId' = ${String(cibleGroupeId)}) AS cible,
      EXISTS (SELECT 1 FROM campus.rendus r WHERE r.devoir_id IN (SELECT devoir_id FROM dd) AND r.statut <> 'brouillon'
              AND r.etudiant_id = ${etudiantId} AND r.pour_groupe IS NOT NULL
              AND r.pour_groupe->>'groupeId' <> ${String(cibleGroupeId)}) AS ailleurs`);
  const l = rows[0];
  if (l?.cible) return "groupe_rendu";
  if (l?.ailleurs) return "rendu_ailleurs";
  return null;
}

// ── Groupes attendus (suivi du Studio) ─────────────────────────────────────

/**
 * Groupes de la répartition d'un devoir en groupe qui peuvent répondre : sans écran de salle, avec au moins un
 * étudiant (parmi « visibles » : le périmètre de la personne qui regarde). Ils restent après la fermeture des groupes
 * (finaliser ne pose que fermee_le) et ne se mêlent jamais à une répartition plus récente.
 */
export async function groupesQuiRepondent(sessionId: number, visibles: Set<number>): Promise<{ id: number; nom: string }[]> {
  const lignes = await db
    .select({ id: groupesTravail.id, nom: groupesTravail.nom, numero: groupesTravail.numero, membreId: membresGroupes.utilisateurId, role: utilisateurs.role, profil: utilisateurs.profil })
    .from(groupesTravail)
    .leftJoin(membresGroupes, eq(membresGroupes.groupeId, groupesTravail.id))
    .leftJoin(utilisateurs, eq(utilisateurs.id, membresGroupes.utilisateurId))
    .where(eq(groupesTravail.sessionId, sessionId))
    .orderBy(asc(groupesTravail.numero), asc(groupesTravail.id));
  const parGroupe = new Map<number, { nom: string; salle: boolean; etudiants: number }>();
  for (const l of lignes) {
    const g = parGroupe.get(l.id) ?? { nom: l.nom, salle: false, etudiants: 0 };
    if (l.role && estEcran({ role: l.role, profil: l.profil })) g.salle = true;
    if (l.role === "etudiant" && l.membreId !== null && visibles.has(l.membreId)) g.etudiants++;
    parGroupe.set(l.id, g);
  }
  return [...parGroupe.entries()].filter(([, g]) => !g.salle && g.etudiants > 0).map(([id, g]) => ({ id, nom: g.nom }));
}

/** Devoirs donnés en direct dans une séance (remise à venir d'un essai). */
export async function devoirsDirectDeLaSeance(seanceId: number): Promise<number[]> {
  return (await db.select({ id: devoirsDirect.devoirId }).from(devoirsDirect).where(eq(devoirsDirect.seanceId, seanceId))).map((l) => l.id);
}

/** Identifiants des devoirs en direct parmi une liste (pour ne pas interroger un par un). */
export async function parmiDevoirsDirect(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  return new Set((await db.select({ id: devoirsDirect.devoirId }).from(devoirsDirect).where(inArray(devoirsDirect.devoirId, ids))).map((l) => l.id));
}
