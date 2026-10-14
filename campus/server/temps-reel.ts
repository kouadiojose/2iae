// Temps réel par Server-Sent Events : une seule connexion par onglet,
// multiplexée en « canaux » (u:12, seance:4, conv:9…). SSE plutôt que
// WebSocket : traverse tous les proxys, se reconnecte tout seul, et tient
// sur une 4G capricieuse.
//
// Chaque connexion est abonnée d'office à ses canaux personnels (u:<id>,
// tous, role:<role>, site:<id>, classe:<id>). Les autres canaux s'ouvrent à
// la demande, après vérification par le « gardien » du préfixe, que chaque
// module enregistre (ex. le module live vérifie qu'on a accès à la séance).
//
// État en mémoire : prévu pour une seule instance (le réglage par défaut sur
// Railway). Pour plusieurs répliques, brancher publier() sur LISTEN/NOTIFY.
import type { Express, Response } from "express";
import crypto from "crypto";
import { exigerConnexion, moi, utilisateurParId } from "./auth";
import { pool } from "./db";
import { route, valider, interdit } from "./http";
import { z } from "zod";
import type { Utilisateur } from "@shared/schema";

type Connexion = {
  id: string;
  utilisateur: Utilisateur;
  /** Session qui a ouvert le flux : si elle est révoquée, le flux est fermé. */
  sessionId: string;
  ouverteLe: number;
  res: Response;
  canaux: Set<string>;
};

// Onglets et appareils ouverts avec un même compte : un écran de salle peut tourner sur plusieurs
// ordinateurs (lien permanent), un formateur a son Studio et sa fenêtre présentateur. Au-delà, la plus
// ancienne est prévenue (« remplace ») pour qu'elle ne se reconnecte pas en boucle en chassant les autres.
const MAX_CONNEXIONS_PAR_PERSONNE = 20;

type Gardien = (u: Utilisateur, cle: string) => Promise<boolean>;

const connexions = new Map<string, Connexion>();
const parCanal = new Map<string, Set<Connexion>>();
const gardiens = new Map<string, Gardien>();

function fermer(c: Connexion) {
  try {
    c.res.end();
  } catch {
    /* déjà fermée */
  }
}

/**
 * Révocation : toutes les 30 s, les flux dont la session a été supprimée
 * (« se déconnecter partout », nouveau code, changement de code) ou dont le
 * compte a été désactivé sont fermés. Sans cela, un onglet resté ouvert
 * continuerait de recevoir les messages privés.
 */
async function verifierSessions() {
  const liste = [...connexions.values()];
  if (!liste.length) return;
  const ids = [...new Set(liste.map((c) => c.sessionId))];
  const { rows } = await pool.query<{ sid: string }>("SELECT sid FROM campus.session WHERE sid = ANY($1) AND expire > now()", [ids]);
  const valides = new Set(rows.map((r) => r.sid));
  for (const c of liste) {
    if (!valides.has(c.sessionId)) {
      fermer(c);
      continue;
    }
    const u = await utilisateurParId(c.utilisateur.id);
    if (!u?.actif) fermer(c);
    // Compte relu (nom ou public de la salle d'un écran changés depuis l'ouverture du flux).
    else c.utilisateur = u;
  }
}
setInterval(() => void verifierSessions().catch((e) => console.error("[temps réel] vérification des sessions :", e.message)), 30_000).unref();

/** Ferme tout de suite les flux d'une personne (sauf celui de la session indiquée). */
export function fermerFluxUtilisateur(utilisateurId: number, saufSession?: string) {
  for (const c of connexions.values()) if (c.utilisateur.id === utilisateurId && c.sessionId !== saufSession) fermer(c);
}

/** Remplace le compte gardé par les flux ouverts d'une personne (réglage de la salle d'un écran : routes/salles.ts). */
export function actualiserCompteConnecte(u: Utilisateur) {
  for (const c of connexions.values()) if (c.utilisateur.id === u.id) c.utilisateur = u;
}

/** Un module déclare qui peut écouter les canaux « prefixe:cle ». */
export function enregistrerGardien(prefixe: string, gardien: Gardien) {
  gardiens.set(prefixe, gardien);
}

function abonner(c: Connexion, canal: string) {
  c.canaux.add(canal);
  let s = parCanal.get(canal);
  if (!s) parCanal.set(canal, (s = new Set()));
  s.add(c);
}

