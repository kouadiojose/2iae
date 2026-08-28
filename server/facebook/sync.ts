// Synchronisation de la page Facebook vers le site.
//
// Chaîne complète pour une publication :
//   Graph API → rapatriement des images → classement → actualité (+ album) → journal
//
// Idempotence : la table facebook_posts garde une ligne par publication vue,
// et news.source_id porte une contrainte d'unicité. Rejouer une
// synchronisation ne crée donc jamais de doublon, ce qui compte car le webhook
// et le rattrapage périodique voient souvent les mêmes publications.

import { db } from "../db";
import { facebookPosts, news, newsImages, albums, galleryItems } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { lirePublications, lirePublication, integrationActive, type PostFacebook } from "./graph";
import { classer, meriteLaUne, nettoyer, tronquer } from "./classification";

/** Nombre d'images à partir duquel une publication alimente aussi la galerie. */
const SEUIL_ALBUM = 3;

export interface Resultat {
  vues: number;
  publiees: number;
  ecartees: number;
  ignorees: number; // déjà traitées auparavant
  echecs: number;
  details: string[];
}

/** Slug d'URL stable et lisible, dérivé du titre. */
function slugifier(titre: string, postId: string): string {
  const base = titre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  // Suffixe tiré de l'id du post : deux publications de même titre coexistent.
  const suffixe = postId.replace(/[^0-9]/g, "").slice(-6) || "fb";
  return `${base || "publication"}-${suffixe}`;
}

async function dejaTraite(postId: string): Promise<boolean> {
  const [ligne] = await db
    .select({ id: facebookPosts.id, status: facebookPosts.status })
    .from(facebookPosts)
    .where(eq(facebookPosts.postId, postId))
    .limit(1);
  // Un échec précédent doit pouvoir être réessayé.
  return Boolean(ligne) && ligne.status !== "failed";
}

async function journaliser(entree: {
  postId: string;
  permalink: string;
  message: string;
  publieLe: Date;
  status: string;
  reason: string;
  rubrique?: string;
  importance?: number;
  newsId?: string;
  albumId?: string;
  mediaCount: number;
  classifier?: string;
}) {
  const valeurs = {
    postId: entree.postId,
    permalink: entree.permalink,
    message: entree.message.slice(0, 8000),
    publishedAt: entree.publieLe,
    status: entree.status,
    reason: entree.reason,
    rubrique: entree.rubrique ?? null,
    importance: entree.importance ?? null,
    newsId: entree.newsId ?? null,
    albumId: entree.albumId ?? null,
    mediaCount: entree.mediaCount,
    classifier: entree.classifier ?? null,
    updatedAt: new Date(),
  };

  await db
    .insert(facebookPosts)
    .values(valeurs)
    .onConflictDoUpdate({ target: facebookPosts.postId, set: valeurs });
}

/** Traite une publication : la publie, l'écarte, ou signale l'échec. */
async function traiter(post: PostFacebook, resultat: Resultat): Promise<void> {
  const classement = await classer(post.message, post.medias.length);

  if (!classement.publiable) {
    await journaliser({
      postId: post.id,
      permalink: post.permalink,
      message: post.message,
      publieLe: post.publieLe,
      status: "skipped",
      reason: classement.raison,
      rubrique: classement.rubrique,
      importance: classement.importance,
      mediaCount: post.medias.length,
      classifier: classement.moteur,
    });
    resultat.ecartees++;
    resultat.details.push(`— écartée : ${tronquer(classement.titre, 50)} (${classement.raison})`);
    return;
  }

  const aLaUne = meriteLaUne(classement);
  const dateISO = post.publieLe.toISOString().slice(0, 10);

  // 1. L'actualité
  const [actu] = await db
    .insert(news)
    .values({
      title: classement.titre,
      slug: slugifier(classement.titre, post.id),
      summary: classement.resume || null,
      content: nettoyer(post.message) || classement.resume || null,
      imageUrl: post.medias[0]?.url ?? null,
      date: dateISO,
      category: classement.rubrique,
      author: "Groupe Écoles 2IAE",
      featured: aLaUne,
      isActive: true,
      order: "1",
      source: "facebook",
      sourceId: post.id,
      sourceUrl: post.permalink,
    })
    .returning();

  // 2. Les images secondaires
  for (let i = 1; i < post.medias.length; i++) {
    await db.insert(newsImages).values({
      newsId: actu.id,
      imageUrl: post.medias[i].url,
      caption: post.medias[i].legende ?? null,
      order: i,
    });
  }

  // 3. La galerie, pour les publications richement illustrées
  let albumId: string | undefined;
  if (post.medias.length >= SEUIL_ALBUM) {
    const [album] = await db
      .insert(albums)
      .values({
        title: classement.titre,
        description: classement.resume || null,
        coverImage: post.medias[0].url,
        category: classement.rubrique,
        isActive: true,
        order: "1",
        source: "facebook",
        sourceId: post.id,
      })
      .returning();

    for (let i = 0; i < post.medias.length; i++) {
      await db.insert(galleryItems).values({
        albumId: album.id,
        title: post.medias[i].legende ?? null,
        mediaUrl: post.medias[i].url,
        mediaType: "image",
        isActive: true,
        order: String(i + 1),
      });
    }
    albumId = album.id;
  }

  // 4. Une seule actualité à la une à la fois
  if (aLaUne) await retirerAnciennesUnes(actu.id);

  await journaliser({
    postId: post.id,
    permalink: post.permalink,
    message: post.message,
    publieLe: post.publieLe,
    status: "published",
    reason: classement.raison,
    rubrique: classement.rubrique,
    importance: classement.importance,
    newsId: actu.id,
    albumId,
    mediaCount: post.medias.length,
    classifier: classement.moteur,
  });

  resultat.publiees++;
  resultat.details.push(
    `+ ${classement.rubrique}${aLaUne ? " [À LA UNE]" : ""} : ${tronquer(classement.titre, 55)}` +
      (albumId ? ` (+ album de ${post.medias.length} photos)` : ""),
  );
}

