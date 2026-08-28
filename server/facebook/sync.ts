// Synchronisation de la page Facebook vers le site.
//
// Chaîne complète pour une publication :
//   Graph API → rapatriement des images → classement → actualité (+ album) → journal
//
// Idempotence : la table facebook_posts garde une ligne par publication vue,
// et news.source_id porte une contrainte d'unicité. Rejouer une
// synchronisation ne crée donc jamais de doublon, ce qui compte car le webhook
// et le rattrapage périodique voient souvent les mêmes publications.

import fs from "fs";
import path from "path";
import { db } from "../db";
import { facebookPosts, news, newsImages, albums, galleryItems, sliders } from "@shared/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { lirePublications, lirePublication, integrationActive, type PostFacebook } from "./graph";
import { normaliser } from "./rubriques";
import { analyserImage, choisirImageBanniere } from "./images";
import {
  redigerAccroche,
  classer,
  meriteLaUne,
  nettoyer,
  tronquer,
  empreinteContenu,
  MAX_BANNIERES,
} from "./classification";

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
  contentHash?: string;
  sliderId?: string;
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
    contentHash: entree.contentHash ?? null,
    sliderId: entree.sliderId ?? null,
    updatedAt: new Date(),
  };

  await db
    .insert(facebookPosts)
    .values(valeurs)
    .onConflictDoUpdate({ target: facebookPosts.postId, set: valeurs });
}

/**
 * Cette publication reprend-elle un texte déjà publié sur le site ?
 *
 * La page republie régulièrement le même contenu à quelques jours d'écart.
 * Sans ce contrôle, le site afficherait des articles jumeaux.
 */
async function estUneRepublication(empreinte: string): Promise<boolean> {
  if (!empreinte) return false;
  const [dejaVue] = await db
    .select({ id: facebookPosts.id })
    .from(facebookPosts)
    .where(and(eq(facebookPosts.contentHash, empreinte), eq(facebookPosts.status, "published")))
    .limit(1);
  return Boolean(dejaVue);
}

/** Traite une publication : la publie, l'écarte, ou signale l'échec. */
async function traiter(post: PostFacebook, resultat: Resultat): Promise<void> {
  const empreinte = empreinteContenu(post.message);

  if (await estUneRepublication(empreinte)) {
    await journaliser({
      postId: post.id,
      permalink: post.permalink,
      message: post.message,
      publieLe: post.publieLe,
      status: "skipped",
      reason: "Republication d'un contenu déjà présent sur le site",
      mediaCount: post.medias.length,
      contentHash: empreinte,
    });
    resultat.ecartees++;
    resultat.details.push(`— republication ignorée : ${tronquer(nettoyer(post.message), 50)}`);
    return;
  }

  // Analyse de chaque visuel : une publication mêle souvent une affiche de
  // résultats, des photos de cérémonie et des portraits. Prendre la première
  // venue produisait des bannières incohérentes.
  const analyses = [];
  for (const m of post.medias.slice(0, 4)) {
    analyses.push(await analyserImage(m.cheminLocal, m.url));
  }

  const pourBanniere = choisirImageBanniere(analyses);

  // L'image transmise au classement est celle qui illustre le mieux le sujet,
  // et c'est sur elle que le modèle lira les chiffres.
  const indexIllustration = pourBanniere?.index ?? 0;
  const classement = await classer(
    post.message,
    post.medias.length,
    post.medias[indexIllustration]?.cheminLocal,
    analyses[indexIllustration]?.texte,
  );

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
      contentHash: empreinte,
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
      // L'article réécrit par l'IA prime sur le texte d'origine : c'est lui
      // qui donne au site son registre institutionnel. Repli sur le texte
      // nettoyé quand le moteur de secours a pris la main.
      content: classement.article || nettoyer(post.message) || classement.resume || null,
      imageUrl: post.medias[indexIllustration]?.url ?? null,
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

  // 5. La bannière d'accueil, réservée aux annonces fortes et illustrées.
  // Garde-fou : deux bannières de même titre feraient défiler deux fois la
  // même chose sur la page d'accueil. La consigne demande des accroches
  // distinctes, mais on ne s'en remet pas au seul jugement du modèle.
  let sliderId: string | undefined;
  const titreBanniere = classement.titreBanniere || classement.titre;
  const doublonBanniere = classement.banniere
    ? await banniereDejaPresente(titreBanniere)
    : false;

  const banniereRecevable =
    classement.banniere && Boolean(pourBanniere) && !doublonBanniere;

  if (banniereRecevable && pourBanniere) {
    const [slider] = await db
      .insert(sliders)
      .values({
        title: titreBanniere,
        subtitle: classement.sousTitre || classement.rubrique.toUpperCase(),
        description: classement.resume || null,
        imageUrl: post.medias[pourBanniere.index].url,
        button1Text: "Lire l'article",
        button1Link: `/actualites/${actu.id}`,
        button2Text: "Nous contacter",
        button2Link: "/contact",
        isActive: true,
        order: "1",
        source: "facebook",
        sourceId: post.id,
      })
      .returning();
    sliderId = slider.id;
    await limiterBannieres();
  }

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
    sliderId,
    mediaCount: post.medias.length,
    classifier: classement.moteur,
    contentHash: empreinte,
  });

  resultat.publiees++;
  resultat.details.push(
    `+ ${classement.rubrique}${aLaUne ? " [À LA UNE]" : ""}${sliderId ? " [BANNIÈRE]" : ""} : ` +
      `${tronquer(classement.titre, 50)}` +
      (albumId ? ` (+ album de ${post.medias.length} photos)` : ""),
  );
}

