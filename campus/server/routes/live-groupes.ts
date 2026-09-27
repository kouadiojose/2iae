// Groupes de travail du live : les « salles séparées » de Zoom et de Meet,
// faites par le campus. Le formateur répartit la classe en petits groupes
// (au hasard, par campus, à la main, ou au choix des étudiants) ; chaque
// groupe a sa visio (salle Daily privée, jamais enregistrée), sa discussion
// et la consigne. Le formateur passe d'un groupe à l'autre, écrit à tous, et
// un minuteur ramène tout le monde en classe après un compte à rebours.
// Un étudiant émargé dans une salle de campus suit le groupe de sa salle.
import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, moi } from "../auth";
import { route, valider, idParam, introuvable, interdit, invalide, ErreurHttp } from "../http";
import { seanceVisible } from "../acces";
import { publier, utilisateursSur } from "../temps-reel";
import { planifier } from "../taches";
import * as visio from "../visio";
import {
  seances,
  utilisateurs,
  presences,
  sessionsGroupes,
  groupesTravail,
  membresGroupes,
  journal,
  type Seance,
  type Utilisateur,
  type Site,
  type RoleSeance,
  type ModeSuivi,
  type SessionGroupes,
  type GroupeTravail,
  type GroupesDto,
  type GroupeTravailDto,
  type MembreGroupeDto,
  type ParticipantGroupeDto,
  type TypeEvenementSeance,
  type AccesDaily,
} from "@shared/schema";

/** Outils du module live (chargement, rôles, sites), fournis à l'enregistrement. */
export type OutilsGroupes = {
  seanceAccessible: (u: Utilisateur, id: number) => Promise<Seance>;
  seanceAnimee: (u: Utilisateur, id: number) => Promise<Seance>;
  roleDans: (u: Utilisateur, s: Seance) => Promise<RoleSeance>;
  nomsSites: () => Promise<Map<number, Site>>;
  consigner: (seanceId: number, type: TypeEvenementSeance, donnees?: Record<string, unknown>) => Promise<void>;
  limiter: (cle: string, ms: number, message: string) => void;
};

/** Compte à rebours avant le retour en classe (fin du minuteur, ou « Fermer les groupes »). */
const COMPTE_A_REBOURS_S = 60;
/** Une salle de groupe vit au plus 4 h (le minuteur le plus long en fait 3). */
const VIE_SALLE_GROUPE_S = 4 * 3600;

const canal = (seanceId: number) => `seance:${seanceId}`;
const privilegie = (role: RoleSeance) => role === "formateur" || role === "equipe";

// ── Façon de suivre de chaque étudiant (battements de présence) ────────────

const modesSuivi = new Map<string, { mode: ModeSuivi; le: number }>();

/** Noté à chaque battement de présence : sert à montrer « visio », « son » ou « en salle » au formateur. */
export function noterModeSuivi(seanceId: number, utilisateurId: number, mode: ModeSuivi) {
  modesSuivi.set(`${seanceId}:${utilisateurId}`, { mode, le: Date.now() });
}

// ── Lecture ────────────────────────────────────────────────────────────────

async function sessionOuverte(seanceId: number): Promise<SessionGroupes | null> {
  const [x] = await db
    .select()
    .from(sessionsGroupes)
    .where(and(eq(sessionsGroupes.seanceId, seanceId), isNull(sessionsGroupes.fermeeLe)))
    .orderBy(desc(sessionsGroupes.id))
    .limit(1);
  return x ?? null;
}

async function groupeDeLaSession(sessionId: number, groupeId: number): Promise<GroupeTravail> {
  const [g] = await db.select().from(groupesTravail).where(and(eq(groupesTravail.id, groupeId), eq(groupesTravail.sessionId, sessionId)));
  if (!g) throw introuvable("Groupe");
  return g;
}

async function monGroupe(sessionId: number, utilisateurId: number): Promise<number | null> {
  const [m] = await db
    .select({ groupeId: membresGroupes.groupeId })
    .from(membresGroupes)
    .where(and(eq(membresGroupes.sessionId, sessionId), eq(membresGroupes.utilisateurId, utilisateurId)));
  return m?.groupeId ?? null;
}

