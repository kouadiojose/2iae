// Petits outils communs aux routes : erreurs HTTP lisibles, validation zod,
// gestion des exceptions asynchrones.
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z, ZodError, type ZodTypeAny } from "zod";
import { ErreurIa } from "./ia";

export class ErreurHttp extends Error {
  constructor(public statut: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const introuvable = (quoi = "Élément") => new ErreurHttp(404, `${quoi} introuvable.`);
export const interdit = (message = "Accès refusé.") => new ErreurHttp(403, message);
export const invalide = (message: string, details?: unknown) => new ErreurHttp(400, message, details);

/** Enveloppe un gestionnaire async : toute exception part vers le gestionnaire d'erreurs. */
export function route(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Valide req.body (ou toute valeur) avec un schéma zod ; lève une 400 lisible sinon. */
export function valider<S extends ZodTypeAny>(schema: S, valeur: unknown): z.infer<S> {
  const r = schema.safeParse(valeur);
  if (!r.success) {
    const premier = r.error.issues[0];
    const champ = premier?.path.join(".") || "requête";
    throw invalide(`${champ} : ${premier?.message ?? "valeur invalide"}`, r.error.issues);
  }
  return r.data;
}

/** Identifiant numérique d'un paramètre d'URL. */
export function idParam(req: Request, nom = "id"): number {
  const n = Number(req.params[nom]);
  if (!Number.isInteger(n) || n <= 0) throw invalide(`Paramètre ${nom} invalide.`);
  return n;
}

export function gestionnaireErreurs(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (err instanceof ErreurHttp) {
    return res.status(err.statut).json({ message: err.message, details: err.details });
  }
  if (err instanceof ErreurIa) {
    return res.status(err.statut).json({ message: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ message: "Données invalides.", details: err.issues });
  }
  const e = err as { status?: number; statusCode?: number; message?: string; code?: string };
  if (e?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "Fichier trop lourd." });
  }
  if (e?.code === "23505") {
    return res.status(409).json({ message: "Cet élément existe déjà." });
  }
  console.error(`[erreur] ${req.method} ${req.originalUrl} :`, err);
  const statut = e?.status || e?.statusCode || 500;
  res.status(statut).json({ message: statut === 500 ? "Une erreur est survenue. Réessaie dans un instant." : e.message });
}

/**
 * Protection CSRF : une requête qui modifie des données doit venir du campus
 * lui-même (en-tête Origin identique à l'hôte). Les cookies SameSite=Lax
 * couvrent déjà l'essentiel ; ceci ferme les cas restants.
 */
export function verifierOrigine(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.originalUrl.startsWith("/api/public/")) return next();
  const origine = req.headers.origin;
  if (!origine) return next(); // clients sans Origin (outils, anciens navigateurs) : SameSite fait foi
  try {
    const hote = req.headers["x-forwarded-host"] || req.headers.host;
    if (new URL(origine).host === hote) return next();
  } catch {
    /* Origin illisible */
  }
  res.status(403).json({ message: "Requête refusée (origine inconnue)." });
}
