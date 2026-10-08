// Textes du chantier C2 (campus/ENGAGEMENT.md) : objectif du jour de
// l'accueil étudiant, carte d'une interrogation préparée par la routine du
// soir, progression honnête des cours (accueil et « Mes cours »).
// Étudiants tutoyés, personnel vouvoyé ; variables {n}.
import { creerTextes } from "./index";

export const t = creerTextes({
  // ── Objectif du jour ────────────────────────────────────────────────────
  "objectif.titre": { tu: "Ton objectif du jour", vous: "Votre objectif du jour" },
  "objectif.compteur": "{faits}/{total}",
  "objectif.aide": "Chaque ligne se coche toute seule quand c'est fait.",
  "objectif.fait": "Fait",
  "objectif.ligne": "Objectif du jour · {faits}/{total}",
  "objectif.ligneValide": "Objectif du jour validé",
  "objectif.voir": { tu: "Voir mon objectif du jour", vous: "Voir votre objectif du jour" },
  "objectif.masquer": "Masquer",
  /** Ligne repliée : la seule ligne qui reste est déjà la grande carte « À faire maintenant ». */
  "objectif.resteCarte": { tu: "Il ne te reste que la carte ci-dessus.", vous: "Il ne vous reste que la carte ci-dessus." },
  "objectif.dansCarte": "C'est la carte « À faire maintenant » ci-dessus.",

  "revision.titre": "Révision du jour",
  "revision.detail": "{min} min",

  "rattrapage.titre": "Rattrape {cours} {quand}",
  // Un rattrapage ne se coche qu'après un vrai travail (server/engagement/progression-cours.ts).
  "rattrapage.complet": "{min} min, sans vidéo (≈ {ko} Ko) · se coche après son quiz ou 3 fiches",
  "rattrapage.replay": "Replay : se coche après 5 min de vidéo",
  "rattrapage.emarger": { tu: "Tu étais en salle ? Pense à émarger la prochaine fois.", vous: "En salle ? Pensez à émarger la prochaine fois." },
  "quand.aujourdhui": "d'aujourd'hui",
  "quand.hier": "d'hier",
  "quand.jour": "de {jour}",

  "retenir.titre": "Lis « À retenir » {deCours}",
  "retenir.detail": "{min} min",
  "retenir.tout": "Tout le cours résumé",

  "devoir.quiz": "QCM {deCours}",
  "devoir.quizDetail": "{n} questions, {min} min · à faire {quand}",
  // Interrogation de la routine du soir : l'entraînement fait sur son cours complet.
  "devoir.sansEntrainement": {
    tu: "Elle compte dans ta moyenne : entraîne-toi d'abord avec le quiz du cours résumé.",
    vous: "Elle compte dans la moyenne : entraînement conseillé avec le quiz du cours résumé.",
  },
  "devoir.pret": { tu: "Entraînement : {score}/{total}. Tu es prêt (elle compte dans ta moyenne).", vous: "Entraînement : {score}/{total} (elle compte dans la moyenne)." },
  "devoir.revoir": {
    tu: "Entraînement : {score}/{total}. Revois le cours résumé avant (elle compte dans ta moyenne).",
    vous: "Entraînement : {score}/{total} (elle compte dans la moyenne).",
  },
  "devoir.depot": "Exercice {deCours}",
  "devoir.depotDetail": "À rendre {quand}",
  "devoir.aujourdhui": "aujourd'hui",
  "devoir.demain": "demain",

  "valide.titre": "Jour validé !",
  "valide.texte": {
    tu: "Tout est fait pour aujourd'hui. Un nouvel objectif t'attend demain.",
    vous: "Tout est fait pour aujourd'hui. Un nouvel objectif vous attend demain.",
  },

  // ── Carte « À jour » de l'accueil (repli de l'objectif du jour) ─────────
  "aJour.detail": {
    tu: "Aucun devoir à rendre et aucun live en ce moment. Tes cours, leurs enregistrements et leurs cours résumés t'attendent.",
    vous: "Aucun devoir à rendre et aucun live en ce moment.",
  },
  "aJour.prochain": {
    tu: "Prochain rendez-vous : {cours} en direct {quand} à {heure}. D'ici là, tes cours résumés t'attendent.",
    vous: "Prochain rendez-vous : {cours} en direct {quand} à {heure}.",
  },
  "aJour.bouton": { tu: "Voir mes cours", vous: "Voir les cours" },

  // ── Carte d'une interrogation préparée par la routine du soir ───────────
  "interrogation.pret": {
    tu: "Tu t'es entraîné : {score}/{total}. Tu es prêt ({n} questions, elle compte dans ta moyenne).",
    vous: "Entraînement : {score}/{total} ({n} questions, elle compte dans la moyenne).",
  },
  "interrogation.revoir": {
    tu: "Tu t'es entraîné : {score}/{total}. Revois le cours résumé avant de commencer ({n} questions, elle compte dans ta moyenne).",
    vous: "Entraînement : {score}/{total} ({n} questions, elle compte dans la moyenne).",
  },
  "interrogation.sansEntrainement": {
    tu: "Entraîne-toi d'abord avec le quiz du cours résumé ({n} questions, elle compte dans ta moyenne).",
    vous: "Entraînement conseillé avec le quiz du cours résumé ({n} questions, elle compte dans la moyenne).",
  },

  // ── Progression honnête d'un cours ──────────────────────────────────────
  "progression.seances1": "{n} séance sur {total} suivie ou rattrapée",
  "progression.seancesN": "{n} séances sur {total} suivies ou rattrapées",
  "progression.lecons1": "{n} leçon sur {total} terminée",
  "progression.leconsN": "{n} leçons sur {total} terminées",
  "progression.aria": "Progression : {pct} %",
  "mesCours.sousTitre": {
    tu: "Touche un cours pour retrouver ses séances, ses enregistrements et ses leçons.",
    vous: "Touchez un cours pour retrouver ses séances, ses enregistrements et ses leçons.",
  },
});

export type CleObjectif = Parameters<typeof t>[0];
