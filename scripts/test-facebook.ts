/**
 * Vérification de la chaîne d'import Facebook, sans appeler la Graph API.
 *
 * Injecte des publications représentatives de ce que publie réellement une
 * page d'école — texte brut, majuscules, émojis, messages de circonstance —
 * puis contrôle ce qui atterrit en base : rubrique, une, actualité, album.
 *
 * Usage : DATABASE_URL=... npx tsx scripts/test-facebook.ts
 */
import { traiterPublications } from "../server/facebook/sync";
import { classerParRegles, meriteLaUne, nettoyer } from "../server/facebook/classification";
import type { PostFacebook } from "../server/facebook/graph";
import { db } from "../server/db";
import { news, albums, facebookPosts, newsImages, galleryItems } from "@shared/schema";
import { eq } from "drizzle-orm";

function media(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    url: `/api/assets/facebook/fb_test_${i}.jpg`,
    type: "image" as const,
  }));
}

const PUBLICATIONS: PostFacebook[] = [
  {
    id: "100_001",
    message:
      "🎓 CÉRÉMONIE DE REMISE DES DIPLÔMES 2026 🎓\n\n" +
      "Le Groupe Écoles 2IAE International a célébré ce samedi la sortie de sa promotion " +
      "2026. Plus de 200 étudiants ont reçu leur diplôme de BTS en présence du Directeur " +
      "Général M. Séraphin KOUA et des parrains de promotion. Félicitations à tous nos " +
      "diplômés qui rejoignent aujourd'hui le monde professionnel !",
    permalink: "https://www.facebook.com/Groupe2ife2iae/posts/100_001",
    publieLe: new Date("2026-07-11T10:00:00Z"),
    medias: media(6), // doit aussi créer un album
  },
  {
    id: "100_002",
    message:
      "Signature de convention entre 2IAE et la Chambre de Commerce.\n\n" +
      "Un partenariat qui ouvrira de nouvelles opportunités de stage à nos étudiants.",
    permalink: "https://www.facebook.com/Groupe2ife2iae/posts/100_002",
    publieLe: new Date("2026-07-15T09:00:00Z"),
    medias: media(2), // pas d'album : sous le seuil
  },
  {
    id: "100_003",
    message: "Joyeux anniversaire à notre chère collègue Mme Aya ! 🎂🎉 Que Dieu te bénisse.",
    permalink: "https://www.facebook.com/Groupe2ife2iae/posts/100_003",
    publieLe: new Date("2026-07-18T08:00:00Z"),
    medias: media(1), // doit être ÉCARTÉ
  },
  {
    id: "100_004",
    message:
      "INSCRIPTIONS OUVERTES — Rentrée académique 2026-2027 !\n\n" +
      "Les inscriptions en 1ère année de BTS sont ouvertes sur nos 4 sites : Palmeraie, " +
      "Yamoussoukro, Azaguié et Yopougon. Dossier : 2 extraits de naissance, photocopie du " +
      "bac. Contactez-nous au 07 07 57 82 82.",
    permalink: "https://www.facebook.com/Groupe2ife2iae/posts/100_004",
    publieLe: new Date("2026-08-01T07:00:00Z"),
    medias: media(1),
  },
  {
    id: "100_005",
    message: "Petite ambiance ce matin au campus de la Palmeraie ☀️ Bonne semaine à tous !",
    permalink: "https://www.facebook.com/Groupe2ife2iae/posts/100_005",
    publieLe: new Date("2026-08-05T07:30:00Z"),
    medias: media(4), // vie de campus : album oui, une non
  },
];

/**
 * Cas relevé sur la vraie page : les titres sont écrits en « faux gras »
 * Unicode, qui vit dans la même zone que les émojis. Sans conversion, le
 * nettoyage effaçait tout le titre.
 */
const FAUX_GRAS = "𝗡𝗼𝘂𝘃𝗲𝗮𝘂𝘅 𝗯𝗮𝗰𝗵𝗲𝗹𝗶𝗲𝗿𝘀 : 𝗰𝗼𝗺𝗺𝗲𝗻𝘁 𝗰𝗵𝗼𝗶𝘀𝗶𝗿 ?";

