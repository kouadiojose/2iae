// Petits outils du module évaluations : échéances dites avec des mots,
// statuts, notes à la française, brouillons gardés sur le téléphone.
import type { StatutDevoirEtudiant, TypeQuestion } from "@shared/schema";
import { heure, jourLong, dateCourte } from "@/lib/dates";

const JOUR = 86_400_000;

/** Numéro du jour à Abidjan (GMT) : sert à dire « aujourd'hui », « demain ». */
const jourAbidjan = (t: number) => Math.floor(t / JOUR);

export type Urgence = "depassee" | "aujourdhui" | "demain" | "semaine" | "plus_tard";

/**
 * L'échéance avec des mots, pas seulement une couleur (écrans bas de gamme,
 * daltonisme) : « Aujourd'hui avant 23h59 », « Demain avant 10h00 »,
 * « Dans 3 jours · jeudi », « Avant le 12 oct. ».
 */
export function echeanceEnMots(dateLimite: string, maintenant: number): { texte: string; urgence: Urgence } {
  const t = new Date(dateLimite).getTime();
  const h = heure(dateLimite);
  if (t < maintenant) return { texte: `Date dépassée (${dateCourte(dateLimite)} · ${h})`, urgence: "depassee" };
  const ecart = jourAbidjan(t) - jourAbidjan(maintenant);
  if (ecart === 0) return { texte: `Aujourd'hui avant ${h}`, urgence: "aujourdhui" };
  if (ecart === 1) return { texte: `Demain avant ${h}`, urgence: "demain" };
  if (ecart < 7) return { texte: `Dans ${ecart} jours · ${jourLong(dateLimite).split(" ")[0]} ${h}`, urgence: "semaine" };
  return { texte: `Avant le ${dateCourte(dateLimite)} · ${h}`, urgence: "plus_tard" };
}

/** « dimanche 27 septembre à 23h59 » (heure d'Abidjan). */
export const dateEtHeureCourte = (x: string) => `${jourLong(x)} à ${heure(x)}`;

/** La copie a attendu le réseau sur le téléphone (plus de 2 minutes entre sa préparation et son arrivée). */
export const envoyeeEnDiffere = (prepareLe: string | null, renduLe: string | null) =>
  Boolean(prepareLe && renduLe && new Date(renduLe).getTime() - new Date(prepareLe).getTime() > 2 * 60_000);

export const LIBELLES_STATUT: Record<StatutDevoirEtudiant, string> = {
  a_rendre: "À rendre",
  en_retard: "En retard",
  manque: "Non rendu",
  en_cours: "Commencée",
  rendu: "Envoyé",
  vu: "Vu par ton formateur",
  corrige: "Corrigé",
};

export const LIBELLES_QUESTION: Record<TypeQuestion, string> = {
  qcm: "QCM (une réponse)",
  choix_multiple: "Choix multiple",
  vrai_faux: "Vrai ou faux",
  reponse_courte: "Réponse courte",
};

/** Note à la française : 16.5 → « 16,5 ». */
export function nombre(n: number | null | undefined, decimales = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return String(Math.round(n * 10 ** decimales) / 10 ** decimales).replace(".", ",");
}

/** « 16,5/20 » */
export const noteSur = (n: number | null | undefined, bareme: number) => `${nombre(n)}/${nombre(bareme)}`;

export const LETTRES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

/** Lien « Écrire au formateur » avec le devoir en contexte (module messages). */
export function lienEcrireAuFormateur(formateurId: number | null | undefined, titre: string) {
  // /messages/nouveau ouvre (ou crée) la conversation directe, le devoir en contexte ;
  // sans formateur connu, il propose le choix du contact.
  const params = new URLSearchParams({ contexte: `À propos du devoir : ${titre}`.slice(0, 200) });
  if (formateurId) params.set("a", String(formateurId));
  return `/messages/nouveau?${params.toString()}`;
}

// ── Brouillons gardés sur le téléphone ─────────────────────────────────────
// Le texte vit dans localStorage (léger, synchrone) ; les photos et fichiers,
// trop lourds pour lui, dans IndexedDB. Sur un Android d'entrée de gamme,
// ouvrir l'appareil photo tue souvent l'onglet : les pages déjà prises
// doivent survivre au rechargement.

const cleTexte = (utilisateurId: number, devoirId: number) => `campus:brouillon-devoir:${utilisateurId}:${devoirId}`;

export function lireTexteBrouillon(utilisateurId: number, devoirId: number): string {
  try {
    return localStorage.getItem(cleTexte(utilisateurId, devoirId)) ?? "";
  } catch {
    return "";
  }
}

