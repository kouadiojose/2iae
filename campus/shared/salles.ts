// Salles de conférence d'un campus (décision de José du 12 octobre 2026) : un campus peut avoir
// plusieurs salles, chacune avec son écran (un compte « salle ») et son lien d'installation.
// Une salle a un nom (« Salle de conférence 2 ») et un public facultatif : « L1 » (classes de
// 1re année : 1BTS, BTS 1, Licence 1), « L2 » (2e année : 2BTS, BTS 2, Licence 2), ou aucun
// (toutes les classes, comme avant). Chaque cours suivi par un campus se tient dans UNE salle
// de ce campus (salleDuCours) : un cours de L1 dans la salle L1, un cours de L2 dans la salle L2,
// un cours commun aux deux niveaux (ou d'un autre niveau) dans la salle sans public, sinon la
// salle au plus petit numéro. Un seul écran par campus et par séance : la parole, l'effectif,
// l'émargement et les groupes de travail, rangés par campus, restent justes.
//
// « Les salles du jour » (demande de José du 12 octobre 2026) : un message WhatsApp par salle et
// par jour (« Riviera · L1 · Salle de conférence 1 », ses cours, le lien de son écran), envoyé d'un
// toucher au coordinateur des salles, qui le transfère au responsable de la salle. Son numéro se
// règle sur la page (par défaut NUMERO_COORDINATEUR_PAR_DEFAUT) ; chaque matin à 6 h 30 (Abidjan),
// la direction reçoit un rappel quand il y a des messages à envoyer (server/routes/salles.ts).
//
// Stockage : colonnes salle_nom, salle_public et salle_numero du compte de l'écran
// (migration 0034_salles_paralleles). L'écran de chaque campus d'avant devient la salle 1 :
// sans nom propre, il garde le nom de la salle du campus (sites.salle_conference) ; sans public,
// il se comporte comme avant. Aucune dépendance : commun au serveur et au client.

export const PUBLICS_SALLE = ["L1", "L2"] as const;
export type PublicSalle = (typeof PUBLICS_SALLE)[number];

export const estPublicSalle = (v: unknown): v is PublicSalle => v === "L1" || v === "L2";

/** Numéro WhatsApp du coordinateur des salles tant que la direction n'en a pas réglé un autre (+225 07 07 72 09 40). */
export const NUMERO_COORDINATEUR_PAR_DEFAUT = "2250707720940";

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

/** Niveau d'un cours sur un campus : « L1 » ou « L2 » s'il n'est suivi que par ce niveau, sinon null (commun ou autre niveau). */
export function niveauDuCours(annees: Iterable<PublicSalle | null>): PublicSalle | null {
  const a = new Set(annees);
  if (a.has("L1") && !a.has("L2")) return "L1";
  if (a.has("L2") && !a.has("L1")) return "L2";
  return null;
}

/** Cours suivi sur ce campus par des classes de 1re ET de 2e année (« L1 et L2 » dans les messages). */
export const estCoursCommun = (annees: Iterable<PublicSalle | null>) => {
  const a = new Set(annees);
  return a.has("L1") && a.has("L2");
};

/**
 * Salle (numéro) d'un campus où se tient un cours suivi par des classes de ces années, ou null si aucune
 * salle ne convient (cours de L2 alors que la seule salle est réglée en L1 : « Les salles du jour » le signale).
 * Cours d'un seul niveau : la première salle de ce niveau, sinon la première salle sans public.
 * Cours commun aux deux niveaux, ou d'un autre niveau : la première salle sans public, sinon la salle au plus
 * petit numéro. Une seule salle sans public : tous les cours du campus, comme avant les salles.
 */
export function salleDuCours(salles: { numero: number; public: PublicSalle | null }[], annees: Iterable<PublicSalle | null>): number | null {
  const tri = [...salles].sort((a, b) => a.numero - b.numero);
  const niveau = niveauDuCours(annees);
  if (niveau) return (tri.find((s) => s.public === niveau) ?? tri.find((s) => !s.public))?.numero ?? null;
  return (tri.find((s) => !s.public) ?? tri[0])?.numero ?? null;
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
  /** Cours suivi par des classes de L1 et de L2 de ce campus (« L1 et L2 » dans le message). */
  commun: boolean;
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
  /**
   * Le message WhatsApp de la salle pour ce jour (son étiquette, une ligne par cours, le lien de son écran ;
   * jamais le code d'écran). null : pas de cours dans la salle ce jour-là, ou écran à installer sans lien en
   * place (lienAPreparer), donc pas de message.
   */
  message: string | null;
  /** https://wa.me/<numéro du coordinateur>?text=… (null avec le message). */
  lienWhatsApp: string | null;
  /** Des cours ce jour-là, mais un écran à installer sans lien en place : préparer d'abord le lien de l'écran. */
  lienAPreparer: boolean;
};

export type CampusDuJour = {
  siteId: number;
  campus: string;
  /** Nom de la salle du campus (sites.salle_conference), repris par la salle 1 sans nom propre. */
  salleConference: string;
  /** Dans l'ordre : salle 1, puis salle 2… */
  salles: SalleDuJour[];
  /**
   * Ce qui empêche un cours du jour d'avoir son écran : un cours qu'aucune salle ne montre (« Projet (L2, 8h30)
   * n'a pas de salle »), deux cours à la même heure dans une même salle. Vide : tout est en place.
   */
  alertes: string[];
  /**
   * Compatibilité avec la page d'avant (un message par campus), restée ouverte dans une application lors de la
   * mise en ligne : le numéro du coordinateur, les messages des salles du campus l'un après l'autre, et leur
   * lien wa.me. La page actuelle ne les lit pas. À retirer après le 20 octobre 2026.
   */
  whatsapp: string;
  message: string;
  lienWhatsApp: string;
};

/** GET /api/pilotage/salles-du-jour?jour=demain (réponse sans cache : elle contient les liens des écrans). */
export type SallesDuJour = {
  /** « 2026-10-13 » (jour d'Abidjan) */
  date: string;
  /** « mardi 13 octobre » */
  libelle: string;
  jour: "aujourdhui" | "demain";
  /** Numéro WhatsApp (international, chiffres seuls) qui reçoit les messages : le coordinateur des salles. */
  coordinateur: string;
  /** La personne peut changer ce numéro (la direction). */
  peutRegler: boolean;
  /** Nombre de messages à envoyer ce jour-là (salles qui ont au moins un cours et un écran prêt). */
  messages: number;
  /** Salles qui ont cours ce jour-là mais dont il faut d'abord préparer le lien de l'écran (pas encore de message). */
  aPreparer: number;
  campus: CampusDuJour[];
};

/** PUT /api/pilotage/salles-du-jour/numero (direction) : le numéro qui reçoit les liens. */
export type CorpsNumeroSalles = { numero: string };
