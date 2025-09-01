import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// SIMPLIFIED SESSION CONFIGURATION FOR PRODUCTION FIX
const isProduction = process.env.NODE_ENV === 'production';

console.log(`🔐 Session Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`🌐 Host: ${process.env.REPLIT_DOMAINS || 'localhost'}`);

// SIMPLIFIÉ: Utilise MemoryStore fiable pour les deux environnements
// Le problème principal était CORS, pas le store de sessions
console.log("🔐 Using optimized memory session store (works in both environments)");
const memoryStore = MemoryStore(session);
const sessionStore = new memoryStore({
  checkPeriod: isProduction ? 12 * 60 * 60 * 1000 : 86400000, // Clean more often in prod
  max: isProduction ? 500 : 1000, // Less memory usage in prod
  ttl: isProduction ? 8 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 8h prod, 24h dev
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-2iae-admin-2024',
  store: sessionStore,
  resave: true, // CRUCIAL: Force save même si pas modifiée
  saveUninitialized: true, // CRUCIAL: Sauve même session vide
  rolling: true, // Reset expiration on activity
  name: 'connect.sid', // NOM STANDARD - crucial pour prod
  cookie: {
    secure: false, // Reste désactivé pour diagnostic
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24h pour test (plus long)
    sameSite: 'none', // PLUS PERMISSIF - crucial pour cross-origin
    path: '/',
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS PERMISSIF POUR DIAGNOSTIC (temporaire)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // TEMPORAIRE: CORS très permissif pour diagnostiquer le problème de sessions
  console.log(`🌐 Request from origin: ${origin || 'direct'}`);
  
  // Autorise toutes les origines pour diagnostic
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// MIDDLEWARE DE DÉBOGAGE SESSION CRITIQUE
app.use((req, res, next) => {
  if (req.path.startsWith('/api/admin')) {
    console.log('\n🐛 ===== SESSION DEBUG =====');
    console.log(`📍 Path: ${req.path}`);
    console.log(`🍪 Session ID: ${req.sessionID || 'NONE'}`);
    console.log(`📦 Session exists: ${!!req.session}`);
    console.log(`👤 Admin in session: ${!!req.session?.admin}`);
    console.log(`🔑 Admin ID: ${req.session?.adminId || 'NONE'}`);
    console.log(`🎫 Cookie header: ${req.headers.cookie || 'NONE'}`);
    console.log('🐛 ========================\n');
  }
  next();
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

(async () => {
  // Setup routes FIRST before Vite
  const server = await registerRoutes(app);
  
  console.log("✅ Routes enregistrées");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite AFTER all API routes are registered
  if (app.get("env") === "development") {
    console.log("🔧 Configuration Vite...");
    await setupVite(app, server);
    console.log("✅ Vite configuré");
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
