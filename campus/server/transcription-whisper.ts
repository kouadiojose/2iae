// Client du service de transcription Whisper installé sur le serveur de visio du
// campus (campus/infra/livekit/installer.sh, conteneur « whisper » derrière Caddy).
// Le service télécharge la vidéo depuis un lien signé du bucket des replays,
// la transcrit (une à la fois) et rend un fichier WebVTT.
import { config } from "./config";

export const whisperDisponible = () => Boolean(config.visio.transcriptionUrl && config.visio.transcriptionJeton);

async function appel<T>(chemin: string, init: RequestInit = {}): Promise<{ statut: number; donnees: T | null; texte: string }> {
  const base = (config.visio.transcriptionUrl ?? "").replace(/\/+$/, "");
  const r = await fetch(`${base}${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.visio.transcriptionJeton}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(60_000),
  });
  const texte = await r.text();
  let donnees: T | null = null;
  try {
    donnees = JSON.parse(texte) as T;
  } catch {
    /* réponse texte (WebVTT) */
  }
  return { statut: r.status, donnees, texte };
}

const erreur = (quoi: string, statut: number, texte: string) => new Error(`Whisper (${quoi}) : HTTP ${statut} ${texte.slice(0, 200)}`);

/** Demande la transcription d'une vidéo (lien signé) ; rend l'identifiant du travail. */
export async function soumettreTranscriptionWhisper(url: string, langue = "fr"): Promise<string> {
  const r = await appel<{ id?: string }>("/travaux", { method: "POST", body: JSON.stringify({ url, langue }) });
  if (r.statut >= 300 || !r.donnees?.id) throw erreur("demande", r.statut, r.texte);
  return r.donnees.id;
}

/** État d'un travail : « en_attente », « en_cours », « terminee » ou « erreur ». Un travail inconnu du service est en erreur. */
export async function etatTranscriptionWhisper(id: string): Promise<{ statut: string; erreur: string | null }> {
  const r = await appel<{ statut?: string; erreur?: string | null }>(`/travaux/${encodeURIComponent(id)}`);
  if (r.statut === 404) return { statut: "erreur", erreur: "Travail inconnu du service de transcription (redémarré ?)." };
  if (r.statut >= 300 || !r.donnees?.statut) throw erreur("état", r.statut, r.texte);
  return { statut: r.donnees.statut, erreur: r.donnees.erreur ?? null };
}

/** Fichier WebVTT d'un travail terminé (le service l'efface ensuite au bout de quelques jours). */
export async function vttTranscriptionWhisper(id: string): Promise<string> {
  const r = await appel<unknown>(`/travaux/${encodeURIComponent(id)}/vtt`);
  if (r.statut >= 300) throw erreur("résultat", r.statut, r.texte);
  return r.texte;
}

/** Le service répond-il (et le jeton est-il bon) ? */
export async function testerWhisper(): Promise<{ ok: boolean; message: string; enAttente?: number }> {
  if (!whisperDisponible()) return { ok: false, message: "TRANSCRIPTION_URL ou TRANSCRIPTION_TOKEN manquant." };
  try {
    const r = await appel<{ ok?: boolean; enAttente?: number; modele?: string }>("/etat");
    if (r.statut !== 200 || !r.donnees?.ok) return { ok: false, message: `HTTP ${r.statut}` };
    return { ok: true, message: `Whisper prêt (modèle ${r.donnees.modele ?? "?"}).`, enAttente: r.donnees.enAttente ?? 0 };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
