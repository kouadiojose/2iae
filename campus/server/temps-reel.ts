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

/** Onglets ouverts en même temps par personne (au-delà, le plus ancien est fermé). */
const MAX_CONNEXIONS_PAR_PERSONNE = 6;

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
  }
}
setInterval(() => void verifierSessions().catch((e) => console.error("[temps réel] vérification des sessions :", e.message)), 30_000).unref();

/** Ferme tout de suite les flux d'une personne (sauf celui de la session indiquée). */
export function fermerFluxUtilisateur(utilisateurId: number, saufSession?: string) {
  for (const c of connexions.values()) if (c.utilisateur.id === utilisateurId && c.sessionId !== saufSession) fermer(c);
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
    while (miennes.length >= MAX_CONNEXIONS_PAR_PERSONNE) fermer(miennes.shift()!);
    connexions.set(c.id, c);
    for (const canal of [`u:${u.id}`, "tous", `role:${u.role}`]) abonner(c, canal);
    if (u.siteId) abonner(c, `site:${u.siteId}`);
    if (u.classeId) abonner(c, `classe:${u.classeId}`);

    // Délai de reconnexion conseillé au navigateur, puis identifiant de connexion.
    ecrire(c, `retry: 4000\n\ndata: ${JSON.stringify({ canal: `u:${u.id}`, type: "connexion", data: { id: c.id } })}\n\n`);

    const battement = setInterval(() => ecrire(c, `: battement ${Date.now()}\n\n`), 20_000);
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
