// Copie d'étudiant montrée à toute la classe pendant le direct (demande de José du 9 octobre 2026 : « quand on
// est dans la classe en live, on ne peut pas aller voir les devoirs des étudiants et les présenter »).
//
// Le formateur choisit une copie dans le Studio et en projette une page à la place de la diapo : cinq salles,
// étudiants en ligne, Studio en observation. Rien n'est dupliqué : ni ressource de séance, ni diapo, ni fichier.
// Le serveur fabrique l'image de la SEULE page projetée (remise droite, sans métadonnées, le haut de la page
// caché par défaut), la garde en mémoire et la sert par une adresse à clé aléatoire, valable tant que la page
// est à l'écran (410 ensuite). L'état vit dans seances.projection (union vidéo ou copie, sans migration) ; la
// classe reçoit CopieProjeteeDto (copieDe), jamais la copie, son auteur, sa note ni ses fichiers.
//
// Module feuille : il n'importe aucune route (live.ts, ressources-seance.ts et evaluations.ts l'importent).
import crypto from "crypto";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { publier } from "./temps-reel";
import { decouperTexte, genreDe, imageDePage, inventaireFichier, PART_ENTETE as PART_ENTETE_PAGES, type ImagePage } from "./copies-pages";
import { lireContenuFichier } from "./fichiers";
import { corrigeUtilisableLigne } from "./correction-auto";
import { echeance } from "./evaluations-outils";
import { t } from "@shared/textes/copies-direct";
import {
  corrigesDevoirs,
  devoirs,
  evenementsSeances,
  fichiers,
  rendus,
  seances,
  utilisateurs,
  estProjectionCopie,
  type CopieProjeteeDto,
  type CorrigeDevoir,
  type Devoir,
  type Fichier,
  type NonProjetableDto,
  type PageCopieDto,
  type PlanCopieDto,
  type ProjectionCopie,
  type ProjectionSeance,
  type RaisonCorrigeRetenu,
  type Rendu,
  type Seance,
  type Utilisateur,
} from "@shared/schema";

export { decouperTexte };

/** Au-delà, les pages suivantes ne se montrent pas en direct (« Seules les 30 premières pages… »). */
export const PAGES_MAX_PROJECTION = 30;
export const TEXTE_PAR_PAGE = 700;
export const MARKDOWN_PAR_PAGE = 900;
export const PART_ENTETE = PART_ENTETE_PAGES;
/** Clé de l'adresse de l'image projetée : 24 caractères hexadécimaux, neuve à chaque page ou haut caché. */
export const nouvelleCle = () => crypto.randomBytes(12).toString("hex");
/** Clé d'une page dans une copie (jamais envoyée à la classe). */
export const CLE_PAGE = /^(t\d{1,3}|f\d{1,9}(p\d{1,3})?|c\d{1,3})$/;

const canal = (seanceId: number) => `seance:${seanceId}`;

// ── Découpage ───────────────────────────────────────────────────────────────

/** Coupe aux titres puis aux paragraphes ; ne coupe pas un bloc de code ni un tableau s'il tient dans une page. */
export function decouperMarkdown(md: string, max = MARKDOWN_PAR_PAGE): string[] {
  const lignes = md.replace(/\r\n?/g, "\n").split("\n");
  // Blocs : paragraphes, titres, blocs de code (```), tableaux (lignes qui commencent par « | »).
  type Bloc = { texte: string; titre: boolean; entier: boolean };
  const blocs: Bloc[] = [];
  let courant: string[] = [];
  const fermer = (entier = false) => {
    const texte = courant.join("\n").trim();
    if (texte) blocs.push({ texte, titre: /^#{1,6}\s/.test(texte), entier });
    courant = [];
  };
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    if (/^\s*```/.test(l)) {
      fermer();
      courant.push(l);
      i++;
      while (i < lignes.length && !/^\s*```/.test(lignes[i])) courant.push(lignes[i++]);
      if (i < lignes.length) courant.push(lignes[i]);
      fermer(true);
      continue;
    }
    if (/^\s*\|/.test(l)) {
      if (courant.length && !/^\s*\|/.test(courant[courant.length - 1])) fermer();
      courant.push(l);
      if (!/^\s*\|/.test(lignes[i + 1] ?? "")) fermer(true);
      continue;
    }
    if (/^#{1,6}\s/.test(l)) {
      fermer();
      courant.push(l);
      fermer();
      continue;
    }
    if (!l.trim()) {
      fermer();
      continue;
    }
    courant.push(l);
  }
  fermer();
  const pages: string[] = [];
  let page = "";
  const pousser = () => {
    if (page.trim()) pages.push(page.trim());
    page = "";
  };
  for (const b of blocs) {
    // Un titre ouvre une nouvelle page quand la page en cours est déjà bien remplie.
    if (b.titre && page.length > max / 3) pousser();
    const ajout = page ? `${page}\n\n${b.texte}` : b.texte;
    if (ajout.length <= max) {
      page = ajout;
      continue;
    }
    pousser();
    if (b.texte.length <= max) {
      page = b.texte;
      continue;
    }
    // Bloc plus long qu'une page : un bloc de code ou un tableau se coupe aux lignes, un paragraphe aux phrases.
    const morceaux = b.entier ? couperAuxLignes(b.texte, max) : decouperTexte(b.texte, max);
    for (const m of morceaux.slice(0, -1)) pages.push(m);
    page = morceaux[morceaux.length - 1] ?? "";
  }
  pousser();
  return pages;
}

