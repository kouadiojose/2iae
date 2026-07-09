import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Détermine la configuration SSL selon l'hébergeur :
// - Railway (réseau interne *.railway.internal) et localhost : pas de SSL
// - DigitalOcean / Neon / autres bases managées : SSL requis
// - Forçable via DATABASE_SSL=true|false
function resolveSsl(): false | { rejectUnauthorized: boolean } {
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.DATABASE_SSL === "true") return { rejectUnauthorized: false };

  const url = process.env.DATABASE_URL!;
  if (/sslmode=disable/.test(url)) return false;
  if (/railway\.internal|localhost|127\.0\.0\.1/.test(url)) return false;

  return process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err);
});

export const db = drizzle({ client: pool, schema });
