// Moisson de l'index des bibliothèques libres, faite par le serveur lui-même
// (sur Railway) : chaque bibliothèque publie son catalogue (fichier CSV,
// moteur de recherche, OAI-PMH) ; on n'en garde que ce qui se lit gratuitement
// et légalement, avec de quoi chercher et ranger. Rien n'est demandé à l'IA.
//
// Une moisson par bibliothèque, l'une après l'autre, puis une fois par mois,
// la nuit (heure d'Abidjan).
// Les livres disparus de la source sont retirés à la fin d'une moisson
// complète (jamais après une moisson interrompue).
import zlib from "zlib";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { catalogueLibre, moissonsLibres, SOURCES_LIBRES, type DomaineLibre, type NouveauLivreLibre, type SourceLibre } from "@shared/schema";
import { classerArchive, COLLECTIONS_FIABLES, type DocArchive } from "../catalogues";
import { codeLangue, domainesDe, normaliserIndex, texteRecherche, texteSimple } from "./domaines";
import { planifier } from "../taches";

const AGENT = "Campus2IAE/1.0 (campus.2iae.com; bibliotheque des etudiants)";
const JOUR = 24 * 60 * 60_000;
/** Une bibliothèque est remoissonnée au bout de 30 jours. */
const VALIDITE = 30 * JOUR;
/** Une moisson « en cours » depuis plus longtemps a été coupée (redémarrage) : on la relance. */
const MOISSON_PERDUE = 4 * 60 * 60_000;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lire(url: string, delai = 60_000, essais = 3): Promise<Response> {
  let derniere: unknown;
  for (let i = 0; i < essais; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(delai), headers: { "User-Agent": AGENT, Accept: "*/*" } });
      if (r.ok) return r;
      derniere = new Error(`HTTP ${r.status} pour ${new URL(url).host}`);
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      derniere = e;
    }
    await pause(2000 * (i + 1));
  }
  throw derniere instanceof Error ? derniere : new Error(String(derniere));
}

const lireTexte = async (url: string, delai?: number) => (await lire(url, delai)).text();
const lireJson = async <T>(url: string, delai?: number) => (await (await lire(url, delai)).json()) as T;

// ── Enregistrement par lots ────────────────────────────────────────────────

class Lot {
  private lignes = new Map<string, NouveauLivreLibre>();
  total = 0;
  constructor(private readonly debut: Date) {}

  async ajouter(l: NouveauLivreLibre) {
    if (!l.titre?.trim() || !l.ident) return;
    this.lignes.set(l.ident, { ...l, titre: l.titre.trim().slice(0, 500), auteurs: (l.auteurs ?? "").slice(0, 400), vuLe: this.debut });
    if (this.lignes.size >= 400) await this.vider();
  }

  async vider() {
    if (!this.lignes.size) return;
    const valeurs = [...this.lignes.values()];
    this.lignes.clear();
    await db
      .insert(catalogueLibre)
      .values(valeurs)
      .onConflictDoUpdate({
        target: [catalogueLibre.source, catalogueLibre.ident],
        set: {
          titre: sql`excluded.titre`,
          auteurs: sql`excluded.auteurs`,
          annee: sql`excluded.annee`,
          langue: sql`excluded.langue`,
          sujets: sql`excluded.sujets`,
          domaines: sql`excluded.domaines`,
          description: sql`excluded.description`,
          couverture: sql`coalesce(excluded.couverture, ${catalogueLibre.couverture})`,
          format: sql`excluded.format`,
          lien: sql`excluded.lien`,
          pdf: sql`coalesce(excluded.pdf, ${catalogueLibre.pdf})`,
          texte: sql`coalesce(excluded.texte, ${catalogueLibre.texte})`,
          licence: sql`excluded.licence`,
          popularite: sql`excluded.popularite`,
          recherche: sql`excluded.recherche`,
          vuLe: sql`excluded.vu_le`,
        },
      });
    this.total += valeurs.length;
    // Laisser respirer la base (le campus continue de servir les étudiants).
    await pause(150);
  }
}

// ── Project Gutenberg : le catalogue complet en CSV ────────────────────────

/** Découpe un CSV (champs entre guillemets, retours à la ligne dans les champs). */
function* lignesCsv(texte: string): Generator<string[]> {
  let champ = "";
  let ligne: string[] = [];
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i++;
        } else guillemets = false;
      } else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === ",") {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n") {
      ligne.push(champ.replace(/\r$/, ""));
      yield ligne;
      ligne = [];
      champ = "";
    } else champ += c;
  }
  if (champ || ligne.length) {
    ligne.push(champ);
    yield ligne;
  }
}