/** Ne laisse qu'une actualité en avant sur la page d'accueil. */
async function retirerAnciennesUnes(sauf: string): Promise<void> {
  const unes = await db
    .select({ id: news.id })
    .from(news)
    .where(eq(news.featured, true))
    .orderBy(desc(news.createdAt));

  for (const u of unes) {
    if (u.id !== sauf) {
      await db.update(news).set({ featured: false, updatedAt: new Date() }).where(eq(news.id, u.id));
    }
  }
}

/** Synchronisation complète : lit la page et traite ce qui est nouveau. */
export async function synchroniser(limite = 25): Promise<Resultat> {
  const resultat: Resultat = {
    vues: 0, publiees: 0, ecartees: 0, ignorees: 0, echecs: 0, details: [],
  };

  if (!integrationActive()) {
    resultat.details.push("Intégration Facebook non configurée (FACEBOOK_PAGE_TOKEN manquant).");
    return resultat;
  }

  const posts = await lirePublications(limite);
  return traiterPublications(posts, resultat);
}

/**
 * Traite une liste de publications déjà récupérées.
 *
 * Séparé de `synchroniser` pour que la chaîne classement → actualité → album
 * soit exerçable sans appeler la Graph API, et pour pouvoir rejouer un lot.
 */
export async function traiterPublications(
  posts: PostFacebook[],
  resultat: Resultat = { vues: 0, publiees: 0, ecartees: 0, ignorees: 0, echecs: 0, details: [] },
): Promise<Resultat> {
  resultat.vues = posts.length;

  // De la plus ancienne à la plus récente : la dernière publiée reste à la une.
  for (const post of [...posts].reverse()) {
    try {
      if (await dejaTraite(post.id)) {
        resultat.ignorees++;
        continue;
      }
      await traiter(post, resultat);
    } catch (err) {
      resultat.echecs++;
      const message = (err as Error).message;
      resultat.details.push(`! échec sur ${post.id} : ${message}`);
      console.error(`❌ Facebook — échec sur ${post.id} :`, message);
      try {
        await journaliser({
          postId: post.id,
          permalink: post.permalink,
          message: post.message,
          publieLe: post.publieLe,
          status: "failed",
          reason: message.slice(0, 500),
          mediaCount: post.medias.length,
        });
      } catch {
        /* le journal ne doit jamais interrompre la synchronisation */
      }
    }
  }
  return resultat;
}

/** Traite une publication unique, signalée par le webhook. */
export async function synchroniserUne(postId: string): Promise<Resultat> {
  const resultat: Resultat = {
    vues: 0, publiees: 0, ecartees: 0, ignorees: 0, echecs: 0, details: [],
  };
  if (!integrationActive()) return resultat;

  if (await dejaTraite(postId)) {
    resultat.ignorees++;
    return resultat;
  }

  const post = await lirePublication(postId);
  if (!post) return resultat;

  resultat.vues = 1;
  try {
    await traiter(post, resultat);
  } catch (err) {
    resultat.echecs++;
    console.error(`❌ Facebook — échec sur ${postId} :`, (err as Error).message);
  }
  return resultat;
}
