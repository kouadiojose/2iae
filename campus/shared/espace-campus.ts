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

/** GET /api/mon-campus/cours/:id */
export type CoursCampusDto = {
  campus: { id: number; nomCourt: string };
  apercu: boolean;
  cours: { id: number; code: string; titre: string; couleur: string; formateur: string | null };
  live: { repere: RepereCarre; heure: string | null };
  compteurs: { lecons: number; resumes: number; examens: number; notes: number };
};

export type EtatLiveCampus = "aucune" | "a_venir" | "ouverte" | "terminee" | "annulee" | "non_tenue";

/** GET /api/mon-campus/cours/:id/live (et la réponse de POST …/seances/:id/ouvrir). */
export type LiveCampusDto = {
  campus: { id: number; nomCourt: string };
  cours: { id: number; code: string; titre: string; couleur: string };
  seanceId: number | null;
  /** Deux séances du même cours à la même heure (deux sessions) : la personne choisit (?seance=). */
  choix: { seanceId: number; heure: string; classes: string }[] | null;
  etat: EtatLiveCampus;
  /** Heure prévue du cours (ISO) et « 8h30 ». */
  debut: string | null;
  heure: string | null;
  /** « Ouvrir le cours » possible maintenant (dès 1 h avant, jusqu'à la fin prévue, aucune autre séance du cours en direct). */
  peutOuvrir: boolean;
  /** « 7h30 » : le moment où il pourra ouvrir (encore à venir), sinon null. */
  ouvrableA: string | null;
  /** « 8h00 » : l'ouverture automatique de la salle (réglage actif, cours publié, pas déjà ouverte à cet horaire). */
  ouvertureAutoA: string | null;
  /** Prochaine séance après aujourd'hui (état « aucune ») : « lundi 19 octobre », « 8h30 ». */
  prochaine: { debut: string; jour: string; heure: string } | null;
  /** Motif écrit par une personne (annulation). */
  motif: string | null;
  /** Postes d'écran de ce campus sur cette classe en ce moment. */
  ecransDuCampus: number;
  apercu: boolean;
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

/** Première lettre en capitale : « Jeudi 15 octobre ». */
export const capitale = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
