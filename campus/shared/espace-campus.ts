// Espace du campus (José, 14 octobre 2026 au soir : « chaque campus aura son propre accès, géré par le chargé du
// campus ») : contrats partagés entre le serveur (routes/espace-campus.ts) et le client (modules/espace-campus).
//
// Un compte par campus (profil « campus », droit « espace_campus », ext-profils.ts). Son accueil : un gros carré
// par cours que suit son campus ; en touchant un carré, cinq gros blocs : « Entrer dans le live » (cet ordinateur
// devient l'écran de la salle pour CE cours), « Les cours », « Les résumés de cours », « Les examens », « Les notes ».
// Aucune dépendance : commun au serveur et au client.

/** Repère d'un carré : en direct, classe ouverte avant l'heure, prévu aujourd'hui, ou rien. */
export type RepereCarre = "direct" | "ouvert" | "aujourdhui" | null;

/** Un carré de l'accueil du campus. */
export type CarreCampusDto = {
  coursId: number;
  code: string;
  titre: string;
  couleur: string;
  repere: RepereCarre;
  /** « 8h30 » (heure d'Abidjan), avec le repère « ouvert » ou « aujourdhui ». */
  heure: string | null;
  /** Les classes du campus qui suivent ce cours, par leur niveau : « 1BTS · 2BTS » (deux cours aux noms proches). */
  classes: string;
};

/** GET /api/mon-campus */
export type EspaceCampusDto = {
  campus: { id: number; nomCourt: string };
  /** Jour d'Abidjan, « 2026-10-15 ». */
  date: string;
  /** « Jeudi 15 octobre ». */
  libelle: string;
  /** Vrai quand la direction regarde l'espace d'un campus (?site=). */
  apercu: boolean;
  cours: CarreCampusDto[];
};

/**
 * Ce que le chargé du campus peut compléter (José, 15 octobre 2026 à 5 h : « le chargé du campus aussi doit pouvoir
 * rajouter les vidéos ») : la séance du jour de ce cours (prévue ou en direct), sinon sa prochaine séance prévue. Null :
 * aucune séance à compléter (« Pas de cours prévu »).
 */
export type AjoutsCampusDto = {
  seanceId: number;
  /** jour null : aujourd'hui (« Pour le cours de 8h30 ») ; sinon « samedi 17 octobre ». */
  pour: { jour: string | null; heure: string };
  diapos: number;
  videos: number;
  /** Deux séances du même cours à la même heure : la personne choisit (« Pour quel groupe ? »). */
  choix: { seanceId: number; libelle: string }[] | null;
} | null;

/**
 * « Terminer le cours » depuis l'écran du campus, proposé seulement quand c'est sans danger (règle exacte :
 * server/routes/live.ts, terminaisonCampus). `terminer` : la raison de le proposer ; sinon `sinon` : pourquoi non.
 */
export type FermetureCampusDto = {
  terminer: "seul_campus" | "fin_passee" | "personne" | "non_tenu" | null;
  sinon: "pas_commence" | "attente_formateur" | "autres" | null;
  /** Le formateur (ou l'intervenant, ou la personne qui anime) est connecté à la classe. */
  formateurPresent: boolean;
  /** Autres écrans connectés à la classe (autres campus, autres ordinateurs de ce campus, anciens écrans « salle »). */
  autresSalles: number;
};

/**
 * Geste du chargé du campus annoncé sur le canal de la séance (« seance:<id> ») : le Studio du formateur l'affiche
 * (« Yamoussoukro a ajouté un PowerPoint (3 diapos). »). Événement distinct de « campus » (état des salles).
 */
export const EVENEMENT_GESTE_CAMPUS = "campus:geste";
export type GesteCampusDto =
  | { type: "ajout_ppt"; site: string; siteId: number; diapos: number }
  | { type: "ajout_video"; site: string; siteId: number; titre: string }
  | { type: "salle_fermee"; site: string; siteId: number }
  | { type: "termine"; site: string; siteId: number };

/** GET /api/mon-campus/cours/:id */
export type CoursCampusDto = {
  campus: { id: number; nomCourt: string };
  apercu: boolean;
  cours: { id: number; code: string; titre: string; couleur: string; formateur: string | null };
  /**
   * Le live du jour : repère (en direct, ouvert, prévu aujourd'hui), ou `fin` quand la séance du jour est finie,
   * annulée ou n'a pas eu lieu. `debut` : l'heure prévue (ISO) de la séance du jour (confirmation « plus d'une heure
   * avant »). `essai` : pas de séance du jour prévue ou en direct : le bloc mène à la salle d'essai (tester le son).
   */
  live: { repere: RepereCarre; heure: string | null; fin: "fini" | "annule" | "non_tenu" | null; debut: string | null; essai: boolean };
  ajouts: AjoutsCampusDto;
  compteurs: { lecons: number; resumes: number; examens: number; notes: number };
};

