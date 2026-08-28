// Classement d'une publication Facebook pour le site 2IAE.
//
// Deux moteurs, dans cet ordre :
//   1. OpenAI, qui rédige un vrai titre et un résumé propres à partir d'un
//      texte de réseau social souvent brut (majuscules, émojis, sauts de ligne).
//   2. Des règles lexicales, utilisées si la clé API manque, si l'appel échoue
//      ou si la réponse est inexploitable.
//
// Le repli n'est pas un second choix offert à l'utilisateur : c'est ce qui
// garantit que la synchronisation continue de fonctionner quand OpenAI est
// indisponible. Sans lui, une panne de l'API bloquerait tout le site.

import OpenAI from "openai";
import { createHash } from "crypto";
import fs from "fs";
import {
  RUBRIQUES,
  RUBRIQUE_DEFAUT,
  NOMS_RUBRIQUES,
  trouverRubrique,
  normaliser,
} from "./rubriques";

export interface Classement {
  /** Titre court, sans émoji, utilisable comme titre d'actualité */
  titre: string;
  /** Résumé de 1 à 2 phrases pour les listes et les partages */
  resume: string;
  /**
   * Corps de l'article, rédigé pour le site.
   *
   * C'est la valeur ajoutée de l'IA : une publication Facebook est écrite pour
   * un fil d'actualité (émojis, apostrophes, « nous », appels à commenter),
   * pas pour un site d'établissement. L'article reprend les mêmes faits dans
   * une langue institutionnelle et se lit hors de son contexte d'origine.
   *
   * Vide quand le moteur de secours a pris la main : on retombe alors sur le
   * texte d'origine nettoyé, jamais sur une réécriture approximative.
   */
  article: string;
  /** Nom exact d'une rubrique de RUBRIQUES */
  rubrique: string;
  /** 0 à 100 : poids éditorial, décide de la mise à la une */
  importance: number;
  /** false = hors sujet pour un site institutionnel (vœux, condoléances…) */
  publiable: boolean;
  /** Cette publication mérite-t-elle la bannière de la page d'accueil ? */
  banniere: boolean;
  /** Accroche de bannière, très courte (4 à 8 mots) */
  titreBanniere: string;
  /** Sur-titre de bannière, en capitales, 2 à 5 mots */
  sousTitre: string;
  /** Explication courte, journalisée pour comprendre les décisions */
  raison: string;
  /** Quel moteur a produit ce classement */
  moteur: "ai" | "rules";
}

const MODELE = process.env.OPENAI_MODEL || "gpt-4o-mini";

/** Importance minimale pour prétendre à la bannière de la page d'accueil. */
const SEUIL_BANNIERE = 75;

/**
 * Nombre de bannières issues de Facebook conservées simultanément.
 *
 * Le groupe compte quatre campus, qui publient chacun leurs résultats, plus le
 * résultat consolidé : cela fait cinq annonces légitimes. À trois places, deux
 * campus étaient mécaniquement évincés.
 */
export const MAX_BANNIERES = Number(process.env.MAX_BANNIERES) || 5;

/** Publications qui n'ont pas leur place sur le site d'une école. */
const MOTS_HORS_SUJET = [
  "bonne fete", "joyeux anniversaire", "bon anniversaire", "condoleances",
  "repose en paix", "rip", "toutes nos condoleances", "bonne annee",
  "joyeux noel", "bonne fete des meres", "bonne fete des peres",
  "bon week end", "bonne semaine", "bon dimanche",
];