/** « Hugo, Victor, 1802-1885; Paillottet, Prosper [Editor] » → « Victor Hugo, Prosper Paillottet ». */
function auteursGutenberg(v: string): string {
  return v
    .split(";")
    .map((a) => a.replace(/\[[^\]]*\]/g, "").replace(/,?\s*-?\d{3,4}\??-?(\d{3,4})?\??\s*(BCE|AD)?/g, "").trim())
    .filter(Boolean)
    .map((a) => {
      const [nom, ...prenoms] = a.split(",").map((x) => x.trim());
      return prenoms.length ? `${prenoms.join(" ")} ${nom}` : nom;
    })
    .slice(0, 4)
    .join(", ");
}

async function moissonnerGutenberg(lot: Lot) {
  const brut = Buffer.from(await (await lire("https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz", 180_000)).arrayBuffer());
  const texte = zlib.gunzipSync(brut).toString("utf8");
  let entetes: string[] | null = null;
  for (const l of lignesCsv(texte)) {
    if (!entetes) {
      entetes = l;
      continue;
    }
    const r = Object.fromEntries(entetes.map((e, i) => [e, l[i] ?? ""]));
    if (r.Type !== "Text" || !/^\d+$/.test(r["Text#"])) continue;
    const id = r["Text#"];
    const [titre, ...suite] = r.Title.split(/\r?\n/).map((t) => t.trim());
    const titreComplet = suite.length ? `${titre} : ${suite.join(" ")}` : titre;
    const auteurs = auteursGutenberg(r.Authors);
    const rayons = r.Bookshelves.split(";")
      .map((b) => b.replace(/^Category:\s*/, "").trim())
      .filter(Boolean);
    const sujets = [r.Subjects, ...rayons].filter(Boolean).join("; ");
    await lot.ajouter({
      source: "gutenberg",
      ident: id,
      titre: titreComplet,
      auteurs,
      annee: null,
      langue: codeLangue(r.Language.split(";")[0]),
      sujets: r.Subjects.slice(0, 1000),
      domaines: domainesDe({ cotes: r.LoCC, sujets, titre: titreComplet }),
      description: null,
      couverture: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
      format: "texte",
      lien: `https://www.gutenberg.org/ebooks/${id}`,
      texte: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
      licence: "Domaine public (Project Gutenberg)",
      popularite: 0,
      recherche: texteRecherche({ titre: titreComplet, auteurs, sujets }),
    });
  }
}

// ── Internet Archive : livres libres, rayon par rayon ──────────────────────

/** Requêtes par rayon (sujets en français et en anglais), et combien en garder par langue. */
const RAYONS_ARCHIVE: { domaine: string; sujets: string }[] = [
  { domaine: "gestion", sujets: "management OR gestion OR entreprise OR entreprises OR business OR administration OR organisation OR leadership" },
  { domaine: "compta_finance", sujets: "comptabilité OR comptabilite OR accounting OR bookkeeping OR finance OR finances OR banque OR banking OR monnaie OR money OR assurance OR insurance" },
  { domaine: "economie", sujets: "économie OR economie OR economics OR \"économie politique\" OR commerce OR trade OR travail OR labor OR industrie OR industry" },
  { domaine: "marketing", sujets: "marketing OR publicité OR advertising OR vente OR salesmanship OR selling OR commerce" },
  { domaine: "droit", sujets: "droit OR law OR législation OR legislation OR jurisprudence OR \"code civil\" OR constitution" },
  { domaine: "informatique", sujets: "informatique OR computers OR computer OR programming OR programmation OR internet OR software" },
  { domaine: "agriculture", sujets: "agriculture OR agronomie OR farming OR élevage OR horticulture OR jardinage OR gardening OR sols OR soils OR forêts OR forestry OR irrigation" },
  { domaine: "afrique", sujets: "Afrique OR Africa OR \"Côte d'Ivoire\" OR Sénégal OR Senegal OR Soudan OR Dahomey OR Guinée OR Congo OR Cameroun OR Madagascar" },
  { domaine: "sciences", sujets: "mathématiques OR mathematiques OR mathematics OR physique OR physics OR chimie OR chemistry OR statistique OR statistics OR sciences" },
  { domaine: "techniques", sujets: "engineering OR mécanique OR électricité OR electricity OR construction OR technologie OR technology" },
  { domaine: "sante", sujets: "médecine OR medecine OR medicine OR hygiène OR hygiene OR santé OR health OR nursing" },
  { domaine: "societe", sujets: "histoire OR history OR politique OR politics OR sociologie OR sociology OR géographie OR geography" },
  { domaine: "philosophie", sujets: "philosophie OR philosophy OR morale OR ethics OR religion" },
  { domaine: "education", sujets: "éducation OR education OR pédagogie OR pedagogy OR enseignement OR teaching" },
  { domaine: "langues", sujets: "grammaire OR grammar OR dictionnaire OR dictionary OR \"langue française\" OR \"English language\"" },
  { domaine: "litterature", sujets: "roman OR romans OR poésie OR poesie OR théâtre OR theatre OR fiction OR poetry OR drama OR contes" },
];