function desabonner(c: Connexion, canal: string) {
  c.canaux.delete(canal);
  const s = parCanal.get(canal);
  if (s) {
    s.delete(c);
    if (!s.size) parCanal.delete(canal);
  }
}

function ecrire(c: Connexion, message: string) {
  try {
    c.res.write(message);
  } catch {
    /* connexion déjà fermée : le nettoyage suit */
  }
}

/** Diffuse un événement à tous les abonnés d'un canal. */
export function publier(canal: string, type: string, data: unknown = null) {
  const s = parCanal.get(canal);
  if (!s?.size) return;
  const message = `data: ${JSON.stringify({ canal, type, data })}\n\n`;
  for (const c of s) ecrire(c, message);
}

export const publierUtilisateur = (utilisateurId: number, type: string, data: unknown = null) =>
  publier(`u:${utilisateurId}`, type, data);

/** Identifiants des personnes connectées à un canal en ce moment. */
export function connectesSur(canal: string): Set<number> {
  const ids = new Set<number>();
  for (const c of parCanal.get(canal) ?? []) ids.add(c.utilisateur.id);
  return ids;
}

/** Utilisateurs (distincts) connectés à un canal, avec leur compte. */
export function utilisateursSur(canal: string): Utilisateur[] {
  const vus = new Map<number, Utilisateur>();
  for (const c of parCanal.get(canal) ?? []) vus.set(c.utilisateur.id, c.utilisateur);
  return [...vus.values()];
}

/**
 * Postes vus par HTTP sur un canal, depuis moins de PRESENCE_HTTP_MS : la page dont le flux temps réel est retenu en
 * route (antivirus, proxy, réseau de la salle) relit la diapo toutes les 2 s (/diapo : cette relecture n'a lieu QUE
 * dans ce cas) sans jamais s'abonner au canal. Elle est pourtant dans la classe : la fermeture logique et la carte des
 * salles doivent la compter. Noté par routes/live.ts (GET /api/seances/:id/diapo), oublié après 2 min.
 */
const vusParHttp = new Map<string, Map<string, { t: number; utilisateur: Utilisateur }>>();
export const PRESENCE_HTTP_MS = 2 * 60_000;

/** La page de ce compte (cette session du navigateur) vient de relire l'état d'un canal par HTTP. */
export function noterPosteHttp(canal: string, utilisateur: Utilisateur, sessionId: string, maintenant = Date.now()) {
  let m = vusParHttp.get(canal);
  if (!m) vusParHttp.set(canal, (m = new Map()));
  m.set(`${utilisateur.id}|${sessionId}`, { t: maintenant, utilisateur });
}

/** Postes (compte|session) abonnés par le temps réel au canal d'une classe : leur flux marche. */
function postesAbonnesAUneClasse(): Set<string> {
  const cles = new Set<string>();
  for (const [canal, liste] of parCanal) if (canal.startsWith("seance:")) for (const c of liste) cles.add(`${c.utilisateur.id}|${c.sessionId}`);
  return cles;
}

/**
 * Postes vus par HTTP récemment sur ce canal (les anciens sont oubliés au passage), sauf ceux dont le flux temps réel
 * marche (abonnés au canal d'une classe) : leur présence se lit dans leurs abonnements. Ainsi un ordinateur qui passe
 * d'un cours à l'autre n'est pas compté deux minutes de plus dans le premier.
 */
function postesHttp(canal: string, maintenant = Date.now()): Map<string, Utilisateur> {
  const m = vusParHttp.get(canal);
  const out = new Map<string, Utilisateur>();
  if (!m) return out;
  const abonnes = postesAbonnesAUneClasse();
  for (const [cle, v] of m) {
    if (maintenant - v.t > PRESENCE_HTTP_MS || v.t > maintenant + PRESENCE_HTTP_MS) m.delete(cle);
    else if (!abonnes.has(cle)) out.set(cle, v.utilisateur);
  }
  if (!m.size) vusParHttp.delete(canal);
  return out;
}

