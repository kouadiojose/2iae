#!/usr/bin/env node
// Fabrique les PDF des guides (A4) à partir des pages HTML de ce dossier.
//   node guides/fabriquer.mjs [nom…]        (sans nom : tous les guides)
// Sortie : client/public/guides/<nom>.pdf (servis par le campus), et des
// aperçus PNG de chaque page dans guides/apercus/ (relecture).
// Playwright : PLAYWRIGHT=/chemin/vers/playwright/index.mjs (sinon /opt/pwtest).
import fs from "node:fs";
import path from "node:path";

const ICI = path.dirname(new URL(import.meta.url).pathname);
const SORTIE = path.join(ICI, "..", "client", "public", "guides");
const APERCUS = path.join(ICI, "apercus");
const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/pwtest/node_modules/playwright/index.mjs");
const executable = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

const demandes = process.argv.slice(2);
const guides = (demandes.length ? demandes : fs.readdirSync(ICI).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, "")));
fs.mkdirSync(SORTIE, { recursive: true });
fs.mkdirSync(APERCUS, { recursive: true });

const nav = await chromium.launch({ ...(executable ? { executablePath: executable } : {}) });
for (const nom of guides) {
  const page = await nav.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  await page.goto(`file://${path.join(ICI, `${nom}.html`)}`, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  const manquantes = await page.$$eval("img", (l) => l.filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")));
  if (manquantes.length) console.warn(`  ⚠ ${nom} : images introuvables : ${manquantes.join(", ")}`);
  const pdf = path.join(SORTIE, `${nom}.pdf`);
  await page.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true });
  const pages = await page.$$(".page");
  for (const [i, el] of pages.entries()) await el.screenshot({ path: path.join(APERCUS, `${nom}-${String(i + 1).padStart(2, "0")}.png`) });
  console.log(`${nom} : ${pages.length} pages · ${Math.round(fs.statSync(pdf).size / 1024)} Ko`);
  await page.close();
}
await nav.close();
