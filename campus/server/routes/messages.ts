// Messagerie « comme WhatsApp » (CONCEPTION §6 « Messages » et §9.11).
//
// Conversations directes : étudiant ↔ formateurs de SES cours et ↔ vie
// scolaire de SON site ; formateur ↔ étudiants de ses cours et équipe ;
// équipe ↔ tout le monde dans son périmètre. Jamais entre deux étudiants.
// Salon « Questions du cours » (conversation de type « cours ») : tous les
// inscrits et les formateurs du cours ; le formateur (et l'équipe) modère :
// retirer un message, recevoir les signalements.
//
// Temps réel : canal conv:<id> (gardien plus bas), ouvert par le fil tant que
// l'écran est visible. L'autre personne d'une conversation directe reçoit
// aussi un signal sur son canal personnel (compteurs) et UNE notification
// par conversation tant qu'elle n'a pas lu (pas de rafale dans la cloche).
//
// Hors ligne : chaque envoi porte une clé choisie par le téléphone ; un
// renvoi de la file d'envoi rend le message déjà créé au lieu d'un doublon.
import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerRole, moi, perimetreSites } from "../auth";
import { route, valider, idParam, introuvable, interdit, invalide, ErreurHttp } from "../http";
import { coursVisible, etudiantsDuCours, formateursDuCours } from "../acces";
import { publier, publierUtilisateur, connectesSur, enregistrerGardien } from "../temps-reel";
import { enregistrerGardienFichier, urlFichier } from "../fichiers";
import { notifier, type NouvelleNotification } from "../notifications";
import {
  ROLES_MESSAGERIE,
  accesConversation,
  assurerParticipant,
  cleDirecte,
  cleSalon,
  conditionNonLu,
  coursPourSalons,
  lienConversation,
  perimetreConversations,
  peuventSEcrire,
  peutLireConversation,
  vieScolaireCouvre,
} from "../messages-outils";
import {
  conversations,
  participants,
  messages,
  fichiers,
  utilisateurs,
  sites,
  classes,
  cours,
  coursClasses,
  coursFormateurs,
  notifications,
  journal,
  signalementsMessages,
  LIBELLES_ROLES,
  type Conversation,
  type Utilisateur,
  type ContactMessages,
  type ConversationDetail,
  type ConversationOuverte,
  type ConversationResume,
  type ContactsMessages,
  type CoursSalon,
  type GroupeContacts,
  type MessageDto,
  type PageMessages,
  type TypeContenuMessage,
} from "@shared/schema";

const PAR_PAGE = 30;
/** L'auteur peut supprimer son message pendant 10 minutes. */
const DELAI_SUPPRESSION_MS = 10 * 60_000;
/** Au-delà, l'interface demande de taper un nom (listes de contacts de centaines d'étudiants). */
const MAX_PAR_GROUPE = 80;

const autorise = exigerRole(...ROLES_MESSAGERIE);

/** Tutoiement pour les étudiants, vouvoiement pour les formateurs et l'équipe. */
const selon = (u: Pick<Utilisateur, "role">, tu: string, vous: string) => (u.role === "etudiant" ? tu : vous);

// ── Petits outils ──────────────────────────────────────────────────────────

/** Noms courts des sites (cinq lignes, qui ne changent presque jamais). */
let cacheSites: { carte: Map<number, string>; exp: number } | null = null;
async function nomsSites(): Promise<Map<number, string>> {
  if (cacheSites && cacheSites.exp > Date.now()) return cacheSites.carte;
  const lignes = await db.select({ id: sites.id, nomCourt: sites.nomCourt }).from(sites);
  cacheSites = { carte: new Map(lignes.map((s) => [s.id, s.nomCourt])), exp: Date.now() + 5 * 60_000 };
  return cacheSites.carte;
}

function typeContenu(mime: string | null | undefined): TypeContenuMessage {
  if (!mime) return "texte";
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("audio/")) return "audio";
  return "fichier";
}

const deuxChiffres = (n: number) => String(n).padStart(2, "0");
const dureeCourte = (s: number) => `${Math.floor(s / 60)}:${deuxChiffres(Math.floor(s % 60))}`;

/** Aperçu d'une ligne : début du texte, ou « Photo », « Note vocale · 0:42 », nom du fichier. */
function extrait(texte: string, type: TypeContenuMessage, dureeSecondes: number | null, nomFichier?: string | null, longueur = 90): string {
  const t = texte.replace(/\s+/g, " ").trim();
  if (t) return t.length > longueur ? `${t.slice(0, longueur - 1)}…` : t;
  if (type === "photo") return "Photo";
  if (type === "audio") return dureeSecondes ? `Note vocale · ${dureeCourte(dureeSecondes)}` : "Note vocale";
  if (type === "fichier") return nomFichier || "Fichier";
  return "";
}

/** « Formateur · Lyon, France », « Vie scolaire · Yopougon », « Yopougon · 24GC0001 ». */
function detailPersonne(
  p: Pick<Utilisateur, "role" | "siteId" | "localisation" | "matricule">,
  carteSites: Map<number, string>,
  complement?: string,
): string {
  const site = p.siteId ? carteSites.get(p.siteId) ?? null : null;
  switch (p.role) {
    case "formateur":
      return [LIBELLES_ROLES.formateur, complement ?? p.localisation].filter(Boolean).join(" · ");
    case "vie_scolaire":
      return `${LIBELLES_ROLES.vie_scolaire} · ${site ?? "tous les campus"}`;
    case "admin":
      return "Direction des études";
    case "etudiant":
      return [site, complement ?? p.matricule].filter(Boolean).join(" · ") || LIBELLES_ROLES.etudiant;
    default:
      return LIBELLES_ROLES[p.role];
  }
}

function versContact(
  p: Pick<Utilisateur, "id" | "prenom" | "nom" | "role" | "photoUrl" | "siteId" | "localisation" | "matricule">,
  carteSites: Map<number, string>,
  complement?: string,
): ContactMessages {
  return { id: p.id, prenom: p.prenom, nom: p.nom, role: p.role, photoUrl: p.photoUrl, detail: detailPersonne(p, carteSites, complement) };
}

