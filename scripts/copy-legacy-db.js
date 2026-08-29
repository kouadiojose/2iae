#!/usr/bin/env node
/**
 * Copie du contenu d'une ancienne base PostgreSQL vers la base du site.
 *
 * Écrit pour rapatrier les données restées sur DigitalOcean après la
 * migration vers Railway (audit du 2026-08-29 : 382 lignes manquantes,
 * dont 63 contacts, 299 messages de chat, 8 actualités et 8 bannières).
 * La vraie base vivait dans `groupe2iae-db` sur le cluster DO — pas dans
 * `defaultdb`, la base de l'URL de connexion par défaut : le script
 * énumère donc les bases du cluster source et retient celle qui contient
 * le plus de contenu.
 *
 * Sans danger pour la base cible : insertion uniquement (`ON CONFLICT (id)
 * DO NOTHING`), jamais de mise à jour ni de suppression — le contenu ajouté
 * depuis la migration est laissé intact. Rejouable à volonté.
 *
 * ⚠️ Les ports PostgreSQL sont bloqués depuis certains environnements
 * (sandbox Claude Code notamment). Le plus simple est d'exécuter ce script
 * depuis le réseau Railway : un service temporaire, ou `railway ssh`.
 *
 * Usage :
 *   SOURCE_DATABASE_URL="postgresql://doadmin:...@....db.ondigitalocean.com:25060/defaultdb" \
 *   TARGET_DATABASE_URL="postgresql://postgres:...@postgres.railway.internal:5432/railway" \
 *   node scripts/copy-legacy-db.js [--audit-only] [--diff] [--sync]
 *
 * --diff : liste aussi les lignes présentes des deux côtés dont les champs
 *          diffèrent (une ligne copiée jadis puis modifiée sur la source
 *          n'est pas rattrapée par l'insertion seule).
 * --sync : applique la version source de ces lignes, mais UNIQUEMENT quand
 *          son updated_at est plus récent — une ligne retravaillée sur le
 *          site cible depuis la migration n'est jamais écrasée. C'est ce
 *          mode qui a restitué le 2026-08-29 les vraies photos des filières,
 *          les téléphones, comptes bancaires et adresses des tarifs, et la
 *          photo du fondateur, mis à jour sur l'ancien site après les exports.
 */
import pg from "pg";
const { Client } = pg;

const AUDIT_ONLY = process.argv.includes("--audit-only");
const DIFF = process.argv.includes("--diff") || process.argv.includes("--sync");
const SYNC = process.argv.includes("--sync");
// sslmode retiré de l'URL : il primerait sur l'option ssl passée au client
// (DigitalOcean utilise un CA auto-signé -> rejectUnauthorized: false requis).
const SRC_URL = (process.env.SOURCE_DATABASE_URL || "").replace(/[?&]sslmode=[^&]+/, "");
const TGT_URL = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

const SKIP = new Set(["session", "_migrations"]);
// Ordre respectant les clés étrangères (admin_users avant les tables qui le
// référencent, news avant news_images, albums avant gallery_items).
const ORDER = [
  "admin_users", "users", "site_content", "sliders", "founder_message",
  "institutes", "programs", "news", "news_images", "projects", "tariffs",
  "albums", "gallery_items", "facebook_posts", "image_analyses",
  "contacts", "chat_messages",
];

function log(...a) { console.log(new Date().toISOString(), ...a); }

async function connect(name, url, ssl) {
  const c = new Client({ connectionString: url, ssl, connectionTimeoutMillis: 20000, statement_timeout: 300000 });
  await c.connect();
  log(`[${name}] connecté`);
  return c;
}

async function tables(c) {
  const { rows } = await c.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
  return rows.map(r => r.table_name);
}

async function columns(c, t) {
  const { rows } = await c.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
  return rows.map(r => r.column_name);
}

async function count(c, t) {
  const { rows } = await c.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
  return rows[0].n;
}

