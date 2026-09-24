// Fournisseurs de visio de la classe en direct.
//
//   campus  : visio intégrée (WebRTC pair-à-pair en étoile autour du
//             formateur), sans compte externe ; la signalisation est gérée par
//             le module visio (server/visio-campus.ts). Repli par défaut.
//   daily   : Daily.co (DAILY_API_KEY) : une salle privée par séance,
//             jetons de réunion signés par le serveur, enregistrement cloud.
//   jitsi   : serveur Jitsi (JITSI_DOMAIN), simple adresse de salle.
//   externe : lien Zoom / Meet / Teams saisi par le formateur.
//   demo    : aucune visio, scène simulée (tests, démonstrations).
//
// La « radio » (son du formateur en flux HTTP + diapos) fonctionne avec
// tous les fournisseurs : elle ne dépend pas de ce fichier.
import { config } from "./config";
import { ErreurHttp } from "./http";
import type { FournisseurVisio, Seance } from "@shared/schema";

const API_DAILY = "https://api.daily.co/v1";

/** Préfixe des salles Daily (« campus-2iae-12 ») ; réglable pour isoler les tests. */
const PREFIXE_SALLE = process.env.DAILY_ROOM_PREFIX?.trim() || "campus-2iae-";

/** Enregistrement cloud lancé automatiquement quand le formateur entre (désactivable). */
const ENREGISTREMENT_AUTO = process.env.DAILY_ENREGISTREMENT_AUTO?.trim() !== "non";

export const dailyDisponible = () => Boolean(config.visio.dailyCle);
export const jitsiDisponible = () => Boolean(config.visio.jitsiDomaine);

/** Fournisseur choisi quand le formateur ne précise rien : Daily si configuré, sinon la visio du campus. */
export function fournisseurParDefaut(): FournisseurVisio {
  return dailyDisponible() ? "daily" : "campus";
}

/** Fournisseurs utilisables sur ce serveur (pour le formulaire de préparation). */
export function fournisseursDisponibles(): FournisseurVisio[] {
  const liste: FournisseurVisio[] = ["campus"];
  if (dailyDisponible()) liste.push("daily");
  if (jitsiDisponible()) liste.push("jitsi");
  liste.push("externe", "demo");
  return liste;
}

export const nomSalleVisio = (seanceId: number) => `${PREFIXE_SALLE}${seanceId}`;

/** Fin de validité de la salle : fin prévue + 2 h (en secondes Unix). */
function expirationSalle(s: Pick<Seance, "debut" | "dureeMinutes">): number {
  const fin = new Date(s.debut).getTime() + s.dureeMinutes * 60_000;
  // Une séance rejointe en retard (ou qui déborde) garde au moins 2 h devant elle.
  return Math.floor(Math.max(fin, Date.now()) / 1000) + 2 * 3600;
}

// ── Daily.co ───────────────────────────────────────────────────────────────

type SalleDaily = { id: string; name: string; url: string; config?: { exp?: number } };