function couperAuxLignes(texte: string, max: number): string[] {
  const sortie: string[] = [];
  let page = "";
  for (const l of texte.split("\n")) {
    if (page && page.length + 1 + l.length > max) {
      sortie.push(page);
      page = "";
    }
    page = page ? `${page}\n${l}` : l.slice(0, max * 2);
  }
  if (page.trim()) sortie.push(page);
  return sortie;
}

// ── Étiquette ───────────────────────────────────────────────────────────────

/** « Copie d'un étudiant », « Copie d'Awa K. », « Copie de Konan Y. » (élision devant une voyelle ou un h). */
export function etiquetteCopie(nomVisible: boolean, prenom: string, nom: string): string {
  if (!nomVisible) return t("classe.anonyme");
  const p = prenom.trim();
  const premiere = p.normalize("NFD").charAt(0).toLowerCase();
  const de = /[aeiouyh]/.test(premiere) ? "d'" : "de ";
  const initiale = nom.trim() ? `${nom.trim().charAt(0).toUpperCase()}.` : "";
  return t("classe.nom", { v: { de, prenom: p, initiale } }).trim();
}

const nomCourt = (e: Pick<Utilisateur, "prenom" | "nom">) => `${e.prenom} ${e.nom.charAt(0).toUpperCase()}.`;

// ── Plan d'une copie ────────────────────────────────────────────────────────

const plansGardes = new Map<string, { exp: number; plan: PlanCopieDto }>();

/** Fichiers d'une copie, dans l'ordre de la copie (les fichiers disparus sont absents). */
export async function fichiersDeLaCopie(ids: number[]): Promise<Fichier[]> {
  if (!ids.length) return [];
  const liste = await db.select().from(fichiers).where(inArray(fichiers.id, ids));
  const parId = new Map(liste.map((f) => [f.id, f]));
  return ids.map((id) => parId.get(id)).filter((f): f is Fichier => Boolean(f));
}

