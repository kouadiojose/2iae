#!/usr/bin/env node
// Garde-fou des migrations du CAMPUS NUMÉRIQUE (dossier campus/).
//
// Tourne dans « npm run build », juste après garde-service.mjs. Les migrations
// passent au démarrage, avant le serveur (node dist/scripts/migrate.js), et le
// migrateur Drizzle n'applique une entrée du journal que si son « when »
// dépasse celui de la DERNIÈRE migration appliquée (drizzle-orm,
// pg-core/dialect.js) : une entrée mal rangée est sautée sans un mot en
// production, et une migration qui échoue empêche le campus de redémarrer.
// Si migrations/meta/_journal.json est incohérent, la construction s'arrête
// avant tout déploiement : la version en ligne reste en place.
//
// Vérifié : idx consécutifs depuis 0 · tag qui commence par son numéro sur
// 4 chiffres · un fichier .sql par entrée et une entrée par fichier .sql ·
// « when » strictement croissant · à partir de 0026 (plan d'engagement), IF NOT
// EXISTS sur chaque CREATE TABLE, CREATE INDEX et ADD COLUMN. Le contenu des
// blocs $$ … $$ (DO, fonctions) n'est pas examiné : ils portent leurs propres
// gardes. Procédure de fusion : campus/ENGAGEMENT.md.
//
// Usage hors construction : node scripts/garde-migrations.mjs [dossier des migrations]
import fs from "fs";
import path from "path";

const dossier = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "..", "migrations"));
const cheminJournal = path.join(dossier, "meta", "_journal.json");
/** Première migration soumise à la règle IF NOT EXISTS (les précédentes sont déjà en production). */
const PREMIERE_IDEMPOTENTE = 26;

function arreter(erreurs) {
  console.error(
    [
      "",
      "✖ CONSTRUCTION ARRÊTÉE : le journal des migrations du campus est incohérent.",
      `  (${path.relative(process.cwd(), cheminJournal) || cheminJournal})`,
      "",
      ...erreurs.map((e) => `  · ${e}`),
      "",
      "  Le migrateur Drizzle sauterait ou casserait une migration en production.",
      "  Procédure de fusion des migrations : campus/ENGAGEMENT.md (« Migrations »).",
      "  La version en ligne n'a pas été touchée.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const dateDe = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";

let journal;
try {
  journal = JSON.parse(fs.readFileSync(cheminJournal, "utf8"));
} catch (e) {
  arreter([`Journal illisible : ${e.message}`]);
}
if (!Array.isArray(journal?.entries)) arreter(["Le journal n'a pas de liste « entries »."]);

const erreurs = [];
const fichiers = new Set(fs.readdirSync(dossier).filter((n) => n.endsWith(".sql")));
const tags = new Set();
let precedente = null;

journal.entries.forEach((e, i) => {
  const tag = typeof e?.tag === "string" ? e.tag : "";
  const ou = `Entrée n° ${i} (${tag || "sans tag"})`;
  const numero = String(i).padStart(4, "0");

  if (e?.idx !== i) erreurs.push(`${ou} : idx vaut ${JSON.stringify(e?.idx)}, attendu ${i}. Les idx se suivent depuis 0, sans trou ni doublon.`);

  const m = /^(\d{4})_[A-Za-z0-9_-]+$/.exec(tag);
  if (!m) erreurs.push(`${ou} : le tag doit être le numéro sur 4 chiffres suivi de « _ » et d'un nom (ex. ${numero}_envois_push).`);
  else if (m[1] !== numero) erreurs.push(`${ou} : le tag commence par ${m[1]}, attendu ${numero}. Renumérotez le fichier .sql et son tag selon l'ordre du journal.`);

  if (tags.has(tag)) erreurs.push(`${ou} : tag en double.`);
  tags.add(tag);
  if (tag && !fichiers.has(`${tag}.sql`)) erreurs.push(`${ou} : fichier migrations/${tag}.sql introuvable.`);

  if (typeof e?.when !== "number" || !Number.isFinite(e.when)) {
    erreurs.push(`${ou} : « when » doit être un nombre (Date.now() au moment de la fusion).`);
  } else {
    if (precedente && e.when <= precedente.when)
      erreurs.push(
        `${ou} : « when » (${e.when}, ${dateDe(e.when)}) n'est pas strictement supérieur à celui de ${precedente.tag} (${precedente.when}, ${dateDe(precedente.when)}). ` +
          "Drizzle sauterait cette migration en production : mettez « when » à Date.now() au moment de la fusion.",
      );
    precedente = { tag, when: e.when };
  }

  if (i >= PREMIERE_IDEMPOTENTE && fichiers.has(`${tag}.sql`)) {
    for (const faute of fautesIdempotence(fs.readFileSync(path.join(dossier, `${tag}.sql`), "utf8")))
      erreurs.push(`migrations/${tag}.sql : ${faute}`);
  }
});

for (const f of [...fichiers].sort())
  if (!tags.has(f.slice(0, -4)))
    erreurs.push(`migrations/${f} : aucune entrée dans le journal. Drizzle ne l'appliquerait jamais : ajoutez son entrée (ou retirez le fichier).`);

if (erreurs.length) arreter(erreurs);
const derniere = journal.entries.at(-1);
console.log(`✓ Journal des migrations cohérent : ${journal.entries.length} migrations, la dernière est ${derniere?.tag ?? "(aucune)"}.`);

/**
 * Instructions qui casseraient une migration rejouée : CREATE TABLE, CREATE
 * INDEX et ADD COLUMN sans IF NOT EXISTS. Commentaires, chaînes et blocs $$
 * sont retirés avant l'examen.
 */
function fautesIdempotence(texte) {
  const sqlNu = texte
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/'(?:[^']|'')*'/g, "''");
  const fautes = [];
  const extrait = (i) => sqlNu.slice(i, i + 70).split(";")[0].replace(/\s+/g, " ").trim();
  const motifs = [
    [/\bCREATE\s+(?:(?:GLOBAL|LOCAL)\s+)?(?:(?:TEMP|TEMPORARY|UNLOGGED)\s+)?TABLE\s+(?!IF\s+NOT\s+EXISTS\b)/gi, "CREATE TABLE sans IF NOT EXISTS"],
    [/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?!IF\s+NOT\s+EXISTS\b)/gi, "CREATE INDEX sans IF NOT EXISTS"],
    [/\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)/gi, "ADD COLUMN sans IF NOT EXISTS"],
    // « ALTER TABLE t ADD nom type » (COLUMN est facultatif en SQL) : même faute.
    [/\bADD\s+(?!COLUMN\b|IF\b|CONSTRAINT\b|PRIMARY\b|UNIQUE\b|FOREIGN\b|CHECK\b|EXCLUDE\b|VALUE\b|GENERATED\b)(?=[A-Za-z_"])/gi, "ADD sans COLUMN IF NOT EXISTS"],
  ];
  for (const [motif, libelle] of motifs)
    for (const m of sqlNu.matchAll(motif)) fautes.push(`${libelle} (« ${extrait(m.index)} … »). Écrivez « IF NOT EXISTS » : une migration doit pouvoir être rejouée.`);
  return fautes;
}
