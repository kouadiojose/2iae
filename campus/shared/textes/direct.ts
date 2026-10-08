// Textes du chantier C6 (directs : émargement et participation en salle, puis
// présence en ligne). Couche commune : shared/textes/index.ts. Étudiants
// tutoyés, personnel vouvoyé ; un texte qui ne s'adresse qu'aux étudiants (écran
// de la salle, téléphone) est écrit directement au tutoiement.
import { creerTextes } from "./index";

export const t = creerTextes({
  // ── Rappel unique au démarrage du direct (téléphone des étudiants, décision D3) ──
  // Étudiant d'un campus qui suit le cours : les deux cas dans un seul rappel (salle ou en ligne).
  "demarrage.titre": "Le cours commence : {titre}",
  "demarrage.salle.corps": "{code} · en salle ? Scanne le QR de l'écran pour être compté présent. Sinon, rejoins le cours en ligne.",
  "demarrage.emarge.corps": "{code} · tu es déjà compté présent ✓ Ouvre le mode salle pour participer.",
  // Étudiant sans campus, ou dont le campus ne suit pas ce cours : en ligne seulement.
  "demarrage.enLigne.titre": "En direct : {titre}",
  "demarrage.enLigne.corps": "{code} · le formateur a ouvert la classe. Entre maintenant.",

  // ── Écran de salle : QR plein écran ─────────────────────────────────────
  "salle.qr.etiquette": "Émargement · {salle} · {site}",
  "salle.qr.titre": "Scanne le QR pour être compté présent",
  "salle.qr.code": "ou tape ce code dans le campus",
  "salle.qr.change": "Le code change chaque minute.",
  "salle.qr.emarges.zero": "Personne n'est encore émargé à {site}",
  "salle.qr.emarges.un": "émargé à {site}",
  "salle.qr.emarges": "émargés à {site}",
  "salle.qr.classement": "Part des étudiants émargés, par campus",
  "salle.qr.taux": "{n} %",
  "salle.qr.retrait": "Ce message se retire tout seul dans {n} s · le cours continue",

  // ── Écran de salle : mini-guide du chargé de cours (avant le cours) ──────
  "guide.etiquette": "Chargé de cours",
  "guide.titre": "Vous n'avez rien à faire",
  "guide.ouvert": "Laissez cet écran ouvert : il suit le cours tout seul.",
  "guide.scanner": "Rappelez aux étudiants de scanner le QR en arrivant : chacun est compté présent.",
  "guide.moments": "Le QR revient en grand au début du cours, puis à +15 et à +45 min, une minute à chaque fois.",

  // ── Studio : « Afficher l'émargement » ───────────────────────────────────
  "studio.afficher": "Afficher l'émargement",
  "studio.afficher.aide": "Remet le QR d'émargement en grand sur l'écran de toutes les salles, pendant une minute.",
  "studio.afficher.sondage": "Fermez d'abord le sondage : le QR ne s'affiche jamais pendant un sondage.",
  "studio.afficher.ok": "Le QR d'émargement s'affiche une minute dans toutes les salles.",
  "studio.afficher.encours": "QR affiché · {n} s",
  "studio.afficher.auto": "Le QR s'affiche aussi tout seul dans les salles au début, à +15 et à +45 min.",
  "erreur.afficher.direct": "L'émargement s'affiche pendant le direct : avant le cours, l'écran de la salle montre déjà le QR.",
  "erreur.afficher.sondage": "Un sondage est en cours : fermez-le avant d'afficher l'émargement.",

  // ── Téléphone : page d'émargement ───────────────────────────────────────
  "emargement.saisie.titre": "Tu es en salle ?",
  "emargement.saisie.texte": "Scanne le QR de l'écran de la salle avec l'appareil photo de ton téléphone, ou tape le code à 4 chiffres affiché dessous.",
  "emargement.saisie.code": "Le code affiché sur l'écran de la salle",
  "emargement.saisie.valider": "Valider ma présence",
  "emargement.saisie.enLigne": "Je suis le cours en ligne",
  "emargement.ok.titre": "Tu es compté présent ✓",
  "emargement.ok.son": "{prenom}, garde le son coupé : le cours passe par l'écran de la salle. Ton téléphone sert à poser tes questions, répondre aux sondages et réagir.",
  "emargement.ok.participer": "Participer au cours",
  "emargement.ok.suite": "Le mode salle s'ouvre dans {n} s…",

  // ── Téléphone : mode compagnon (en salle, sans vidéo) ───────────────────
  "compagnon.present": "Tu es compté présent ✓",
  "compagnon.present.detail": "{site} · émargé à {heure}",
  "compagnon.son": "Son coupé : suis le cours sur l'écran de la salle.",
  "compagnon.aVenir": "Le cours commence à {heure}. Tu peux déjà poser tes questions : elles attendront le formateur.",
  "compagnon.classement": "Émargés par campus, en part des attendus",
  "compagnon.sondage": "Sondage en direct · réponds ici",
  "compagnon.sondage.ia": "Question de rappel, proposée par l'IA et validée par le formateur",
  "compagnon.sondage.resultats": "Résultats du sondage",
  "compagnon.sondage.envoye": "✓ Réponse envoyée : {lettre}. Les résultats arrivent en direct.",
  "compagnon.sondage.bientot": "Résultats bientôt.",
  "compagnon.reagir": "Ta réaction, sans ton nom",
  "compagnon.onglet.questions": "Questions",
  "compagnon.onglet.discussion": "Discussion",
  "compagnon.onglet.campus": "Campus",
  "compagnon.donnees": "Mode salle : ni vidéo ni son, moins de 5 Mo par heure.",
  "compagnon.plusEnSalle": "Je ne suis plus dans la salle",
  "compagnon.quitter": "Quitter",

  // ── Téléphone en ligne : jauge de présence ──────────────────────────────
  "jauge.compte": "Ta présence : {minutes} / {seuil} min · encore {reste} min pour être compté présent",
  "jauge.present": "Présent ✓ · {minutes} min suivies",
  "jauge.salle.present": "Tu es compté présent ✓ (émargé en salle)",
  "jauge.pause": "Ta présence est en pause : garde le campus ouvert",
  "jauge.salle": "En salle ? Émarge avec le code de l'écran pour être compté",
  "jauge.salle.bouton": "Émarger",

  // ── Sortie du direct ────────────────────────────────────────────────────
  "sortie.etiquette": "À bientôt",
  "sortie.suivi": "Tu as suivi {minutes} min",
  "sortie.suivi.present": "Tu as suivi {minutes} min · présent ✓",
  "sortie.salle": "Tu étais en salle · présent ✓",
  "sortie.ressenti": "Ce cours, pour toi ?",
  "sortie.ressenti.merci": "Merci : le formateur le voit, sans ton nom.",
  // Sans promesse ferme : l'enregistrement peut manquer, la routine du soir peut prendre du retard.
  "sortie.suite": "Dès qu'il est prêt, en général le soir même : le cours complet et ses questions, puis ta révision de 3 minutes. Tout arrive sur ton accueil.",
  "sortie.cout": "Ce cours t'a coûté environ {mo}.",
  "sortie.cout.moins": "Ce cours t'a coûté moins de 1 Mo.",
  "sortie.mesure": "Consommation mesurée sur ton téléphone · {minutes} min de cours.",
  "sortie.estimation": "Estimation pour le mode « {mode} » · {minutes} min de cours.",
  "sortie.radio": "En vidéo, c'est environ dix fois plus.",
  "sortie.revenir": "Revenir dans la classe",
  "sortie.lives": "Retour à mes lives",

  // ── Studio : questions de rappel et silence prolongé ────────────────────
  "rappelQ.titre": "Questions de rappel prêtes (séance du {date})",
  "rappelQ.ia": "Proposé par l'IA · relisez avant de lancer",
  "rappelQ.lancer": "Lancer",
  "rappelQ.preparer": "Préparer",
  "rappelQ.lancee": "Lancée",
  "rappelQ.ok": "Question de rappel lancée dans les cinq campus.",
  "rappelQ.prepare": "Question préparée : lancez-la pendant le direct.",
  "interaction.silence": "Aucune interaction depuis {n} min : lancez une question de rappel.",
  "interaction.voir": "Voir les questions",
  "interaction.plusTard": "Plus tard",

  // ── Présences de l'étudiant (trois états) ───────────────────────────────
  "presences.titre": "Mes présences",
  "presences.intro": "Tes 20 dernières séances : en salle (émargé avec le QR) ou en ligne jusqu'au bout.",
  "presences.present": "Présent ✓",
  "presences.absent": "Non compté présent : rattraper",
  "presences.absent.court": "Non compté présent",
  "presences.inconnu": "Présence non relevée",
  "presences.inconnu.aide": "Ta salle n'a pas été émargée ce jour-là : rien n'est compté contre toi.",
  "presences.enSalle": "en salle",
  "presences.enLigne": "{n} min en ligne",
  "presences.replay": "Revoir",
  "presences.coursComplet": "Cours complet",
  "presences.coursComplet.attente": "Cours complet en préparation",
  "presences.vide": "Aucune séance tenue pour l'instant.",
  "presences.chargement": "Chargement de tes présences…",
  "fin.present": "Ta présence : présent ✓",
  "fin.absent": "Ta présence : non compté présent",
  "fin.inconnu": "Ta présence n'a pas été relevée : ta salle n'a pas été émargée.",

  // ── Erreurs du serveur ──────────────────────────────────────────────────
  "erreur.etudiant": "Cette page est réservée aux étudiants.",
});
