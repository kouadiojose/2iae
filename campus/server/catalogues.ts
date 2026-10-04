// Vérification des livres proposés par l'IA dans des catalogues publics, sans
// clé d'accès : la Bibliothèque nationale de France (très complète pour les
// ouvrages en français : Eyrolles, Dunod, Le Moniteur…) puis Open Library
// (ouvrages en anglais, couvertures). Un livre retrouvé reçoit sa vraie notice
// (titre exact, auteurs, année, éditeur, ISBN) ; sinon il reste « à vérifier ».

export type Notice = {
  /** Clé de dédoublonnage : « bnf:ark:/12148/… » ou « ol:/works/OL…W ». */
  cle: string;
  titre: string;
  auteurs: string;
  annee: number | null;
  editeur: string | null;
  isbn: string | null;
  langue: string | null;
  pages: number | null;
  couvertureUrl: string | null;
  lienCatalogue: string;
  description: string | null;
  source: "bnf" | "open_library" | "archive";
};

const DELAI_MS = 7000;

async function lire(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(DELAI_MS), headers: { "User-Agent": "Campus2IAE/1.0 (campus.2iae.com)" } });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

/** Minuscules sans accents ni ponctuation, pour comparer des titres. */
export const normaliser = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const MOTS_VIDES = new Set(["le", "la", "les", "l", "de", "des", "du", "d", "un", "une", "et", "en", "a", "au", "aux", "pour", "the", "of", "and", "to", "in", "on", "a", "an"]);

/** Mots significatifs du titre principal (avant « : »), au plus 6. */
function motsDuTitre(titre: string): string[] {
  return normaliser(titre.split(/\s[:\-–]\s|:/)[0])
    .split(" ")
    .filter((m) => m.length > 1 && !MOTS_VIDES.has(m))
    .slice(0, 6);
}

/** Nom de famille du premier auteur (« Jean Perchat » → « Perchat »). */
function nomPremierAuteur(auteurs: string): string {
  const premier = auteurs.split(/[,;&]| et | and /)[0].trim();
  const mots = normaliser(premier).split(" ").filter((m) => m.length > 1);
  return mots[mots.length - 1] ?? "";
}

/** Le titre trouvé contient-il bien les mots du titre demandé (au moins les deux tiers) ? */
function titreCorrespond(demande: string, trouve: string): boolean {
  const mots = motsDuTitre(demande);
  if (!mots.length) return false;
  const cible = ` ${normaliser(trouve)} `;
  const presents = mots.filter((m) => cible.includes(` ${m} `)).length;
  return presents / mots.length >= 0.67;
}

const couvertureIsbn = (isbn: string | null) => (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : null);

// ── BnF (SRU, Dublin Core) ─────────────────────────────────────────────────

const decoder = (t: string) =>
  t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();

const champs = (bloc: string, nom: string) => [...bloc.matchAll(new RegExp(`<dc:${nom}[^>]*>([\\s\\S]*?)</dc:${nom}>`, "g"))].map((m) => decoder(m[1]));

/** « Perchat, Jean. Auteur du texte » → « Jean Perchat » ; les rôles autres qu'auteur sont ignorés. */
function auteurBnf(brut: string): string | null {
  if (!/auteur/i.test(brut)) return null;
  const nom = brut.replace(/\.\s*(Auteur|Auteur du texte|Directeur de publication|Éditeur scientifique).*$/i, "").replace(/\s*\([^)]*\)/g, "");
  const [famille, prenom] = nom.split(",").map((x) => x.trim());
  return prenom ? `${prenom} ${famille}` : famille;
}

/**
 * Titre BnF sans la mention de responsabilité : « Pratique du BAEL 91 : cours
 * avec exercices corrigés (4ème ed.) Jean Perchat, Jean Roux » → jusqu'à « (4ème ed.) ».
 */
function nettoyerTitreBnf(brut: string): string {
  let t = brut.split(" / ")[0].replace(/\s+\[[^\]]*\]/g, "");
  const edition = t.match(/^(.*?\([^()]*(?:éd|ed)(?:ition)?\.?\))/i);
  if (edition) t = edition[1];
  t = t
    .replace(/\s+par\s+.*$/i, "")
    .replace(/\.{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Mention de responsabilité collée au titre (« … (Mise à jour 2023) Ministère des Affaires étrangères ; CIRAD… »).
  if (t.length > 80) {
    const avantResponsabilite = t.match(/^(.{10,}?\))\s+[A-ZÉÈÀ]/) ?? t.match(/^(.{10,}?)\s+;\s/);
    if (avantResponsabilite) t = avantResponsabilite[1].trim();
  }
  return t.length > 160 ? `${t.slice(0, 157).trimEnd()}…` : t;
}

