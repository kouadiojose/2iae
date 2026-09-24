// Dépôt et lecture des fichiers (ressources de cours, devoirs rendus en
// photo ou PDF, pièces jointes des messages, photos de profil).
//
// Les fichiers sont rangés sous UPLOADS_DIR (un volume Railway en
// production) et ne sont JAMAIS servis en statique : chaque lecture passe par
// un contrôle d'accès selon l'usage du fichier.
import type { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { exigerConnexion, moi, estEquipe } from "./auth";
import { route, idParam, introuvable, interdit, invalide } from "./http";
import { fichiers, type Fichier, type Utilisateur } from "@shared/schema";

export const USAGES_FICHIER = ["lecon", "rendu", "message", "avatar", "devoir", "annonce", "import", "diapo"] as const;
export type UsageFichier = (typeof USAGES_FICHIER)[number];

const MIMES_AUTORISES = [
  /^image\/(jpeg|png|webp|gif|heic|heif)$/,
  /^application\/pdf$/,
  /^application\/(msword|vnd\.openxmlformats-officedocument\..+|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.oasis\.opendocument\..+)$/,
  /^text\/(plain|csv|markdown)$/,
  /^application\/(zip|x-zip-compressed)$/,
  /^audio\/(mpeg|mp4|ogg|webm|wav|x-m4a|aac)$/,
  /^video\/(mp4|webm|quicktime)$/,
];

type GardienFichier = (u: Utilisateur, f: Fichier) => Promise<boolean>;
const gardiens = new Map<string, GardienFichier>();

/** Un module déclare qui peut lire les fichiers d'un usage donné (en plus du propriétaire et de l'équipe). */
export function enregistrerGardienFichier(usage: UsageFichier, gardien: GardienFichier) {
  gardiens.set(usage, gardien);
}

export async function peutLireFichier(u: Utilisateur, f: Fichier): Promise<boolean> {
  if (f.proprietaireId === u.id || estEquipe(u)) return true;
  if (f.usage === "avatar") return true;
  const gardien = gardiens.get(f.usage);
  return gardien ? gardien(u, f) : false;
}

export const urlFichier = (id: number) => `/api/fichiers/${id}`;

fs.mkdirSync(config.dossierFichiers, { recursive: true });

const stockage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const mois = new Date().toISOString().slice(0, 7);
    const dossier = path.join(config.dossierFichiers, mois);
    fs.mkdir(dossier, { recursive: true }, (err) => cb(err, dossier));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
    cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  },
});

export const televersement = multer({
  storage: stockage,
  limits: { fileSize: config.tailleMaxFichierMo * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (MIMES_AUTORISES.some((re) => re.test(file.mimetype))) cb(null, true);
    else cb(new Error(`Type de fichier non accepté (${file.mimetype}).`));
  },
});

/** Enregistre en base un fichier reçu par multer. */
export async function enregistrerFichier(u: Utilisateur, f: Express.Multer.File, usage: UsageFichier): Promise<Fichier> {
  const cle = path.relative(config.dossierFichiers, f.path).split(path.sep).join("/");
  const nomOriginal = Buffer.from(f.originalname, "latin1").toString("utf8");
  const [ligne] = await db
    .insert(fichiers)
    .values({ proprietaireId: u.id, nomOriginal, mime: f.mimetype, taille: f.size, cle, usage })
    .returning();
  return ligne;
}

export function versFichierPublic(f: Fichier) {
  return { id: f.id, nom: f.nomOriginal, mime: f.mime, taille: f.taille, url: urlFichier(f.id) };
}
export type FichierPublic = ReturnType<typeof versFichierPublic>;

export function enregistrerFichiers(app: Express) {
  // Téléversement : un ou plusieurs fichiers dans le champ « fichiers », usage dans le corps.
  app.post(
    "/api/fichiers",
    exigerConnexion,
    televersement.array("fichiers", 10),
    route(async (req, res) => {
      const u = moi(req);
      const usage = String(req.body?.usage || "") as UsageFichier;
      if (!USAGES_FICHIER.includes(usage)) throw invalide("Usage de fichier inconnu.");
      const recus = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (!recus.length) throw invalide("Aucun fichier reçu.");
      const enregistres = [];
      for (const f of recus) enregistres.push(versFichierPublic(await enregistrerFichier(u, f, usage)));
      res.status(201).json(enregistres);
    }),
  );

  app.get(
    "/api/fichiers/:id",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const [f] = await db.select().from(fichiers).where(eq(fichiers.id, idParam(req)));
      if (!f) throw introuvable("Fichier");
      if (!(await peutLireFichier(u, f))) throw interdit("Ce fichier ne t'est pas accessible.");
      const chemin = path.resolve(config.dossierFichiers, f.cle);
      if (!chemin.startsWith(config.dossierFichiers) || !fs.existsSync(chemin)) throw introuvable("Fichier");
      const telecharger = req.query.telecharger === "1";
      res.setHeader("Content-Type", f.mime);
      res.setHeader(
        "Content-Disposition",
        `${telecharger ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.nomOriginal)}`,
      );
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      fs.createReadStream(chemin).pipe(res);
    }),
  );
}
