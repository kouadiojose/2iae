// Module « showreel » : 30 secondes pour présenter chaque formateur.
//
// Un showreel est une présentation animée rendue dans le navigateur (pas un
// fichier vidéo : léger en 3G, net sur tous les écrans, à jour quand le
// profil change), faite de 6 à 8 PLANS enchaînés : nom et photo, un chiffre
// fort, le parcours, l'expertise, une réalisation, une citation, le lien avec
// le campus et une fin.
//
// Qui écrit quoi :
// - les plans « rédigés » (ouverture, chiffre, parcours, expertise,
//   réalisation, citation) viennent des SOURCES du formateur (son site lu par
//   le serveur, le PDF de son profil LinkedIn, son profil du campus), composés
//   par l'IA ou par le compositeur de secours, puis relus et retouchés à la
//   main ; chaque plan garde la référence de sa source ;
// - les plans « campus » et « fin » sont remplis par le campus lui-même, à
//   la lecture, depuis l'emploi du temps (cours, jour, heures) : jamais par
//   l'IA, et toujours à jour.
//
// Cycle de vie : brouillon → à valider → publié. Le formateur valide sa
// présentation (il consent à sa publication) ; la direction publie. La
// version en ligne est une copie figée : retoucher le brouillon ne change
// rien au public tant qu'il n'est pas republié (l'IA propose, l'humain
// décide).
import { serial, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, fichiers } from "./base";

// ── Plans ──────────────────────────────────────────────────────────────────

export const TYPES_PLAN = ["ouverture", "chiffre", "parcours", "expertise", "realisation", "citation", "campus", "fin"] as const;
export type TypePlan = (typeof TYPES_PLAN)[number];

/** Plans rédigés à partir des sources (IA, compositeur de secours ou saisie). */
export const TYPES_PLAN_REDIGES = ["ouverture", "chiffre", "parcours", "expertise", "realisation", "citation"] as const satisfies readonly TypePlan[];
export type TypePlanRedige = (typeof TYPES_PLAN_REDIGES)[number];

/** Plans remplis par le campus à la lecture (emploi du temps) : jamais par l'IA. */
export const TYPES_PLAN_CAMPUS = ["campus", "fin"] as const satisfies readonly TypePlan[];

export const estPlanCampus = (t: TypePlan) => t === "campus" || t === "fin";

export const LIBELLES_TYPES_PLAN: Record<TypePlan, string> = {
  ouverture: "Nom et photo",
  chiffre: "Un chiffre fort",
  parcours: "Parcours",
  expertise: "Expertise",
  realisation: "Une réalisation",
  citation: "Une citation",
  campus: "Au campus 2IAE",
  fin: "Fin",
};

/** Ce que contient chaque type de plan (aide de l'éditeur). */
export const AIDES_TYPES_PLAN: Record<TypePlan, string> = {
  ouverture: "Le nom, le titre et la photo : la présentation commence toujours par là.",
  chiffre: "Un chiffre qui marque (« 20+ ans d'expérience »), avec une ligne d'explication.",
  parcours: "Les entreprises et les postes, du plus récent au plus ancien (six au plus).",
  expertise: "Les domaines de compétence, en quelques mots chacun (six au plus).",
  realisation: "Une réalisation concrète : un projet, un livre, une plateforme.",
  citation: "Une phrase exacte de la personne, publiée dans ses sources.",
  campus: "Le cours donné au campus, le jour et l'heure : repris de l'emploi du temps.",
  fin: "Le rendez-vous : « Lundi 08h30 · en direct dans les cinq campus ».",
};

export type ElementPlan = { nom: string; detail: string };

/**
 * Un plan. Les champs sont les mêmes pour tous les types (plus simple à
 * relire, à valider et à demander à l'IA) ; chaque type n'en affiche que
 * certains (CHAMPS_PAR_TYPE).
 */
export type PlanShowreel = {
  id: string;
  type: TypePlan;
  /** Petite ligne mono au-dessus du texte principal (« Parcours », « Réalisation »). */
  surtitre: string;
  /** Texte principal : le nom (ouverture), le libellé du chiffre, le titre d'une réalisation, l'auteur d'une citation. */
  titre: string;
  /** Texte secondaire : le titre professionnel (ouverture), le détail d'un chiffre, la phrase d'une réalisation, la citation elle-même. */
  texte: string;
  /** Le chiffre lui-même (« 20+ »). */
  valeur: string;
  /** Entreprises (parcours) ou domaines (expertise). */
  elements: ElementPlan[];
  /** Durée en secondes (calculée par rythmer : 30 s au total). */
  duree: number;
  /** Source du contenu : identifiant d'une source (« s1 »), « profil », « campus », ou null (écrit à la main). */
  sourceId: string | null;
  /** Extrait mot pour mot de la source qui justifie le plan (composition par l'IA). */
  preuve: string;
  /** L'extrait n'a pas été retrouvé dans la source lue : à relire avant de valider. */
  aVerifier: boolean;
};

