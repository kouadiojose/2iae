// L'image de la visio quand la salle est servie par LiveKit (serveur du campus) au lieu de Daily.
//
// Chargé à la demande par CadreDaily (React.lazy) : qui reste sur Daily ne télécharge rien de plus. CadreDaily garde
// tout le reste (accès, attente, erreurs, relances, mots) ; ici, la salle elle-même, à l'image de Daily Prebuilt :
// vignettes (la personne qui parle en avant, le partage d'écran en grand), barre du bas en français (micro, caméra et
// choix des appareils, partage d'écran, plein écran), thème de nuit et orange 2IAE (THEME_DAILY).
//
// Pour que le Studio et les écrans de salle gardent toutes leurs fonctions, la salle est présentée comme un appel
// Daily (AppelLivekit, transmis par onAppel) : participants(), événements participant-* / track-* /
// local-screen-share-*, setLocalAudio, setShowLocalVideo, setShowParticipantsBar. scene.tsx n'y voit pas de
// différence : partage d'écran montré en grand, micro du Studio synchronisé, vignette de l'écran de salle.
//
// Réseaux faibles : simulcast (trois tailles de vidéo envoyées), adaptiveStream (chaque vignette reçoit la taille
// qu'elle affiche) et dynacast (une taille que personne ne regarde n'est plus envoyée). Le serveur baisse la qualité
// puis met la vidéo en pause avant de toucher au son (congestion_control, campus/infra/livekit/installer.sh).
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  FocusLayout,
  CarouselLayout,
  FocusLayoutContainer,
  TrackToggle,
  MediaDeviceMenu,
  useTracks,
  useRoomContext,
  useLocalParticipant,
  useTrackRefContext,
  isTrackReference,
  VideoTrack,
  ParticipantPlaceholder,
  TrackMutedIndicator,
  ConnectionQualityIndicator,
} from "@livekit/components-react";
import {
  Track,
  RoomEvent,
  DisconnectReason,
  VideoPresets,
  ConnectionState,
  type Room,
  type RoomOptions,
  type Participant,
  type TrackPublication,
  type LocalVideoTrack,
} from "livekit-client";
import { Maximize2, Minimize2 } from "lucide-react";
import "@livekit/components-styles";
import type { ParticipantCadre, RoleCadre } from "./CadreDaily";
import type { ProblemeVisio } from "./daily";
import { THEME_DAILY } from "./daily";

export type RappelsLivekit = {
  connecte: () => void;
  erreur: (pb: ProblemeVisio) => void;
  participants: (liste: ParticipantCadre[]) => void;
  reseau: (etat: "reconnexion" | "connecte") => void;
  octets: (total: number) => void;
  /** La salle, vue comme un appel Daily (null à la fermeture). */
  appel: (a: AppelLivekit | null) => void;
};

const OPTIONS_SALLE: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    simulcast: true,
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
    videoCodec: "vp8",
    red: true,
    dtx: true,
  },
  videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

const profilDe = (p: Participant): string | null => {
  try {
    return JSON.parse(p.metadata || "{}").profil ?? null;
  } catch {
    return null;
  }
};

function versParticipants(room: Room): ParticipantCadre[] {
  const tous = [room.localParticipant, ...room.remoteParticipants.values()];
  return tous.map((p) => ({
    id: p.identity,
    userId: p.identity.split("~")[0],
    nom: p.name || "Invité",
    local: p === room.localParticipant,
    micro: p.isMicrophoneEnabled,
    camera: p.isCameraEnabled,
    proprietaire: profilDe(p) === "formateur",
  }));
}

// ── La salle LiveKit vue comme un appel Daily (sous-ensemble utilisé par scene.tsx) ──

type EtatPiste = "playable" | "sendable" | "off";
type PisteDaily = { state: EtatPiste; subscribed: boolean; persistentTrack?: MediaStreamTrack; off?: { byUser: boolean } };
export type ParticipantDailyLike = {
  session_id: string;
  user_id: string;
  user_name: string;
  local: boolean;
  owner: boolean;
  permissions: { canSend: boolean | Set<string> };
  tracks: { audio: PisteDaily; video: PisteDaily; screenVideo: PisteDaily };
};

function piste(p: Participant, source: Track.Source, local: boolean): PisteDaily {
  const pub: TrackPublication | undefined = p.getTrackPublication(source);
  if (!pub || !pub.track) return { state: "off", subscribed: false, off: { byUser: Boolean(pub?.isMuted) } };
  const coupee = pub.isMuted;
  return { state: coupee ? "off" : local ? "sendable" : "playable", subscribed: true, persistentTrack: pub.track.mediaStreamTrack, off: { byUser: coupee } };
}

