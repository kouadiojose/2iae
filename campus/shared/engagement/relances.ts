// Rappel d'entraînement du jour, e-mail « Ta semaine » et relances des
// décrocheurs (chantier C4) : vocabulaire, règles de rythme et décisions, en
// fonctions pures (serveur, client et essais ; aucune dépendance hors du
// calendrier commun). Le serveur rassemble les faits (server/engagement/*),
// ces fonctions décident ; elles s'essaient sur des cas datés sans base.
//
// Principes (plan d'engagement, amendement de José du 8 octobre 2026) :
// - au plus un rappel d'entraînement par jour, à l'heure de l'étudiant, jamais
//   après 20 h 30 ni pendant les heures calmes (21 h à 6 h, heure locale) ;
// - pas de rappel s'il a déjà travaillé ce jour-là ni pendant un direct de ses cours ;
// - après 5 rappels ignorés, un dernier message honnête puis plus rien jusqu'à son retour ;
// - un décrocheur se définit par l'absence d'ACTES D'APPRENTISSAGE (révision,
//   QCM, devoir, cours complet, émargement, direct suivi), jamais par des
//   absences « inconnues » aux directs ;
// - relances : un rappel, puis un e-mail, puis la vie scolaire ; tout s'arrête dès qu'il revient ;
// - la direction règle chaque envoi : « essai » (calculé, écrit, rien ne part), « actif » ou « en pause ».
import { ecartJours, minutesLocales, type Jour } from "./calendrier";

// ── Vocabulaire (colonnes text de relances_engagement et reglage_relances) ──

export const MODES_RELANCES = ["essai", "actif", "pause"] as const;
export type ModeRelances = (typeof MODES_RELANCES)[number];
export const MODES_EMAILS = ["essai", "actif"] as const;
export type ModeEmails = (typeof MODES_EMAILS)[number];

export const MOTIFS_DECROCHEUR = ["devoir_non_rendu", "lives_manques", "inactif"] as const;
export type MotifDecrocheur = (typeof MOTIFS_DECROCHEUR)[number];
export const MOTIFS_RELANCE = ["rappel_du_jour", ...MOTIFS_DECROCHEUR, "semaine"] as const;
export type MotifRelance = (typeof MOTIFS_RELANCE)[number];

/** Le rappel, l'e-mail, puis la vie scolaire (palier 3 : « à appeler »). */
export const CANAUX_RELANCE = ["push", "email", "vie_scolaire"] as const;
export type CanalRelance = (typeof CANAUX_RELANCE)[number];

export const STATUTS_RELANCE = ["simulation", "envoye", "plafond", "sans_canal", "temoin", "quota", "echec", "pause_auto", "a_appeler"] as const;
/**
 * simulation : mode essai, rien n'est parti · envoye · plafond : 3 rappels déjà reçus ce jour-là ·
 * sans_canal : ni téléphone abonné ni adresse e-mail · temoin : jour tiré au sort sans rappel
 * d'entraînement · quota : plafond d'e-mails du jour atteint, reporté · echec : le service d'envoi a
 * refusé (ou n'est pas configuré) · pause_auto : dernier message honnête envoyé après 5 rappels
 * ignorés, plus de rappel jusqu'au retour · a_appeler : 2 relances sans effet, la vie scolaire prend le relais.
 */
export type StatutRelance = (typeof STATUTS_RELANCE)[number];

/** Sujets du rappel d'entraînement, dans l'ordre de priorité (le premier qui s'applique l'emporte). */
export const SUJETS_RAPPEL = ["devoir", "rattrapage", "cartes", "objectif_jour", "objectif_semaine", "cours_complet"] as const;
export type SujetRappel = (typeof SUJETS_RAPPEL)[number];

// ── Rythme ─────────────────────────────────────────────────────────────────

