// Contrats de la régie des cours en direct (profil « Chargé de cours », droit « animer » : ext-profils.ts),
// entre server/routes/regie.ts et client/src/modules/regie. Aucun lien (invité, intervenant, écran de salle)
// dans « Mon espace » : le lien intervenant se demande séance par séance (LienIntervenantDto), et se journalise.

// Au plus tôt, la régie seule (sans « programme ») ouvre la classe une heure avant le cours : la même borne que
// l'ouverture automatique (AVANCE_MAX_OUVERTURE_MIN, shared/ouverture.ts), qui n'ouvre jamais plus tôt. Une classe
// ouverte automatiquement est donc toujours dans la fenêtre du chargé de cours : il la prend (« Je prends la classe »).

/**
 * État d'un cours vu de la régie : à venir, classe ouverte avant l'heure (le cours n'a pas encore commencé),
 * en direct, en retard (l'heure du cours est passée et personne n'a ouvert la classe : le cas à repérer d'un coup
 * d'œil), terminé, annulé, ou pas ouvert du tout alors que l'heure de fin est passée.
 */
export type EtatRegie = "a_venir" | "ouverte_avance" | "en_direct" | "en_retard" | "terminee" | "annulee" | "non_ouverte";

export type CampusRegieDto = {
  siteId: number;
  nomCourt: string;
  /** Salle de conférence du campus où se tient ce cours (shared/salles.ts). */
  salle: string;
  /** L'écran de cette salle est dans la classe en ce moment. */
  connectee: boolean;
};

/**
 * Une autre classe en direct occupe une salle de conférence de ce cours (« Laisse-les fermer, ne force pas la
 * fermeture » : l'ouverture automatique attend qu'elle ferme). GET /api/seances/:id/salle-occupee (Studio) et
 * CoursRegieDto.attenteSalle (« Mon espace »).
 */
export type SalleOccupeeDto = {
  /** La séance en direct qui occupe la salle (son Studio : /live/:id). */
  seanceId: number;
  /** « Anglais commun ». */
  cours: string;
  code: string;
  /** « Riviera · Salle de conférence 1 ». */
  salle: string;
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
  /**
   * Le formateur est dans la classe en ce moment : un formateur du cours (canal temps réel de la séance), ou la
   * personne entrée par le lien intervenant tant que sa page se signale (formateur sans compte : il anime).
   */
  formateurConnecte: boolean;
  /** Connecté par le lien intervenant seulement (aucun formateur du cours avec son compte) : « connecté (lien intervenant) ». Absent : faux. */
  formateurParLien?: boolean;
  /**
   * Classe ouverte automatiquement, l'heure du cours passée, que personne n'anime encore (ni le formateur, ni
   * l'intervenant du lien intervenant, ni la régie) : « En attente du formateur ». Le chargé de cours la prend
   * (« Je prends la classe » dans le Studio) ou envoie le lien intervenant au formateur ; sinon elle finira « Séance
   * non tenue ». Absent d'une ancienne réponse : faux.
   */
  attenteFormateur?: boolean;
  campus: CampusRegieDto[];
  sallesConnectees: number;
  sallesAttendues: number;
  diapos: number;
  ressources: number;
  sondages: number;
  /** « Ouvrir la classe » marche maintenant (séance à venir dans l'heure qui précède, ou en retard, avant la fin). */
  peutOuvrir: boolean;
  /** Heure à partir de laquelle « Ouvrir la classe » marche (régie sans « programme »), sinon null. */
  ouvreA: string | null;
  /**
   * Heure à laquelle la classe s'ouvrira d'elle-même (ouverture automatique active, cours publié, séance à venir qui
   * ne s'est pas encore ouverte à cet horaire), sinon null. Absent d'une ancienne réponse : null.
   */
  ouvertureAutoA?: string | null;
  /**
   * Séance pas encore ouverte dont une salle est occupée par une autre classe en direct : elle attend que celle-ci
   * ferme (« Laisse-les fermer ») ; « Ouvrir la classe » mettrait deux classes dans la même salle. Absent : null.
   */
  attenteSalle?: SalleOccupeeDto | null;
  /**
   * « Rouvrir la classe » : terminée depuis moins de 2 h (reprise permise par le serveur) et sa fin prévue pas encore
   * passée (fermée trop tôt, par erreur). Absent : faux.
   */
  peutRouvrir?: boolean;
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