/**
 * Réduit un titre de bannière à sa substance, pour comparaison.
 *
 * Une égalité stricte ne suffit pas : « 67,38 % d'admis au 2IAE » et
 * « 67,38 % d'admis au Groupe 2IAE » désignent la même annonce et se
 * retrouveraient tous deux sur la page d'accueil. On retire donc la casse,
 * les accents, la ponctuation et les mots outils avant de comparer.
 */
const MOTS_OUTILS = new Set([
  "le", "la", "les", "du", "de", "des", "au", "aux", "un", "une",
  "et", "a", "en", "groupe", "ecole", "ecoles", "2iae", "notre", "nos",
]);

function signatureTitre(titre: string): string[] {
  return normaliser(titre)
    .split(" ")
    .filter((m) => m && !MOTS_OUTILS.has(m));
}

/**
 * Proximité de deux titres, entre 0 et 1 (indice de Jaccard).
 *
 * L'égalité stricte ne suffisait pas : « 67,38 % au Groupe 2IAE » et
 * « 67,38 % d'admis au Groupe 2IAE » annoncent la même chose et se
 * retrouvaient tous deux en bannière. En comparant la part de mots communs,
 * ces deux-là se reconnaissent, tandis que « 83,54 % à Azaguié » reste
 * distinct puisqu'il porte un autre chiffre et un autre campus.
 */
const SEUIL_PROXIMITE = 0.6;

function proximite(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const communs = a.filter((m) => setB.has(m)).length;
  const union = new Set([...a, ...b]).size;
  return union ? communs / union : 0;
}

/** Une bannière active annonce-t-elle déjà la même chose ? */
async function banniereDejaPresente(titre: string): Promise<boolean> {
  const actives = await db
    .select({ title: sliders.title })
    .from(sliders)
    .where(eq(sliders.isActive, true));
  const cible = signatureTitre(titre);
  if (!cible.length) return false;
  return actives.some((b) => proximite(cible, signatureTitre(b.title)) >= SEUIL_PROXIMITE);
}

/**
 * Désactive les bannières actives qui font double emploi.
 *
 * Appelée au démarrage : la déduplication a été ajoutée après une première
 * mise en production, où plusieurs bannières annonçaient déjà la même chose.
 * Sans ce rattrapage, elles resteraient affichées jusqu'à ce que la rotation
 * les évince d'elle-même, ce qui peut prendre des jours.
 */
export async function dedupliquerBannieres(): Promise<number> {
  const actives = await db
    .select({ id: sliders.id, title: sliders.title, source: sliders.source })
    .from(sliders)
    .where(eq(sliders.isActive, true))
    .orderBy(desc(sliders.createdAt));

  const gardees: string[][] = [];
  let desactivees = 0;

  for (const b of actives) {
    const sig = signatureTitre(b.title);
    // Les bannières saisies à la main font foi : on les conserve toujours et
    // on ne compare que les suivantes à celles-ci.
    if (b.source !== "facebook") {
      gardees.push(sig);
      continue;
    }
    if (sig.length && gardees.some((g) => proximite(sig, g) >= SEUIL_PROXIMITE)) {
      await db
        .update(sliders)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(sliders.id, b.id));
      desactivees++;
    } else {
      gardees.push(sig);
    }
  }
  return desactivees;
}

