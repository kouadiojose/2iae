// Outils du module messages, utilisés par ses routes et par d'autres modules
// (compteur de la coquille, accueil) :
//   - qui peut écrire à qui (CONCEPTION §9.11) ;
//   - accès à une conversation (directe : participants ; salon : inscrits) ;
//   - nombre de messages non lus.
//
// Curseur de lecture : participants.luJusquA vaut la date (côté base) du
// dernier message lu. Il est toujours écrit par une sous-requête SQL qui
// recopie messages.cree_le : aucune perte de précision (microsecondes) entre
// la base et JavaScript, donc « lu » veut dire exactement « lu ».
import { and, eq, inArray, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { estEquipe, perimetreSites } from "./auth";
import { ErreurHttp, introuvable } from "./http";
import { idsCoursAccessibles, peutVoirCours, enseigneCours } from "./acces";
import {
  conversations,
  participants,
  messages,
  cours,
  coursFormateurs,
  type Utilisateur,
  type Conversation,
  type Role,
} from "@shared/schema";

/** Rôles qui ont une messagerie (l'écran de salle n'en a pas). */
export const ROLES_MESSAGERIE = ["etudiant", "formateur", "vie_scolaire", "admin"] as const satisfies readonly Role[];

export const aMessagerie = (u: Pick<Utilisateur, "role">) => (ROLES_MESSAGERIE as readonly Role[]).includes(u.role);

/**
 * Dans un salon ouvert pour la première fois, seuls les messages des 7
 * derniers jours comptent comme non lus (un étudiant inscrit en cours d'année
 * ne découvre pas 200 messages « non lus »).
 */
export const FENETRE_NON_LUS_SALON_MS = 7 * 86_400_000;

export const cleDirecte = (a: number, b: number) => `direct:${Math.min(a, b)}-${Math.max(a, b)}`;
export const cleSalon = (coursId: number) => `cours:${coursId}`;
export const lienConversation = (id: number) => `/messages/${id}`;

// ── Qui peut écrire à qui ──────────────────────────────────────────────────

/**
 * Cours qui ont un salon « Questions du cours » pour cette personne : ses cours
 * publiés (étudiant : ceux de sa classe et ses inscriptions ; formateur :
 * ceux qu'il enseigne). L'équipe n'y figure pas d'office : elle voit les
 * salons qu'elle a ouverts.
 */
export async function coursPourSalons(u: Utilisateur): Promise<number[]> {
  if (estEquipe(u) || !aMessagerie(u)) return [];
  const ids = await idsCoursAccessibles(u);
  if (!ids.length) return [];
  const publies = await db
    .select({ id: cours.id })
    .from(cours)
    .where(and(inArray(cours.id, ids), eq(cours.statut, "publie")));
  return publies.map((c) => c.id);
}

/** Cours publiés enseignés par ce formateur (principal ou co-formateur). */
export async function coursPubliesDuFormateur(formateurId: number): Promise<number[]> {
  const lignes = await db
    .select({ id: cours.id })
    .from(cours)
    .where(
      and(
        eq(cours.statut, "publie"),
        or(
          eq(cours.formateurId, formateurId),
          inArray(cours.id, db.select({ id: coursFormateurs.coursId }).from(coursFormateurs).where(eq(coursFormateurs.formateurId, formateurId))),
        ),
      ),
    );
  return lignes.map((l) => l.id);
}

/** La vie scolaire couvre-t-elle cet étudiant (son site, ou tout le groupe) ? */
export function vieScolaireCouvre(vs: Pick<Utilisateur, "role" | "siteId">, etudiant: Pick<Utilisateur, "siteId">): boolean {
  const perimetre = perimetreSites(vs);
  return perimetre === null || (etudiant.siteId !== null && perimetre.includes(etudiant.siteId));
}

/**
 * Deux personnes peuvent-elles avoir une conversation directe ? La relation
 * est symétrique (qui peut écrire peut recevoir une réponse) :
 *   - jamais entre deux étudiants, jamais avec un écran de salle ;
 *   - étudiant ↔ formateur d'un de ses cours publiés ;
 *   - étudiant ↔ vie scolaire de son site (ou vie scolaire du groupe) ;
 *   - étudiant ↔ direction ;
 *   - formateurs ↔ équipe, équipe ↔ équipe ;
 *   - formateur ↔ formateur seulement s'ils enseignent un même cours.
 */
export async function peuventSEcrire(a: Utilisateur, b: Utilisateur): Promise<boolean> {
  if (a.id === b.id || !a.actif || !b.actif || !aMessagerie(a) || !aMessagerie(b)) return false;
  if (a.role === "etudiant" && b.role === "etudiant") return false;
  if (a.role === "etudiant" || b.role === "etudiant") {
    const etudiant = a.role === "etudiant" ? a : b;
    const autre = etudiant === a ? b : a;
    if (autre.role === "admin") return true;
    if (autre.role === "vie_scolaire") return vieScolaireCouvre(autre, etudiant);
    if (autre.role === "formateur") {
      const [suivis, enseignes] = await Promise.all([idsCoursAccessibles(etudiant), coursPubliesDuFormateur(autre.id)]);
      return enseignes.some((id) => suivis.includes(id));
    }
    return false;
  }
  if (estEquipe(a) || estEquipe(b)) return true;
  // Deux formateurs : co-enseignants d'un même cours.
  const [x, y] = await Promise.all([coursPubliesDuFormateur(a.id), coursPubliesDuFormateur(b.id)]);
  return x.some((id) => y.includes(id));
}

// ── Accès à une conversation ───────────────────────────────────────────────

export type AccesConversation = {
  conversation: Conversation;
  /** Ligne de participant de la personne (curseur, sourdine), s'il y en a une. */
  participant: typeof participants.$inferSelect | null;
  /** Salon : formateur du cours ou équipe (peut retirer n'importe quel message). */
  moderateur: boolean;
};

/**
 * Charge une conversation accessible à la personne, ou lève une erreur.
 * Conversation directe dont elle n'est pas participante : 404 (on ne révèle
 * même pas qu'elle existe). Salon d'un cours qu'elle ne suit pas : 403.
 */
export async function accesConversation(u: Utilisateur, conversationId: number): Promise<AccesConversation> {
  if (!aMessagerie(u)) throw new ErreurHttp(403, "La messagerie n'est pas disponible avec ce compte.");
  const [c] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!c || (c.type !== "direct" && c.type !== "cours")) throw introuvable("Conversation");
  const [p] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.conversationId, conversationId), eq(participants.utilisateurId, u.id)));
  if (c.type === "direct") {
    if (!p) throw introuvable("Conversation");
    return { conversation: c, participant: p, moderateur: false };
  }
  if (!c.coursId || !(await peutVoirCours(u, c.coursId))) {
    throw new ErreurHttp(403, u.role === "etudiant" ? "Ce salon est réservé aux inscrits du cours." : "Ce salon ne vous est pas accessible.");
  }
  return { conversation: c, participant: p ?? null, moderateur: await enseigneCours(u, c.coursId) };
}

