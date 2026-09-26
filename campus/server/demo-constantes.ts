// Repères de la démonstration, sans ses données : le serveur (page Rentrée,
// purge depuis le pilotage) les lit sans embarquer server/demo.ts, qui pèse
// plusieurs centaines de kilo-octets.
import crypto from "crypto";

/** Domaine des adresses de démonstration (jamais une vraie boîte). */
export const DOMAINE_DEMO = "demo.2iae.com";
/**
 * Adresse du domaine de démonstration ? Ces adresses sont réservées au semis :
 * aucune saisie (profil, première connexion, création, modification ou import
 * de compte) ne les accepte. Un compte de démonstration se reconnaît à son
 * marqueur preferences.demo (posé par le semis, impossible à poser soi-même),
 * JAMAIS à son adresse : sinon n'importe qui ferait supprimer un compte réel
 * par la purge en changeant son e-mail.
 */
export function adresseDeDemonstration(email: string | null | undefined): boolean {
  return Boolean(email) && email!.trim().toLowerCase().endsWith(`@${DOMAINE_DEMO}`);
}
/** Message de refus d'une adresse du domaine de démonstration (vouvoiement). */
export const ADRESSE_DEMO_REFUSEE = `Les adresses @${DOMAINE_DEMO} sont réservées à la démonstration du campus : indiquez une vraie adresse e-mail.`;
/** Action du journal qui garde la trace du semis : date, classes, cours et contenus créés (la purge ne retire que ceux-là). */
export const ACTION_JOURNAL_DEMO = "demo_semee";
/** Action du journal écrite par la purge (bilan chiffré) : en production, la démonstration ne revient plus ensuite. */
export const ACTION_JOURNAL_PURGE = "demo_purgee";
/** Codes des cours de démonstration (la purge ne supprime que ceux-là, et seulement s'ils sont tenus par un formateur de démonstration). */
export const CODES_COURS_DEMO = ["IA-101", "ENT-210", "INF-230", "GES-120", "AGR-110"] as const;
/** Clé du verrou consultatif PostgreSQL partagé par le semis et la purge. */
export const VERROU_SEMIS = 2_026_101;

/**
 * Empreinte de la présentation d'un cours (description, objectifs, accroche du site), notée au registre du
 * semis : la purge sait ainsi si la présentation d'un cours de démonstration repris est encore celle de la
 * démonstration (effacée) ou si quelqu'un l'a réécrite depuis (gardée).
 */
export function empreintePresentation(c: { description: string | null; objectifs: string | null; accroche: string | null }): string {
  return crypto
    .createHash("sha256")
    .update([c.description ?? "", c.objectifs ?? "", c.accroche ?? ""].join("\u001f"))
    .digest("hex")
    .slice(0, 32);
}
