/*
 * Service worker du Campus numérique 2IAE — écrit à la main, sans outil.
 *
 * « Le réseau coupe, le campus continue » :
 *   - pages : réseau d'abord, sinon la coquille de l'application en cache,
 *     sinon la page /hors-ligne ;
 *   - fichiers /assets (JS, CSS à empreinte) : cache d'abord ;
 *   - GET /api/* : réseau d'abord, repli sur la dernière réponse connue
 *     (sauf le temps réel, la connexion et les rappels) ;
 *   - /api/fichiers/* : cache d'abord, taille limitée ;
 *   - rappels (push) et ouverture du bon écran au toucher ;
 *   - synchronisation « file-envoi » : prévient l'application qu'elle peut
 *     vider sa file d'envoi hors ligne.
 *
 * La version vient de l'adresse d'enregistrement (sw.js?v=<empreinte du
 * build>) : chaque mise en ligne installe un nouveau service worker, que
 * l'application propose d'activer (« Nouvelle version disponible »), sans
 * jamais forcer la mise à jour au milieu d'un live ou d'un envoi.
 */
/* eslint-env serviceworker */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_COQUILLE = `campus-coquille-${VERSION}`;
const CACHE_DONNEES = "campus-donnees-v1";
const CACHE_FICHIERS = "campus-fichiers-v1";

/** Entrées gardées au plus (les plus anciennes partent d'abord). */
const MAX_DONNEES = 150;
const MAX_FICHIERS = 60;
/** Un fichier plus lourd n'est pas gardé sur le téléphone. */
const TAILLE_MAX_FICHIER = 8 * 1024 * 1024;

const CLE_COQUILLE = "/";
const HORS_LIGNE = "/hors-ligne";
const A_PRECHARGER = [
  "/manifest.webmanifest",
  "/marque-2iae.svg",
  "/icons/icone.svg",
  "/icons/icone-192.png",
  "/icons/icone-512.png",
  "/icons/badge-96.png",
];

/** Requêtes qui ouvrent ou ferment une session : les données de la personne précédente sont oubliées (téléphones partagés). */
const CHANGE_DE_PERSONNE = /^\/api\/(auth\/(connexion|deconnexion)|activer\/|compte\/(reinitialiser|deconnecter-partout))/;
/** Jamais mis en cache : temps réel, connexion (sauf le profil courant), rappels, sonde de santé. */
const JAMAIS_EN_CACHE = /^\/api\/(flux(\/|$)|push\/|activer\/|health$|auth\/(?!moi$))/;
/** Le profil courant est gardé même « non connecté » (401) : sans réseau, les pages publiques s'ouvrent aussitôt. */
const PROFIL = "/api/auth/moi";

/**
 * Écran jamais ouvert, sans réseau : son fichier JS n'est pas sur le téléphone.
 * À la place, un petit module qui mène à /hors-ligne (plutôt qu'une page blanche).
 */
const MODULE_HORS_LIGNE = `const p = location.pathname + location.search;
if (!location.pathname.startsWith("/hors-ligne")) location.replace("/hors-ligne?page=" + encodeURIComponent(p));
export default function HorsLigne() { return null; }`;