const LANGUES_ARCHIVE = [
  { code: "fr", requete: "(fre OR fra OR french OR Français)", max: 1500 },
  { code: "en", requete: "(eng OR english)", max: 700 },
];

const CHAMPS_ARCHIVE = ["identifier", "title", "creator", "year", "language", "subject", "description", "collection", "licenseurl", "downloads", "access-restricted-item"];

type DocArchiveComplet = DocArchive & { subject?: string | string[]; description?: string | string[] };
const liste = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

async function moissonnerArchive(lot: Lot) {
  const fiables = [...COLLECTIONS_FIABLES].join(" OR ");
  // Libre de droits : domaine public (avant 1930), ou licence libre / collection d'institution
  // (mais jamais les dépôts d'internautes de livres récents).
  const libre = `(year:[1400 TO 1929] OR (licenseurl:(*creativecommons* OR *publicdomain*) AND NOT collection:opensource) OR collection:(${fiables}))`;
  const vus = new Set<string>();
  // Un même livre numérisé par plusieurs bibliothèques (ou les numéros d'une revue) : on garde le plus lu.
  const titresVus = new Set<string>();
  for (const rayon of RAYONS_ARCHIVE) {
    for (const langue of LANGUES_ARCHIVE) {
      const q = `mediatype:texts AND language:${langue.requete} AND subject:(${rayon.sujets}) AND ${libre} AND NOT collection:(inlibrary OR printdisabled OR lendinglibrary)`;
      const parPage = 500;
      for (let page = 1; (page - 1) * parPage < langue.max; page++) {
        const params = new URLSearchParams({ q, rows: String(parPage), page: String(page), output: "json" });
        params.append("sort[]", "downloads desc");
        for (const f of CHAMPS_ARCHIVE) params.append("fl[]", f);
        const json = await lireJson<{ response?: { docs?: DocArchiveComplet[] } }>(`https://archive.org/advancedsearch.php?${params}`);
        const docs = json.response?.docs ?? [];
        for (const d of docs) {
          if (vus.has(d.identifier) || classerArchive(d) !== "libre") continue;
          vus.add(d.identifier);
          const titre = liste(d.title)[0]?.trim();
          if (!titre) continue;
          const auteurs = liste(d.creator).slice(0, 4).join(", ");
          const cleTitre = `${normaliserIndex(titre).slice(0, 80)}|${normaliserIndex(auteurs).split(" ")[0] ?? ""}`;
          if (titresVus.has(cleTitre)) continue;
          titresVus.add(cleTitre);
          const sujets = liste(d.subject).join("; ").slice(0, 1000);
          const annee = Number(String(d.year ?? "").match(/\d{4}/)?.[0]) || null;
          await lot.ajouter({
            source: "archive",
            ident: d.identifier,
            titre,
            auteurs,
            annee,
            langue: codeLangue(liste(d.language)[0]) ?? langue.code,
            sujets,
            domaines: [...new Set([rayon.domaine as DomaineLibre, ...domainesDe({ sujets, titre })])].slice(0, 4),
            description: texteSimple(liste(d.description).join(" ")),
            couverture: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
            format: "archive",
            lien: `https://archive.org/details/${encodeURIComponent(d.identifier)}`,
            licence: annee && annee < 1930 ? "Domaine public" : d.licenseurl ? "Licence libre" : "Publication libre (bibliothèque ou institution)",
            popularite: Math.min(2_000_000_000, Number(d.downloads) || 0),
            recherche: texteRecherche({ titre, auteurs, sujets }),
          });
        }
        if (docs.length < parPage) break;
        await pause(500);
      }
    }
  }
}

