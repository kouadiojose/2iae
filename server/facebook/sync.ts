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
import { eq, and, desc, isNull } from "drizzle-orm";
import { lirePublications, lirePublication, integrationActive, type PostFacebook } from "./graph";
import { normaliser } from "./rubriques";
import { analyserImage, choisirImageBanniere } from "./images";
import { reviser } from "./revision";
import { verifierFaits, retirerPhrasesNonSourcees } from "./verification";
import {
  redigerAccroche,
  corrigerNomsPropres,
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

  // Seconde passe : un relecteur corrige la langue avant publication. Sur le
  // site d'une école, une faute d'accord ou un titre bancal entame la
  // crédibilité de l'établissement.
  const relu = await reviser({
    titre: classement.titre,
    resume: classement.resume,
    article: classement.article || nettoyer(post.message),
  });
  if (relu.corrections.length) {
    console.log(`   ✎ relecture : ${relu.corrections.slice(0, 3).join(" · ")}`);
  }

  // Troisième passe : vérification des faits. Le modèle a déjà écrit des
  // campus inexistants (« Cocody », « M'batto ») et déformé le taux national
  // (42,54 au lieu de 42,48). Aucune consigne n'empêche cela de façon fiable ;
  // seule une confrontation mécanique à la source le peut.
  const sources = [post.message, analyses[indexIllustration]?.texte ?? ""];
  const anomalies = verifierFaits(`${relu.titre}\n${relu.resume}\n${relu.article}`, sources);
  let corps = relu.article;
  if (anomalies.length) {
    const purge = retirerPhrasesNonSourcees(corps, anomalies);
    corps = purge.texte;
    console.warn(
      `   ⚠ faits non sourcés écartés : ${anomalies.slice(0, 4).map((a) => a.valeur).join(", ")}`,
    );
    purge.retirees.forEach((ph) => console.warn(`     phrase retirée : ${ph}`));
  }

  const aLaUne = meriteLaUne(classement);
  const dateISO = post.publieLe.toISOString().slice(0, 10);

  // 1. L'actualité
  const [actu] = await db
    .insert(news)
    .values({
      title: relu.titre,
      slug: slugifier(relu.titre, post.id),
      summary: relu.resume || null,
      // L'article réécrit puis relu prime sur le texte d'origine : c'est lui
      // qui donne au site son registre institutionnel.
      content: corps || nettoyer(post.message) || relu.resume || null,
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
      revisedAt: new Date(),
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
        // Rang 1 à 3 selon l'importance : une annonce à 90 ou plus prend le
        // rang 1, à 80 le rang 2, au seuil de 75 le rang 3.
        //
        // L'échelle est volontairement resserrée sur celle des sliders saisis
        // à la main, qui portent les rangs 1 et 2. Avec un rang « 100 moins
        // l'importance », les résultats du BTS se retrouvaient en rang 10,
        // donc derrière eux dans le carrousel. À rang égal, le tri serveur
        // départage par date décroissante : l'annonce récente passe devant
        // l'affiche de la session précédente.
        order: String(Math.max(1, 10 - Math.floor(classement.importance / 10))),
        source: "facebook",
        sourceId: post.id,
        importance: classement.importance,
        contentYear: pourBanniere.analyse.annee ?? null,
      })
      .returning();
    sliderId = slider.id;
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
  const setA = new Set(a);
  const setB = new Set(b);
  // Sur des ensembles des deux côtés : compter les répétitions au numérateur
  // face à un dénominateur dédoublonné gonflait l'indice et créait de faux
  // doublons dès qu'un titre répétait un mot.
  const communs = Array.from(setA).filter((m) => setB.has(m)).length;
  const union = new Set([...a, ...b]).size;
  return union ? communs / union : 0;
}

/** Campus et partenaires : deux annonces qui n'en citent pas le même sont distinctes. */
const CAMPUS = ["yopougon", "palmeraie", "yamoussoukro", "azaguie", "sherbrooke", "abidjan"];