export type ChampPlan = "surtitre" | "titre" | "texte" | "valeur" | "elements";

/** Champs modifiables de chaque type, avec leur libellé dans l'éditeur. */
export const CHAMPS_PAR_TYPE: Record<TypePlan, { champ: ChampPlan; libelle: string; exemple: string }[]> = {
  ouverture: [
    { champ: "surtitre", libelle: "Petite ligne", exemple: "Formateur · Campus numérique 2IAE" },
    { champ: "titre", libelle: "Nom", exemple: "José Kouadio" },
    { champ: "texte", libelle: "Titre", exemple: "Ingénieur logiciel senior" },
  ],
  chiffre: [
    { champ: "valeur", libelle: "Chiffre", exemple: "20+" },
    { champ: "titre", libelle: "Ce qu'il compte", exemple: "ans d'expérience" },
    { champ: "texte", libelle: "Détail", exemple: "De New York à Toronto en passant par la France" },
  ],
  parcours: [
    { champ: "surtitre", libelle: "Petite ligne", exemple: "Parcours" },
    { champ: "elements", libelle: "Entreprises", exemple: "Zoho · Solution Engineer" },
  ],
  expertise: [
    { champ: "surtitre", libelle: "Petite ligne", exemple: "Expertise" },
    { champ: "elements", libelle: "Domaines", exemple: "Automatisation des processus" },
  ],
  realisation: [
    { champ: "surtitre", libelle: "Petite ligne", exemple: "Réalisation" },
    { champ: "titre", libelle: "Titre", exemple: "20+ plateformes créées" },
    { champ: "texte", libelle: "Phrase", exemple: "Dont Sevarta, plateforme d'IA pour les auteurs" },
  ],
  citation: [
    { champ: "texte", libelle: "Citation exacte", exemple: "L'automatisation n'est pas un luxe…" },
    { champ: "titre", libelle: "Auteur", exemple: "José Kouadio" },
  ],
  campus: [],
  fin: [],
};

/** Longueurs maximales (éditeur, API, consignes données à l'IA). */
export const LIMITES_PLAN = {
  surtitre: 48,
  titre: 72,
  texte: 200,
  valeur: 8,
  elementNom: 44,
  elementDetail: 64,
  elements: 6,
} as const;

export const DUREE_SHOWREEL = 30;
export const PLANS_MIN = 4;
export const PLANS_MAX = 8;

const POIDS: Record<TypePlan, number> = {
  ouverture: 4.4,
  chiffre: 3.4,
  parcours: 4.2,
  expertise: 3.8,
  realisation: 3.8,
  citation: 4.2,
  campus: 4.6,
  fin: 3.4,
};

/**
 * Donne à chaque plan sa durée : un poids par type, un peu plus de temps pour
 * les listes longues et les phrases longues, puis mise à l'échelle pour que le
 * total fasse exactement 30 secondes.
 */
export function rythmer<T extends Pick<PlanShowreel, "type" | "texte" | "elements">>(plans: T[]): (T & { duree: number })[] {
  if (!plans.length) return [];
  const poids = plans.map((p) => {
    let w = POIDS[p.type] ?? 3.8;
    if (p.type === "parcours" || p.type === "expertise") w += Math.max(0, p.elements.length - 3) * 0.35;
    if (p.type === "citation" || p.type === "realisation") w += Math.min(1.6, Math.max(0, p.texte.length - 90) * 0.015);
    return w;
  });
  const total = poids.reduce((a, b) => a + b, 0);
  const durees = poids.map((w) => Math.round(((w * DUREE_SHOWREEL) / total) * 10) / 10);
  // Arrondis : le dernier plan absorbe l'écart pour tomber pile sur 30 s.
  const ecart = Math.round((DUREE_SHOWREEL - durees.reduce((a, b) => a + b, 0)) * 10) / 10;
  durees[durees.length - 1] = Math.round((durees[durees.length - 1] + ecart) * 10) / 10;
  return plans.map((p, i) => ({ ...p, duree: durees[i] }));
}

export const dureeTotale = (plans: Pick<PlanShowreel, "duree">[]) => Math.round(plans.reduce((a, p) => a + p.duree, 0) * 10) / 10;

