// CONFIGURATION POSTGRESQL POUR PRODUCTION DIGITALOCEAN
// Utilise exclusivement le driver PostgreSQL standard (pg)

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("🔧 Production PostgreSQL configuration for DigitalOcean");

// Configuration PostgreSQL pour DigitalOcean App Platform
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Requis pour DigitalOcean Managed Database
  },
  // Optimisations pour production
  max: 10, // Pool maximum
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

// Test de connexion au démarrage
pool.on("connect", () => {
  console.log("✅ PostgreSQL connection established");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL connection error:", err);
});
