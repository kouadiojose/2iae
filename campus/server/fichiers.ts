// Dépôt et lecture des fichiers (ressources de cours, devoirs rendus en
// photo ou PDF, examens, pièces jointes des messages, diapos, photos).
//
// Les fichiers vivent dans le bucket Railway des fichiers (FICHIERS_BUCKET) ;
// le volume (UPLOADS_DIR) ne sert plus que de passage pendant le dépôt, et de
// repli si le bucket ne répond pas. Rien n'est JAMAIS servi en statique :
// chaque lecture passe par un contrôle d'accès selon l'usage du fichier, puis
// le navigateur est renvoyé vers un lien signé de courte durée (les octets ne
// traversent pas l'application).
import type { Express, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { db } from "./db";
import { config } from "./config";
import { exigerConnexion, moi, estEquipe, perimetreSites } from "./auth";
import { route, idParam, introuvable, interdit, invalide, ErreurHttp } from "./http";
import { planifier } from "./taches";
import { creerBucket } from "./stockage";
import { and, eq, like, not } from "drizzle-orm";
import { fichiers, utilisateurs, type Fichier, type Utilisateur } from "@shared/schema";

/** Le bucket Railway des fichiers ; ses objets sont rangés sous « fichiers/<clé> ». */
const bucket = creerBucket(config.fichiersBucket, "fichiers");
const objet = (cle: string) => `fichiers/${cle}`;
export const bucketFichiersDisponible = () => bucket.disponible();
const cheminLocal = (cle: string) => {
  const chemin = path.resolve(config.dossierFichiers, cle);
  return chemin.startsWith(config.dossierFichiers + path.sep) ? chemin : null;
};

// « site » : photo d'un campus pour le site public (publique seulement une fois choisie par la direction, voir routes/public.ts).
// « source-profil » : PDF du profil LinkedIn ou photo d'un formateur pour sa présentation (module showreel, routes/showreel.ts).
export const USAGES_FICHIER = ["lecon", "rendu", "message", "avatar", "devoir", "annonce", "import", "diapo", "site", "source-profil", "chat", "piece"] as const;
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
  if (f.proprietaireId === u.id || f.usage === "avatar") return true;
  if (estEquipe(u)) {
    const perimetre = perimetreSites(u);
    if (!perimetre) return true; // direction, ou vie scolaire du groupe
    // Vie scolaire d'un site : les fichiers des personnes de son site…
    const [proprietaire] = await db
      .select({ siteId: utilisateurs.siteId })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, f.proprietaireId));
    if (proprietaire?.siteId && perimetre.includes(proprietaire.siteId)) return true;
    // …sinon, seulement ce que le module concerné autorise (ressources de cours, etc.).
  }
  const gardien = gardiens.get(f.usage);
  return gardien ? gardien(u, f) : false;
}

export const urlFichier = (id: number) => `/api/fichiers/${id}`;

try {
  fs.mkdirSync(config.dossierFichiers, { recursive: true });
} catch (e) {
  console.error(`⚠️  Dossier des fichiers inutilisable (${config.dossierFichiers}) : ${(e as Error).message}`);
}

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
    else cb(new ErreurHttp(415, "Ce type de fichier n'est pas accepté. Envoie une photo, un PDF, un document Office, un fichier audio ou une vidéo courte."));
  },
});

/**
 * Enregistre un fichier reçu (multer l'a posé sur le volume) : il part dans le
 * bucket, puis quitte le volume. Si le bucket ne répond pas, il reste sur le
 * volume et sera recopié plus tard (tâche « fichiers-vers-bucket »).
 */
export async function enregistrerFichier(u: Utilisateur, f: Express.Multer.File, usage: UsageFichier): Promise<Fichier> {
  const cle = path.relative(config.dossierFichiers, f.path).split(path.sep).join("/");
  const nomOriginal = Buffer.from(f.originalname, "latin1").toString("utf8");
  let emplacement: "disque" | "bucket" = "disque";
  if (bucket.disponible()) {
    try {
      await bucket.envoyerFichierLocal(f.path, objet(cle), f.mimetype);
      emplacement = "bucket";
      await fs.promises.rm(f.path, { force: true });
    } catch (e) {
      console.warn(`[fichiers] ${cle} gardé sur le volume, le bucket n'a pas répondu :`, (e as Error).message);
    }
  }
  const [ligne] = await db
    .insert(fichiers)
    .values({ proprietaireId: u.id, nomOriginal, mime: f.mimetype, taille: f.size, cle, usage, emplacement })
    .returning();
  return ligne;
}

