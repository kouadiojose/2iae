#!/usr/bin/env node
// Outil de la routine du soir (IA du soir) : voir campus/TRAVAUX-IA.md.
//
//   node campus/scripts/travaux-ia.mjs tour              fait avancer les travaux, écrit chaque demande en attente
//                                                        dans campus/.travaux-ia/<id>/ (consignes.md, images/,
//                                                        documents/ pour les PDF, schema.json)
//   node campus/scripts/travaux-ia.mjs repondre <id>     envoie campus/.travaux-ia/<id>/reponse.json
//   node campus/scripts/travaux-ia.mjs etat              demandes en attente, sans rien lancer
//
// Le tour peut durer quelques minutes (lecture et conversion des copies) : l'outil attend sa réponse jusqu'à
// 10 minutes ; un tour déjà en cours (409) est réessayé toutes les 30 secondes, 5 fois. Quand il ne reste aucune
// demande mais encore des copies à préparer (aSuivre), l'outil relance le tour lui-même tant qu'il avance.
// À lancer avec un délai d'au moins 10 minutes (outil Bash : timeout 600000).
//
// Clé : variable d'environnement TRAVAUX_IA_JETON (secret de l'environnement de la routine). À défaut, elle est
// lue par le Railway CLI (variables du service campus), si celui-ci est connecté. Elle n'est jamais affichée.
// Adresse : CAMPUS (par défaut https://campus.2iae.com).
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
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

const MINUTE = 60_000;
const attendre = (ms) => new Promise((fini) => setTimeout(fini, ms));

/**
 * Appel au campus (http ou https du module de Node, pas fetch : fetch abandonne au bout de 5 minutes sans
 * réponse, un tour chargé peut durer plus). « delai » : attente maximale de la réponse.
 */
function appel(methode, chemin, corps, delai = 2 * MINUTE) {
  const url = new URL(CAMPUS + chemin);
  const charge = corps ? JSON.stringify(corps) : null;
  const module = url.protocol === "https:" ? https : http;
  return new Promise((fini, echoue) => {
    const req = module.request(
      url,
      {
        method: methode,
        headers: { Authorization: `Bearer ${jeton()}`, ...(charge ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(charge) } : {}) },
      },
      (rep) => {
        const morceaux = [];
        rep.on("data", (m) => morceaux.push(m));
        rep.on("end", () => {
          const texte = Buffer.concat(morceaux).toString("utf8");
          let donnees;
          try {
            donnees = JSON.parse(texte);
          } catch {
            donnees = texte;
          }
          fini({ statut: rep.statusCode ?? 0, donnees });
        });
        rep.on("error", echoue);
      },
    );
    req.setTimeout(delai, () => req.destroy(new Error(`pas de réponse du campus après ${Math.round(delai / 1000)} s`)));
    req.on("error", echoue);
    if (charge) req.write(charge);
    req.end();
  });
}

/**
 * Lance un tour : jusqu'à 10 minutes d'attente ; un tour déjà en cours (409) ou une coupure du réseau est
 * réessayé 5 fois, toutes les 30 secondes (le tour précédent finit son travail côté campus).
 */
async function lancerTour() {
  for (let essai = 1; ; essai++) {
    let t;
    try {
      t = await appel("POST", "/api/travaux-ia/tour", undefined, 10 * MINUTE);
    } catch (e) {
      t = { statut: 0, donnees: { message: e.message } };
    }
    const enCours = t.statut === 409 && t.donnees?.details?.code === "tour_en_cours";
    if (t.statut === 200 || essai > 5 || !(enCours || t.statut === 0 || t.statut >= 502)) return t;
    console.log(`  … ${enCours ? "un tour est déjà en cours" : `campus injoignable (${t.donnees?.message ?? t.statut})`} : nouvel essai dans 30 s (${essai}/5).`);
    await attendre(30_000);
  }
}