/** Recherche sans accents ni majuscules (« kone » trouve « Koné »). */
const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function correspond(p: { prenom: string; nom: string; matricule?: string | null }, q: string): boolean {
  if (!q) return true;
  const cible = normaliser(`${p.prenom} ${p.nom} ${p.nom} ${p.prenom} ${p.matricule ?? ""}`);
  return normaliser(q)
    .split(/\s+/)
    .every((mot) => cible.includes(mot));
}

/** Anti-rafale : 20 messages par minute et par personne. */
const envoisRecents = new Map<number, number[]>();
function verifierCadence(utilisateurId: number) {
  const maintenant = Date.now();
  const liste = (envoisRecents.get(utilisateurId) ?? []).filter((t) => maintenant - t < 60_000);
  if (liste.length >= 20) throw new ErreurHttp(429, "Beaucoup de messages d'un coup : attendez une minute avant d'en envoyer d'autres.");
  liste.push(maintenant);
  envoisRecents.set(utilisateurId, liste);
}
setInterval(() => {
  const maintenant = Date.now();
  for (const [id, liste] of envoisRecents) if (!liste.some((t) => maintenant - t < 60_000)) envoisRecents.delete(id);
}, 5 * 60_000).unref();

/**
 * Notifie chaque personne au plus une fois par conversation tant qu'elle n'a
 * pas lu : la cloche garde une ligne « Message de Karim Diallo », pas vingt.
 */
async function notifierUneFois(ids: number[], n: NouvelleNotification & { lien: string }) {
  const cibles = [...new Set(ids)].filter(Boolean);
  if (!cibles.length) return;
  const deja = await db
    .select({ id: notifications.utilisateurId })
    .from(notifications)
    .where(
      and(
        inArray(notifications.utilisateurId, cibles),
        eq(notifications.type, "message"),
        eq(notifications.lien, n.lien),
        isNull(notifications.luLe),
      ),
    );
  const exclus = new Set(deja.map((d) => d.id));
  await notifier(
    cibles.filter((id) => !exclus.has(id)),
    n,
  );
}

/** Personnes muettes (sourdine) dans cette conversation. */
async function enSourdine(conversationId: number, ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const lignes = await db
    .select({ id: participants.utilisateurId })
    .from(participants)
    .where(and(eq(participants.conversationId, conversationId), inArray(participants.utilisateurId, ids), eq(participants.sourdine, true)));
  return new Set(lignes.map((l) => l.id));
}

// ── Messages → DTO ─────────────────────────────────────────────────────────

const colonnesAuteur = {
  id: utilisateurs.id,
  prenom: utilisateurs.prenom,
  nom: utilisateurs.nom,
  role: utilisateurs.role,
  photoUrl: utilisateurs.photoUrl,
  siteId: utilisateurs.siteId,
};

/**
 * Transforme des messages (lus en base) en DTO : auteur, pièce jointe,
 * citation, signalements. Un message supprimé ne transporte plus rien.
 */
async function versMessages(u: Utilisateur, conditions: ReturnType<typeof and>, options: { moderateur: boolean; limite?: number }): Promise<MessageDto[]> {
  const requete = db
    .select({ m: messages, a: colonnesAuteur, f: { id: fichiers.id, nom: fichiers.nomOriginal, mime: fichiers.mime, taille: fichiers.taille } })
    .from(messages)
    .innerJoin(utilisateurs, eq(utilisateurs.id, messages.auteurId))
    .leftJoin(fichiers, eq(fichiers.id, messages.fichierId))
    .where(conditions)
    .orderBy(desc(messages.id));
  const lignes = options.limite ? await requete.limit(options.limite) : await requete;
  if (!lignes.length) return [];
  const carteSites = await nomsSites();
  const ids = lignes.map((l) => l.m.id);

  // Citations (« réponse à… »)
  const idsCites = [...new Set(lignes.map((l) => l.m.reponseAId).filter((x): x is number => Boolean(x)))];
  const cites = idsCites.length
    ? await db
        .select({ m: messages, prenom: utilisateurs.prenom, nom: utilisateurs.nom, mime: fichiers.mime, nomFichier: fichiers.nomOriginal })
        .from(messages)
        .innerJoin(utilisateurs, eq(utilisateurs.id, messages.auteurId))
        .leftJoin(fichiers, eq(fichiers.id, messages.fichierId))
        .where(inArray(messages.id, idsCites))
    : [];
  const citation = new Map(cites.map((c) => [c.m.id, c]));

  // Signalements : les miens (tout le monde) et le total (modérateurs seulement).
  const mesSignalements = new Set(
    (
      await db
        .select({ id: signalementsMessages.messageId })
        .from(signalementsMessages)
        .where(and(inArray(signalementsMessages.messageId, ids), eq(signalementsMessages.auteurId, u.id)))
    ).map((s) => s.id),
  );
  const totaux = options.moderateur
    ? new Map(
        (
          await db
            .select({ id: signalementsMessages.messageId, n: sql<number>`count(*)::int` })
            .from(signalementsMessages)
            .where(inArray(signalementsMessages.messageId, ids))
            .groupBy(signalementsMessages.messageId)
        ).map((s) => [s.id, s.n]),
      )
    : new Map<number, number>();

  return lignes.map(({ m, a, f }) => {
    const type = m.supprime ? "texte" : typeContenu(f?.mime);
    const c = m.reponseAId ? citation.get(m.reponseAId) : undefined;
    const typeCite = c ? typeContenu(c.mime) : "texte";
    return {
      id: m.id,
      conversationId: m.conversationId,
      cle: m.auteurId === u.id ? m.cleEnvoi : null,
      auteur: { id: a.id, prenom: a.prenom, nom: a.nom, role: a.role, photoUrl: a.photoUrl, site: a.siteId ? carteSites.get(a.siteId) ?? null : null },
      texte: m.supprime ? "" : m.texte,
      contexte: m.supprime ? null : m.contexte,
      type,
      fichier: !m.supprime && f ? { id: f.id, nom: f.nom, mime: f.mime, taille: f.taille, url: urlFichier(f.id) } : null,
      dureeSecondes: m.supprime ? null : m.dureeSecondes,
      reponseA:
        c && !m.supprime
          ? {
              id: c.m.id,
              auteurId: c.m.auteurId,
              auteur: `${c.prenom} ${c.nom}`,
              type: c.m.supprime ? "texte" : typeCite,
              extrait: c.m.supprime ? "" : extrait(c.m.texte, typeCite, c.m.dureeSecondes, c.nomFichier, 120),
              supprime: c.m.supprime,
            }
          : null,
      supprime: m.supprime,
      retireParModeration: m.supprime && m.supprimeParId !== null && m.supprimeParId !== m.auteurId,
      creeLe: m.creeLe.toISOString(),
      signaleParMoi: mesSignalements.has(m.id),
      signalements: totaux.get(m.id) ?? 0,
    };
  });
}