/** Un plan vide du type demandé (éditeur, compositeurs). */
export function planVide(type: TypePlan, id: string): PlanShowreel {
  return { id, type, surtitre: "", titre: "", texte: "", valeur: "", elements: [], duree: 0, sourceId: null, preuve: "", aVerifier: false };
}

/** Un plan rédigé qui n'a rien à montrer. */
export function planVideDeContenu(p: PlanShowreel): boolean {
  switch (p.type) {
    case "ouverture":
      return !p.titre.trim();
    case "chiffre":
      return !p.valeur.trim() || !p.titre.trim();
    case "parcours":
    case "expertise":
      return !p.elements.some((e) => e.nom.trim());
    case "realisation":
      return !p.titre.trim() && !p.texte.trim();
    case "citation":
      return !p.texte.trim();
    default:
      return false;
  }
}

/**
 * Ce qui empêche de valider ou de publier (bloquant), et les conseils. Même
 * règle côté serveur et dans l'éditeur.
 */
export function verifierPlans(plans: PlanShowreel[]): { bloquants: string[]; conseils: string[] } {
  const bloquants: string[] = [];
  const conseils: string[] = [];
  if (plans.length < PLANS_MIN) bloquants.push(`Ajoutez au moins ${PLANS_MIN} plans.`);
  if (plans.length > PLANS_MAX) bloquants.push(`${PLANS_MAX} plans au plus : retirez-en ${plans.length - PLANS_MAX}.`);
  if (plans[0] && plans[0].type !== "ouverture") bloquants.push("La présentation doit s'ouvrir sur le plan « Nom et photo ».");
  if (!plans.some((p) => p.type === "ouverture")) bloquants.push("Il manque le plan « Nom et photo ».");
  for (const p of plans) {
    if (planVideDeContenu(p)) bloquants.push(`Le plan « ${LIBELLES_TYPES_PLAN[p.type]} » est vide : complétez-le ou retirez-le.`);
  }
  const aVerifier = plans.filter((p) => p.aVerifier).length;
  if (aVerifier) conseils.push(aVerifier > 1 ? `${aVerifier} plans sont à relire : leur source n'a pas été retrouvée mot pour mot.` : "Un plan est à relire : sa source n'a pas été retrouvée mot pour mot.");
  if (plans.length >= PLANS_MIN && plans.length < 6) conseils.push("Six à huit plans donnent le meilleur rythme.");
  if (!plans.some((p) => p.type === "fin")) conseils.push("Terminez par le plan « Fin » : il donne le rendez-vous du cours.");
  return { bloquants, conseils };
}

// ── Sources ────────────────────────────────────────────────────────────────

/**
 * site : lu par le serveur (page d'accueil et quelques pages « à propos ») ;
 * linkedin et reseau : gardés comme liens affichés, jamais lus (LinkedIn
 * refuse toute lecture automatique) ; pdf : profil LinkedIn enregistré en PDF.
 */
export const TYPES_SOURCE = ["site", "linkedin", "reseau", "pdf"] as const;
export type TypeSource = (typeof TYPES_SOURCE)[number];

export type EtatSource = "a_lire" | "lu" | "echec" | "non_lisible";

export type SourceShowreel = {
  /** « s1 », « s2 »… (stable : un lien garde son identifiant), « pdf » pour le PDF. */
  id: string;
  type: TypeSource;
  url: string | null;
  fichierId: number | null;
  /** « kouadiojose.com », « Profil LinkedIn », nom du PDF. */
  nom: string;
  /** Montré sous la présentation publique (sites et LinkedIn). */
  afficher: boolean;
  etat: EtatSource;
  /** Ce que la personne doit savoir (« Lu : 3 pages », « Ce site n'a pas répondu »). */
  message: string | null;
  luLe: string | null;
  /** Pages réellement lues. */
  pages: string[];
  /** Titre de la page d'accueil (preuve de lecture). */
  titrePage: string | null;
  /** Caractères utiles lus. */
  caracteres: number;
};

/** Identifiants réservés (pas de source déposée). */
export const SOURCE_PROFIL = "profil";
export const SOURCE_CAMPUS = "campus";

// ── Table ──────────────────────────────────────────────────────────────────

export const STATUTS_SHOWREEL = ["brouillon", "a_valider", "publie"] as const;
export type StatutShowreel = (typeof STATUTS_SHOWREEL)[number];

export const LIBELLES_STATUTS_SHOWREEL: Record<StatutShowreel, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  publie: "Publiée",
};

