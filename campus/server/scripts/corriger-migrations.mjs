// drizzle-kit écrit « CREATE SCHEMA "campus"; » : on le rend idempotent, car
// le migrateur crée déjà le schéma (et la base peut être partagée avec le site).
import fs from "fs";
import path from "path";

const dossier = path.resolve(import.meta.dirname, "..", "..", "migrations");
for (const f of fs.readdirSync(dossier).filter((n) => n.endsWith(".sql"))) {
  const chemin = path.join(dossier, f);
  const avant = fs.readFileSync(chemin, "utf8");
  const apres = avant.replace(/CREATE SCHEMA "campus";/g, 'CREATE SCHEMA IF NOT EXISTS "campus";');
  if (apres !== avant) {
    fs.writeFileSync(chemin, apres);
    console.log(`corrigé : ${f}`);
  }
}
