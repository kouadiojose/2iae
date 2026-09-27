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
// Le bandeau fait partie du code principal : chargé à la demande, son fichier aurait déjà disparu
// du serveur au moment précis où il sert (une nouvelle version vient de remplacer l'ancienne).
import { proposerMiseAJour } from "./MiseAJour";

/**
 * Empreinte du build : le nom du fichier JS principal (/assets/index-XXXX.js)
 * change à chaque mise en ligne ; l'adresse du service worker aussi, ce qui
 * déclenche son installation.
 */
function versionDuBuild(): string {
  const m = import.meta.url.match(/-([A-Za-z0-9_-]{6,})\.js(?:$|\?)/);
  return m ? m[1] : "dev";
}

/** Empreinte du build en ligne (le JS principal que référence la page), null si le réseau ne répond pas. */
async function versionEnLigne(): Promise<string | null> {
  try {
    const r = await fetch("/", {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const m = (await r.text()).match(/\/assets\/index-([A-Za-z0-9_-]{6,})\.js/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

let enregistrement: Promise<ServiceWorkerRegistration | null> | null = null;
let enregistrementCourant: ServiceWorkerRegistration | null = null;
let miseAJourAcceptee = false;
/** « Plus tard » : le bandeau ne revient pas avant une heure. */
let refuseeLe = 0;

/** Enregistrement du service worker (créé au besoin). null si le navigateur ne les gère pas. */
export function obtenirEnregistrement(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return Promise.resolve(null);
  if (!enregistrement) {
    enregistrement = navigator.serviceWorker
      .register(`/sw.js?v=${versionDuBuild()}`, {
        scope: "/",
        updateViaCache: "none",
      })
      .then((reg) => {
        enregistrementCourant = reg;
        surveillerMisesAJour(reg);
        return reg;
      })
      .catch((e: unknown) => {
        console.warn(
          "[pwa] service worker non enregistré :",
          (e as Error).message,
        );
        enregistrement = null;
        return null;
      });
  }
  return enregistrement;
}

const versionDu = (travailleur: ServiceWorker) =>
  new URL(travailleur.scriptURL).searchParams.get("v");

/**
 * Un nouveau service worker attend. Si la page tourne déjà sur sa version (elle
 * a été rechargée depuis le réseau après la mise en ligne), il n'y a rien à
 * proposer : on l'active en silence. Le bandeau n'apparaît que si la page est
 * vraiment plus ancienne que ce que le serveur a en ligne.
 */
function versionEnAttente(travailleur: ServiceWorker) {
  if (versionDu(travailleur) === versionDuBuild()) {
    travailleur.postMessage({ type: "SKIP_WAITING" });
    return;
  }
  proposer();
}

function proposer() {
  if (Date.now() - refuseeLe < 60 * 60_000) return;
  proposerMiseAJour(
    () => {
      miseAJourAcceptee = true;
      // Le service worker en attente au moment du clic (un plus récent a pu remplacer celui du bandeau).
      const enAttente = enregistrementCourant?.waiting;
      enAttente?.postMessage({ type: "SKIP_WAITING" });
      // Rien en attente, ou l'activation tarde : on recharge quand même (la page vient du réseau).
      window.setTimeout(() => window.location.reload(), enAttente ? 4000 : 0);
    },
    () => {
      refuseeLe = Date.now();
    },
  );
}

function surveillerMisesAJour(reg: ServiceWorkerRegistration) {
  // Une version attendait déjà (onglet rouvert) : activée en silence si c'est la nôtre, proposée sinon.
  if (reg.waiting && navigator.serviceWorker.controller)
    versionEnAttente(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const nouveau = reg.installing;
    if (!nouveau) return;
    nouveau.addEventListener("statechange", () => {
      // « installed » avec un contrôleur existant = mise à jour (et non première installation).
      if (nouveau.state === "installed" && navigator.serviceWorker.controller)
        versionEnAttente(nouveau);
    });
  });
  // Rechargement seulement après l'accord de la personne (la première installation prend aussi le contrôle).
  let recharge = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!miseAJourAcceptee || recharge) return;
    recharge = true;
    window.location.reload();
  });
  // Application laissée ouverte toute la journée : on cherche une nouvelle version chaque heure,
  // et chaque fois qu'on y revient (au plus toutes les 5 minutes). reg.update() seul ne suffit pas :
  // il relit sw.js?v=<ancienne empreinte>, identique octet pour octet. On compare donc l'empreinte du
  // build en ligne à la nôtre ; si elle a changé, enregistrer sw.js?v=<nouvelle> installe la nouvelle
  // version, et le bandeau la propose.
  let derniereRecherche = Date.now();
  const chercher = () => {
    if (Date.now() - derniereRecherche < 5 * 60_000) return;
    derniereRecherche = Date.now();
    if (reg.waiting && navigator.serviceWorker.controller) {
      versionEnAttente(reg.waiting);
      return;
    }
    void versionEnLigne().then((v) => {
      if (v && v !== versionDuBuild()) {
        void navigator.serviceWorker
          .register(`/sw.js?v=${v}`, { scope: "/", updateViaCache: "none" })
          .catch(() => undefined);
      } else void reg.update().catch(() => undefined);
    });
  };
  window.setInterval(chercher, 60 * 60_000);
  window.addEventListener("focus", chercher);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") chercher();
  });
}

async function desinscrire() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  const noms = await caches.keys();
  await Promise.all(
    noms.filter((n) => n.startsWith("campus-")).map((n) => caches.delete(n)),
  );
  console.info("[pwa] service worker retiré.");
}

/** Le réseau répond-il vraiment ? (navigator.onLine ment souvent en 4G faible.) */
export async function reseauJoignable(): Promise<boolean> {
  try {
    const r = await fetch("/api/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
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
        if (!window.location.pathname.startsWith("/hors-ligne"))
          window.location.assign(
            `/hors-ligne?page=${encodeURIComponent(page)}`,
          );
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
    if (
      typeof d === "object" &&
      d?.type === "naviguer" &&
      typeof d.lien === "string" &&
      d.lien.startsWith("/")
    )
      navigate(d.lien);
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
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg && void obtenirEnregistrement());
    return;
  }
  // Après le chargement de la page : le service worker ne ralentit pas le premier affichage.
  if (document.readyState === "complete") void obtenirEnregistrement();
  else
    window.addEventListener("load", () => void obtenirEnregistrement(), {
      once: true,
    });
}