/** Plan d'une copie : pages montrables, éléments non projetables. Gardé 2 min par `${r.id}@${renduLe}`, sauf s'il est en préparation. */
export async function planDeCopie(r: Pick<Rendu, "id" | "devoirId" | "texte" | "fichierIds" | "renduLe">, e: Pick<Utilisateur, "prenom" | "nom">): Promise<PlanCopieDto> {
  const version = r.renduLe ? r.renduLe.toISOString() : "0";
  const cle = `${r.id}@${version}`;
  const garde = plansGardes.get(cle);
  if (garde && garde.exp > Date.now()) return garde.plan;
  const pages: Omit<PageCopieDto, "numero">[] = [];
  const nonProjetables: NonProjetableDto[] = [];
  let enPreparation = false;
  const morceauxTexte = decouperTexte(r.texte, TEXTE_PAR_PAGE);
  morceauxTexte.forEach((_m, k) =>
    pages.push({
      page: `t${k + 1}`,
      libelle: morceauxTexte.length > 1 ? `Texte saisi, page ${k + 1} sur ${morceauxTexte.length}` : "Texte saisi",
      contenu: "texte",
      rotation: 0,
      enteteDisponible: false,
      enteteParDefaut: false,
    }),
  );
  const liste = await fichiersDeLaCopie(r.fichierIds);
  const presents = new Set(liste.map((f) => f.id));
  const compteurs = new Map<string, number>();
  const rang = (nom: string) => {
    const n = (compteurs.get(nom) ?? 0) + 1;
    compteurs.set(nom, n);
    return `${nom} ${n}`;
  };
  for (const id of r.fichierIds) {
    if (!presents.has(id)) nonProjetables.push({ libelle: rang("Fichier"), raison: "indisponible", fichierId: id });
  }
  const inventaires = await Promise.all(liste.map((f) => inventaireFichier(f).catch(() => ({ fichierId: f.id, nonProjetable: "erreur" as const }))));
  liste.forEach((f, k) => {
    const inv = inventaires[k];
    const genre = genreDe(f);
    const nomGenre =
      genre === "jpeg" || genre === "heic" ? "Photo" : genre === "image" ? "Image" : genre === "pdf" ? "PDF" : genre === "office" ? "Document" : genre === "texte" ? "Fichier texte" : genre === "video" ? "Vidéo" : genre === "audio" ? "Enregistrement audio" : "Fichier";
    const libelle = rang(nomGenre);
    if ("nonProjetable" in inv) {
      nonProjetables.push({ libelle, raison: inv.nonProjetable, fichierId: f.id });
      return;
    }
    if ("preparation" in inv) {
      enPreparation = true;
      return;
    }
    if (inv.genre === "texte") {
      inv.morceaux.forEach((_m, n) =>
        pages.push({
          page: `f${f.id}p${n + 1}`,
          libelle: inv.morceaux.length > 1 ? `${libelle}, page ${n + 1} sur ${inv.morceaux.length}` : libelle,
          contenu: "texte",
          rotation: 0,
          enteteDisponible: false,
          enteteParDefaut: false,
        }),
      );
      return;
    }
    if (!("rotation" in inv)) {
      for (let n = 1; n <= inv.pages; n++) {
        pages.push({
          page: `f${f.id}p${n}`,
          libelle: inv.pages > 1 ? `${libelle}, page ${n} sur ${inv.pages}` : libelle,
          contenu: "image",
          rotation: 0,
          enteteDisponible: inv.enteteDisponible,
          enteteParDefaut: inv.enteteDisponible && n === 1,
        });
      }
      return;
    }
    pages.push({ page: `f${f.id}`, libelle, contenu: "image", rotation: inv.rotation, enteteDisponible: inv.enteteDisponible, enteteParDefaut: inv.enteteDisponible });
  });
  const plan: PlanCopieDto = {
    source: "copie",
    renduId: r.id,
    devoirId: r.devoirId,
    version,
    nomCourt: nomCourt(e),
    pages: pages.slice(0, PAGES_MAX_PROJECTION).map((p, i) => ({ ...p, numero: i + 1 })),
    nonProjetables,
    pagesEnTrop: Math.max(0, pages.length - PAGES_MAX_PROJECTION),
    enPreparation,
  };
  if (!enPreparation) {
    if (plansGardes.size > 300) plansGardes.clear();
    plansGardes.set(cle, { exp: Date.now() + 2 * 60_000, plan });
  }
  return plan;
}

/** Plan du corrigé (Markdown découpé en pages). */
export function planDuCorrige(d: Pick<Devoir, "id">, cd: Pick<CorrigeDevoir, "contenu" | "version">): PlanCopieDto {
  const morceaux = decouperMarkdown(cd.contenu, MARKDOWN_PAR_PAGE);
  const pages: PageCopieDto[] = morceaux.slice(0, PAGES_MAX_PROJECTION).map((_m, k) => ({
    page: `c${k + 1}`,
    numero: k + 1,
    libelle: morceaux.length > 1 ? `Corrigé, page ${k + 1} sur ${morceaux.length}` : "Corrigé",
    contenu: "markdown",
    rotation: 0,
    enteteDisponible: false,
    enteteParDefaut: false,
  }));
  return {
    source: "corrige",
    renduId: null,
    devoirId: d.id,
    version: String(cd.version),
    nomCourt: null,
    pages,
    nonProjetables: [],
    pagesEnTrop: Math.max(0, morceaux.length - PAGES_MAX_PROJECTION),
    enPreparation: false,
  };
}