/** Étudiants émargés dans la salle de conférence d'un site pour cette séance (ils suivent l'écran de leur salle). */
async function compagnonsDuSite(seanceId: number, siteId: number | null): Promise<number[]> {
  if (!siteId) return [];
  const lignes = await db
    .select({ id: presences.utilisateurId })
    .from(presences)
    .where(and(eq(presences.seanceId, seanceId), eq(presences.mode, "salle"), eq(presences.siteId, siteId)));
  return lignes.map((l) => l.id);
}

/** Place une personne dans un groupe (ou la ramène en classe si groupeId est null). */
async function placer(sessionId: number, utilisateurId: number, groupeId: number | null) {
  if (groupeId === null) {
    await db.delete(membresGroupes).where(and(eq(membresGroupes.sessionId, sessionId), eq(membresGroupes.utilisateurId, utilisateurId)));
    return;
  }
  await db
    .insert(membresGroupes)
    .values({ sessionId, groupeId, utilisateurId })
    .onConflictDoUpdate({ target: [membresGroupes.sessionId, membresGroupes.utilisateurId], set: { groupeId, ajouteLe: new Date() } });
}

/**
 * Une salle de campus change de groupe : les étudiants émargés dans cette salle la suivent
 * (sauf ceux que le formateur a placés ailleurs à la main).
 */
async function deplacerSalle(s: Seance, sessionId: number, salle: Pick<Utilisateur, "id" | "siteId">, ancien: number | null, nouveau: number | null) {
  const compagnons = await compagnonsDuSite(s.id, salle.siteId);
  if (!compagnons.length) return;
  const places = await db
    .select({ id: membresGroupes.utilisateurId, groupeId: membresGroupes.groupeId })
    .from(membresGroupes)
    .where(and(eq(membresGroupes.sessionId, sessionId), inArray(membresGroupes.utilisateurId, compagnons)));
  const parId = new Map(places.map((p) => [p.id, p.groupeId]));
  for (const id of compagnons) {
    const actuel = parId.get(id) ?? null;
    if (actuel === ancien || actuel === null) await placer(sessionId, id, nouveau);
  }
}

/** Étudiant arrivé en salle après l'ouverture des groupes : il rejoint le groupe de sa salle. */
async function rattacherCompagnon(u: Utilisateur, s: Seance, session: SessionGroupes) {
  if (u.role !== "etudiant" || (await monGroupe(session.id, u.id)) !== null) return;
  const [p] = await db.select({ mode: presences.mode, siteId: presences.siteId }).from(presences).where(and(eq(presences.seanceId, s.id), eq(presences.utilisateurId, u.id)));
  if (!p || p.mode !== "salle" || !p.siteId) return;
  const [salle] = await db
    .select({ groupeId: membresGroupes.groupeId })
    .from(membresGroupes)
    .innerJoin(utilisateurs, eq(utilisateurs.id, membresGroupes.utilisateurId))
    .where(and(eq(membresGroupes.sessionId, session.id), eq(utilisateurs.role, "salle"), eq(utilisateurs.siteId, p.siteId)))
    .limit(1);
  if (salle) await db.insert(membresGroupes).values({ sessionId: session.id, groupeId: salle.groupeId, utilisateurId: u.id }).onConflictDoNothing();
}

