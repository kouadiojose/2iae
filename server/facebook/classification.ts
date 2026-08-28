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
  /** Nom exact d'une rubrique de RUBRIQUES */
  rubrique: string;
  /** 0 à 100 : poids éditorial, décide de la mise à la une */
  importance: number;
  /** false = hors sujet pour un site institutionnel (vœux, condoléances…) */
  publiable: boolean;
  /** Explication courte, journalisée pour comprendre les décisions */
  raison: string;
  /** Quel moteur a produit ce classement */
  moteur: "ai" | "rules";
}

const MODELE = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

// ---------------------------------------------------------------- règles ----

export function classerParRegles(message: string, nbMedias: number): Classement {
  const propre = nettoyer(message);
  const norme = normaliser(propre);

  if (!norme || norme.length < 15) {
    return {
      titre: tronquer(propre || "Publication", 90),
      resume: "",
      rubrique: RUBRIQUE_DEFAUT,
      importance: 20,
      publiable: nbMedias > 0, // une photo seule reste montrable en galerie
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
      rubrique: RUBRIQUE_DEFAUT,
      importance: 0,
      publiable: false,
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
    rubrique: meilleure,
    importance,
    publiable: true,
    raison: meilleurScore
      ? `Classé par mots-clés (score ${meilleurScore})`
      : "Aucun mot-clé décisif, rubrique par défaut",
    moteur: "rules",
  };
}

// -------------------------------------------------------------------- IA ----

const CONSIGNE = `Tu prépares la reprise, sur le site institutionnel du Groupe Écoles 2IAE International (Abidjan, Côte d'Ivoire), d'une publication de sa page Facebook.

2IAE est un établissement d'enseignement supérieur spécialisé dans l'entrepreneuriat (BTS, Licence, Master, certificats).

Analyse la publication et réponds UNIQUEMENT par un objet JSON, sans texte autour :

{
  "titre": "titre court et informatif, 4 à 12 mots, sans emoji, sans MAJUSCULES intégrales",
  "resume": "1 à 2 phrases neutres résumant la publication, 200 caractères maximum",
  "rubrique": "une valeur EXACTE de la liste des rubriques",
  "importance": nombre entier de 0 à 100,
  "publiable": true ou false,
  "raison": "une phrase courte justifiant ton choix"
}

Rubriques autorisées (recopie le libellé exactement) :
RUBRIQUES_ICI

Règles :
- "publiable": false UNIQUEMENT pour ce qui n'a réellement pas sa place sur un site institutionnel : vœux d'anniversaire ou de fête, condoléances, messages purement personnels, partages sans rapport avec l'école, contenu promotionnel d'un tiers.
- En cas de doute, préfère "publiable": true avec une importance basse. Une simple formule de politesse ("bonne semaine", "bon week-end") à la fin d'une publication ne la rend PAS impubliable : si elle montre la vie de l'école, elle a sa place en "Vie du campus". Le site doit refléter le quotidien de l'établissement, pas seulement ses grands événements.
- "importance" reflète le poids éditorial : 80 à 100 pour un fait marquant (remise de diplômes, distinction nationale, partenariat majeur, ouverture des inscriptions) ; 40 à 70 pour une actualité utile ; 0 à 30 pour le quotidien ordinaire. La vie de campus courante reste basse : elle doit nourrir le site sans occuper la page d'accueil.
- Le titre doit se comprendre hors contexte, sans "Nous avons le plaisir de..." ni formule d'introduction.
- Écris en français, avec une majuscule initiale et une orthographe soignée.`;

function consigne(): string {
  return CONSIGNE.replace(
    "RUBRIQUES_ICI",
    RUBRIQUES.map((r) => `- "${r.nom}" : ${r.description}`).join("\n"),
  );
}

async function classerParIA(message: string, nbMedias: number): Promise<Classement | null> {
  const api = openai();
  if (!api) return null;

  const propre = nettoyer(message);

  try {
    const reponse = await api.chat.completions.create({
      model: MODELE,
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: consigne() },
        {
          role: "user",
          content: `Publication Facebook (${nbMedias} média(s) joint(s)) :\n\n${tronquer(propre, 4000)}`,
        },
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

    return {
      titre: tronquer(titre, 120),
      resume: tronquer(String(data.resume ?? ""), 220),
      rubrique: rubrique.nom,
      importance,
      publiable: data.publiable !== false,
      raison: tronquer(String(data.raison ?? "Classé par IA"), 200),
      moteur: "ai",
    };
  } catch (err) {
    console.warn("⚠️  Classement IA indisponible :", (err as Error).message);
    return null;
  }
}

// ------------------------------------------------------------------ public ---

/** Classe une publication : IA si possible, règles sinon. Ne rejette jamais. */
export async function classer(message: string, nbMedias: number): Promise<Classement> {
  const parIA = await classerParIA(message, nbMedias);
  return parIA ?? classerParRegles(message, nbMedias);
}

/** Une publication passe-t-elle à la une ? Le seuil dépend de la rubrique. */
export function meriteLaUne(c: Classement): boolean {
  const r = trouverRubrique(c.rubrique);
  return c.publiable && c.importance >= (r?.seuilUne ?? 70);
}

export { NOMS_RUBRIQUES, tronquer };