export function ecrireTexteBrouillon(utilisateurId: number, devoirId: number, texte: string) {
  try {
    if (texte) localStorage.setItem(cleTexte(utilisateurId, devoirId), texte);
    else localStorage.removeItem(cleTexte(utilisateurId, devoirId));
  } catch {
    /* stockage plein ou interdit : le texte reste à l'écran */
  }
}

export type PageBrouillon = { id: string; nom: string; type: string; blob: Blob };

const BASE = "campus-2iae-evaluations";
const MAGASIN = "pages";

function ouvrirBase(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

const clePages = (utilisateurId: number, devoirId: number) => `${utilisateurId}:${devoirId}`;

export async function lirePagesBrouillon(utilisateurId: number, devoirId: number): Promise<PageBrouillon[]> {
  try {
    const db = await ouvrirBase();
    return await new Promise((ok) => {
      const r = db.transaction(MAGASIN, "readonly").objectStore(MAGASIN).get(clePages(utilisateurId, devoirId));
      r.onsuccess = () => ok((r.result as PageBrouillon[] | undefined) ?? []);
      r.onerror = () => ok([]);
    });
  } catch {
    return [];
  }
}

export async function ecrirePagesBrouillon(utilisateurId: number, devoirId: number, pages: PageBrouillon[]) {
  try {
    const db = await ouvrirBase();
    await new Promise<void>((ok) => {
      const s = db.transaction(MAGASIN, "readwrite").objectStore(MAGASIN);
      const r = pages.length ? s.put(pages, clePages(utilisateurId, devoirId)) : s.delete(clePages(utilisateurId, devoirId));
      r.onsuccess = () => ok();
      r.onerror = () => ok();
    });
  } catch {
    /* navigation privée : les pages restent en mémoire */
  }
}

export function effacerBrouillon(utilisateurId: number, devoirId: number) {
  ecrireTexteBrouillon(utilisateurId, devoirId, "");
  void ecrirePagesBrouillon(utilisateurId, devoirId, []);
}

// ── Brouillon d'une copie partie dans la file d'envoi ──────────────────────
// Hors ligne, la copie attend dans la file d'envoi (lib/file-envoi) : son
// brouillon reste sur le téléphone jusqu'au reçu, pour ne rien perdre si
// l'envoi est finalement refusé (date limite passée entre-temps, copie déjà
// corrigée…). Le lien « clé d'envoi → brouillon » est gardé dans
// localStorage, il survit à la fermeture du campus ; l'écoute, branchée dès
// le démarrage (routes.tsx), efface le brouillon quand « campus:envoi-reussi »
// arrive pour cette clé, et l'oublie (brouillon gardé) sur « campus:envoi-refuse ».

const CLE_ENVOIS = "campus:brouillons-en-envoi";
type BrouillonEnEnvoi = { utilisateurId: number; devoirId: number };

function lireEnvois(): Record<string, BrouillonEnEnvoi> {
  try {
    return JSON.parse(localStorage.getItem(CLE_ENVOIS) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function ecrireEnvois(envois: Record<string, BrouillonEnEnvoi>) {
  try {
    if (Object.keys(envois).length) localStorage.setItem(CLE_ENVOIS, JSON.stringify(envois));
    else localStorage.removeItem(CLE_ENVOIS);
  } catch {
    /* stockage indisponible : le brouillon reste simplement sur le téléphone */
  }
}

/** Le brouillon de ce devoir sera effacé à l'arrivée du reçu de l'envoi « cle » (et gardé s'il est refusé). */
export function effacerBrouillonAuRecu(cle: string, utilisateurId: number, devoirId: number) {
  ecrireEnvois({ ...lireEnvois(), [cle]: { utilisateurId, devoirId } });
}

/** Oublie le lien d'un envoi (parti tout de suite, ou refusé) : le brouillon n'est plus effacé par lui. */
export function oublierEnvoi(cle: string) {
  const envois = lireEnvois();
  if (!envois[cle]) return;
  delete envois[cle];
  ecrireEnvois(envois);
}

let envoisSuivis = false;

/** Branche une fois pour toutes l'écoute des envois de copies (appelée au démarrage du campus). */
export function suivreEnvoisDeCopies() {
  if (envoisSuivis || typeof window === "undefined") return;
  envoisSuivis = true;
  const cleDe = (e: Event) => (e as CustomEvent<{ cle?: string }>).detail?.cle;
  window.addEventListener("campus:envoi-reussi", (e) => {
    const cle = cleDe(e);
    const envoi = cle ? lireEnvois()[cle] : undefined;
    if (!cle || !envoi) return;
    effacerBrouillon(envoi.utilisateurId, envoi.devoirId);
    oublierEnvoi(cle);
  });
  window.addEventListener("campus:envoi-refuse", (e) => {
    const cle = cleDe(e);
    if (cle) oublierEnvoi(cle);
  });
}
