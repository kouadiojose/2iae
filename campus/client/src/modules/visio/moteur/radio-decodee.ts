// Radio du cours décodée dans la page, pour les navigateurs qui ne lisent pas le flux WebM en direct dans un <audio>.
//
// Safari sur iPhone et iPad (et tous les navigateurs de l'iPhone, qui sont des Safari) dit savoir lire le WebM/Opus,
// mais échoue sur un flux sans fin : du 19 au 29 octobre 2026, 1 953 écoutes depuis 54 iPhone, 5 seulement ont dépassé
// une minute (journaux HTTP de Railway), alors qu'Android en comptait 1 417. Ici, on lit l'écoute avec fetch, on
// sort les paquets Opus des SimpleBlocks (le serveur envoie l'en-tête, puis des Clusters de taille inconnue :
// visio-campus.ts, AnalyseurWebm), WebCodecs (AudioDecoder) les décode et Web Audio les joue, avec un petit tampon.
// Le retard est rattrapé en sautant du son ; une écoute muette plus de 8 s est rouverte par le lecteur.

const ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_CLUSTER = 0x1f43b675;
const ID_TIMECODE = 0xe7;
const ID_SIMPLEBLOCK = 0xa3;
const ID_BLOCKGROUP = 0xa0;
const ID_BLOCK = 0xa1;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACKENTRY = 0xae;
const ID_CODECPRIVATE = 0x63a2;
/** Éléments de premier niveau : leur apparition clôt un Cluster de taille inconnue. */
const IDS_NIVEAU_1 = new Set([0x114d9b74, 0x1549a966, ID_TRACKS, ID_CLUSTER, 0x1c53bb6b, 0x1941a469, 0x1043a770, 0x1254c367]);

/** Son d'avance gardé au départ et après une coupure (secondes) : absorbe les à-coups de la 4G. */
const TAMPON_S = 0.3;
/** Au-delà de ce retard planifié, on saute du son pour revenir au direct. */
const RETARD_MAX_S = 2.5;
/** Plus rien de reçu depuis ce délai : l'écoute est considérée comme bloquée. */
const SILENCE_MAX_MS = 8000;

// WebCodecs audio : absent des types DOM de cette version de TypeScript ; on décrit le peu qu'on utilise et on lit
// les classes sur globalThis (absentes sur les navigateurs anciens).
type DonneesAudio = {
  numberOfFrames: number;
  numberOfChannels: number;
  sampleRate: number;
  copyTo(destination: Float32Array, options: { planeIndex: number; format: "f32-planar" }): void;
  close(): void;
};
type DecodeurAudio = {
  state: "unconfigured" | "configured" | "closed";
  decodeQueueSize: number;
  configure(config: { codec: string; sampleRate: number; numberOfChannels: number; description?: Uint8Array }): void;
  decode(morceau: unknown): void;
  close(): void;
};
type WebCodecsAudio = {
  AudioDecoder: {
    new (init: { output: (d: DonneesAudio) => void; error: (e: Error) => void }): DecodeurAudio;
    isConfigSupported(config: { codec: string; sampleRate: number; numberOfChannels: number }): Promise<{ supported?: boolean }>;
  };
  EncodedAudioChunk: new (init: { type: "key"; timestamp: number; data: Uint8Array }) => unknown;
};
const webCodecs = (): WebCodecsAudio | null => {
  const g = globalThis as unknown as Partial<WebCodecsAudio>;
  return g.AudioDecoder && g.EncodedAudioChunk ? (g as WebCodecsAudio) : null;
};

class ErreurFlux extends Error {}

function lireId(b: Uint8Array, p: number): { id: number; n: number } | null {
  if (p >= b.length) return null;
  let n = 1;
  let masque = 0x80;
  while (n <= 4 && !(b[p] & masque)) {
    n++;
    masque >>= 1;
  }
  if (n > 4) throw new ErreurFlux("Identifiant EBML invalide.");
  if (p + n > b.length) return null;
  let id = 0;
  for (let i = 0; i < n; i++) id = id * 256 + b[p + i];
  return { id, n };
}