/** Au plus trois auteurs, 140 caractères : une notice d'institution peut en aligner une dizaine. */
const auteursCourts = (liste: string[]) => {
  const texte = liste.slice(0, 3).join(", ");
  return texte.length > 140 ? `${texte.slice(0, 137).trimEnd()}…` : texte;
};

async function chercherBnf(titre: string, auteurs: string): Promise<Notice | null> {
  const mots = motsDuTitre(titre);
  if (!mots.length) return null;
  const nom = nomPremierAuteur(auteurs);
  const requete = `bib.title all "${mots.join(" ")}"${nom ? ` and bib.author all "${nom}"` : ""}`;
  const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&recordSchema=dublincore&maximumRecords=8&query=${encodeURIComponent(requete)}`;
  const xml = await lire(url);
  if (!xml) return null;
  const notices = [...xml.matchAll(/<oai_dc:dc[\s\S]*?<\/oai_dc:dc>/g)]
    .map((m) => {
      const b = m[0];
      const titreBrut = champs(b, "title")[0] ?? "";
      const titreNet = nettoyerTitreBnf(titreBrut);
      const identifiants = champs(b, "identifier");
      const ark = identifiants.find((i) => i.startsWith("http"));
      const isbn = identifiants.map((i) => i.match(/ISBN\s+([0-9X-]{10,17})/i)?.[1]?.replace(/-/g, "")).find(Boolean) ?? null;
      const annee = Number(champs(b, "date")[0]?.match(/\d{4}/)?.[0]) || null;
      const pages = Number(champs(b, "format")[0]?.match(/(\d+)\s*p\./)?.[1]) || null;
      const editeur = champs(b, "publisher")[0]?.replace(/\s*\([^)]*\)\s*$/, "") ?? null;
      const auteursTrouves = champs(b, "creator").map(auteurBnf).filter((a): a is string => Boolean(a));
      const sujets = champs(b, "subject").slice(0, 6);
      return { titreNet, ark, isbn, annee, pages, editeur, auteursTrouves, sujets, langue: champs(b, "language")[0] ?? null };
    })
    .filter((n) => n.ark && n.titreNet && titreCorrespond(titre, n.titreNet));
  if (!notices.length) return null;
  // L'édition la plus récente (avec ISBN de préférence) : celle qu'un étudiant trouvera.
  notices.sort((a, b) => (b.annee ?? 0) - (a.annee ?? 0) || Number(Boolean(b.isbn)) - Number(Boolean(a.isbn)));
  const n = notices[0];
  return {
    cle: `bnf:${n.ark!.replace(/^https?:\/\/catalogue\.bnf\.fr\//, "")}`,
    titre: n.titreNet,
    auteurs: auteursCourts(n.auteursTrouves) || auteurs,
    annee: n.annee,
    editeur: n.editeur,
    isbn: n.isbn,
    langue: n.langue,
    pages: n.pages,
    couvertureUrl: couvertureIsbn(n.isbn),
    lienCatalogue: n.ark!,
    description: n.sujets.length ? `Sujets (catalogue BnF) : ${n.sujets.join(" ; ")}` : null,
    source: "bnf",
  };
}

// ── Open Library ───────────────────────────────────────────────────────────

type DocOpenLibrary = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  language?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
  subject?: string[];
};

async function chercherOpenLibrary(titre: string, auteurs: string): Promise<Notice | null> {
  const mots = motsDuTitre(titre);
  if (!mots.length) return null;
  const nom = nomPremierAuteur(auteurs);
  const params = new URLSearchParams({
    title: mots.join(" "),
    limit: "5",
    fields: "key,title,author_name,first_publish_year,isbn,cover_i,language,publisher,number_of_pages_median,subject",
  });
  if (nom) params.set("author", nom);
  const json = await lire(`https://openlibrary.org/search.json?${params}`);
  if (!json) return null;
  let docs: DocOpenLibrary[] = [];
  try {
    docs = (JSON.parse(json) as { docs?: DocOpenLibrary[] }).docs ?? [];
  } catch {
    return null;
  }
  const d = docs.find((x) => x.key && x.title && titreCorrespond(titre, x.title));
  if (!d) return null;
  const isbn = d.isbn?.find((i) => i.length === 13) ?? d.isbn?.[0] ?? null;
  return {
    cle: `ol:${d.key}`,
    titre: d.title,
    auteurs: d.author_name?.slice(0, 4).join(", ") || auteurs,
    annee: d.first_publish_year ?? null,
    editeur: d.publisher?.[0] ?? null,
    isbn,
    langue: d.language?.[0] ?? null,
    pages: d.number_of_pages_median ?? null,
    couvertureUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : couvertureIsbn(isbn),
    lienCatalogue: `https://openlibrary.org${d.key}`,
    description: d.subject?.length ? `Sujets (Open Library) : ${d.subject.slice(0, 8).join(" ; ")}` : null,
    source: "open_library",
  };
}

