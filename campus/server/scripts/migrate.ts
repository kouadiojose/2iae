// Applique les migrations du schéma « campus » puis amorce les données
// indispensables. Lancé par Railway avant chaque déploiement
// (preDeployCommand), et en local par « npm run db:migrate:dev ».
import path from "path";
import fs from "fs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../db";
import { amorcer } from "../amorcage";
import { config } from "../config";

function dossierMigrations(): string {
  // En production le script tourne depuis dist/scripts, en dev depuis server/scripts.
  const candidats = [
    path.resolve(process.cwd(), "migrations"),
    path.resolve(import.meta.dirname, "..", "..", "migrations"),
  ];
  const trouve = candidats.find((d) => fs.existsSync(path.join(d, "meta", "_journal.json")));
  if (!trouve) throw new Error(`Dossier des migrations introuvable (cherché : ${candidats.join(", ")})`);
  return trouve;
}

async function principal() {
  await pool.query('CREATE SCHEMA IF NOT EXISTS "campus"');
  await migrate(db, { migrationsFolder: dossierMigrations(), migrationsSchema: "campus", migrationsTable: "_migrations" });
  console.log("✓ Schéma « campus » à jour.");
  await amorcer();
  if (config.demo) {
    const { semerDemo } = await import("../demo");
    await semerDemo();
  }
}

principal()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error("✗ Migration échouée :", e);
    await pool.end();
    process.exit(1);
  });
