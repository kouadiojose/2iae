// Une connexion WebRTC entre le formateur (centre de l'étoile) et une salle
// ou un étudiant.
//
// Négociation « parfaite » (perfect negotiation) : le formateur est le côté
// « impoli » (son offre gagne en cas de collision), la salle ou l'étudiant
// le côté « poli ». C'est TOUJOURS le formateur qui ouvre la connexion : il
// prépare une ligne par piste, avec son rôle, pour ne plus jamais avoir à
// renégocier quand la parole change de main (on remplace la piste d'une
// ligne existante avec replaceTrack) :
//
//   ligne                 formateur → salle        formateur → étudiant
//   audio                 son ⇄ son de la salle     son ⇄ micro (quand il a la parole)
//   video                 image ⇄ image de salle    image basse déf. (ou rien en son seul)
//   relaisAudioSalle      son de la salle qui a la parole
//   relaisVideoSalle      image de la salle qui a la parole (salles seulement)
//   relaisAudioEtudiant   son de l'étudiant qui a la parole
//
// Reconnexion : redémarrage ICE après une coupure (le côté formateur d'abord),
// puis, si rien n'y fait, le formateur recrée la connexion de zéro (nouvel
// identifiant de connexion : l'autre côté repart proprement).
import type { RoleVisio, TypeSignalVisio } from "@shared/schema";
import type { DonneesSignal } from "./signalisation";
import { idAleatoire } from "./medias";

export type Etiquette = "audio" | "video" | "relaisAudioSalle" | "relaisVideoSalle" | "relaisAudioEtudiant";
export type EtatPair = "connexion" | "connecte" | "reconnexion" | "ferme";

/** Petits messages par le canal de données de la connexion (pas de serveur, pas de nom d'étudiant vers les salles). */
export type MessageCanal =
  | { t: "medias"; micro: boolean; camera: boolean }
  | { t: "parole"; salle: string | null; etudiant: boolean; vous: boolean };

type Ligne = { etiquette: Etiquette; kind: "audio" | "video"; direction: RTCRtpTransceiverDirection };

/** Lignes préparées par le formateur selon le participant. */
const PLAN: Record<"salle" | "etudiant", Ligne[]> = {
  salle: [
    { etiquette: "audio", kind: "audio", direction: "sendrecv" },
    { etiquette: "video", kind: "video", direction: "sendrecv" },
    { etiquette: "relaisAudioSalle", kind: "audio", direction: "sendonly" },
    { etiquette: "relaisVideoSalle", kind: "video", direction: "sendonly" },
    { etiquette: "relaisAudioEtudiant", kind: "audio", direction: "sendonly" },
  ],
  etudiant: [
    { etiquette: "audio", kind: "audio", direction: "sendrecv" },
    { etiquette: "video", kind: "video", direction: "sendonly" },
    { etiquette: "relaisAudioSalle", kind: "audio", direction: "sendonly" },
    { etiquette: "relaisAudioEtudiant", kind: "audio", direction: "sendonly" },
  ],
};

/**
 * Plafonds d'envoi (RTCRtpSender.setParameters). Le formateur encode sa vidéo
 * une fois par connexion : 540p à 800 kbit/s vers les salles (grand écran),
 * 270p à 200 kbit/s vers les téléphones ; les salles envoient du 360p.
 */
function plafond(moi: RoleVisio, etiquette: Etiquette, distant: RoleVisio): RTCRtpEncodingParameters | null {
  const son = (maxBitrate: number): RTCRtpEncodingParameters => ({ maxBitrate, priority: "high", networkPriority: "high" });
  if (moi === "formateur") {
    if (etiquette === "video") {
      return distant === "salle" ? { maxBitrate: 800_000, maxFramerate: 24 } : { maxBitrate: 200_000, maxFramerate: 15, scaleResolutionDownBy: 2 };
    }
    if (etiquette === "relaisVideoSalle") return { maxBitrate: 300_000, maxFramerate: 15 };
    return son(distant === "salle" ? 40_000 : 32_000);
  }
  if (moi === "salle") return etiquette === "video" ? { maxBitrate: 350_000, maxFramerate: 20 } : etiquette === "audio" ? son(40_000) : null;
  return etiquette === "audio" ? son(24_000) : null;
}

export type OptionsPair = {
  moi: RoleVisio;
  distant: { pairId: string; role: RoleVisio };
  /** Côté salle/étudiant : identifiant de connexion reçu dans l'offre du formateur. */
  connexion?: string;
  iceServers: RTCIceServer[];
  envoyer: (type: TypeSignalVisio, donnees: DonneesSignal) => void;
  candidat: (connexion: string, c: RTCIceCandidateInit) => void;
  surPiste: (etiquette: Etiquette, piste: MediaStreamTrack) => void;
  surEtat: (etat: EtatPair) => void;
  surMessage: (m: MessageCanal) => void;
  /** Rien n'y fait (redémarrages ICE sans effet, offre sans réponse) : à recréer ou à rejoindre de nouveau. */
  surEchec: () => void;
};

