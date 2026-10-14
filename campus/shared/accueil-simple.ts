// Accueil du formateur à trois gros blocs (José, 14 octobre 2026 au soir) : contrats partagés entre le serveur
// (routes/accueil.ts : GET /api/enseigner/accueil-simple) et le client (modules/accueil : PageEnseigner, PageMonCours).
// « Le cours », « Entrer dans le live », « Préparer le cours » ; s'il a plusieurs cours, d'abord un gros carré par cours.

/** Repère d'un carré du formateur : en direct, classe ouverte avant l'heure, aujourd'hui, un autre jour, ou rien. */
export type RepereFormateur = "direct" | "ouvert" | "aujourdhui" | "jour" | null;

export type CarreFormateurDto = {
  coursId: number;
  code: string;
  titre: string;
  couleur: string;
  repere: RepereFormateur;
  /** « 8h30 » (heure d'Abidjan). */
  heure: string | null;
  /** « 4h30 », si le fuseau du formateur n'est pas celui d'Abidjan. */
  heureChezVous: string | null;
  /** « Jeudi » (dans les 6 jours), sinon « Vendredi 30 octobre ». */
  jour: string | null;
  /** La séance du moment de CE cours (en direct, sinon la prochaine prévue pas finie). */
  seance: { id: number; debut: string; fin: string; statut: "planifiee" | "en_direct" | "terminee" | "annulee" } | null;
  /**
   * « Entrer dans le live » : direct (aller au Studio), ouvrir (dès 1 h avant : la classe s'ouvre, le cours commence à
   * son heure), attendre (plus d'1 h avant : ouvreA), aucun (pas de séance).
   */
  live: {
    etat: "direct" | "ouvrir" | "attendre" | "aucun";
    /** « attendre » : l'instant où le live pourra s'ouvrir (1 h avant le cours), son heure d'Abidjan (« 9h00 »), son
     * jour quand ce n'est pas aujourd'hui (« samedi », « vendredi 30 octobre »), et l'heure chez lui (autre fuseau). */
    ouvreA: string | null;
    ouvreHeure: string | null;
    ouvreJour: string | null;
    ouvreChezVous: string | null;
  };
  liens: { cours: string; live: string | null; preparer: string | null };
};

/** GET /api/enseigner/accueil-simple */
export type AccueilSimpleDto = {
  salutation: string;
  prenom: string;
  /** Tous ses cours (hors archivés), triés : en direct, ouvert, aujourd'hui, un autre jour, puis par titre. */
  cours: CarreFormateurDto[];
  /** Ceux de l'accueil : aujourd'hui, sinon dans les 7 jours, sinon à venir, sinon tous. */
  montres: number[];
  /** Le seul cours de l'accueil (les trois blocs directement), sinon null (les carrés d'abord). */
  seul: number | null;
  /** Copies à corriger et à publier, corrigés à valider, messages non lus. */
  aFaire: number;
};