export async function peutLireConversation(u: Utilisateur, conversationId: number): Promise<boolean> {
  try {
    await accesConversation(u, conversationId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Crée la ligne de participant si elle manque. Dans un salon, le curseur de
 * départ vaut « il y a 7 jours » (même règle que le compteur et l'accueil).
 */
export async function assurerParticipant(conversationId: number, utilisateurId: number, salon: boolean) {
  await db
    .insert(participants)
    .values({ conversationId, utilisateurId, luJusquA: salon ? new Date(Date.now() - FENETRE_NON_LUS_SALON_MS) : null })
    .onConflictDoNothing();
}

// ── Non lus ────────────────────────────────────────────────────────────────

/**
 * Conversations de la personne, pour une requête qui joint conversations et
 * (en jointure externe) sa ligne de participants : ses conversations directes,
 * les salons de ses cours (étudiant, formateur) ou les salons qu'elle a
 * ouverts (équipe).
 */
export function perimetreConversations(u: Utilisateur, coursSalons: number[]): SQL {
  const directes = and(eq(conversations.type, "direct"), isNotNull(participants.utilisateurId))!;
  const salons = estEquipe(u)
    ? and(eq(conversations.type, "cours"), isNotNull(participants.utilisateurId))!
    : coursSalons.length
      ? and(eq(conversations.type, "cours"), inArray(conversations.coursId, coursSalons))!
      : sql`false`;
  return or(directes, salons)!;
}

/** Message non lu par cette personne (même jointure que ci-dessus). */
export function conditionNonLu(utilisateurId: number): SQL {
  return and(
    ne(messages.auteurId, utilisateurId),
    eq(messages.supprime, false),
    sql`${messages.creeLe} > coalesce(${participants.luJusquA}, case when ${conversations.type} = 'cours' then now() - interval '7 days' else '-infinity'::timestamptz end)`,
  )!;
}

/** Nombre de messages non lus de la personne (conversations directes et questions de ses cours), hors sourdine. */
export async function compterMessagesNonLus(u: Utilisateur): Promise<number> {
  if (!aMessagerie(u)) return 0;
  const salons = await coursPourSalons(u);
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .leftJoin(participants, and(eq(participants.conversationId, conversations.id), eq(participants.utilisateurId, u.id)))
    .where(and(perimetreConversations(u, salons), sql`coalesce(${participants.sourdine}, false) = false`, conditionNonLu(u.id)));
  return r?.n ?? 0;
}