function versDaily(p: Participant, local: boolean): ParticipantDailyLike {
  const perm = p.permissions;
  let canSend: boolean | Set<string> = false;
  if (perm?.canPublish) {
    const sources = perm.canPublishSources ?? [];
    // Sources du protocole LiveKit : 1 caméra, 2 micro, 3 écran, 4 son de l'écran ; vide = toutes.
    canSend = sources.length === 0 ? true : new Set(sources.map((s) => (s === 2 ? "audio" : s === 1 ? "video" : s === 3 ? "screenVideo" : "screenAudio")));
  }
  return {
    session_id: p.identity,
    user_id: p.identity.split("~")[0],
    user_name: p.name || "Invité",
    local,
    owner: profilDe(p) === "formateur",
    permissions: { canSend },
    tracks: { audio: piste(p, Track.Source.Microphone, local), video: piste(p, Track.Source.Camera, local), screenVideo: piste(p, Track.Source.ScreenShare, local) },
  };
}

type Ecouteur = (ev?: Record<string, unknown>) => void;

export class AppelLivekit {
  private ecouteurs = new Map<string, Set<Ecouteur>>();
  constructor(
    private room: Room,
    private surAffichage: (o: { soiVisible?: boolean; barreVisible?: boolean }) => void,
  ) {}

  on(evenement: string, f: Ecouteur) {
    if (!this.ecouteurs.has(evenement)) this.ecouteurs.set(evenement, new Set());
    this.ecouteurs.get(evenement)!.add(f);
    return this;
  }
  off(evenement: string, f: Ecouteur) {
    this.ecouteurs.get(evenement)?.delete(f);
    return this;
  }
  emettre(evenement: string, ev?: Record<string, unknown>) {
    this.ecouteurs.get(evenement)?.forEach((f) => {
      try {
        f(ev);
      } catch {
        /* un écouteur fautif ne casse pas les autres */
      }
    });
  }
  participants(): Record<string, ParticipantDailyLike> {
    const r: Record<string, ParticipantDailyLike> = { local: versDaily(this.room.localParticipant, true) };
    this.room.remoteParticipants.forEach((p) => (r[p.identity] = versDaily(p, false)));
    return r;
  }
  participantDaily(p: Participant) {
    return versDaily(p, p === this.room.localParticipant);
  }
  setLocalAudio(actif: boolean) {
    void this.room.localParticipant.setMicrophoneEnabled(actif).catch(() => undefined);
  }
  setLocalVideo(actif: boolean) {
    void this.room.localParticipant.setCameraEnabled(actif).catch(() => undefined);
  }
  setShowLocalVideo(visible: boolean) {
    this.surAffichage({ soiVisible: visible });
  }
  setShowParticipantsBar(visible: boolean) {
    this.surAffichage({ barreVisible: visible });
  }
  /** Droits d'un autre participant : posés par le serveur à l'entrée (jeton) ; la parole finie, il est sorti par le serveur. */
  updateParticipant() {
    /* sans effet avec LiveKit : voir le jeton (visio-livekit.ts) et la sortie après la parole (routes/live.ts) */
  }
  /** Le replay est lancé par le serveur (tâche « livekit-enregistrements ») : rien à faire côté navigateur. */
  startRecording() {}
  stopRecording() {}
}

/** Problème du cadre pour une déconnexion LiveKit (mêmes genres que Daily : CadreDaily décide de la suite). */
function problemeDeconnexion(raison: DisconnectReason | undefined, tu: boolean): ProblemeVisio | null {
  const t = (a: string, b: string) => (tu ? a : b);
  switch (raison) {
    case DisconnectReason.CLIENT_INITIATED:
      return null;
    case DisconnectReason.PARTICIPANT_REMOVED:
      return { genre: "sortie", texte: t("Tu es sorti de la visio.", "Vous êtes sorti de la visio."), conseil: null, relancer: false };
    case DisconnectReason.DUPLICATE_IDENTITY:
      return {
        genre: "pleine",
        texte: t("Ton compte vient d'entrer dans la visio depuis un autre appareil.", "Ce compte vient d'entrer dans la visio depuis un autre appareil."),
        conseil: t("Ferme l'autre page pour revenir ici.", "Fermez l'autre page pour revenir ici."),
        relancer: false,
      };
    case DisconnectReason.ROOM_DELETED:
      return { genre: "fermee", texte: "La salle est fermée.", conseil: null, relancer: false };
    case DisconnectReason.JOIN_FAILURE:
    case DisconnectReason.SIGNAL_CLOSE:
    case DisconnectReason.STATE_MISMATCH:
    case DisconnectReason.MIGRATION:
      return { genre: "acces", texte: "La visio s'est interrompue. Nouvelle connexion…", conseil: null, relancer: true };
    default:
      return { genre: "reseau", texte: t("La visio a été interrompue.", "La visio a été interrompue."), conseil: null, relancer: false };
  }
}