/**
 * ia : composée par Claude à partir des sources · secours : composée sans IA
 * (assistant indisponible) à partir du profil et de l'emploi du temps ·
 * depart : brouillon de départ (faits sûrs seulement) · import : plans
 * déposés par la direction (faits vérifiés).
 */
export const MODES_COMPOSITION = ["ia", "secours", "depart", "import"] as const;
export type ModeComposition = (typeof MODES_COMPOSITION)[number];

/** rond : portrait dans un cercle · detoure : silhouette sur fond transparent, posée sur le décor. */
export const FORMES_PHOTO = ["rond", "detoure"] as const;
export type FormePhoto = (typeof FORMES_PHOTO)[number];

/** Copie figée de ce qui est en ligne. */
export type VersionShowreel = {
  plans: PlanShowreel[];
  photoFichierId: number | null;
  photoForme: FormePhoto;
  fuseau: string | null;
};

export const showreels = campusSchema.table(
  "showreels",
  {
    id: serial("id").primaryKey(),
    formateurId: integer("formateur_id")
      .notNull()
      .unique()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    statut: text("statut").$type<StatutShowreel>().notNull().default("brouillon"),
    /** Le brouillon courant (ce que l'éditeur montre). */
    plans: jsonb("plans").$type<PlanShowreel[]>().notNull().default([]),
    sources: jsonb("sources").$type<SourceShowreel[]>().notNull().default([]),
    /** Textes lus sur les sites, par identifiant de source (serveur seulement, jamais renvoyés au navigateur). */
    extraits: jsonb("extraits").$type<Record<string, string>>().notNull().default({}),
    photoFichierId: integer("photo_fichier_id").references(() => fichiers.id, { onDelete: "set null" }),
    photoForme: text("photo_forme").$type<FormePhoto>().notNull().default("rond"),
    /** Fuseau de la ville affichée (« 04h30 à Toronto ») quand le profil n'en a pas encore. */
    fuseau: text("fuseau"),
    composition: text("composition").$type<ModeComposition>(),
    composeLe: timestamp("compose_le", { withTimezone: true }),
    composeParId: integer("compose_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    /** Retouché à la main depuis la dernière composition. */
    retouche: boolean("retouche").notNull().default(false),
    /** Envoyé au formateur pour validation (par la direction). */
    soumisLe: timestamp("soumis_le", { withTimezone: true }),
    /** Validé par le formateur le … (il consent à la publication de cette version). */
    valideLe: timestamp("valide_le", { withTimezone: true }),
    /** Version en ligne (null : rien n'est publié). */
    versionPubliee: jsonb("version_publiee").$type<VersionShowreel>(),
    publieLe: timestamp("publie_le", { withTimezone: true }),
    publieParId: integer("publie_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    /** Publiée par la direction sans validation du formateur dans le campus : la direction a confirmé avoir son accord. */
    accordDirection: boolean("accord_direction").notNull().default(false),
    majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
    majParId: integer("maj_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("showreels_statut_idx").on(t.statut)],
);

export type Showreel = typeof showreels.$inferSelect;

// ── Contrats d'API ─────────────────────────────────────────────────────────

/** Le lien du formateur avec le campus, résolu à la lecture depuis l'emploi du temps. */
export type LienCampusShowreel = {
  /** emploi_du_temps : un créneau d'une session publiée · cours : un cours du campus sans créneau · aucune : rien encore. */
  origine: "emploi_du_temps" | "cours" | "aucune";
  cours: { titre: string; code: string; couleur: string } | null;
  /** 1 = lundi … 7 = dimanche. */
  jour: number | null;
  /** « Lundi » */
  jourLibelle: string | null;
  /** Heure d'Abidjan, « 08:30 ». */
  heureDebut: string | null;
  heureFin: string | null;
  /** Le même créneau chez le formateur (« 04:30 »), si son fuseau est connu. */
  heureDebutLocale: string | null;
  heureFinLocale: string | null;
  /** Ville du fuseau du formateur (« Toronto »). */
  ville: string | null;
  /** Public de la session (« Tronc commun · 1BTS / 2BTS »). */
  public: string | null;
  /** Mention imprimée sur l'emploi du temps (« Consultant canadien »). */
  mention: string | null;
  /** Prochaine séance prévue (« 2026-09-28 »), null s'il n'y en a plus. */
  prochaineDate: string | null;
  /** « lundi 28 septembre » */
  prochaineDateLibelle: string | null;
  /** Noms courts des campus reliés en direct (« Riviera », « Yopougon »…). */
  campus: string[];
};

export type FormateurShowreel = {
  id: number;
  prenom: string;
  nom: string;
  /** Nom tel qu'il s'affiche (« M. Konaté » quand le prénom n'est pas connu). */
  nomAffiche: string;
  photoUrl: string | null;
  photoForme: FormePhoto;
  campus: LienCampusShowreel;
};

/** GET /api/public/presentations/:slug — une présentation publiée. */
export type ShowreelPublicDto = {
  slug: string;
  formateur: FormateurShowreel;
  scenes: PlanShowreel[];
  duree: number;
  /** Liens affichés (site personnel, LinkedIn). */
  liens: { nom: string; url: string; type: TypeSource }[];
  publieLe: string;
  /** Adresse absolue de la page autonome (partage WhatsApp). */
  urlPage: string;
  /** Fiche publique du formateur (/formateurs/:slug), si elle est en ligne. */
  urlFiche: string | null;
};

export type DisponibiliteIa = { disponible: boolean; raison: "configuration" | "panne" | null };

/** GET /api/showreels/:cible (« moi » ou identifiant du formateur) — l'éditeur. */
export type ShowreelEditionDto = {
  formateur: FormateurShowreel & {
    titre: string | null;
    localisation: string | null;
    bio: string | null;
    fuseau: string | null;
    slug: string;
    consentementSite: boolean;
    proposeSurSite: boolean;
    publierSurSite: boolean;
    actif: boolean;
  };
  statut: StatutShowreel;
  plans: PlanShowreel[];
  sources: SourceShowreel[];
  photo: { fichierId: number; url: string; mime: string } | null;
  photoForme: FormePhoto;
  /** Fuseau choisi pour la présentation (null : celui du profil). */
  fuseau: string | null;
  composition: ModeComposition | null;
  composeLe: string | null;
  composePar: string | null;
  retouche: boolean;
  soumisLe: string | null;
  valideLe: string | null;
  enLigne: boolean;
  publieLe: string | null;
  publiePar: string | null;
  accordDirection: boolean;
  /** Le brouillon diffère de la version en ligne. */
  modificationsNonPubliees: boolean;
  /** Adresse de la page autonome (quand elle est en ligne). */
  urlPublique: string | null;
  majLe: string;
  majPar: string | null;
  ia: DisponibiliteIa;
  /** La personne connectée est le formateur lui-même. */
  estMoi: boolean;
  peut: { modifier: boolean; composer: boolean; valider: boolean; soumettre: boolean; publier: boolean; retirer: boolean };
  verification: { bloquants: string[]; conseils: string[] };
};

/** PATCH /api/showreels/:cible — enregistrement partiel. */
export type SaisieShowreel = {
  plans?: Omit<PlanShowreel, "duree">[];
  /** Liens (site personnel, LinkedIn…), dans l'ordre. */
  liens?: { url: string; afficher?: boolean }[];
  /** PDF du profil (fichier téléversé avec l'usage « source-profil »), null pour le retirer. */
  pdfFichierId?: number | null;
  photoFichierId?: number | null;
  photoForme?: FormePhoto;
  fuseau?: string | null;
  /** « import » : plans rédigés par la direction à partir de faits vérifiés (script de publication). */
  origine?: "import";
};

export type RapportComposition = {
  mode: "ia" | "secours";
  /** Pourquoi sans IA : configuration (pas de clé), panne (crédit, compte), erreur (réponse inutilisable). */
  raison: "configuration" | "panne" | "erreur" | null;
  message: string;
  /** Ce que l'IA n'a pas trouvé dans les sources. */
  manques: string[];
  /** Plans dont l'extrait n'a pas été retrouvé mot pour mot. */
  aVerifier: number;
  sources: SourceShowreel[];
};

/** POST /api/showreels/:cible/composer */
export type ReponseComposition = { showreel: ShowreelEditionDto; rapport: RapportComposition };

/** GET /api/pilotage/showreels — une ligne par formateur (direction). */
export type ShowreelResumeDto = {
  formateurId: number;
  prenom: string;
  nom: string;
  nomAffiche: string;
  titre: string | null;
  photoUrl: string | null;
  actif: boolean;
  statut: StatutShowreel | "aucun";
  enLigne: boolean;
  modificationsNonPubliees: boolean;
  composition: ModeComposition | null;
  composeLe: string | null;
  valideLe: string | null;
  publieLe: string | null;
  majLe: string | null;
  nbPlans: number;
  nbSources: number;
  cours: string | null;
  jourLibelle: string | null;
  heureDebut: string | null;
  urlPublique: string | null;
};