// ── Contenu d'une page (cache en mémoire, fabrications dédoublonnées) ───────

export type ContenuPage = ({ genre: "image" } & ImagePage) | { genre: "texte" | "markdown"; texte: string };
export type SourcePages =
  | { source: "copie"; renduId: number; version: string; texte: string; fichiers: Fichier[] }
  | { source: "corrige"; devoirId: number; version: string; contenu: string };

const CACHE_MAX_OCTETS = 40 * 1024 * 1024;
const CACHE_DUREE_MS = 3 * 3600_000;
/** Ordre d'insertion = ordre d'usage (une lecture remet l'entrée au bout) : la plus ancienne part la première. */
const cachePages = new Map<string, { le: number; taille: number; contenu: ContenuPage }>();
let octetsEnCache = 0;
const fabrications = new Map<string, Promise<ContenuPage>>();
/** Nombre de pages réellement fabriquées (essais : 300 demandes simultanées, une seule fabrication). */
export let pagesFabriquees = 0;

function lireCache(cle: string): ContenuPage | null {
  const e = cachePages.get(cle);
  if (!e) return null;
  cachePages.delete(cle);
  if (Date.now() - e.le > CACHE_DUREE_MS) {
    octetsEnCache -= e.taille;
    return null;
  }
  cachePages.set(cle, e);
  return e.contenu;
}

function ecrireCache(cle: string, contenu: ContenuPage) {
  const taille = contenu.genre === "image" ? contenu.octets.length : Buffer.byteLength(contenu.texte);
  const ancienne = cachePages.get(cle);
  if (ancienne) {
    octetsEnCache -= ancienne.taille;
    cachePages.delete(cle);
  }
  cachePages.set(cle, { le: Date.now(), taille, contenu });
  octetsEnCache += taille;
  for (const [k, e] of cachePages) {
    if (octetsEnCache <= CACHE_MAX_OCTETS) break;
    if (k === cle) continue;
    cachePages.delete(k);
    octetsEnCache -= e.taille;
  }
}

/** La page demandée, cherchée dans le plan (sinon null). */
export const pageDuPlan = (plan: PlanCopieDto, page: string) => plan.pages.find((p) => p.page === page) ?? null;

/**
 * Contenu d'une page du plan. Cache LRU en mémoire (40 Mo au plus, 3 h) ; fabrications en cours dédoublonnées :
 * 300 écrans qui demandent la même page en même temps ne lancent qu'une conversion.
 */
export async function contenuDePage(src: SourcePages, plan: PlanCopieDto, page: string, o: { enteteMasque: boolean }): Promise<ContenuPage> {
  const p = pageDuPlan(plan, page);
  if (!p) throw new Error("page absente du plan");
  const sansEntete = o.enteteMasque && p.enteteDisponible;
  const cle =
    src.source === "corrige" ? `d${src.devoirId}@${src.version}:${page}` : page.startsWith("t") ? `r${src.renduId}@${src.version}:${page}` : `${page}:e${sansEntete ? 1 : 0}`;
  const garde = lireCache(cle);
  if (garde) return garde;
  const enCours = fabrications.get(cle);
  if (enCours) return enCours;
  const fabrication = (async (): Promise<ContenuPage> => {
    pagesFabriquees++;
    const contenu = await fabriquer(src, page, sansEntete);
    ecrireCache(cle, contenu);
    return contenu;
  })().finally(() => fabrications.delete(cle));
  fabrications.set(cle, fabrication);
  return fabrication;
}