const H = 60;
/** Heure du rappel sans choix ni habitude connue : 19 h. */
export const HEURE_RAPPEL_DEFAUT = 19 * H;
/** L'heure habituelle (médiane des actes sur 14 jours) est bornée entre 7 h et 20 h. */
export const HEURE_HABITUELLE = { min: 7 * H, max: 20 * H } as const;
/** Heures que l'étudiant peut choisir : de 7 h à 20 h 30. Jamais de rappel d'entraînement après 20 h 30. */
export const HEURE_CHOISIE = { min: 7 * H, max: 20 * H + 30 } as const;
export const HEURE_RAPPEL_LIMITE = HEURE_CHOISIE.max;
/** Heures calmes, heure locale : rien ne sonne de 21 h à 6 h. */
export const HEURES_CALMES = { debut: 21 * H, fin: 6 * H } as const;
/** Rappels envoyés et ignorés d'affilée avant le dernier message honnête et la pause. */
export const RAPPELS_IGNORES_AVANT_PAUSE = 5;
/** « Pause de 7 jours » de la page Mes rappels. */
export const JOURS_PAUSE = 7;
/** Rappels déjà partis ce jour-là au-delà desquels le rappel d'entraînement s'efface (il laisse une place à une échéance). */
export const PLACES_AVANT_ENTRAINEMENT = 2;
/** Un même lien n'est pas proposé plus de 2 fois en 7 jours (sauf une échéance). */
export const REPETITIONS_LIEN = { fois: 2, jours: 7 } as const;

/** Décrocheurs : relance au 3e jour sans acte d'apprentissage, e-mail au 7e ou 4 jours après un rappel sans effet. */
export const DECROCHAGE = { joursRappel: 3, joursEmail: 7, joursSansEffet: 4, relancesAvantAppel: 2, heuresRetour: 48 } as const;
/** Passage quotidien des décrocheurs, heure locale. */
export const FENETRE_DECROCHEURS = { debut: 16 * H + 40, fin: 17 * H + 10 } as const;
/** E-mail du lundi, heure locale ; ce qui dépasse le quota part les jours suivants, jusqu'au jeudi. */
export const FENETRE_EMAIL_SEMAINE = { debut: 6 * H + 45, fin: 9 * H, joursDeReport: 3 } as const;
export const EMAILS_PAR_JOUR_DEFAUT = 40;
export const EMAILS_PAR_JOUR_MAX = 500;
/** Conservation des relances (ENGAGEMENT.md § 4). */
export const CONSERVATION_RELANCES_JOURS = 180;

export const estHeureCalme = (minutes: number) => minutes >= HEURES_CALMES.debut || minutes < HEURES_CALMES.fin;

const borner = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Heure du rappel : celle qu'il a choisie, sinon son heure habituelle (bornée 7 h – 20 h), sinon 19 h. */
export function heureEffective(choisie: number | null | undefined, habituelle: number | null | undefined): number {
  if (typeof choisie === "number" && Number.isFinite(choisie)) return borner(Math.round(choisie), HEURE_CHOISIE.min, HEURE_CHOISIE.max);
  // L'habitude est arrondie au quart d'heure : « vers 9 h », jamais « vers 8 h 59 ».
  if (typeof habituelle === "number" && Number.isFinite(habituelle)) return borner(Math.round(habituelle / 15) * 15, HEURE_HABITUELLE.min, HEURE_HABITUELLE.max);
  return HEURE_RAPPEL_DEFAUT;
}

/** Heure acceptée pour un choix de l'étudiant : un quart d'heure rond entre 7 h et 20 h 30. */
export const heureChoisieValide = (m: unknown): m is number =>
  typeof m === "number" && Number.isInteger(m) && m >= HEURE_CHOISIE.min && m <= HEURE_CHOISIE.max && m % 15 === 0;

