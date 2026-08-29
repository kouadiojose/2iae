// Rapatriement des visuels hébergés à l'extérieur.
//
// Le site précédent stockait ses images dans un compartiment DigitalOcean
// Spaces (2iae-images.nyc3.digitaloceanspaces.com). Le transfert vers Railway
// a bien repris la base de données, mais pas ces fichiers : les lignes
// migrées continuent de pointer vers l'ancien hébergeur. Tant que le compte
// DigitalOcean reste ouvert, les images s'affichent ; le jour où il est fermé
// — et il doit l'être, le jeton d'accès ayant été exposé — elles disparaissent
// toutes d'un coup, sans que rien dans le site ne le signale à l'avance.
//
// Ce passage recopie chaque visuel extérieur sur le volume de Railway et
// réécrit la ligne. Le site cesse alors de dépendre d'un service qu'il ne
// contrôle plus. Le principe vaut au-delà de DigitalOcean : une actualité
// pointait vers afribusinesschallenge.com, dont le serveur renvoie une erreur
// 520 et dont l'image est aujourd'hui perdue.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "../db";
import {
  albums,
  galleryItems,
  news,
  newsImages,
  programs,
  projects,
  sliders,
  founderMessage,
} from "@shared/schema";
import { eq, like } from "drizzle-orm";
import { imageSansInformation } from "../facebook/qualiteImage";

const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "server", "uploads");
const DOSSIER = "externes";

/** Hôtes déjà servis par le site : rien à rapatrier. */
const NOTRES = [/(^|\.)2iae\.com$/i, /\.up\.railway\.app$/i];

function estExterne(url: string | null | undefined): url is string {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const hote = new URL(url).hostname;
    return !NOTRES.some((r) => r.test(hote));
  } catch {
    return false;
  }
}

/**
 * Télécharge un visuel et le range sur le volume.
 *
 * Retourne null si le téléchargement échoue, si la réponse n'est pas une
 * image, ou si l'image ne montre rien : dans tous ces cas la ligne est laissée
 * telle quelle. Réécrire une URL qui marche encore vers un fichier absent
 * ferait disparaître le visuel au lieu de le sauver.
 */
async function copierSurLeVolume(url: string): Promise<string | null> {
  let rep: Response;
  try {
    rep = await fetch(url, { redirect: "follow" });
  } catch (err) {
    console.warn(`⚠️  Visuel externe injoignable : ${url.slice(0, 90)} (${(err as Error).message})`);
    return null;
  }
  if (!rep.ok) {
    console.warn(`⚠️  Visuel externe en erreur ${rep.status} : ${url.slice(0, 90)}`);
    return null;
  }

  const type = rep.headers.get("content-type") || "";
  if (!type.startsWith("image/")) {
    console.warn(`⚠️  Visuel externe ignoré, type ${type} : ${url.slice(0, 90)}`);
    return null;
  }

  const donnees = Buffer.from(await rep.arrayBuffer());
  if (imageSansInformation(donnees)) {
    console.warn(`⚠️  Visuel externe sans contenu visible : ${url.slice(0, 90)}`);
    return null;
  }

  const ext = type.includes("png")
    ? "png"
    : type.includes("webp")
      ? "webp"
      : type.includes("gif")
        ? "gif"
        : "jpg";
  // Nom déterministe : rejouer le rapatriement ne duplique pas les fichiers.
  const empreinte = crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
  const nom = `ext_${empreinte}.${ext}`;

  const dossier = path.join(UPLOADS_DIR, DOSSIER);
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, nom), donnees);

  return `/api/assets/${DOSSIER}/${nom}`;
}

/** Colonnes du site pouvant porter l'adresse d'un visuel. */
const CHAMPS = [
  { nom: "bannière", table: sliders, id: sliders.id, colonne: sliders.imageUrl, cle: "imageUrl" },
  { nom: "actualité", table: news, id: news.id, colonne: news.imageUrl, cle: "imageUrl" },
  { nom: "image d'actualité", table: newsImages, id: newsImages.id, colonne: newsImages.imageUrl, cle: "imageUrl" },
  { nom: "filière", table: programs, id: programs.id, colonne: programs.imageUrl, cle: "imageUrl" },
  { nom: "album", table: albums, id: albums.id, colonne: albums.coverImage, cle: "coverImage" },
  { nom: "galerie", table: galleryItems, id: galleryItems.id, colonne: galleryItems.mediaUrl, cle: "mediaUrl" },
  { nom: "vignette de galerie", table: galleryItems, id: galleryItems.id, colonne: galleryItems.thumbnailUrl, cle: "thumbnailUrl" },
  { nom: "mot du fondateur", table: founderMessage, id: founderMessage.id, colonne: founderMessage.founderImageUrl, cle: "founderImageUrl" },
] as const;

/**
 * Recopie sur le volume tous les visuels encore hébergés à l'extérieur.
 *
 * Le travail est plafonné par passage : un rapatriement télécharge des
 * fichiers entiers, et rien n'exige de tout traiter d'un coup — le passage
 * suivant reprend où celui-ci s'arrête, jusqu'à ce qu'il n'y ait plus rien.
 *
 * Le plafond est posé à quarante après un premier passage réel : les quinze
 * images de filières, toutes hébergées chez Unsplash, l'avaient épuisé à elles
 * seules et la galerie n'était jamais atteinte.
 */
export async function rapatrierVisuelsExternes(lot = 40): Promise<string[]> {
  const faits: string[] = [];
  const traduction = new Map<string, string | null>();

  for (const champ of CHAMPS) {
    if (faits.length >= lot) break;

    const lignes = await db
      .select({ id: champ.id, url: champ.colonne })
      .from(champ.table as any)
      .where(like(champ.colonne, "http%"));

    for (const ligne of lignes) {
      if (faits.length >= lot) break;
      if (!estExterne(ligne.url)) continue;

      // Une même image sert souvent de couverture d'album et d'élément de
      // galerie : on ne la télécharge qu'une fois.
      if (!traduction.has(ligne.url)) {
        traduction.set(ligne.url, await copierSurLeVolume(ligne.url));
      }
      const local = traduction.get(ligne.url);
      if (!local) continue;

      await db
        .update(champ.table as any)
        .set({ [champ.cle]: local })
        .where(eq(champ.id, ligne.id));
      faits.push(`${champ.nom} : ${new URL(ligne.url).hostname} → ${local}`);
    }
  }

  // Les projets rangent leurs visuels dans un tableau JSON, pas dans une
  // colonne à part : chaque adresse extérieure du tableau est traitée une à
  // une, et la ligne n'est réécrite que si au moins une a pu être rapatriée.
  if (faits.length < lot) {
    const lignes = await db.select({ id: projects.id, images: projects.images }).from(projects);
    for (const ligne of lignes) {
      if (faits.length >= lot) break;
      if (!Array.isArray(ligne.images)) continue;

      let modifie = false;
      const nouvelles = [...(ligne.images as string[])];
      for (let i = 0; i < nouvelles.length; i++) {
        if (faits.length >= lot) break;
        const url = nouvelles[i];
        if (!estExterne(url)) continue;

        if (!traduction.has(url)) {
          traduction.set(url, await copierSurLeVolume(url));
        }
        const local = traduction.get(url);
        if (!local) continue;

        nouvelles[i] = local;
        modifie = true;
        faits.push(`projet : ${new URL(url).hostname} → ${local}`);
      }
      if (modifie) {
        await db.update(projects).set({ images: nouvelles }).where(eq(projects.id, ligne.id));
      }
    }
  }

  return faits;
}
