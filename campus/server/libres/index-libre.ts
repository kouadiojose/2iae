// Recherche dans l'index des bibliothèques libres (sans IA), lecture des
// livres sur le campus, et rapprochement avec les livres que recommande le
// bibliothécaire (pour qu'ils se lisent ici quand une copie libre existe).
import { and, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  catalogueLibre,
  type DomaineLibre,
  type LectureLivre,
  type LivreLibre,
  type LivreLibreDto,
  type SourceLibre,
} from "@shared/schema";
import { titreCorrespond, nomPremierAuteur } from "../catalogues";
import { lireTexte, texteArchive, texteEnCache, texteIntegral } from "../lecture";
import { normaliserIndex, texteSimple } from "./domaines";

const MOTS_VIDES = new Set(
  "le la les l de des du d un une et en a au aux pour par sur dans avec ou que qui est the of and to in on an for with by from is are livre livres book books je veux voudrais cherche besoin sur comment".split(" "),
);

/** Mots de la recherche, en minuscules sans accents (pas d'opérateur possible : lettres et chiffres seulement). */
function motsRecherche(q: string, max = 8): string[] {
  return [...new Set(normaliserIndex(q).split(" "))].filter((m) => m.length >= 2 && !MOTS_VIDES.has(m)).slice(0, max);
}

/** « tomates » cherche aussi « tomate », « tomato »… : on cherche le début du mot. */
const racine = (m: string) => (m.length > 5 ? m.replace(/(s|x|es)$/, "") : m);

function requeteTs(mots: string[], ou: boolean): string {
  return mots.map((m) => `${racine(m)}:*`).join(ou ? " | " : " & ");
}

/** Le livre se lit-il sur le campus même ? (OAPEN : sur son site, qui filtre les robots.) */
const lectureIci = (l: Pick<LivreLibre, "source">) => l.source !== "oapen";

export function versLivreLibreDto(l: LivreLibre): LivreLibreDto {
  return {
    id: l.id,
    source: l.source,
    titre: l.titre,
    auteurs: l.auteurs,
    annee: l.annee,
    langue: l.langue,
    domaines: l.domaines,
    couverture: l.couverture,
    format: l.format,
    apercu: texteSimple(l.description, 220),
    lectureIci: lectureIci(l),
  };
}

export type FiltresLibres = { q?: string; domaine?: DomaineLibre; langue?: string; source?: SourceLibre; page?: number; parPage?: number };

/** Préférence de langue et de lisibilité dans le classement (le français d'abord). */
const BONUS = sql`(case when ${catalogueLibre.langue} = 'fr' then 1.6 when ${catalogueLibre.langue} = 'en' then 1.1 else 0.8 end)
  * (case ${catalogueLibre.source} when 'openstax' then 1.4 when 'gutenberg' then 1.2 when 'banque_mondiale' then 1.0 when 'archive' then 0.9 else 0.8 end)
  * (1 + ln(1 + ${catalogueLibre.popularite} + 50 * ${catalogueLibre.lectures}) / 12)`;

export async function chercherLibres(f: FiltresLibres): Promise<{ resultats: LivreLibre[]; total: number }> {
  const parPage = Math.min(Math.max(f.parPage ?? 24, 1), 60);
  const page = Math.max(f.page ?? 1, 1);
  const conditions: SQL[] = [];
  if (f.domaine) conditions.push(sql`${catalogueLibre.domaines} @> array[${f.domaine}]::text[]`);
  if (f.langue) conditions.push(eq(catalogueLibre.langue, f.langue));
  if (f.source) conditions.push(eq(catalogueLibre.source, f.source));
  const mots = motsRecherche(f.q ?? "");

  if (!mots.length) {
    const ou = conditions.length ? and(...conditions) : undefined;
    const [resultats, [{ n }]] = await Promise.all([
      db
        .select()
        .from(catalogueLibre)
        .where(ou)
        .orderBy(desc(BONUS), desc(catalogueLibre.id))
        .limit(parPage)
        .offset((page - 1) * parPage),
      db.select({ n: sql<number>`count(*)::int` }).from(catalogueLibre).where(ou),
    ]);
    return { resultats, total: n };
  }

  const vecteur = sql`to_tsvector('simple', ${catalogueLibre.recherche})`;
  // Tous les mots d'abord ; si rien ne correspond, n'importe lequel (les plus proches en tête).
  for (const ou of [false, true]) {
    if (ou && mots.length < 2) break;
    const requete = sql`to_tsquery('simple', ${requeteTs(mots, ou)})`;
    const where = and(sql`${vecteur} @@ ${requete}`, ...conditions);
    const [resultats, [{ n }]] = await Promise.all([
      db
        .select()
        .from(catalogueLibre)
        .where(where)
        .orderBy(desc(sql`ts_rank(${vecteur}, ${requete}) * ${BONUS}`), desc(catalogueLibre.id))
        .limit(parPage)
        .offset((page - 1) * parPage),
      db.select({ n: sql<number>`count(*)::int` }).from(sql`(select 1 from ${catalogueLibre} where ${where} limit 5000) as t`),
    ]);
    if (resultats.length || page > 1) return { resultats, total: n };
  }
  return { resultats: [], total: 0 };
}

