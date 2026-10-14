// Ouverture automatique des classes (demande de José du 14 octobre 2026 : « Par défaut ouvre automatiquement
// tous les cours 30 mn avant »). Couche commune au serveur et au client, sans dépendance.
//
// Chaque séance prévue passe d'elle-même « en direct » N minutes avant son heure (30 par défaut ; la direction
// coupe ou choisit 15, 30, 45 ou 60 min dans « Pilotage · visio ») : les écrans des cinq salles quittent la salle
// d'attente et règlent le son et l'image, les étudiants peuvent entrer, et le formateur qui arrive trouve sa
// classe déjà ouverte. La tâche est dans server/routes/live.ts (« live-ouverture-auto »), le réglage dans
// server/ouverture-auto.ts (contenus_site, clé « pilotage.ouverture-auto », jamais servie au site public).
//
// Une classe ouverte automatiquement n'avance pas le cours. La séance garde trois choses (migration 0036) :
//   - ouverture_auto : ce démarrage est l'ouverture automatique (un « Démarrer » à la main ne l'est jamais) ;
//   - debut_cours : le début du cours quand il n'est pas le démarrage. Ouverte avant l'heure, c'est l'heure
//     PRÉVUE ; l'animateur peut commencer plus tôt (« Commencer le cours maintenant » dans le Studio : l'instant
//     du clic) ; s'il arrive après l'heure, le cours commence à son arrivée (comme un « Démarrer » en retard) ;
//   - animateur_le : l'arrivée du premier animateur (formateur du cours qui ouvre son Studio ou entre dans la
//     visio ; personne entrée dans la visio par le lien intervenant de la séance, ou qui y fait défiler les diapos ;
//     direction, vie scolaire ou chargé de cours seulement sur une action explicite : « Je prends la classe »,
//     « Commencer le cours maintenant », diapo, parole, sondage, vidéo ou copie projetée ; regarder le Studio ou
//     l'écran d'une salle ne compte pas).
//
// L'ouverture automatique ne ferme jamais un cours ; elle ne regarde plus l'occupation des salles depuis le 15 octobre
// 2026 (une classe oubliée retenait la salle) : la fermeture logique ferme une classe dont la fin prévue est passée et
// où il reste au plus une personne depuis 10 min (server/routes/live.ts, fermerLesClassesVides). Le compte de campus
// qui appuie sur « Ouvrir le cours » (dès 1 h avant) fait comme l'ouverture automatique. La régie de l'équipe (chargé de cours, vie scolaire) qui ouvre la classe avant l'heure fait comme l'ouverture
// automatique pour le début du cours (debut_cours = l'heure prévue), sans attendre d'animateur : elle est là.
// Tout ce qui se compte depuis le début du cours (retards, minutes de présence, seuil des 70 %, fin du cours,
// échéance « fin du cours » d'un devoir, chrono du Studio, moments de l'émargement, transcription du replay,
// enregistrement) part de debutDuCours(). Un « Démarrer » à la main, même 20 minutes avant l'heure, garde le
// démarrage réel comme début du cours, comme avant l'ouverture automatique : le formateur a commencé.

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
 * La plus grande avance permise à l'ouverture automatique (60 min). Une séance démarrée plus tôt que cela avant son
 * heure l'a été pour un autre créneau (séance d'une autre semaine ouverte par erreur : séance #26, chantier C8).
 */
export const AVANCE_MAX_OUVERTURE_MIN = 60;

const temps = (d: Date | string) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

/**
 * Ce qu'il faut savoir d'une séance pour dater le début de son cours. debutCours est obligatoire (même null) :
 * l'oublier ferait commencer une classe ouverte en avance à son ouverture.
 */
export type DatesSeance = { debut: Date | string; demarreeLe?: Date | string | null; debutCours: Date | string | null | undefined };

/**
 * Début du cours, pour tout ce qui se compte depuis lui : debut_cours quand il est posé (classe ouverte
 * automatiquement : l'heure prévue, ou l'instant où l'animateur a commencé) ; sinon le démarrage réel ; sinon
 * l'heure prévue. Même règle en SQL : sqlDebutCours (server/ouverture-auto.ts).
 */
export function debutDuCours(s: DatesSeance): Date {
  if (s.debutCours) return new Date(temps(s.debutCours));
  return new Date(temps(s.demarreeLe ?? s.debut));
}

/** La classe est ouverte mais le cours n'a pas encore commencé (« les salles s'installent »). */
export function classeOuverteEnAvance(s: DatesSeance & { statut: string }, maintenant: number): boolean {
  return s.statut === "en_direct" && Boolean(s.demarreeLe) && debutDuCours(s).getTime() > maintenant;
}

/**
 * Classe ouverte automatiquement où aucun animateur n'est encore entré : avant l'heure, « les salles s'installent » ;
 * après, « en attente du formateur » (ni chrono ni enregistrement), et sans arrivée elle finit « Séance non tenue ».
 */
export function enAttenteAnimateur(s: { statut: string; ouvertureAuto: boolean; animateurLe: Date | string | null }): boolean {
  return s.statut === "en_direct" && s.ouvertureAuto && !s.animateurLe;
}

/** Réglage lu en base, ramené à une valeur permise (une valeur inconnue retombe sur le défaut). */
export function reglageOuvertureValide(brut: unknown): ReglageOuvertureAuto {
  const v = brut && typeof brut === "object" ? (brut as Partial<Record<keyof ReglageOuvertureAuto, unknown>>) : {};
  const minutes = DELAIS_OUVERTURE_AUTO.find((m) => m === v.minutes) ?? OUVERTURE_AUTO_PAR_DEFAUT.minutes;
  return { actif: typeof v.actif === "boolean" ? v.actif : OUVERTURE_AUTO_PAR_DEFAUT.actif, minutes };
}