const EXTENSIONS_IMAGE = { "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/**
 * Une demande en fichiers lisibles : les consignes et les messages en Markdown, les images et les PDF (blocs
 * « document ») à part, le schéma. Un bloc d'un autre type n'est jamais perdu en silence : il est signalé.
 */
function ecrireDemande(d) {
  const dir = path.join(DOSSIER, String(d.id));
  // Un nouveau tour réécrit la demande sans effacer une réponse déjà écrite (reponse.json) mais pas encore envoyée.
  for (const sous of ["images", "documents"]) fs.rmSync(path.join(dir, sous), { recursive: true, force: true });
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
  let docs = 0;
  let perdus = 0;
  for (const m of r.messages ?? []) {
    lignes.push("", `## Message (${m.role === "assistant" ? "assistant" : "utilisateur"})`, "");
    const blocs = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content ?? [];
    for (const b of blocs) {
      if (b.type === "text") lignes.push(b.text);
      else if (b.type === "image" && b.source?.type === "base64") {
        n += 1;
        const fichier = `images/${String(n).padStart(3, "0")}.${EXTENSIONS_IMAGE[b.source.media_type] ?? "jpg"}`;
        fs.writeFileSync(path.join(dir, fichier), Buffer.from(b.source.data, "base64"));
        lignes.push(`[Image ${n} : ${fichier}]`);
      } else if (b.type === "document" && b.source?.type === "base64") {
        docs += 1;
        fs.mkdirSync(path.join(dir, "documents"), { recursive: true });
        const fichier = `documents/${String(docs).padStart(3, "0")}.pdf`;
        fs.writeFileSync(path.join(dir, fichier), Buffer.from(b.source.data, "base64"));
        lignes.push(`[Document ${docs} (PDF) : ${fichier} — à lire en entier avec l'outil de lecture]`);
      } else {
        perdus += 1;
        lignes.push(`[Bloc « ${b.type} » non transcrit : le signaler dans le compte rendu, ne pas répondre à cette demande]`);
      }
    }
  }
  fs.writeFileSync(path.join(dir, "consignes.md"), lignes.filter((l) => l !== null).join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "schema.json"), JSON.stringify(r.schema, null, 2) + "\n");
  return { dir, images: n, documents: docs, perdus };
}

/** Libellé d'une issue : les copies (« copie:<id> ») ont leurs propres mots. */
function libelle(travail, issue) {
  if (travail.startsWith("copie:")) {
    return { prete: "note publiée, étudiant prévenu", soir: "en attente de réponse", rien: "rien à publier (à revoir par le formateur, ou plus rien à faire)", erreur: "échec, réessayée au prochain tour" }[issue] ?? issue;
  }
  return issue === "prete" ? "prêt, étudiants prévenus" : issue === "soir" ? "en attente de réponses" : issue;
}

const [commande, arg] = process.argv.slice(2);

if (commande === "tour") {
  let precedent = Infinity;
  let t;
  for (let relance = 0; ; relance++) {
    t = await lancerTour();
    if (t.statut !== 200) {
      console.error(`✗ Tour refusé (${t.statut}) :`, typeof t.donnees === "string" ? t.donnees.slice(0, 300) : t.donnees.message ?? t.donnees);
      process.exit(1);
    }
    // Les copies peuvent être des centaines : un décompte par issue, puis le détail des autres travaux.
    const copies = t.donnees.bilan.filter((b) => b.travail.startsWith("copie:"));
    for (const b of t.donnees.bilan) if (!b.travail.startsWith("copie:")) console.log(`  ${b.travail} : ${libelle(b.travail, b.issue)}`);
    if (copies.length) {
      const parIssue = {};
      for (const b of copies) (parIssue[b.issue] ??= []).push(b.travail.slice("copie:".length));
      console.log(`  Copies (${copies.length}) :`);
      for (const [issue, ids] of Object.entries(parIssue)) console.log(`    ${ids.length} ${libelle("copie:", issue)}${issue === "erreur" ? ` (copies ${ids.join(", ")})` : ""}`);
    }
    const aSuivre = Number(t.donnees.aSuivre ?? 0);
    if (aSuivre) console.log(`  ${aSuivre} copie(s) encore à préparer (tours suivants).`);
    if (t.donnees.demandes.length) break;
    if (!aSuivre) {
      console.log("✓ Aucune demande en attente et plus aucune copie à préparer : le travail du soir est fini.");
      process.exit(0);
    }
    // Rien à répondre mais des copies restent à préparer (copies « à revoir », budget du tour épuisé) : nouveau
    // tour tout de suite, tant que le nombre baisse.
    if (aSuivre >= precedent || relance >= 30) {
      console.error(`✗ ${aSuivre} copie(s) restent à préparer mais le tour n'avance plus : le dire dans le compte rendu.`);
      process.exit(1);
    }
    precedent = aSuivre;
    console.log("  Aucune demande à traiter : nouveau tour.");
  }
  const demandes = t.donnees.demandes;
  fs.mkdirSync(DOSSIER, { recursive: true });
  console.log(`${demandes.length} demande(s) à traiter${t.donnees.aSuivre ? " (puis relancer le tour)" : ""} :`);
  for (const resume of demandes) {
    const d = await appel("GET", `/api/travaux-ia/demandes/${resume.id}`);
    if (d.statut !== 200) {
      console.error(`  ✗ demande ${resume.id} illisible (${d.statut})`);
      continue;
    }
    const { dir, images, documents, perdus } = ecrireDemande(d.donnees);
    console.log(
      `  ${resume.id} · ${resume.origine} · ${Math.round(resume.taille / 1000)} ko${images ? ` · ${images} image(s)` : ""}${documents ? ` · ${documents} PDF` : ""}${perdus ? ` · ⚠ ${perdus} bloc(s) non transcrit(s)` : ""} → ${path.relative(process.cwd(), dir)}`,
    );
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
