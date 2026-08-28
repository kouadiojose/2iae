// Analyse du contenu réel des images.
//
// Une publication porte souvent plusieurs visuels : une affiche de résultats,
// des photos de cérémonie, un portrait. Prendre la première venue produit des
// incohérences visibles — le site affichait une bannière « Bienvenue à 2IAE »
// illustrée par une affiche « Félicitation BTS 2025 », périmée d'un an.
//
// Ce module fait décrire chaque image par le modèle, puis choisit celle qui
// illustre vraiment le sujet et écarte celles dont le millésime est dépassé.

import OpenAI from "openai";
import fs from "fs";
import { db } from "../db";
import { imageAnalyses } from "@shared/schema";
import { eq } from "drizzle-orm";

const MODELE = process.env.OPENAI_MODEL || "gpt-4o-mini";
const TAILLE_MAX = 4 * 1024 * 1024;

export interface AnalyseImage {
  /** Ce que montre l'image, en une phrase */
  sujet: string;
  /** Année lisible sur l'image (millésime d'une affiche), sinon null */
  annee: number | null;
  /** "affiche" | "photo" | "portrait" | "autre" */
  genre: string;
  /** Texte marquant relevé sur l'image (titres, chiffres) */
  texte: string;
  /** L'image se prête-t-elle à une bannière large ? */
  banniereAdaptee: boolean;
  /** Motif, journalisé pour comprendre les choix */
  note: string;
}

let client: OpenAI | null = null;
function openai(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

function dataUri(chemin: string): string | null {
  try {
    if (!fs.existsSync(chemin)) return null;
    const taille = fs.statSync(chemin).size;
    if (taille === 0 || taille > TAILLE_MAX) return null;
    const ext = chemin.split(".").pop()?.toLowerCase();
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${type};base64,${fs.readFileSync(chemin).toString("base64")}`;
  } catch {
    return null;
  }
}

const CONSIGNE = `Tu examines une image publiée par le Groupe Écoles 2IAE International, établissement d'enseignement supérieur en Côte d'Ivoire.

Réponds UNIQUEMENT par un objet JSON :

{
  "sujet": "ce que montre l'image, une phrase",
  "annee": année lisible sur l'image (nombre) ou null,
  "genre": "affiche" | "photo" | "portrait" | "autre",
  "texte": "les mentions marquantes lues sur l'image (titres, pourcentages, dates), 300 caractères maximum",
  "banniereAdaptee": true ou false,
  "note": "une phrase justifiant ton avis"
}

- "annee" : uniquement si un millésime est explicitement écrit (« BTS 2025 », « session 2026 », « rentrée 2026-2027 »). Une photo sans date porte null. Ne déduis jamais l'année d'une impression.
- "texte" : recopie fidèlement les mentions importantes, notamment les pourcentages et les noms de campus. C'est souvent là que se trouve l'information.
- "banniereAdaptee" : true pour une image lisible et présentable en large sur une page d'accueil (affiche soignée, belle photo de groupe ou de cérémonie). false pour une capture floue, une image très chargée de texte fin, un montage illisible en petit, une capture d'écran.`;

/** Analyse une image, avec mise en cache : une image n'est jamais réexaminée. */
export async function analyserImage(
  chemin: string,
  cle: string,
): Promise<AnalyseImage | null> {
  const [cache] = await db
    .select()
    .from(imageAnalyses)
    .where(eq(imageAnalyses.cle, cle))
    .limit(1);
  if (cache?.donnees) {
    try {
      return JSON.parse(cache.donnees) as AnalyseImage;
    } catch {
      /* cache illisible : on réanalyse */
    }
  }

  const api = openai();
  const image = dataUri(chemin);
  if (!api || !image) return null;

  try {
    const reponse = await api.chat.completions.create({
      model: MODELE,
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CONSIGNE },
        {
          role: "user",
          content: [
            { type: "text", text: "Décris cette image." },
            { type: "image_url", image_url: { url: image, detail: "high" } },
          ] as any,
        },
      ],
    });

    const brut = reponse.choices[0]?.message?.content;
    if (!brut) return null;

    const d = JSON.parse(brut) as Record<string, unknown>;
    const anneeBrute = Number(d.annee);
    const analyse: AnalyseImage = {
      sujet: String(d.sujet ?? "").slice(0, 300),
      // Une année hors plage plausible est une lecture erronée, pas une donnée.
      annee:
        Number.isFinite(anneeBrute) && anneeBrute >= 2000 && anneeBrute <= 2100
          ? Math.round(anneeBrute)
          : null,
      genre: String(d.genre ?? "autre"),
      texte: String(d.texte ?? "").slice(0, 400),
      banniereAdaptee: d.banniereAdaptee === true,
      note: String(d.note ?? "").slice(0, 300),
    };

    await db
      .insert(imageAnalyses)
      .values({ cle, donnees: JSON.stringify(analyse) })
      .onConflictDoUpdate({
        target: imageAnalyses.cle,
        set: { donnees: JSON.stringify(analyse), createdAt: new Date() },
      });

    return analyse;
  } catch (err) {
    console.warn("⚠️  Analyse d'image indisponible :", (err as Error).message);
    return null;
  }
}

/**
 * L'image porte-t-elle un millésime plus ancien que la session en cours ?
 *
 * Sert uniquement à départager deux visuels : à qualité égale, on préfère le
 * plus récent. Ce n'est PAS un motif d'exclusion — une affiche « 100 % de
 * réussite » de la session précédente reste un argument valable, et la
 * retirer appauvrirait la page d'accueil sans rien apporter.
 */
export function estAnterieure(analyse: AnalyseImage, reference = new Date()): boolean {
  if (analyse.annee === null) return false;
  return analyse.annee < reference.getFullYear();
}

/**
 * Choisit, parmi les images d'une publication, celle qui illustre le mieux le
 * sujet pour la bannière.
 *
 * Départage : une affiche prime sur une photo, une photo sur une image
 * inadaptée, un millésime courant sur un plus ancien. À égalité on garde
 * l'ordre d'origine, celui que l'auteur de la publication a choisi.
 * Aucune image n'est exclue : un visuel ancien vaut mieux que pas de visuel.
 */
export function choisirImageBanniere(
  analyses: (AnalyseImage | null)[],
): { index: number; analyse: AnalyseImage } | null {
  type Candidat = { index: number; analyse: AnalyseImage; score: number };
  let meilleur: Candidat | null = null;

  analyses.forEach((a, i) => {
    if (!a) return;
    let score = 0;
    if (a.banniereAdaptee) score += 10;
    if (a.genre === "affiche") score += 4;
    else if (a.genre === "photo") score += 2;
    // Un visuel de la session en cours passe devant, sans écarter les autres.
    if (a.annee !== null) score += estAnterieure(a) ? 1 : 3;
    if (meilleur === null || score > meilleur.score) {
      meilleur = { index: i, analyse: a, score };
    }
  });

  const retenu = meilleur as Candidat | null;
  return retenu ? { index: retenu.index, analyse: retenu.analyse } : null;
}