async function appelDaily<T>(chemin: string, options: { methode?: "GET" | "POST" | "DELETE"; corps?: unknown } = {}): Promise<{ statut: number; donnees: T | null }> {
  const cle = config.visio.dailyCle;
  if (!cle) throw new ErreurHttp(503, "La visio Daily n'est pas configurée sur ce campus.");
  let r: Response;
  try {
    r = await fetch(`${API_DAILY}${chemin}`, {
      method: options.methode ?? "GET",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.warn("[visio] Daily injoignable :", (e as Error).message);
    throw new ErreurHttp(502, "Le service de visio ne répond pas. Réessayez dans un instant ou passez au Plan B.");
  }
  const texte = await r.text();
  let donnees: T | null = null;
  try {
    donnees = texte ? (JSON.parse(texte) as T) : null;
  } catch {
    donnees = null;
  }
  return { statut: r.status, donnees };
}

function erreurDaily(statut: number, donnees: unknown): ErreurHttp {
  const info = (donnees as { info?: string; error?: string } | null)?.info ?? (donnees as { error?: string } | null)?.error ?? "";
  console.warn(`[visio] Daily a répondu ${statut} : ${info}`);
  return new ErreurHttp(502, "Le service de visio a refusé la demande. Réessayez ou passez au Plan B.");
}

/**
 * Crée (ou retrouve) la salle Daily de la séance : privée, caméra et micro
 * coupés à l'entrée, sans écran d'attente ni discussion Daily (les questions
 * passent par le campus), interface en français, enregistrement cloud.
 */
export async function obtenirSalleDaily(s: Pick<Seance, "id" | "debut" | "dureeMinutes">): Promise<{ nom: string; url: string }> {
  const nom = nomSalleVisio(s.id);
  const exp = expirationSalle(s);
  const existante = await appelDaily<SalleDaily>(`/rooms/${encodeURIComponent(nom)}`);
  if (existante.statut === 200 && existante.donnees) {
    // Prolonge la salle si la séance a été déplacée ou déborde.
    if ((existante.donnees.config?.exp ?? 0) < exp) {
      await appelDaily(`/rooms/${encodeURIComponent(nom)}`, { methode: "POST", corps: { properties: { exp } } });
    }
    return { nom, url: existante.donnees.url };
  }
  const creee = await appelDaily<SalleDaily>("/rooms", {
    methode: "POST",
    corps: {
      name: nom,
      privacy: "private",
      properties: {
        exp,
        eject_at_room_exp: true,
        start_video_off: true,
        start_audio_off: true,
        enable_prejoin_ui: false,
        enable_chat: false,
        enable_knocking: false,
        lang: "fr",
        enable_recording: "cloud",
      },
    },
  });
  if (creee.statut === 200 && creee.donnees) return { nom, url: creee.donnees.url };
  // Deux personnes entrées au même instant : la salle vient d'être créée par l'autre.
  const rattrapage = await appelDaily<SalleDaily>(`/rooms/${encodeURIComponent(nom)}`);
  if (rattrapage.statut === 200 && rattrapage.donnees) return { nom, url: rattrapage.donnees.url };
  throw erreurDaily(creee.statut, creee.donnees);
}

export type ProfilJeton = "formateur" | "etudiant" | "salle" | "observateur";

/**
 * Jeton de réunion Daily signé côté serveur. Le formateur est propriétaire
 * (il peut couper les micros et lancer l'enregistrement) ; l'étudiant en
 * ligne n'envoie que du son (pas de caméra étudiante en v1, §9.8) et entre
 * micro coupé ; l'écran de salle envoie caméra et micro de la salle.
 */
export async function jetonDaily(o: {
  salle: string;
  nomAffiche: string;
  utilisateurId: number;
  profil: ProfilJeton;
  seance: Pick<Seance, "debut" | "dureeMinutes">;
}): Promise<string> {
  const proprietes: Record<string, unknown> = {
    room_name: o.salle,
    user_name: o.nomAffiche.slice(0, 60),
    user_id: String(o.utilisateurId),
    is_owner: o.profil === "formateur",
    exp: expirationSalle(o.seance),
    start_audio_off: true,
    start_video_off: o.profil !== "formateur" && o.profil !== "salle",
  };
  if (o.profil === "formateur") {
    proprietes.enable_recording = "cloud";
    if (ENREGISTREMENT_AUTO) proprietes.start_cloud_recording = true;
  }
  if (o.profil === "etudiant") proprietes.permissions = { canSend: ["audio"] };
  if (o.profil === "observateur") proprietes.permissions = { canSend: false };
  const r = await appelDaily<{ token: string }>("/meeting-tokens", { methode: "POST", corps: { properties: proprietes } });
  if (r.statut !== 200 || !r.donnees?.token) throw erreurDaily(r.statut, r.donnees);
  return r.donnees.token;
}

export type EnregistrementDaily = { id: string; statut: string; debut: number; dureeSecondes: number | null };

/** Enregistrements d'une salle, du plus récent au plus ancien. */
export async function enregistrementsDaily(salle: string): Promise<EnregistrementDaily[]> {
  const r = await appelDaily<{ data?: { id: string; status: string; start_ts: number; duration?: number }[] }>(
    `/recordings?room_name=${encodeURIComponent(salle)}&limit=20`,
  );
  if (r.statut !== 200) throw erreurDaily(r.statut, r.donnees);
  return (r.donnees?.data ?? []).map((e) => ({ id: e.id, statut: e.status, debut: e.start_ts, dureeSecondes: e.duration ?? null }));
}

/** Lien de lecture temporaire d'un enregistrement (renouvelé à chaque demande). */
export async function lienEnregistrementDaily(id: string, validiteSecondes = 3 * 3600): Promise<{ url: string; expire: string }> {
  const r = await appelDaily<{ download_link: string; expires: number }>(
    `/recordings/${encodeURIComponent(id)}/access-link?valid_for_secs=${validiteSecondes}`,
  );
  if (r.statut !== 200 || !r.donnees?.download_link) throw erreurDaily(r.statut, r.donnees);
  return { url: r.donnees.download_link, expire: new Date(r.donnees.expires * 1000).toISOString() };
}

/** Supprime une salle Daily (nettoyage ; une séance supprimée n'a plus besoin de sa salle). */
export async function supprimerSalleDaily(salle: string): Promise<void> {
  if (!dailyDisponible()) return;
  await appelDaily(`/rooms/${encodeURIComponent(salle)}`, { methode: "DELETE" }).catch(() => undefined);
}

// ── Jitsi ──────────────────────────────────────────────────────────────────

/** Adresse de la salle Jitsi : micro et caméra coupés, nom affiché prérempli. */
export function urlJitsi(seanceId: number, nomAffiche: string): string | null {
  const domaine = config.visio.jitsiDomaine?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!domaine) return null;
  const salle = `Campus2IAE-${seanceId}-${Buffer.from(config.sessionSecret).toString("hex").slice(0, 8)}`;
  const options = [
    "config.startWithAudioMuted=true",
    "config.startWithVideoMuted=true",
    "config.prejoinPageEnabled=false",
    "config.defaultLanguage=%22fr%22",
    `userInfo.displayName=%22${encodeURIComponent(nomAffiche)}%22`,
  ];
  return `https://${domaine}/${salle}#${options.join("&")}`;
}
