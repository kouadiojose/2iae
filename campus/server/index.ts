// Campus numérique 2IAE : serveur HTTP.
import express from "express";
import session from "express-session";
import compression from "compression";
import { createServer } from "http";
import { config, estProduction } from "./config";
import { configurationSession, chargerUtilisateur } from "./auth";
import { enregistrerTempsReel } from "./temps-reel";
import { enregistrerFichiers } from "./fichiers";
import { enregistrerRoutes } from "./routes";
import { gestionnaireErreurs, verifierOrigine } from "./http";
import { brancherVite, servirStatique } from "./vite";
import { pool } from "./db";
import { demarrerTaches } from "./taches";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// HTTPS obligatoire en production (l'en-tête vient du proxy Railway ; la
// sonde /api/health, qui frappe le conteneur en direct, n'est pas redirigée).
if (estProduction) {
  app.use((req, res, next) => {
    const proto = req.headers["x-forwarded-proto"];
    if (typeof proto === "string" && proto.split(",")[0].trim() === "http") {
      return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    }
    res.setHeader("Strict-Transport-Security", "max-age=15552000");
    next();
  });
}

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Caméra et micro pour la classe live, écran partagé pour le formateur.
  res.setHeader("Permissions-Policy", "camera=(self \"https://*.daily.co\"), microphone=(self \"https://*.daily.co\"), display-capture=(self \"https://*.daily.co\"), fullscreen=(self \"https://*.daily.co\")");
  next();
});

// Compression (précieuse en 4G), sauf pour le flux temps réel.
app.use(
  compression({
    filter: (req, res) => (req.path === "/api/flux" ? false : compression.filter(req, res)),
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

// Santé (sonde Railway) : répond même si la base est lente.
app.get("/api/health", async (_req, res) => {
  const debut = Date.now();
  try {
    await pool.query("select 1");
    res.json({ status: "ok", base: "ok", ms: Date.now() - debut });
  } catch {
    res.status(503).json({ status: "degrade", base: "injoignable" });
  }
});

app.use("/api", verifierOrigine);
app.use(session(configurationSession()));
app.use(chargerUtilisateur);

enregistrerTempsReel(app);
enregistrerFichiers(app);
enregistrerRoutes(app);

app.use("/api", (_req, res) => res.status(404).json({ message: "Route inconnue." }));
app.use(gestionnaireErreurs);

const serveur = createServer(app);

(async () => {
  if (estProduction) servirStatique(app);
  else await brancherVite(app, serveur);
  // Le gestionnaire d'erreurs doit rester le dernier.
  app.use(gestionnaireErreurs);

  serveur.listen(config.port, "0.0.0.0", () => {
    console.log(`🎓 Campus numérique 2IAE à l'écoute sur le port ${config.port} (${estProduction ? "production" : "développement"})`);
    demarrerTaches();
  });
})();
