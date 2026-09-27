#!/usr/bin/env node
// Captures d'écran des guides, prises sur un campus de répétition (jamais la
// production : comptes et contenus de démonstration).
//   CAMPUS=http://localhost:5193 node guides/capturer.mjs [groupe…]
// Groupes : public, etudiant, formateur, salle, direct, nouveautes, administration (sans argument : tous).
// Sortie : guides/captures/<nom>.jpg
import fs from "node:fs";
import path from "node:path";

const ICI = path.dirname(new URL(import.meta.url).pathname);
const SORTIE = path.join(ICI, "captures");
const ORIGINE = (process.env.CAMPUS || "http://localhost:5193").replace(/\/+$/, "");
// Adresse publique affichée par le campus local (sa variable CAMPUS_PUBLIC_URL), s'il en a une autre.
const PUBLIC = (process.env.CAMPUS_PUBLIC || "https://campus.2iae.com").replace(/\/+$/, "");
const { chromium, devices } = await import(process.env.PLAYWRIGHT || "/opt/pwtest/node_modules/playwright/index.mjs");
const executable = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
fs.mkdirSync(SORTIE, { recursive: true });

// Comptes du campus de répétition, hors du dépôt : COMPTES=/chemin/comptes.json (par défaut guides/comptes.json,
// ignoré par git), au format { "etudiant": { "identifiant": "…", "motDePasse": "…" }, "formateur": …, "direction": … }.
const COMPTES = JSON.parse(fs.readFileSync(process.env.COMPTES || path.join(ICI, "comptes.json"), "utf-8"));
const TELEPHONE = { ...devices["iPhone 13"], deviceScaleFactor: 2.4, locale: "fr-FR", timezoneId: "Africa/Abidjan" };
const ORDINATEUR = { viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1.6, locale: "fr-FR", timezoneId: "Africa/Abidjan" };
// José enseigne depuis Nice : son ordinateur est à l'heure de Paris.
const ORDINATEUR_NICE = { ...ORDINATEUR, timezoneId: "Europe/Paris" };
const ECRAN_SALLE = { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2, locale: "fr-FR", timezoneId: "Africa/Abidjan" };

// CAMERAS : dossier de fausses caméras (jose.y4m, salle1.y4m … salle5.y4m) ; sans lui, la mire de Chromium.
const CAMERAS = process.env.CAMERAS || "";
async function lancer(camera) {
  const video = camera && CAMERAS ? path.join(CAMERAS, `${camera}.y4m`) : "";
  return chromium.launch({
    ...(executable ? { executablePath: executable } : {}),
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      ...(video && fs.existsSync(video) ? [`--use-file-for-fake-video-capture=${video}`] : []),
    ],
  });
}
const nav = await lancer();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const SEANCE = Number(process.env.SEANCE || 16);

async function contexte(appareil, compte, o = {}) {
  const ctx = await (o.navigateur ?? nav).newContext({ ...appareil, permissions: ["camera", "microphone"] });
  // Pas de feuille d'installation ni d'invitation aux rappels sur les captures (sauf demande).
  if (!o.installation)
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem("campus:installation-refusee", String(Date.now()));
        sessionStorage.setItem("campus:installation-proposee", "1");
      } catch {}
    });
  // Les adresses absolues du campus (CAMPUS_PUBLIC_URL=https://campus.2iae.com) sont servies par le campus local.
  if (PUBLIC && PUBLIC !== ORIGINE)
    await ctx.route((url) => url.href.startsWith(PUBLIC + "/"), async (r) => {
      r.fulfill({ response: await r.fetch({ url: ORIGINE + r.request().url().slice(PUBLIC.length) }) });
    });
  // Le campus en ligne a sa clé d'IA ; le campus de répétition non : l'IA y paraît donc branchée.
  await ctx.route("**/api/ia/etat", async (r) => {
    const reponse = await r.fetch();
    r.fulfill({ response: reponse, json: { ...(await reponse.json()), disponible: true } });
  });
  await ctx.route(/\/api\/(devoirs|evaluations|cours|seances)\/\d+(\?|$)/, async (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    const reponse = await r.fetch();
    const corps = await reponse.text();
    r.fulfill({ response: reponse, body: corps.replaceAll('"iaDisponible":false', '"iaDisponible":true') });
  });
  // Le code d'émargement porte l'adresse publique du campus (sous le QR des salles).
  if (PUBLIC && PUBLIC !== ORIGINE)
    await ctx.route("**/api/seances/*/code-salle*", (r) => r.continue({ headers: { ...r.request().headers(), "x-forwarded-host": new URL(PUBLIC).host } }));
  if (compte) {
    const r = await ctx.request.post(`${ORIGINE}/api/auth/connexion`, { data: COMPTES[compte], headers: { Origin: ORIGINE } });
    if (!r.ok()) throw new Error(`connexion ${compte} : ${r.status()}`);
  }
  return ctx;
}