async function messageDto(u: Utilisateur, id: number, moderateur = false): Promise<MessageDto> {
  const [m] = await versMessages(u, and(eq(messages.id, id)), { moderateur });
  if (!m) throw introuvable("Message");
  return m;
}

/**
 * Version diffusée à tout le canal : rien de personnel. La clé d'envoi (un
 * identifiant aléatoire) reste : le téléphone de l'auteur remplace ainsi sa
 * bulle « en attente » dès que le message revient par le temps réel.
 */
const pourDiffusion = (m: MessageDto, cle: string | null): MessageDto => ({ ...m, cle, signaleParMoi: false, signalements: 0 });

// ── Conversations → résumés ────────────────────────────────────────────────

type LigneConversation = {
  c: Conversation;
  luJusquA: Date | null;
  sourdine: boolean | null;
};

/** Construit les lignes de la liste (dernier message, non lus, interlocuteur, cours). */
async function resumer(u: Utilisateur, lignes: LigneConversation[]): Promise<ConversationResume[]> {
  if (!lignes.length) return [];
  const ids = lignes.map((l) => l.c.id);
  const carteSites = await nomsSites();

  const derniers = await db
    .selectDistinctOn([messages.conversationId], {
      m: messages,
      prenom: utilisateurs.prenom,
      mime: fichiers.mime,
      nomFichier: fichiers.nomOriginal,
    })
    .from(messages)
    .innerJoin(utilisateurs, eq(utilisateurs.id, messages.auteurId))
    .leftJoin(fichiers, eq(fichiers.id, messages.fichierId))
    .where(inArray(messages.conversationId, ids))
    .orderBy(messages.conversationId, desc(messages.id));
  const dernierDe = new Map(derniers.map((d) => [d.m.conversationId, d]));

  const nonLus = await db
    .select({ id: messages.conversationId, n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .leftJoin(participants, and(eq(participants.conversationId, messages.conversationId), eq(participants.utilisateurId, u.id)))
    .where(and(inArray(messages.conversationId, ids), conditionNonLu(u.id)))
    .groupBy(messages.conversationId);
  const nonLusDe = new Map(nonLus.map((n) => [n.id, n.n]));

  // Interlocuteurs des conversations directes (et leur curseur, pour les ✓✓).
  const idsDirectes = lignes.filter((l) => l.c.type === "direct").map((l) => l.c.id);
  const autres = idsDirectes.length
    ? await db
        .select({ conversationId: participants.conversationId, luJusquA: participants.luJusquA, u: utilisateurs })
        .from(participants)
        .innerJoin(utilisateurs, eq(utilisateurs.id, participants.utilisateurId))
        .where(and(inArray(participants.conversationId, idsDirectes), ne(participants.utilisateurId, u.id)))
    : [];
  const autreDe = new Map(autres.map((a) => [a.conversationId, a]));

  const idsCours = [...new Set(lignes.map((l) => l.c.coursId).filter((x): x is number => Boolean(x)))];
  const listeCours = idsCours.length
    ? await db.select({ id: cours.id, code: cours.code, titre: cours.titre, couleur: cours.couleur }).from(cours).where(inArray(cours.id, idsCours))
    : [];
  const coursDe = new Map(listeCours.map((c) => [c.id, c]));

  const resumes: ConversationResume[] = [];
  for (const { c, sourdine } of lignes) {
    const d = dernierDe.get(c.id);
    const autre = autreDe.get(c.id);
    const coursSalon = c.coursId ? coursDe.get(c.coursId) ?? null : null;
    if (c.type === "direct" && !autre) continue; // conversation orpheline (compte supprimé)
    if (c.type === "cours" && !coursSalon) continue;
    const typeDernier = d && !d.m.supprime ? typeContenu(d.mime) : "texte";
    resumes.push({
      id: c.id,
      type: c.type === "cours" ? "cours" : "direct",
      titre: autre ? `${autre.u.prenom} ${autre.u.nom}` : coursSalon!.titre,
      sousTitre: autre ? detailPersonne(autre.u, carteSites) : `${coursSalon!.code} · Questions du cours`,
      interlocuteur: autre ? versContact(autre.u, carteSites) : null,
      cours: coursSalon,
      dernierMessage: d
        ? {
            id: d.m.id,
            auteurId: d.m.auteurId,
            auteurPrenom: d.prenom,
            deMoi: d.m.auteurId === u.id,
            type: typeDernier,
            extrait: d.m.supprime ? "Message supprimé" : extrait(d.m.texte, typeDernier, d.m.dureeSecondes, d.nomFichier),
            supprime: d.m.supprime,
            creeLe: d.m.creeLe.toISOString(),
            // Les deux dates viennent de la base et sont tronquées de la même façon : la comparaison est juste.
            lu: c.type === "direct" && d.m.auteurId === u.id ? Boolean(autre?.luJusquA && autre.luJusquA >= d.m.creeLe) : null,
          }
        : null,
      nonLus: nonLusDe.get(c.id) ?? 0,
      sourdine: Boolean(sourdine),
      activiteLe: (d?.m.creeLe ?? c.creeLe).toISOString(),
    });
  }
  return resumes;
}

/** Les conversations de la personne, crée au passage les salons de ses cours. */
async function mesConversations(u: Utilisateur): Promise<ConversationResume[]> {
  const salons = await coursPourSalons(u);
  if (salons.length) {
    await db
      .insert(conversations)
      .values(salons.map((coursId) => ({ type: "cours" as const, coursId, cleUnique: cleSalon(coursId) })))
      .onConflictDoNothing({ target: conversations.cleUnique });
  }
  const lignes = await db
    .select({ c: conversations, luJusquA: participants.luJusquA, sourdine: participants.sourdine })
    .from(conversations)
    .leftJoin(participants, and(eq(participants.conversationId, conversations.id), eq(participants.utilisateurId, u.id)))
    .where(perimetreConversations(u, salons));
  const resumes = await resumer(u, lignes);
  return (
    resumes
      // Une conversation directe ouverte mais jamais utilisée n'encombre pas la liste.
      .filter((r) => r.type === "cours" || r.dernierMessage)
      .sort((a, b) => {
        // Les salons encore silencieux vont à la fin ; sinon, le plus récent d'abord.
        if (!a.dernierMessage !== !b.dernierMessage) return a.dernierMessage ? -1 : 1;
        return b.activiteLe.localeCompare(a.activiteLe);
      })
  );
}

async function ouvrirSalon(coursId: number): Promise<number> {
  await db.insert(conversations).values({ type: "cours", coursId, cleUnique: cleSalon(coursId) }).onConflictDoNothing({ target: conversations.cleUnique });
  const [c] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.cleUnique, cleSalon(coursId)));
  return c.id;
}