// ── OpenStax : manuels universitaires gratuits ─────────────────────────────

type LivreOpenstax = {
  id: number;
  title: string;
  book_state?: string;
  description?: string;
  cover_url?: string;
  high_resolution_pdf_url?: string | null;
  low_resolution_pdf_url?: string | null;
  webview_rex_link?: string | null;
  webview_link?: string | null;
  authors?: { value?: { name?: string } }[];
  book_subjects?: { subject_name?: string }[];
  book_categories?: { subject_category?: string }[];
  publish_date?: string | null;
  license_name?: string | null;
  meta?: { slug?: string; html_url?: string; locale?: string };
};

async function moissonnerOpenstax(lot: Lot) {
  const base = "https://openstax.org/apps/cms/api/v2/pages/";
  const index = await lireJson<{ items: { id: number }[] }>(`${base}?type=books.Book&fields=title&limit=250`);
  for (const { id } of index.items) {
    let b: LivreOpenstax;
    try {
      b = await lireJson<LivreOpenstax>(`${base}${id}/`);
    } catch {
      continue;
    }
    const pdf = b.low_resolution_pdf_url || b.high_resolution_pdf_url || null;
    if (!b.title || !["live", "new_edition_available", "deprecated"].includes(b.book_state ?? "") || (!pdf && !b.webview_rex_link)) continue;
    const auteurs = (b.authors ?? [])
      .map((a) => a.value?.name)
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");
    const sujets = [...(b.book_subjects ?? []).map((s) => s.subject_name), ...(b.book_categories ?? []).map((c) => c.subject_category)].filter(Boolean).join("; ");
    const langue = codeLangue(b.meta?.locale) ?? (/[áéíóúñ]/i.test(b.title) && !/[èêàù]/i.test(b.title) ? "es" : "en");
    await lot.ajouter({
      source: "openstax",
      ident: b.meta?.slug ?? String(id),
      titre: b.title,
      auteurs: auteurs || "OpenStax",
      annee: Number(b.publish_date?.slice(0, 4)) || null,
      langue,
      sujets,
      domaines: domainesDe({ sujets, titre: b.title }),
      description: texteSimple(b.description),
      couverture: b.cover_url ?? null,
      format: "pdf",
      lien: b.meta?.html_url ?? `https://openstax.org/details/books/${b.meta?.slug ?? id}`,
      pdf,
      texte: b.webview_rex_link ?? b.webview_link ?? null,
      licence: b.license_name ?? "Creative Commons",
      // Manuels de référence : en tête des rayons.
      popularite: 100_000,
      recherche: texteRecherche({ titre: b.title, auteurs, sujets }),
    });
    await pause(200);
  }
}

// ── Moisson OAI-PMH (protocole commun des dépôts universitaires) ───────────

const decoderXml = (t: string) =>
  t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .trim();

function champsXml(bloc: string, balise: string): string[] {
  const re = new RegExp(`<${balise}(?:\\s[^>]*)?>([\\s\\S]*?)</${balise}>`, "g");
  return [...bloc.matchAll(re)].map((m) => decoderXml(m[1])).filter(Boolean);
}


/** Les notices d'un dépôt OAI-PMH, page après page (jeton de reprise). */
async function* noticesOai(base: string): AsyncGenerator<string> {
  let url = `${base}?verb=ListRecords&metadataPrefix=oai_dc`;
  for (let tour = 0; tour < 3000; tour++) {
    const xml = await lireTexte(url, 120_000);
    for (const rec of xml.split("<record>").slice(1)) if (!/<header[^>]*status="deleted"/.test(rec)) yield rec;
    const jeton = xml.match(/<resumptionToken[^>]*>([^<]+)<\/resumptionToken>/)?.[1];
    if (!jeton) break;
    url = `${base}?verb=ListRecords&resumptionToken=${encodeURIComponent(decoderXml(jeton))}`;
    await pause(300);
  }
}

// ── Banque mondiale : dépôt en libre accès (OAI-PMH) ───────────────────────

