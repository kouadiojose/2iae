// Micro, caméra et messages d'aide en français quand le navigateur refuse.
//
// Qualités choisies pour la 4G et pour l'ordinateur du formateur, qui encode
// sa vidéo une fois par salle et par étudiant : 540p suffit sur l'écran d'une
// salle et reste léger à encoder ; les salles envoient du 360p.

/** Réglages du micro : annulation d'écho indispensable en salle (haut-parleurs et micro dans la même pièce). */
export const CONTRAINTES_MICRO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

export const VIDEO_FORMATEUR: MediaTrackConstraints = {
  width: { ideal: 960 },
  height: { ideal: 540 },
  frameRate: { ideal: 24, max: 30 },
};

export const VIDEO_SALLE: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 360 },
  frameRate: { ideal: 20, max: 24 },
};

export const mediasDisponibles = () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
export const webrtcDisponible = () => typeof window !== "undefined" && typeof window.RTCPeerConnection === "function";

export async function obtenirMicro(): Promise<MediaStreamTrack> {
  const flux = await navigator.mediaDevices.getUserMedia({ audio: CONTRAINTES_MICRO, video: false });
  return flux.getAudioTracks()[0];
}

export async function obtenirCamera(contraintes: MediaTrackConstraints): Promise<MediaStreamTrack> {
  const flux = await navigator.mediaDevices.getUserMedia({ audio: false, video: contraintes });
  const piste = flux.getVideoTracks()[0];
  // Visage et tableau plutôt que mouvement : l'encodeur garde la netteté.
  if ("contentHint" in piste) piste.contentHint = "detail";
  return piste;
}

/** Arrête une piste locale (le voyant du micro ou de la caméra s'éteint). */
export function arreter(piste: MediaStreamTrack | null | undefined) {
  try {
    piste?.stop();
  } catch {
    /* déjà arrêtée */
  }
}

/**
 * Message simple à montrer quand le micro ou la caméra ne s'ouvrent pas.
 * `tu` : tutoiement pour les étudiants, vouvoiement pour le personnel.
 */
export function messageErreurMedia(e: unknown, tu: boolean, quoi: "micro" | "caméra" | "micro et caméra" = "micro et caméra"): string {
  const nom = (e as { name?: string } | null)?.name ?? "";
  const le = quoi === "caméra" ? "la caméra" : quoi === "micro" ? "le micro" : "le micro et la caméra";
  const aLe = quoi === "caméra" ? "à la caméra" : quoi === "micro" ? "au micro" : "au micro et à la caméra";
  if (!mediasDisponibles()) {
    return tu
      ? "Ton navigateur ne donne pas accès au micro. Ouvre le campus avec Chrome, à une adresse qui commence par https."
      : "Votre navigateur ne donne pas accès au micro. Ouvrez le campus avec Chrome, à une adresse qui commence par https.";
  }
  switch (nom) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return tu
        ? `Tu as refusé l'accès ${aLe}. Touche le cadenas à gauche de l'adresse, choisis « Autoriser », puis réessaie.`
        : `L'accès ${aLe} a été refusé. Cliquez sur le cadenas à gauche de l'adresse, choisissez « Autoriser », puis réessayez.`;
    case "NotFoundError":
    case "DevicesNotFoundError":
      return tu
        ? `Aucun ${quoi === "caméra" ? "appareil photo" : "micro"} trouvé. Branche des écouteurs avec micro, puis réessaie.`
        : `Aucun${quoi === "caméra" ? "e caméra trouvée" : " micro trouvé"}. Vérifiez le branchement, puis réessayez.`;
    case "NotReadableError":
    case "TrackStartError": {
      const occupe = quoi === "caméra" ? "La caméra est déjà utilisée" : quoi === "micro" ? "Le micro est déjà utilisé" : "Le micro ou la caméra est déjà utilisé";
      return tu
        ? `${occupe} par une autre application (appel WhatsApp, autre onglet…). Ferme-la, puis réessaie.`
        : `${occupe} par une autre application (Teams, Zoom, autre onglet…). Fermez-la, puis réessayez.`;
    }
    case "OverconstrainedError":
      return tu ? "Ton appareil ne permet pas cette qualité. Réessaie." : "Votre appareil ne permet pas cette qualité. Réessayez.";
    case "SecurityError":
      return tu
        ? "Le navigateur bloque le micro sur cette page. Ouvre le campus à une adresse qui commence par https."
        : "Le navigateur bloque le micro sur cette page. Ouvrez le campus à une adresse qui commence par https.";
    default:
      return tu ? `Impossible d'ouvrir ${le}. Réessaie dans un instant.` : `Impossible d'ouvrir ${le}. Réessayez dans un instant.`;
  }
}

/** Identifiant aléatoire d'onglet ou d'enregistrement (crypto.randomUUID n'existe qu'en https). */
export function idAleatoire(longueur = 20): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => alphabet[o % alphabet.length]).join("");
}