async function audit(src, tgt) {
  const [st, tt] = [await tables(src), await tables(tgt)];
  const all = [...new Set([...st, ...tt])].sort();
  log("=== AUDIT ===");
  console.log("TABLE".padEnd(20), "SOURCE".padStart(7), "CIBLE".padStart(9), "MANQUANTES".padStart(11));
  for (const t of all) {
    if (SKIP.has(t)) continue;
    const inS = st.includes(t), inT = tt.includes(t);
    const ns = inS ? await count(src, t) : "-";
    const nt = inT ? await count(tgt, t) : "-";
    let missing = "-";
    if (inS && inT) {
      const cs = await columns(src, t);
      if (cs.includes("id")) {
        const { rows } = await src.query(`SELECT id FROM "${t}"`);
        if (rows.length) {
          const ids = rows.map(r => r.id);
          const { rows: found } = await tgt.query(`SELECT id FROM "${t}" WHERE id = ANY($1)`, [ids]);
          missing = ids.length - found.length;
        } else missing = 0;
      }
    } else if (inS && !inT) missing = "TABLE ABSENTE DANS LA CIBLE";
    console.log(t.padEnd(20), String(ns).padStart(7), String(nt).padStart(9), String(missing).padStart(11));
  }
  log("=== FIN AUDIT ===");
}

async function copyTable(src, tgt, t) {
  const cs = await columns(src, t), ct = await columns(tgt, t);
  if (!ct.length) { log(`[copy] ${t}: absente dans la cible — IGNORÉE (créer le schéma d'abord)`); return; }
  const cols = cs.filter(c => ct.includes(c));
  if (!cols.includes("id")) { log(`[copy] ${t}: pas de colonne id — ignorée`); return; }
  // Colonnes json/jsonb : sérialisation explicite obligatoire — node-pg
  // transforme les tableaux JS en littéraux Postgres {…}, invalides en JSON.
  const { rows: typed } = await tgt.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`, [t]);
  const jsonCols = new Set(typed.filter(r => r.data_type === "json" || r.data_type === "jsonb").map(r => r.column_name));
  const coerce = (c, v) => {
    if (!jsonCols.has(c) || v === null || v === undefined) return v;
    if (typeof v === "string") {
      try { JSON.parse(v); return v; } catch { return JSON.stringify(v); }
    }
    return JSON.stringify(v);
  };
  const { rows } = await src.query(`SELECT ${cols.map(c => `"${c}"`).join(",")} FROM "${t}"`);
  if (!rows.length) { log(`[copy] ${t}: source vide`); return; }
  let inserted = 0, failed = 0;
  for (const row of rows) {
    const vals = cols.map(c => coerce(c, row[c]));
    const ph = cols.map((_, i) => `$${i + 1}`).join(",");
    const sql = `INSERT INTO "${t}" (${cols.map(c => `"${c}"`).join(",")}) VALUES (${ph}) ON CONFLICT (id) DO NOTHING`;
    try {
      const r = await tgt.query(sql, vals);
      inserted += r.rowCount;
    } catch (e) {
      // created_by / updated_by orphelins (l'admin d'origine n'existe pas
      // dans la cible) : réessai avec NULL plutôt que perdre la ligne.
      const fkCols = ["created_by", "updated_by"].filter(c => cols.includes(c) && row[c]);
      if (fkCols.length) {
        try {
          const vals2 = cols.map(c => (fkCols.includes(c) ? null : coerce(c, row[c])));
          const r2 = await tgt.query(sql, vals2);
          inserted += r2.rowCount;
          continue;
        } catch (e2) { e = e2; }
      }
      failed++;
      log(`[copy] ${t} id=${row.id}: ÉCHEC — ${e.message}`);
    }
  }
  log(`[copy] ${t}: ${rows.length} lues, ${inserted} insérées, ${failed} échecs, ${rows.length - inserted - failed} déjà présentes`);
}

// Compare les lignes communes (même id) et montre les champs qui diffèrent.
// En mode sync, applique la version source quand elle est plus récente.
const IGNORE_DIFF = new Set(["created_at", "updated_at", "created_by", "updated_by"]);
async function diffTable(src, tgt, t, apply) {
  const cs = await columns(src, t), ct = await columns(tgt, t);
  const cols = cs.filter(c => ct.includes(c));
  if (!cols.includes("id")) return;
  const { rows: typed } = await tgt.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`, [t]);
  const jsonCols = new Set(typed.filter(r => r.data_type === "json" || r.data_type === "jsonb").map(r => r.column_name));
  const sel = cols.map(c => `"${c}"`).join(",");
  const { rows: srows } = await src.query(`SELECT ${sel} FROM "${t}"`);
  if (!srows.length) return;
  const { rows: trows } = await tgt.query(`SELECT ${sel} FROM "${t}" WHERE id = ANY($1)`, [srows.map(r => r.id)]);
  const tmap = new Map(trows.map(r => [r.id, r]));
  const norm = v => v instanceof Date ? v.toISOString() : (v !== null && typeof v === "object" ? JSON.stringify(v) : v);
  for (const s of srows) {
    const w = tmap.get(s.id);
    if (!w) continue;
    const diffs = cols.filter(c => !IGNORE_DIFF.has(c) && String(norm(s[c])) !== String(norm(w[c])));
    if (!diffs.length) continue;
    const su = s.updated_at ? new Date(s.updated_at) : null;
    const tu = w.updated_at ? new Date(w.updated_at) : null;
    const srcPlusRecent = su && tu ? su > tu : true;
    const nom = (s.name || s.title || s.key || s.site || "").toString().slice(0, 40);
    log(`[diff] ${t} "${nom}" (${s.id.slice(0, 8)}): champs ≠ ${diffs.join(", ")} — source ${srcPlusRecent ? "PLUS récente" : "plus ancienne"}`);
    for (const c of diffs.slice(0, 6)) {
      const show = v => String(norm(v) ?? "NULL").replace(/\s+/g, " ").slice(0, 90);
      log(`        ${c}: source="${show(s[c])}" | cible="${show(w[c])}"`);
    }
    if (apply && srcPlusRecent) {
      const sets = diffs.map((c, i) => `"${c}"=$${i + 2}`).join(", ");
      const vals = diffs.map(c => {
        const v = s[c];
        if (!jsonCols.has(c) || v === null) return v;
        return typeof v === "string" ? v : JSON.stringify(v);
      });
      await tgt.query(`UPDATE "${t}" SET ${sets}, updated_at=$${diffs.length + 2} WHERE id=$1`,
        [s.id, ...vals, s.updated_at || new Date()]);
      log(`        -> mis à jour depuis la source`);
    }
  }
}