function lireVint(b: Uint8Array, p: number): { valeur: number; n: number; inconnue: boolean } | null {
  if (p >= b.length) return null;
  let n = 1;
  let masque = 0x80;
  while (n <= 8 && !(b[p] & masque)) {
    n++;
    masque >>= 1;
  }
  if (n > 8) throw new ErreurFlux("Taille EBML invalide.");
  if (p + n > b.length) return null;
  let valeur = b[p] & (masque - 1);
  let tousUns = valeur === masque - 1;
  for (let i = 1; i < n; i++) {
    valeur = valeur * 256 + b[p + i];
    if (b[p + i] !== 0xff) tousUns = false;
  }
  return { valeur, n, inconnue: tousUns };
}

/** Cherche un élément enfant (premier trouvé) dans [debut, fin[ ; renvoie ses bornes de contenu. */
function enfant(b: Uint8Array, debut: number, fin: number, cible: number): { debut: number; fin: number } | null {
  let p = debut;
  while (p < fin) {
    const id = lireId(b, p);
    const t = id && lireVint(b, p + id.n);
    if (!id || !t || t.inconnue) return null;
    const d = p + id.n + t.n;
    if (id.id === cible) return { debut: d, fin: Math.min(fin, d + t.valeur) };
    p = d + t.valeur;
  }
  return null;
}

/** Paquet Opus tiré d'un bloc (SimpleBlock ou Block d'un BlockGroup), sans laçage (MediaRecorder n'en met pas). */
function paquetDuBloc(b: Uint8Array, debut: number, fin: number): { rel: number; donnees: Uint8Array } | null {
  const piste = lireVint(b, debut);
  if (!piste) return null;
  const p = debut + piste.n;
  if (p + 3 > fin) return null;
  const rel = ((b[p] << 8) | b[p + 1]) << 16 >> 16;
  const drapeaux = b[p + 2];
  if (drapeaux & 0x06) return null;
  return { rel, donnees: b.slice(p + 3, fin) };
}

export type PaquetOpus = { tMs: number; donnees: Uint8Array };

/** Lit le flux d'écoute morceau par morceau : en-tête Opus (OpusHead) d'abord, puis les paquets horodatés. */
export class DemuxeurRadio {
  opusHead: Uint8Array | null = null;
  private tampon = new Uint8Array(0);
  private phase: "ebml" | "segment" | "niveau1" | "cluster" = "ebml";
  private resteCluster = 0;
  private tempsCluster = 0;

  pousser(octets: Uint8Array): PaquetOpus[] {
    if (this.tampon.length) {
      const t = new Uint8Array(this.tampon.length + octets.length);
      t.set(this.tampon);
      t.set(octets, this.tampon.length);
      this.tampon = t;
    } else this.tampon = octets;
    const b = this.tampon;
    const paquets: PaquetOpus[] = [];
    let p = 0;
    for (;;) {
      if (this.phase === "cluster" && this.resteCluster <= 0) {
        this.phase = "niveau1";
        continue;
      }
      const id = lireId(b, p);
      if (!id) break;
      if (this.phase === "cluster" && this.resteCluster === Infinity && IDS_NIVEAU_1.has(id.id)) {
        this.phase = "niveau1";
        continue;
      }
      const t = lireVint(b, p + id.n);
      if (!t) break;
      const entete = id.n + t.n;
      if (this.phase === "ebml") {
        if (id.id !== ID_EBML || t.inconnue) throw new ErreurFlux("En-tête WebM attendu.");
        const fin = p + entete + t.valeur;
        if (fin > b.length) break;
        p = fin;
        this.phase = "segment";
        continue;
      }
      if (this.phase === "segment") {
        if (id.id !== ID_SEGMENT) throw new ErreurFlux("Segment WebM attendu.");
        p += entete;
        this.phase = "niveau1";
        continue;
      }
      if (this.phase === "niveau1") {
        if (id.id === ID_CLUSTER) {
          this.resteCluster = t.inconnue ? Infinity : t.valeur;
          p += entete;
          this.phase = "cluster";
          continue;
        }
        if (t.inconnue) throw new ErreurFlux("Élément WebM de taille inconnue.");
        const fin = p + entete + t.valeur;
        if (fin > b.length) break;
        if (id.id === ID_TRACKS) {
          const piste = enfant(b, p + entete, fin, ID_TRACKENTRY);
          const prive = piste && enfant(b, piste.debut, piste.fin, ID_CODECPRIVATE);
          if (prive) this.opusHead = b.slice(prive.debut, prive.fin);
        }
        p = fin;
        continue;
      }
      if (t.inconnue) throw new ErreurFlux("Bloc WebM de taille inconnue.");
      const fin = p + entete + t.valeur;
      if (fin > b.length) break;
      if (this.resteCluster !== Infinity) this.resteCluster -= fin - p;
      if (id.id === ID_TIMECODE) {
        let v = 0;
        for (let i = p + entete; i < fin; i++) v = v * 256 + b[i];
        this.tempsCluster = v;
      } else if (id.id === ID_SIMPLEBLOCK) {
        const q = paquetDuBloc(b, p + entete, fin);
        if (q) paquets.push({ tMs: this.tempsCluster + q.rel, donnees: q.donnees });
      } else if (id.id === ID_BLOCKGROUP) {
        const bloc = enfant(b, p + entete, fin, ID_BLOCK);
        const q = bloc && paquetDuBloc(b, bloc.debut, bloc.fin);
        if (q) paquets.push({ tMs: this.tempsCluster + q.rel, donnees: q.donnees });
      }
      p = fin;
    }
    this.tampon = p >= b.length ? new Uint8Array(0) : b.slice(p);
    if (this.tampon.length > 2_000_000) throw new ErreurFlux("Flux WebM illisible.");
    return paquets;
  }
}

