// Sessions, mots de passe et contrôle des rôles.
//
// Connexion par matricule, téléphone ou e-mail (beaucoup d'étudiants n'ont
// pas d'e-mail). Sessions longues (30 jours glissants) : sur téléphone,
// l'étudiant ne doit pas avoir à se reconnecter à chaque cours.
import type { Request, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq, or } from "drizzle-orm";
import { db, pool } from "./db";
import { config, estProduction } from "./config";
import { ErreurHttp } from "./http";
import { utilisateurs, sites, classes, type Utilisateur, type Role, type Moi } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    utilisateurId?: number;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Utilisateur connecté (chargé par chargerUtilisateur). */
      utilisateur?: Utilisateur;
    }
  }
}

const StorePg = connectPg(session);

export function configurationSession(): session.SessionOptions {
  if (estProduction && !process.env.SESSION_SECRET) {
    console.warn("⚠️  SESSION_SECRET non défini en production : les sessions ne sont pas sûres.");
  }
  return {
    store: new StorePg({
      pool,
      schemaName: "campus",
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: config.sessionSecret,
    name: "campus_2iae",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: estProduction,
      httpOnly: true,
      // « lax » et non « strict » : un lien reçu sur WhatsApp ou depuis le
      // site vitrine doit ouvrir le campus déjà connecté.
      sameSite: "lax",
      // Ajusté à la connexion selon le rôle (90 j étudiants, 30 j personnel).
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  };
}

// ── Mots de passe ──────────────────────────────────────────────────────────
export const hacher = (motDePasse: string) => bcrypt.hash(motDePasse, 11);
export const verifier = (motDePasse: string, hash: string) => bcrypt.compare(motDePasse, hash);

const MOTS = [
  "mangue", "baobab", "lagune", "savane", "akwaba", "cacao", "karite", "palmier", "soleil", "tamtam",
  "ananas", "fleuve", "colline", "bamboo", "kora", "attieke", "alloco", "cauris", "masque", "pagne",
];

/** Mot de passe fort pour les comptes du personnel créés automatiquement : « Mangue-4827-Cacao ». */
export function motDePasseProvisoire(): string {
  const mot = () => {
    const m = MOTS[crypto.randomInt(MOTS.length)];
    return `${m[0].toUpperCase()}${m.slice(1)}`;
  };
  return `${mot()}-${crypto.randomInt(1000, 10000)}-${mot()}`;
}

/** Code provisoire à 6 chiffres imprimé sur la fiche de connexion (valable 30 jours). */
export function codeProvisoire(): string {
  let code: string;
  do code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  while (!codeSecretAcceptable(code));
  return code;
}

export const DUREE_CODE_PROVISOIRE_MS = 30 * 24 * 60 * 60 * 1000;

/** Refuse les codes trop simples (123456, 000000, 111111, 654321…). */
export function codeSecretAcceptable(code: string): boolean {
  if (!/^\d+$/.test(code)) return true; // mot de passe avec lettres : jugé ailleurs
  if (/^(\d)\1+$/.test(code)) return false;
  const suites = "0123456789012345678909876543210987654321";
  if (suites.includes(code)) return false;
  return !["123123", "121212", "101010", "112233", "159753", "200000", "202020"].includes(code);
}

/** Longueur minimale du code secret selon le rôle (personnel : plus exigeant). */
export const longueurMinimale = (role: Role) => (role === "etudiant" || role === "salle" ? 6 : 10);

/** Durée de session : 90 jours pour les étudiants et les écrans de salle, 30 jours pour le personnel. */
export const dureeSession = (role: Role) => (role === "etudiant" || role === "salle" ? 90 : 30) * 24 * 60 * 60 * 1000;

export function jetonAleatoire(octets = 24): string {
  return crypto.randomBytes(octets).toString("base64url");
}

/** Normalise un numéro ivoirien : garde les chiffres, retire l'indicatif 225. */
export function normaliserTelephone(brut: string): string {
  let chiffres = brut.replace(/\D/g, "");
  if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
  if (chiffres.startsWith("225") && chiffres.length > 10) chiffres = chiffres.slice(3);
  return chiffres;
}

/**
 * Retrouve un compte à partir de ce que la personne a tapé (matricule,
 * téléphone ou e-mail). Un téléphone partagé par plusieurs comptes lève une
 * erreur qui demande le matricule.
 */
export async function trouverParIdentifiant(identifiant: string): Promise<Utilisateur | undefined> {
  const brut = identifiant.trim();
  if (!brut) return undefined;
  const [parMatricule] = await db
    .select()
    .from(utilisateurs)
    .where(or(eq(utilisateurs.matricule, brut.toUpperCase()), eq(utilisateurs.email, brut.toLowerCase())))
    .limit(1);
  if (parMatricule) return parMatricule;
  const tel = normaliserTelephone(brut);
  if (tel.length < 8) return undefined;
  const parTelephone = await db.select().from(utilisateurs).where(eq(utilisateurs.telephone, tel)).limit(2);
  if (parTelephone.length > 1) {
    throw new ErreurHttp(409, "Plusieurs comptes utilisent ce numéro. Connecte-toi avec ton matricule (il est sur ta fiche de connexion).");
  }
  return parTelephone[0];
}

/** Déconnecte toutes les autres sessions d'une personne (après un changement de code secret). */
export async function fermerAutresSessions(utilisateurId: number, sessionCourante?: string) {
  await pool.query(
    `DELETE FROM campus.session WHERE (sess->>'utilisateurId')::int = $1 AND ($2::text IS NULL OR sid <> $2)`,
    [utilisateurId, sessionCourante ?? null],
  );
}

// ── Limitation des tentatives de connexion ─────────────────────────────────
const tentatives = new Map<string, { n: number; jusqua: number }>();
const FENETRE = 15 * 60 * 1000;
const MAX_TENTATIVES = 5;

export function verifierTentatives(cle: string, max = MAX_TENTATIVES) {
  const t = tentatives.get(cle);
  if (t && t.jusqua > Date.now() && t.n >= max) {
    throw new ErreurHttp(429, "Trop de tentatives. Patiente quelques minutes ou demande de l'aide à la vie scolaire.");
  }
}
export function noterEchec(cle: string) {
  const t = tentatives.get(cle);
  if (!t || t.jusqua < Date.now()) tentatives.set(cle, { n: 1, jusqua: Date.now() + FENETRE });
  else t.n++;
}
export function effacerTentatives(cle: string) {
  tentatives.delete(cle);
}
setInterval(() => {
  const maintenant = Date.now();
  for (const [cle, t] of tentatives) if (t.jusqua < maintenant) tentatives.delete(cle);
}, FENETRE).unref();

// ── Chargement de l'utilisateur à chaque requête (petit cache mémoire) ─────
const cache = new Map<number, { u: Utilisateur; exp: number }>();

export function oublierUtilisateur(id: number) {
  cache.delete(id);
}

export async function utilisateurParId(id: number): Promise<Utilisateur | undefined> {
  const c = cache.get(id);
  if (c && c.exp > Date.now()) return c.u;
  const [u] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, id));
  if (u) cache.set(id, { u, exp: Date.now() + 15_000 });
  return u;
}

