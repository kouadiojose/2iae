// Repères de la démonstration, sans ses données : le serveur (page Rentrée,
// purge depuis le pilotage) les lit sans embarquer server/demo.ts, qui pèse
// plusieurs centaines de kilo-octets.

/** Domaine des adresses de démonstration (jamais une vraie boîte). */
export const DOMAINE_DEMO = "demo.2iae.com";
/** Action du journal qui garde la trace du semis (classes créées, date). */
export const ACTION_JOURNAL_DEMO = "demo_semee";
/** Action du journal écrite par la purge (bilan chiffré) : en production, la démonstration ne revient plus ensuite. */
export const ACTION_JOURNAL_PURGE = "demo_purgee";
/** Codes des cours de démonstration (la purge ne supprime que ceux-là, et seulement s'ils sont tenus par un formateur de démonstration). */
export const CODES_COURS_DEMO = ["IA-101", "ENT-210", "INF-230", "GES-120", "AGR-110"] as const;
/** Clé du verrou consultatif PostgreSQL partagé par le semis et la purge. */
export const VERROU_SEMIS = 2_026_101;