async function main() {
  if (!SRC_URL || !TGT_URL) throw new Error("SOURCE_DATABASE_URL et TARGET_DATABASE_URL (ou DATABASE_URL) requises");
  let tgt = await connect("cible", TGT_URL, /railway\.internal|localhost|127\.0\.0\.1/.test(TGT_URL) ? false : { rejectUnauthorized: false });
  let src = await connect("source", SRC_URL, { rejectUnauthorized: false });

  // Le cluster source peut contenir plusieurs bases : retenir celle qui a du contenu.
  const { rows: dbs } = await src.query(
    `SELECT datname FROM pg_database WHERE NOT datistemplate AND datname NOT IN ('_dodb') ORDER BY datname`);
  log(`Bases sur le cluster source : ${dbs.map(d => d.datname).join(", ")}`);
  let best = null, bestCount = -1;
  for (const { datname } of dbs) {
    let c;
    try {
      c = await connect(`source:${datname}`, SRC_URL.replace(/\/[^/?]+(\?|$)/, `/${datname}$1`), { rejectUnauthorized: false });
      const ts = await tables(c);
      let total = 0;
      for (const t of ts) if (!SKIP.has(t)) total += await count(c, t);
      log(`  base "${datname}" : ${ts.length} tables, ${total} lignes de contenu`);
      if (ts.length > 0 && total > bestCount) {
        if (best) await best.end();
        best = c; bestCount = total;
        continue;
      }
      await c.end();
    } catch (e) {
      log(`  base "${datname}" : inaccessible (${e.message})`);
      if (c) try { await c.end(); } catch {}
    }
  }
  if (best) { await src.end(); src = best; }

  await audit(src, tgt);

  if (DIFF) {
    log(`=== DIFF des lignes communes${SYNC ? " (application des versions source plus récentes)" : ""} ===`);
    const st = await tables(src);
    const CONTENT = ["site_content", "sliders", "founder_message", "institutes",
      "programs", "news", "news_images", "projects", "tariffs", "albums", "gallery_items"];
    for (const t of CONTENT) if (st.includes(t)) await diffTable(src, tgt, t, SYNC);
    log("=== FIN DIFF ===");
  }

  if (!AUDIT_ONLY && !DIFF) {
    log("=== COPIE ===");
    const st = await tables(src);
    for (const t of ORDER) if (st.includes(t) && !SKIP.has(t)) await copyTable(src, tgt, t);
    for (const t of st) if (!ORDER.includes(t) && !SKIP.has(t)) await copyTable(src, tgt, t);
    log("=== FIN COPIE — nouvel audit ===");
    await audit(src, tgt);
  }

  await src.end(); await tgt.end();
  log("Terminé.");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
