// Accès à la page Facebook via la Graph API, et rapatriement des médias.
//
// Point important : les URLs d'images renvoyées par Facebook pointent vers son
// CDN (scontent.*.fbcdn.net) et EXPIRENT, la date étant encodée dans le
// paramètre `oe=`. Le site en a déjà fait les frais : un slider pointait vers
// une URL portant `oe=68B4E9A7`, soit le 30 août 2025, et l'image ne
// s'affichait plus. On ne stocke donc jamais une URL Facebook : chaque média
// est téléchargé sur le volume du serveur au moment de la synchronisation.

import fs from "fs";
import path from "path";
import crypto from "crypto";

const VERSION = process.env.FACEBOOK_API_VERSION || "v21.0";
const BASE = `https://graph.facebook.com/${VERSION}`;

const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "server", "uploads");
const DOSSIER_FB = "facebook";

export interface MediaFacebook {
  /** URL locale servie par le site, ex. /api/assets/facebook/fb_....jpg */
  url: string;
  type: "image";
  legende?: string;
}

export interface PostFacebook {
  id: string;
  message: string;
  permalink: string;
  publieLe: Date;
  medias: MediaFacebook[];
}

function config() {
  const token = process.env.FACEBOOK_PAGE_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  return { token, pageId, actif: Boolean(token && pageId) };
}

export function integrationActive(): boolean {
  return config().actif;
}

async function appel<T>(chemin: string, params: Record<string, string>): Promise<T> {
  const { token } = config();
  const url = new URL(`${BASE}/${chemin}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token!);

  const rep = await fetch(url.toString());
  const corps = await rep.json().catch(() => ({}));

  if (!rep.ok) {
    const err = (corps as any)?.error;
    // 190 = jeton invalide ou expiré : le message doit être explicite, c'est la
    // panne la plus probable dans la durée.
    if (err?.code === 190) {
      throw new Error(
        `Jeton Facebook invalide ou expiré (${err.message}). ` +
          `Régénérez FACEBOOK_PAGE_TOKEN.`,
      );
    }
    throw new Error(
      `Graph API ${rep.status} : ${err?.message || JSON.stringify(corps).slice(0, 200)}`,
    );
  }
  return corps as T;
}

/** Extrait les URLs d'images d'un post, pièce jointe unique ou album. */
function urlsDesMedias(post: any): { url: string; legende?: string }[] {
  const sorties: { url: string; legende?: string }[] = [];
  const vues = new Set<string>();

  const ajouter = (u?: string, legende?: string) => {
    if (!u || vues.has(u)) return;
    vues.add(u);
    sorties.push({ url: u, legende });
  };

  for (const att of post.attachments?.data ?? []) {
    // Un album Facebook expose ses photos dans subattachments
    for (const sub of att.subattachments?.data ?? []) {
      if (sub.media?.image?.src) ajouter(sub.media.image.src, sub.description);
    }
    if (!att.subattachments && att.media?.image?.src) {
      ajouter(att.media.image.src, att.description);
    }
  }

  // full_picture couvre les posts sans attachments détaillés
  if (sorties.length === 0 && post.full_picture) ajouter(post.full_picture);

  return sorties;
}

/**
 * Télécharge un média Facebook sur le disque et renvoie son URL locale.
 * Renvoie null en cas d'échec : une image manquante ne doit jamais faire
 * échouer l'import de la publication entière.
 */
export async function rapatrierMedia(
  urlDistante: string,
  legende?: string,
): Promise<MediaFacebook | null> {
  try {
    const rep = await fetch(urlDistante);
    if (!rep.ok) {
      console.warn(`⚠️  Média inaccessible (${rep.status}) : ${urlDistante.slice(0, 80)}`);
      return null;
    }

    const type = rep.headers.get("content-type") || "";
    if (!type.startsWith("image/")) {
      console.warn(`⚠️  Média ignoré, type ${type}`);
      return null;
    }

    const donnees = Buffer.from(await rep.arrayBuffer());
    if (donnees.length === 0) return null;

    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    // Nom déterministe : re-synchroniser un post ne duplique pas ses fichiers.
    const empreinte = crypto.createHash("sha1").update(urlDistante).digest("hex").slice(0, 16);
    const nom = `fb_${empreinte}.${ext}`;

    const dossier = path.join(UPLOADS_DIR, DOSSIER_FB);
    fs.mkdirSync(dossier, { recursive: true });
    fs.writeFileSync(path.join(dossier, nom), donnees);

    return { url: `/api/assets/${DOSSIER_FB}/${nom}`, type: "image", legende };
  } catch (err) {
    console.warn(`⚠️  Échec du rapatriement d'un média :`, (err as Error).message);
    return null;
  }
}

/** Récupère les publications de la page, de la plus récente à la plus ancienne. */
export async function lirePublications(limite = 25): Promise<PostFacebook[]> {
  const { pageId, actif } = config();
  if (!actif) throw new Error("FACEBOOK_PAGE_TOKEN et FACEBOOK_PAGE_ID sont requis.");

  const data = await appel<{ data: any[] }>(`${pageId}/posts`, {
    fields:
      "id,message,created_time,permalink_url,full_picture," +
      "attachments{media,description,subattachments{media,description}}",
    limit: String(Math.min(limite, 100)),
  });

  const posts: PostFacebook[] = [];
  for (const brut of data.data ?? []) {
    const message = (brut.message || "").trim();
    const refs = urlsDesMedias(brut);

    // Une publication sans texte ni image n'apporte rien au site.
    if (!message && refs.length === 0) continue;

    const medias: MediaFacebook[] = [];
    for (const ref of refs) {
      const m = await rapatrierMedia(ref.url, ref.legende);
      if (m) medias.push(m);
    }

    posts.push({
      id: String(brut.id),
      message,
      permalink: brut.permalink_url || `https://www.facebook.com/${brut.id}`,
      publieLe: brut.created_time ? new Date(brut.created_time) : new Date(),
      medias,
    });
  }
  return posts;
}

/** Récupère une publication précise (utilisé par le webhook). */
export async function lirePublication(postId: string): Promise<PostFacebook | null> {
  if (!config().actif) return null;

  const brut = await appel<any>(postId, {
    fields:
      "id,message,created_time,permalink_url,full_picture," +
      "attachments{media,description,subattachments{media,description}}",
  });

  const message = (brut.message || "").trim();
  const refs = urlsDesMedias(brut);
  if (!message && refs.length === 0) return null;

  const medias: MediaFacebook[] = [];
  for (const ref of refs) {
    const m = await rapatrierMedia(ref.url, ref.legende);
    if (m) medias.push(m);
  }

  return {
    id: String(brut.id),
    message,
    permalink: brut.permalink_url || `https://www.facebook.com/${brut.id}`,
    publieLe: brut.created_time ? new Date(brut.created_time) : new Date(),
    medias,
  };
}

/** Vérifie la signature d'un webhook Facebook (X-Hub-Signature-256). */
export function signatureValide(corpsBrut: Buffer, entete: string | undefined): boolean {
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!secret || !entete) return false;

  const attendu =
    "sha256=" + crypto.createHmac("sha256", secret).update(corpsBrut).digest("hex");

  const a = Buffer.from(attendu);
  const b = Buffer.from(entete);
  // Comparaison à temps constant : évite de fuiter la signature par le timing.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
