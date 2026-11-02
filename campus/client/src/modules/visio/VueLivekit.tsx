// L'image de la visio quand la salle est servie par LiveKit (serveur du campus) au lieu de Daily.
//
// Chargé à la demande par CadreDaily (React.lazy) : qui reste sur Daily ne télécharge rien de plus. CadreDaily garde
// tout le reste (accès, attente, erreurs, relances, mots) ; ici, seulement la salle : vignettes, partage d'écran,
// boutons micro / caméra / écran, son, et les événements traduits pour le cadre.
//
// Réseaux faibles : simulcast (trois tailles de vidéo envoyées), adaptiveStream (chaque vignette reçoit la taille
// qu'elle affiche) et dynacast (une taille que personne ne regarde n'est plus envoyée). Le serveur baisse la qualité
// puis met la vidéo en pause avant de toucher au son (congestion_control, campus/infra/livekit/installer.sh).
import { useEffect, useRef } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  ControlBar,
  RoomAudioRenderer,
  FocusLayout,
  CarouselLayout,
  FocusLayoutContainer,
  useTracks,
  useRoomContext,
} from "@livekit/components-react";
import { Track, RoomEvent, DisconnectReason, VideoPresets, ConnectionState, type Room, type RoomOptions } from "livekit-client";
import "@livekit/components-styles";
import type { ParticipantCadre, RoleCadre } from "./CadreDaily";
import type { ProblemeVisio } from "./daily";

export type RappelsLivekit = {
  connecte: () => void;
  erreur: (pb: ProblemeVisio) => void;
  participants: (liste: ParticipantCadre[]) => void;
  reseau: (etat: "reconnexion" | "connecte") => void;
  octets: (total: number) => void;
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

function versParticipants(room: Room): ParticipantCadre[] {
  const tous = [room.localParticipant, ...room.remoteParticipants.values()];
  return tous.map((p) => {
    let proprietaire = false;
    try {
      proprietaire = JSON.parse(p.metadata || "{}").profil === "formateur";
    } catch {
      /* métadonnées absentes */
    }
    return {
      id: p.sid || p.identity,
      userId: p.identity,
      nom: p.name || "Invité",
      local: p === room.localParticipant,
      micro: p.isMicrophoneEnabled,
      camera: p.isCameraEnabled,
      proprietaire,
    };
  });
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

/** Vignettes : le partage d'écran en grand quand il y en a un, sinon la grille des caméras. */
function Scene() {
  const pistes = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const ecran = pistes.find((p) => p.source === Track.Source.ScreenShare);
  if (ecran) {
    return (
      <FocusLayoutContainer className="h-full">
        <CarouselLayout tracks={pistes.filter((p) => p !== ecran)}>
          <ParticipantTile />
        </CarouselLayout>
        <FocusLayout trackRef={ecran} />
      </FocusLayoutContainer>
    );
  }
  return (
    <GridLayout tracks={pistes} className="h-full">
      <ParticipantTile />
    </GridLayout>
  );
}

/** Événements de la salle → rappels du cadre ; micro et caméra pilotés par le parent. */
function Ecouteur({ rappels, micro, camera, tu }: { rappels: React.MutableRefObject<RappelsLivekit>; micro?: boolean; camera?: boolean; tu: boolean }) {
  const room = useRoomContext();
  const recu = useRef(0);
  useEffect(() => {
    const participants = () => rappels.current.participants(versParticipants(room));
    const surEtat = (etat: ConnectionState) => {
      if (etat === ConnectionState.Reconnecting || etat === ConnectionState.SignalReconnecting) rappels.current.reseau("reconnexion");
      if (etat === ConnectionState.Connected) rappels.current.reseau("connecte");
    };
    const surDeconnexion = (raison?: DisconnectReason) => {
      const pb = problemeDeconnexion(raison, tu);
      if (pb) rappels.current.erreur(pb);
    };
    room
      .on(RoomEvent.ParticipantConnected, participants)
      .on(RoomEvent.ParticipantDisconnected, participants)
      .on(RoomEvent.TrackMuted, participants)
      .on(RoomEvent.TrackUnmuted, participants)
      .on(RoomEvent.LocalTrackPublished, participants)
      .on(RoomEvent.TrackPublished, participants)
      .on(RoomEvent.ConnectionStateChanged, surEtat)
      .on(RoomEvent.Disconnected, surDeconnexion);
    if (room.state === ConnectionState.Connected) participants();
    return () => {
      room
        .off(RoomEvent.ParticipantConnected, participants)
        .off(RoomEvent.ParticipantDisconnected, participants)
        .off(RoomEvent.TrackMuted, participants)
        .off(RoomEvent.TrackUnmuted, participants)
        .off(RoomEvent.LocalTrackPublished, participants)
        .off(RoomEvent.TrackPublished, participants)
        .off(RoomEvent.ConnectionStateChanged, surEtat)
        .off(RoomEvent.Disconnected, surDeconnexion);
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
  const emetteur = p.role === "formateur" || p.role === "salle" || p.role === "observateur";
  return (
    <LiveKitRoom
      serverUrl={p.url}
      token={p.jeton}
      connect
      audio={p.microAuDepart}
      video={p.cameraAuDepart}
      options={OPTIONS_SALLE}
      onConnected={() => p.rappels.current.connecte()}
      onError={(e) => p.rappels.current.erreur({ genre: "reseau", texte: e.message || "La visio n'arrive pas à se connecter.", conseil: null, relancer: false })}
      onMediaDeviceFailure={() =>
        p.rappels.current.erreur({
          genre: "navigateur",
          texte: p.tu ? "Ton micro ou ta caméra est bloqué." : "Le micro ou la caméra est bloqué.",
          conseil: p.tu ? "Autorise le micro dans la barre d'adresse, puis recharge la page." : "Autorisez le micro et la caméra dans la barre d'adresse, puis rechargez la page.",
          relancer: false,
        })
      }
      data-lk-theme="default"
      className="flex h-full w-full flex-col bg-nuit"
    >
      <div className="min-h-0 flex-1">
        <Scene />
      </div>
      {emetteur && <ControlBar variation="minimal" controls={{ leave: false, chat: false, microphone: true, camera: true, screenShare: p.role === "formateur" || p.role === "observateur" }} />}
      <RoomAudioRenderer />
      <Ecouteur rappels={p.rappels} micro={p.micro} camera={p.camera} tu={p.tu} />
    </LiveKitRoom>
  );
}
