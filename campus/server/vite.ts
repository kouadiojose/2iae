// Développement : Vite en middleware (rechargement à chaud).
// Production : fichiers construits dans dist/public, index.html pour toute route inconnue.
import type { Express } from "express";
import express from "express";
import path from "path";
import fs from "fs";
import type { Server } from "http";

/**
 * Balises <head> propres à certaines pages publiques (titre, Open Graph pour
 * les aperçus WhatsApp et les moteurs de recherche). Un module enregistre une
 * fonction qui renvoie le HTML à injecter pour une URL, ou null.
 */
type FournisseurMeta = (url: string) => Promise<string | null>;
const fournisseursMeta: FournisseurMeta[] = [];
export function enregistrerMetaPage(f: FournisseurMeta) {
  fournisseursMeta.push(f);
}
async function injecterMeta(url: string, html: string): Promise<string> {
  for (const f of fournisseursMeta) {
    const meta = await f(url).catch(() => null);
    if (meta) {
      // Remplace le titre et la description par défaut.
      return html
        .replace(/<title>[^<]*<\/title>/, "")
        .replace(/<meta name="description"[^>]*>/, "")
        .replace("</head>", `${meta}\n</head>`);
    }
  }
  return html;
}

export async function brancherVite(app: Express, serveur: Server) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: path.resolve(import.meta.dirname, "..", "vite.config.ts"),
    // VITE_HMR=off : pas de rechargement à chaud (utile quand plusieurs
    // personnes modifient le code en même temps) ; VITE_CACHE_DIR : cache
    // des dépendances séparé par serveur de développement.
    server: { middlewareMode: true, hmr: process.env.VITE_HMR === "off" ? false : { server: serveur } },
    cacheDir: process.env.VITE_CACHE_DIR || undefined,
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    if (req.originalUrl.startsWith("/api/")) return next();
    try {
      const gabarit = await fs.promises.readFile(path.resolve(import.meta.dirname, "..", "client", "index.html"), "utf-8");
      const page = await injecterMeta(req.originalUrl, await vite.transformIndexHtml(req.originalUrl, gabarit));
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function servirStatique(app: Express) {
  const dossier = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(dossier)) {
    throw new Error(`Dossier de build introuvable : ${dossier}. Lancez d'abord « npm run build ».`);
  }
  // Fichiers à empreinte (assets/*) : cache long. Le reste : revalidation.
  app.use(
    "/assets",
    express.static(path.join(dossier, "assets"), { immutable: true, maxAge: "1y", index: false }),
  );
  app.use(
    express.static(dossier, {
      index: false,
      setHeaders: (res, fichier) => {
        if (fichier.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
        else res.setHeader("Cache-Control", "public, max-age=3600");
      },
    }),
  );
  const gabarit = fs.readFileSync(path.join(dossier, "index.html"), "utf-8");
  app.use("*", async (req, res, next) => {
    if (req.originalUrl.startsWith("/api/")) return next();
    try {
      res.setHeader("Cache-Control", "no-cache");
      res.type("html").send(await injecterMeta(req.originalUrl, gabarit));
    } catch (e) {
      next(e);
    }
  });
}
