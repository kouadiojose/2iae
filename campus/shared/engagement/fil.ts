// « Le travail du campus » : le fil des séances tenues, et ce que le campus en a fait (demande de José du
// 8 octobre 2026 au soir : un seul endroit, très visuel, pour voir les cours résumés, les exercices donnés, les
// notes ; les formateurs ne doivent rien avoir à chercher). Même fil pour le formateur (ses cours) et pour la
// direction (tous les cours, filtres par campus, cours et formateur).
//
//   GET /api/fil/seances?cours=&formateur=&site=&avant=&limite=   → FilSeances (de la plus récente à la plus ancienne)
//   GET /api/fil/resume?jours=7&site=                             → ResumeTravail (les grands chiffres de la période)
//
// Accès : formateur limité aux cours qu'il enseigne ; direction (admin) : tout ; vie scolaire : son périmètre de
// campus, avec le droit « notes » ou « presences_voir ». Réponses en « private, no-cache ».
import type { StatutSeance } from "../schema/live";
import type { StatutCorrige } from "./corrections";

/** Un cours résumé (cours complet tiré de l'enregistrement) : à venir, en préparation, prêt, ou en échec. */
export type EtatResume = "a_venir" | "en_cours" | "prete" | "erreur";

/** Une séance tenue et tout ce qui en est sorti. Les liens mènent aux pages existantes. */
export type FilSeance = {
  id: number;
  titre: string;
  /** Heure prévue, et heures réelles du direct. */
  debut: string;
  demarreeLe: string | null;
  termineeLe: string | null;
  statut: StatutSeance;
  cours: { id: number; code: string; titre: string; couleur: string };
  formateur: { id: number; prenom: string; nom: string } | null;
  /** La vidéo de la séance (replay). */
  video: { pret: boolean; vues: number; lien: string | null };
  /** Le cours résumé, et combien d'étudiants l'ont ouvert. */
  resume: { etat: EtatResume; ouvertures: number; lien: string | null };
  /** Le QCM envoyé après la séance (devoirs automatiques) : combien l'ont fait, la moyenne sur le barème. */
  qcm: {
    devoirId: number;
    titre: string;
    envoyeA: number;
    faits: number;
    moyenne: number | null;
    bareme: number;
    corrige: StatutCorrige | null;
    lien: string;
  } | null;
  /** L'exercice à rendre : copies rendues, notées par le campus ou le formateur, en attente, à revoir. */
  exercice: {
    devoirId: number;
    titre: string;
    envoyeA: number;
    rendues: number;
    notees: number;
    enAttente: number;
    aRevoir: number;
    moyenne: number | null;
    bareme: number;
    corrige: StatutCorrige | null;
    lien: string;
  } | null;
  /** Présence en trois états (inconnus : salle de leur campus pas émargée, jamais comptés absents). */
  presence: { attendus: number; presents: number; inconnus: number; taux: number | null };
  participation: { questions: number; sondages: number };
  /** Page de la séance (bilan) pour qui peut l'ouvrir ; nul sinon. */
  lienSeance: string | null;
};

export type FilSeances = {
  seances: FilSeance[];
  /** Curseur pour la page suivante (date réelle de la dernière séance de la page) ; nul : fin du fil. */
  suivant: string | null;
};

/** Les grands chiffres de la période (« Cette semaine »), dans le périmètre de la personne. */
export type ResumeTravail = {
  depuis: string;
  jours: number;
  seancesTenues: number;
  coursResumes: number;
  qcmEnvoyes: number;
  exercicesEnvoyes: number;
  copiesRendues: number;
  copiesNotees: number;
  /** Dont notées par le campus (correction automatique). */
  noteesParLeCampus: number;
  /** Moyenne des notes publiées de la période, sur 20 ; nulle sans note. */
  moyenneSur20: number | null;
  presence: { presents: number; attendus: number; taux: number | null };
};