/** iPhone, iPad (y compris iPadOS qui se présente comme un Mac) : tous leurs navigateurs sont des Safari. */
export function appareilApple(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

type AudioContexteFenetre = typeof AudioContext;

function classeAudioContext(): AudioContexteFenetre | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContexteFenetre }).webkitAudioContext ?? null;
}

/** Ce navigateur sait-il décoder la radio lui-même (WebCodecs Opus + Web Audio) ? */
export async function decodageRadioPossible(): Promise<boolean> {
  const wc = webCodecs();
  if (!wc || !classeAudioContext()) return false;
  try {
    const r = await wc.AudioDecoder.isConfigSupported({ codec: "opus", sampleRate: 48000, numberOfChannels: 1 });
    return Boolean(r.supported);
  } catch {
    return false;
  }
}

/**
 * Contexte audio partagé, créé (ou réveillé) pendant le geste « Écouter le cours » : iOS ne laisse jouer Web Audio
 * qu'après un geste. Le type de session « playback » fait jouer le son même avec le bouton silencieux de l'iPhone.
 */
let contexte: AudioContext | null = null;
export function preparerAudio(): AudioContext | null {
  const C = classeAudioContext();
  if (!C) return null;
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch {
    /* API absente ou refusée : le son passe quand même hors mode silencieux */
  }
  if (!contexte || contexte.state === "closed") contexte = new C({ latencyHint: "playback" });
  if (contexte.state !== "running") void contexte.resume().catch(() => undefined);
  return contexte;
}

export type RappelsRadioDecodee = {
  /** Le premier son est parti vers le haut-parleur. */
  enDirect: () => void;
  /** L'écoute s'est terminée (radio redémarrée, réseau coupé, flux illisible) : le lecteur relance. */
  fin: (raison: string) => void;
  /** Octets réellement reçus (compteur de consommation). */
  octets?: (n: number) => void;
};

/** Une écoute : fetch du flux, décodage, lecture. Une instance par tentative ; arreter() coupe tout. */
export class EcouteDecodee {
  private abandon = new AbortController();
  private decodeur: DecodeurAudio | null = null;
  private sortie: GainNode | null = null;
  private prochain = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private veille: ReturnType<typeof setInterval> | null = null;
  private dernierRecu = 0;
  private finie = false;
  private aJoue = false;
  private wc: WebCodecsAudio;