/** Livres libres qui pourraient répondre à une demande (pour le bibliothécaire). */
export async function libresPourQuestion(question: string, n = 8): Promise<LivreLibre[]> {
  const mots = motsRecherche(question, 6);
  if (!mots.length) return [];
  try {
    const { resultats } = await chercherLibres({ q: mots.join(" "), parPage: n });
    return resultats;
  } catch {
    return [];
  }
}

const ORDRE_SOURCES: Record<SourceLibre, number> = { gutenberg: 0, openstax: 1, banque_mondiale: 2, archive: 3, oapen: 4 };

/**
 * La copie libre d'un livre cité (même titre, même auteur), s'il y en a une
 * dans l'index : le texte propre (Gutenberg) passe avant les pages scannées.
 */
export async function trouverDansIndex(titre: string, auteurs: string): Promise<LivreLibre | null> {
  const mots = motsRecherche(titre.split(/\s[:\-–]\s|:/)[0], 6);
  if (!mots.length) return null;
  const nom = nomPremierAuteur(auteurs);
  const termes = [...mots, ...(nom && nom.length > 2 ? [nom] : [])];
  try {
    const candidats = await db
      .select()
      .from(catalogueLibre)
      .where(sql`to_tsvector('simple', ${catalogueLibre.recherche}) @@ to_tsquery('simple', ${termes.map((m) => `${m}:*`).join(" & ")})`)
      .limit(40);
    const bons = candidats.filter((c) => titreCorrespond(titre, c.titre) && (!nom || normaliserIndex(c.auteurs).includes(nom)) && lectureIci(c));
    bons.sort((a, b) => ORDRE_SOURCES[a.source] - ORDRE_SOURCES[b.source] || b.popularite - a.popularite);
    return bons[0] ?? null;
  } catch {
    return null;
  }
}

/** Ce qu'on range dans livres.lecture pour une copie libre de l'index. */
export const lectureDepuisIndex = (l: LivreLibre): LectureLivre => ({ source: "index", id: l.ident, libre: true, titre: l.titre, annee: l.annee, libreId: l.id });

export async function livreLibre(id: number): Promise<LivreLibre | null> {
  const [l] = await db.select().from(catalogueLibre).where(eq(catalogueLibre.id, id));
  return l ?? null;
}

export async function voisins(l: LivreLibre): Promise<{ memeAuteur: LivreLibre[]; memeDomaine: LivreLibre[] }> {
  const nom = nomPremierAuteur(l.auteurs);
  const [memeAuteur, memeDomaine] = await Promise.all([
    nom && nom.length > 2 && !/anonym|inconnu|unknown|various|world bank|openstax/.test(normaliserIndex(l.auteurs))
      ? db
          .select()
          .from(catalogueLibre)
          .where(and(ne(catalogueLibre.id, l.id), sql`to_tsvector('simple', ${catalogueLibre.recherche}) @@ to_tsquery('simple', ${`${nom}:*`})`))
          .orderBy(desc(BONUS))
          .limit(40)
          .then((r) => r.filter((x) => normaliserIndex(x.auteurs).includes(nom)).slice(0, 8))
      : Promise.resolve([]),
    l.domaines.length
      ? db
          .select()
          .from(catalogueLibre)
          .where(and(ne(catalogueLibre.id, l.id), sql`${catalogueLibre.domaines} && array[${sql.join(
                l.domaines.map((d) => sql`${d}`),
                sql`, `,
              )}]::text[]`, l.langue ? eq(catalogueLibre.langue, l.langue) : undefined))
          .orderBy(desc(BONUS))
          .limit(8)
      : Promise.resolve([]),
  ]);
  return { memeAuteur, memeDomaine };
}

// ── Liens de lecture trouvés à la première ouverture ───────────────────────

const AGENT = { "User-Agent": "Campus2IAE/1.0 (campus.2iae.com)" };

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: AGENT });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

type BundlesDspace = {
  _embedded?: {
    bundles?: { name: string; _embedded?: { bitstreams?: { _embedded?: { bitstreams?: { name: string; sizeBytes: number; _links: { content: { href: string } } }[] } } } }[];
  };
};

/**
 * Banque mondiale : PDF, texte et vignette du document (le dépôt range parfois
 * deux versions, anglaise et française : on prend celle de la langue du livre,
 * sinon la plus complète). OAPEN : lien du PDF.
 */
