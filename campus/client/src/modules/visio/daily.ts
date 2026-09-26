// Outils Daily partagés par la classe en direct, la salle d'essai et la
// répétition : chargement à la demande de daily-js (rien n'est téléchargé en
// mode radio), thème du campus, compatibilité du navigateur, et traduction
// des erreurs Daily en français avec une issue concrète.
import type { DailyCall, DailyCallFactory, DailyCallStaticUtils } from "@daily-co/daily-js";
import { ErreurApi } from "@/lib/api";

type Daily = DailyCallFactory & DailyCallStaticUtils;

let chargement: Promise<Daily> | null = null;

/** daily-js, chargé une seule fois et seulement quand la visio sert vraiment. */
export function chargerDaily(): Promise<Daily> {
  chargement ??= import("@daily-co/daily-js").then((m) => m.default as unknown as Daily).catch((e) => {
    chargement = null;
    throw e;
  });
  return chargement;
}

/** Un appel Daily à la fois : on attend que le précédent soit détruit avant d'en ouvrir un autre. */
let destruction: Promise<void> = Promise.resolve();
export const attendreDestruction = () => destruction;
export function detruireAppel(call: DailyCall | null | undefined) {
  if (!call) return;
  destruction = destruction.then(() => call.destroy()).catch(() => undefined);
}

/** Thème de la salle live (mode nuit, orange 2IAE, texte encre sur l'orange). */
export const THEME_DAILY = {
  colors: {
    accent: "#E4793A",
    accentText: "#141414",
    background: "#1E1C1A",
    backgroundAccent: "#2A2624",
    baseText: "#FFFFFF",
    border: "#3A3431",
    mainAreaBg: "#0F0E0D",
    mainAreaBgAccent: "#1E1C1A",
    mainAreaText: "#FFFFFF",
    supportiveText: "#A89E95",
  },
};

export const STYLE_IFRAME = { width: "100%", height: "100%", border: "0", borderRadius: "20px", background: "#1E1C1A" };

// ── Navigateur ─────────────────────────────────────────────────────────────

/** Navigateur intégré d'une application (WhatsApp, Facebook, Instagram…) : la visio y échoue souvent. */
export function navigateurIntegre(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return "Facebook";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/WhatsApp/i.test(ua)) return "WhatsApp";
  if (/\bLine\//i.test(ua)) return "Line";
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return "TikTok";
  if (/;\s?wv\)/.test(ua)) return "une application";
  return null;
}

export type Compatibilite = { ok: boolean; raison: string | null; conseil: string | null };

/** Le navigateur peut-il faire la visio Daily ? Réponse en français, avec la marche à suivre. */
export async function compatibiliteDaily(tu: boolean): Promise<Compatibilite> {
  const t = (a: string, b: string) => (tu ? a : b);
  const integre = navigateurIntegre();
  if (integre) {
    return {
      ok: false,
      raison: t(`Tu es dans le navigateur intégré de ${integre} : la visio n'y fonctionne pas.`, `Vous êtes dans le navigateur intégré de ${integre} : la visio n'y fonctionne pas.`),
      conseil: t("Touche ⋮ (ou « … ») puis « Ouvrir dans Chrome », ou copie l'adresse dans Chrome.", "Touchez ⋮ (ou « … ») puis « Ouvrir dans Chrome », ou copiez l'adresse dans Chrome."),
    };
  }
  if (typeof window === "undefined" || typeof window.RTCPeerConnection !== "function" || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      raison: t("Ton navigateur ne sait pas faire de visio.", "Votre navigateur ne sait pas faire de visio."),
      conseil: t("Ouvre le campus avec Chrome à jour, à une adresse qui commence par https.", "Ouvrez le campus avec Chrome ou Edge à jour, à une adresse qui commence par https."),
    };
  }
  try {
    const Daily = await chargerDaily();
    const info = Daily.supportedBrowser();
    if (!info.supported) {
      const safari = /safari/i.test(info.name);
      return {
        ok: false,
        raison: safari
          ? t("Ce Safari est trop ancien pour la visio.", "Ce Safari est trop ancien pour la visio.")
          : t(`Ce navigateur (${info.name} ${info.version}) n'est pas compatible avec la visio.`, `Ce navigateur (${info.name} ${info.version}) n'est pas compatible avec la visio.`),
        conseil: safari
          ? t("Mets à jour ton iPhone (iOS 15 ou plus récent) ou ouvre le campus avec Chrome.", "Mettez à jour l'appareil (iOS 15 ou plus récent) ou ouvrez le campus avec Chrome.")
          : t("Ouvre le campus avec Chrome à jour.", "Ouvrez le campus avec Chrome ou Edge à jour."),
      };
    }
  } catch {
    return {
      ok: false,
      raison: t("Le module de visio n'a pas pu se charger.", "Le module de visio n'a pas pu se charger."),
      conseil: t("Vérifie ta connexion, puis recharge la page.", "Vérifiez la connexion, puis rechargez la page."),
    };
  }
  return { ok: true, raison: null, conseil: null };
}