/** « 19 h », « 20 h 30 », « 7 h 15 ». */
export function libelleHeure(minutes: number): string {
  const h = Math.floor(minutes / H);
  const m = minutes % H;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** Médiane (inférieure) d'une liste de minutes ; null si vide. */
export function mediane(valeurs: number[]): number | null {
  if (!valeurs.length) return null;
  const triees = [...valeurs].sort((a, b) => a - b);
  return triees[Math.floor((triees.length - 1) / 2)];
}

/**
 * Variante à envoyer : la moins récemment employée. « dernieres » : variantes
 * déjà envoyées, la plus récente d'abord ; une variante jamais envoyée passe
 * avant toutes, dans l'ordre de la liste.
 */
export function choisirVariante(variantes: readonly string[], dernieres: readonly string[]): string {
  if (!variantes.length) throw new Error("choisirVariante : aucune variante");
  let meilleure = variantes[0];
  let rangMeilleur = -1;
  for (const v of variantes) {
    const rang = dernieres.indexOf(v);
    if (rang === -1) return v;
    if (rang > rangMeilleur) {
      meilleure = v;
      rangMeilleur = rang;
    }
  }
  return meilleure;
}

// ── Décision du rappel d'entraînement ──────────────────────────────────────

export type ContexteRappel = {
  maintenant: Date | number;
  /** utilisateurs.fuseau (Abidjan si nul ou mal saisi). */
  fuseau: string | null;
  mode: ModeRelances;
  /** reglages_engagement (valeurs par défaut sans ligne). */
  heureChoisie: number | null;
  heureHabituelle: number | null;
  rappelsActifs: boolean;
  pauseJusquAu: Jour | null;
  /** Jour local de l'étudiant (calculé avec le même fuseau). */
  jour: Jour;
  /** Une ligne « rappel du jour » existe déjà pour ce jour (quel que soit son statut). */
  dejaDecide: boolean;
  /** Une relance de décrocheur est partie (ou a été simulée) ce jour-là : un seul message d'engagement par jour. */
  relanceAujourdhui: boolean;
  /** Un acte d'apprentissage depuis minuit, heure locale. */
  acteAujourdhui: boolean;
  /**
   * 3 jours ou plus sans acte d'apprentissage alors que les relances des décrocheurs sont actives :
   * ce sont elles qui lui écrivent (un rappel, puis un e-mail, puis la vie scolaire), pas le rappel du jour.
   */
  enDecrochage: boolean;
  /** Un direct de ses cours est en cours (ou commence dans l'heure qui vient). */
  liveProche: boolean;
  /** Pause après lassitude toujours en cours (pas de retour depuis). */
  enPauseAuto: boolean;
  /** Sujet retenu (le premier qui s'applique), null s'il n'y a rien d'utile à proposer. */
  sujet: SujetRappel | null;
  /** rappelEntrainementAutorise (tirage témoin, server/engagement/tirage.ts). */
  autoriseParTirage: boolean;
  /** Rappels envoyés d'affilée, sans ouverture ni acte le jour même (depuis la dernière pause). */
  ignoresDeSuite: number;
  /** Au moins un téléphone abonné aux rappels. */
  abonne: boolean;
  /** Rappels déjà partis ce jour-là (compteurs_push). */
  rappelsDuJour: number;
};

export type RaisonAttente = "pas_encore" | "live";
export type RaisonSaut =
  | "pause_globale"
  | "reglage"
  | "deja_decide"
  | "deja_relance"
  | "heures_calmes"
  | "trop_tard"
  | "deja_travaille"
  | "decrochage"
  | "pause_auto"
  | "rien_a_proposer";
export type DecisionRappel =
  | { action: "attendre"; raison: RaisonAttente; heure: number }
  | { action: "sauter"; raison: RaisonSaut }
  /** Écrire une ligne ; « envoyer » : la notification part (statut envoye ou pause_auto). */
  | { action: "ecrire"; statut: StatutRelance; sujet: SujetRappel; lassitude: boolean; envoyer: boolean };

/**
 * Décide du rappel d'entraînement d'un étudiant, à un instant donné. Appelée
 * toutes les 5 minutes : « attendre » revient au passage suivant, « sauter »
 * ne laisse aucune trace, « ecrire » produit la seule ligne du jour (la
 * contrainte unique de la table garantit qu'il n'y en a qu'une).
 */
export function deciderRappel(c: ContexteRappel): DecisionRappel {
  if (c.mode === "pause") return { action: "sauter", raison: "pause_globale" };
  if (!c.rappelsActifs || (c.pauseJusquAu && c.pauseJusquAu >= c.jour)) return { action: "sauter", raison: "reglage" };
  if (c.dejaDecide) return { action: "sauter", raison: "deja_decide" };
  if (c.relanceAujourdhui) return { action: "sauter", raison: "deja_relance" };
  const minutes = minutesLocales(c.maintenant, c.fuseau);
  if (estHeureCalme(minutes)) return { action: "sauter", raison: "heures_calmes" };
  const heure = heureEffective(c.heureChoisie, c.heureHabituelle);
  if (minutes < heure) return { action: "attendre", raison: "pas_encore", heure };
  if (minutes > HEURE_RAPPEL_LIMITE) return { action: "sauter", raison: "trop_tard" };
  if (c.acteAujourdhui) return { action: "sauter", raison: "deja_travaille" };
  if (c.enDecrochage) return { action: "sauter", raison: "decrochage" };
  if (c.liveProche) return { action: "attendre", raison: "live", heure };
  if (c.enPauseAuto) return { action: "sauter", raison: "pause_auto" };
  if (!c.sujet) return { action: "sauter", raison: "rien_a_proposer" };
  // Le témoin est tiré parmi les jours où un rappel serait vraiment parti : la comparaison reste juste.
  if (!c.autoriseParTirage) return { action: "ecrire", statut: "temoin", sujet: c.sujet, lassitude: false, envoyer: false };
  const lassitude = c.ignoresDeSuite >= RAPPELS_IGNORES_AVANT_PAUSE;
  const statut: StatutRelance =
    c.mode === "essai" ? "simulation" : !c.abonne ? "sans_canal" : c.rappelsDuJour >= PLACES_AVANT_ENTRAINEMENT ? "plafond" : lassitude ? "pause_auto" : "envoye";
  return { action: "ecrire", statut, sujet: c.sujet, lassitude: lassitude && statut === "pause_auto", envoyer: statut === "envoye" || statut === "pause_auto" };
}

// ── Décision de la relance d'un décrocheur ─────────────────────────────────

/** Une relance déjà écrite de l'épisode en cours (depuis le dernier acte d'apprentissage). */
export type RelancePassee = { jour: Jour; palier: number; canal: CanalRelance; statut: StatutRelance };

export type ContexteDecrocheur = {
  aujourdhui: Jour;
  mode: ModeRelances;
  emailsMode: ModeEmails;
  /** Jours entiers depuis le dernier acte d'apprentissage (ou l'activation du compte). */
  joursSansActe: number;
  /** Relances des décrocheurs écrites depuis ce dernier acte, dans l'ordre. */
  episode: RelancePassee[];
  abonne: boolean;
  /** Adresse e-mail connue et e-mails acceptés. */
  joignableParEmail: boolean;
  /** E-mails d'engagement encore permis aujourd'hui (plafond commun). */
  emailsRestants: number;
  /** Plus de place ce jour-là pour un rappel de cette priorité (compteurs_push : 3 pour une échéance, 2 sinon). */
  plafondRappel: boolean;
};

export type DecisionDecrocheur =
  | { action: "rien"; raison: "actif" | "pause_globale" | "deja_relance" | "a_appeler" | "attendre" }
  | { action: "ecrire"; palier: 1 | 2 | 3; canal: CanalRelance; statut: StatutRelance; envoyer: boolean };

/** Statuts qui comptent comme une tentative (une relance « sans effet » si l'étudiant ne revient pas). */
export const STATUTS_TENTATIVE: readonly StatutRelance[] = ["envoye", "simulation", "sans_canal", "echec"];

/**
 * Prochaine relance d'un décrocheur, au passage quotidien. Au plus une par
 * jour ; palier 1 : un rappel sur le téléphone ; palier 2 : un e-mail (pas de
 * téléphone abonné, 7 jours sans acte, ou 4 jours après un rappel sans
 * effet) ; palier 3 : « à appeler » (vie scolaire) après 2 relances sans
 * retour, ou 4 jours après le seul e-mail possible. Un acte d'apprentissage
 * clôt l'épisode : le suivant repart du palier 1.
 */
export function deciderDecrocheur(c: ContexteDecrocheur): DecisionDecrocheur {
  if (c.mode === "pause") return { action: "rien", raison: "pause_globale" };
  if (c.joursSansActe < DECROCHAGE.joursRappel) return { action: "rien", raison: "actif" };
  if (c.episode.some((r) => r.jour === c.aujourdhui)) return { action: "rien", raison: "deja_relance" };
  if (c.episode.some((r) => r.palier >= 3)) return { action: "rien", raison: "a_appeler" };
  const tentatives = c.episode.filter((r) => r.palier < 3 && STATUTS_TENTATIVE.includes(r.statut));
  const derniere = tentatives.at(-1);
  const joursDepuis = derniere ? ecartJours(derniere.jour, c.aujourdhui) : Infinity;
  const essai = c.mode === "essai";

  const appeler = (): DecisionDecrocheur => ({ action: "ecrire", palier: 3, canal: "vie_scolaire", statut: essai ? "simulation" : "a_appeler", envoyer: false });
  const rappel = (): DecisionDecrocheur => {
    const statut: StatutRelance = essai ? "simulation" : c.plafondRappel ? "plafond" : "envoye";
    return { action: "ecrire", palier: 1, canal: "push", statut, envoyer: statut === "envoye" };
  };
  const email = (): DecisionDecrocheur => {
    const statut: StatutRelance = !c.joignableParEmail
      ? "sans_canal"
      : essai || c.emailsMode === "essai"
        ? "simulation"
        : c.emailsRestants <= 0
          ? "quota"
          : "envoye";
    return { action: "ecrire", palier: 2, canal: "email", statut, envoyer: statut === "envoye" };
  };

  if (tentatives.length >= DECROCHAGE.relancesAvantAppel) return appeler();
  if (!derniere) return c.abonne && c.joursSansActe < DECROCHAGE.joursEmail ? rappel() : email();
  if (derniere.canal === "email") return joursDepuis >= DECROCHAGE.joursSansEffet ? appeler() : { action: "rien", raison: "attendre" };
  // Après un rappel resté sans effet : l'e-mail.
  if (joursDepuis >= DECROCHAGE.joursSansEffet || c.joursSansActe >= DECROCHAGE.joursEmail || !c.abonne) return email();
  return { action: "rien", raison: "attendre" };
}

/** L'e-mail de la semaine peut-il partir à cet instant ? Lundi 6 h 45 – 9 h, et les jours suivants pour le reste du quota. */
export function fenetreEmailSemaine(maintenant: Date | number, fuseau: string | null, jour: Jour, lundi: Jour): boolean {
  const m = minutesLocales(maintenant, fuseau);
  const rang = ecartJours(lundi, jour);
  return rang >= 0 && rang <= FENETRE_EMAIL_SEMAINE.joursDeReport && m >= FENETRE_EMAIL_SEMAINE.debut && m < FENETRE_EMAIL_SEMAINE.fin;
}

// ── Échanges avec le client ────────────────────────────────────────────────

/** GET /api/rappels/reglages (étudiant). */
export type ReglagesRappels = {
  /** Heure choisie (minutes depuis minuit) ; null : automatique. */
  heureRappel: number | null;
  /** Heure que le campus retiendrait en automatique (habitude ou 19 h). */
  heureAutomatique: number;
  rappelsActifs: boolean;
  emailsActifs: boolean;
  pauseJusquAu: Jour | null;
  /** Pause automatique en cours (5 rappels ignorés) : elle s'arrête dès qu'il travaille ou réactive ses rappels. */
  pauseAutomatique: boolean;
  /** Une adresse e-mail est connue. */
  aUneAdresse: boolean;
  /** Au moins un téléphone reçoit les rappels. */
  telephoneAbonne: boolean;
};

/** PUT /api/rappels/reglages : seuls les champs donnés changent. */
export type MajReglagesRappels = {
  heureRappel?: number | null;
  rappelsActifs?: boolean;
  emailsActifs?: boolean;
  /** true : pause de 7 jours à partir d'aujourd'hui ; false : reprise. */
  pause?: boolean;
};

/** Décompte d'une période, par statut. */
export type CompteStatuts = Partial<Record<StatutRelance, number>>;

/** GET /api/pilotage/relances-auto/reglages (direction). */
export type ReglageRelancesDto = {
  mode: ModeRelances;
  rappelsMode: ModeRelances;
  emailsMode: ModeEmails;
  emailsParJour: number;
  majLe: string | null;
  majPar: string | null;
  /** Sur les 7 derniers jours. */
  bilan: {
    rappels: CompteStatuts;
    relances: CompteStatuts;
    emailsSemaine: CompteStatuts;
    /** E-mails partis aujourd'hui (tous motifs), à comparer au plafond. */
    emailsAujourdhui: number;
    /** Relances suivies d'un retour sous 48 h / relances parties (ou simulées). */
    revenus: number;
    relancesComptees: number;
    aAppeler: number;
  };
};

export type MajReglageRelances = Partial<Pick<ReglageRelancesDto, "mode" | "rappelsMode" | "emailsMode" | "emailsParJour">>;

/** Une relance de l'historique (pilotage). */
export type LigneRelance = {
  id: number;
  jour: Jour;
  motif: MotifRelance;
  canal: CanalRelance;
  palier: number;
  statut: StatutRelance;
  creeLe: string;
  ouvertLe: string | null;
  revenuLe: string | null;
};

/**
 * État des relances d'un étudiant dans « Qui décroche ? » :
 * relance : relancé, pas encore revenu · revenu : revenu dans les 48 h ·
 * a_appeler : 2 relances sans effet (ou palier 3 simulé en essai).
 */
export type EtatRelanceEtudiant = {
  etat: "aucune" | "relance" | "revenu" | "a_appeler";
  /** Dernière relance de décrocheur (sans les rappels d'entraînement). */
  derniere: LigneRelance | null;
  /** Les 10 dernières relances (décrocheurs, e-mails de la semaine), la plus récente d'abord. */
  historique: LigneRelance[];
};

/** GET /api/pilotage/relances-auto?etudiants=1,2,3 (équipe, périmètre de ses campus). */
export type EtatsRelances = {
  mode: ModeRelances;
  rappelsMode: ModeRelances;
  emailsMode: ModeEmails;
  etudiants: Record<number, EtatRelanceEtudiant>;
};

/** Un étudiant « à appeler » (GET /api/pilotage/relances-auto/a-appeler). */
export type EtudiantAAppeler = {
  etudiant: { id: number; prenom: string; nom: string; matricule: string | null; telephone: string | null; classe: string | null; siteId: number | null; site: string | null };
  depuis: string;
  /** Dernier acte d'apprentissage (90 jours), s'il y en a un. */
  dernierActe: string | null;
  /** Palier 3 simulé (relances en essai) : rien n'est parti, la liste montre ce qui se passerait. */
  essai: boolean;
  whatsapp: string | null;
  etat: EtatRelanceEtudiant;
};

export type ListeAAppeler = { mode: ModeRelances; rappelsMode: ModeRelances; emailsMode: ModeEmails; lignes: EtudiantAAppeler[] };
