// Ce que ce téléphone retient des rappels (stockage local protégé : navigation
// privée, stockage plein… ; rien d'indispensable n'y vit, le campus garde la
// vérité dans abonnements_push).
import { lireLocal, ecrireLocal } from "@/modules/pwa/outils";
import { MARQUES, PLUS_TARD_JOURS, type Marque } from "@shared/engagement/envois";

const CLES = {
  /** Ce téléphone a déjà reçu des rappels : s'ils disparaissent, c'est une perte (« ne marchent plus »), pas un oubli. */
  actives: "campus:rappels:actives",
  /** Marque choisie d'un toucher dans le guide (jamais lue sur le téléphone). */
  marque: "campus:rappels:marque",
  /** Heure du dernier essai demandé : au retour, « As-tu reçu l'essai ? » plutôt qu'un nouvel essai. */
  essai: "campus:rappels:essai",
  /** « Plus tard » : carte de l'accueil, ou proposition au bon moment, masquée jusqu'à cette date. */
  plusTard: "campus:rappels:plus-tard",
  plusTardProposer: "campus:rappels:proposer-plus-tard",
} as const;

export const rappelsDejaActives = () => lireLocal(CLES.actives) === "1";
export const noterRappelsActives = (oui: boolean) => ecrireLocal(CLES.actives, oui ? "1" : null);

export function marqueRetenue(): Marque | undefined {
  const m = lireLocal(CLES.marque);
  return (MARQUES as readonly string[]).includes(m ?? "") ? (m as Marque) : undefined;
}
export const retenirMarque = (m: Marque) => ecrireLocal(CLES.marque, m);

/** Un essai demandé il y a moins de 20 h attend encore sa réponse (celui de la nuit part à 6 h). */
export function essaiEnAttente(maintenant = Date.now()): boolean {
  const le = Number(lireLocal(CLES.essai) || 0);
  return le > 0 && maintenant - le < 20 * 60 * 60_000;
}
export const noterEssai = (le: number | null = Date.now()) => ecrireLocal(CLES.essai, le === null ? null : String(le));

/** « Plus tard » : masquée une semaine. */
export function masqueePlusTard(ou: "carte" | "proposer", maintenant = Date.now()): boolean {
  return Number(lireLocal(ou === "carte" ? CLES.plusTard : CLES.plusTardProposer) || 0) > maintenant;
}
export function plusTard(ou: "carte" | "proposer", maintenant = Date.now()) {
  ecrireLocal(ou === "carte" ? CLES.plusTard : CLES.plusTardProposer, String(maintenant + PLUS_TARD_JOURS * 86_400_000));
}