async function moissonnerBanqueMondiale(lot: Lot) {
  for await (const rec of noticesOai("https://openknowledge.worldbank.org/server/oai/request")) {
    const handle = rec.match(/<identifier>oai:openknowledge\.worldbank\.org:([^<]+)<\/identifier>/)?.[1];
    const titres = champsXml(rec, "dc:title");
    if (!handle || !titres.length) continue;
    const langues = champsXml(rec, "dc:language");
    const langue = langues.map(codeLangue).find(Boolean) ?? "en";
    // Titre bilingue : celui de la langue du document d'abord.
    const titre = (langue === "fr" ? titres.find((t) => /[éèàçù]|\b(le|la|les|des|du|et)\b/i.test(t)) : null) ?? titres[0];
    const auteurs = champsXml(rec, "dc:creator").slice(0, 4).join(", ") || "Banque mondiale";
    const sujets = champsXml(rec, "dc:subject").join("; ").slice(0, 1000);
    const type = champsXml(rec, "dc:type")[0] ?? "";
    const resumes = champsXml(rec, "dc:description");
    const description = texteSimple((langue === "fr" ? resumes.find((r) => /[éèà]/.test(r)) : null) ?? resumes[0]);
    const annee = Number(champsXml(rec, "dc:date").map((d) => d.match(/^(\d{4})/)?.[1]).filter(Boolean).sort()[0]) || null;
    const domaines = domainesDe({ sujets, titre });
    await lot.ajouter({
      source: "banque_mondiale",
      ident: handle,
      titre,
      auteurs,
      annee,
      langue,
      sujets,
      domaines: domaines.length ? domaines : ["economie"],
      description,
      couverture: null,
      format: "pdf",
      lien: `https://openknowledge.worldbank.org/handle/${handle}`,
      licence: champsXml(rec, "dc:rights").find((r) => !r.startsWith("http")) ?? "Libre accès (Banque mondiale)",
      popularite: /book/i.test(type) ? 5000 : /report/i.test(type) ? 2000 : 500,
      recherche: texteRecherche({ titre, autresTitres: titres.filter((t) => t !== titre), auteurs, sujets }),
    });
  }
}

// ── OAPEN : livres universitaires en libre accès (OAI-PMH) ─────────────────

const LANGUES_OAPEN = new Set(["fr", "en", "es", "pt"]);

async function moissonnerOapen(lot: Lot) {
  for await (const rec of noticesOai("https://library.oapen.org/oai/request")) {
    const type = champsXml(rec, "oaire:resourceType")[0] ?? "";
    if (type && type !== "book") continue;
    const langue = codeLangue(champsXml(rec, "dc:language")[0]);
    if (!langue || !LANGUES_OAPEN.has(langue)) continue;
    const lien = champsXml(rec, "dc:identifier").find((i) => i.startsWith("https://library.oapen.org/handle/"));
    const titre = champsXml(rec, "dc:title")[0];
    if (!lien || !titre) continue;
    const ident = lien.replace("https://library.oapen.org/handle/", "");
    const auteurs = champsXml(rec, "dc:creator")
      .slice(0, 4)
      .map((a) => {
        const [nom, prenom] = a.split(",").map((x) => x.trim());
        return prenom ? `${prenom} ${nom}` : nom;
      })
      .join(", ");
    const sujets = champsXml(rec, "dc:subject")
      .map((x) => x.replace(/^.*::/, ""))
      .join("; ")
      .slice(0, 1000);
    const licence = rec.match(/<oaire:licenseCondition[^>]*>([\s\S]*?)<\/oaire:licenseCondition>/)?.[1];
    const annee = Number(champsXml(rec, "dc:date").find((d) => /^\d{4}$/.test(d))) || null;
    await lot.ajouter({
      source: "oapen",
      ident,
      titre,
      auteurs,
      annee,
      langue,
      sujets,
      domaines: domainesDe({ sujets, titre }),
      description: texteSimple(champsXml(rec, "dc:description")[0]),
      couverture: null,
      format: "pdf",
      lien,
      licence: licence ? decoderXml(licence) : "Creative Commons",
      popularite: 300,
      recherche: texteRecherche({ titre, auteurs, sujets }),
    });
  }
}

// ── Orchestration ──────────────────────────────────────────────────────────

const MOISSONNEURS: Record<SourceLibre, (lot: Lot) => Promise<void>> = {
  openstax: moissonnerOpenstax,
  gutenberg: moissonnerGutenberg,
  archive: moissonnerArchive,
  banque_mondiale: moissonnerBanqueMondiale,
  oapen: moissonnerOapen,
};

/** Ordre de moisson : d'abord ce qui se lit le mieux sur le campus. */
const ORDRE: SourceLibre[] = ["openstax", "gutenberg", "archive", "banque_mondiale", "oapen"];