  constructor(
    private url: string,
    private ctx: AudioContext,
    private rappels: RappelsRadioDecodee,
  ) {
    const wc = webCodecs();
    if (!wc) throw new Error("WebCodecs audio absent.");
    this.wc = wc;
  }

  demarrer() {
    this.sortie = this.ctx.createGain();
    this.sortie.connect(this.ctx.destination);
    this.dernierRecu = Date.now();
    this.veille = setInterval(() => {
      if (Date.now() - this.dernierRecu > SILENCE_MAX_MS) this.terminer("plus rien reçu");
      else if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
    }, 1000);
    void this.lire();
  }

  arreter() {
    this.finie = true;
    this.nettoyer();
  }

  private terminer(raison: string) {
    if (this.finie) return;
    this.finie = true;
    this.nettoyer();
    this.rappels.fin(raison);
  }

  private nettoyer() {
    if (this.veille) clearInterval(this.veille);
    this.veille = null;
    this.abandon.abort();
    try {
      if (this.decodeur && this.decodeur.state !== "closed") this.decodeur.close();
    } catch {
      /* déjà fermé */
    }
    this.decodeur = null;
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* pas encore partie */
      }
    }
    this.sources.clear();
    this.sortie?.disconnect();
    this.sortie = null;
  }

  private async lire() {
    let r: Response;
    try {
      r = await fetch(this.url, { credentials: "include", cache: "no-store", signal: this.abandon.signal });
    } catch {
      return this.terminer("réseau");
    }
    if (!r.ok || !r.body) return this.terminer(`réponse ${r.status}`);
    const lecteur = r.body.getReader();
    const demux = new DemuxeurRadio();
    try {
      for (;;) {
        const { done, value } = await lecteur.read();
        if (this.finie) return;
        if (done) return this.terminer("flux terminé");
        this.dernierRecu = Date.now();
        this.rappels.octets?.(value.length);
        const paquets = demux.pousser(value);
        if (!this.decodeur && demux.opusHead) this.configurer(demux.opusHead);
        const d = this.decodeur;
        if (!d) continue;
        for (const q of paquets) {
          // Décodeur saturé (appareil lent) : on saute des paquets plutôt que d'accumuler du retard.
          if (d.decodeQueueSize > 50) continue;
          d.decode(new this.wc.EncodedAudioChunk({ type: "key", timestamp: q.tMs * 1000, data: q.donnees }));
        }
      }
    } catch (e) {
      if (!this.finie) this.terminer(e instanceof Error ? e.message : "lecture");
    }
  }

  private configurer(opusHead: Uint8Array) {
    const canaux = opusHead.length > 9 && opusHead[9] ? opusHead[9] : 1;
    const d = new this.wc.AudioDecoder({
      output: (donnees) => this.jouer(donnees),
      error: (e) => this.terminer(`décodage : ${e.message}`),
    });
    d.configure({ codec: "opus", sampleRate: 48000, numberOfChannels: canaux, description: opusHead });
    this.decodeur = d;
  }

  private jouer(donnees: DonneesAudio) {
    try {
      if (this.finie || !this.sortie) return;
      const n = donnees.numberOfFrames;
      const canaux = donnees.numberOfChannels;
      const tampon = this.ctx.createBuffer(canaux, n, donnees.sampleRate);
      for (let c = 0; c < canaux; c++) {
        const plan = new Float32Array(n);
        donnees.copyTo(plan, { planeIndex: c, format: "f32-planar" });
        tampon.copyToChannel(plan, c);
      }
      const maintenant = this.ctx.currentTime;
      // Coupure (tampon vide) : on repart avec un peu d'avance. Trop de retard : on saute ce morceau.
      if (this.prochain < maintenant + 0.02) this.prochain = maintenant + TAMPON_S;
      else if (this.prochain - maintenant > RETARD_MAX_S) return;
      const source = this.ctx.createBufferSource();
      source.buffer = tampon;
      source.connect(this.sortie);
      source.onended = () => this.sources.delete(source);
      source.start(this.prochain);
      this.sources.add(source);
      this.prochain += tampon.duration;
      if (!this.aJoue) {
        this.aJoue = true;
        this.rappels.enDirect();
      }
    } finally {
      donnees.close();
    }
  }
}
