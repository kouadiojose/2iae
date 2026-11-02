// Visio LiveKit : le serveur du campus (OVH, campus/infra/livekit), qui remplace Daily pas à pas.
//
// Même rôle que les fonctions Daily de visio.ts : salles, jetons d'accès, présence, sortie d'une personne. Les
// droits du jeton suivent les profils de Daily : le formateur administre la salle (il coupe un micro, sort
// quelqu'un), une salle de campus envoie micro et caméra, un étudiant le micro seulement, un observateur rien.
// LiveKit n'a ni date d'expiration de salle ni « éjecter après » : une salle vide se ferme seule (empty_timeout du
// serveur) ; la durée maximale d'une visite est la durée de vie du jeton à l'entrée, et les sorties forcées
// passent par removeParticipant.
import { AccessToken, RoomServiceClient, TrackSource, EgressClient, EgressStatus, EncodedFileOutput, EncodedFileType, EncodingOptionsPreset, S3Upload } from "livekit-server-sdk";
import { S3Client, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { ProfilDaily } from "@shared/schema";
import { config } from "./config";
import { ErreurHttp } from "./http";
import { MESSAGE_SALLE_DEJA_CONNECTEE } from "./visio";

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
export async function presentsLivekit(salle: string): Promise<{ utilisateurId: number; nom: string; depuis: Date; profil: ProfilDaily | null }[]> {
  try {
    const liste = await salles().listParticipants(salle);
    return liste.map((p) => {
      let profil: ProfilDaily | null = null;
      try {
        profil = JSON.parse(p.metadata || "{}").profil ?? null;
      } catch {
        /* métadonnées absentes */
      }
      return { utilisateurId: Number(p.identity), nom: p.name || "Invité", depuis: new Date(Number(p.joinedAt) * 1000), profil };
    });
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

// ── Séances : la salle du cours et l'enregistrement du replay ──────────────


/** Marque d'une séance servie par LiveKit dans seances.salleVisio (les salles Daily n'ont pas ce préfixe). */
export const PREFIXE_SEANCE_LIVEKIT = "lk:";
export const salleSeanceLivekit = (seanceId: number) => nomSalleLivekit(`seance-${seanceId}`);
export const marqueSeanceLivekit = (seanceId: number) => `${PREFIXE_SEANCE_LIVEKIT}${salleSeanceLivekit(seanceId)}`;
export const estSalleLivekit = (salleVisio: string | null | undefined) => Boolean(salleVisio?.startsWith(PREFIXE_SEANCE_LIVEKIT));

let egress: EgressClient | null = null;
function enregistreur(): EgressClient {
  if (!livekitDisponible()) throw new Error("LiveKit n'est pas configuré.");
  egress ??= new EgressClient(config.visio.livekitUrl!.replace(/^ws/, "http"), config.visio.livekitCle!, config.visio.livekitSecret!);
  return egress;
}

const ACTIFS = new Set([EgressStatus.EGRESS_STARTING, EgressStatus.EGRESS_ACTIVE, EgressStatus.EGRESS_ENDING]);

/** Enregistrement en cours (ou qui démarre) pour cette salle ? */
export async function enregistrementEnCours(salle: string): Promise<boolean> {
  const liste = await enregistreur().listEgress({ roomName: salle, active: true });
  return liste.some((e) => ACTIFS.has(e.status));
}

/**
 * Lance l'enregistrement du replay de la séance (une seule fois : rien si un enregistrement tourne déjà). Le fichier
 * MP4 part directement dans le bucket des replays (replays/<année>/seance-<id>/<horodatage>.mp4) : plus de copie après
 * coup comme avec Daily. Mise en page « speaker » (la personne qui parle en grand, partage d'écran compris), 720p.
 */
function sortieBucket(chemin: string): EncodedFileOutput {
  const r = config.replays;
  if (!r.bucket || !r.endpoint || !r.cleId || !r.cleSecrete) throw new Error("Bucket des replays non configuré : pas d'enregistrement LiveKit.");
  return new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: chemin,
    output: {
      case: "s3",
      value: new S3Upload({ accessKey: r.cleId, secret: r.cleSecrete, bucket: r.bucket, endpoint: r.endpoint, region: r.region === "auto" ? "us-east-1" : r.region, forcePathStyle: process.env.REPLAYS_FORCE_PATH_STYLE === "1" }),
    },
  });
}

export async function demarrerEnregistrementSeance(s: { id: number; debut: Date }): Promise<string | null> {
  const salle = salleSeanceLivekit(s.id);
  if (await enregistrementEnCours(salle)) return null;
  const sortie = sortieBucket(`replays/${s.debut.getUTCFullYear()}/seance-${s.id}/lk-{time}.mp4`);
  const info = await enregistreur().startRoomCompositeEgress(salle, sortie, { layout: "speaker", encodingOptions: EncodingOptionsPreset.H264_720P_30 });
  return info.egressId;
}

/** Arrête les enregistrements en cours de la salle (fin du cours). */
export async function arreterEnregistrementsSeance(seanceId: number): Promise<void> {
  const liste = await enregistreur().listEgress({ roomName: salleSeanceLivekit(seanceId), active: true });
  for (const e of liste) await enregistreur().stopEgress(e.egressId).catch(() => undefined);
}

export type MorceauLivekit = { id: string; cle: string; debut: Date; dureeSecondes: number; tailleOctets: number };

/**
 * Enregistrements terminés de la séance, prêts à servir de replay : un morceau par enregistrement (un enregistrement
 * relancé après une panne fait un second morceau). `enCours` : au moins un n'est pas encore fini (on attend).
 */
export async function enregistrementsSeance(seanceId: number): Promise<{ enCours: boolean; morceaux: MorceauLivekit[] }> {
  const liste = await enregistreur().listEgress({ roomName: salleSeanceLivekit(seanceId) });
  const enCours = liste.some((e) => ACTIFS.has(e.status));
  const morceaux = liste
    .filter((e) => e.status === EgressStatus.EGRESS_COMPLETE)
    .flatMap((e) =>
      e.fileResults.map((f) => ({
        id: `lk-${e.egressId}`,
        cle: f.filename,
        debut: new Date(Number(f.startedAt) / 1e6),
        dureeSecondes: Math.round(Number(f.duration) / 1e9),
        tailleOctets: Number(f.size),
      })),
    )
    .filter((m) => m.cle && m.tailleOctets > 0)
    .sort((a, b) => a.debut.getTime() - b.debut.getTime());
  return { enCours, morceaux };
}

// ── Un seul appareil par écran de salle (même règle que Daily : visio.reserverPosteDeSalle) ──
//
// LiveKit garde une seule connexion par identité dans une salle : un deuxième appareil du même compte en chasse le
// premier. Pour qu'un téléphone ne sorte pas l'écran de la salle, un autre appareil est refusé tant que le premier est
// là, sauf s'il demande à prendre la place.
const postesDeSalle = new Map<string, { poste: string; t: number }>();

export async function reserverPosteLivekit(o: { salle: string; utilisateurId: number; poste?: string; prendre?: boolean }): Promise<void> {
  if (!o.poste) return;
  const cle = `${o.salle}:${o.utilisateurId}`;
  const maintenant = Date.now();
  if (postesDeSalle.size > 500) for (const [k, v] of postesDeSalle) if (maintenant - v.t > 12 * 3600_000) postesDeSalle.delete(k);
  const tenu = postesDeSalle.get(cle);
  if ((!tenu || tenu.poste !== o.poste) && !o.prendre) {
    const presents = await presentsLivekit(o.salle).catch(() => []);
    if (presents.some((p) => p.utilisateurId === o.utilisateurId)) {
      throw new ErreurHttp(409, MESSAGE_SALLE_DEJA_CONNECTEE, { code: "salle_deja_connectee" });
    }
  }
  postesDeSalle.set(cle, { poste: o.poste, t: maintenant });
}

/**
 * Essai de l'enregistreur (Pilotage de la visio) : 15 secondes d'une page web enregistrées dans le bucket des replays,
 * fichier vérifié puis effacé. Valide le serveur d'enregistrement (Chrome, encodage) et l'envoi vers le bucket avant
 * un vrai cours, sans salle ni participant.
 */
export async function testerEnregistreur(page: string, salleEssai: string): Promise<{ ok: boolean; tailleOctets: number; dureeSecondes: number; message: string; salle: boolean }> {
  const chemin = `essais-enregistreur/test-${Date.now()}.mp4`;
  // Quelqu'un dans la salle d'essai de la nouvelle visio : on enregistre la salle elle-même, comme un vrai cours
  // (réception des vidéos par l'enregistreur, mise en page, envoi au bucket). Sinon, une simple page web.
  const salle = (await presentsLivekit(salleEssai).catch(() => [])).length > 0;
  const info = salle
    ? await enregistreur().startRoomCompositeEgress(salleEssai, sortieBucket(chemin), { layout: "speaker", encodingOptions: EncodingOptionsPreset.H264_720P_30 })
    : await enregistreur().startWebEgress(page, sortieBucket(chemin), { encodingOptions: EncodingOptionsPreset.H264_720P_30 });
  const id = info.egressId;
  const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await attendre(15_000);
  await enregistreur().stopEgress(id).catch(() => undefined);
  for (let i = 0; i < 30; i++) {
    const [e] = await enregistreur().listEgress({ egressId: id });
    if (e && !ACTIFS.has(e.status)) {
      const f = e.fileResults[0];
      const ok = e.status === EgressStatus.EGRESS_COMPLETE && Boolean(f) && Number(f.size) > 0;
      let taille = 0;
      if (ok) {
        const r = config.replays;
        const s3 = new S3Client({ endpoint: r.endpoint!, region: r.region, forcePathStyle: process.env.REPLAYS_FORCE_PATH_STYLE === "1", credentials: { accessKeyId: r.cleId!, secretAccessKey: r.cleSecrete! } });
        taille = Number((await s3.send(new HeadObjectCommand({ Bucket: r.bucket!, Key: f.filename }))).ContentLength ?? 0);
        await s3.send(new DeleteObjectCommand({ Bucket: r.bucket!, Key: f.filename })).catch(() => undefined);
      }
      const quoi = salle ? "la salle d'essai (comme un vrai cours)" : "une page web (entrez dans la salle d'essai de la nouvelle visio pour tester un vrai cours)";
      return {
        ok: ok && taille > 0,
        salle,
        tailleOctets: taille,
        dureeSecondes: f ? Math.round(Number(f.duration) / 1e9) : 0,
        message: ok && taille > 0 ? `L'enregistreur fonctionne avec ${quoi} : le fichier est arrivé dans le bucket des replays (puis effacé).` : `Échec de l'enregistrement de ${quoi} : ${e.error || "fichier absent du bucket"}.`,
      };
    }
    await attendre(2000);
  }
  return { ok: false, salle, tailleOctets: 0, dureeSecondes: 0, message: "L'enregistreur ne répond pas (pas de fin d'enregistrement en 60 s)." };
}