async function fabriquer(src: SourcePages, page: string, sansEntete: boolean): Promise<ContenuPage> {
  if (src.source === "corrige") {
    const n = Number(/^c(\d+)$/.exec(page)?.[1] ?? 0);
    const texte = decouperMarkdown(src.contenu, MARKDOWN_PAR_PAGE)[n - 1];
    if (texte === undefined) throw new Error("page du corrigé absente");
    return { genre: "markdown", texte };
  }
  const texteSaisi = /^t(\d+)$/.exec(page);
  if (texteSaisi) {
    const texte = decouperTexte(src.texte, TEXTE_PAR_PAGE)[Number(texteSaisi[1]) - 1];
    if (texte === undefined) throw new Error("page du texte absente");
    return { genre: "texte", texte };
  }
  const m = /^f(\d+)(?:p(\d+))?$/.exec(page);
  if (!m) throw new Error("page inconnue");
  const f = src.fichiers.find((x) => x.id === Number(m[1]));
  if (!f) throw new Error("fichier absent de la copie");
  const numero = m[2] ? Number(m[2]) : null;
  if (genreDe(f) === "texte") {
    const contenu = await lireContenuFichier(f);
    if (!contenu) throw new Error("fichier indisponible");
    const texte = decouperTexte(contenu.toString("utf8"), TEXTE_PAR_PAGE)[(numero ?? 1) - 1];
    if (texte === undefined) throw new Error("page du fichier texte absente");
    return { genre: "texte", texte };
  }
  return { genre: "image", ...(await imageDePage(f, numero, { sansEntete })) };
}

/** Fabrique en tâche de fond la page qui suit « numero » (sans attendre) : la page suivante s'affiche aussitôt. */
export function prechauffer(src: SourcePages, plan: PlanCopieDto, numero: number): void {
  const suivante = plan.pages[numero];
  if (!suivante) return;
  void contenuDePage(src, plan, suivante.page, { enteteMasque: suivante.enteteParDefaut }).catch(() => undefined);
}

/** Copie et fichiers d'une copie, prêts pour contenuDePage. */
export const sourceDeCopie = async (r: Pick<Rendu, "id" | "texte" | "fichierIds" | "renduLe">): Promise<SourcePages> => ({
  source: "copie",
  renduId: r.id,
  version: r.renduLe ? r.renduLe.toISOString() : "0",
  texte: r.texte,
  fichiers: await fichiersDeLaCopie(r.fichierIds),
});

/**
 * Source et plan de ce qui est projeté (relecture après un redémarrage du serveur, cache vide) ; null si la copie
 * ou le corrigé ont changé depuis (version différente) : la page n'est plus montrée.
 */
export async function sourceDeProjection(p: ProjectionCopie): Promise<{ src: SourcePages; plan: PlanCopieDto } | null> {
  if (p.source === "corrige") {
    const [cd] = await db.select().from(corrigesDevoirs).where(eq(corrigesDevoirs.devoirId, p.devoirId));
    if (!cd || String(cd.version) !== p.version) return null;
    return { src: { source: "corrige", devoirId: p.devoirId, version: p.version, contenu: cd.contenu }, plan: planDuCorrige({ id: p.devoirId }, cd) };
  }
  if (!p.renduId) return null;
  const [ligne] = await db
    .select({ r: rendus, e: { prenom: utilisateurs.prenom, nom: utilisateurs.nom } })
    .from(rendus)
    .innerJoin(utilisateurs, eq(utilisateurs.id, rendus.etudiantId))
    .where(eq(rendus.id, p.renduId));
  if (!ligne || ligne.r.statut === "brouillon" || (ligne.r.renduLe ? ligne.r.renduLe.toISOString() : "0") !== p.version) return null;
  return { src: await sourceDeCopie(ligne.r), plan: await planDeCopie(ligne.r, ligne.e) };
}

// Contenu de la page à l'écran, par clé : la classe le relit sans requête ni recherche dans le plan.
const parCle = new Map<string, { le: number; contenu: Promise<ContenuPage | null> }>();

/** Retient le contenu fabriqué pour cette clé (POST et PATCH, qui l'attendent avant de publier). */
export function retenirContenu(cle: string, contenu: ContenuPage) {
  if (parCle.size > 200) {
    const limite = Date.now() - CACHE_DUREE_MS;
    for (const [k, v] of parCle) if (v.le < limite || parCle.size > 200) parCle.delete(k);
  }
  parCle.set(cle, { le: Date.now(), contenu: Promise.resolve(contenu) });
}

/**
 * Contenu de la page projetée. Retenu à la projection ; après un redémarrage (mémoire vide), refabriqué depuis
 * l'état en base, une seule fois pour tous les écrans. null : la copie ou le corrigé ont changé depuis.
 */
