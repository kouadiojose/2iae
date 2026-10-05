// Étude d'un long texte (livre entier, transcription d'un cours de plusieurs
// heures) en deux temps : lecture morceau par morceau avec le modèle rapide,
// qui prend des notes fidèles, puis synthèse de toutes les notes en un dossier
// structuré par le modèle de la bibliothèque. Le résultat est gardé en base par
// l'appelant : on n'étudie qu'une fois, tous les étudiants en profitent.
import type Anthropic from "@anthropic-ai/sdk";
import { demanderJsonCout } from "./ia";

// ── Schémas JSON (sorties structurées) ─────────────────────────────────────

type Schema = Record<string, unknown>;
export const chaine = (description?: string): Schema => ({ type: "string", ...(description && { description }) });
export const entier = (description?: string): Schema => ({ type: "integer", ...(description && { description }) });
export const liste = (items: Schema, description?: string): Schema => ({ type: "array", items, ...(description && { description }) });
export const objet = (proprietes: Record<string, Schema>, description?: string): Schema => ({
  type: "object",
  properties: proprietes,
  required: Object.keys(proprietes),
  additionalProperties: false,
  ...(description && { description }),
});
export const choix = (valeurs: string[], description?: string): Schema => ({ type: "string", enum: valeurs, ...(description && { description }) });

// ── Découpage ──────────────────────────────────────────────────────────────

export type Morceau = { texte: string; debut: number; fin: number };

/** Morceaux d'environ `taille` caractères, coupés entre deux paragraphes (ou deux lignes) quand c'est possible. */
export function decouper(texte: string, taille: number): Morceau[] {
  const morceaux: Morceau[] = [];
  let debut = 0;
  while (debut < texte.length) {
    let fin = Math.min(texte.length, debut + taille);
    if (fin < texte.length) {
      const paragraphe = texte.lastIndexOf("\n\n", fin);
      const ligne = texte.lastIndexOf("\n", fin);
      if (paragraphe > debut + taille * 0.7) fin = paragraphe;
      else if (ligne > debut + taille * 0.7) fin = ligne;
    }
    morceaux.push({ texte: texte.slice(debut, fin), debut, fin });
    debut = fin;
  }
  return morceaux;
}

// ── Lecture par morceaux ───────────────────────────────────────────────────

export type Compteur = { coutMicro: number };

async function avecUnNouvelEssai<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      return await f();
    } catch {
      throw e;
    }
  }
}

/**
 * Lit chaque morceau avec le modèle rapide (quelques-uns en parallèle) et
 * renvoie ses notes, dans l'ordre. Un morceau illisible deux fois de suite est
 * sauté ; au-delà d'un quart de morceaux perdus, l'étude échoue.
 */
export async function lireMorceaux<T>(o: {
  morceaux: { contenu: string | Anthropic.Beta.BetaContentBlockParam[] }[];
  systeme: string;
  schema: Schema;
  utilisateurId: number;
  compteur: Compteur;
  parallele?: number;
  maxTokens?: number;
  surAvancement?: (faits: number, total: number) => void | Promise<void>;
}): Promise<(T | null)[]> {
  const resultats: (T | null)[] = new Array(o.morceaux.length).fill(null);
  let suivant = 0;
  let faits = 0;
  let echecs = 0;
  const ouvrier = async () => {
    while (suivant < o.morceaux.length) {
      const i = suivant++;
      try {
        const r = await avecUnNouvelEssai(() =>
          demanderJsonCout<T>({
            systeme: o.systeme,
            messages: [{ role: "user", content: o.morceaux[i].contenu }],
            schema: o.schema,
            gamme: "etudiant",
            maxTokens: o.maxTokens ?? 5000,
            utilisateurId: o.utilisateurId,
            sansQuota: true,
          }),
        );
        o.compteur.coutMicro += r.coutMicro;
        resultats[i] = r.resultat;
      } catch (e) {
        echecs++;
        console.warn(`[étude] morceau ${i + 1}/${o.morceaux.length} illisible :`, (e as Error).message);
      }
      faits++;
      await o.surAvancement?.(faits, o.morceaux.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.parallele ?? 4, o.morceaux.length) }, ouvrier));
  if (echecs > Math.max(1, Math.floor(o.morceaux.length / 4))) throw new Error(`${echecs} morceaux sur ${o.morceaux.length} n'ont pas pu être lus.`);
  return resultats;
}

/** Synthèse finale (modèle de la bibliothèque), avec un nouvel essai en cas d'échec. */
export async function synthetiser<T>(o: { systeme: string; consigne: string; schema: Schema; utilisateurId: number; compteur: Compteur; maxTokens?: number }): Promise<T> {
  const r = await avecUnNouvelEssai(() =>
    demanderJsonCout<T>({
      systeme: o.systeme,
      messages: [{ role: "user", content: o.consigne }],
      schema: o.schema,
      gamme: "bibliotheque",
      effort: "medium",
      maxTokens: o.maxTokens ?? 16000,
      utilisateurId: o.utilisateurId,
      sansQuota: true,
    }),
  );
  o.compteur.coutMicro += r.coutMicro;
  return r.resultat;
}

/** « 1 h 05 » ou « 12 min » à partir de secondes. */
export function minutage(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}