function ligne(ok: boolean, texte: string) {
  console.log(`  ${ok ? "✅" : "❌"} ${texte}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log("=".repeat(72));
  console.log("CLASSEMENT PAR RÈGLES (moteur de secours, sans clé OpenAI)");
  console.log("=".repeat(72));

  for (const p of PUBLICATIONS) {
    const c = classerParRegles(p.message, p.medias.length);
    const une = meriteLaUne(c) ? " [À LA UNE]" : "";
    const etat = c.publiable ? c.rubrique + une : "ÉCARTÉE";
    console.log(`\n  ${p.id} → ${etat}  (importance ${c.importance})`);
    console.log(`     titre  : ${c.titre}`);
    console.log(`     raison : ${c.raison}`);
  }

  console.log("\n" + "=".repeat(72));
  console.log("TEXTE STYLISÉ UNICODE (faux gras de la page réelle)");
  console.log("=".repeat(72) + "\n");
  const converti = nettoyer(FAUX_GRAS);
  console.log(`  avant : ${FAUX_GRAS}`);
  console.log(`  après : ${converti}`);
  ligne(
    converti === "Nouveaux bacheliers : comment choisir ?",
    `le faux gras est converti en texte lisible (obtenu : « ${converti} »)`,
  );

  console.log("\n" + "=".repeat(72));
  console.log("CHAÎNE COMPLÈTE EN BASE");
  console.log("=".repeat(72) + "\n");

  const r = await traiterPublications(PUBLICATIONS);
  console.log(
    `  vues=${r.vues} publiées=${r.publiees} écartées=${r.ecartees} ` +
      `déjà connues=${r.ignorees} échecs=${r.echecs}\n`,
  );
  r.details.forEach((d) => console.log(`  ${d}`));

  console.log("\n  --- contrôles ---");

  ligne(r.echecs === 0, "aucun échec");
  ligne(r.ecartees === 1, `1 publication écartée (obtenu : ${r.ecartees})`);
  ligne(r.publiees === 4, `4 publications reprises (obtenu : ${r.publiees})`);

  const anniv = await db
    .select()
    .from(facebookPosts)
    .where(eq(facebookPosts.postId, "100_003"));
  ligne(
    anniv[0]?.status === "skipped",
    `le message d'anniversaire est écarté (statut : ${anniv[0]?.status})`,
  );
  ligne(
    anniv[0]?.newsId === null,
    "le message d'anniversaire n'a créé aucune actualité",
  );

  const importees = await db.select().from(news).where(eq(news.source, "facebook"));
  ligne(importees.length === 4, `4 actualités importées (obtenu : ${importees.length})`);

  const unes = importees.filter((n) => n.featured);
  ligne(unes.length <= 1, `au plus une actualité à la une (obtenu : ${unes.length})`);

  const campus = importees.find((n) => n.sourceId === "100_005");
  ligne(
    campus?.category === "Vie du campus" && !campus?.featured,
    `la publication d'ambiance va en « Vie du campus » sans monter à la une ` +
      `(rubrique : ${campus?.category}, une : ${campus?.featured})`,
  );

  const diplomes = importees.find((n) => n.sourceId === "100_001");
  ligne(
    diplomes?.category === "Cérémonies & Diplômes",
    `la remise de diplômes est bien classée (obtenu : ${diplomes?.category})`,
  );

  const albumsImportes = await db.select().from(albums).where(eq(albums.source, "facebook"));
  ligne(
    albumsImportes.length === 2,
    `2 albums créés, pour les publications de 3 photos ou plus (obtenu : ${albumsImportes.length})`,
  );

  if (diplomes) {
    const secondaires = await db
      .select()
      .from(newsImages)
      .where(eq(newsImages.newsId, diplomes.id));
    ligne(
      secondaires.length === 5,
      `les 5 images secondaires sont rattachées à l'actualité (obtenu : ${secondaires.length})`,
    );
  }

  const albumDiplomes = albumsImportes.find((a) => a.sourceId === "100_001");
  if (albumDiplomes) {
    const items = await db
      .select()
      .from(galleryItems)
      .where(eq(galleryItems.albumId, albumDiplomes.id));
    ligne(items.length === 6, `l'album contient les 6 photos (obtenu : ${items.length})`);
  }

  // Aucune URL Facebook ne doit subsister : elles expirent.
  const urlsFb = importees.filter((n) => (n.imageUrl || "").includes("fbcdn"));
  ligne(urlsFb.length === 0, "aucune URL de CDN Facebook stockée en base");

  console.log("\n  --- idempotence : on rejoue le même lot ---");
  const r2 = await traiterPublications(PUBLICATIONS);
  ligne(r2.publiees === 0, `aucune republication (obtenu : ${r2.publiees})`);
  ligne(r2.ignorees === 5, `les 5 publications sont reconnues (obtenu : ${r2.ignorees})`);

  const apres = await db.select().from(news).where(eq(news.source, "facebook"));
  ligne(apres.length === 4, `toujours 4 actualités, aucun doublon (obtenu : ${apres.length})`);

  console.log(
    process.exitCode === 1 ? "\n❌ Des contrôles ont échoué.\n" : "\n✅ Tous les contrôles passent.\n",
  );
  process.exit(process.exitCode ?? 0);
}

main().catch((err) => {
  console.error("\n❌ Erreur :", err);
  process.exit(1);
});
