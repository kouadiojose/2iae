// Enregistrement du service worker (client/public/sw.js) : mode hors ligne,
// rappels sur le téléphone, synchronisation de la file d'envoi.
//
// - En production toujours ; en développement seulement sur localhost avec
//   ?sw=1 (et ?sw=0 pour le retirer), ou à la demande quand la personne
//   active les rappels.
// - Une nouvelle version n'est jamais imposée : un bandeau « Nouvelle version
//   disponible » la propose, la personne choisit le moment (pas au milieu
//   d'un live ou d'un envoi).
import { navigate } from "wouter/use-browser-location";
// Attrape « beforeinstallprompt » dès le démarrage (Chrome l'envoie tôt).
import "./installation";

/**
 * Empreinte du build : le nom du fichier JS principal (/assets/index-XXXX.js)
 * change à chaque mise en ligne ; l'adresse du service worker aussi, ce qui
 * déclenche son installation.
 */
function versionDuBuild(): string {
  const m = import.meta.url.match(/-([A-Za-z0-9_-]{6,})\.js(?:$|\?)/);
  return m ? m[1] : "dev";
}

let enregistrement: Promise<ServiceWorkerRegistration | null> | null = null;
let miseAJourAcceptee = false;

/** Enregistrement du service worker (créé au besoin). null si le navigateur ne les gère pas. */
export function obtenirEnregistrement(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(null);
  if (!enregistrement) {
    enregistrement = navigator.serviceWorker
      .register(`/sw.js?v=${versionDuBuild()}`, { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        surveillerMisesAJour(reg);
        return reg;
      })
      .catch((e: unknown) => {
        console.warn("[pwa] service worker non enregistré :", (e as Error).message);
        enregistrement = null;
        return null;
      });
  }
  return enregistrement;
}

function proposer(travailleur: ServiceWorker) {
  void import("./MiseAJour").then((m) =>
    m.proposerMiseAJour(() => {
      miseAJourAcceptee = true;
      travailleur.postMessage({ type: "SKIP_WAITING" });
    }),
  );
}

function surveillerMisesAJour(reg: ServiceWorkerRegistration) {
  // Une version attendait déjà (onglet rouvert) : on la propose.
  if (reg.waiting && navigator.serviceWorker.controller) proposer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const nouveau = reg.installing;
    if (!nouveau) return;
    nouveau.addEventListener("statechange", () => {
      // « installed » avec un contrôleur existant = mise à jour (et non première installation).
      if (nouveau.state === "installed" && navigator.serviceWorker.controller) proposer(nouveau);
    });
  });
  // Rechargement seulement après l'accord de la personne (la première installation prend aussi le contrôle).
  let recharge = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!miseAJourAcceptee || recharge) return;
    recharge = true;
    window.location.reload();
  });
  // Application laissée ouverte toute la journée : on cherche une nouvelle version chaque heure.
  window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60_000);
}

async function desinscrire() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  const noms = await caches.keys();
  await Promise.all(noms.filter((n) => n.startsWith("campus-")).map((n) => caches.delete(n)));
  console.info("[pwa] service worker retiré.");
}

/** Le réseau répond-il vraiment ? (navigator.onLine ment souvent en 4G faible.) */
export async function reseauJoignable(): Promise<boolean> {
  try {
    const r = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Un écran jamais ouvert n'est pas sur le téléphone : sans réseau, son
 * chargement échoue. On mène alors à /hors-ligne plutôt qu'à une page blanche.
 * En ligne, c'est qu'une nouvelle version a remplacé les anciens fichiers :
 * on recharge une fois.
 */
function gererChargementsRates() {
  window.addEventListener("vite:preloadError", () => {
    void reseauJoignable().then((ok) => {
      if (!ok) {
        const page = window.location.pathname + window.location.search;
        if (!window.location.pathname.startsWith("/hors-ligne")) window.location.assign(`/hors-ligne?page=${encodeURIComponent(page)}`);
        return;
      }
      const cle = "campus:rechargement-version";
      let dernier = 0;
      try {
        dernier = Number(window.sessionStorage.getItem(cle) || 0);
        window.sessionStorage.setItem(cle, String(Date.now()));
      } catch {
        /* stockage indisponible */
      }
      if (Date.now() - dernier > 60_000) window.location.reload();
    });
  });
}

/** Messages du service worker : ouvrir l'écran d'une notification touchée. */
function ecouterMessages() {
  navigator.serviceWorker.addEventListener("message", (m: MessageEvent) => {
    const d = m.data as { type?: string; lien?: string } | string;
    if (typeof d === "object" && d?.type === "naviguer" && typeof d.lien === "string" && d.lien.startsWith("/")) navigate(d.lien);
  });
}

export function enregistrerServiceWorker() {
  if (typeof window === "undefined") return;
  gererChargementsRates();
  if (!("serviceWorker" in navigator)) return;
  ecouterMessages();

  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "0") {
    void desinscrire();
    return;
  }
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!import.meta.env.PROD && !(local && params.get("sw") === "1")) {
    // En développement, un service worker déjà enregistré (?sw=1 ou rappels) reste surveillé.
    void navigator.serviceWorker.getRegistration().then((reg) => reg && void obtenirEnregistrement());
    return;
  }
  // Après le chargement de la page : le service worker ne ralentit pas le premier affichage.
  if (document.readyState === "complete") void obtenirEnregistrement();
  else window.addEventListener("load", () => void obtenirEnregistrement(), { once: true });
}
