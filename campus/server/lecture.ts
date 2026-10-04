// Texte intégral des livres en lecture libre (Internet Archive) : pour la
// version texte de la liseuse (légère sur un petit forfait) et pour que l'IA
// réponde d'après les vrais passages du livre plutôt que de mémoire.
import type { LectureLivre } from "@shared/schema";
import { normaliser } from "./catalogues";

const DELAI_MS = 20_000;
/** Au-delà, le texte est tronqué (un très gros ouvrage reste exploitable par ses 3 premiers millions de caractères). */
const TAILLE_MAX = 3_000_000;
const EN_MEMOIRE = 12;

const textes = new Map<string, string | null>();
const enCours = new Map<string, Promise<string | null>>();

async function lireTexte(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(DELAI_MS), redirect: "follow", headers: { "User-Agent": "Campus2IAE/1.0 (campus.2iae.com)" } });
    if (!r.ok) return null;
    const t = await r.text();
    return t.slice(0, TAILLE_MAX);
  } catch {
    return null;
  }
}

/** Le fichier texte (OCR) d'un exemplaire : « <id>_djvu.txt », ou celui que liste sa fiche technique. */
async function chargerTexte(id: string): Promise<string | null> {
  let texte = await lireTexte(`https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(id)}_djvu.txt`);
  if (!texte) {
    const meta = await lireTexte(`https://archive.org/metadata/${encodeURIComponent(id)}/files`);
    try {
      const fichiers = (JSON.parse(meta ?? "{}") as { result?: { name: string; size?: string }[] }).result ?? [];
      const djvu = fichiers.filter((f) => f.name.endsWith("_djvu.txt")).sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0))[0];
      if (djvu) texte = await lireTexte(`https://archive.org/download/${encodeURIComponent(id)}/${djvu.name.split("/").map(encodeURIComponent).join("/")}`);
    } catch {
      /* fiche illisible : pas de texte */
    }
  }
  if (!texte) return null;
  // OCR : espaces multiples, césures en fin de ligne, lignes vides en rafale.
  const propre = texte
    .replace(/\r/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/-\n(?=[a-zà-ÿ])/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return propre.length > 500 ? propre : null;
}

/** Texte intégral d'un livre en lecture libre (mis en mémoire pour les questions suivantes), ou null. */
export async function texteIntegral(lecture: LectureLivre | null | undefined): Promise<string | null> {
  if (!lecture?.libre) return null;
  if (textes.has(lecture.id)) return textes.get(lecture.id) ?? null;
  let p = enCours.get(lecture.id);
  if (!p) {
    p = chargerTexte(lecture.id).finally(() => enCours.delete(lecture.id));
    enCours.set(lecture.id, p);
  }
  const texte = await p;
  if (textes.size >= EN_MEMOIRE) textes.delete(textes.keys().next().value!);
  textes.set(lecture.id, texte);
  return texte;
}

// ── Pages de la version texte ──────────────────────────────────────────────

const TAILLE_PAGE = 3500;

/** Découpe en pages d'environ 3 500 caractères, sans couper un paragraphe quand c'est possible. */
function pages(texte: string): string[] {
  const resultat: string[] = [];
  let debut = 0;
  while (debut < texte.length) {
    let fin = Math.min(texte.length, debut + TAILLE_PAGE);
    if (fin < texte.length) {
      const coupure = texte.lastIndexOf("\n\n", fin);
      if (coupure > debut + TAILLE_PAGE / 2) fin = coupure;
    }
    resultat.push(texte.slice(debut, fin).trim());
    debut = fin;
  }
  return resultat;
}

export function pageDuTexte(texte: string, n: number): { page: number; total: number; contenu: string } {
  const toutes = pages(texte);
  const page = Math.min(Math.max(1, n), toutes.length);
  return { page, total: toutes.length, contenu: toutes[page - 1] ?? "" };
}

// ── Passages utiles pour une question ──────────────────────────────────────

const MOTS_VIDES = new Set(
  "avec dans pour quel quelle quels quelles comment pourquoi est-ce cette celui celle sont etre avoir fait faire plus moins tres tout tous toute toutes livre auteur chapitre parle parler explique expliquer resume resumer points principaux what which that this with from have about book author chapter explain summary main points".split(
    " ",
  ),
);

const motsCles = (question: string) => [...new Set(normaliser(question).split(" ").filter((m) => m.length >= 4 && !MOTS_VIDES.has(m)))];

/**
 * Les passages du livre les plus proches de la question (au plus `max`
 * caractères), dans l'ordre du livre, repérés par leur position (« vers 35 %
 * du livre ») pour que l'étudiant les retrouve dans la liseuse.
 */
export function passagesPour(texte: string, question: string, max = 18_000): string {
  const morceaux: { i: number; texte: string; score: number }[] = [];
  const taille = 1400;
  for (let i = 0, n = 0; i < texte.length; i += taille, n++) morceaux.push({ i: n, texte: texte.slice(i, i + taille), score: 0 });
  const mots = motsCles(question);
  if (mots.length) {
    for (const m of morceaux) {
      const contenu = ` ${normaliser(m.texte)} `;
      m.score = mots.reduce((s, mot) => {
        const n = contenu.split(` ${mot}`).length - 1;
        return s + (n ? 1 + Math.log(n) : 0);
      }, 0);
    }
  }
  const retenus = new Set<number>();
  // Le début (titre, préface, sommaire) aide toujours à situer le livre.
  retenus.add(0);
  if (morceaux.length > 1) retenus.add(1);
  let total = morceaux.slice(0, 2).reduce((s, m) => s + m.texte.length, 0);
  for (const m of [...morceaux].filter((x) => x.score > 0).sort((a, b) => b.score - a.score)) {
    if (total + m.texte.length > max) break;
    retenus.add(m.i);
    total += m.texte.length;
  }
  // Rien de pertinent : un échantillon régulier du livre.
  if (retenus.size <= 2 && morceaux.length > 4) {
    const pas = Math.max(1, Math.floor(morceaux.length / 10));
    for (let i = 2; i < morceaux.length && total < max; i += pas) {
      retenus.add(i);
      total += morceaux[i].texte.length;
    }
  }
  return [...retenus]
    .sort((a, b) => a - b)
    .map((i) => `[Passage, vers ${Math.round((i / morceaux.length) * 100)} % du livre]\n${morceaux[i].texte.trim()}`)
    .join("\n\n");
}

/** Un échantillon régulier de tout le livre (début compris), pour rédiger une fiche fidèle. */
export function echantillonDuLivre(texte: string, max = 40_000): string {
  if (texte.length <= max) return texte;
  const taille = 2000;
  const nb = Math.floor(max / taille);
  const pas = (texte.length - taille) / (nb - 1);
  return Array.from({ length: nb }, (_, k) => {
    const debut = Math.floor(k * pas);
    return `[Vers ${Math.round((debut / texte.length) * 100)} % du livre]\n${texte.slice(debut, debut + taille).trim()}`;
  }).join("\n\n");
}
