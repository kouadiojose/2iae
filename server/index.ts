import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// PRODUCTION-READY SESSION CONFIGURATION
const isProduction = process.env.NODE_ENV === 'production';

console.log(`🔐 Session Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

// Session store configuration
function createSessionStore() {
  if (isProduction) {
    // Production: Use database-backed session store
    console.log("🔐 Using database session store for production");
    try {
      const connectPg = require('connect-pg-simple');
      const pgSession = connectPg(session);
      const { pool } = require('./db');
      
      return new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true,
        ttl: 24 * 60 * 60, // 24 hours in seconds
      });
    } catch (error) {
      console.warn("⚠️  Database session store failed, falling back to memory store:", (error as Error).message);
      const memoryStore = MemoryStore(session);
      return new memoryStore({
        checkPeriod: 86400000,
        max: 1000,
        ttl: 24 * 60 * 60 * 1000
      });
    }
  } else {
    // Development: Use memory store
    console.log("🔐 Using memory session store for development");
    const memoryStore = MemoryStore(session);
    return new memoryStore({
      checkPeriod: 86400000, // Clean expired entries every 24h
      max: 1000, // Max sessions
      ttl: 24 * 60 * 60 * 1000 // 24 hours TTL
    });
  }
}

const sessionStore = createSessionStore();

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-2iae-admin-2024',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  name: '2iae-admin-session', // Custom session name
  cookie: {
    secure: isProduction, // HTTPS required in production
    httpOnly: true,
    maxAge: isProduction ? 8 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 8h prod, 24h dev
    sameSite: isProduction ? 'strict' : 'lax', // Stricter in production
    path: '/', // Ensure cookie is available for all paths
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// PRODUCTION-SAFE CORS configuration
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (isProduction) {
    // Production: Only allow your domain
    const allowedOrigins = [
      'https://your-domain.com', // Replace with actual domain
      'https://groupe2iae-production.com', // Replace with actual domain
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  } else {
    // Development: Allow all origins
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
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