/** Autre personne d'une conversation directe. */
async function autreParticipant(conversationId: number, moiId: number) {
  const [a] = await db
    .select({ u: utilisateurs, sourdine: participants.sourdine })
    .from(participants)
    .innerJoin(utilisateurs, eq(utilisateurs.id, participants.utilisateurId))
    .where(and(eq(participants.conversationId, conversationId), ne(participants.utilisateurId, moiId)));
  return a ?? null;
}

// ── Contacts ───────────────────────────────────────────────────────────────

function groupe(cle: string, titre: string, personnes: ContactMessages[], q: string): GroupeContacts {
  const tries = personnes.sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"));
  return { cle, titre, personnes: tries.slice(0, q ? 200 : MAX_PAR_GROUPE), tronque: tries.length > (q ? 200 : MAX_PAR_GROUPE) };
}

async function coursSalons(ids: number[]): Promise<CoursSalon[]> {
  if (!ids.length) return [];
  return db.select({ id: cours.id, code: cours.code, titre: cours.titre, couleur: cours.couleur }).from(cours).where(inArray(cours.id, ids)).orderBy(asc(cours.code));
}

async function equipe(u: Utilisateur, q: string): Promise<Utilisateur[]> {
  const liste = await db
    .select()
    .from(utilisateurs)
    .where(and(inArray(utilisateurs.role, ["vie_scolaire", "admin"]), eq(utilisateurs.actif, true), ne(utilisateurs.id, u.id)));
  return liste.filter((p) => correspond(p, q));
}

async function contactsDe(u: Utilisateur, q: string): Promise<ContactsMessages> {
  const carteSites = await nomsSites();
  const groupes: GroupeContacts[] = [];

  if (u.role === "etudiant") {
    const ids = await coursPourSalons(u);
    // Formateurs de mes cours, avec les codes des cours qu'ils me donnent.
    const codes = new Map<number, string[]>();
    if (ids.length) {
      const principaux = await db.select({ id: cours.formateurId, code: cours.code }).from(cours).where(inArray(cours.id, ids));
      const co = await db
        .select({ id: coursFormateurs.formateurId, code: cours.code })
        .from(coursFormateurs)
        .innerJoin(cours, eq(cours.id, coursFormateurs.coursId))
        .where(inArray(coursFormateurs.coursId, ids));
      for (const l of [...principaux, ...co]) if (l.id) codes.set(l.id, [...new Set([...(codes.get(l.id) ?? []), l.code])]);
    }
    const formateurs = codes.size
      ? await db
          .select()
          .from(utilisateurs)
          .where(and(inArray(utilisateurs.id, [...codes.keys()]), eq(utilisateurs.actif, true)))
      : [];
    groupes.push(
      groupe(
        "formateurs",
        "Mes formateurs",
        formateurs.filter((p) => correspond(p, q)).map((p) => versContact(p, carteSites, codes.get(p.id)?.join(", "))),
        q,
      ),
    );
    const vs = await db
      .select()
      .from(utilisateurs)
      .where(
        and(
          eq(utilisateurs.role, "vie_scolaire"),
          eq(utilisateurs.actif, true),
          u.siteId ? or(eq(utilisateurs.siteId, u.siteId), isNull(utilisateurs.siteId)) : isNull(utilisateurs.siteId),
        ),
      );
    groupes.push(
      groupe(
        "vie-scolaire",
        u.siteId ? `Vie scolaire · ${carteSites.get(u.siteId) ?? "mon campus"}` : "Vie scolaire",
        vs.filter((p) => correspond(p, q)).map((p) => versContact(p, carteSites)),
        q,
      ),
    );
    return { groupes, salons: await coursSalons(ids) };
  }

  if (u.role === "formateur") {
    const ids = await coursPourSalons(u);
    const listeCours = await coursSalons(ids);
    const collegues = new Map<number, Utilisateur>();
    for (const c of listeCours) {
      const inscrits = (await etudiantsDuCours(c.id)).filter((p) => correspond(p, q));
      const classesVues = new Map<number, string>();
      if (inscrits.some((p) => p.classeId)) {
        const cl = await db
          .select({ id: classes.id, niveau: classes.niveau })
          .from(classes)
          .where(inArray(classes.id, [...new Set(inscrits.map((p) => p.classeId).filter((x): x is number => Boolean(x)))]));
        for (const x of cl) classesVues.set(x.id, x.niveau);
      }
      groupes.push(
        groupe(
          `cours-${c.id}`,
          `${c.code} · ${c.titre}`,
          inscrits.map((p) => versContact(p, carteSites)),
          q,
        ),
      );
      for (const f of await formateursDuCours(c.id)) if (f.id !== u.id && f.actif) collegues.set(f.id, f);
    }
    const coFormateurs = [...collegues.values()].filter((p) => correspond(p, q));
    if (coFormateurs.length) groupes.push(groupe("formateurs", "Formateurs de vos cours", coFormateurs.map((p) => versContact(p, carteSites)), q));
    groupes.push(groupe("equipe", "Vie scolaire et direction", (await equipe(u, q)).map((p) => versContact(p, carteSites)), q));
    return { groupes, salons: listeCours };
  }

  // Équipe : étudiants de son périmètre, formateurs, équipe.
  const perimetre = perimetreSites(u);
  const motif = q ? `%${q.trim().replace(/[%_]/g, "")}%` : null;
  const etudiants = await db
    .select()
    .from(utilisateurs)
    .where(
      and(
        eq(utilisateurs.role, "etudiant"),
        eq(utilisateurs.actif, true),
        perimetre ? inArray(utilisateurs.siteId, perimetre) : undefined,
        motif
          ? or(
              ilike(utilisateurs.prenom, motif),
              ilike(utilisateurs.nom, motif),
              ilike(utilisateurs.matricule, motif),
              sql`(${utilisateurs.prenom} || ' ' || ${utilisateurs.nom}) ilike ${motif}`,
            )
          : undefined,
      ),
    )
    .orderBy(asc(utilisateurs.nom), asc(utilisateurs.prenom))
    .limit(q ? 201 : MAX_PAR_GROUPE + 1);
  groupes.push(
    groupe(
      "etudiants",
      perimetre ? `Étudiants · ${perimetre.map((id) => carteSites.get(id)).filter(Boolean).join(", ")}` : "Étudiants",
      etudiants.map((p) => versContact(p, carteSites)),
      q,
    ),
  );
  const formateurs = (await db.select().from(utilisateurs).where(and(eq(utilisateurs.role, "formateur"), eq(utilisateurs.actif, true)))).filter((p) =>
    correspond(p, q),
  );
  groupes.push(groupe("formateurs", "Formateurs", formateurs.map((p) => versContact(p, carteSites)), q));
  groupes.push(groupe("equipe", "Vie scolaire et direction", (await equipe(u, q)).map((p) => versContact(p, carteSites)), q));
  return { groupes, salons: [] };
}

