// Salles de conférence d'un campus (décision de José du 12 octobre 2026) : un campus peut avoir
// plusieurs salles, chacune avec son écran (un compte « salle ») et son lien d'installation.
// Une salle a un nom (« Salle de conférence 2 ») et un public facultatif : « L1 » (classes de
// 1re année : 1BTS, BTS 1, Licence 1), « L2 » (2e année : 2BTS, BTS 2, Licence 2), ou aucun
// (toutes les classes, comme avant). L'écran d'une salle qui a un public ne montre que les
// séances des cours suivis, sur son campus, par des classes de ce niveau ; un cours commun
// aux deux niveaux, ou suivi par d'autres niveaux seulement, s'affiche dans toutes les salles.
//
// Stockage : colonnes salle_nom, salle_public et salle_numero du compte de l'écran
// (migration 0034_salles_paralleles). L'écran de chaque campus d'avant devient la salle 1 :
// sans nom propre, il garde le nom de la salle du campus (sites.salle_conference) ; sans public,
// il se comporte comme avant. Aucune dépendance : commun au serveur et au client.

export const PUBLICS_SALLE = ["L1", "L2"] as const;
export type PublicSalle = (typeof PUBLICS_SALLE)[number];

export const estPublicSalle = (v: unknown): v is PublicSalle => v === "L1" || v === "L2";

/** Nom proposé pour la salle n : « Salle de conférence 2 ». */
export const nomSalleParDefaut = (numero: number) => `Salle de conférence ${numero}`;

const sansAccents = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function anneeDuTexte(texte: string): PublicSalle | null {
  const t = sansAccents(texte);
  if (/\b1\s*bts\b|\bbts\s*1\b|\blicence\s*1\b|\bl1\b|\b1\s*(re|ere)\s*annee\b/.test(t)) return "L1";
  if (/\b2\s*bts\b|\bbts\s*2\b|\blicence\s*2\b|\bl2\b|\b2\s*(e|eme|nde)\s*annee\b/.test(t)) return "L2";
  return null;
}

/**
 * Année d'une classe, d'après son niveau (« 1BTS », « BTS 2 », « Licence 1 »), sinon son nom
 * (« BTS · 2e année ») : « L1 », « L2 », ou null (Licence 3, certificat, niveau illisible).
 */
export function anneeDeClasse(c: { niveau: string; nom: string }): PublicSalle | null {
  return anneeDuTexte(c.niveau) ?? anneeDuTexte(c.nom);
}

/**
 * Une salle de ce public montre-t-elle un cours suivi sur son campus par des classes de ces années ?
 * Sans public : oui (comme avant). Avec un public : si une classe de ce niveau le suit, ou si aucune
 * classe de 1re ni de 2e année ne le suit (cours d'un autre niveau : il reste visible partout).
 */
export function salleMontreCours(publicSalle: PublicSalle | null | undefined, annees: Iterable<PublicSalle | null>): boolean {
  if (!publicSalle) return true;
  const a = new Set(annees);
  return a.has(publicSalle) || (!a.has("L1") && !a.has("L2"));
}

/** Nom affiché d'une salle : le sien, sinon celui de la salle du campus (l'écran d'avant, salle 1). */
export function nomDeSalle(compte: { salleNom?: string | null } | null | undefined, site: { salleConference: string } | null | undefined): string {
  return compte?.salleNom?.trim() || site?.salleConference?.trim() || "Salle de conférence";
}

/** « Riviera · L1 · Salle de conférence 1 » ; sans public : « Riviera · Salle de conférence 1 ». */
export function etiquetteSalle(campus: string, publicSalle: PublicSalle | null | undefined, nom: string): string {
  return [campus, publicSalle, nom].filter(Boolean).join(" · ");
}

// ── Contrats d'API ─────────────────────────────────────────────────────────

/** Une salle d'un campus, vue du pilotage (GET /api/pilotage/salles). Jamais de lien ici. */
export type SalleCampus = {
  /** 1 : l'écran d'origine du campus ; 2, 3… : salles ajoutées. */
  numero: number;
  nom: string;
  public: PublicSalle | null;
  /** Compte de l'écran (null : salle 1 dont l'écran n'a jamais été préparé). */
  compteId: number | null;
  /** Un ordinateur a été installé avec le lien ou le code de cette salle. */
  ecranInstalle: boolean;
  /** Dernière connexion de l'écran. */
  vuLe: string | null;
  /** Un lien d'installation est en place (sans le donner). */
  lienPret: boolean;
};

export type SallesDuSite = { siteId: number; campus: string; salles: SalleCampus[] };

/** POST /api/pilotage/sites/:id/salles · PATCH /api/pilotage/sites/:id/salles/:numero */
export type CorpsSalle = { nom?: string; public?: PublicSalle | null };

/** Une séance du jour dans une salle (page « Les salles du jour »). */
export type SeanceDeSalle = {
  id: number;
  debut: string;
  fin: string;
  /** « 8h30-12h30 » */
  heures: string;
  cours: string;
  intervenant: string | null;
  statut: string;
};

export type SalleDuJour = {
  numero: number;
  nom: string;
  public: PublicSalle | null;
  /** « Riviera · L1 · Salle de conférence 1 » */
  etiquette: string;
  ecranInstalle: boolean;
  /** Lien d'installation de l'écran de la salle ; null : écran à installer (aucun lien en place). */
  lien: string | null;
  seances: SeanceDeSalle[];
};

export type CampusDuJour = {
  siteId: number;
  campus: string;
  /** Numéro WhatsApp de la vie scolaire du campus (null : WhatsApp demandera à qui l'envoyer). */
  whatsapp: string | null;
  salles: SalleDuJour[];
  /** Le message prêt à envoyer (avec les liens des écrans). */
  message: string;
  /** https://wa.me/<numéro>?text=… */
  lienWhatsApp: string;
  /** Plusieurs salles dont au moins une sans public : elle montrera aussi les cours des autres. */
  publicsAChoisir: boolean;
};

/** GET /api/pilotage/salles-du-jour?jour=demain (réponse sans cache : elle contient les liens des écrans). */
export type SallesDuJour = {
  /** « 2026-10-13 » (jour d'Abidjan) */
  date: string;
  /** « mardi 13 octobre » */
  libelle: string;
  jour: "aujourdhui" | "demain";
  campus: CampusDuJour[];
};
