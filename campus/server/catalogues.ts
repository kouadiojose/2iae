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
  source: "bnf" | "open_library";
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
  return t
    .replace(/\s+par\s+.*$/i, "")
    .replace(/\.{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
    auteurs: n.auteursTrouves.join(", ") || auteurs,
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

/** Cherche le livre dans les catalogues publics (BnF d'abord pour le français, Open Library sinon). */
export async function verifierLivre(titre: string, auteurs: string, langue?: string | null): Promise<Notice | null> {
  const ordre = langue && !/^fr/i.test(langue) ? [chercherOpenLibrary, chercherBnf] : [chercherBnf, chercherOpenLibrary];
  for (const chercher of ordre) {
    const n = await chercher(titre, auteurs);
    if (n) return n;
  }
  return null;
}