/** Page de dernier recours, sans aucune ressource externe. */
const PAGE_SECOURS = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pas de réseau · Campus 2IAE</title><meta name="theme-color" content="#141414"></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#fff;color:#141414;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box;text-align:center">
<div style="max-width:420px"><div style="font:12px monospace;letter-spacing:.12em;text-transform:uppercase;color:#C85F22">Campus numérique 2IAE</div>
<h1 style="font-size:30px;line-height:1.1;margin:14px 0">Pas de réseau pour le moment.</h1>
<p style="font-size:17px;line-height:1.5;color:#4A423C">Cette page n'est pas encore enregistrée sur ce téléphone. Elle s'ouvrira dès que le réseau revient.</p>
<button onclick="location.reload()" style="margin-top:16px;font-size:16px;font-weight:700;border:0;border-radius:14px;padding:15px 24px;background:#E4793A;color:#141414">Réessayer</button></div></body></html>`;

// ── Installation et activation ─────────────────────────────────────────────

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_COQUILLE);
      await Promise.all(A_PRECHARGER.map((u) => cache.add(u).catch(() => undefined)));
      // La coquille (index) et les fichiers qu'elle charge : le campus s'ouvre sans réseau.
      try {
        const reponse = await fetch(CLE_COQUILLE, { cache: "no-cache", credentials: "same-origin" });
        if (reponse.ok) {
          const html = await reponse.clone().text();
          await cache.put(CLE_COQUILLE, reponse);
          await cache.put(HORS_LIGNE, new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
          const ressources = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
          await Promise.all([...new Set(ressources)].map((u) => cache.add(u).catch(() => undefined)));
        }
      } catch {
        /* pas de réseau pendant l'installation : la coquille sera gardée à la prochaine visite */
      }
      // Première installation : rien à remplacer, on s'active tout de suite.
      // Sinon on attend que la personne accepte la nouvelle version.
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(noms.filter((n) => n.startsWith("campus-coquille-") && n !== CACHE_COQUILLE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (evenement) => {
  if (evenement.data && evenement.data.type === "SKIP_WAITING") self.skipWaiting();
});

// ── Requêtes ───────────────────────────────────────────────────────────────

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  if (CHANGE_DE_PERSONNE.test(url.pathname)) {
    evenement.waitUntil(oublierDonnees());
    return;
  }
  if (requete.method !== "GET") return;

  if (requete.mode === "navigate") {
    evenement.respondWith(navigation(requete));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    evenement.respondWith(cacheDabord(requete, CACHE_COQUILLE));
    return;
  }
  if (url.pathname.startsWith("/api/fichiers/")) {
    evenement.respondWith(fichier(requete));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    if (JAMAIS_EN_CACHE.test(url.pathname)) return;
    evenement.respondWith(reseauDabord(requete));
    return;
  }
  if (/^\/(icons\/|marque-2iae\.svg$|manifest\.webmanifest$|og-campus\.png$)/.test(url.pathname)) {
    evenement.respondWith(cacheDabord(requete, CACHE_COQUILLE));
  }
});

/** Pages : réseau d'abord ; sans réseau, la coquille en cache (l'application s'ouvre), sinon /hors-ligne. */
async function navigation(requete) {
  try {
    const reponse = await fetch(requete);
    if (reponse.ok && (reponse.headers.get("Content-Type") || "").includes("text/html")) {
      const cache = await caches.open(CACHE_COQUILLE);
      await cache.put(CLE_COQUILLE, reponse.clone());
    }
    return reponse;
  } catch {
    const cache = await caches.open(CACHE_COQUILLE);
    return (
      (await cache.match(CLE_COQUILLE)) ||
      (await cache.match(HORS_LIGNE)) ||
      new Response(PAGE_SECOURS, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    );
  }
}

async function cacheDabord(requete, nomCache) {
  const cache = await caches.open(nomCache);
  const trouve = await cache.match(requete, { ignoreVary: true });
  if (trouve) return trouve;
  try {
    const reponse = await fetch(requete);
    if (reponse.ok && reponse.type === "basic") await cache.put(requete, reponse.clone());
    return reponse;
  } catch {
    if (new URL(requete.url).pathname.endsWith(".js")) {
      return new Response(MODULE_HORS_LIGNE, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } });
    }
    return new Response("", { status: 503, statusText: "Hors ligne" });
  }
}

/** API : réseau d'abord, repli sur la dernière réponse connue. */
async function reseauDabord(requete) {
  try {
    const reponse = await fetch(requete);
    const nonGardable = /no-store/.test(reponse.headers.get("Cache-Control") || "");
    const gardable = reponse.ok || (reponse.status === 401 && new URL(requete.url).pathname === PROFIL);
    if (gardable && reponse.type === "basic" && !nonGardable) {
      const cache = await caches.open(CACHE_DONNEES);
      await cache.put(requete, reponse.clone());
      void limiter(CACHE_DONNEES, MAX_DONNEES);
    }
    return reponse;
  } catch {
    const trouve = await (await caches.open(CACHE_DONNEES)).match(requete, { ignoreVary: true });
    if (trouve) return trouve;
    return new Response(JSON.stringify({ message: "Pas de connexion internet. Vérifie ton réseau et réessaie." }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

/** Fichiers (photos, PDF, audio) : cache d'abord ; les lectures partielles (vidéo) passent directement. */
async function fichier(requete) {
  if (requete.headers.has("range")) return fetch(requete);
  const cache = await caches.open(CACHE_FICHIERS);
  const trouve = await cache.match(requete, { ignoreVary: true });
  if (trouve) return trouve;
  try {
    const reponse = await fetch(requete);
    const taille = Number(reponse.headers.get("Content-Length") || 0);
    if (reponse.status === 200 && reponse.type === "basic" && taille > 0 && taille <= TAILLE_MAX_FICHIER) {
      await cache.put(requete, reponse.clone());
      void limiter(CACHE_FICHIERS, MAX_FICHIERS);
    }
    return reponse;
  } catch {
    return new Response("", { status: 503, statusText: "Hors ligne" });
  }
}

/** Retire les entrées les plus anciennes au-delà du maximum. */
async function limiter(nomCache, maximum) {
  const cache = await caches.open(nomCache);
  const cles = await cache.keys();
  for (let i = 0; i < cles.length - maximum; i++) await cache.delete(cles[i]);
}

function oublierDonnees() {
  return Promise.all([caches.delete(CACHE_DONNEES), caches.delete(CACHE_FICHIERS)]);
}

// ── Rappels (Web Push) ─────────────────────────────────────────────────────

self.addEventListener("push", (evenement) => {
  let d = {};
  try {
    d = evenement.data ? evenement.data.json() : {};
  } catch {
    d = { titre: evenement.data ? evenement.data.text() : "" };
  }
  const titre = d.titre || "Campus numérique 2IAE";
  evenement.waitUntil(
    self.registration.showNotification(titre, {
      body: d.corps || "",
      icon: "/icons/icone-192.png",
      badge: "/icons/badge-96.png",
      lang: "fr",
      data: { lien: d.lien || "/accueil" },
      // Un seul rappel de live affiché à la fois (le plus récent remplace l'ancien).
      tag: d.type === "live" ? "live" : undefined,
      renotify: d.type === "live",
    }),
  );
});

/** Au toucher : ouvre le bon écran, dans la fenêtre du campus déjà ouverte si possible. */
self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  let lien = new URL("/accueil", self.location.origin).href;
  try {
    const demande = new URL((evenement.notification.data && evenement.notification.data.lien) || "/accueil", self.location.origin);
    if (demande.origin === self.location.origin) lien = demande.href;
  } catch {
    /* lien illisible : accueil */
  }
  evenement.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const fenetre = fenetres.find((c) => new URL(c.url).origin === self.location.origin);
      if (fenetre) {
        await fenetre.focus();
        fenetre.postMessage({ type: "naviguer", lien: new URL(lien).pathname + new URL(lien).search });
        return;
      }
      await self.clients.openWindow(lien);
    })(),
  );
});

/** Le navigateur a renouvelé l'abonnement : on prévient le campus (session du téléphone). */
self.addEventListener("pushsubscriptionchange", (evenement) => {
  evenement.waitUntil(
    (async () => {
      const ancien = evenement.oldSubscription;
      const nouveau =
        evenement.newSubscription ||
        (ancien && ancien.options && (await self.registration.pushManager.subscribe(ancien.options).catch(() => null)));
      if (!nouveau) return;
      await fetch("/api/push/abonnement", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nouveau.toJSON()),
      }).catch(() => undefined);
    })(),
  );
});

// ── File d'envoi hors ligne ────────────────────────────────────────────────

/** Retour du réseau (Background Sync de Chrome Android) : l'application vide sa file. */
self.addEventListener("sync", (evenement) => {
  if (evenement.tag !== "file-envoi") return;
  evenement.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) f.postMessage("file-envoi");
    }),
  );
});