export async function completerLiens(l: LivreLibre): Promise<LivreLibre> {
  if (l.source === "banque_mondiale" && (!l.pdf || !l.couverture)) {
    const b = await json<BundlesDspace>(`https://openknowledge.worldbank.org/server/api/core/items/${encodeURIComponent(l.ident)}/bundles?embed=bitstreams`);
    const fichiers = (nom: string) => b?._embedded?.bundles?.find((x) => x.name === nom)?._embedded?.bitstreams?._embedded?.bitstreams ?? [];
    const originaux = fichiers("ORIGINAL");
    const pdfs = originaux.filter((f) => /\.pdf$/i.test(f.name));
    if (b) {
      const choisi = pdfs.sort((a, c) => c.sizeBytes - a.sizeBytes)[0];
      const base = choisi?.name.replace(/\.pdf$/i, "");
      const texte = originaux.find((f) => base && f.name === `${base}.txt`) ?? originaux.find((f) => /\.txt$/i.test(f.name));
      const vignette = fichiers("THUMBNAIL").find((f) => base && f.name.startsWith(base)) ?? fichiers("THUMBNAIL")[0];
      const maj = {
        pdf: choisi?._links.content.href ?? null,
        texte: texte?._links.content.href ?? null,
        couverture: vignette?._links.content.href ?? null,
      };
      if (maj.pdf || maj.texte || maj.couverture) {
        await db.update(catalogueLibre).set(maj).where(eq(catalogueLibre.id, l.id));
        return { ...l, ...maj };
      }
    }
  }
  if (l.source === "oapen" && !l.pdf) {
    try {
      const r = await fetch(`https://library.oapen.org/oai/request?verb=GetRecord&metadataPrefix=xoai&identifier=oai:library.oapen.org:${l.ident}`, {
        signal: AbortSignal.timeout(12_000),
        headers: AGENT,
      });
      const xml = r.ok ? await r.text() : "";
      const pdf = [...xml.matchAll(/<field name="url">([^<]+\.pdf)<\/field>/g)].map((m) => m[1])[0];
      if (pdf) {
        await db.update(catalogueLibre).set({ pdf }).where(eq(catalogueLibre.id, l.id));
        return { ...l, pdf };
      }
    } catch {
      /* lien du PDF introuvable : la page OAPEN reste */
    }
  }
  return l;
}

// ── Texte intégral (lecture en pages, et réponses de l'IA d'après le livre) ──

/** Recolle les lignes coupées à 70 caractères (prose), garde la mise en page des vers. */
function recoller(texte: string): string {
  return texte
    .split(/\n[ \t]*\n/)
    .map((p) => {
      const lignes = p.split("\n").map((x) => x.trim());
      if (lignes.length < 2) return lignes.join("");
      const moyenne = lignes.slice(0, -1).reduce((s, x) => s + x.length, 0) / (lignes.length - 1);
      return moyenne >= 45 ? lignes.join(" ").replace(/\s{2,}/g, " ") : lignes.join("\n");
    })
    .filter((p) => p.trim())
    .join("\n\n");
}

/** Texte Gutenberg sans l'en-tête et la licence du projet. */
function nettoyerGutenberg(brut: string): string {
  let t = brut.replace(/\r/g, "").replace(/^﻿/, "");
  const debut = t.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (debut >= 0) t = t.slice(t.indexOf("\n", debut) + 1);
  const fin = t.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (fin >= 0) t = t.slice(0, fin);
  return recoller(t.trim());
}

/** Texte extrait d'un PDF (Banque mondiale) : blancs de mise en page retirés. */
function nettoyerExtrait(brut: string): string {
  return recoller(
    brut
      .replace(/\r/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/-\n(?=[a-zà-ÿ])/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  );
}

/** Texte intégral d'un livre de l'index, ou null s'il ne se lit pas en texte. */
export async function texteDuLibre(l: LivreLibre): Promise<string | null> {
  if (l.source === "archive") return texteArchive(l.ident);
  if (l.source === "gutenberg") {
    return texteEnCache(`gutenberg:${l.ident}`, async () => {
      const brut = (await lireTexte(`https://www.gutenberg.org/cache/epub/${l.ident}/pg${l.ident}.txt`)) ?? (l.texte ? await lireTexte(l.texte) : null);
      const t = brut ? nettoyerGutenberg(brut) : null;
      return t && t.length > 300 ? t : null;
    });
  }
  if (l.source === "banque_mondiale") {
    const complet = l.texte ? l : await completerLiens(l);
    if (!complet.texte) return null;
    return texteEnCache(`banque_mondiale:${l.ident}`, async () => {
      const brut = await lireTexte(complet.texte!);
      const t = brut ? nettoyerExtrait(brut) : null;
      return t && t.length > 300 ? t : null;
    });
  }
  return null;
}

/** Texte intégral d'un livre de la bibliothèque (copie de l'index ou exemplaire d'Internet Archive). */
export async function texteDuLivre(lecture: LectureLivre | null | undefined): Promise<string | null> {
  if (lecture?.libreId) {
    const l = await livreLibre(lecture.libreId);
    if (l) return texteDuLibre(l);
  }
  return texteIntegral(lecture);
}

export async function compterLecture(id: number) {
  await db
    .update(catalogueLibre)
    .set({ lectures: sql`${catalogueLibre.lectures} + 1` })
    .where(eq(catalogueLibre.id, id));
}

export async function libresParId(ids: number[]): Promise<Map<number, LivreLibre>> {
  if (!ids.length) return new Map();
  const lignes = await db.select().from(catalogueLibre).where(inArray(catalogueLibre.id, ids));
  return new Map(lignes.map((l) => [l.id, l]));
}