// ── Internet Archive : exemplaires lisibles en ligne ───────────────────────
//
// Internet Archive est la bibliothèque numérique d'Open Library. On n'y
// retient en lecture libre que ce qui est sûr du point de vue du droit
// d'auteur : domaine public (avant 1930), licence libre (Creative Commons),
// ou collections de bibliothèques et d'institutions (publications publiques,
// bibliothèques universitaires). Les livres récents des collections de prêt
// s'empruntent gratuitement avec un compte Internet Archive. Les dépôts
// d'internautes de livres récents (collection « opensource ») sont ignorés.

type DocArchive = {
  identifier: string;
  title?: string | string[];
  creator?: string | string[];
  year?: string | number;
  language?: string | string[];
  publisher?: string | string[];
  isbn?: string | string[];
  collection?: string | string[];
  licenseurl?: string;
  downloads?: number;
  "access-restricted-item"?: string | boolean;
};

const COLLECTIONS_FIABLES = new Set([
  "governmentpublications",
  "toronto",
  "americana",
  "canadiana",
  "canadianagriculturallibrary",
  "biodiversity",
  "gutenberg",
  "europeanlibraries",
  "library_of_congress",
  "usda-nationalagriculturallibrary",
  "fedlink",
  "university_of_illinois_urbana-champaign",
  "cornell",
  "mbl",
  "fao",
]);

const liste = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

export type LectureTrouvee = {
  id: string;
  /** Lisible par tous (et texte intégral disponible) ; sinon emprunt gratuit avec un compte. */
  libre: boolean;
  titre: string;
  auteurs: string;
  annee: number | null;
  editeur: string | null;
  isbn: string | null;
  langue: string | null;
};

function classerArchive(d: DocArchive): "libre" | "emprunt" | null {
  const restreint = d["access-restricted-item"] === true || d["access-restricted-item"] === "true";
  const collections = liste(d.collection);
  if (restreint) return collections.some((c) => c === "inlibrary" || c === "printdisabled" || c.startsWith("internetarchivebooks")) ? "emprunt" : null;
  const annee = Number(String(d.year ?? "").match(/\d{4}/)?.[0]) || null;
  if (annee && annee < 1930) return "libre";
  if (d.licenseurl && /creativecommons\.org|publicdomain/i.test(d.licenseurl)) return "libre";
  if (collections.some((c) => COLLECTIONS_FIABLES.has(c))) return "libre";
  return null;
}

async function chercherArchive(titre: string, auteurs: string): Promise<LectureTrouvee | null> {
  const mots = motsDuTitre(titre);
  if (!mots.length) return null;
  const nom = nomPremierAuteur(auteurs);
  const requete = `title:(${mots.join(" ")})${nom ? ` AND creator:(${nom})` : ""} AND mediatype:texts`;
  const params = new URLSearchParams({ q: requete, rows: "20", output: "json" });
  for (const f of ["identifier", "title", "creator", "year", "language", "publisher", "isbn", "collection", "licenseurl", "downloads", "access-restricted-item"]) params.append("fl[]", f);
  const json = await lire(`https://archive.org/advancedsearch.php?${params}`);
  if (!json) return null;
  let docs: DocArchive[] = [];
  try {
    docs = (JSON.parse(json) as { response?: { docs?: DocArchive[] } }).response?.docs ?? [];
  } catch {
    return null;
  }
  const candidats = docs
    .map((d) => ({ d, classe: classerArchive(d), titreTrouve: liste(d.title)[0] ?? "" }))
    .filter((c) => c.classe && c.titreTrouve && titreCorrespond(titre, c.titreTrouve));
  if (!candidats.length) return null;
  // Lecture libre d'abord, puis l'exemplaire le plus consulté.
  candidats.sort((a, b) => Number(b.classe === "libre") - Number(a.classe === "libre") || (b.d.downloads ?? 0) - (a.d.downloads ?? 0));
  const { d, classe, titreTrouve } = candidats[0];
  const isbn = liste(d.isbn).find((i) => /^\d{13}$/.test(i)) ?? liste(d.isbn)[0] ?? null;
  return {
    id: d.identifier,
    libre: classe === "libre",
    titre: titreTrouve.slice(0, 300),
    auteurs: liste(d.creator).slice(0, 4).join(", ") || auteurs,
    annee: Number(String(d.year ?? "").match(/\d{4}/)?.[0]) || null,
    editeur: liste(d.publisher)[0] ?? null,
    isbn,
    langue: liste(d.language)[0] ?? null,
  };
}

