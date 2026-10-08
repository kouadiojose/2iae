// Tirage témoin du rappel d'entraînement (envoyé par C4, mesuré par C8).
//
// Pendant DUREE_EXPERIENCE_JOURS jours à partir de DEBUT_EXPERIENCE, un jour
// sur cinq, tiré au sort pour chaque étudiant, n'a PAS de rappel
// d'entraînement : comparer ces jours aux autres mesure l'effet du rappel (part
// des jours suivis d'une action d'apprentissage dans les 24 h). Le tirage est
// un hachage stable de (étudiant, jour) : même réponse à chaque appel et après
// un redémarrage, recalculable après coup par le tableau de pilotage.
// Hors de la fenêtre, ou tant que DEBUT_EXPERIENCE est nul, le rappel est
// toujours autorisé.
//
// Ce tirage ne vaut QUE pour le rappel d'entraînement : jamais pour une
// échéance, un live ni la relance d'un décrocheur. C4 est le seul à régler
// DEBUT_EXPERIENCE (jour de la mise en ligne prévue) ; personne d'autre ne
// modifie ce fichier.
import { createHash } from "node:crypto";
import { ecartJours, type Jour } from "@shared/engagement/calendrier";

/**
 * Premier jour de l'expérience (« AAAA-MM-JJ », heure d'Abidjan) ; null : aucune expérience en cours.
 * Réglé par C4 sur le lundi de la mise en ligne prévue (vague 3). Si le rappel d'entraînement passe
 * « actif » plus tard, reporter ce jour à celui de son activation : les 28 jours doivent être des jours d'envoi réel.
 */
export const DEBUT_EXPERIENCE: Jour | null = "2026-10-19";
export const DUREE_EXPERIENCE_JOURS = 28;
/** Un jour sur PART_TEMOIN est un jour témoin, sans rappel d'entraînement. */
export const PART_TEMOIN = 5;

/** Ce jour est-il un jour témoin pour cet étudiant ? (le tirage seul, sans la fenêtre de l'expérience) */
export function estJourTemoin(utilisateurId: number, jour: Jour): boolean {
  const empreinte = createHash("sha256").update(`rappel-entrainement|${utilisateurId}|${jour}`).digest();
  return empreinte.readUInt32BE(0) % PART_TEMOIN === 0;
}

/**
 * Le rappel d'entraînement peut-il partir ce jour-là pour cet étudiant ?
 * « debut » ne sert qu'aux essais : en service, c'est DEBUT_EXPERIENCE.
 */
export function rappelEntrainementAutorise(utilisateurId: number, jour: Jour, debut: Jour | null = DEBUT_EXPERIENCE): boolean {
  if (!debut) return true;
  const rang = ecartJours(debut, jour);
  if (rang < 0 || rang >= DUREE_EXPERIENCE_JOURS) return true;
  return !estJourTemoin(utilisateurId, jour);
}