async function capturer(ctx, chemin, nom, o = {}) {
  const page = await ctx.newPage();
  await page.goto(ORIGINE + chemin, { waitUntil: "load" });
  await page.waitForTimeout(o.attente ?? 3500);
  if (o.avant) await o.avant(page);
  const fichier = path.join(SORTIE, `${nom}.jpg`);
  if (o.element) await page.locator(o.element).first().screenshot({ path: fichier, type: "jpeg", quality: 82 });
  else await page.screenshot({ path: fichier, type: "jpeg", quality: 82, fullPage: Boolean(o.pleinePage), ...(o.clip ? { clip: o.clip } : {}) });
  console.log(`  ${nom}`);
  await page.close();
}

const GROUPES = {
  async public() {
    const t = await contexte(TELEPHONE);
    await capturer(t, "/", "public-accueil-tel");
    await capturer(t, "/programme", "public-programme-tel");
    await capturer(t, "/formateurs/jose-kouadio", "public-formateur-tel", { attente: 2600 });
    await capturer(t, "/connexion", "connexion-tel");
    await t.close();
    const o = await contexte(ORDINATEUR);
    await capturer(o, "/", "public-accueil");
    await capturer(o, "/programme", "public-programme");
    await capturer(o, "/cours", "public-cours");
    await capturer(o, "/formateurs", "public-formateurs");
    await capturer(o, "/formateurs/claude-trepanier", "public-showreel", { attente: 3200 });
    await capturer(o, "/le-direct", "public-le-direct");
    await capturer(o, "/campus", "public-campus");
    await o.close();
  },
};