export const chargerUtilisateur: RequestHandler = async (req, _res, next) => {
  try {
    const id = req.session?.utilisateurId;
    if (id) {
      const u = await utilisateurParId(id);
      if (u?.actif) {
        req.utilisateur = u;
        // Activité réelle (les sessions durent des semaines) : au plus une écriture par heure.
        const derniere = u.derniereConnexion?.getTime() ?? 0;
        if (Date.now() - derniere > 60 * 60 * 1000) {
          const maintenant = new Date();
          u.derniereConnexion = maintenant;
          void db
            .update(utilisateurs)
            .set({ derniereConnexion: maintenant })
            .where(eq(utilisateurs.id, u.id))
            .catch(() => undefined);
        }
      } else req.session.utilisateurId = undefined;
    }
    next();
  } catch (e) {
    next(e);
  }
};

export const exigerConnexion: RequestHandler = (req, res, next) => {
  if (!req.utilisateur) return res.status(401).json({ message: "Connecte-toi pour continuer." });
  next();
};

export function exigerRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.utilisateur) return res.status(401).json({ message: "Connecte-toi pour continuer." });
    if (!roles.includes(req.utilisateur.role)) return res.status(403).json({ message: "Cette page n'est pas accessible avec ton compte." });
    next();
  };
}

/** Utilisateur connecté, garanti (à utiliser après exigerConnexion). */
export function moi(req: Request): Utilisateur {
  if (!req.utilisateur) throw new ErreurHttp(401, "Connecte-toi pour continuer.");
  return req.utilisateur;
}

export const estEquipe = (u: Pick<Utilisateur, "role">) => u.role === "admin" || u.role === "vie_scolaire";

/**
 * Sites que la personne administre : null = tout le groupe (direction, ou vie
 * scolaire sans site rattaché) ; [id] = la vie scolaire de ce seul campus.
 */
export function perimetreSites(u: Pick<Utilisateur, "role" | "siteId">): number[] | null {
  if (u.role === "vie_scolaire" && u.siteId) return [u.siteId];
  return null;
}
export const estFormateur = (u: Pick<Utilisateur, "role">) => u.role === "formateur";

/** Représentation envoyée au client : jamais de hash ni de jeton. */
export async function versMoi(u: Utilisateur): Promise<Moi> {
  const { motDePasseHash: _h, jetonAgenda: _j, jetonReleve: _r, motDePasseExpireLe: _e, ...reste } = u;
  const [site] = u.siteId
    ? await db
        .select({
          id: sites.id,
          nom: sites.nom,
          nomCourt: sites.nomCourt,
          salleConference: sites.salleConference,
          whatsappVieScolaire: sites.whatsappVieScolaire,
        })
        .from(sites)
        .where(eq(sites.id, u.siteId))
    : [];
  const [classe] = u.classeId
    ? await db
        .select({ id: classes.id, nom: classes.nom, filiere: classes.filiere, niveau: classes.niveau })
        .from(classes)
        .where(eq(classes.id, u.classeId))
    : [];
  return { ...reste, site: site ?? null, classe: classe ?? null };
}

/** Champs publics d'une personne, pour les listes (auteur d'un message, formateur…). */
export function personnePublique(u: Pick<Utilisateur, "id" | "prenom" | "nom" | "role" | "photoUrl" | "titre" | "siteId">) {
  return { id: u.id, prenom: u.prenom, nom: u.nom, role: u.role, photoUrl: u.photoUrl, titre: u.titre, siteId: u.siteId };
}
export type PersonnePublique = ReturnType<typeof personnePublique>;