declare global {
  interface Window {
    /** Développement seulement : connexions ouvertes, pour les tests automatisés. */
    __visioPairs?: Set<PairWebRTC>;
  }
}

export class PairWebRTC {
  readonly pc: RTCPeerConnection;
  readonly connexionId: string;
  readonly etiquettesParMid = new Map<string, Etiquette>();
  etat: EtatPair = "connexion";

  private readonly poli: boolean;
  private readonly canal: RTCDataChannel;
  private enOffre = false;
  private ignorerOffre = false;
  private reponseEnAttente = false;
  private file: Promise<void> = Promise.resolve();
  private transceivers = new Map<Etiquette, RTCRtpTransceiver>();
  private pistesLocales = new Map<Etiquette, MediaStreamTrack | null>();
  private messagesEnAttente = new Map<string, MessageCanal>();
  private recevoirVideo = true;
  private ferme = false;
  private redemarrages = 0;
  private minuteurIce: ReturnType<typeof setTimeout> | null = null;
  private minuteurReponse: ReturnType<typeof setTimeout> | null = null;

  constructor(private o: OptionsPair) {
    this.poli = o.moi !== "formateur";
    this.connexionId = o.connexion ?? idAleatoire(16);
    this.pc = new RTCPeerConnection({ iceServers: o.iceServers, bundlePolicy: "max-bundle", rtcpMuxPolicy: "require" });

    // Canal de données « négocié » : les deux côtés le créent avec le même numéro, sans échange supplémentaire.
    this.canal = this.pc.createDataChannel("campus", { negotiated: true, id: 0 });
    this.canal.onopen = () => {
      for (const m of this.messagesEnAttente.values()) this.canal.send(JSON.stringify(m));
    };
    this.canal.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data)) as MessageCanal;
        if (m && (m.t === "medias" || m.t === "parole")) this.o.surMessage(m);
      } catch {
        /* message illisible : ignoré */
      }
    };

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate && !this.ferme) this.o.candidat(this.connexionId, candidate.toJSON());
    };
    this.pc.onnegotiationneeded = () => void this.negocier();
    this.pc.ontrack = (ev) => {
      const etiquette = ev.transceiver.mid ? this.etiquettesParMid.get(ev.transceiver.mid) : undefined;
      if (etiquette) this.o.surPiste(etiquette, ev.track);
    };
    this.pc.onconnectionstatechange = () => this.surConnexion();

    if (!this.poli) this.preparerLignes();
    if (import.meta.env.DEV) (window.__visioPairs ??= new Set()).add(this);
  }

  get estFerme() {
    return this.ferme;
  }

  /** Piste locale à envoyer sur une ligne (null = rien). Sans renégociation. */
  definirPiste(etiquette: Etiquette, piste: MediaStreamTrack | null) {
    if (this.pistesLocales.has(etiquette) && this.pistesLocales.get(etiquette) === piste) return;
    this.pistesLocales.set(etiquette, piste);
    const t = this.transceivers.get(etiquette);
    if (!t || this.ferme) return;
    t.sender
      .replaceTrack(piste)
      .then(() => this.plafonner(t, etiquette))
      .catch(() => undefined);
  }

  /** Étudiant : recevoir la vidéo du formateur, ou seulement le son (données réduites, écran éteint). */
  definirReceptionVideo(oui: boolean) {
    if (this.recevoirVideo === oui) return;
    this.recevoirVideo = oui;
    const t = this.transceivers.get("video");
    if (t && this.o.moi === "etudiant" && !this.ferme) t.direction = oui ? "recvonly" : "inactive";
  }

  envoyerMessage(m: MessageCanal) {
    this.messagesEnAttente.set(m.t, m);
    if (this.canal.readyState === "open") this.canal.send(JSON.stringify(m));
  }

  /** Traite un message de négociation reçu (dans l'ordre d'arrivée). */
  recevoir(type: TypeSignalVisio, d: DonneesSignal) {
    this.file = this.file.then(() => this.traiter(type, d)).catch((e) => console.warn("[visio] négociation :", (e as Error).message));
  }

  /** Mesures pour l'indicateur de réseau et les tests. */
  async mesurer(): Promise<{ octetsRecus: number; octetsEnvoyes: number; rtt: number | null; pertes: number; relais: boolean }> {
    const r = { octetsRecus: 0, octetsEnvoyes: 0, rtt: null as number | null, pertes: 0, relais: false };
    if (this.ferme) return r;
    let recus = 0;
    let perdus = 0;
    const rapport = await this.pc.getStats();
    const locaux = new Map<string, string>();
    rapport.forEach((s: RTCStats & Record<string, unknown>) => {
      if (s.type === "local-candidate") locaux.set(s.id, String(s.candidateType ?? ""));
    });
    rapport.forEach((s: RTCStats & Record<string, unknown>) => {
      if (s.type === "inbound-rtp") {
        r.octetsRecus += Number(s.bytesReceived ?? 0);
        recus += Number(s.packetsReceived ?? 0);
        perdus += Number(s.packetsLost ?? 0);
      } else if (s.type === "outbound-rtp") {
        r.octetsEnvoyes += Number(s.bytesSent ?? 0);
      } else if (s.type === "candidate-pair" && s.nominated && s.state === "succeeded") {
        if (typeof s.currentRoundTripTime === "number") r.rtt = s.currentRoundTripTime;
        if (locaux.get(String(s.localCandidateId)) === "relay") r.relais = true;
      }
    });
    r.pertes = recus + perdus > 0 ? perdus / (recus + perdus) : 0;
    return r;
  }

  /** Ferme la connexion ; `prevenir` envoie « raccrocher » à l'autre côté. */
  fermer(prevenir = true) {
    if (this.ferme) return;
    this.ferme = true;
    this.annulerMinuteurs();
    if (prevenir) this.o.envoyer("raccrocher", { connexion: this.connexionId });
    try {
      this.pc.close();
    } catch {
      /* déjà fermée */
    }
    if (import.meta.env.DEV) window.__visioPairs?.delete(this);
    this.changerEtat("ferme");
  }

  // ── Négociation ──────────────────────────────────────────────────────────

  private preparerLignes() {
    const role = this.o.distant.role === "salle" ? "salle" : "etudiant";
    for (const l of PLAN[role]) {
      const enc = plafond(this.o.moi, l.etiquette, this.o.distant.role);
      const t = this.pc.addTransceiver(l.kind, { direction: l.direction, sendEncodings: enc ? [enc] : undefined });
      this.transceivers.set(l.etiquette, t);
      const piste = this.pistesLocales.get(l.etiquette);
      if (piste) void t.sender.replaceTrack(piste).catch(() => undefined);
    }
  }

  /** Rôle de chaque ligne, par mid (le formateur l'envoie avec chaque offre). */
  private pistesParMid(): Record<string, Etiquette> {
    const r: Record<string, Etiquette> = {};
    for (const [etiquette, t] of this.transceivers) {
      if (!t.mid) continue;
      r[t.mid] = etiquette;
      this.etiquettesParMid.set(t.mid, etiquette);
    }
    return r;
  }

  private async negocier() {
    if (this.ferme) return;
    // La salle ou l'étudiant n'ouvre jamais la première négociation : il attend l'offre du formateur.
    if (this.poli && !this.pc.currentRemoteDescription) return;
    try {
      this.enOffre = true;
      await this.pc.setLocalDescription();
      this.envoyerDescription("offre");
    } catch (e) {
      console.warn("[visio] offre :", (e as Error).message);
    } finally {
      this.enOffre = false;
    }
  }

  private envoyerDescription(type: "offre" | "reponse") {
    const d = this.pc.localDescription;
    if (!d || this.ferme) return;
    this.o.envoyer(type, {
      connexion: this.connexionId,
      description: { type: d.type, sdp: d.sdp },
      pistes: this.poli ? undefined : this.pistesParMid(),
    });
    if (type === "offre") {
      // Sans réponse dans les 15 s (message perdu, participant parti) : on recommence.
      if (this.minuteurReponse) clearTimeout(this.minuteurReponse);
      this.minuteurReponse = setTimeout(() => {
        this.minuteurReponse = null;
        if (!this.ferme && this.pc.signalingState === "have-local-offer") this.o.surEchec();
      }, 15_000);
    }
  }

  private async traiter(type: TypeSignalVisio, d: DonneesSignal) {
    if (this.ferme) return;
    // Connexion fermée sous nos pieds (onglet gelé, navigateur qui l'a libérée) : on raccroche pour repartir de zéro.
    if (this.pc.signalingState === "closed") {
      this.fermer(type !== "raccrocher");
      return;
    }
    if (type === "raccrocher") {
      this.fermer(false);
      return;
    }
    if (type === "ice") {
      for (const c of d.candidats ?? []) {
        try {
          await this.pc.addIceCandidate(c);
        } catch (e) {
          if (!this.ignorerOffre) console.warn("[visio] candidat :", (e as Error).message);
        }
      }
      return;
    }
    const description = d.description;
    if (!description) return;
    if (d.pistes) for (const [mid, etiquette] of Object.entries(d.pistes)) this.etiquettesParMid.set(mid, etiquette as Etiquette);

    const pretPourOffre = !this.enOffre && (this.pc.signalingState === "stable" || this.reponseEnAttente);
    const collision = description.type === "offer" && !pretPourOffre;
    this.ignorerOffre = !this.poli && collision;
    if (this.ignorerOffre) return;

    this.reponseEnAttente = description.type === "answer";
    await this.pc.setRemoteDescription(description);
    this.reponseEnAttente = false;

    if (description.type === "answer") {
      if (this.minuteurReponse) clearTimeout(this.minuteurReponse);
      this.minuteurReponse = null;
      this.plafonnerTout();
      return;
    }
    if (this.poli) this.configurerLignesRecues();
    await this.pc.setLocalDescription();
    this.envoyerDescription("reponse");
    this.plafonnerTout();
  }

  /** Salle ou étudiant : attache ses pistes aux lignes proposées par le formateur. */
  private configurerLignesRecues() {
    for (const t of this.pc.getTransceivers()) {
      const etiquette = t.mid ? this.etiquettesParMid.get(t.mid) : undefined;
      if (!etiquette || t.currentDirection === "stopped") continue;
      this.transceivers.set(etiquette, t);
      if (etiquette === "audio" || (etiquette === "video" && this.o.moi === "salle")) {
        // Toujours en émission-réception : couper ou rouvrir le micro ne demandera pas de renégocier.
        if (t.direction !== "sendrecv") t.direction = "sendrecv";
        const piste = this.pistesLocales.get(etiquette) ?? null;
        if (t.sender.track !== piste) void t.sender.replaceTrack(piste).catch(() => undefined);
      } else if (etiquette === "video") {
        const voulu = this.recevoirVideo ? "recvonly" : "inactive";
        if (t.direction !== voulu) t.direction = voulu;
      } else if (t.direction !== "recvonly") {
        t.direction = "recvonly";
      }
    }
  }

  private plafonnerTout() {
    for (const [etiquette, t] of this.transceivers) void this.plafonner(t, etiquette);
  }

  private async plafonner(t: RTCRtpTransceiver, etiquette: Etiquette) {
    const enc = plafond(this.o.moi, etiquette, this.o.distant.role);
    if (!enc || this.ferme) return;
    try {
      const p = t.sender.getParameters();
      if (!p.encodings?.length) return;
      const actuel = p.encodings[0];
      if (Object.entries(enc).every(([k, v]) => (actuel as Record<string, unknown>)[k] === v)) return;
      Object.assign(actuel, enc);
      await t.sender.setParameters(p);
    } catch {
      /* navigateur sans réglage de débit : on s'en passe */
    }
  }

  // ── Reconnexion ──────────────────────────────────────────────────────────

  private surConnexion() {
    const s = this.pc.connectionState;
    if (s === "connected") {
      this.annulerMinuteurIce();
      this.redemarrages = 0;
      this.changerEtat("connecte");
    } else if (s === "disconnected") {
      // Souvent un simple passage de la 4G au Wi-Fi : on laisse quelques secondes avant de relancer ICE.
      this.changerEtat("reconnexion");
      this.planifierRedemarrage(this.poli ? 6000 : 2500);
    } else if (s === "failed") {
      this.changerEtat("reconnexion");
      this.planifierRedemarrage(this.poli ? 3000 : 0);
    } else if (s === "closed") {
      this.changerEtat("ferme");
    } else if (this.etat !== "reconnexion") {
      this.changerEtat("connexion");
    }
  }

  private planifierRedemarrage(ms: number) {
    if (this.minuteurIce || this.ferme) return;
    this.minuteurIce = setTimeout(() => {
      this.minuteurIce = null;
      if (this.ferme || this.pc.connectionState === "connected") return;
      this.redemarrages++;
      // Trois redémarrages ICE sans succès : le formateur recrée la connexion, l'autre côté se réannonce.
      if (this.redemarrages > 3) {
        this.o.surEchec();
        return;
      }
      this.pc.restartIce();
      // Si l'état ne bouge plus (message perdu), on vérifie de nouveau plus tard.
      this.planifierRedemarrage(this.poli ? 12_000 : 9_000);
    }, ms);
  }

  private annulerMinuteurIce() {
    if (this.minuteurIce) clearTimeout(this.minuteurIce);
    this.minuteurIce = null;
  }

  private annulerMinuteurs() {
    this.annulerMinuteurIce();
    if (this.minuteurReponse) clearTimeout(this.minuteurReponse);
    this.minuteurReponse = null;
  }

  private changerEtat(e: EtatPair) {
    if (this.etat === e) return;
    this.etat = e;
    this.o.surEtat(e);
  }
}
