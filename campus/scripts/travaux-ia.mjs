#!/usr/bin/env node
// Outil de la routine du soir (IA du soir) : voir campus/TRAVAUX-IA.md.
//
//   node campus/scripts/travaux-ia.mjs tour              fait avancer les travaux, écrit chaque demande en attente
//                                                        dans campus/.travaux-ia/<id>/ (consignes.md, images/, schema.json)
//   node campus/scripts/travaux-ia.mjs repondre <id>     envoie campus/.travaux-ia/<id>/reponse.json
//   node campus/scripts/travaux-ia.mjs etat              demandes en attente, sans rien lancer
//
// Clé : variable d'environnement TRAVAUX_IA_JETON (secret de l'environnement de la routine). À défaut, elle est
// lue par le Railway CLI (variables du service campus), si celui-ci est connecté. Elle n'est jamais affichée.
// Adresse : CAMPUS (par défaut https://campus.2iae.com).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ICI = path.dirname(new URL(import.meta.url).pathname);
const DOSSIER = path.resolve(ICI, "..", ".travaux-ia");
const CAMPUS = (process.env.CAMPUS || "https://campus.2iae.com").replace(/\/+$/, "");

function jeton() {
  if (process.env.TRAVAUX_IA_JETON) return process.env.TRAVAUX_IA_JETON.trim();
  try {
    const kv = execFileSync("railway", ["variables", "--service", "campus", "--environment", "production", "--kv"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const ligne = kv.split("\n").find((l) => l.startsWith("TRAVAUX_IA_JETON="));
    if (ligne) return ligne.slice("TRAVAUX_IA_JETON=".length).trim();
  } catch {
    /* Railway CLI absent ou non connecté */
  }
  console.error("✗ Clé introuvable : ajoutez le secret TRAVAUX_IA_JETON à l'environnement (même valeur que la variable Railway du service campus).");
  process.exit(2);
}

async function appel(methode, chemin, corps) {
  const r = await fetch(CAMPUS + chemin, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton()}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await r.text();
  let donnees;
  try {
    donnees = JSON.parse(texte);
  } catch {
    donnees = texte;
  }
  return { statut: r.status, donnees };
}

/** Une demande en fichiers lisibles : les consignes et les messages en Markdown, les images à part, le schéma. */
function ecrireDemande(d) {
  const dir = path.join(DOSSIER, String(d.id));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "images"), { recursive: true });
  const r = d.requete;
  const lignes = [
    `# Demande ${d.id} · ${d.origine}`,
    "",
    "Réponds en JSON, conforme à schema.json, dans reponse.json (rien d'autre dans le fichier).",
    r.maxTokens ? `Longueur indicative : la réponse tenait en ${r.maxTokens} jetons au plus.` : "",
    "",
    "## Consignes (système)",
    "",
    r.systeme,
  ];
  if (r.contexte) lignes.push("", "## Contexte", "", r.contexte);
  let n = 0;
  for (const m of r.messages ?? []) {
    lignes.push("", `## Message (${m.role === "assistant" ? "assistant" : "utilisateur"})`, "");
    const blocs = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content ?? [];
    for (const b of blocs) {
      if (b.type === "text") lignes.push(b.text);
      else if (b.type === "image" && b.source?.type === "base64") {
        n += 1;
        const ext = b.source.media_type === "image/png" ? "png" : b.source.media_type === "image/webp" ? "webp" : "jpg";
        const fichier = `images/${String(n).padStart(3, "0")}.${ext}`;
        fs.writeFileSync(path.join(dir, fichier), Buffer.from(b.source.data, "base64"));
        lignes.push(`[Image ${n} : ${fichier}]`);
      }
    }
  }
  fs.writeFileSync(path.join(dir, "consignes.md"), lignes.filter((l) => l !== null).join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "schema.json"), JSON.stringify(r.schema, null, 2) + "\n");
  return { dir, images: n };
}

const [commande, arg] = process.argv.slice(2);

if (commande === "tour") {
  const t = await appel("POST", "/api/travaux-ia/tour");
  if (t.statut !== 200) {
    console.error(`✗ Tour refusé (${t.statut}) :`, typeof t.donnees === "string" ? t.donnees.slice(0, 300) : t.donnees.message ?? t.donnees);
    process.exit(1);
  }
  for (const b of t.donnees.bilan) console.log(`  ${b.travail} : ${b.issue === "prete" ? "prêt, étudiants prévenus" : b.issue === "soir" ? "en attente de réponses" : b.issue}`);
  const demandes = t.donnees.demandes;
  if (!demandes.length) {
    console.log("✓ Aucune demande en attente : le travail du soir est fini.");
    process.exit(0);
  }
  fs.mkdirSync(DOSSIER, { recursive: true });
  console.log(`${demandes.length} demande(s) à traiter :`);
  for (const resume of demandes) {
    const d = await appel("GET", `/api/travaux-ia/demandes/${resume.id}`);
    if (d.statut !== 200) {
      console.error(`  ✗ demande ${resume.id} illisible (${d.statut})`);
      continue;
    }
    const { dir, images } = ecrireDemande(d.donnees);
    console.log(`  ${resume.id} · ${resume.origine} · ${Math.round(resume.taille / 1000)} ko${images ? ` · ${images} image(s)` : ""} → ${path.relative(process.cwd(), dir)}`);
  }
} else if (commande === "repondre" && arg) {
  const fichier = path.join(DOSSIER, arg, "reponse.json");
  if (!fs.existsSync(fichier)) {
    console.error(`✗ ${fichier} n'existe pas.`);
    process.exit(1);
  }
  let reponse;
  try {
    reponse = JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch (e) {
    console.error(`✗ reponse.json n'est pas du JSON valide : ${e.message}`);
    process.exit(1);
  }
  const r = await appel("POST", `/api/travaux-ia/demandes/${arg}/reponse`, { reponse });
  if (r.statut === 200) console.log(`✓ Réponse ${arg} gardée.`);
  else {
    console.error(`✗ Réponse ${arg} refusée (${r.statut}) : ${r.donnees.message ?? ""}`);
    for (const e of r.donnees.ecarts ?? []) console.error(`   - ${e}`);
    process.exit(1);
  }
} else if (commande === "etat") {
  const r = await appel("GET", "/api/travaux-ia/demandes");
  if (r.statut !== 200) {
    console.error(`✗ (${r.statut})`, r.donnees.message ?? r.donnees);
    process.exit(1);
  }
  console.log(r.donnees.length ? r.donnees.map((d) => `  ${d.id} · ${d.origine} · ${Math.round(d.taille / 1000)} ko`).join("\n") : "Aucune demande en attente.");
} else {
  console.log("Usage : node campus/scripts/travaux-ia.mjs tour | repondre <id> | etat");
  process.exit(1);
}