// ── Erreurs ────────────────────────────────────────────────────────────────

export type GenreProbleme = "acces" | "pleine" | "compte" | "reseau" | "navigateur" | "sortie" | "fermee" | "absente" | "autre";

export type ProblemeVisio = {
  genre: GenreProbleme;
  /** Phrase principale, en français courant. */
  texte: string;
  /** Ce qu'on peut faire. */
  conseil: string | null;
  /** On redemande tout seul un accès (jeton expiré, salle recréée). */
  relancer: boolean;
};

type RoleVisio = "formateur" | "salle" | "etudiant" | "observateur";

function conseilReseau(role: RoleVisio, tu: boolean): string {
  if (role === "formateur") return "Votre réseau bloque peut-être la visio. Essayez un partage de connexion depuis votre téléphone, passez à la visio du campus, ou déclenchez le Plan B : la radio, les diapos et les questions continuent.";
  if (role === "salle") return "Le réseau du campus bloque peut-être la visio. Essayez un partage de connexion 4G. En attendant, le son du cours passe par la radio.";
  return tu
    ? "Ton réseau bloque peut-être la visio. Passe en « son + diapos » (radio), ou essaie en 4G avec un partage de connexion."
    : "Votre réseau bloque peut-être la visio. Passez à la radio, ou essayez un partage de connexion 4G.";
}

/** Erreur fatale Daily (événement « error » ou refus de join()) traduite en français. */
export function traduireErreurDaily(ev: { errorMsg?: string; error?: { type?: string; msg?: string } | null } | Error | null | undefined, role: RoleVisio, tu: boolean): ProblemeVisio {
  const t = (a: string, b: string) => (tu ? a : b);
  const type = ev && "error" in ev ? (ev.error?.type ?? "") : "";
  const msg = `${(ev as { errorMsg?: string } | null)?.errorMsg ?? (ev instanceof Error ? ev.message : "")} ${(ev && "error" in ev ? ev.error?.msg : "") ?? ""}`.toLowerCase();
  switch (type) {
    case "exp-token":
    case "nbf-token":
    case "not-allowed":
      return { genre: "acces", texte: t("Ton accès à la visio a expiré. Nouvelle connexion…", "Votre accès à la visio a expiré. Nouvelle connexion…"), conseil: null, relancer: true };
    case "exp-room":
    case "no-room":
      return { genre: "acces", texte: "La salle se prépare à nouveau. Nouvelle connexion…", conseil: null, relancer: true };
    case "nbf-room":
      return { genre: "fermee", texte: "Cette salle n'est pas encore ouverte.", conseil: t("Reviens un peu avant le début du cours.", "Revenez un peu avant le début."), relancer: false };
    case "meeting-full":
      return {
        genre: "pleine",
        texte: t("La visio est complète.", "La salle de visio est complète."),
        conseil: role === "etudiant" ? "Suis le cours en « son + diapos » (radio) : tu entends tout, pour beaucoup moins de données." : "La direction peut augmenter le nombre de places dans « Visio » du pilotage.",
        relancer: false,
      };
    case "ejected":
      return {
        genre: "sortie",
        texte: t("Tu as quitté la salle de visio.", "Vous avez quitté la salle de visio."),
        conseil: t("Une visite dans la salle d'essai dure une heure au plus. Tu peux y revenir.", "Une visite dans la salle d'essai ou une répétition s'arrête seule au bout d'un moment. Vous pouvez y revenir."),
        relancer: false,
      };
    case "end-of-life":
      return { genre: "navigateur", texte: "Cette page est trop ancienne pour la visio.", conseil: t("Recharge la page.", "Rechargez la page."), relancer: false };
    case "connection-error":
      return { genre: "reseau", texte: t("La visio n'arrive pas à se connecter.", "La visio n'arrive pas à se connecter."), conseil: conseilReseau(role, tu), relancer: false };
  }
  if (/payment|billing|quota|account|subscription/.test(msg)) {
    return {
      genre: "compte",
      texte: "La visio Daily est indisponible : le compte de l'école refuse la connexion.",
      conseil: role === "formateur" ? "La direction est prévenue. Passez à la visio du campus : la radio, les diapos et les questions continuent." : conseilReseau(role, tu),
      relancer: false,
    };
  }
  if (/browser|unsupported|not supported/.test(msg)) {
    return { genre: "navigateur", texte: t("Ton navigateur ne permet pas la visio.", "Votre navigateur ne permet pas la visio."), conseil: t("Ouvre le campus avec Chrome à jour.", "Ouvrez le campus avec Chrome ou Edge à jour."), relancer: false };
  }
  return { genre: "reseau", texte: t("La visio a été interrompue.", "La visio a été interrompue."), conseil: conseilReseau(role, tu), relancer: false };
}

