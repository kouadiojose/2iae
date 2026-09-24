// Émission de la radio du cours depuis le navigateur du formateur.
//
// MediaRecorder encode le micro en WebM/Opus (≈ 24 kbit/s) et livre une
// tranche par seconde ; chaque tranche part, dans l'ordre, vers le serveur
// (numérotée : le serveur détecte un trou ou un doublon). Le premier morceau
// d'un enregistrement porte l'en-tête WebM (?debut=1). Si l'envoi échoue
// trop longtemps, ou si le serveur le demande (409), on recommence un
// enregistrement neuf : les auditeurs relancent leur lecture tout seuls.
import { idAleatoire } from "./medias";

export type EtatEmission = "connexion" | "direct" | "reprise" | "indisponible" | "arret";

const DEBIT_RADIO = 24_000;
/** Au-delà de 15 s de retard d'envoi, on repart d'un enregistrement neuf plutôt que d'accumuler. */
const FILE_MAX = 15;

type Morceau = { seq: number; blob: Blob; debut: boolean };

/** Format d'enregistrement accepté par ce navigateur (Chrome, Edge, Firefox : WebM/Opus). */
export function formatRadio(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const f of ["audio/webm;codecs=opus", "audio/webm"]) if (MediaRecorder.isTypeSupported(f)) return f;
  return null;
}

/** Le navigateur sait-il lire la radio du cours ? */
export function lectureRadioPossible(): boolean {
  if (typeof document === "undefined") return false;
  const a = document.createElement("audio");
  return a.canPlayType('audio/webm; codecs="opus"') !== "";
}

export class EmetteurRadioMoteur {
  private enregistreur: MediaRecorder | null = null;
  private generation = 0;
  private flux = "";
  private seq = 0;
  private file: Morceau[] = [];
  private envoiEnCours = false;
  private echecs = 0;
  private arrete = false;
  auditeurs = 0;

  constructor(
    /** « /api/radio/12 » ou « /api/radio/essai ». */
    private base: string,
    private piste: MediaStreamTrack,
    private surEtat: (etat: EtatEmission) => void,
  ) {}

  demarrer() {
    const format = formatRadio();
    if (!format) {
      this.surEtat("indisponible");
      return;
    }
    this.arrete = false;
    this.nouvelEnregistrement(format);
  }

  /** Arrête l'émission ; `prevenir` ferme aussi l'écoute des auditeurs. */
  arreter(prevenir = true) {
    if (this.arrete) return;
    this.arrete = true;
    this.generation++;
    this.stopperEnregistreur();
    this.file = [];
    if (prevenir) void fetch(`${this.base}/fin`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}", keepalive: true }).catch(() => undefined);
    this.surEtat("arret");
  }

  private nouvelEnregistrement(format = formatRadio()) {
    if (!format || this.arrete) return;
    this.stopperEnregistreur();
    const generation = ++this.generation;
    this.flux = idAleatoire(16);
    this.seq = 0;
    this.file = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(new MediaStream([this.piste]), { mimeType: format, audioBitsPerSecond: DEBIT_RADIO });
    } catch {
      this.surEtat("indisponible");
      return;
    }
    rec.ondataavailable = (e) => {
      if (generation !== this.generation || !e.data.size) return;
      const seq = this.seq++;
      this.file.push({ seq, blob: e.data, debut: seq === 0 });
      if (this.file.length > FILE_MAX) {
        // Le réseau ne suit plus : on repart de zéro (nouvel en-tête).
        this.surEtat("reprise");
        this.nouvelEnregistrement();
        return;
      }
      void this.pomper();
    };
    rec.onerror = () => {
      if (generation === this.generation) setTimeout(() => this.nouvelEnregistrement(), 1000);
    };
    this.enregistreur = rec;
    this.surEtat(this.echecs ? "reprise" : "connexion");
    rec.start(1000);
  }

  private stopperEnregistreur() {
    const rec = this.enregistreur;
    this.enregistreur = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* déjà arrêté */
      }
    }
  }

  /** Envoie les morceaux un par un, dans l'ordre ; réessaie avec des pauses croissantes. */
  private async pomper() {
    if (this.envoiEnCours) return;
    this.envoiEnCours = true;
    const generation = this.generation;
    try {
      while (this.file.length && generation === this.generation && !this.arrete) {
        const m = this.file[0];
        const url = `${this.base}/morceau?flux=${this.flux}&seq=${m.seq}${m.debut ? "&debut=1" : ""}`;
        let statut = 0;
        let corps: { auditeurs?: number } | null = null;
        try {
          const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/octet-stream" }, body: m.blob });
          statut = r.status;
          corps = await r.json().catch(() => null);
        } catch {
          statut = 0;
        }
        if (generation !== this.generation) return;
        if (statut >= 200 && statut < 300) {
          this.file.shift();
          this.echecs = 0;
          if (typeof corps?.auditeurs === "number") this.auditeurs = corps.auditeurs;
          this.surEtat("direct");
          continue;
        }
        if (statut === 409) {
          // En-tête perdu, trou dans la numérotation, serveur redémarré : enregistrement neuf.
          this.echecs++;
          this.nouvelEnregistrement();
          return;
        }
        if (statut === 401 || statut === 403) {
          this.surEtat("indisponible");
          this.arreter(false);
          return;
        }
        this.echecs++;
        this.surEtat("reprise");
        await new Promise((ok) => setTimeout(ok, Math.min(8000, 500 * 2 ** Math.min(this.echecs, 4))));
      }
    } finally {
      this.envoiEnCours = false;
    }
  }
}
