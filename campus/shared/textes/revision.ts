// Textes de la révision du jour (chantier C1) : écran /reviser, cours complet,
// onglet « Réviser » d'un cours, bloc du formateur et annonces dans la cloche.
// Étudiants tutoyés, personnel vouvoyé (couche commune : ./index.ts).
import { creerTextes } from "./index";

export const t = creerTextes({
  // ── Écran /reviser ──
  "page.titre": "Réviser",
  "page.h1": { tu: "Ta révision du jour", vous: "Révision du jour" },
  "page.fermer": "Fermer",
  "page.honnete": {
    tu: "Entraînement : pas de note. Chaque carte revue compte, juste ou non : réponds honnêtement, tes réponses servent à te reposer les questions au bon moment.",
    vous: "Entraînement : pas de note. Chaque carte revue compte, juste ou non ; les réponses servent à reposer les questions au bon moment.",
  },
  "page.poids": { tu: "Paquet gardé sur ton téléphone · {ko} Ko", vous: "Paquet gardé sur le téléphone · {ko} Ko" },
  "page.horsLigne": {
    tu: "Pas de réseau : tu révises avec le paquet gardé sur ton téléphone. Tes réponses partiront au retour du réseau.",
    vous: "Pas de réseau : la révision continue avec le paquet gardé sur le téléphone. Les réponses partiront au retour du réseau.",
  },
  "page.ancien": { tu: "Paquet d'un jour précédent : tes cartes du jour arriveront au retour du réseau.", vous: "Paquet d'un jour précédent." },
  "page.sansPaquet": {
    tu: "Pas de réseau, et aucun paquet n'est encore gardé sur ce téléphone. Ouvre la révision une fois avec du réseau : elle marchera ensuite sans réseau.",
    vous: "Pas de réseau, et aucun paquet n'est encore gardé sur ce téléphone.",
  },
  "page.reessayer": "Réessayer",
  "vide.titre": "Pas encore de cartes à réviser",
  "vide.texte": {
    tu: "Tes cartes viennent des cours complets de tes cours, préparés tout seuls après chaque séance. Reviens après ton prochain cours.",
    vous: "Les cartes viennent des cours complets, préparés tout seuls après chaque séance.",
  },
  "fini.titre": { tu: "Tout est révisé pour aujourd'hui ✓", vous: "Tout est révisé pour aujourd'hui ✓" },
  "fini.demain": "Prochaine révision demain.",
  "fini.prochaine": "Prochaine révision le {jour}.",
  "fini.plus": { tu: "Réviser quand même 5 cartes d'avance", vous: "Réviser 5 cartes d'avance" },

  // ── Défi de la classe ──
  "defi.titre": { tu: "Défi de ta classe", vous: "Défi de la classe" },
  "defi.sousTitre": "{n} questions du dernier cours, les mêmes pour toute la classe",
  "defi.releve": "{n} sur {sur} l'ont relevé",
  "defi.fait": { tu: "Tu as relevé le défi ✓", vous: "Défi relevé ✓" },
  "defi.relever": "Relever le défi",

  // ── Cartes ──
  "cartes.titre": { tu: "Tes cartes du jour", vous: "Cartes du jour" },
  "cartes.resume": "{n} cartes · environ {min} min",
  "cartes.commencer": "Commencer",
  "cartes.continuer": "Continuer",
  "carte.rang": "Carte {i} sur {n}",
  "carte.nouvelle": "Nouvelle",
  "carte.boite": "Boîte {n} sur 5",
  "fiche.toucher": { tu: "Touche la carte pour voir la réponse", vous: "Touchez la carte pour voir la réponse" },
  "fiche.reponse": "Réponse",
  "fiche.savais": { tu: "Je savais", vous: "Je savais" },
  "fiche.arevoir": "À revoir",
  "qcm.bonne": "Bonne réponse !",
  "qcm.mauvaise": "La bonne réponse était {lettre}.",
  "qcm.reponses": "Réponses possibles",
  "suivante": "Carte suivante",
  "resultat": { tu: "Voir mon résultat", vous: "Voir le résultat" },

  // ── Signaler une erreur ──
  "signaler": "Signaler une erreur",
  "signaler.titre": "Qu'est-ce qui ne va pas ?",
  "signaler.fausse": "La bonne réponse est fausse",
  "signaler.floue": "La question n'est pas claire",
  "signaler.horsCours": "Ce n'était pas dans le cours",
  "signaler.annuler": "Annuler",
  "signaler.merci": { tu: "Merci : ton formateur sera prévenu si d'autres la signalent aussi.", vous: "Merci pour votre signalement." },
  "signaler.attente": { tu: "Ton signalement partira au retour du réseau.", vous: "Le signalement partira au retour du réseau." },
  "signaler.deja": { tu: "Tu as signalé cette question.", vous: "Question signalée." },

  // ── Fin de révision ──
  "fin.etiquette": { tu: "Ta révision", vous: "Révision" },
  "fin.demain": "prochaine révision demain",
  "fin.prochaine": "prochaine révision le {jour}",
  "fin.bravo": { tu: "Bravo, ta mémoire tient bon.", vous: "Bravo." },
  "fin.bien": { tu: "Bien joué : les cartes ratées reviendront demain.", vous: "Les cartes ratées reviendront demain." },
  "fin.courage": {
    tu: "C'est en se trompant qu'on retient : ces cartes reviendront demain, tu les auras.",
    vous: "Les cartes ratées reviendront demain.",
  },
  "fin.encore": "Encore {n} cartes",
  "fin.accueil": { tu: "Revenir à l'accueil", vous: "Revenir à l'accueil" },
  "fin.defiReleve": { tu: "Défi relevé : ta classe compte sur toi ✓", vous: "Défi relevé ✓" },
  "fin.attente": { tu: "En attente de réseau : tes réponses partiront toutes seules et compteront pour aujourd'hui.", vous: "Réponses en attente de réseau : elles partiront toutes seules." },
  "fin.enregistre": { tu: "Tes réponses sont enregistrées.", vous: "Réponses enregistrées." },
  "file.description": "Révision · {n} réponses",

  // ── Cours complet ──
  "cc.reviser": "Réviser ce cours en 5 min",
  "cc.recommencer": "Recommencer le quiz",
  "cc.quizCompte": {
    tu: "Entraîne-toi : chaque réponse est corrigée et expliquée, puis te sera reposée au bon moment. Pas de note.",
    vous: "Quiz d'entraînement corrigé (sans note) : les réponses des étudiants alimentent leur révision.",
  },
  "cc.fichesAide": {
    tu: "Touche une fiche pour voir la réponse, puis dis si tu savais : les fiches « À revoir » reviendront dans ta révision.",
    vous: "Fiches mémo à retourner.",
  },
  "cc.exoFait": { tu: "Je l'ai fait", vous: "Je l'ai fait" },
  "cc.exoDur": { tu: "J'ai eu du mal", vous: "J'ai eu du mal" },
  "cc.exoNote": { tu: "Noté, merci.", vous: "Noté." },
  "cc.retour.mediatheque": "Médiathèque",
  "cc.retour.accueil": "Aujourd'hui",
  "cc.retour.cours": "Le cours",
  "cc.retour.reviser": "Réviser",
  "cc.retour.replay": "L'enregistrement",

  // ── Onglet « Réviser » de la page d'un cours ──
  "cours.onglet": "Réviser",
  "cours.jour": { tu: "Ma révision du jour", vous: "Révision du jour" },
  "cours.vide": {
    tu: "Pas encore de cours complet pour ce cours : il se prépare tout seul après chaque séance enregistrée.",
    vous: "Pas encore de cours complet pour ce cours : il se prépare tout seul après chaque séance enregistrée.",
  },
  "cours.cartes": "{n} cartes",
  "cours.aRevoir": "{n} à revoir aujourd'hui",
  "cours.quiz": "Quiz : {meilleur}/{total}",
  "cours.nouveau": "Pas encore ouvert",
  "cours.ouvrir": "Ouvrir le cours complet",

  // ── Bloc du formateur et de la direction (vouvoyés) ──
  "classe.titre": "Révision de la classe",
  "classe.resume": "Révisé par {n} étudiants sur {sur}",
  "classe.moyenne": "{moyenne}/{sur} en moyenne au quiz",
  "classe.ratees": "Questions les plus ratées : {liste}",
  "classe.question": "question {n}",
  "classe.attente": "Les chiffres de la classe s'affichent à partir de {seuil} étudiants (pour l'instant : {n}).",
  "classe.notion": "Notion « {titre} », à {minute} dans l'enregistrement",
  "classe.jamaisNom": "Jamais de note ni de nom d'étudiant : seulement des chiffres de la classe.",
  "classe.aRelire": "Questions signalées ou très ratées",
  "classe.aRelireTexte": "Retirées de la révision en attendant votre décision : l'IA a pu se tromper.",
  "classe.signalee": "Signalée par {n} étudiants",
  "classe.ratee": "Ratée par {taux} % des étudiants",
  "classe.reactiver": "Réactiver la question",
  "classe.garder": "La garder retirée",
  "classe.gardee": "Gardée retirée",
  "classe.reactivee": "Question réactivée : elle revient dans la révision.",
  "classe.retiree": "Question gardée retirée.",

  // ── Annonces dans la cloche (formateurs, sans rappel sur le téléphone) ──
  "notif.titre": "Question de révision retirée",
  "notif.signalee": "{cours} · « {question} » : signalée par {n} étudiants. Vous pouvez la réactiver ou la garder retirée.",
  "notif.ratee": "{cours} · « {question} » : ratée par {taux} % des étudiants. Vérifiez-la : vous pouvez la réactiver ou la garder retirée.",
});