GROUPES.salle = async () => {
  // 1. La direction prépare l'installation de l'écran de Yopougon (lien + code).
  const d = await contexte(ORDINATEUR, "direction");
  await capturer(d, "/pilotage/rentree", "direction-rentree", { attente: 4000 });
  await capturer(d, "/pilotage/classes", "direction-installer-ecran", {
    attente: 4000,
    avant: async (p) => {
      await p.getByRole("button", { name: /Installer l'écran/ }).first().click();
      await p.waitForTimeout(2500);
    },
    element: "[role=dialog]",
  });
  const r = await d.request.post(`${ORIGINE}/api/pilotage/sites/2/ecran`, { headers: { Origin: ORIGINE } });
  const installation = await r.json();
  await d.close();
  // 2. Sur l'ordinateur de la salle : l'adresse courte et le code.
  const e = await contexte(ECRAN_SALLE);
  await capturer(e, "/ecran", "salle-code-vide", { attente: 2500 });
  const page = await e.newPage();
  await page.goto(ORIGINE + "/ecran", { waitUntil: "load" });
  await page.waitForTimeout(2000);
  await page.keyboard.type(installation.code.replace(/\s/g, "").slice(0, 7), { delay: 60 });
  await page.screenshot({ path: path.join(SORTIE, "salle-code-saisi.jpg"), type: "jpeg", quality: 82 });
  await page.keyboard.type(installation.code.replace(/\s/g, "").slice(7), { delay: 60 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SORTIE, "salle-installee.jpg"), type: "jpeg", quality: 82 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(SORTIE, "salle-ecran-attente.jpg"), type: "jpeg", quality: 82 });
  console.log("  salle-code-vide, salle-code-saisi, salle-installee, salle-ecran-attente");
  await page.close();
  fs.writeFileSync(path.join(SORTIE, "etat-salle.json"), JSON.stringify(await e.storageState()));
  await e.close();
};

GROUPES.etudiant = async () => {
  const t = await contexte(TELEPHONE, "etudiant");
  await capturer(t, "/bienvenue", "etudiant-bienvenue-tel");
  await capturer(t, "/cours/6", "etudiant-cours-tel");
  await capturer(t, "/cours/6/lecons/36", "etudiant-lecon-tel");
  await capturer(t, "/devoirs/11", "etudiant-devoir-tel");
  await capturer(t, "/messages/6", "etudiant-messages-tel");
  await capturer(t, "/assistant/3", "etudiant-assistant-tel", {
    // Le fil s'ouvre en bas : on remonte pour voir la question d'Aya.
    avant: async (p) => {
      await p.getByText("Je n'ai pas bien compris", { exact: false }).first().evaluate((e) => e.scrollIntoView({ block: "start" }));
      await p.evaluate(() => window.scrollBy(0, -80));
      await p.waitForTimeout(500);
    },
  });
  await capturer(t, "/emploi-du-temps", "etudiant-edt-tel");
  await t.close();
  // La feuille « Installer l'application » telle que la voit un iPhone (Safari).
  const i = await contexte(TELEPHONE, "etudiant", { installation: true });
  await capturer(i, "/accueil", "etudiant-installation-tel", { attente: 6000 });
  await i.close();
};

GROUPES.formateur = async () => {
  const o = await contexte(ORDINATEUR_NICE, "formateur");
  await capturer(o, "/enseigner", "formateur-enseigner", { attente: 4500 });
  await capturer(o, "/enseigner/seances/16", "formateur-preparation", { attente: 4500 });
  await capturer(o, "/enseigner/cours/6", "formateur-cours", {
    attente: 4500,
    avant: async (p) => {
      await p.getByRole("link", { name: "Programme", exact: true }).first().click();
      await p.waitForTimeout(1200);
    },
  });
  await capturer(o, "/enseigner/devoirs/11", "formateur-devoir", { attente: 4500 });
  await capturer(o, "/enseigner/devoirs/11/copies?etudiant=63", "formateur-copies", { attente: 5000 });
  await capturer(o, "/enseigner/devoirs/12", "formateur-quiz", {
    attente: 4500,
    // Les questions de l'interrogation, plus bas dans la page.
    avant: (p) =>
      p.evaluate(() => {
        const titre = [...document.querySelectorAll("h2, h3")].find((e) => /question/i.test(e.textContent ?? ""));
        if (titre) {
          titre.scrollIntoView({ block: "start" });
          window.scrollBy(0, -90);
        }
      }),
  });
  await o.close();
};

// Un cours en direct : cinq salles connectées (chacune sa caméra), José dans le Studio, Aya au téléphone.
// À lancer quand la séance SEANCE commence dans moins d'une heure (le code d'émargement s'affiche alors).
GROUPES.direct = async () => {
  const photo = (page, nom) => page.screenshot({ path: path.join(SORTIE, `${nom}.jpg`), type: "jpeg", quality: 84 }).then(() => console.log(`  ${nom}`));
  const d = await contexte(ORDINATEUR, "direction");
  const salles = [];
  for (const [i, site] of [2, 1, 3, 4, 5].entries()) {
    const inst = await (await d.request.post(`${ORIGINE}/api/pilotage/sites/${site}/ecran`, { headers: { Origin: ORIGINE } })).json();
    const b = await lancer(`salle${i + 1}`);
    const ctx = await contexte(ECRAN_SALLE, null, { navigateur: b });
    const r = await ctx.request.post(`${ORIGINE}/api/ecran/installer`, { data: { code: inst.code }, headers: { Origin: ORIGINE } });
    if (!r.ok()) throw new Error(`installation de l'écran du site ${site} : ${r.status()}`);
    const page = await ctx.newPage();
    await page.goto(ORIGINE + "/salle", { waitUntil: "load" });
    salles.push({ b, ctx, page, site });
  }
  await d.close();
  await pause(6000);
  const yop = salles[0];
  await photo(yop.page, "salle-avant-cours");

  // Aya, avant le cours : l'accueil puis l'émargement (le QR de sa salle mène à /emargement/<code>).
  const t = await contexte(TELEPHONE, "etudiant");
  await capturer(t, "/accueil", "etudiant-accueil-tel");
  const code = await (await yop.ctx.request.get(`${ORIGINE}/api/seances/${SEANCE}/code-salle?site=${yop.site}`)).json();
  await capturer(t, new URL(code.url).pathname, "etudiant-emargement-tel", { attente: 3000 });

  // Les responsables de salle comptent leurs étudiants et déclarent leur salle prête (trois d'abord).
  const effectif = (x, i, prete) =>
    x.ctx.request.put(`${ORIGINE}/api/seances/${SEANCE}/effectifs/${x.site}`, {
      data: { nombre: [24, 31, 18, 27, 22][i], prete },
      headers: { Origin: ORIGINE },
    });
  for (const [i, x] of salles.entries()) await effectif(x, i, i < 3);

  // José ouvre le Studio et démarre le direct.
  const bj = await lancer("jose");
  const f = await contexte(ORDINATEUR_NICE, "formateur", { navigateur: bj });
  const studio = await f.newPage();
  await studio.goto(`${ORIGINE}/live/${SEANCE}`, { waitUntil: "load" });
  await pause(5000);
  await photo(studio, "formateur-coulisses");
  for (const [i, x] of salles.entries()) if (i >= 3) await effectif(x, i, true);
  await studio.getByRole("button", { name: "Démarrer le direct" }).click();
  await pause(15000);
  // Riviera lève la main : le Studio la montre dans « Mains ».
  await salles[1].page
    .getByRole("button", { name: /Lever la main de la salle/ })
    .click({ timeout: 8000 })
    .catch(async (e) => {
      await photo(salles[1].page, "_riviera");
      console.log("  (main de Riviera non levée)", e.message.split("\n")[0]);
    });
  await t.request.post(`${ORIGINE}/api/seances/${SEANCE}/questions`, {
    data: { texte: "Est-ce que l'IA peut remplacer le comptable d'une petite entreprise ?" },
    headers: { Origin: ORIGINE },
  });
  await salles[3].ctx.request.post(`${ORIGINE}/api/seances/${SEANCE}/questions`, {
    data: { texte: "Quelle différence entre l'IA et un simple logiciel de gestion ?" },
    headers: { Origin: ORIGINE },
  });
  await t.request.post(`${ORIGINE}/api/seances/${SEANCE}/ressentis`, { data: { ressenti: "compris" }, headers: { Origin: ORIGINE } });
  await pause(2500);
  await photo(studio, "formateur-studio");
  // Le panneau de droite : les questions, puis les campus et le baromètre.
  const panneau = studio.locator("aside").filter({ hasText: "Sondages" }).first();
  for (const [onglet, nom] of [["Questions", "formateur-questions"], ["Campus", "formateur-campus"]]) {
    await panneau.getByRole("button", { name: new RegExp(`^${onglet}`) }).or(panneau.getByRole("tab", { name: new RegExp(`^${onglet}`) })).first().click();
    await pause(1500);
    // Capture par zone, page en haut : la barre du campus, collée en haut, ne recouvre pas le panneau.
    await studio.evaluate(() => window.scrollTo(0, 0));
    const b = await panneau.boundingBox();
    await studio.screenshot({ path: path.join(SORTIE, `${nom}.jpg`), type: "jpeg", quality: 86, clip: { x: b.x, y: b.y, width: b.width, height: Math.min(b.height, 800 - b.y) } });
    console.log(`  ${nom}`);
  }
  await panneau.getByRole("button", { name: /^Mains/ }).or(panneau.getByRole("tab", { name: /^Mains/ })).first().click();
  await pause(800);
  await photo(yop.page, "salle-pendant-cours");
  await capturer(t, `/live/${SEANCE}`, "etudiant-live-tel", { attente: 6000 });
  await studio.keyboard.press("3");
  await pause(4000);
  await photo(studio, "formateur-studio-cameras");
  await photo(yop.page, "salle-cameras");
  await studio.keyboard.press("1");
  await pause(1500);

  // La fenêtre présentateur, ouverte à part sur un second écran.
  const fen = await f.newPage();
  await fen.setViewportSize({ width: 1280, height: 760 });
  await fen.goto(`${ORIGINE}/live/${SEANCE}/presentateur`, { waitUntil: "load" });
  await pause(5000);
  await photo(fen, "formateur-fenetre");
  await fen.close();

  // Participer : Aya, émargée, suit depuis sa salle ; le formateur lance le sondage préparé.
  const api = (chemin, data) => f.request.post(`${ORIGINE}/api/seances/${SEANCE}${chemin}`, { data: data ?? {}, headers: { Origin: ORIGINE } });
  const aya = await t.newPage();
  await aya.goto(`${ORIGINE}/live/${SEANCE}`, { waitUntil: "load" });
  await pause(4000);
  await aya.getByRole("button", { name: /^(Suivre depuis la salle|Entrer dans la classe)/ }).first().click({ timeout: 8000 }).catch(() => console.log("  (choix du mode non trouvé)"));
  await pause(4000);
  const sondages = await (await f.request.get(`${ORIGINE}/api/seances/${SEANCE}/sondages`)).json();
  const sondage = sondages.find((x) => !x.ouvertLe) ?? sondages[0];
  if (sondage) await api(`/sondages/${sondage.id}/ouvrir`);
  await pause(3500);
  await aya.mouse.move(5, 5);
  await photo(aya, "etudiant-participer-tel");
  if (sondage) {
    await aya.getByRole("button", { name: sondage.options[1] }).first().click().catch(() => {});
    await pause(2500);
    await photo(aya, "etudiant-sondage-repondu-tel");
    await api(`/sondages/${sondage.id}/fermer`);
  }
  await aya.close();

  // Fin du cours, puis le bilan de la séance.
  await api("/terminer");
  await pause(3000);
  await capturer(f, `/enseigner/seances/${SEANCE}`, "formateur-bilan", {
    attente: 4000,
    avant: async (p) => {
      await p.getByRole("tab", { name: "Bilan" }).or(p.getByRole("button", { name: "Bilan", exact: true })).first().click();
      await pause(3000);
    },
    // Le haut du bilan : présents, questions, sondages (la démo n'a qu'une étudiante inscrite).
    clip: { x: 0, y: 0, width: ORDINATEUR.viewport.width, height: 470 },
  });

  await t.close();
  await f.close();
  await bj.close();
  for (const x of salles) await x.b.close();
};

// Nouveautés du direct : discussion (privé, emojis, épingle), groupes de travail, vue d'observation.
// À lancer quand la séance SEANCE est à venir (elle est démarrée puis remise à venir à la fin).
GROUPES.nouveautes = async () => {
  const photo = (page, nom, o = {}) => page.screenshot({ path: path.join(SORTIE, `${nom}.jpg`), type: "jpeg", quality: 84, ...o }).then(() => console.log(`  ${nom}`));
  const zone = async (page, loc, nom) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const b = await loc.boundingBox();
    const vue = page.viewportSize();
    await photo(page, nom, { clip: { x: b.x, y: Math.max(0, b.y), width: b.width, height: Math.min(b.height, vue.height - Math.max(0, b.y)) } });
  };
  const H = { headers: { Origin: ORIGINE } };
  const d = await contexte(ORDINATEUR, "direction");
  const inst = await (await d.request.post(`${ORIGINE}/api/pilotage/sites/2/ecran`, H)).json();
  const bs = await lancer("salle1");
  const sc = await contexte(ECRAN_SALLE, null, { navigateur: bs });
  if (!(await sc.request.post(`${ORIGINE}/api/ecran/installer`, { data: { code: inst.code }, ...H })).ok()) throw new Error("installation de l'écran");
  const bj = await lancer("jose");
  const f = await contexte(ORDINATEUR_NICE, "formateur", { navigateur: bj });
  const studio = await f.newPage();
  await studio.goto(`${ORIGINE}/live/${SEANCE}`, { waitUntil: "load" });
  await pause(4000);
  await studio.getByRole("button", { name: "Démarrer le direct" }).click();
  await pause(3000);
  const salle = await sc.newPage();
  await salle.goto(`${ORIGINE}/salle`, { waitUntil: "load" });
  const entrer = async (ctx) => {
    const p = await ctx.newPage();
    await p.goto(`${ORIGINE}/live/${SEANCE}`, { waitUntil: "load" });
    await pause(3000);
    await p.getByRole("radio", { name: /^Son \+ diapos/ }).click();
    await p.getByRole("button", { name: /Entrer dans la classe/ }).click();
    await pause(2500);
    return p;
  };
  const a = await contexte(TELEPHONE, "etudiant");
  const k = await contexte({ ...ORDINATEUR, viewport: { width: 1100, height: 760 } }, "etudiant2");
  const m = await contexte(TELEPHONE, "etudiant3");
  const aya = await entrer(a), koffi = await entrer(k), mariam = await entrer(m);

  // L'écran de la salle en « Présentation seule » (commandes visibles au mouvement de la souris).
  await salle.getByRole("button", { name: /Présentation seule/ }).click();
  await pause(2500);
  await salle.mouse.move(800, 420);
  await pause(600);
  await photo(salle, "salle-presentation");
  await salle.mouse.move(700, 380);
  await salle.getByRole("button", { name: /Quitter la présentation/ }).click();
  await pause(1500);

  // Discussion : Aya écrit en privé, José répond ; message épinglé, réactions, emoji.
  await aya.getByRole("tab", { name: /Discussion/ }).click();
  await pause(800);
  await aya.getByRole("radio", { name: /Au formateur/ }).click();
  await aya.getByLabel("Message privé").fill("Monsieur, le son coupe un peu chez moi à Yopougon. Vous pouvez répéter la définition ?");
  await aya.keyboard.press("Enter");
  await pause(1200);
  const panneau = studio.locator("aside").filter({ hasText: "Sondages" }).first();
  await panneau.getByRole("tab", { name: /^Discussion/ }).click();
  await pause(1000);
  await studio.getByLabel("Message à la classe").fill("Bienvenue à tous ! Le support du jour est dans le cours. Réagissez si vous m'entendez bien 👋");
  await studio.keyboard.press("Enter");
  await pause(1500);
  const liste = await (await f.request.get(`${ORIGINE}/api/seances/${SEANCE}/chat`)).json();
  const accueil = liste.find((x) => x.role === "formateur" && !x.destinataireId);
  for (const [ctx, emoji] of [[k, "👍"], [a, "👍"], [m, "❤️"]]) {
    await ctx.request.post(`${ORIGINE}/api/seances/${SEANCE}/chat/${accueil.id}/reactions`, { data: { emoji }, ...H });
    await pause(400);
  }
  await f.request.post(`${ORIGINE}/api/seances/${SEANCE}/chat/${accueil.id}/epingle`, { data: { epingle: true }, ...H });
  await k.request.post(`${ORIGINE}/api/seances/${SEANCE}/chat`, { data: { texte: "Très bien reçu depuis Riviera 🔥" }, ...H });
  await pause(800);
  await studio.locator("[data-message]").filter({ hasText: "le son coupe" }).first().hover();
  await studio.getByRole("button", { name: "Répondre en privé" }).first().click();
  await studio.getByLabel("Message privé").fill("Bien sûr Aya : je la reprends dans une minute. Si le son coupe encore, rechargez la page.");
  await studio.keyboard.press("Enter");
  await pause(1800);
  await zone(studio, panneau, "formateur-discussion");
  await aya.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pause(600);
  await photo(aya, "etudiant-discussion-tel");
  await salle.getByRole("button", { name: /Discussion/ }).click();
  await pause(1500);
  await photo(salle, "salle-discussion");
  await salle.getByRole("button", { name: "Fermer la discussion" }).click();

  // Groupes de travail : composer, suivre, visiter.
  await studio.getByRole("button", { name: "Groupes", exact: true }).click();
  await pause(2500);
  await studio.getByLabel("Nombre de groupes").fill("2");
  await studio.getByLabel("Consigne").fill("En 10 minutes : trouvez trois usages de l'IA dans votre futur métier, et choisissez un porte-parole.");
  await studio.getByLabel("Durée").selectOption("10");
  await pause(600);
  await studio.locator("[role=dialog]").screenshot({ path: path.join(SORTIE, "formateur-groupes-composer.jpg"), type: "jpeg", quality: 84 });
  console.log("  formateur-groupes-composer");
  await studio.getByRole("button", { name: "Ouvrir les groupes" }).click();
  await pause(3500);
  await aya.getByLabel("Message au groupe").fill("Moi je propose : l'IA pour préparer les bilans comptables 📊");
  await aya.keyboard.press("Enter");
  await pause(1000);
  await aya.evaluate(() => window.scrollTo(0, 0));
  await pause(500);
  await photo(aya, "etudiant-groupe-tel");
  await photo(salle, "salle-groupe");
  await photo(salle, "salle-groupe-cote", { clip: { x: 1092, y: 79, width: 483, height: 733 } });
  await aya.getByRole("button", { name: "Appeler le formateur" }).click();
  await pause(2000);
  await zone(studio, studio.locator("section[aria-label='Groupes de travail en cours']"), "formateur-groupes-suivi");
  await studio.getByRole("button", { name: "J'y vais" }).click();
  await pause(2500);
  await studio.getByLabel("Message au groupe").fill("Je suis là ! Pensez aussi aux limites de l'IA.");
  await studio.keyboard.press("Enter");
  await pause(1500);
  await photo(studio, "formateur-groupes-visite");
  await studio.getByRole("button", { name: "Revenir au studio" }).click();
  await studio.getByLabel("Message à tous les groupes").fill("Plus que 2 minutes : préparez votre porte-parole !");
  await studio.getByRole("button", { name: "Envoyer à tous les groupes" }).click();
  await pause(1200);
  await studio.getByRole("button", { name: "Rappeler la classe" }).click();
  await pause(2500);
  await aya.evaluate(() => window.scrollTo(0, 0));
  await photo(aya, "etudiant-groupe-retour-tel");

  // La direction suit le cours en vue d'observation, groupes compris.
  const obs = await d.newPage();
  await obs.goto(`${ORIGINE}/live/${SEANCE}`, { waitUntil: "load" });
  await pause(5000);
  await photo(obs, "admin-observation");
  await f.request.post(`${ORIGINE}/api/seances/${SEANCE}/groupes/fermer`, { data: { delaiSecondes: 0 }, ...H });
  await pause(2000);

  // Au choix des étudiants.
  await f.request.post(`${ORIGINE}/api/seances/${SEANCE}/groupes`, {
    data: { groupes: [{ nom: "Comptabilité", membres: [] }, { nom: "Marketing", membres: [] }, { nom: "Agriculture", membres: [] }], consigne: "Choisissez le groupe du métier qui vous intéresse.", dureeMinutes: 15, choixLibre: true },
    ...H,
  });
  await pause(2500);
  await mariam.evaluate(() => window.scrollTo(0, 0));
  await photo(mariam, "etudiant-choix-groupe-tel");
  await f.request.post(`${ORIGINE}/api/seances/${SEANCE}/groupes/fermer`, { data: { delaiSecondes: 0 }, ...H });

  await f.request.post(`${ORIGINE}/api/seances/${SEANCE}/terminer`, { data: {}, ...H });
  await pause(1500);
  const d2 = await contexte(ORDINATEUR, "direction");
  await capturer(d2, "/pilotage/presences", "admin-presences", { attente: 4000 });
  await d2.close();
  const r = await f.request.post(`${ORIGINE}/api/seances/${SEANCE}/remettre-a-venir`, { data: {}, ...H });
  console.log(`  (séance remise à venir : ${r.status()})`);
  for (const c of [a, k, m, f, sc, d]) {
    await c.unrouteAll({ behavior: "ignoreErrors" }).catch(() => undefined);
    await c.close();
  }
  await bj.close();
  await bs.close();
};

