// Relecture des textes avant publication.
//
// Le rédacteur produit un article en une passe, et laisse passer ce que laisse
// passer toute première rédaction : accords fautifs, syntaxe bancale
// (« les atouts de choisir le groupe 2IAE »), titres interrogatifs repris tels
// quels du réseau social (« Qui a été orienté chez nous-même ? »), majuscules
// oubliées sur les noms propres.
//
// Sur le site d'un établissement d'enseignement, ces fautes coûtent cher : un
// parent qui les repère doute de l'école elle-même. D'où cette seconde passe,
// dont c'est l'unique tâche — un relecteur qui ne réécrit pas le fond, mais ne
// laisse rien passer sur la forme.

import OpenAI from "openai";
import { corrigerNomsPropres } from "./classification";

const MODELE = process.env.OPENAI_MODEL || "gpt-4o-mini";

export interface TexteARelire {
  titre: string;
  resume: string;
  article: string;
}

export interface Relecture extends TexteARelire {
  /** Ce que le relecteur a corrigé, journalisé pour pouvoir le vérifier */
  corrections: string[];
}

let client: OpenAI | null = null;
function openai(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const CONSIGNE = `Tu es relecteur-correcteur pour le site institutionnel du Groupe Écoles 2IAE International, établissement d'enseignement supérieur en Côte d'Ivoire (campus de Palmeraie, Yopougon, Yamoussoukro, et Université de l'Entrepreneuriat d'Azaguié).

On te soumet un titre, un chapeau et un article. Corrige-les et réponds UNIQUEMENT par un objet JSON :

{
  "titre": "le titre corrigé",
  "resume": "le chapeau corrigé",
  "article": "l'article corrigé, paragraphes séparés par \\\\n\\\\n",
  "corrections": ["liste courte de ce que tu as corrigé"]
}

CE QUE TU CORRIGES :
- Orthographe, accords, conjugaison, syntaxe. Exemple : « les atouts de choisir le groupe 2IAE » est fautif — écrire « les atouts du Groupe 2IAE » ou « les raisons de choisir le Groupe 2IAE ».
- Typographie française : espace insécable avant : ; ! ? et « », apostrophe droite, pas de double espace, pas de MAJUSCULES INTÉGRALES dans le corps du texte.
- Noms propres et sigles : Groupe 2IAE, 2IAE, BTS, ATPA, ATPV, GBAT, RHCOM, APC, Yopougon, Palmeraie, Yamoussoukro, Azaguié, Abidjan, Côte d'Ivoire, Université de Sherbrooke.
- Titres : un titre doit énoncer une information, jamais poser une question rhétorique reprise du réseau social. « Qui a été orienté chez nous-même ? » devient « Orientations 2026 : les nouveaux bacheliers rejoignent le Groupe 2IAE ». Supprime les formules creuses (« Découvrez… », « Ne manquez pas… ») quand elles n'apportent rien.
- Chapeau : il complète le titre, il ne le répète pas. S'il n'est qu'une reprise du titre, réécris-le à partir de l'article.
- Répétitions lourdes et tournures de réseau social (« nous », interpellation du lecteur, appels à liker ou partager).

CE QUE TU NE TOUCHES PAS :
- Les faits : aucun chiffre, aucune date, aucun nom, aucun pourcentage ne doit être modifié, ajouté ou supprimé. Tu corriges la langue, pas le contenu.
- La longueur : ne développe pas, ne résume pas. Un article de trois paragraphes reste un article de trois paragraphes.
- Le registre institutionnel déjà en place.

Si un texte est déjà correct, renvoie-le à l'identique avec "corrections": [].`;

/**
 * Relit un texte et le corrige.
 *
 * Renvoie le texte d'origine si la relecture est indisponible : mieux vaut un
 * texte non relu qu'aucun texte, et l'appelant n'a pas à gérer d'échec.
 */
export async function reviser(texte: TexteARelire): Promise<Relecture> {
  const inchange: Relecture = { ...texte, corrections: [] };

  const api = openai();
  if (!api) return inchange;
  if (!texte.titre && !texte.article) return inchange;

  try {
    const reponse = await api.chat.completions.create({
      model: MODELE,
      temperature: 0,
      max_tokens: 1600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CONSIGNE },
        {
          role: "user",
          content:
            `TITRE :\n${texte.titre}\n\n` +
            `CHAPEAU :\n${texte.resume}\n\n` +
            `ARTICLE :\n${texte.article}`,
        },
      ],
    });

    const brut = reponse.choices[0]?.message?.content;
    if (!brut) return inchange;

    const d = JSON.parse(brut) as Record<string, unknown>;
    const titre = String(d.titre ?? "").trim();
    const article = String(d.article ?? "").trim();

    // Un relecteur qui renvoie un texte vide ou amputé de moitié s'est égaré :
    // on garde alors l'original plutôt que de publier un contenu tronqué.
    if (!titre) return inchange;
    if (texte.article && article.length < texte.article.length * 0.5) {
      console.warn("⚠️  Relecture écartée : article anormalement raccourci");
      return inchange;
    }

    const corrections = Array.isArray(d.corrections)
      ? (d.corrections as unknown[]).map((c) => String(c).slice(0, 160)).slice(0, 12)
      : [];

    return {
      titre: corrigerNomsPropres(titre).slice(0, 200),
      resume: corrigerNomsPropres(String(d.resume ?? texte.resume).trim()).slice(0, 400),
      article: corrigerNomsPropres(article || texte.article),
      corrections,
    };
  } catch (err) {
    console.warn("⚠️  Relecture indisponible :", (err as Error).message);
    return inchange;
  }
}