/** Contenu d'une vignette, en français : image (ou silhouette), nom, micro coupé, qualité du réseau. */
function Vignette() {
  const ref = useTrackRefContext();
  const ecran = ref.source === Track.Source.ScreenShare;
  const nom = ref.participant.name || "Invité";
  return (
    <>
      {isTrackReference(ref) && ref.publication.track && !ref.publication.isMuted ? <VideoTrack trackRef={ref} /> : <ParticipantPlaceholder />}
      <div className="lk-participant-metadata">
        <div className="lk-participant-metadata-item">
          {!ecran && <TrackMutedIndicator trackRef={{ participant: ref.participant, source: Track.Source.Microphone }} show="muted" />}
          <span className="lk-participant-name">{ecran ? `${nom} · écran partagé` : nom}</span>
        </div>
        <ConnectionQualityIndicator className="lk-participant-metadata-item" />
      </div>
    </>
  );
}

/**
 * Vignettes, comme Daily Prebuilt : le partage d'écran en grand avec les caméras en bande, sinon la grille.
 * Écran de salle en mode « diapo en grand » (setShowLocalVideo / setShowParticipantsBar à faux) : seulement le
 * formateur (ou, à défaut, les autres), sans l'image de la salle elle-même.
 */
function Scene({ soiVisible, barreVisible }: { soiVisible: boolean; barreVisible: boolean }) {
  const toutes = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  let pistes = soiVisible ? toutes : toutes.filter((p) => !p.participant.isLocal);
  if (!barreVisible) {
    const formateur = pistes.filter((p) => profilDe(p.participant) === "formateur");
    if (formateur.length) pistes = formateur;
  }
  const ecran = pistes.find((p) => p.source === Track.Source.ScreenShare);
  if (ecran) {
    const autres = pistes.filter((p) => p !== ecran);
    return (
      <FocusLayoutContainer className="h-full">
        {barreVisible && autres.length > 0 && (
          <CarouselLayout tracks={autres}>
            <ParticipantTile>
              <Vignette />
            </ParticipantTile>
          </CarouselLayout>
        )}
        <FocusLayout trackRef={ecran}>
          <Vignette />
        </FocusLayout>
      </FocusLayoutContainer>
    );
  }
  return (
    <GridLayout tracks={pistes} className="h-full">
      <ParticipantTile>
        <Vignette />
      </ParticipantTile>
    </GridLayout>
  );
}

/** Barre du bas, en français : micro et caméra (avec le choix de l'appareil), partage d'écran, plein écran. */
const CLE_FLOU = "visio-flou";
const lireFlou = () => {
  try {
    return localStorage.getItem(CLE_FLOU) === "1";
  } catch {
    return false;
  }
};

/**
 * Flou d'arrière-plan (comme dans Daily) : traitement de l'image de la caméra dans le navigateur
 * (@livekit/track-processors, chargé à la demande). Le choix est gardé sur cet appareil et réappliqué
 * quand la caméra se rallume.
 */