/**
 * Retrouve le fichier derrière une URL /api/assets/…
 *
 * Deux emplacements possibles, comme la route qui sert ces fichiers : le
 * volume des uploads d'abord, puis attached_assets pour les images
 * historiques livrées avec le dépôt.
 */
function cheminDepuisUrl(url: string): string | null {
  const m = url.match(/^\/api\/assets\/(.+)$/);
  if (!m) return null;
  const relatif = decodeURIComponent(m[1]);
  if (relatif.includes("..")) return null; // jamais sortir des dossiers servis

  const bases = [
    process.env.UPLOADS_DIR || path.join(process.cwd(), "server", "uploads"),
    path.join(process.cwd(), "attached_assets"),
  ];
  for (const base of bases) {
    const complet = path.join(base, relatif);
    if (fs.existsSync(complet)) return complet;
  }
  return null;
}

/**
 * Accorde le texte des bannières à l'image qu'elles portent.
 *
 * Le site affichait « Bienvenue à 2IAE International » au-dessus d'une affiche
 * annonçant « Félicitation BTS 2025 — 100 % en ATPA ». L'image portait un
 * message fort, le titre n'en disait rien : le visiteur voyait une accroche
 * creuse à côté d'un argument de vente.
 *
 * Ne sont retouchées que les bannières au titre générique — celles qui ne
 * perdent rien à être précisées. Une bannière déjà spécifique est laissée
 * telle quelle, et rien n'est supprimé : tout reste modifiable en
 * administration.
 */
const TITRES_GENERIQUES = [
  "bienvenue", "excellence academique", "formation de qualite",
  "notre ecole", "groupe 2iae", "2iae international", "felecitations",
  "felicitations", "nos formations", "bienvenue a 2iae international",
];

function titreEstGenerique(titre: string): boolean {
  const t = normaliser(titre);
  if (!t) return true;
  // Un titre sans chiffre ni nom de campus n'annonce rien de précis.
  const porteUneInfo = /\d/.test(t) ||
    /(yopougon|palmeraie|yamoussoukro|azaguie|sherbrooke|partenariat|inscription|orientation)/.test(t);
  if (porteUneInfo) return false;
  return TITRES_GENERIQUES.some((g) => t.includes(g) || g.includes(t));
}

export async function harmoniserBannieres(): Promise<string[]> {
  const actives = await db
    .select({
      id: sliders.id,
      title: sliders.title,
      subtitle: sliders.subtitle,
      description: sliders.description,
      imageUrl: sliders.imageUrl,
    })
    .from(sliders)
    .where(eq(sliders.isActive, true));

  const reaccordees: string[] = [];

  for (const b of actives) {
    if (!b.imageUrl || !titreEstGenerique(b.title)) continue;

    const chemin = cheminDepuisUrl(b.imageUrl);
    if (!chemin) continue;

    const analyse = await analyserImage(chemin, b.imageUrl);
    // Sans mention lisible sur l'image, on n'a rien de mieux à proposer.
    if (!analyse || !analyse.texte || analyse.texte.length < 15) continue;

    const accroche = await redigerAccroche(analyse.sujet, analyse.texte);
    if (!accroche) continue;

    await db
      .update(sliders)
      .set({
        title: accroche.titre,
        subtitle: accroche.sousTitre,
        description: accroche.description || b.description,
        updatedAt: new Date(),
      })
      .where(eq(sliders.id, b.id));

    reaccordees.push(`« ${b.title} » → « ${accroche.titre} »`);
  }
  return reaccordees;
}

/**
 * Ne conserve que les dernières bannières issues de Facebook.
 *
 * Les sliders saisis depuis l'administration ne sont jamais touchés : seuls
 * ceux marqués source = "facebook" entrent dans la rotation. Les plus anciens
 * sont désactivés plutôt que supprimés, pour rester récupérables.
 */
async function limiterBannieres(): Promise<void> {
  const auto = await db
    .select({ id: sliders.id })
    .from(sliders)
    .where(and(eq(sliders.source, "facebook"), eq(sliders.isActive, true)))
    .orderBy(desc(sliders.createdAt));

  for (const s of auto.slice(MAX_BANNIERES)) {
    await db
      .update(sliders)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(sliders.id, s.id));
  }
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