export function contenuProjete(p: ProjectionCopie): Promise<ContenuPage | null> {
  const garde = parCle.get(p.cle);
  if (garde) return garde.contenu;
  const contenu = (async () => {
    const sp = await sourceDeProjection(p);
    if (!sp) return null;
    return contenuDePage(sp.src, sp.plan, p.page, { enteteMasque: p.enteteMasque });
  })().catch((e) => {
    // Échec : oublié, pour qu'une demande suivante réessaie.
    parCle.delete(p.cle);
    throw e;
  });
  parCle.set(p.cle, { le: Date.now(), contenu });
  return contenu;
}

// ── État diffusé ────────────────────────────────────────────────────────────

/** DTO public. PURE, sans requête : appelée par /direct et par la relecture /diapo (toutes les 2 s, des centaines d'écrans). */
export function copieDe(s: Pick<Seance, "id" | "projection" | "statut" | "planBLe">): CopieProjeteeDto | null {
  const p = s.projection;
  if (!estProjectionCopie(p) || s.statut !== "en_direct" || s.planBLe) return null;
  return {
    cle: p.cle,
    url: `/api/seances/${s.id}/projection/contenu/${p.cle}`,
    source: p.source,
    devoirId: p.devoirId,
    contenu: p.contenu,
    etiquette: p.etiquette,
    devoirTitre: p.devoirTitre,
    numero: p.numero,
    total: p.total,
    zone: p.zone,
    rotation: p.rotation,
    nomVisible: p.nomVisible,
    enteteMasque: p.enteteMasque,
    enteteDisponible: p.enteteDisponible,
    horodatage: p.horodatage,
  };
}

// ── Écritures ───────────────────────────────────────────────────────────────

const files = new Map<number, Promise<unknown>>();

/** File d'écriture par séance : POST et PATCH d'une même séance passent l'un après l'autre (ordre d'arrivée). */
export function enSerie<T>(seanceId: number, travail: () => Promise<T>): Promise<T> {
  const avant = files.get(seanceId) ?? Promise.resolve();
  const suite = avant.then(travail, travail);
  const garde = suite.catch(() => undefined);
  files.set(seanceId, garde);
  void garde.then(() => {
    if (files.get(seanceId) === garde) files.delete(seanceId);
  });
  return suite;
}

/**
 * Générations de la projection, par séance : chaque arrêt ou changement venu d'ailleurs (« Revenir aux diapos »,
 * vidéo, diapo) l'augmente. Une copie préparée pendant ce temps ne s'écrit pas, même si la projection était
 * vide avant et l'est encore (l'écriture conditionnelle seule ne verrait rien).
 */
const generations = new Map<number, number>();
export const generationDe = (seanceId: number) => generations.get(seanceId) ?? 0;
export function projectionChangee(seanceId: number) {
  generations.set(seanceId, generationDe(seanceId) + 1);
}

/**
 * Écrit la projection seulement si elle n'a pas changé depuis la lecture (« Revenir aux diapos », une vidéo ou un autre
 * poste sont passés entre-temps). null si elle a changé.
 */
export async function ecrireSiInchangee(seanceId: number, avant: ProjectionSeance | null, apres: ProjectionSeance | null, generation?: number): Promise<Seance | null> {
  if (generation !== undefined && generation !== generationDe(seanceId)) return null;
  const [maj] = await db
    .update(seances)
    .set({ projection: apres })
    .where(and(eq(seances.id, seanceId), sql`${seances.projection} IS NOT DISTINCT FROM ${avant === null ? null : JSON.stringify(avant)}::jsonb`))
    .returning();
  if (!maj) return null;
  // Un arrêt est passé entre la vérification et l'écriture : la page écrite est retirée aussitôt (l'arrêt l'emporte).
  if (generation !== undefined && generation !== generationDe(seanceId)) {
    await db
      .update(seances)
      .set({ projection: null })
      .where(and(eq(seances.id, seanceId), sql`${seances.projection} IS NOT DISTINCT FROM ${JSON.stringify(apres)}::jsonb`));
    return null;
  }
  return maj;
}

type MotifFin = "diapos" | "video" | "fin" | "plan_b" | "annulation" | "remplacee" | "partage";