let client: OpenAI | null = null;
function openai(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/**
 * Met une capitale initiale sans toucher au reste.
 *
 * La consigne interdit les MAJUSCULES INTÉGRALES, et le modèle sur-corrige
 * parfois en renvoyant un titre entièrement en minuscules.
 */
function capitaliser(texte: string): string {
  const t = texte.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * Rétablit la typographie des noms propres du groupe.
 *
 * La consigne interdit les MAJUSCULES INTÉGRALES, et le modèle applique la
 * règle jusqu'aux sigles et noms de lieux : il renvoie « groupe 2iae »,
 * « yopougon », « bts ». Sur un site d'établissement, ces coquilles se voient
 * immédiatement.
 */
const NOMS_PROPRES: [RegExp, string][] = [
  [/\b2iae\b/gi, "2IAE"],
  [/\bbts\b/gi, "BTS"],
  [/\brti\b/gi, "RTI"],
  [/\bbtp\b/gi, "BTP"],
  [/\byopougon\b/gi, "Yopougon"],
  [/\bpalmeraie\b/gi, "Palmeraie"],
  [/\byamoussoukro\b/gi, "Yamoussoukro"],
  [/\bazagui([ée])\b/gi, "Azaguié"],
  [/\babidjan\b/gi, "Abidjan"],
  [/\bc[oô]te d['’]ivoire\b/gi, "Côte d'Ivoire"],
  [/\bsherbrooke\b/gi, "Sherbrooke"],
  [/\buniversit[ée] de sherbrooke\b/gi, "Université de Sherbrooke"],
  [/\bapc\b/g, "APC"],
];

export function corrigerNomsPropres(texte: string): string {
  let t = texte;
  for (const [motif, remplacement] of NOMS_PROPRES) t = t.replace(motif, remplacement);
  return t;
}

/** Coupe proprement sur un mot, sans laisser de mot tronqué. */
function tronquer(texte: string, max: number): string {
  const t = texte.trim();
  if (t.length <= max) return t;
  const coupe = t.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  return (espace > max * 0.6 ? coupe.slice(0, espace) : coupe).trim() + "…";
}

/**
 * Convertit les lettres et chiffres « stylisés » d'Unicode en caractères
 * normaux : 𝗡𝗼𝘂𝘃𝗲𝗮𝘂𝘅 devient Nouveaux.
 *
 * La page 2IAE emploie beaucoup ce faux gras. Ces caractères appartiennent au
 * bloc Mathematical Alphanumeric Symbols (U+1D400–U+1D7FF), hors BMP, donc
 * au même endroit que les émojis : sans cette conversion préalable, le
 * nettoyage les effacerait et la publication perdrait son titre.
 *
 * Le bloc est organisé en séries régulières — 26 majuscules puis 26 minuscules
 * par style, et des séries de 10 pour les chiffres — d'où le calcul par modulo.
 */
export function deStyliser(texte: string): string {
  return texte.replace(/\uD835[\uDC00-\uDFFF]/g, (ch) => {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x1d400 && cp <= 0x1d6a3) {
      const i = (cp - 0x1d400) % 52;
      return i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(97 + i - 26);
    }
    if (cp >= 0x1d7ce && cp <= 0x1d7ff) {
      return String.fromCharCode(48 + ((cp - 0x1d7ce) % 10));
    }
    return ch;
  });
}

/**
 * Retire émojis et espaces parasites d'un texte de réseau social.
 *
 * Écrit sans le flag `u` : le projet ne fixe pas de `target` dans tsconfig.json,
 * donc TypeScript compile vers ES5 où ce flag n'existe pas. Les émojis étant
 * hors BMP, on les vise par leurs paires de substituts UTF-16, et on ajoute les
 * blocs de symboles et de flèches qui, eux, tiennent dans le BMP.
 */
export function nettoyer(texte: string): string {
  return deStyliser(texte) // avant tout : le faux gras n'est pas un émoji
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, " ") // émojis (hors BMP)
    .replace(/[☀-➿←-⇿️⬀-⯿]/g, " ") // symboles, flèches
    .replace(/[​-‍⁠﻿‎‏]/g, "") // marques invisibles
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Empreinte du contenu d'une publication.
 *
 * La page republie régulièrement le même texte à quelques jours d'écart (vu
 * sur deux publications du 27 et du 28 août). Sans cette empreinte, le site
 * se retrouverait avec des articles jumeaux. On la calcule sur le texte
 * normalisé, tronqué : une republication assortie d'une phrase d'accroche
 * différente doit tout de même être reconnue.
 */
export function empreinteContenu(message: string): string {
  const base = normaliser(nettoyer(message)).slice(0, 500);
  return createHash("sha1").update(base).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------- règles ----

export function classerParRegles(message: string, nbMedias: number): Classement {
  const propre = nettoyer(message);
  const norme = normaliser(propre);

  if (!norme || norme.length < 15) {
    return {
      titre: tronquer(propre || "Publication", 90),
      resume: "",
      article: "",
      rubrique: RUBRIQUE_DEFAUT,
      importance: 20,
      publiable: nbMedias > 0, // une photo seule reste montrable en galerie
      banniere: false,
      titreBanniere: "",
      sousTitre: "",
      raison: "Texte trop court pour être classé",
      moteur: "rules",
    };
  }

  // Score par rubrique : un mot-clé long est plus discriminant qu'un mot court.
  let meilleure = RUBRIQUE_DEFAUT;
  let meilleurScore = 0;
  for (const r of RUBRIQUES) {
    let score = 0;
    for (const mot of r.motsCles) {
      if (norme.includes(mot)) score += mot.includes(" ") ? 3 : 1;
    }
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleure = r.nom;
    }
  }

  // Une formule de circonstance ne disqualifie que si le message ne parle de
  // rien d'autre. Beaucoup de publications légitimes se terminent par « bonne
  // semaine » ou « bon week-end » : les écarter ferait disparaître du site la
  // vie de campus, qui est justement ce qu'il doit montrer.
  const horsSujet = MOTS_HORS_SUJET.find((m) => norme.includes(m));
  if (horsSujet && meilleurScore === 0 && norme.length < 220) {
    return {
      titre: tronquer(propre, 90),
      resume: "",
      article: "",
      rubrique: RUBRIQUE_DEFAUT,
      importance: 0,
      publiable: false,
      banniere: false,
      titreBanniere: "",
      sousTitre: "",
      raison: `Message de circonstance (« ${horsSujet} »), sans autre sujet`,
      moteur: "rules",
    };
  }

  // Importance : le signal lexical, plus un bonus pour les publications
  // documentées (texte développé, plusieurs photos).
  let importance = Math.min(70, meilleurScore * 12);
  if (nbMedias >= 3) importance += 10;
  if (propre.length > 400) importance += 8;
  importance = Math.max(0, Math.min(100, importance));

  const premiereLigne = propre.split("\n").find((l) => l.trim().length > 10) || propre;

  return {
    titre: tronquer(premiereLigne, 90),
    resume: tronquer(propre.replace(/\n+/g, " "), 180),
    // Le moteur de secours ne rédige pas : sync.ts retombera sur le texte
    // d'origine nettoyé plutôt que sur une réécriture approximative.
    article: "",
    rubrique: meilleure,
    importance,
    publiable: true,
    // La bannière est réservée à l'IA : sans compréhension du contenu, on ne
    // met rien en avant sur la page d'accueil.
    banniere: false,
    titreBanniere: "",
    sousTitre: "",
    raison: meilleurScore
      ? `Classé par mots-clés (score ${meilleurScore})`
      : "Aucun mot-clé décisif, rubrique par défaut",
    moteur: "rules",
  };
}

// -------------------------------------------------------------------- IA ----

const CONSIGNE = `Tu es le rédacteur du site institutionnel du Groupe Écoles 2IAE International, un seul et même groupe d'enseignement supérieur spécialisé dans l'entrepreneuriat, en Côte d'Ivoire. Il réunit plusieurs campus : 2IAE Palmeraie et 2IAE Yopougon (Abidjan), 2IAE Yamoussoukro, et l'Université de l'Entrepreneuriat 2IAE Azaguié. Il forme en BTS, Licence, Master et certificats.

Écris toujours comme un groupe unique à plusieurs campus, jamais comme des écoles séparées ou concurrentes. Quand une publication concerne un campus, nomme-le (« le campus de Yopougon », « l'Université de l'Entrepreneuriat 2IAE Azaguié ») tout en le rattachant au Groupe 2IAE.

On te donne une publication de sa page Facebook. Ta tâche : en faire un article pour le site, ou déterminer qu'elle n'y a pas sa place.

Réponds UNIQUEMENT par un objet JSON, sans texte autour :

{
  "titre": "titre d'article, 5 à 12 mots, informatif, sans emoji ni MAJUSCULES intégrales",
  "resume": "chapeau de 1 à 2 phrases, 200 caracteres maximum",
  "article": "le corps de l'article en francais, 2 a 4 paragraphes separes par \\n\\n",
  "rubrique": "une valeur EXACTE de la liste ci-dessous",
  "importance": entier de 0 a 100,
  "publiable": true ou false,
  "banniere": true ou false,
  "titreBanniere": "accroche de 4 a 8 mots pour la banniere d'accueil",
  "sousTitre": "sur-titre de 2 a 5 mots EN CAPITALES",
  "raison": "une phrase justifiant tes choix"
}

Rubriques autorisées (recopie le libellé exactement) :
RUBRIQUES_ICI

IMAGE JOINTE :
- Quand une image accompagne la publication, LIS-LA. La page communique beaucoup par affiches, et les chiffres importants (taux de réussite, taux de placement, taux d'insertion, numéros de contact, noms de campus) y figurent souvent sans être repris dans le texte.
- Tout ce qui est lisible sur l'image est un fait utilisable, au même titre que le texte.
- Ne devine pas ce qui est illisible ou ambigu : dans le doute, n'en parle pas.

RÉDACTION DE L'ARTICLE — le point le plus important :
- N'INVENTE AUCUN FAIT. Pas de chiffre, de date, de nom, de lieu ni de citation qui ne soit dans la publication ou lisible sur l'image jointe. Cet établissement existe : une information fausse lui nuirait. Si la publication est trop maigre pour nourrir un article, écris un seul paragraphe court plutôt que de broder.
- Réécris, ne recopie pas. La publication est écrite pour un fil d'actualité ; l'article est écrit pour un site consulté par des parents, des futurs étudiants et des partenaires. Il doit se comprendre seul, des mois plus tard.
- Registre institutionnel et sobre : « le Groupe 2IAE », « l'établissement », plutôt que « nous ». Aucun émoji, aucun hashtag, aucune interpellation du lecteur (« Qui a été orienté chez nous ? »), aucun appel à commenter, liker ou partager.
- Garde la substance : chiffres, taux de réussite, dates, sites concernés, noms de filières, partenaires cités. Ce sont eux qui font l'intérêt de l'article.
- Une publication purement promotionnelle ou interrogative peut devenir un article utile si tu la reformules en information : ce que l'établissement propose, à qui, et pourquoi.
- Écris un français soigné. Pas de majuscules intégrales dans le corps du texte.

PUBLIABLE :
- "publiable": false uniquement pour ce qui n'a réellement pas sa place : vœux d'anniversaire ou de fête, condoléances, messages personnels, partages sans rapport avec l'école, publicité d'un tiers.
- En cas de doute, préfère true avec une importance basse. Une formule de politesse en fin de publication ne la disqualifie pas. Le site doit refléter le quotidien de l'établissement, pas seulement ses grands moments.

IMPORTANCE :
- 80 à 100 : fait marquant — résultats d'examens, remise de diplômes, distinction, partenariat majeur, ouverture des inscriptions, orientations.
- 40 à 70 : actualité utile — événement, présentation d'une filière, information pratique.
- 0 à 30 : quotidien ordinaire — ambiance, photo de campus, message d'humeur.

BANNIÈRE — sois exigeant, elle n'accueille que le sommet :
- "banniere": true seulement si l'importance atteint 75 ET que la publication porte une annonce forte, tournée vers l'extérieur, qui mérite d'accueillir un visiteur arrivant sur le site.
- Typiquement : résultats d'examens, ouverture des inscriptions, distinction obtenue, partenariat officiel, cérémonie de diplômes.
- Jamais pour une photo d'ambiance, un message d'humeur ou une publication sans image.
- "titreBanniere" est une accroche, pas une phrase, et elle doit être PROPRE À CETTE PUBLICATION. Plusieurs bannières coexistent sur la page d'accueil : si deux publications portent le même titre générique, le visiteur voit deux fois la même chose. Mentionne donc ce qui distingue celle-ci — le site concerné, le chiffre marquant, le nom du partenaire. Écris « BTS 2026 : 64,13 % à Yopougon » plutôt que « Résultats du BTS 2026 ».
- Respecte la typographie des noms propres et des sigles : 2IAE, BTS, Yopougon, Palmeraie, Yamoussoukro, Azaguié, Abidjan.
- "sousTitre" est un sur-titre court EN CAPITALES : « ADMISSIONS », « EXCELLENCE ACADÉMIQUE », « NOS RÉSULTATS ».`;

function consigne(): string {
  return CONSIGNE.replace(
    "RUBRIQUES_ICI",
    RUBRIQUES.map((r) => `- "${r.nom}" : ${r.description}`).join("\n"),
  );
}

/**
 * Encode une image en data URI pour l'envoyer au modèle.
 *
 * Renvoie null si le fichier manque ou dépasse la taille retenue : une image
 * illisible ne doit jamais faire échouer le classement, qui se poursuit alors
 * sur le seul texte.
 */
const TAILLE_IMAGE_MAX = 4 * 1024 * 1024;

function imageEnDataUri(chemin: string): string | null {
  try {
    if (!fs.existsSync(chemin)) return null;
    const stat = fs.statSync(chemin);
    if (stat.size === 0 || stat.size > TAILLE_IMAGE_MAX) return null;
    const ext = chemin.split(".").pop()?.toLowerCase();
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${type};base64,${fs.readFileSync(chemin).toString("base64")}`;
  } catch {
    return null;
  }
}

async function classerParIA(
  message: string,
  nbMedias: number,
  cheminImage?: string,
  texteImage?: string,
): Promise<Classement | null> {
  const api = openai();
  if (!api) return null;

  const propre = nettoyer(message);

  // L'affiche porte souvent les chiffres que le texte ne reprend pas.
  const image = cheminImage ? imageEnDataUri(cheminImage) : null;

  const contenu: any[] = [
    {
      type: "text",
      text:
        `Publication Facebook (${nbMedias} média(s) joint(s)) :\n\n${tronquer(propre, 4000)}` +
        (texteImage
          ? `\n\nMentions relevées sur le visuel joint :\n${tronquer(texteImage, 500)}`
          : "") +
        (image ? "\n\nL'image jointe est reproduite ci-dessous : lis-la." : ""),
    },
  ];
  if (image) {
    contenu.push({ type: "image_url", image_url: { url: image, detail: "high" } });
  }

  try {
    const reponse = await api.chat.completions.create({
      model: MODELE,
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: consigne() },
        { role: "user", content: contenu },
      ],
    });

    const brut = reponse.choices[0]?.message?.content;
    if (!brut) return null;

    const data = JSON.parse(brut) as Record<string, unknown>;

    // La rubrique doit exister : un modèle peut inventer un libellé voisin.
    const rubrique = trouverRubrique(String(data.rubrique ?? ""));
    if (!rubrique) {
      console.warn(`⚠️  Rubrique inconnue renvoyée par l'IA : "${data.rubrique}"`);
      return null;
    }

    const titre = String(data.titre ?? "").trim();
    if (!titre) return null;

    const importanceBrute = Number(data.importance);
    const importance = Number.isFinite(importanceBrute)
      ? Math.max(0, Math.min(100, Math.round(importanceBrute)))
      : 40;

    const publiable = data.publiable !== false;

    // La bannière n'accueille qu'un contenu porteur et illustré. On revérifie
    // ici plutôt que de faire confiance au seul « oui » du modèle : sans image,
    // un slider s'afficherait sur un fond vide.
    const banniere =
      publiable && data.banniere === true && importance >= SEUIL_BANNIERE && nbMedias > 0;

    return {
      titre: corrigerNomsPropres(capitaliser(tronquer(titre, 120))),
      resume: corrigerNomsPropres(capitaliser(tronquer(String(data.resume ?? ""), 220))),
      article: corrigerNomsPropres(String(data.article ?? "").trim()),
      rubrique: rubrique.nom,
      importance,
      publiable,
      banniere,
      titreBanniere: corrigerNomsPropres(capitaliser(tronquer(String(data.titreBanniere ?? titre), 60))),
      sousTitre: tronquer(String(data.sousTitre ?? "").toUpperCase(), 40),
      raison: tronquer(String(data.raison ?? "Classé par IA"), 200),
      moteur: "ai",
    };
  } catch (err) {
    console.warn("⚠️  Classement IA indisponible :", (err as Error).message);
    return null;
  }
}

// ------------------------------------------------------------------ public ---

export interface Accroche {
  titre: string;
  sousTitre: string;
  description: string;
}

/**
 * Rédige l'accroche d'une bannière à partir de ce que montre son image.
 *
 * Sert à réaccorder une bannière dont le titre ne dit rien du visuel : le
 * message est déjà sur l'affiche, il suffit de le reprendre.
 */
export async function redigerAccroche(
  sujet: string,
  texteImage: string,
): Promise<Accroche | null> {
  const api = openai();
  if (!api) return null;

  try {
    const reponse = await api.chat.completions.create({
      model: MODELE,
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Tu rédiges l'accroche d'une bannière pour la page d'accueil du Groupe Écoles 2IAE International, établissement d'enseignement supérieur en Côte d'Ivoire (campus de Palmeraie, Yopougon, Yamoussoukro, et Université de l'Entrepreneuriat d'Azaguié).

On te décrit une image déjà présente sur le site. Reprends son message, sans rien inventer, et réponds UNIQUEMENT par un objet JSON :

{
  "titre": "accroche de 4 à 8 mots reprenant l'information forte de l'image",
  "sousTitre": "sur-titre de 2 à 4 mots EN CAPITALES",
  "description": "une phrase de 140 caractères maximum"
}

- N'utilise que ce qui figure dans la description et les mentions fournies. Aucun chiffre, aucune date, aucun nom inventé.
- Si un millésime apparaît (« BTS 2025 »), conserve-le : une réussite passée reste une réussite, mais elle doit être datée pour rester honnête.
- Typographie exacte des noms propres : 2IAE, BTS, Yopougon, Palmeraie, Yamoussoukro, Azaguié.
- Pas d'emoji, pas de majuscules intégrales dans le titre.`,
        },
        {
          role: "user",
          content: `Ce que montre l'image : ${sujet}\n\nMentions lues sur l'image :\n${tronquer(texteImage, 600)}`,
        },
      ],
    });

    const brut = reponse.choices[0]?.message?.content;
    if (!brut) return null;
    const d = JSON.parse(brut) as Record<string, unknown>;

    const titre = corrigerNomsPropres(capitaliser(tronquer(String(d.titre ?? "").trim(), 70)));
    if (!titre || titre.length < 8) return null;

    return {
      titre,
      sousTitre: corrigerNomsPropres(tronquer(String(d.sousTitre ?? "").toUpperCase(), 40)),
      description: corrigerNomsPropres(capitaliser(tronquer(String(d.description ?? ""), 160))),
    };
  } catch (err) {
    console.warn("⚠️  Rédaction d'accroche indisponible :", (err as Error).message);
    return null;
  }
}

/** Classe une publication : IA si possible, règles sinon. Ne rejette jamais. */
export async function classer(
  message: string,
  nbMedias: number,
  cheminImage?: string,
  texteImage?: string,
): Promise<Classement> {
  const parIA = await classerParIA(message, nbMedias, cheminImage, texteImage);
  return parIA ?? classerParRegles(message, nbMedias);
}

/** Une publication passe-t-elle à la une ? Le seuil dépend de la rubrique. */
export function meriteLaUne(c: Classement): boolean {
  const r = trouverRubrique(c.rubrique);
  return c.publiable && c.importance >= (r?.seuilUne ?? 70);
}

export { NOMS_RUBRIQUES, tronquer };
