// Visio LiveKit : le serveur du campus (OVH, campus/infra/livekit), qui remplace Daily pas à pas.
//
// Même rôle que les fonctions Daily de visio.ts : salles, jetons d'accès, présence, sortie d'une personne. Les
// droits du jeton suivent les profils de Daily : le formateur administre la salle (il coupe un micro, sort
// quelqu'un), une salle de campus envoie micro et caméra, un étudiant le micro seulement, un observateur rien.
// LiveKit n'a ni date d'expiration de salle ni « éjecter après » : une salle vide se ferme seule (empty_timeout du
// serveur) ; la durée maximale d'une visite est la durée de vie du jeton à l'entrée, et les sorties forcées
// passent par removeParticipant.
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import type { ProfilDaily } from "@shared/schema";
import { config } from "./config";

export const livekitDisponible = () => Boolean(config.visio.livekitUrl && config.visio.livekitCle && config.visio.livekitSecret);

let client: RoomServiceClient | null = null;
function salles(): RoomServiceClient {
  if (!livekitDisponible()) throw new Error("LiveKit n'est pas configuré (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).");
  client ??= new RoomServiceClient(config.visio.livekitUrl!.replace(/^ws/, "http"), config.visio.livekitCle!, config.visio.livekitSecret!);
  return client;
}

/** Nom complet d'une salle (préfixe du campus : les essais locaux n'entrent jamais dans les salles réelles). */
export const nomSalleLivekit = (nom: string) => `${config.visio.livekitPrefixe}-${nom}`;

/** Crée la salle si besoin (idempotent chez LiveKit : une salle existante est renvoyée telle quelle). */
export async function obtenirSalleLivekit(nom: string, o: { places?: number; videAvantFermetureS?: number } = {}): Promise<string> {
  const salle = nomSalleLivekit(nom);
  await salles().createRoom({ name: salle, maxParticipants: o.places ?? 0, emptyTimeout: o.videAvantFermetureS ?? 300, departureTimeout: 30 });
  return salle;
}

export type OptionsJetonLivekit = {
  salle: string;
  utilisateurId: number;
  nomAffiche: string;
  profil: ProfilDaily;
  /** Durée de vie du jeton (secondes) : on ne peut plus entrer après, la visite en cours continue. */
  dureeS: number;
  /** Ce que la personne peut envoyer ; par défaut selon le profil. */
  envoi?: ("audio" | "video" | "ecran")[] | false;
  /** Invisible des autres (mixage de la radio de la classe). */
  invisible?: boolean;
};

const SOURCES: Record<"audio" | "video" | "ecran", TrackSource[]> = {
  audio: [TrackSource.MICROPHONE],
  video: [TrackSource.CAMERA],
  ecran: [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
};

function envoiParDefaut(profil: ProfilDaily): ("audio" | "video" | "ecran")[] | false {
  if (profil === "formateur") return ["audio", "video", "ecran"];
  if (profil === "salle") return ["audio", "video"];
  if (profil === "etudiant") return ["audio"];
  return false;
}

/** Jeton d'accès (JWT) à une salle. L'identité est l'identifiant du compte, comme user_id chez Daily. */
export async function jetonLivekit(o: OptionsJetonLivekit): Promise<string> {
  const envoi = o.envoi === undefined ? envoiParDefaut(o.profil) : o.envoi;
  const at = new AccessToken(config.visio.livekitCle!, config.visio.livekitSecret!, {
    identity: String(o.utilisateurId),
    name: o.nomAffiche,
    ttl: o.dureeS,
    metadata: JSON.stringify({ profil: o.profil }),
  });
  at.addGrant({
    roomJoin: true,
    room: o.salle,
    canSubscribe: true,
    canPublishData: true,
    canPublish: Boolean(envoi && envoi.length),
    canPublishSources: envoi ? envoi.flatMap((e) => SOURCES[e]) : [],
    roomAdmin: o.profil === "formateur",
    hidden: Boolean(o.invisible),
  });
  return at.toJwt();
}

/** Qui est dans la salle (identité = compte, nom affiché, entrée). Salle absente : personne. */
export async function presentsLivekit(salle: string): Promise<{ utilisateurId: number; nom: string; depuis: Date }[]> {
  try {
    const liste = await salles().listParticipants(salle);
    return liste.map((p) => ({ utilisateurId: Number(p.identity), nom: p.name || "Invité", depuis: new Date(Number(p.joinedAt) * 1000) }));
  } catch (e) {
    if (/not found|does not exist|404/i.test((e as Error).message)) return [];
    throw e;
  }
}

/** Sort un compte de la salle (fin de la parole, écran remplacé). Renvoie vrai s'il y était. */
export async function sortirDeSalleLivekit(salle: string, utilisateurId: number): Promise<boolean> {
  try {
    await salles().removeParticipant(salle, String(utilisateurId));
    return true;
  } catch {
    return false;
  }
}

/** Ferme une salle : tout le monde sort. */
export async function fermerSalleLivekit(salle: string): Promise<void> {
  try {
    await salles().deleteRoom(salle);
  } catch {
    /* déjà fermée */
  }
}