/**
 * Postes présents sur un canal : une connexion par couple (compte, session du navigateur), par le flux temps réel ou,
 * flux retenu en route, vue par HTTP depuis moins de 2 minutes (postesHttp). Le formateur et sa fenêtre présentateur
 * (même session) comptent une fois ; deux ordinateurs du même compte de campus (deux sessions) comptent deux fois.
 * Sert à la fermeture logique (routes/live.ts : presentsDans) et aux écrans du campus (campusDirect, « ecrans »).
 */
export function postesSur(canal: string, filtre?: (u: Utilisateur) => boolean, maintenant = Date.now()): number {
  const vus = new Set<string>();
  for (const c of parCanal.get(canal) ?? []) if (!filtre || filtre(c.utilisateur)) vus.add(`${c.utilisateur.id}|${c.sessionId}`);
  for (const [cle, u] of postesHttp(canal, maintenant)) if (!filtre || filtre(u)) vus.add(cle);
  return vus.size;
}

/** Comptes présents sur un canal : flux temps réel, ou vus par HTTP depuis moins de 2 minutes (postesHttp). */
export function utilisateursPresentsSur(canal: string, maintenant = Date.now()): Utilisateur[] {
  const vus = new Map<number, Utilisateur>();
  for (const c of parCanal.get(canal) ?? []) vus.set(c.utilisateur.id, c.utilisateur);
  for (const u of postesHttp(canal, maintenant).values()) if (!vus.has(u.id)) vus.set(u.id, u);
  return [...vus.values()];
}

/** La personne a-t-elle au moins un onglet ouvert sur le campus ? */
export const estEnLigne = (utilisateurId: number) => (parCanal.get(`u:${utilisateurId}`)?.size ?? 0) > 0;

export function enregistrerTempsReel(app: Express) {
  app.get("/api/flux", exigerConnexion, (req, res) => {
    const u = moi(req);
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const c: Connexion = { id: crypto.randomUUID(), utilisateur: u, sessionId: req.sessionID, ouverteLe: Date.now(), res, canaux: new Set() };
    const miennes = [...connexions.values()].filter((x) => x.utilisateur.id === u.id).sort((a, b) => a.ouverteLe - b.ouverteLe);
    while (miennes.length >= MAX_CONNEXIONS_PAR_PERSONNE) {
      const ancienne = miennes.shift()!;
      ecrire(ancienne, `data: ${JSON.stringify({ canal: `u:${u.id}`, type: "remplace", data: null })}\n\n`);
      fermer(ancienne);
    }
    connexions.set(c.id, c);
    for (const canal of [`u:${u.id}`, "tous", `role:${u.role}`]) abonner(c, canal);
    if (u.siteId) abonner(c, `site:${u.siteId}`);
    if (u.classeId) abonner(c, `classe:${u.classeId}`);

    // Délai de reconnexion conseillé au navigateur, puis identifiant de connexion.
    ecrire(c, `retry: 4000\n\ndata: ${JSON.stringify({ canal: `u:${u.id}`, type: "connexion", data: { id: c.id } })}\n\n`);

    // Un vrai message (pas un commentaire) : le navigateur voit ainsi que le flux arrive en direct, et
    // bascule sur une relecture rapide s'il reste muet (antivirus ou réseau qui retient le flux).
    const battement = setInterval(() => ecrire(c, `data: ${JSON.stringify({ canal: `u:${u.id}`, type: "battement", data: null })}\n\n`), 15_000);
    req.on("close", () => {
      clearInterval(battement);
      for (const canal of [...c.canaux]) desabonner(c, canal);
      connexions.delete(c.id);
    });
  });

  const schemaAbonnement = z.object({ connexion: z.string().min(1), canal: z.string().regex(/^[a-z_]+:[\w-]+$/) });

  app.post(
    "/api/flux/abonner",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const { connexion, canal } = valider(schemaAbonnement, req.body);
      const c = connexions.get(connexion);
      if (!c || c.utilisateur.id !== u.id) return res.status(410).json({ message: "Connexion temps réel expirée." });
      const [prefixe, cle] = canal.split(":");
      const gardien = gardiens.get(prefixe);
      if (!gardien || !(await gardien(u, cle))) throw interdit("Canal non autorisé.");
      abonner(c, canal);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/flux/desabonner",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const { connexion, canal } = valider(schemaAbonnement, req.body);
      const c = connexions.get(connexion);
      if (c && c.utilisateur.id === u.id) desabonner(c, canal);
      res.json({ ok: true });
    }),
  );
}
