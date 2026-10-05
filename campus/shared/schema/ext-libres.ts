// Contrats du portail des bibliothèques libres (client ↔ serveur). Fichier
// sans tables Drizzle : le client peut l'importer sans alourdir le téléphone.

/** Bibliothèques gratuites et légales dont le campus tient l'index. */
export const SOURCES_LIBRES = ["gutenberg", "archive", "openstax", "banque_mondiale", "oapen"] as const;
export type SourceLibre = (typeof SOURCES_LIBRES)[number];

export const LIBELLES_SOURCES_LIBRES: Record<SourceLibre, { nom: string; description: string }> = {
  gutenberg: { nom: "Project Gutenberg", description: "Les grands classiques du domaine public, en texte intégral." },
  archive: { nom: "Internet Archive", description: "Livres anciens numérisés par les bibliothèques du monde (domaine public et publications libres)." },
  openstax: { nom: "OpenStax", description: "Manuels universitaires gratuits (Université Rice) : gestion, comptabilité, économie, statistiques…" },
  banque_mondiale: { nom: "Banque mondiale", description: "Livres et rapports en libre accès sur l'économie, le développement et l'Afrique." },
  oapen: { nom: "OAPEN", description: "Livres universitaires en libre accès (licences Creative Commons)." },
};

/**
 * Comment on lit le livre sur le campus : « texte » (texte intégral en pages),
 * « archive » (pages scannées d'Internet Archive, et leur texte), « pdf ».
 */
export const FORMATS_LIBRES = ["texte", "archive", "pdf"] as const;
export type FormatLibre = (typeof FORMATS_LIBRES)[number];

/** Rayons du portail (un livre peut être rangé dans plusieurs). */
export const DOMAINES_LIBRES = [
  "gestion",
  "compta_finance",
  "economie",
  "marketing",
  "droit",
  "informatique",
  "agriculture",
  "afrique",
  "sciences",
  "techniques",
  "sante",
  "societe",
  "philosophie",
  "education",
  "langues",
  "litterature",
  "arts",
] as const;
export type DomaineLibre = (typeof DOMAINES_LIBRES)[number];

export const LIBELLES_DOMAINES_LIBRES: Record<DomaineLibre, string> = {
  gestion: "Gestion et management",
  compta_finance: "Comptabilité et finance",
  economie: "Économie",
  marketing: "Marketing et commerce",
  droit: "Droit",
  informatique: "Informatique et numérique",
  agriculture: "Agriculture et environnement",
  afrique: "Afrique",
  sciences: "Sciences et mathématiques",
  techniques: "Techniques et ingénierie",
  sante: "Santé",
  societe: "Histoire et société",
  philosophie: "Philosophie et religions",
  education: "Éducation",
  langues: "Langues",
  litterature: "Littérature",
  arts: "Arts et musique",
};

export const LANGUES_LIBRES: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
  es: "Espagnol",
  pt: "Portugais",
  de: "Allemand",
  it: "Italien",
  la: "Latin",
  nl: "Néerlandais",
  ar: "Arabe",
};

export type LivreLibreDto = {
  id: number;
  source: SourceLibre;
  titre: string;
  auteurs: string;
  annee: number | null;
  langue: string | null;
  domaines: DomaineLibre[];
  couverture: string | null;
  format: FormatLibre;
  /** Début de la description (cartes de résultats). */
  apercu: string | null;
  /** Lisible directement sur le campus (sinon : sur le site de la bibliothèque). */
  lectureIci: boolean;
};

export type RechercheLibresDto = {
  resultats: LivreLibreDto[];
  total: number;
  page: number;
  parPage: number;
};

export type DetailLibreDto = {
  livre: LivreLibreDto & {
    description: string | null;
    sujets: string;
    licence: string | null;
    /** Page du livre sur le site de sa bibliothèque. */
    lien: string;
    /** Le texte intégral se lit en pages sur le campus. */
    texte: boolean;
    /** Un PDF s'affiche sur le campus. */
    pdf: boolean;
    /** Version web à lire dans le campus (OpenStax, édition illustrée de Gutenberg). */
    web: string | null;
    /** PDF à ouvrir sur le site de la bibliothèque (OAPEN, qui ne laisse pas le campus l'afficher). */
    pdfExterne: string | null;
    lectures: number;
  };
  memeAuteur: LivreLibreDto[];
  memeDomaine: LivreLibreDto[];
};

export type PageTexteLibreDto = { page: number; total: number; contenu: string };

export type EtatMoissonDto = {
  source: SourceLibre;
  statut: "en_cours" | "terminee" | "erreur";
  nombre: number;
  debut: string;
  fin: string | null;
  message: string | null;
};

export type AccueilLibresDto = {
  total: number;
  parDomaine: { domaine: DomaineLibre; nombre: number }[];
  parSource: { source: SourceLibre; nombre: number }[];
  /** Les plus lus au campus, puis une sélection pour débuter. */
  plusLus: LivreLibreDto[];
  /** Index (direction) : état de chaque moisson ; null pour les autres. */
  moissons: EtatMoissonDto[] | null;
};
