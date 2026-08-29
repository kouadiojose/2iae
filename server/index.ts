import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { getSessionConfig, ensureAdminExists } from "./auth";
import { demarrerRattrapage } from "./facebook/routes";
import { rapatrierVisuelsExternes } from "./medias/rapatriement";

const app = express();

// CRITICAL: Trust proxy for production (Railway/DigitalOcean load balancer)
app.set("trust proxy", 1);

// 🔐 SECURE SESSION CONFIGURATION - Production Ready
app.use(session(getSessionConfig()));

// Production environment check
const isProduction = process.env.NODE_ENV === "production";

// 🔒 HTTPS obligatoire en production.
//
// Le navigateur essaie http:// avant https:// quand on tape « 2iae.com » dans
// la barre d'adresse, et Chrome affiche alors « Non sécurisé » sur un site
// pourtant servi en HTTPS. La redirection ci-dessous ferme la porte, et
// l'en-tête Strict-Transport-Security évite l'aller-retour aux visites
// suivantes : le navigateur passe directement en HTTPS.
//
// Volontairement sans « includeSubDomains » : les sous-domaines du groupe
// (messagerie, panneau d'hébergement) restent servis par PlanetHoster, et
// leur imposer HTTPS depuis ici les rendrait inaccessibles. Sans « preload »
// non plus : une inscription sur la liste des navigateurs est irréversible à
// court terme.
if (isProduction) {
  app.use((req, res, next) => {
    // On ne se fie qu'à l'en-tête posé par le proxy de Railway. La sonde de
    // santé interrogeant /api/health frappe le conteneur directement, sans cet
    // en-tête : la rediriger ferait échouer chaque déploiement.
    const protocole = req.headers["x-forwarded-proto"];
    if (typeof protocole === "string" && protocole.split(",")[0].trim() === "http") {
      return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    }
    res.setHeader("Strict-Transport-Security", "max-age=15552000");
    next();
  });
}

// Increase body parser limits for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Simple CORS setup - production optimized
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow specific origins in production
  if (isProduction) {
    const allowedOrigins = new Set(["https://www.2iae.com", "https://2iae.com"]);
    // Railway injecte automatiquement le domaine public de l'app
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      allowedOrigins.add(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    }
    // Domaine(s) supplémentaire(s), séparés par des virgules
    if (process.env.APP_URL) {
      for (const url of process.env.APP_URL.split(",")) {
        allowedOrigins.add(url.trim().replace(/\/$/, ""));
      }
    }
    if (origin && allowedOrigins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
  } else {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Content-Length, X-Requested-With",
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Health check endpoint (utilisé par Railway pour vérifier que l'app est en vie)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

(async () => {
  // 🔐 Ensure admin user exists
  await ensureAdminExists();

  // Setup routes FIRST before Vite
  const server = await registerRoutes(app);

  console.log("✅ Routes enregistrées");

  // Filet de rattrapage Facebook : rejoue périodiquement la page au cas où une
  // notification du webhook se serait perdue (redéploiement, coupure réseau).
  demarrerRattrapage();

  // Visuels encore hébergés à l'extérieur — l'ancien compartiment DigitalOcean
  // Spaces, et les photographies Unsplash des filières. Le passage est différé
  // pour laisser l'application finir son démarrage, puis répété toutes les
  // demi-heures : une fois tout rapatrié il ne coûte plus que huit requêtes
  // sans résultat, et il rattrape aussitôt un visuel extérieur ajouté depuis
  // l'administration.
  const rapatrier = async () => {
    try {
      const faits = await rapatrierVisuelsExternes();
      faits.forEach((f) => console.log(`🖼️  Visuel rapatrié — ${f}`));
    } catch (err) {
      console.error("❌ Rapatriement des visuels externes :", (err as Error).message);
    }
  };
  setTimeout(rapatrier, 45_000);
  setInterval(rapatrier, 30 * 60_000);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Unhandled error:", err);
    res.status(status).json({ message });
  });

  // Setup Vite AFTER all API routes are registered
  // NOTE: en build de production, esbuild remplace NODE_ENV et élimine cette
  // branche, ce qui exclut vite (devDependency) du bundle final.
  if (process.env.NODE_ENV !== "production") {
    console.log("🔧 Configuration Vite...");
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
    console.log("✅ Vite configuré");
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