/** Erreur du campus en demandant l'accès (POST …/rejoindre) traduite en problème de visio. */
export function problemeDepuisApi(e: unknown, role: RoleVisio, tu: boolean): ProblemeVisio {
  const code = e instanceof ErreurApi ? (e.details as { code?: string } | undefined)?.code : undefined;
  const message = e instanceof Error ? e.message : "La visio n'est pas disponible pour le moment.";
  if (code === "daily_compte") return { genre: "compte", texte: message, conseil: null, relancer: false };
  if (code === "daily_absent") return { genre: "absente", texte: message, conseil: null, relancer: false };
  if (code === "daily_injoignable" || code === "daily_occupe" || code === "daily_refus") return { genre: "reseau", texte: message, conseil: null, relancer: false };
  if (e instanceof ErreurApi && e.statut === 409) return { genre: "fermee", texte: message, conseil: null, relancer: false };
  if (e instanceof ErreurApi && e.statut === 0) return { genre: "reseau", texte: message, conseil: conseilReseau(role, tu), relancer: false };
  return { genre: "autre", texte: message, conseil: null, relancer: false };
}

/** Message de caméra ou de micro refusés par le navigateur (événement « camera-error »). */
export function messageCameraDaily(type: string | undefined, tu: boolean): string {
  const t = (a: string, b: string) => (tu ? a : b);
  switch (type) {
    case "permissions":
      return t("Tu as refusé l'accès au micro ou à la caméra. Touche le cadenas près de l'adresse, choisis « Autoriser », puis recharge.", "L'accès au micro ou à la caméra est refusé. Cliquez sur le cadenas près de l'adresse, choisissez « Autoriser », puis rechargez.");
    case "cam-in-use":
    case "mic-in-use":
    case "cam-mic-in-use":
      return t("Le micro ou la caméra est déjà pris par une autre application (appel WhatsApp, autre onglet). Ferme-la.", "Le micro ou la caméra est déjà utilisé par une autre application (Teams, Zoom, autre onglet). Fermez-la.");
    case "not-found":
      return t("Aucun micro ni caméra trouvé.", "Aucun micro ni caméra trouvé : vérifiez le branchement.");
    case "undefined-mediadevices":
      return t("Ce navigateur ne donne pas accès au micro. Ouvre le campus avec Chrome, en https.", "Ce navigateur ne donne pas accès au micro. Ouvrez le campus avec Chrome, en https.");
    default:
      return t("Le micro ou la caméra ne répond pas.", "Le micro ou la caméra ne répond pas.");
  }
}
