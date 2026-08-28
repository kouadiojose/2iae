#!/usr/bin/env node
/**
 * Migration de la base 2IAE — idempotente et rejouable.
 *
 *   1. db/schema.sql : crée les tables manquantes (CREATE TABLE IF NOT EXISTS)
 *   2. db/seed.sql   : insère le contenu de référence (ON CONFLICT DO NOTHING)
 *
 * Chaque fichier est exécuté d'un seul bloc — il contient déjà son propre
 * BEGIN/COMMIT — et non découpé sur les ';', qui casserait sur les textes
 * contenant des points-virgules.
 *
 * N'utilise que `pg`, une dépendance de production : le script tourne donc
 * dans l'image déployée (preDeployCommand) sans drizzle-kit.
 *
 * Le schéma est rejoué à chaque déploiement : il est sans effet de bord.
 * Le seed, lui, n'est appliqué QU'UNE FOIS et son passage est enregistré dans
 * la table `_migrations`. Sans cela, un contenu supprimé volontairement depuis
 * l'admin réapparaîtrait au déploiement suivant. `--force-seed` le rejoue.
 *
 * Usage :  node scripts/migrate.js [--no-seed] [--force-seed] [--dry-run]
 */
import { Client } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const noSeed = args.includes("--no-seed");
const forceSeed = args.includes("--force-seed");
const dryRun = args.includes("--dry-run");

function ssl() {
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.DATABASE_SSL === "true") return { rejectUnauthorized: false };
  const url = process.env.DATABASE_URL || "";
  if (/sslmode=disable/.test(url)) return false;
  if (/railway\.internal|localhost|127\.0\.0\.1/.test(url)) return false;
  return process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL non définie.");
    process.exit(1);
  }

  const steps = [["schéma", "db/schema.sql"]];
  if (!noSeed) steps.push(["seed", "db/seed.sql"]);

  for (const [, file] of steps) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      console.error(`❌ Fichier introuvable : ${file}`);
      process.exit(1);
    }
  }

  if (dryRun) {
    console.log("🔍 --dry-run : fichiers présents, aucune connexion établie.");
    steps.forEach(([label, file]) => console.log(`   • ${label} → ${file}`));
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: ssl(),
    connectionTimeoutMillis: 15000,
    statement_timeout: 120000,
  });

  await client.connect();
  console.log("✅ Connecté à PostgreSQL");

  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    for (const [label, file] of steps) {
      // Le seed ne doit s'appliquer qu'une seule fois dans la vie de la base.
      if (label === "seed" && !forceSeed) {
        const seen = await client.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
        if (seen.rowCount > 0) {
          console.log(`→ Seed déjà appliqué (${file}) — ignoré.`);
          continue;
        }
      }

      process.stdout.write(`→ Application du ${label} (${file})… `);
      await client.query(fs.readFileSync(path.join(ROOT, file), "utf8"));
      if (label === "seed") {
        await client.query(
          `INSERT INTO _migrations (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET applied_at = NOW()`, [file]);
      }
      console.log("OK");
    }

    const { rows } = await client.query(`
      SELECT c.relname AS table,
             (SELECT COUNT(*) FROM pg_attribute a
               WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS colonnes,
             COALESCE(s.n_live_tup, 0) AS lignes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
       WHERE c.relkind = 'r' AND n.nspname = 'public'
       ORDER BY c.relname`);

    console.log(`\n📊 ${rows.length} tables dans la base :`);
    for (const r of rows) {
      console.log(`   ${r.table.padEnd(18)} ${String(r.colonnes).padStart(2)} col.  ~${r.lignes} lignes`);
    }
  } finally {
    await client.end();
  }
  console.log("\n🎉 Migration terminée.");
}

run().catch((err) => {
  console.error("\n❌ Échec de la migration :", err.message);
  if (err.position) console.error("   position:", err.position);
  process.exit(1);
});