/** Après qu'une copie a quitté l'écran (déjà écrit en base) : publie « copie » null et consigne « copie_fin ». */
export async function finDeCopie(seanceId: number, ancienne: ProjectionCopie, motif: MotifFin): Promise<void> {
  publier(canal(seanceId), "copie", null);
  if (motif === "remplacee") publier(canal(seanceId), "copie:arretee", { motif });
  await db.insert(evenementsSeances).values({
    seanceId,
    type: "copie_fin",
    donnees: { motif, secondes: Math.max(0, Math.round((Date.now() - ancienne.depuis) / 1000)), devoirId: ancienne.devoirId, source: ancienne.source, devoirTitre: ancienne.devoirTitre },
  });
}

/** Arrête la copie projetée d'une séance (rien si ce n'est pas une copie). Écriture conditionnelle sur l'état lu. */
export async function arreterCopie(seanceId: number, motif: MotifFin): Promise<boolean> {
  projectionChangee(seanceId);
  for (let essai = 0; essai < 3; essai++) {
    const [s] = await db.select({ projection: seances.projection }).from(seances).where(eq(seances.id, seanceId));
    const p = s?.projection ?? null;
    if (!estProjectionCopie(p)) return false;
    if (await ecrireSiInchangee(seanceId, p, null)) {
      await finDeCopie(seanceId, p, motif);
      return true;
    }
  }
  return false;
}

/** L'étudiant a remplacé sa copie : arrête partout la projection de l'ancienne, et prévient les Studios (« copie:arretee »). */
export async function arreterCopieDuRendu(renduId: number): Promise<void> {
  const lignes = await db
    .select({ id: seances.id })
    .from(seances)
    .where(and(sql`${seances.projection}->>'genre' = 'copie'`, sql`(${seances.projection}->>'renduId')::int = ${renduId}`));
  for (const l of lignes) await arreterCopie(l.id, "remplacee");
}

// ── Corrigé (lot 5) ─────────────────────────────────────────────────────────

/**
 * Règle D-D appliquée à toute la classe : le corrigé se montre une fois la date limite passée, les retards
 * refusés, le corrigé validé (ou tenu pour bon) et toutes les notes publiées.
 */
export function corrigeMontrableEnClasse(
  d: Pick<Devoir, "type" | "publie" | "accepteRetard" | "dateLimite">,
  cd: Pick<CorrigeDevoir, "statut" | "contenu"> | null | undefined,
  copiesAPublier: number,
  maintenant = new Date(),
): { montrable: true } | { montrable: false; raison: RaisonCorrigeRetenu; n?: number } {
  if (!cd || !cd.contenu.trim()) return { montrable: false, raison: "absent" };
  if (!corrigeUtilisableLigne(cd)) return { montrable: false, raison: "non_valide" };
  if (maintenant.getTime() <= echeance(d).getTime()) return { montrable: false, raison: "avant_limite" };
  if (d.accepteRetard) return { montrable: false, raison: "retards" };
  if (copiesAPublier > 0) return { montrable: false, raison: "notes", n: copiesAPublier };
  return { montrable: true };
}

/** Copies du devoir encore au statut « rendu » (tous sites confondus) : notes à poser ou à publier. */
export async function copiesAPublier(devoirId: number): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(rendus)
    .where(and(eq(rendus.devoirId, devoirId), eq(rendus.statut, "rendu")));
  return n;
}

/** Corrigé d'un devoir (ligne), ou null. */
export async function corrigeDuDevoir(devoirId: number): Promise<CorrigeDevoir | null> {
  const [cd] = await db.select().from(corrigesDevoirs).where(eq(corrigesDevoirs.devoirId, devoirId));
  return cd ?? null;
}

/** Devoirs publiés d'un cours (liste du Studio). */
export const devoirsPubliesDuCours = (coursId: number) =>
  db.select().from(devoirs).where(and(eq(devoirs.coursId, coursId), eq(devoirs.publie, true))).orderBy(asc(devoirs.dateLimite));

/** Copies non brouillon de plusieurs devoirs. */
export const copiesDesDevoirs = (ids: number[]) =>
  ids.length ? db.select().from(rendus).where(and(inArray(rendus.devoirId, ids), ne(rendus.statut, "brouillon"))) : Promise.resolve([] as Rendu[]);