let enCours: SourceLibre | null = null;
export const moissonEnCours = () => enCours;

async function moissonner(source: SourceLibre) {
  const debut = new Date();
  enCours = source;
  await db
    .insert(moissonsLibres)
    .values({ source, statut: "en_cours", nombre: 0, debut, fin: null, message: null })
    .onConflictDoUpdate({ target: moissonsLibres.source, set: { statut: "en_cours", nombre: 0, debut, fin: null, message: null } });
  const lot = new Lot(debut);
  // Progression visible pendant la moisson.
  const suivi = setInterval(() => {
    void db
      .update(moissonsLibres)
      .set({ nombre: lot.total })
      .where(eq(moissonsLibres.source, source))
      .catch(() => {});
  }, 15_000);
  try {
    await MOISSONNEURS[source](lot);
    await lot.vider();
    // Moisson complète : ce que la source ne publie plus quitte l'index.
    const retires = await db
      .delete(catalogueLibre)
      .where(and(eq(catalogueLibre.source, source), lt(catalogueLibre.vuLe, debut)))
      .returning({ id: catalogueLibre.id });
    await db
      .update(moissonsLibres)
      .set({ statut: "terminee", nombre: lot.total, fin: new Date(), message: retires.length ? `${retires.length} livre(s) retiré(s) de l'index.` : null })
      .where(eq(moissonsLibres.source, source));
    console.log(`[bibliothèques libres] ${source} : ${lot.total} livres indexés`);
  } catch (e) {
    await lot.vider().catch(() => {});
    const message = (e as Error).message?.slice(0, 300) || "Erreur inconnue";
    console.error(`[bibliothèques libres] ${source} :`, message);
    await db
      .update(moissonsLibres)
      .set({ statut: "erreur", nombre: lot.total, fin: new Date(), message })
      .where(eq(moissonsLibres.source, source));
  } finally {
    clearInterval(suivi);
    enCours = null;
  }
}

let file: Promise<void> = Promise.resolve();
const demandees = new Set<SourceLibre>();

/** Met des bibliothèques en file de moisson (l'une après l'autre). */
export function lancerMoisson(sources: SourceLibre[]) {
  for (const s of sources) {
    if (demandees.has(s) || enCours === s) continue;
    demandees.add(s);
    file = file.then(async () => {
      demandees.delete(s);
      await moissonner(s);
    });
  }
}

/**
 * Bibliothèques à moissonner : jamais moissonnées (ou vides) tout de suite ;
 * mises à jour mensuelles, erreurs et moissons coupées par un redémarrage
 * seulement la nuit (heure d'Abidjan), loin des cours.
 */
export async function sourcesAMoissonner(): Promise<SourceLibre[]> {
  const [etats, comptes] = await Promise.all([
    db.select().from(moissonsLibres),
    db
      .select({ source: catalogueLibre.source, n: sql<number>`count(*)::int` })
      .from(catalogueLibre)
      .groupBy(catalogueLibre.source),
  ]);
  const parSource = new Map(etats.map((e) => [e.source, e]));
  const remplies = new Set(comptes.filter((c) => c.n > 0).map((c) => c.source));
  const maintenant = Date.now();
  const nuit = new Date().getUTCHours() < 5;
  return ORDRE.filter((s) => {
    if (enCours === s || demandees.has(s)) return false;
    const e = parSource.get(s);
    // Premier remplissage (ou source restée vide) : tout de suite, même après un redémarrage en pleine moisson.
    if (!e || !remplies.has(s)) return true;
    if (!nuit) return false;
    if (e.statut === "en_cours") return maintenant - e.debut.getTime() > MOISSON_PERDUE;
    if (e.statut === "erreur") return maintenant - (e.fin ?? e.debut).getTime() > 6 * 60 * 60_000;
    return maintenant - (e.fin ?? e.debut).getTime() > VALIDITE;
  });
}

export const toutesLesSources = () => [...ORDRE].filter((s) => SOURCES_LIBRES.includes(s));

// Vérifiée toutes les heures (et peu après le démarrage) : la première mise en
// ligne remplit l'index toute seule. LIBRES_MOISSON=non la coupe (essais locaux).
if (process.env.LIBRES_MOISSON !== "non") {
  planifier("libres-moisson", 60 * 60_000, async () => {
    if (enCours || demandees.size) return;
    const sources = await sourcesAMoissonner();
    if (sources.length) lancerMoisson(sources);
  });
}
