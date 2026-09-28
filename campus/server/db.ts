// Connexion PostgreSQL partagée par tout le serveur.
//
// Sur Railway, le réseau interne (*.railway.internal) ne parle pas SSL :
// on le désactive automatiquement, comme sur le site. DATABASE_SSL=true|false
// force le comportement.
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { estProduction } from "./config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn("⚠️  DATABASE_URL n'est pas définie : le campus ne pourra pas démarrer correctement.");
}

function sslPour(chaine: string | undefined): pg.PoolConfig["ssl"] {
  const force = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (force === "true") return { rejectUnauthorized: false };
  if (force === "false") return false;
  if (!chaine) return false;
  if (/localhost|127\.0\.0\.1|\.railway\.internal/.test(chaine)) return false;
  return estProduction ? { rejectUnauthorized: false } : false;
}

export const pool = new pg.Pool({
  connectionString: url,
  ssl: sslPour(url),
  max: Number(process.env.DATABASE_POOL_MAX) || 15,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => console.error("[db] erreur du pool :", err.message));

export const db = drizzle(pool, { schema });
export type Db = typeof db;