function BoutonFlou() {
  const { cameraTrack, isCameraEnabled } = useLocalParticipant();
  const [flou, setFlou] = useState(lireFlou);
  const [indispo, setIndispo] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const piste = cameraTrack?.track as LocalVideoTrack | undefined;
  useEffect(() => {
    if (!piste || !isCameraEnabled) return;
    let annule = false;
    void (async () => {
      try {
        const tp = await import("@livekit/track-processors");
        if (!tp.supportsBackgroundProcessors()) {
          if (!annule) setIndispo(true);
          return;
        }
        const actuel = piste.getProcessor();
        if (flou && !actuel) await piste.setProcessor(tp.BackgroundBlur(12));
        else if (!flou && actuel) await piste.stopProcessor();
      } catch (e) {
        console.warn("[visio] flou d'arrière-plan :", (e as Error).message);
        if (!annule) setIndispo(true);
      } finally {
        if (!annule) setOccupe(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [piste, isCameraEnabled, flou]);
  if (indispo) return null;
  return (
    <button
      type="button"
      className="lk-button"
      aria-pressed={flou}
      disabled={occupe || !isCameraEnabled}
      title={isCameraEnabled ? "Flouter l'arrière-plan de la caméra" : "Allumez la caméra pour flouter l'arrière-plan"}
      onClick={() => {
        const v = !flou;
        setOccupe(true);
        setFlou(v);
        try {
          localStorage.setItem(CLE_FLOU, v ? "1" : "0");
        } catch {
          /* stockage indisponible */
        }
      }}
      style={flou ? { background: "#E4793A", color: "#fff" } : undefined}
    >
      {flou ? "Flou activé" : "Flou"}
    </button>
  );
}

function Barre({ micro, camera, ecran, pleinEcran, onPleinEcran }: { micro: boolean; camera: boolean; ecran: boolean; pleinEcran: boolean; onPleinEcran: () => void }) {
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  return (
    <div className="lk-control-bar" style={{ justifyContent: "center", flexWrap: "wrap", gap: "0.4rem", padding: "0.5rem", borderTop: `1px solid ${THEME_DAILY.colors.border}` }}>
      {micro && (
        <div className="lk-button-group">
          <TrackToggle source={Track.Source.Microphone} showIcon>
            {isMicrophoneEnabled ? "Micro" : "Micro coupé"}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu kind="audioinput" />
          </div>
        </div>
      )}
      {camera && (
        <div className="lk-button-group">
          <TrackToggle source={Track.Source.Camera} showIcon>
            {isCameraEnabled ? "Caméra" : "Caméra coupée"}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu kind="videoinput" />
          </div>
        </div>
      )}
      {camera && <BoutonFlou />}
      {ecran && (
        <TrackToggle source={Track.Source.ScreenShare} captureOptions={{ audio: true, selfBrowserSurface: "include" }} showIcon>
          {isScreenShareEnabled ? "Arrêter le partage" : "Partager"}
        </TrackToggle>
      )}
      <button type="button" className="lk-button" onClick={onPleinEcran} aria-label={pleinEcran ? "Quitter le plein écran" : "Plein écran"}>
        {pleinEcran ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Événements de la salle → rappels du cadre et de l'appel « Daily » ; micro et caméra pilotés par le parent. */
function Ecouteur({
  rappels,
  micro,
  camera,
  tu,
  surAffichage,
}: {
  rappels: React.MutableRefObject<RappelsLivekit>;
  micro?: boolean;
  camera?: boolean;
  tu: boolean;
  surAffichage: (o: { soiVisible?: boolean; barreVisible?: boolean }) => void;
}) {
  const room = useRoomContext();
  const recu = useRef(0);
  const appel = useRef<AppelLivekit | null>(null);
  useEffect(() => {
    const a = new AppelLivekit(room, surAffichage);
    appel.current = a;
    const participants = () => rappels.current.participants(versParticipants(room));
    const maj = (p?: Participant) => {
      participants();
      if (p) a.emettre("participant-updated", { participant: a.participantDaily(p) });
    };
    const arrivee = (p: Participant) => {
      participants();
      a.emettre("participant-joined", { participant: a.participantDaily(p) });
    };
    const depart = (p: Participant) => {
      participants();
      a.emettre("participant-left", { participant: a.participantDaily(p) });
    };
    const surPisteMuette = (_pub: unknown, p: Participant) => maj(p);
    const debutPiste = (t: Track, _pub: unknown, p: Participant) => {
      maj(p);
      a.emettre("track-started", { participant: a.participantDaily(p), track: t.mediaStreamTrack });
    };
    const finPiste = (t: Track, _pub: unknown, p: Participant) => {
      maj(p);
      a.emettre("track-stopped", { participant: a.participantDaily(p), track: t.mediaStreamTrack });
    };
    const localPubliee = (pub: TrackPublication) => {
      maj(room.localParticipant);
      if (pub.source === Track.Source.ScreenShare) a.emettre("local-screen-share-started");
    };
    const localRetiree = (pub: TrackPublication) => {
      maj(room.localParticipant);
      if (pub.source === Track.Source.ScreenShare) a.emettre("local-screen-share-stopped");
    };
    const surDroits = (_avant: unknown, p: Participant) => maj(p);
    const surEtat = (etat: ConnectionState) => {
      if (etat === ConnectionState.Reconnecting || etat === ConnectionState.SignalReconnecting) rappels.current.reseau("reconnexion");
      if (etat === ConnectionState.Connected) rappels.current.reseau("connecte");
    };
    const surDeconnexion = (raison?: DisconnectReason) => {
      const pb = problemeDeconnexion(raison, tu);
      if (pb) rappels.current.erreur(pb);
    };
    room
      .on(RoomEvent.ParticipantConnected, arrivee)
      .on(RoomEvent.ParticipantDisconnected, depart)
      .on(RoomEvent.TrackMuted, surPisteMuette)
      .on(RoomEvent.TrackUnmuted, surPisteMuette)
      .on(RoomEvent.TrackPublished, surPisteMuette)
      .on(RoomEvent.TrackUnpublished, surPisteMuette)
      .on(RoomEvent.TrackSubscribed, debutPiste)
      .on(RoomEvent.TrackUnsubscribed, finPiste)
      .on(RoomEvent.LocalTrackPublished, localPubliee)
      .on(RoomEvent.LocalTrackUnpublished, localRetiree)
      .on(RoomEvent.ParticipantPermissionsChanged, surDroits)
      .on(RoomEvent.ConnectionStateChanged, surEtat)
      .on(RoomEvent.Disconnected, surDeconnexion);
    if (room.state === ConnectionState.Connected) participants();
    rappels.current.appel(a);
    return () => {
      room
        .off(RoomEvent.ParticipantConnected, arrivee)
        .off(RoomEvent.ParticipantDisconnected, depart)
        .off(RoomEvent.ParticipantPermissionsChanged, surDroits)
        .off(RoomEvent.TrackMuted, surPisteMuette)
        .off(RoomEvent.TrackUnmuted, surPisteMuette)
        .off(RoomEvent.TrackPublished, surPisteMuette)
        .off(RoomEvent.TrackUnpublished, surPisteMuette)
        .off(RoomEvent.TrackSubscribed, debutPiste)
        .off(RoomEvent.TrackUnsubscribed, finPiste)
        .off(RoomEvent.LocalTrackPublished, localPubliee)
        .off(RoomEvent.LocalTrackUnpublished, localRetiree)
        .off(RoomEvent.ConnectionStateChanged, surEtat)
        .off(RoomEvent.Disconnected, surDeconnexion);
      appel.current = null;
      rappels.current.appel(null);
    };
  }, [room]);

  useEffect(() => {
    if (micro !== undefined && room.state === ConnectionState.Connected) void room.localParticipant.setMicrophoneEnabled(micro).catch(() => undefined);
  }, [micro, room.state]);
  useEffect(() => {
    if (camera !== undefined && room.state === ConnectionState.Connected) void room.localParticipant.setCameraEnabled(camera).catch(() => undefined);
  }, [camera, room.state]);

  // Consommation : octets reçus par la connexion (statistiques WebRTC du récepteur), toutes les 5 s.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const pc = (room.engine as unknown as { pcManager?: { subscriber?: { getStats: () => Promise<RTCStatsReport> } } }).pcManager?.subscriber;
        const stats = await pc?.getStats();
        let total = 0;
        stats?.forEach((s) => {
          if (s.type === "transport" && typeof (s as { bytesReceived?: number }).bytesReceived === "number") total += (s as { bytesReceived: number }).bytesReceived;
        });
        if (total > recu.current) {
          recu.current = total;
          rappels.current.octets(total);
        }
      } catch {
        /* statistiques indisponibles */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [room]);
  return null;
}

/** Couleurs de LiveKit calées sur le thème Daily du campus (nuit, orange 2IAE). */
const THEME_SALLE = {
  "--lk-bg": THEME_DAILY.colors.mainAreaBg,
  "--lk-bg2": THEME_DAILY.colors.background,
  "--lk-bg3": THEME_DAILY.colors.backgroundAccent,
  "--lk-bg4": THEME_DAILY.colors.border,
  "--lk-fg": THEME_DAILY.colors.baseText,
  "--lk-fg2": THEME_DAILY.colors.supportiveText,
  "--lk-accent-bg": THEME_DAILY.colors.accent,
  "--lk-accent-fg": THEME_DAILY.colors.accentText,
  "--lk-accent2": "#C85F22",
  "--lk-accent3": "#A34C17",
  "--lk-accent4": "#7A3810",
  "--lk-control-bg": THEME_DAILY.colors.backgroundAccent,
  "--lk-control-hover-bg": THEME_DAILY.colors.border,
  "--lk-border-radius": "12px",
  borderRadius: "20px",
  overflow: "hidden",
  background: THEME_DAILY.colors.background,
} as CSSProperties;

export default function VueLivekit(p: {
  url: string;
  jeton: string;
  role: RoleCadre;
  tu: boolean;
  micro?: boolean;
  camera?: boolean;
  cameraAuDepart: boolean;
  microAuDepart: boolean;
  rappels: React.MutableRefObject<RappelsLivekit>;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [affichage, setAffichage] = useState({ soiVisible: true, barreVisible: true });
  const [pleinEcran, setPleinEcran] = useState(false);
  // Micro ou caméra indisponible (autorisation, autre application, casque débranché) : un bandeau, sans couper la visio.
  const [avisAppareil, setAvisAppareil] = useState<string | null>(null);
  useEffect(() => {
    if (!avisAppareil) return;
    const t = window.setTimeout(() => setAvisAppareil(null), 12_000);
    return () => window.clearTimeout(t);
  }, [avisAppareil]);
  useEffect(() => {
    const maj = () => setPleinEcran(document.fullscreenElement === conteneur.current);
    document.addEventListener("fullscreenchange", maj);
    return () => document.removeEventListener("fullscreenchange", maj);
  }, []);
  const basculerPleinEcran = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void conteneur.current?.requestFullscreen?.().catch(() => undefined);
  };
  // Mêmes boutons que Daily selon le rôle : le formateur a tout ; une salle, micro et caméra ; l'étudiant à qui l'on
  // donne la parole, le micro ; l'équipe qui observe, rien à envoyer.
  const micro = p.role !== "observateur";
  const camera = p.role === "formateur" || p.role === "salle";
  const ecran = p.role === "formateur";
  return (
    <div ref={conteneur} className="h-full w-full" style={{ borderRadius: "20px", overflow: "hidden", background: THEME_DAILY.colors.background }}>
      <LiveKitRoom
        serverUrl={p.url}
        token={p.jeton}
        connect
        audio={p.microAuDepart}
        video={p.cameraAuDepart}
        options={OPTIONS_SALLE}
        onConnected={() => p.rappels.current.connecte()}
        onError={(e) => p.rappels.current.erreur({ genre: "reseau", texte: e.message || "La visio n'arrive pas à se connecter.", conseil: null, relancer: false })}
        onMediaDeviceFailure={(echec, genre) => {
          const quoi = genre === "videoinput" ? (p.tu ? "Ta caméra" : "La caméra") : genre === "audioinput" ? (p.tu ? "Ton micro" : "Le micro") : p.tu ? "Ton micro ou ta caméra" : "Le micro ou la caméra";
          const pourquoi =
            echec === "PermissionDenied"
              ? p.tu
                ? "est bloqué : autorise-le dans la barre d'adresse."
                : "est bloqué : autorisez-le dans la barre d'adresse."
              : echec === "DeviceInUse"
                ? p.tu
                  ? "est pris par une autre application : ferme-la, puis touche le bouton pour réessayer."
                  : "est pris par une autre application (Zoom, Teams…) : fermez-la, puis touchez le bouton pour réessayer."
                : echec === "NotFound"
                  ? "est introuvable : vérifiez qu'il est branché."
                  : p.tu
                    ? "ne répond pas : touche le bouton pour réessayer."
                    : "ne répond pas : touchez le bouton pour réessayer.";
          setAvisAppareil(`${quoi} ${pourquoi}`);
        }}
        data-lk-theme="default"
        className="flex h-full w-full flex-col"
        // Couleurs posées sur l'élément du thème lui-même (data-lk-theme les redéfinit sinon).
        style={{ ...THEME_SALLE, background: THEME_DAILY.colors.mainAreaBg }}
      >
        {avisAppareil && (
          <div role="status" className="mx-1.5 mt-1.5 rounded-xl bg-[#FFF4E5] px-3 py-2 text-[14px] font-semibold text-[#7A3E00]">
            {avisAppareil}
          </div>
        )}
        <div className="min-h-0 flex-1 p-1.5">
          <Scene soiVisible={affichage.soiVisible} barreVisible={affichage.barreVisible} />
        </div>
        {(micro || camera || ecran) && <Barre micro={micro} camera={camera} ecran={ecran} pleinEcran={pleinEcran} onPleinEcran={basculerPleinEcran} />}
        <RoomAudioRenderer />
        <Ecouteur rappels={p.rappels} micro={p.micro} camera={p.camera} tu={p.tu} surAffichage={(o) => setAffichage((a) => ({ ...a, ...o }))} />
      </LiveKitRoom>
    </div>
  );
}
