// Appels à l'API du campus : JSON, cookies de session, messages d'erreur lisibles.
import { noterHeureServeur } from "./horloge";
export class ErreurApi extends Error {
  constructor(public statut: number, message: string, public details?: unknown) {
    super(message);
  }
}

type Options = { methode?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; corps?: unknown; signal?: AbortSignal };

export async function api<T = unknown>(url: string, options: Options = {}): Promise<T> {
  const { methode = "GET", corps, signal } = options;
  const estFormulaire = typeof FormData !== "undefined" && corps instanceof FormData;
  let reponse: Response;
  try {
    reponse = await fetch(url, {
      method: methode,
      credentials: "include",
      headers: corps !== undefined && !estFormulaire ? { "Content-Type": "application/json" } : undefined,
      body: corps === undefined ? undefined : estFormulaire ? (corps as FormData) : JSON.stringify(corps),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ErreurApi(0, "Pas de connexion internet. Vérifie ton réseau et réessaie.");
  }
  // Une réponse servie par le cache hors ligne porte une date ancienne : on l'ignore.
  if (!reponse.headers.get("x-campus-cache")) noterHeureServeur(reponse.headers.get("date"));
  const type = reponse.headers.get("content-type") || "";
  const contenu = type.includes("application/json") ? await reponse.json().catch(() => null) : await reponse.text().catch(() => "");
  if (!reponse.ok) {
    const message =
      (contenu && typeof contenu === "object" && "message" in contenu && String((contenu as { message: unknown }).message)) ||
      "Une erreur est survenue. Réessaie dans un instant.";
    throw new ErreurApi(reponse.status, message, (contenu as { details?: unknown } | null)?.details);
  }
  return contenu as T;
}

export const get = <T = unknown>(url: string) => api<T>(url);
export const post = <T = unknown>(url: string, corps?: unknown) => api<T>(url, { methode: "POST", corps: corps ?? {} });
export const patch = <T = unknown>(url: string, corps?: unknown) => api<T>(url, { methode: "PATCH", corps: corps ?? {} });
export const put = <T = unknown>(url: string, corps?: unknown) => api<T>(url, { methode: "PUT", corps: corps ?? {} });
export const suppr = <T = unknown>(url: string) => api<T>(url, { methode: "DELETE" });

export type FichierTeleverse = { id: number; nom: string; mime: string; taille: number; url: string };

/** Téléverse des fichiers (les photos sont allégées avant l'envoi pour la 4G). */
export async function televerser(
  fichiers: File[],
  usage: "lecon" | "rendu" | "message" | "avatar" | "devoir" | "annonce" | "import",
): Promise<FichierTeleverse[]> {
  const donnees = new FormData();
  donnees.append("usage", usage);
  for (const f of fichiers) donnees.append("fichiers", await alleger(f), f.name);
  return api<FichierTeleverse[]>("/api/fichiers", { methode: "POST", corps: donnees });
}

/** Réduit une photo de téléphone (souvent 4 à 8 Mo) à ~1600 px en JPEG : 10 à 20 fois plus léger. */
export async function alleger(f: File, cote = 1600, qualite = 0.72): Promise<File> {
  // Les photos sont toujours ré-encodées : cela retire aussi les métadonnées (position GPS…).
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type)) return f;
  if (f.type === "image/png" && f.size < 400_000) return f; // capture d'écran légère
  try {
    const image = await createImageBitmap(f);
    const ratio = Math.min(1, cote / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * ratio);
    canvas.height = Math.round(image.height * ratio);
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", qualite));
    if (!blob) return f;
    return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return f;
  }
}
