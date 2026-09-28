// Supprime les données de démonstration du campus, et seulement elles.
//
//   npm run db:purge-demo                 développement (lit .env)
//   npm run db:purge-demo:prod            production (après « npm run build »)
//   npm run db:purge-demo -- --simulation affiche seulement ce qui serait supprimé
//
// Sans accès au serveur (Railway) : poser CAMPUS_PURGER_DEMO=oui sur le
// service et redéployer ; la purge passe au démarrage (server/scripts/migrate.ts)
// et son bilan chiffré apparaît dans les journaux du déploiement.
//
// Le détail de ce qui part et de ce qui reste est dans server/scripts/purge.ts.
import { pool } from "../db";
import { config } from "../config";
import { prevenirSite } from "../site";
import { purgerDemonstration } from "./purge";

const simulation = process.argv.includes("--simulation") || process.argv.includes("--dry-run");
const sansAttente = process.argv.includes("--oui") || !process.stdout.isTTY;

async function principal() {
  if (!simulation && !sansAttente) {
    const apercu = await purgerDemonstration({ simulation: true });
    if (!apercu.comptes && apercu.inventaire.every(([, n]) => n === 0)) return;
    console.log("Suppression dans 5 secondes… (Ctrl+C pour annuler)");
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  const bilan = await purgerDemonstration({ simulation });
  if (!simulation && Object.keys(bilan.tables).length) prevenirSite("données de démonstration supprimées");
  if (!simulation && config.demo) {
    console.warn("⚠️  CAMPUS_DEMO est encore activé : retirez cette variable (en production, la démonstration refusera de toute façon de revenir).");
  }
}

// Le webhook du site (regroupé sur 3 s) part avant que le processus ne s'arrête.
principal()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error("✗ Purge échouée (rien n'a été supprimé) :", e);
    await pool.end();
    process.exit(1);
  });
