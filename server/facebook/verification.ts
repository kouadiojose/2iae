// Vérification des faits avant publication.
//
// Une consigne « n'invente aucun fait » ne suffit pas. Sur les premiers
// imports, le modèle a écrit :
//   — « Cocody » et « M'batto » comme campus du groupe : aucune occurrence
//     dans les 40 publications de la page ;
//   — « 42,54 % » comme taux national alors que la source dit toujours
//     42,48 % ;
//   — « un taux de réussite de 42,48 % » attribué à 2IAE, alors que ce chiffre
//     est le taux NATIONAL, celui auquel l'école se compare.
//
// Sur le site d'une école, un chiffre faux ou un campus inexistant se retourne
// contre l'établissement. Ce module ne fait donc pas confiance au modèle : il
// confronte mécaniquement chaque nombre et chaque lieu du texte produit à ce
// qui figure réellement dans la source.

import { nettoyer } from "./classification";

/** Campus et lieux que le groupe peut légitimement citer. */
const LIEUX_CONNUS = [
  "palmeraie", "yopougon", "yamoussoukro", "azaguie", "azaguié",
  "abidjan", "cote d'ivoire", "côte d'ivoire", "ivoire", "riviera",
  "sherbrooke", "canada", "dubai", "dubaï", "france", "afrique",
];

export interface Anomalie {
  genre: "nombre" | "lieu";
  valeur: string;
  message: string;
}

/** Normalise pour comparer : minuscules, sans accents ni ponctuation. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Extrait les nombres porteurs de sens : pourcentages, montants, années,
 * effectifs. Les nombres à un chiffre sont ignorés — « 4 campus », « 2 ans »
 * relèvent de la rédaction, pas du fait vérifiable, et généreraient du bruit.
 */
export function extraireNombres(texte: string): string[] {
  const trouves = texte.match(/\d[\d  ]*(?:[.,]\d+)?/g) ?? [];
  const nettoyes = trouves
    .map((n) => n.replace(/[  ]/g, "").replace(/[.,]$/, ""))
    .filter((n) => n.replace(/[.,]/g, "").length >= 2);
  return Array.from(new Set(nettoyes));
}

/** Deux écritures d'un même nombre : « 42,48 », « 42.48 », « 4248 ». */
function memeNombre(a: string, b: string): boolean {
  const c = (s: string) => s.replace(/[.,\s]/g, "");
  return c(a) === c(b);
}

/**
 * Confronte le texte produit à ses sources.
 *
 * `sources` réunit tout ce dont le rédacteur disposait : le message d'origine
 * et les mentions relevées sur l'affiche. Tout nombre absent de cet ensemble
 * a été inventé ou déformé.
 */
export function verifierFaits(produit: string, sources: string[]): Anomalie[] {
  // Les sources passent par nettoyer() avant comparaison : la page écrit ses
  // chiffres en faux gras Unicode (𝟲𝟳,𝟯𝟴%). Sans dé-stylisation préalable,
  // aucun chiffre du texte produit ne correspondait à sa source, et des
  // données pourtant exactes étaient signalées comme inventées.
  const source = normaliser(nettoyer(sources.join(" \n ")));
  const nombresSource = extraireNombres(source);
  const anomalies: Anomalie[] = [];

  for (const n of extraireNombres(normaliser(produit))) {
    if (!nombresSource.some((s) => memeNombre(s, n))) {
      anomalies.push({
        genre: "nombre",
        valeur: n,
        message: `Le nombre « ${n} » ne figure pas dans la publication d'origine.`,
      });
    }
  }

  // On ne cherche que les LIEUX, et seulement là où la phrase en annonce un
  // (« campus de X », « site de X », « à X »). Signaler tous les mots
  // capitalisés produisait surtout du bruit — « Groupe », « Université »,
  // « Licence » — qui noyait les vraies inventions comme « Cocody ».
  const apresIndice = produit.match(
    /(?:campus|site|antenne|centre)\s+(?:de\s+|du\s+|d['’])?([A-ZÉÈÀÂÎÔÛ][\wéèêàâîïôûç'’-]{2,})/g,
  ) ?? [];

  for (const bloc of Array.from(new Set(apresIndice))) {
    const mot = bloc.split(/\s+/).pop() ?? "";
    const norme = normaliser(mot);
    if (!norme || source.includes(norme)) continue;
    if (LIEUX_CONNUS.some((l) => normaliser(l) === norme)) continue;
    anomalies.push({
      genre: "lieu",
      valeur: mot,
      message: `Le lieu « ${mot} » n'apparaît pas dans la publication d'origine.`,
    });
  }

  return anomalies;
}

/**
 * Retire d'un texte les phrases qui portent un fait non sourcé.
 *
 * Choix assumé : supprimer la phrase fautive plutôt que tenter de la corriger.
 * Une correction automatique risquerait d'introduire une nouvelle erreur, alors
 * qu'un article un peu plus court reste exact — et l'exactitude prime sur
 * l'exhaustivité quand il s'agit des résultats d'un établissement.
 */
export function retirerPhrasesNonSourcees(
  texte: string,
  anomalies: Anomalie[],
): { texte: string; retirees: string[] } {
  if (!anomalies.length) return { texte, retirees: [] };

  const suspects = anomalies.filter((a) => a.genre === "nombre").map((a) => a.valeur);
  if (!suspects.length) return { texte, retirees: [] };

  const retirees: string[] = [];
  const paragraphes = texte.split(/\n\n+/).map((par) => {
    const phrases = par.split(/(?<=[.!?])\s+/);
    const gardees = phrases.filter((ph) => {
      const nb = extraireNombres(normaliser(ph));
      const fautive = nb.some((n) => suspects.some((s) => memeNombre(s, n)));
      if (fautive) retirees.push(ph.trim().slice(0, 120));
      return !fautive;
    });
    return gardees.join(" ").trim();
  });

  return {
    texte: paragraphes.filter(Boolean).join("\n\n").trim(),
    retirees,
  };
}