export function creerModuleGroupes(o: OutilsGroupes) {
  const nomSalle = (site: Site | undefined) => `${site?.salleConference ?? "Salle de conférence"}${site ? ` · ${site.nomCourt}` : ""}`;

  /**
   * État des groupes vu par cette personne. Le formateur et l'équipe voient tout ; un
   * participant voit les membres de son groupe seulement (des autres : le nombre). L'écran
   * d'une salle ne montre jamais le nom d'un étudiant.
   */
  async function etatGroupes(u: Utilisateur, s: Seance, role: RoleSeance): Promise<GroupesDto> {
    const visioDisponible = visio.dailyDisponible();
    const session = await sessionOuverte(s.id);
    if (!session) return { session: null, groupes: [], monGroupeId: null, visioDisponible };
    await rattacherCompagnon(u, s, session);
    const [groupes, membres, sitesParId] = await Promise.all([
      db.select().from(groupesTravail).where(eq(groupesTravail.sessionId, session.id)).orderBy(asc(groupesTravail.numero)),
      db
        .select({ groupeId: membresGroupes.groupeId, id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role, siteId: utilisateurs.siteId })
        .from(membresGroupes)
        .innerJoin(utilisateurs, eq(utilisateurs.id, membresGroupes.utilisateurId))
        .where(eq(membresGroupes.sessionId, session.id))
        .orderBy(asc(membresGroupes.ajouteLe), asc(utilisateurs.nom)),
      o.nomsSites(),
    ]);
    const monGroupeId = membres.find((m) => m.id === u.id)?.groupeId ?? null;
    const voitTout = privilegie(role);
    const versMembre = (m: (typeof membres)[number]): MembreGroupeDto => {
      const site = m.siteId ? sitesParId.get(m.siteId) : undefined;
      if (m.role === "salle") return { id: m.id, nom: nomSalle(site), role: "salle", siteId: m.siteId, site: site?.nomCourt ?? null };
      const nom = role === "salle" ? "Un étudiant" : voitTout ? `${m.prenom} ${m.nom}` : `${m.prenom} ${m.nom.charAt(0)}.`;
      return { id: m.id, nom, role: "etudiant", siteId: m.siteId, site: site?.nomCourt ?? null };
    };
    const liste: GroupeTravailDto[] = groupes.map((g) => {
      const siens = membres.filter((m) => m.groupeId === g.id);
      const visibles = voitTout || g.id === monGroupeId;
      return {
        id: g.id,
        numero: g.numero,
        nom: g.nom,
        membres: visibles ? siens.map(versMembre) : [],
        nbMembres: siens.length,
        aideDemandeeLe: visibles ? (g.aideDemandeeLe?.toISOString() ?? null) : null,
      };
    });
    return {
      session: {
        id: session.id,
        consigne: session.consigne,
        ouverteLe: session.creeLe.toISOString(),
        finPrevueLe: session.finPrevueLe?.toISOString() ?? null,
        fermetureLe: session.fermetureLe?.toISOString() ?? null,
        retourLibre: session.retourLibre,
        choixLibre: session.choixLibre,
        annonce: session.annonce,
        annonceLe: session.annonceLe?.toISOString() ?? null,
      },
      groupes: liste,
      monGroupeId,
      visioDisponible,
    };
  }

  /** Personnes présentes à répartir : étudiants et écrans de salle ouverts sur le direct. */
  async function participants(s: Seance): Promise<ParticipantGroupeDto[]> {
    const connectes = utilisateursSur(canal(s.id)).filter((x) => x.role === "etudiant" || x.role === "salle");
    if (!connectes.length) return [];
    const ids = connectes.map((x) => x.id);
    const [lignes, sitesParId] = await Promise.all([
      db.select({ id: presences.utilisateurId, mode: presences.mode, siteId: presences.siteId }).from(presences).where(and(eq(presences.seanceId, s.id), inArray(presences.utilisateurId, ids))),
      o.nomsSites(),
    ]);
    const presence = new Map(lignes.map((l) => [l.id, l]));
    const liste = connectes.map((x): ParticipantGroupeDto => {
      const p = presence.get(x.id);
      const siteId = x.role === "etudiant" && p?.mode === "salle" && p.siteId ? p.siteId : x.siteId;
      const site = siteId ? sitesParId.get(siteId) : undefined;
      if (x.role === "salle") return { id: x.id, nom: nomSalle(site), role: "salle", siteId, site: site?.nomCourt ?? null, mode: "salle" };
      const suivi = modesSuivi.get(`${s.id}:${x.id}`)?.mode;
      const mode = p?.mode === "salle" || suivi === "compagnon" ? "salle" : suivi === "video" ? "video" : suivi === "radio" ? "radio" : null;
      return { id: x.id, nom: `${x.prenom} ${x.nom}`, role: "etudiant", siteId, site: site?.nomCourt ?? null, mode };
    });
    const ordre = (id: number | null) => (id ? (sitesParId.get(id)?.ordre ?? 99) : 100);
    return liste.sort((a, b) => Number(b.role === "salle") - Number(a.role === "salle") || ordre(a.siteId) - ordre(b.siteId) || a.nom.localeCompare(b.nom, "fr"));
  }

  /** Retour de tous en classe : groupes fermés, salles Daily effacées. */
  async function finaliser(session: SessionGroupes) {
    const [fermee] = await db
      .update(sessionsGroupes)
      .set({ fermeeLe: new Date() })
      .where(and(eq(sessionsGroupes.id, session.id), isNull(sessionsGroupes.fermeeLe)))
      .returning();
    if (!fermee) return;
    const salles = await db.select({ salle: groupesTravail.salleVisio }).from(groupesTravail).where(eq(groupesTravail.sessionId, session.id));
    await o.consigner(session.seanceId, "groupes_fermes", { minutes: (Date.now() - session.creeLe.getTime()) / 60_000 }).catch(() => undefined);
    publier(canal(session.seanceId), "groupes", { action: "fermeture" });
    for (const { salle } of salles) if (salle) void visio.supprimerSalleDaily(salle);
  }

  /** Séance remise à venir (essai effacé) : ses groupes et leurs salles Daily disparaissent aussi. */
  async function effacerGroupes(seanceId: number) {
    const sessions = await db.select({ id: sessionsGroupes.id }).from(sessionsGroupes).where(eq(sessionsGroupes.seanceId, seanceId));
    if (!sessions.length) return;
    const ids = sessions.map((x) => x.id);
    const salles = await db.select({ salle: groupesTravail.salleVisio }).from(groupesTravail).where(inArray(groupesTravail.sessionId, ids));
    await db.delete(sessionsGroupes).where(inArray(sessionsGroupes.id, ids));
    for (const { salle } of salles) if (salle) void visio.supprimerSalleDaily(salle);
  }

  const signaler = (seanceId: number, action: string, donnees: Record<string, unknown> = {}) => publier(canal(seanceId), "groupes", { action, ...donnees });

  /** La personne peut-elle entrer dans les groupes de cette séance (étudiant ou salle qui la suit) ? */
  async function verifierParticipants(s: Seance, ids: number[]): Promise<Utilisateur[]> {
    if (!ids.length) return [];
    const personnes = await db.select().from(utilisateurs).where(inArray(utilisateurs.id, ids));
    if (personnes.length !== ids.length) throw invalide("Une des personnes n'existe plus.");
    for (const p of personnes) {
      if (!p.actif || (p.role !== "etudiant" && p.role !== "salle")) throw invalide("Seuls les étudiants et les salles se répartissent en groupes.");
    }
    const refus = await Promise.all(personnes.map((p) => seanceVisible(p, s.id).then(() => null, () => p)));
    const exclu = refus.find(Boolean);
    if (exclu) throw invalide(`${exclu.prenom} ${exclu.nom} ne suit pas ce cours.`);
    return personnes;
  }

  function enregistrer(app: Express) {
    // État des groupes (chacun avec ses droits).
    app.get(
      "/api/seances/:id/groupes",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAccessible(u, idParam(req));
        res.json(await etatGroupes(u, s, await o.roleDans(u, s)));
      }),
    );

    // Présents à répartir (formateur, équipe).
    app.get(
      "/api/seances/:id/participants",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAccessible(u, idParam(req));
        if (!privilegie(await o.roleDans(u, s))) throw interdit("Réservé au formateur et à l'équipe.");
        res.json(await participants(s));
      }),
    );

    // Ouvrir les groupes : répartition composée dans le Studio (au hasard, par campus, à la main ou au choix).
    app.post(
      "/api/seances/:id/groupes",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAnimee(u, idParam(req));
        if (s.statut !== "en_direct") throw new ErreurHttp(409, "Les groupes s'ouvrent pendant le direct.");
        const d = valider(
          z.object({
            groupes: z
              .array(z.object({ nom: z.string().trim().max(60).optional(), membres: z.array(z.number().int().positive()).max(300) }))
              .min(1, "Créez au moins un groupe.")
              .max(50, "50 groupes au plus."),
            consigne: z.string().trim().max(1000, "1000 caractères au plus").default(""),
            dureeMinutes: z.number().int().min(1).max(180).nullable().default(null),
            retourLibre: z.boolean().default(true),
            choixLibre: z.boolean().default(false),
          }),
          req.body,
        );
        const ids = d.groupes.flatMap((g) => g.membres);
        if (new Set(ids).size !== ids.length) throw invalide("Une personne ne peut être que dans un seul groupe.");
        if (!d.choixLibre && !ids.length) throw invalide("Placez au moins une personne dans un groupe (ou laissez les étudiants choisir).");
        const personnes = await verifierParticipants(s, ids);
        if (await sessionOuverte(s.id)) throw new ErreurHttp(409, "Des groupes sont déjà ouverts : fermez-les d'abord.");
        const maintenant = new Date();
        const session = await db.transaction(async (tx) => {
          const [session] = await tx
            .insert(sessionsGroupes)
            .values({
              seanceId: s.id,
              consigne: d.consigne,
              finPrevueLe: d.dureeMinutes ? new Date(maintenant.getTime() + d.dureeMinutes * 60_000) : null,
              retourLibre: d.retourLibre,
              choixLibre: d.choixLibre,
              creeParId: u.id,
              creeLe: maintenant,
            })
            .returning();
          const crees = await tx
            .insert(groupesTravail)
            .values(d.groupes.map((g, i) => ({ sessionId: session.id, numero: i + 1, nom: g.nom || `Groupe ${i + 1}` })))
            .returning();
          const lignes = d.groupes.flatMap((g, i) => g.membres.map((utilisateurId) => ({ sessionId: session.id, groupeId: crees[i].id, utilisateurId })));
          if (lignes.length) await tx.insert(membresGroupes).values(lignes);
          return session;
        });
        // Les étudiants émargés dans une salle suivent le groupe de leur salle.
        const groupeDe = new Map(d.groupes.flatMap((g, i) => g.membres.map((id) => [id, i] as const)));
        const crees = await db.select().from(groupesTravail).where(eq(groupesTravail.sessionId, session.id)).orderBy(asc(groupesTravail.numero));
        for (const p of personnes) if (p.role === "salle") await deplacerSalle(s, session.id, p, null, crees[groupeDe.get(p.id)!].id);
        await o.consigner(s.id, "groupes_ouverts", { groupes: d.groupes.length, personnes: ids.length, par: u.id });
        await db.insert(journal).values({ utilisateurId: u.id, action: "groupes_ouverts", details: { seanceId: s.id, groupes: d.groupes.length } });
        signaler(s.id, "ouverture");
        res.status(201).json(await etatGroupes(u, s, await o.roleDans(u, s)));
      }),
    );

    // Déplacer quelqu'un (ou le ramener en classe : groupeId null).
    app.put(
      "/api/seances/:id/groupes/membres",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAnimee(u, idParam(req));
        const d = valider(z.object({ utilisateurId: z.number().int().positive(), groupeId: z.number().int().positive().nullable() }), req.body);
        const session = await sessionOuverte(s.id);
        if (!session) throw new ErreurHttp(409, "Aucun groupe n'est ouvert.");
        if (d.groupeId !== null) await groupeDeLaSession(session.id, d.groupeId);
        const [personne] = await verifierParticipants(s, [d.utilisateurId]);
        const ancien = await monGroupe(session.id, personne.id);
        await placer(session.id, personne.id, d.groupeId);
        if (personne.role === "salle") await deplacerSalle(s, session.id, personne, ancien, d.groupeId);
        signaler(s.id, "membres");
        res.json(await etatGroupes(u, s, await o.roleDans(u, s)));
      }),
    );

    // Choisir son groupe (répartition « au choix des étudiants »).
    app.post(
      "/api/seances/:id/groupes/:gid/rejoindre",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAccessible(u, idParam(req));
        const role = await o.roleDans(u, s);
        if (role !== "etudiant" && role !== "salle") throw interdit("Le formateur passe d'un groupe à l'autre avec « Rejoindre en visite ».");
        const session = await sessionOuverte(s.id);
        if (!session || session.fermetureLe) throw new ErreurHttp(409, "Les groupes se ferment.");
        if (!session.choixLibre) throw interdit("Le formateur a composé les groupes lui-même.");
        const g = await groupeDeLaSession(session.id, idParam(req, "gid"));
        o.limiter(`groupe-choix:${u.id}`, 1500, "Doucement.");
        const ancien = await monGroupe(session.id, u.id);
        await placer(session.id, u.id, g.id);
        if (u.role === "salle") await deplacerSalle(s, session.id, u, ancien, g.id);
        signaler(s.id, "membres");
        res.json(await etatGroupes(u, s, role));
      }),
    );

    // Revenir en classe de soi-même (si le formateur l'a permis, ou en choix libre).
    app.post(
      "/api/seances/:id/groupes/quitter",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAccessible(u, idParam(req));
        const role = await o.roleDans(u, s);
        const session = await sessionOuverte(s.id);
        if (!session) return res.json(await etatGroupes(u, s, role));
        if (!session.retourLibre && !session.choixLibre) throw interdit("Le formateur ramènera tout le monde en classe.");
        const ancien = await monGroupe(session.id, u.id);
        await placer(session.id, u.id, null);
        if (u.role === "salle") await deplacerSalle(s, session.id, u, ancien, null);
        signaler(s.id, "membres");
        res.json(await etatGroupes(u, s, role));
      }),
    );

    // Message du formateur à tous les groupes (bandeau en haut de chaque groupe).
    app.post(
      "/api/seances/:id/groupes/annonce",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAnimee(u, idParam(req));
        const { texte } = valider(z.object({ texte: z.string().trim().min(1, "Écrivez le message.").max(300, "300 caractères au plus") }), req.body);
        const session = await sessionOuverte(s.id);
        if (!session) throw new ErreurHttp(409, "Aucun groupe n'est ouvert.");
        const le = new Date();
        await db.update(sessionsGroupes).set({ annonce: texte, annonceLe: le }).where(eq(sessionsGroupes.id, session.id));
        publier(canal(s.id), "groupes:annonce", { texte, le: le.toISOString() });
        res.json({ ok: true });
      }),
    );

    // Plus de temps (annule aussi un compte à rebours de retour en cours).
    app.post(
      "/api/seances/:id/groupes/prolonger",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAnimee(u, idParam(req));
        const { minutes } = valider(z.object({ minutes: z.number().int().min(1).max(60) }), req.body);
        const session = await sessionOuverte(s.id);
        if (!session) throw new ErreurHttp(409, "Aucun groupe n'est ouvert.");
        const base = Math.max(Date.now(), session.finPrevueLe?.getTime() ?? 0);
        await db
          .update(sessionsGroupes)
          .set({ finPrevueLe: new Date(base + minutes * 60_000), fermetureLe: null })
          .where(eq(sessionsGroupes.id, session.id));
        signaler(s.id, "minuteur");
        res.json(await etatGroupes(u, s, await o.roleDans(u, s)));
      }),
    );

    // Rappeler la classe : compte à rebours (60 s par défaut) ou tout de suite.
    app.post(
      "/api/seances/:id/groupes/fermer",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAnimee(u, idParam(req));
        const { delaiSecondes } = valider(z.object({ delaiSecondes: z.number().int().min(0).max(300).default(COMPTE_A_REBOURS_S) }), req.body);
        const session = await sessionOuverte(s.id);
        if (!session) return res.json(await etatGroupes(u, s, await o.roleDans(u, s)));
        if (delaiSecondes === 0) await finaliser(session);
        else {
          await db
            .update(sessionsGroupes)
            .set({ fermetureLe: new Date(Date.now() + delaiSecondes * 1000) })
            .where(eq(sessionsGroupes.id, session.id));
          signaler(s.id, "fermeture_annoncee");
        }
        res.json(await etatGroupes(u, s, await o.roleDans(u, s)));
      }),
    );

    // « Appeler le formateur » depuis un groupe.
    app.post(
      "/api/seances/:id/groupes/aide",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAccessible(u, idParam(req));
        const session = await sessionOuverte(s.id);
        const gid = session ? await monGroupe(session.id, u.id) : null;
        if (!session || !gid) throw new ErreurHttp(409, "Tu n'es dans aucun groupe.");
        o.limiter(`groupe-aide:${gid}`, 10_000, "Le formateur est déjà prévenu.");
        const [g] = await db.update(groupesTravail).set({ aideDemandeeLe: new Date() }).where(eq(groupesTravail.id, gid)).returning();
        signaler(s.id, "aide", { groupeId: g.id, nom: g.nom });
        res.json({ ok: true });
      }),
    );

    app.post(
      "/api/seances/:id/groupes/:gid/aide-traitee",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAccessible(u, idParam(req));
        if (!privilegie(await o.roleDans(u, s))) throw interdit("Réservé au formateur et à l'équipe.");
        const session = await sessionOuverte(s.id);
        if (!session) throw new ErreurHttp(409, "Aucun groupe n'est ouvert.");
        const g = await groupeDeLaSession(session.id, idParam(req, "gid"));
        await db.update(groupesTravail).set({ aideDemandeeLe: null }).where(eq(groupesTravail.id, g.id));
        signaler(s.id, "aide_traitee", { groupeId: g.id });
        res.json({ ok: true });
      }),
    );

    // Accès à la visio d'un groupe : ses membres, le formateur et l'équipe (en visite).
    app.post(
      "/api/seances/:id/groupes/:gid/visio",
      exigerConnexion,
      route(async (req, res) => {
        const u = moi(req);
        const s = await o.seanceAccessible(u, idParam(req));
        const role = await o.roleDans(u, s);
        const session = await sessionOuverte(s.id);
        if (!session) throw new ErreurHttp(409, "Les groupes sont fermés : retour en classe.");
        const g = await groupeDeLaSession(session.id, idParam(req, "gid"));
        if (!privilegie(role) && (await monGroupe(session.id, u.id)) !== g.id) throw interdit("Cette visio est celle d'un autre groupe.");
        if (!visio.dailyDisponible()) throw new ErreurHttp(503, "La visio des groupes n'est pas disponible : échangez dans la discussion du groupe.");
        const exp = Math.floor(session.creeLe.getTime() / 1000) + VIE_SALLE_GROUPE_S;
        const salle = await visio.obtenirSalleGroupeDaily(g.salleVisio ?? visio.nomSalleGroupe(s.id, g.id), exp);
        if (!g.salleVisio) await db.update(groupesTravail).set({ salleVisio: salle.nom }).where(and(eq(groupesTravail.id, g.id), isNull(groupesTravail.salleVisio)));
        const sitesParId = await o.nomsSites();
        const profil = privilegie(role) ? "formateur" : role === "salle" ? "salle" : "etudiant";
        const nomAffiche =
          role === "salle"
            ? nomSalle(u.siteId ? sitesParId.get(u.siteId) : undefined)
            : role === "etudiant"
              ? `${u.prenom} ${u.nom.charAt(0)}.`
              : `${u.prenom} ${u.nom}${role === "formateur" ? " · formateur" : ""}`;
        const jeton = await visio.jetonDaily({
          salle: salle.nom,
          nomAffiche,
          utilisateurId: u.id,
          profil,
          exp,
          enregistrementPermis: false,
          ...(profil === "etudiant" && { envoi: ["audio", "video"] as ("audio" | "video")[] }),
        });
        res.json({ url: salle.url, jeton, nomAffiche, profil } satisfies AccesDaily);
      }),
    );
  }

  // Minuteur : à la fin prévue, compte à rebours de 60 s ; à son terme, tout le monde revient.
  // Une séance terminée (ou remise à venir) ferme aussi ses groupes.
  planifier("live-groupes", 5_000, async () => {
    const ouvertes = await db
      .select({ session: sessionsGroupes, statut: seances.statut })
      .from(sessionsGroupes)
      .innerJoin(seances, eq(seances.id, sessionsGroupes.seanceId))
      .where(isNull(sessionsGroupes.fermeeLe));
    const maintenant = Date.now();
    for (const { session, statut } of ouvertes) {
      if (statut !== "en_direct" || (session.fermetureLe && session.fermetureLe.getTime() <= maintenant)) {
        await finaliser(session);
      } else if (!session.fermetureLe && session.finPrevueLe && session.finPrevueLe.getTime() <= maintenant) {
        await db
          .update(sessionsGroupes)
          .set({ fermetureLe: new Date(maintenant + COMPTE_A_REBOURS_S * 1000) })
          .where(and(eq(sessionsGroupes.id, session.id), isNull(sessionsGroupes.fermetureLe)));
        signaler(session.seanceId, "fermeture_annoncee");
      }
    }
    const limite = maintenant - 15 * 60_000;
    for (const [cle, v] of modesSuivi) if (v.le < limite) modesSuivi.delete(cle);
  });

  return { enregistrer, effacerGroupes };
}