// ── Validation ─────────────────────────────────────────────────────────────

const schemaDirecte = z.object({
  destinataireId: z.number().int().positive(),
  contexte: z.string().trim().max(200).nullish(),
});

const schemaMessage = z.object({
  texte: z.string().max(4000, "ton message est trop long (4 000 caractères au plus)").default(""),
  fichierId: z.number().int().positive().nullish(),
  reponseAId: z.number().int().positive().nullish(),
  cle: z
    .string()
    .regex(/^[\w-]{8,80}$/, "identifiant d'envoi invalide")
    .nullish(),
  contexte: z.string().trim().max(200).nullish(),
  dureeSecondes: z.number().int().min(0).max(900).nullish(),
});

const schemaLu = z.object({ messageId: z.number().int().positive().nullish() });
const schemaSourdine = z.object({ sourdine: z.boolean() });
const schemaSignaler = z.object({ motif: z.string().trim().max(300).nullish() });

// ── Routes ─────────────────────────────────────────────────────────────────

export function enregistrerMessages(app: Express) {
  // Temps réel : seuls ceux qui ont accès à la conversation écoutent conv:<id>.
  enregistrerGardien("conv", async (u, cle) => {
    const id = Number(cle);
    return Number.isInteger(id) && id > 0 && (await peutLireConversation(u, id));
  });

  // Pièces jointes : lisibles par ceux qui voient un message (non supprimé) qui les porte.
  enregistrerGardienFichier("message", async (u, f) => {
    const porteurs = await db
      .select({ conversationId: messages.conversationId })
      .from(messages)
      .where(and(eq(messages.fichierId, f.id), eq(messages.supprime, false)));
    for (const p of porteurs) if (await peutLireConversation(u, p.conversationId)) return true;
    return false;
  });

  // Mes conversations (liste façon WhatsApp).
  app.get(
    "/api/conversations",
    autorise,
    route(async (req, res) => {
      res.json(await mesConversations(moi(req)));
    }),
  );

  // À qui je peux écrire, par groupes.
  app.get(
    "/api/conversations/contacts",
    autorise,
    route(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.slice(0, 60) : "";
      res.json(await contactsDe(moi(req), q));
    }),
  );

  // Ouvre (ou retrouve) la conversation directe avec quelqu'un.
  app.post(
    "/api/conversations/directe",
    autorise,
    route(async (req, res) => {
      const u = moi(req);
      const { destinataireId, contexte } = valider(schemaDirecte, req.body);
      if (destinataireId === u.id) throw invalide(selon(u, "Tu ne peux pas t'écrire à toi-même.", "Vous ne pouvez pas vous écrire à vous-même."));
      const [autre] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, destinataireId));
      if (!autre || !autre.actif) throw introuvable("Destinataire");
      if (!(await peuventSEcrire(u, autre))) {
        throw interdit(
          u.role === "etudiant" && autre.role === "etudiant"
            ? "Les messages privés entre étudiants ne sont pas possibles. Pose ta question dans le salon du cours."
            : u.role === "etudiant"
              ? "Tu peux écrire aux formateurs de tes cours et à la vie scolaire de ton campus."
              : "Vous ne pouvez pas écrire à cette personne depuis le campus.",
        );
      }
      const cle = cleDirecte(u.id, autre.id);
      await db.insert(conversations).values({ type: "direct", cleUnique: cle }).onConflictDoNothing({ target: conversations.cleUnique });
      const [c] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.cleUnique, cle));
      await db
        .insert(participants)
        .values([
          { conversationId: c.id, utilisateurId: u.id },
          { conversationId: c.id, utilisateurId: autre.id },
        ])
        .onConflictDoNothing();
      const reponse: ConversationOuverte = {
        id: c.id,
        lien: `${lienConversation(c.id)}${contexte ? `?contexte=${encodeURIComponent(contexte)}` : ""}`,
      };
      res.json(reponse);
    }),
  );

  // Salon « Questions du cours » : l'ouvre ou le crée (inscrits, formateurs, équipe).
  app.get(
    "/api/conversations/cours/:coursId",
    autorise,
    route(async (req, res) => {
      const u = moi(req);
      const coursId = idParam(req, "coursId");
      await coursVisible(u, coursId);
      const id = await ouvrirSalon(coursId);
      await assurerParticipant(id, u.id, true);
      const reponse: ConversationOuverte = { id, lien: lienConversation(id) };
      res.json(reponse);
    }),
  );

  // En-tête d'une conversation et droits de la personne connectée.
  app.get(
    "/api/conversations/:id",
    autorise,
    route(async (req, res) => {
      const u = moi(req);
      const acces = await accesConversation(u, idParam(req));
      const { conversation: c, participant: p } = acces;
      const [resume] = await resumer(u, [{ c, luJusquA: p?.luJusquA ?? null, sourdine: p?.sourdine ?? false }]);
      if (!resume) throw introuvable("Conversation");
      let luJusquAAutre: string | null = null;
      let peutEcrire = true;
      let nbCampus: number | null = null;
      if (c.type === "direct") {
        const autre = await autreParticipant(c.id, u.id);
        peutEcrire = Boolean(autre?.u.actif);
        const [curseur] = autre
          ? await db
              .select({ lu: participants.luJusquA })
              .from(participants)
              .where(and(eq(participants.conversationId, c.id), eq(participants.utilisateurId, autre.u.id)))
          : [];
        luJusquAAutre = curseur?.lu?.toISOString() ?? null;
      } else if (c.coursId) {
        const [r] = await db
          .select({ n: sql<number>`count(distinct ${classes.siteId})::int` })
          .from(coursClasses)
          .innerJoin(classes, eq(classes.id, coursClasses.classeId))
          .where(eq(coursClasses.coursId, c.coursId));
        nbCampus = r?.n ?? 0;
      }
      const detail: ConversationDetail = { ...resume, peutModerer: acces.moderateur, peutEcrire, luJusquAAutre, nbCampus };
      res.json(detail);
    }),
  );

  // Fil : 30 messages par page, du plus ancien au plus récent ; ?avant=<id> pour remonter.
  app.get(
    "/api/conversations/:id/messages",
    autorise,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const acces = await accesConversation(u, id);
      const avant = Number(req.query.avant);
      const conditions = and(eq(messages.conversationId, id), Number.isInteger(avant) && avant > 0 ? lt(messages.id, avant) : undefined);
      const lot = await versMessages(u, conditions, { moderateur: acces.moderateur, limite: PAR_PAGE + 1 });
      let luJusquAAutre: string | null = null;
      if (acces.conversation.type === "direct") {
        const [curseur] = await db
          .select({ lu: participants.luJusquA })
          .from(participants)
          .where(and(eq(participants.conversationId, id), ne(participants.utilisateurId, u.id)));
        luJusquAAutre = curseur?.lu?.toISOString() ?? null;
      }
      const page: PageMessages = {
        messages: lot.slice(0, PAR_PAGE).reverse(),
        plusAnciens: lot.length > PAR_PAGE,
        luJusquAAutre,
      };
      res.json(page);
    }),
  );

  // Envoyer un message (texte, photo, fichier, note vocale ; réponse citée ; contexte).
  app.post(
    "/api/conversations/:id/messages",
    autorise,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const corps = valider(schemaMessage, req.body);
      const acces = await accesConversation(u, id);
      const c = acces.conversation;

      // Renvoi de la file d'envoi : le message existe déjà, on le rend tel quel.
      if (corps.cle) {
        const [deja] = await db
          .select({ id: messages.id, conversationId: messages.conversationId })
          .from(messages)
          .where(and(eq(messages.auteurId, u.id), eq(messages.cleEnvoi, corps.cle)));
        if (deja) {
          if (deja.conversationId !== id) throw new ErreurHttp(409, "Cet envoi appartient à une autre conversation.");
          return res.status(200).json(await messageDto(u, deja.id, acces.moderateur));
        }
      }

      const autre = c.type === "direct" ? await autreParticipant(id, u.id) : null;
      if (c.type === "direct" && !autre?.u.actif) throw interdit("Ce compte n'est plus actif : le message ne peut pas partir.");

      const texte = corps.texte.trim();
      if (!texte && !corps.fichierId) throw invalide(selon(u, "Écris un message ou joins un fichier.", "Écrivez un message ou joignez un fichier."));
      verifierCadence(u.id);

      let mime: string | null = null;
      if (corps.fichierId) {
        const [f] = await db.select().from(fichiers).where(eq(fichiers.id, corps.fichierId));
        // Seul son propriétaire peut joindre un fichier : pas de pièce jointe « empruntée ».
        if (!f || f.proprietaireId !== u.id || f.usage !== "message") throw invalide(selon(u, "Pièce jointe introuvable. Ajoute-la de nouveau.", "Pièce jointe introuvable. Ajoutez-la de nouveau."));
        mime = f.mime;
      }
      if (corps.reponseAId) {
        const [cite] = await db.select({ c: messages.conversationId }).from(messages).where(eq(messages.id, corps.reponseAId));
        if (!cite || cite.c !== id) throw invalide("Le message cité n'est pas dans cette conversation.");
      }

      const [cree] = await db
        .insert(messages)
        .values({
          conversationId: id,
          auteurId: u.id,
          texte,
          fichierId: corps.fichierId ?? null,
          reponseAId: corps.reponseAId ?? null,
          contexte: corps.contexte || null,
          dureeSecondes: typeContenu(mime) === "audio" ? corps.dureeSecondes ?? null : null,
          cleEnvoi: corps.cle ?? null,
        })
        .onConflictDoNothing({ target: [messages.auteurId, messages.cleEnvoi] })
        .returning({ id: messages.id });
      if (!cree) {
        // Deux renvois simultanés : le premier a gagné.
        const [deja] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.auteurId, u.id), eq(messages.cleEnvoi, corps.cle!)));
        return res.status(200).json(await messageDto(u, deja.id, acces.moderateur));
      }

      const curseur = sql`(select ${messages.creeLe} from ${messages} where ${messages.id} = ${cree.id})`;
      await db.update(conversations).set({ dernierMessageLe: curseur }).where(eq(conversations.id, id));
      // Écrire, c'est avoir tout lu jusque-là.
      if (c.type === "cours") await assurerParticipant(id, u.id, true);
      await db
        .update(participants)
        .set({ luJusquA: sql`greatest(${participants.luJusquA}, ${curseur})` })
        .where(and(eq(participants.conversationId, id), eq(participants.utilisateurId, u.id)));

      const dto = await messageDto(u, cree.id, acces.moderateur);
      publier(`conv:${id}`, "message", pourDiffusion(dto, corps.cle ?? null));
      res.status(201).json(dto);

      // Prévenir, après la réponse : un incident ici ne doit pas faire échouer l'envoi.
      void prevenir(u, c, dto, autre).catch((e) => console.error("[messages] prévenir :", (e as Error).message));
    }),
  );

  // Marquer comme lu jusqu'à un message (ou jusqu'au dernier) → ✓✓ chez l'autre.
  app.post(
    "/api/conversations/:id/lu",
    autorise,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const { messageId } = valider(schemaLu, req.body);
      const { conversation: c } = await accesConversation(u, id);
      if (c.type === "cours") await assurerParticipant(id, u.id, true);
      const cible = messageId
        ? sql`(select ${messages.creeLe} from ${messages} where ${messages.id} = ${messageId} and ${messages.conversationId} = ${id})`
        : sql`(select max(${messages.creeLe}) from ${messages} where ${messages.conversationId} = ${id})`;
      // GREATEST ignore les NULL : le curseur n'avance que vers l'avant.
      const [maj] = await db
        .update(participants)
        .set({ luJusquA: sql`greatest(${participants.luJusquA}, ${cible})` })
        .where(and(eq(participants.conversationId, id), eq(participants.utilisateurId, u.id)))
        .returning({ luJusquA: participants.luJusquA });
      const luJusquA = maj?.luJusquA?.toISOString() ?? null;
      if (c.type === "direct" && luJusquA) publier(`conv:${id}`, "lu", { utilisateurId: u.id, luJusquA });

      // La notification « Message de… » de cette conversation est lue, elle aussi.
      const lues = await db
        .update(notifications)
        .set({ luLe: new Date() })
        .where(
          and(
            eq(notifications.utilisateurId, u.id),
            eq(notifications.type, "message"),
            eq(notifications.lien, lienConversation(id)),
            isNull(notifications.luLe),
          ),
        )
        .returning({ id: notifications.id });
      if (lues.length) publierUtilisateur(u.id, "notification", { lues: lues.length });
      // Les autres onglets de la personne remettent leurs compteurs à jour.
      publierUtilisateur(u.id, "message", { conversationId: id, lu: true });
      res.json({ ok: true, luJusquA });
    }),
  );

  // « En train d'écrire… » (conversations directes seulement).
  app.post(
    "/api/conversations/:id/saisie",
    autorise,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const { conversation: c } = await accesConversation(u, id);
      if (c.type === "direct") publier(`conv:${id}`, "saisie", { utilisateurId: u.id, prenom: u.prenom });
      res.json({ ok: true });
    }),
  );

  // Couper / réactiver les alertes d'une conversation (utile pour un salon animé).
  app.post(
    "/api/conversations/:id/sourdine",
    autorise,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const { sourdine } = valider(schemaSourdine, req.body);
      const { conversation: c } = await accesConversation(u, id);
      if (c.type === "cours") await assurerParticipant(id, u.id, true);
      await db
        .update(participants)
        .set({ sourdine })
        .where(and(eq(participants.conversationId, id), eq(participants.utilisateurId, u.id)));
      publierUtilisateur(u.id, "message", { conversationId: id });
      res.json({ ok: true, sourdine });
    }),
  );

  // Supprimer : l'auteur pendant 10 minutes ; le formateur du cours ou l'équipe pour modérer un salon.
  app.delete(
    "/api/messages/:id",
    autorise,
    route(async (req, res) => {
      const u = moi(req);
      const [m] = await db.select().from(messages).where(eq(messages.id, idParam(req)));
      if (!m) throw introuvable("Message");
      const acces = await accesConversation(u, m.conversationId);
      if (m.supprime) return res.json({ ok: true });
      const estAuteur = m.auteurId === u.id;
      const dansLeDelai = Date.now() - m.creeLe.getTime() <= DELAI_SUPPRESSION_MS;
      const moderation = acces.conversation.type === "cours" && acces.moderateur && !(estAuteur && dansLeDelai);
      if (!(estAuteur && dansLeDelai) && !moderation) {
        throw interdit(
          estAuteur
            ? "Un message ne peut plus être supprimé 10 minutes après l'envoi."
            : acces.conversation.type === "cours"
              ? "Seul le formateur du cours peut retirer ce message. Tu peux le signaler."
              : selon(u, "Tu ne peux supprimer que tes propres messages.", "Vous ne pouvez supprimer que vos propres messages."),
        );
      }
      await db
        .update(messages)
        .set({ supprime: true, supprimeLe: new Date(), supprimeParId: u.id })
        .where(eq(messages.id, m.id));
      // La cloche ne garde pas l'aperçu d'un message retiré.
      const apercu = extrait(m.texte, m.fichierId ? "fichier" : "texte", m.dureeSecondes);
      if (apercu) {
        await db
          .update(notifications)
          .set({ corps: "Ce message a été supprimé." })
          .where(
            and(
              eq(notifications.type, "message"),
              eq(notifications.lien, lienConversation(m.conversationId)),
              or(eq(notifications.corps, apercu), sql`${notifications.corps} like ${`% : ${apercu.replace(/[\\%_]/g, "\\$&")}`}`, sql`${notifications.corps} like ${`% · ${apercu.replace(/[\\%_]/g, "\\$&")}`}`),
            ),
          );
      }
      if (moderation && !estAuteur) {
        await db.insert(journal).values({
          utilisateurId: u.id,
          action: "message.retire",
          details: { messageId: m.id, conversationId: m.conversationId, auteurId: m.auteurId, extrait: m.texte.slice(0, 280) },
        });
      }
      publier(`conv:${m.conversationId}`, "supprime", { id: m.id, parModeration: !estAuteur });
      res.json({ ok: true });
    }),
  );

  // Signaler un message : journal + formateurs du cours (salon) et vie scolaire du campus.
  app.post(
    "/api/messages/:id/signaler",
    autorise,
    route(async (req, res) => {
      const u = moi(req);
      const { motif } = valider(schemaSignaler, req.body);
      const [m] = await db.select().from(messages).where(eq(messages.id, idParam(req)));
      if (!m) throw introuvable("Message");
      const acces = await accesConversation(u, m.conversationId);
      if (m.auteurId === u.id) throw invalide(selon(u, "Tu ne peux pas signaler ton propre message.", "Vous ne pouvez pas signaler votre propre message."));
      if (m.supprime) throw invalide("Ce message a déjà été retiré.");
      const [nouveau] = await db
        .insert(signalementsMessages)
        .values({ messageId: m.id, auteurId: u.id, motif: motif || null })
        .onConflictDoNothing()
        .returning({ id: signalementsMessages.id });
      if (!nouveau) return res.json({ ok: true, deja: true });

      await db.insert(journal).values({
        utilisateurId: u.id,
        action: "message.signale",
        details: { messageId: m.id, conversationId: m.conversationId, auteurId: m.auteurId, motif: motif || null, extrait: m.texte.slice(0, 280) },
      });

      // Qui prévenir : formateurs du cours (salon) et vie scolaire du campus de la personne qui signale.
      const c = acces.conversation;
      const destinataires = new Set<number>();
      if (c.type === "cours" && c.coursId) for (const f of await formateursDuCours(c.coursId)) destinataires.add(f.id);
      const vs = await db
        .select()
        .from(utilisateurs)
        .where(and(eq(utilisateurs.role, "vie_scolaire"), eq(utilisateurs.actif, true)));
      const vsConcernes = vs.filter((p) => (u.siteId ? vieScolaireCouvre(p, u) : !p.siteId));
      for (const p of vsConcernes) destinataires.add(p.id);
      if (!vsConcernes.length) {
        const admins = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true)));
        for (const a of admins) destinataires.add(a.id);
      }
      destinataires.delete(m.auteurId);
      destinataires.delete(u.id);

      const [coursSalon] = c.coursId ? await db.select({ code: cours.code }).from(cours).where(eq(cours.id, c.coursId)) : [];
      await notifier([...destinataires], {
        type: "message",
        titre: coursSalon ? `Message signalé dans le salon ${coursSalon.code}` : "Message signalé dans une conversation privée",
        corps: `${motif ? `Motif : ${motif}. ` : ""}« ${extrait(m.texte, m.fichierId ? "fichier" : "texte", null, null, 140)} »`,
        // Le salon s'ouvre pour ses modérateurs ; une conversation privée reste privée.
        lien: c.type === "cours" ? lienConversation(c.id) : undefined,
        push: true,
        sensible: true,
      });
      res.status(201).json({ ok: true });
    }),
  );
}