/** Contenu entier d'un fichier (correction par l'IA, PDF d'un profil…) ; null s'il est introuvable. */
export async function lireContenuFichier(f: Fichier): Promise<Buffer | null> {
  try {
    if (f.emplacement === "bucket") return await bucket.lire(objet(f.cle));
    const chemin = cheminLocal(f.cle);
    return chemin && fs.existsSync(chemin) ? await fs.promises.readFile(chemin) : null;
  } catch (e) {
    console.error(`[fichiers] lecture impossible (${f.id}) :`, (e as Error).message);
    return null;
  }
}

/**
 * Remet un fichier au navigateur, APRÈS le contrôle d'accès : renvoi vers un
 * lien signé du bucket (type et nom gravés dans le lien, lecture par plages
 * pour l'audio et la vidéo), ou lecture sur le volume pour un fichier pas
 * encore recopié.
 */
export async function remettreFichier(res: Response, f: Fichier, o: { telecharger?: boolean; public?: boolean } = {}): Promise<void> {
  if (f.emplacement === "bucket" && bucket.disponible()) {
    const { url } = await bucket.lienSigne(objet(f.cle), { validiteSecondes: 3600, type: f.mime, nomFichier: f.nomOriginal, telecharger: o.telecharger });
    // Le lien vaut une heure ; le renvoi n'est gardé que dix minutes.
    res.setHeader("Cache-Control", `${o.public ? "public" : "private"}, max-age=600`);
    res.redirect(302, url);
    return;
  }
  const chemin = cheminLocal(f.cle);
  if (!chemin || !fs.existsSync(chemin)) throw introuvable("Fichier");
  res.setHeader("Content-Type", f.mime);
  res.setHeader("Content-Disposition", `${o.telecharger ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.nomOriginal)}`);
  res.setHeader("Cache-Control", `${o.public ? "public" : "private"}, max-age=86400`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Une erreur de lecture (fichier abîmé, volume indisponible) ne doit
  // jamais faire tomber le serveur : on répond ou on coupe proprement.
  const flux = fs.createReadStream(chemin);
  flux.on("error", (e) => {
    console.error(`[fichiers] lecture impossible (${f.id}) :`, e.message);
    if (res.headersSent) res.destroy();
    else res.status(500).json({ message: "Ce fichier est momentanément illisible." });
  });
  flux.pipe(res);
}

// ── Reprise : les fichiers encore sur le volume partent dans le bucket ─────
// Par lots de 25, toutes les 5 minutes : ni pic de mémoire ni de réseau. Un
// fichier n'est retiré du volume qu'une fois sa copie vérifiée (même taille).
let repriseEnCours = false;
planifier("fichiers-vers-bucket", 5 * 60_000, async () => {
  if (repriseEnCours || !bucket.disponible()) return;
  repriseEnCours = true;
  try {
    const lot = await db
      .select()
      .from(fichiers)
      .where(and(eq(fichiers.emplacement, "disque"), not(like(fichiers.cle, "demo/%"))))
      .limit(25);
    let copies = 0;
    for (const f of lot) {
      const chemin = cheminLocal(f.cle);
      if (!chemin || !fs.existsSync(chemin)) continue;
      try {
        await bucket.envoyerFichierLocal(chemin, objet(f.cle), f.mime);
        await db.update(fichiers).set({ emplacement: "bucket" }).where(eq(fichiers.id, f.id));
        await fs.promises.rm(chemin, { force: true });
        copies++;
      } catch (e) {
        console.warn(`[fichiers] reprise de ${f.cle} impossible pour l'instant :`, (e as Error).message);
      }
    }
    if (copies) console.log(`[fichiers] ${copies} fichier(s) recopié(s) du volume vers le bucket`);
  } finally {
    repriseEnCours = false;
  }
});

// Lecture directe par le navigateur (service worker hors ligne, lecteurs audio et vidéo).
if (bucket.disponible()) {
  bucket.autoriserLectureNavigateur().catch((e) => console.warn("[fichiers] règle de lecture du bucket non posée :", (e as Error).message));
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
      const recus = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (!USAGES_FICHIER.includes(usage)) {
        // multer a déjà écrit les fichiers : on ne laisse pas d'orphelins sur le disque.
        await Promise.all(recus.map((f) => fs.promises.unlink(f.path).catch(() => undefined)));
        throw invalide("Usage de fichier inconnu.");
      }
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
      await remettreFichier(res, f, { telecharger: req.query.telecharger === "1" });
    }),
  );
}
