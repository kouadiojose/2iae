// Applique les migrations du schéma « campus » puis amorce les données
// indispensables. Lancé au démarrage du service Railway (avant le serveur),
// et en local par « npm run db:migrate:dev ».
//
// Puis, selon les variables :
//   CAMPUS_PURGER_DEMO=oui  supprime la démonstration (et seulement elle), bilan chiffré dans les journaux ;
//   CAMPUS_DEMO=true        sème la démonstration, SAUF en production quand des comptes réels existent
//                           (ou quand la purge est demandée) : refus expliqué dans les journaux.
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

  if (config.purgerDemo) {
    console.log("CAMPUS_PURGER_DEMO : suppression des données de démonstration…");
    const { purgerDemonstration } = await import("./purge");
    const bilan = await purgerDemonstration();
    if (Object.keys(bilan.tables).length) {
      const { prevenirSite } = await import("../site");
      prevenirSite("données de démonstration supprimées");
    }
    console.log("  (Vous pouvez retirer CAMPUS_PURGER_DEMO : la purge ne trouvera plus rien. La laisser ne coûte rien.)");
  }
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
