// Contrats de la régie des cours en direct (profil « Chargé de cours », droit « animer » : ext-profils.ts),
// entre server/routes/regie.ts et client/src/modules/regie. Aucun lien (invité, intervenant, écran de salle)
// dans « Mon espace » : le lien intervenant se demande séance par séance (LienIntervenantDto), et se journalise.

/** Au plus tôt, la régie seule (sans « programme ») ouvre la classe une heure avant le cours. */
export const AVANCE_MAX_OUVERTURE_REGIE_MIN = 60;

/**
 * État d'un cours vu de la régie : à venir, classe ouverte avant l'heure (le cours n'a pas encore commencé),
 * en direct, terminé, annulé, ou pas ouvert du tout alors que l'heure de fin est passée.
 */
export type EtatRegie = "a_venir" | "ouverte_avance" | "en_direct" | "terminee" | "annulee" | "non_ouverte";

export type CampusRegieDto = {
  siteId: number;
  nomCourt: string;
  /** Salle de conférence du campus où se tient ce cours (shared/salles.ts). */
  salle: string;
  /** L'écran de cette salle est dans la classe en ce moment. */
  connectee: boolean;
};

export type CoursRegieDto = {
  seanceId: number;
  titre: string;
  cours: { id: number; code: string; titre: string; couleur: string };
  debut: string;
  fin: string;
  dureeMinutes: number;
  /** « 8h30-12h30 » (heure d'Abidjan). */
  heures: string;
  etat: EtatRegie;
  motifAnnulation: string | null;
  /** Formateur qui anime ce créneau (intervenant de l'emploi du temps, sinon formateur principal du cours). */
  formateur: { nom: string } | null;
  /** Un formateur du cours est dans la classe en ce moment (canal temps réel de la séance). */
  formateurConnecte: boolean;
  campus: CampusRegieDto[];
  sallesConnectees: number;
  sallesAttendues: number;
  diapos: number;
  ressources: number;
  sondages: number;
  /** « Ouvrir la classe » marche maintenant (séance à venir, dans l'heure qui précède, avant la fin). */
  peutOuvrir: boolean;
  /** Heure à partir de laquelle « Ouvrir la classe » marche (régie sans « programme »), sinon null. */
  ouvreA: string | null;
};

export type JourRegieDto = { date: string; libelle: string; cours: CoursRegieDto[] };

/** GET /api/regie : « Mon espace » du chargé de cours (et de la direction). */
export type EspaceRegieDto = {
  /** Jour d'Abidjan (AAAA-MM-JJ). */
  date: string;
  /** « mercredi 14 octobre ». */
  libelle: string;
  perimetre: { toutLeGroupe: boolean; campus: string | null };
  aujourdhui: CoursRegieDto[];
  suivants: JourRegieDto[];
};

/** GET /api/seances/:id/lien-intervenant : lien micro + caméra, et messages prêts pour WhatsApp. */
export type LienIntervenantDto = {
  url: string;
  /** Fin prévue + 30 min. */
  valableJusquau: string;
  /** Message prêt à envoyer (vouvoiement), lien compris. */
  message: string;
  /** https://wa.me/?text=… (choisir le destinataire dans WhatsApp). */
  whatsapp: string;
  /** https://wa.me/<téléphone du formateur>?text=… quand son compte a un téléphone (jamais le numéro en clair). */
  whatsappFormateur: string | null;
  /** « Dr Angora Nzi ». */
  formateur: string | null;
};