/**
 * Après un envoi : signaux temps réel pour les compteurs et notifications.
 *   - directe : l'autre personne (une notification par conversation non lue) ;
 *   - salon : question d'un étudiant → formateurs ; réponse citée d'un
 *     formateur → l'étudiant qui avait posé la question.
 * Personne n'est notifié s'il regarde déjà la conversation ou l'a mise en sourdine.
 */
async function prevenir(u: Utilisateur, c: Conversation, m: MessageDto, autre: { u: Utilisateur; sourdine: boolean } | null) {
  const lien = lienConversation(c.id);
  const regardent = connectesSur(`conv:${c.id}`);
  const apercu = m.type === "texte" ? extrait(m.texte, "texte", null) : extrait(m.texte, m.type, m.dureeSecondes, m.fichier?.nom);

  if (c.type === "direct" && autre) {
    publierUtilisateur(autre.u.id, "message", { conversationId: c.id });
    if (!regardent.has(autre.u.id) && !autre.sourdine) {
      await notifierUneFois([autre.u.id], {
        type: "message",
        titre: `Message de ${u.prenom} ${u.nom}`,
        corps: apercu,
        lien,
        push: true,
        // Écran verrouillé : pas d'aperçu du message (CONCEPTION, revue critique).
        sensible: true,
      });
    }
    return;
  }

  if (c.type !== "cours" || !c.coursId) return;
  const [formateurs, inscrits, [coursSalon]] = await Promise.all([
    formateursDuCours(c.coursId),
    etudiantsDuCours(c.coursId),
    db.select({ code: cours.code }).from(cours).where(eq(cours.id, c.coursId)),
  ]);
  // Compteurs : « message » pour les formateurs (pastille), « salon » pour les inscrits (liste).
  for (const f of formateurs) if (f.id !== u.id) publierUtilisateur(f.id, "message", { conversationId: c.id });
  for (const e of inscrits) if (e.id !== u.id) publierUtilisateur(e.id, "salon", { conversationId: c.id });

  if (u.role === "etudiant") {
    const cibles = formateurs.map((f) => f.id).filter((id) => id !== u.id && !regardent.has(id));
    const muets = await enSourdine(c.id, cibles);
    await notifierUneFois(
      cibles.filter((id) => !muets.has(id)),
      { type: "message", titre: `Nouvelle question · ${coursSalon?.code ?? "salon du cours"}`, corps: `${u.prenom} : ${apercu}`, lien, push: true, sensible: true },
    );
  } else if (m.reponseA) {
    const [cite] = await db
      .select({ auteurId: messages.auteurId, role: utilisateurs.role })
      .from(messages)
      .innerJoin(utilisateurs, eq(utilisateurs.id, messages.auteurId))
      .where(eq(messages.id, m.reponseA.id));
    if (cite && cite.role === "etudiant" && cite.auteurId !== u.id && !regardent.has(cite.auteurId)) {
      const muets = await enSourdine(c.id, [cite.auteurId]);
      if (!muets.has(cite.auteurId)) {
        await notifierUneFois([cite.auteurId], {
          type: "message",
          titre: `${u.prenom} ${u.nom} a répondu à ta question`,
          corps: `${coursSalon?.code ?? "Salon du cours"} · ${apercu}`,
          lien,
          push: true,
          sensible: true,
        });
      }
    }
  }
}