const memoireLecture = new Map<string, { lecture: LectureTrouvee | null; le: number }>();

/** Un exemplaire lisible (ou empruntable) sur Internet Archive, s'il existe. */
export async function trouverLecture(titre: string, auteurs: string): Promise<LectureTrouvee | null> {
  const cle = `${motsDuTitre(titre).join(" ")}|${nomPremierAuteur(auteurs)}`;
  const connu = memoireLecture.get(cle);
  if (connu && Date.now() - connu.le < (connu.lecture ? DUREE_TROUVE_MS : DUREE_INTROUVABLE_MS)) return connu.lecture;
  const lecture = await chercherArchive(titre, auteurs);
  if (memoireLecture.size > 5000) memoireLecture.clear();
  memoireLecture.set(cle, { lecture, le: Date.now() });
  return lecture;
}

/** Notice tirée d'un exemplaire d'Internet Archive, quand les catalogues n'ont rien trouvé. */
export function noticeDepuisArchive(l: LectureTrouvee): Notice {
  return {
    cle: `ia:${l.id}`,
    titre: l.titre,
    auteurs: l.auteurs,
    annee: l.annee,
    editeur: l.editeur,
    isbn: l.isbn,
    langue: l.langue,
    pages: null,
    couvertureUrl: `https://archive.org/services/img/${l.id}`,
    lienCatalogue: `https://archive.org/details/${l.id}`,
    description: null,
    source: "archive",
  };
}

/**
 * Vérifications déjà faites (titre + auteur normalisés) : une classe entière
 * qui cherche des sujets voisins n'interroge les catalogues qu'une fois par
 * livre. Un livre introuvable est retenté au bout d'une heure.
 */
const memoire = new Map<string, { notice: Notice | null; le: number }>();
const DUREE_TROUVE_MS = 24 * 3_600_000;
const DUREE_INTROUVABLE_MS = 3_600_000;

/** Cherche le livre dans les catalogues publics (BnF d'abord pour le français, Open Library sinon). */
export async function verifierLivre(titre: string, auteurs: string, langue?: string | null): Promise<Notice | null> {
  const cle = `${motsDuTitre(titre).join(" ")}|${nomPremierAuteur(auteurs)}`;
  const connu = memoire.get(cle);
  if (connu && Date.now() - connu.le < (connu.notice ? DUREE_TROUVE_MS : DUREE_INTROUVABLE_MS)) return connu.notice;
  const ordre = langue && !/^fr/i.test(langue) ? [chercherOpenLibrary, chercherBnf] : [chercherBnf, chercherOpenLibrary];
  let notice: Notice | null = null;
  for (const chercher of ordre) {
    notice = await chercher(titre, auteurs);
    if (notice) break;
  }
  if (memoire.size > 5000) memoire.clear();
  memoire.set(cle, { notice, le: Date.now() });
  return notice;
}

/**
 * Tout ce qu'on sait d'un livre cité : sa notice (BnF, Open Library, ou à
 * défaut Internet Archive) et l'exemplaire à lire, cherchés en parallèle,
 * en 12 secondes au plus.
 */
export async function identifierLivre(titre: string, auteurs: string, langue?: string | null): Promise<{ notice: Notice | null; lecture: LectureTrouvee | null }> {
  const delai = <T>(p: Promise<T>, ms: number, defaut: T) => Promise.race([p.catch(() => defaut), new Promise<T>((ok) => setTimeout(() => ok(defaut), ms))]);
  const [notice, lecture] = await Promise.all([delai(verifierLivre(titre, auteurs, langue), 12_000, null), delai(trouverLecture(titre, auteurs), 12_000, null)]);
  return { notice: notice ?? (lecture ? noticeDepuisArchive(lecture) : null), lecture };
}
