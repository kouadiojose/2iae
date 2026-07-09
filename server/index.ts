import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { getSessionConfig, ensureAdminExists } from "./auth";

const app = express();

// CRITICAL: Trust proxy for production (Railway/DigitalOcean load balancer)
app.set("trust proxy", 1);

// 🔐 SECURE SESSION CONFIGURATION - Production Ready
app.use(session(getSessionConfig()));

// Production environment check
const isProduction = process.env.NODE_ENV === "production";

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
