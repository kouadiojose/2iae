// Ouverture automatique des classes (demande de José du 14 octobre 2026 : « Par défaut ouvre automatiquement
// tous les cours 30 mn avant »). Couche commune au serveur et au client, sans dépendance.
//
// Chaque séance prévue passe d'elle-même « en direct » N minutes avant son heure (30 par défaut ; la direction
// coupe ou choisit 15, 30, 45 ou 60 min dans « Pilotage · visio ») : les écrans des cinq salles quittent la salle
// d'attente et règlent le son et l'image, les étudiants peuvent entrer, et le formateur qui arrive trouve sa
// classe déjà ouverte. La tâche est dans server/routes/live.ts (« live-ouverture-auto »), le réglage dans
// server/ouverture-auto.ts (contenus_site, clé « pilotage.ouverture-auto », jamais servie au site public).
//
// Une classe ouverte en avance n'avance pas le cours : tout ce qui se compte depuis le début du cours (retards,
// minutes de présence, seuil des 70 %, fin du cours, échéance « fin du cours » d'un devoir, chrono du Studio,
// moments de l'émargement, transcription du replay, enregistrement) part de debutDuCours(), c'est-à-dire de
// l'heure PRÉVUE quand la classe a été ouverte au plus une heure avant elle, et du démarrage réel sinon (cours
// commencé en retard, ou séance d'une autre semaine lancée par erreur : le cas de la séance #26, chantier C8).

/** Clé du réglage dans contenus_site (les clés « pilotage.* » ne sont jamais servies au site public). */
export const CLE_OUVERTURE_AUTO = "pilotage.ouverture-auto";

/** Avances proposées à la direction, en minutes. */
export const DELAIS_OUVERTURE_AUTO = [15, 30, 45, 60] as const;
export type DelaiOuvertureAuto = (typeof DELAIS_OUVERTURE_AUTO)[number];

export type ReglageOuvertureAuto = { actif: boolean; minutes: DelaiOuvertureAuto };

/** Par défaut : actif, 30 minutes avant (rien n'est écrit en base tant que la direction n'a rien changé). */
export const OUVERTURE_AUTO_PAR_DEFAUT: ReglageOuvertureAuto = { actif: true, minutes: 30 };

/** GET /api/visio/ouverture-auto : le réglage, la date de sa dernière modification (null : jamais réglé, défaut). */
export type ReglageOuvertureAutoDto = ReglageOuvertureAuto & { majLe: string | null };

/**
 * Une séance démarrée au plus 60 minutes avant son heure l'a été pour CE créneau : le cours commence à l'heure
 * prévue. Au-delà, c'est un autre créneau (séance d'une autre semaine ouverte par erreur) : le démarrage réel fait
 * foi. Aussi la plus grande avance permise à l'ouverture automatique.
 */
export const AVANCE_MAX_OUVERTURE_MIN = 60;
const AVANCE_MAX_MS = AVANCE_MAX_OUVERTURE_MIN * 60_000;

const temps = (d: Date | string) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

/**
 * Début du cours, pour tout ce qui se compte depuis lui : l'heure prévue si la séance a été ouverte (à la main ou
 * automatiquement) au plus une heure avant elle ; sinon le démarrage réel ; sinon l'heure prévue. Même règle en
 * SQL : sqlDebutCours (server/ouverture-auto.ts).
 */
export function debutDuCours(s: { debut: Date | string; demarreeLe?: Date | string | null }): Date {
  const debut = temps(s.debut);
  if (!s.demarreeLe) return new Date(debut);
  const demarree = temps(s.demarreeLe);
  return new Date(demarree < debut && debut - demarree <= AVANCE_MAX_MS ? debut : demarree);
}

/** La classe est ouverte mais le cours n'a pas encore commencé (« les salles s'installent »). */
export function classeOuverteEnAvance(s: { statut: string; debut: Date | string; demarreeLe?: Date | string | null }, maintenant: number): boolean {
  return s.statut === "en_direct" && Boolean(s.demarreeLe) && debutDuCours(s).getTime() > maintenant;
}

/** Réglage lu en base, ramené à une valeur permise (une valeur inconnue retombe sur le défaut). */
export function reglageOuvertureValide(brut: unknown): ReglageOuvertureAuto {
  const v = brut && typeof brut === "object" ? (brut as Partial<Record<keyof ReglageOuvertureAuto, unknown>>) : {};
  const minutes = DELAIS_OUVERTURE_AUTO.find((m) => m === v.minutes) ?? OUVERTURE_AUTO_PAR_DEFAUT.minutes;
  return { actif: typeof v.actif === "boolean" ? v.actif : OUVERTURE_AUTO_PAR_DEFAUT.actif, minutes };
}