export type EtatLiveCampus = "aucune" | "a_venir" | "ouverte" | "terminee" | "annulee" | "non_tenue";

/** GET /api/mon-campus/cours/:id/live (et la réponse de POST …/seances/:id/ouvrir). */
export type LiveCampusDto = {
  campus: { id: number; nomCourt: string };
  cours: { id: number; code: string; titre: string; couleur: string };
  seanceId: number | null;
  /** Deux séances du même cours à la même heure (deux sessions) : la personne choisit (?seance=). */
  choix: { seanceId: number; heure: string; classes: string; detail: string | null }[] | null;
  etat: EtatLiveCampus;
  /** Heure prévue du cours (ISO) et « 8h30 ». */
  debut: string | null;
  heure: string | null;
  /**
   * « Ouvrir la salle » possible maintenant : séance prévue AUJOURD'HUI (jour d'Abidjan), à toute heure, jusqu'à sa fin
   * prévue, aucune autre séance du cours en direct (ou celle qui l'est est finie et personne ne l'anime).
   */
  peutOuvrir: boolean;
  /** « 8h00 » : l'ouverture automatique de la salle (réglage actif, cours publié, pas déjà ouverte à cet horaire). */
  ouvertureAutoA: string | null;
  /** Prochaine séance après aujourd'hui (état « aucune ») : « lundi 19 octobre », « 8h30 ». */
  prochaine: { debut: string; jour: string; heure: string } | null;
  /** Motif écrit par une personne (annulation). */
  motif: string | null;
  /** Prévue, mais une séance précédente du même cours est encore en direct : la salle s'ouvre quand elle se ferme. */
  apresPrecedente: boolean;
  /** Postes d'écran de ce campus sur cette classe en ce moment. */
  ecransDuCampus: number;
  apercu: boolean;
  /** Pas de séance du jour prévue ou en direct : l'écran propose la salle d'essai (tester le son et l'image). */
  essai: boolean;
  /** La séance que le chargé du campus complète (PowerPoint, vidéos). */
  ajouts: AjoutsCampusDto;
  /** « Montrer dans la salle » : la classe est en direct et SON campus est le seul à suivre ce cours. */
  projectionPermise: boolean;
  /** Ressources de la séance ajoutées par ce compte (« Retirer »). */
  mesAjouts: number[];
  /** « Fermer » : ce que l'écran propose (null hors direct). */
  fermeture: FermetureCampusDto | null;
};

/** GET /api/mon-campus/cours/:id/examens */
export type ExamenCampusDto = {
  id: number;
  titre: string;
  type: "depot" | "quiz";
  ouvertureLe: string | null;
  echeance: string;
  etat: "a_venir" | "en_cours" | "fini";
  /** Copies rendues (hors brouillon) par les étudiants du campus. */
  rendus: number;
  /** Étudiants actifs du campus inscrits au cours. */
  inscrits: number;
};

/** GET /api/mon-campus/cours/:id/notes : les notes PUBLIÉES des étudiants du campus, sur 20, en lecture. */
export type NotesCampusDto = {
  campus: { id: number; nomCourt: string };
  devoirs: { id: number; titre: string; type: "depot" | "quiz"; bareme: number }[];
  etudiants: { id: number; prenom: string; nom: string; classe: string | null; moyenne: number | null; notes: Record<number, number | null> }[];
};

/** « 8h30 » : heure d'Abidjan (GMT), sans zéro devant l'heure, toujours avec les minutes (« 14h00 »). */
export function heureSimple(d: Date | string | number): string {
  const x = new Date(d);
  const h = x.getUTCHours();
  const m = x.getUTCMinutes();
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Jour d'Abidjan (GMT) d'un instant : « 2026-10-15 ». */
export const jourAbidjan = (d: Date | string | number) => new Date(d).toISOString().slice(0, 10);

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « jeudi 15 octobre » (jour d'Abidjan). */
export function jourEnLettres(d: Date | string | number): string {
  const x = new Date(d);
  return `${JOURS[x.getUTCDay()]} ${x.getUTCDate() === 1 ? "1er" : x.getUTCDate()} ${MOIS[x.getUTCMonth()]}`;
}

/** « Jeudi » (jour d'Abidjan). */
export const nomDuJour = (d: Date | string | number) => {
  const j = JOURS[new Date(d).getUTCDay()];
  return j.charAt(0).toUpperCase() + j.slice(1);
};

/**
 * « de Riviera », « d'Azaguié », « d'Yopougon » non : « de Yopougon » (le Y y sonne comme une consonne). Élision devant
 * une voyelle (accentuée ou non) ; sert aux titres et aux messages du campus (« Campus d'Azaguié »).
 */
export function deCampus(nom: string): string {
  const n = nom.trim();
  return /^[aeiouàâäéèêëîïôöùûüœæ]/i.test(n) ? `d'${n}` : `de ${n}`;
}

/** Première lettre en capitale : « Jeudi 15 octobre ». */
export const capitale = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