// L'équipe administrative : le lien d'inscription, la demande, la validation, le pilotage.
GROUPES.administration = async () => {
  const H = { headers: { Origin: ORIGINE } };
  const d = await contexte(ORDINATEUR, "direction");
  let e = await (await d.request.get(`${ORIGINE}/api/pilotage/equipe`)).json();
  if (!e.liens.length) e = await (await d.request.post(`${ORIGINE}/api/pilotage/equipe/liens`, { data: { joursValidite: 30 }, ...H })).json();
  const chemin = new URL(e.liens[0].url).pathname;
  const t = await contexte(TELEPHONE);
  const p = await t.newPage();
  await p.goto(ORIGINE + chemin, { waitUntil: "load" });
  await p.waitForTimeout(2500);
  await p.getByLabel("Prénom", { exact: true }).fill("Aminata");
  await p.getByLabel("Nom", { exact: true }).fill("Koné");
  await p.getByLabel("Adresse e-mail", { exact: true }).fill("aminata.kone@groupe2iae.ci");
  await p.getByLabel("Fonction", { exact: true }).fill("Directrice des études");
  await p.screenshot({ path: path.join(SORTIE, "admin-rejoindre-tel.jpg"), type: "jpeg", quality: 82 });
  await p.getByLabel("Campus", { exact: true }).selectOption({ label: "Yopougon" });
  await p.getByLabel("Mot de passe", { exact: true }).fill("Etudes-Yopougon-2026");
  await p.getByLabel("Mot de passe, encore une fois").fill("Etudes-Yopougon-2026");
  await p.getByRole("button", { name: "Envoyer ma demande" }).click();
  await p.waitForTimeout(2000);
  await p.screenshot({ path: path.join(SORTIE, "admin-demande-envoyee-tel.jpg"), type: "jpeg", quality: 82 });
  console.log("  admin-rejoindre-tel, admin-demande-envoyee-tel");
  await t.close();
  await capturer(d, "/pilotage/comptes", "admin-valider", {
    attente: 3500,
    element: "#equipe",
    // Le lien du campus de répétition ne marche pas en ligne : on n'en montre que le début.
    avant: (pg) => pg.evaluate(() => document.querySelectorAll("#equipe code").forEach((c) => (c.textContent = "https://campus.2iae.com/rejoindre/…"))),
  });
  await capturer(d, "/pilotage", "admin-tableau", { attente: 4000 });
  await capturer(d, "/pilotage/planning", "admin-planning", { attente: 4000 });
  await capturer(d, "/pilotage/suivi", "admin-suivi", { attente: 4000 });
  await capturer(d, "/pilotage/classes", "admin-classes", { attente: 4000 });
  await d.close();
};

const demandes = process.argv.slice(2);
for (const g of demandes.length ? demandes : Object.keys(GROUPES)) {
  console.log(g);
  await GROUPES[g]();
}
await nav.close();