function memeSujet(a: string[], b: string[]): boolean {
  const chiffres = (t: string[]) => t.filter((m) => /^\d+$/.test(m)).sort().join(",");
  const lieux = (t: string[]) => t.filter((m) => CAMPUS.includes(m)).sort().join(",");
  // « BTS 2026 : 83,54 % à Azaguié » et « … 64,13 % à Yopougon » annoncent deux
  // campus et deux chiffres : ce sont deux nouvelles, pas un doublon. Sans ce
  // garde-fou, deux accroches ne différant que par le nom du campus tombaient
  // au-dessus du seuil de proximité et la seconde était perdue.
  return chiffres(a) === chiffres(b) && lieux(a) === lieux(b);
}

/** Une bannière active annonce-t-elle déjà la même chose ? */
async function banniereDejaPresente(titre: string): Promise<boolean> {
  const actives = await db
    .select({ title: sliders.title })
    .from(sliders)
    .where(eq(sliders.isActive, true));
  const cible = signatureTitre(titre);
  if (!cible.length) return false;
  return actives.some((b) => {
    const sig = signatureTitre(b.title);
    return memeSujet(cible, sig) && proximite(cible, sig) >= SEUIL_PROXIMITE;
  });
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
    if (sig.length && gardees.some((g) => memeSujet(sig, g) && proximite(sig, g) >= SEUIL_PROXIMITE)) {
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
  // Deux préfixes coexistent : /api/assets/ pour les fichiers importés, et
  // /public-objects/ pour les sliders livrés avec le site. Ne reconnaître que
  // le premier laissait la bannière « Bienvenue à 2IAE International »
  // indéboulonnable en tête du carrousel.
  const m = url.match(/^\/(?:api\/assets|public-objects)\/(.+)$/);
  if (!m) return null;
  const relatif = decodeURIComponent(m[1]);
  if (relatif.includes("..")) return null; // jamais sortir des dossiers servis

  const bases = [
    process.env.UPLOADS_DIR || path.join(process.cwd(), "server", "uploads"),
    path.join(process.cwd(), "attached_assets"),
    path.join(process.cwd(), "client", "public"),
    path.join(process.cwd(), "public"),
  ];
  for (const base of bases) {
    const complet = path.join(base, relatif);
    if (fs.existsSync(complet)) return complet;
  }
  return null;
}

/**
 * Crée les bannières manquantes pour les publications qui les méritaient.
 *
 * Deux situations laissent un contenu fort sans bannière : les publications
 * traitées avant que la valeur éditoriale ne soit persistée, et celles pour
 * lesquelles l'appel au modèle a échoué au mauvais moment. Dans les deux cas,
 * la publication est journalisée « published » et ne sera plus jamais
 * réexaminée — les résultats du BTS par campus restaient ainsi au placard.
 *
 * La bannière est reconstruite depuis l'article : son titre, son chapeau et
 * son image ont déjà été rédigés, relus et vérifiés.
 */
export async function creerBannieresManquantes(lot = 6): Promise<string[]> {
  const candidats = await db
    .select({
      postId: facebookPosts.postId,
      importance: facebookPosts.importance,
      newsId: facebookPosts.newsId,
    })
    .from(facebookPosts)
    .where(and(eq(facebookPosts.status, "published"), isNull(facebookPosts.sliderId)))
    .orderBy(desc(facebookPosts.importance))
    .limit(lot * 4);

  const crees: string[] = [];

  for (const c of candidats) {
    if (crees.length >= lot) break;
    if (!c.newsId || (c.importance ?? 0) < SEUIL_BANNIERE_RATTRAPAGE) continue;

    const [article] = await db
      .select({
        id: news.id,
        title: news.title,
        summary: news.summary,
        imageUrl: news.imageUrl,
        category: news.category,
        date: news.date,
      })
      .from(news)
      .where(eq(news.id, c.newsId))
      .limit(1);
    if (!article?.imageUrl) continue;

    if (await banniereDejaPresente(article.title)) continue;

    const millesime = Number((article.date || "").slice(0, 4)) || null;
    const [slider] = await db
      .insert(sliders)
      .values({
        title: tronquer(article.title, 70),
        subtitle: article.category.toUpperCase(),
        description: article.summary,
        imageUrl: article.imageUrl,
        button1Text: "Lire l'article",
        button1Link: `/actualites/${article.id}`,
        button2Text: "Nous contacter",
        button2Link: "/contact",
        isActive: true,
        order: String(Math.max(1, 10 - Math.floor((c.importance ?? 75) / 10))),
        source: "facebook",
        sourceId: `rattrapage_${c.postId}`,
        importance: c.importance,
        contentYear: millesime,
      })
      .returning();

    await db
      .update(facebookPosts)
      .set({ sliderId: slider.id, updatedAt: new Date() })
      .where(eq(facebookPosts.postId, c.postId));

    crees.push(article.title);
  }

  if (crees.length) await limiterBannieres();
  return crees;
}

/** Importance minimale pour repêcher une publication en bannière. */
const SEUIL_BANNIERE_RATTRAPAGE = 80;

/**
 * Fait relire les articles publiés avant la mise en place du relecteur.
 *
 * Les premiers imports sont partis en ligne sans seconde passe : le site
 * affichait « Les atouts de choisir le groupe 2IAE » et « Qui a été orienté
 * chez nous-même ? ». Sur le site d'une école, ces fautes se voient et se
 * paient.
 *
 * Chaque article n'est relu qu'une fois — la date de relecture est conservée.
 * Le lot est borné pour ne pas monopoliser un rattrapage : les suivants
 * passeront à l'exécution d'après.
 */
export async function reviserArticlesPublies(lot = 8): Promise<string[]> {
  const aRelire = await db
    .select({
      id: news.id,
      title: news.title,
      summary: news.summary,
      content: news.content,
    })
    .from(news)
    .where(and(eq(news.source, "facebook"), isNull(news.revisedAt)))
    .orderBy(desc(news.createdAt))
    .limit(lot);

  const corriges: string[] = [];

  for (const a of aRelire) {
    const relu = await reviser({
      titre: a.title,
      resume: a.summary ?? "",
      article: a.content ?? "",
    });

    const change =
      relu.titre !== a.title ||
      relu.resume !== (a.summary ?? "") ||
      relu.article !== (a.content ?? "");

    await db
      .update(news)
      .set({
        title: relu.titre,
        summary: relu.resume || null,
        content: relu.article || a.content,
        // Marquée dans tous les cas : un texte déjà correct ne doit pas être
        // resoumis à chaque rattrapage.
        revisedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(news.id, a.id));

    if (change) corriges.push(`« ${a.title} » → « ${relu.titre} »`);
  }
  return corriges;
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

  // Le nom de la marque est retiré avant de chercher un chiffre : sans cela,
  // le « 2 » de 2IAE faisait passer « Bienvenue à 2IAE International » pour un
  // titre informatif, et la bannière n'était jamais réaccordée.
  const sansMarque = t.replace(/\b2iae\b/g, " ");

  const porteUneInfo =
    /\d/.test(sansMarque) ||
    /(yopougon|palmeraie|yamoussoukro|azaguie|sherbrooke|partenariat|inscription|orientation|resultat)/.test(
      sansMarque,
    );
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
    // Rattrapage : les bannières créées avant la correction typographique
    // portent « sherbrooke », « yopougon » en minuscules.
    const corrige = corrigerNomsPropres(b.title);
    if (corrige !== b.title) {
      await db
        .update(sliders)
        .set({ title: corrige, updatedAt: new Date() })
        .where(eq(sliders.id, b.id));
      reaccordees.push(`typographie : « ${b.title} » → « ${corrige} »`);
    }

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
export async function limiterBannieres(): Promise<void> {
  const auto = await db
    .select({ id: sliders.id })
    .from(sliders)
    .where(and(eq(sliders.source, "facebook"), eq(sliders.isActive, true)))
    // L'ordre de survie : millésime le plus récent, puis valeur éditoriale,
    // puis ancienneté. Trier sur la seule date d'insertion revenait à laisser
    // une publication banale chasser les résultats d'examen de la page.
    .orderBy(desc(sliders.contentYear), desc(sliders.importance), desc(sliders.createdAt));

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

  // Une seule fois, en fin de lot : arbitrer à chaque insertion évinçait les
  // bannières du début du lot avant même que les suivantes soient comparées.
  await limiterBannieres();
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
    await limiterBannieres();
  } catch (err) {
    resultat.echecs++;
    console.error(`❌ Facebook — échec sur ${postId} :`, (err as Error).message);
  }
  return resultat;
}
