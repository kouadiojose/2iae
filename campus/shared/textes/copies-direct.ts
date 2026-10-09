// Textes des copies montrées pendant le direct (demande de José du 9 octobre 2026 : voir les devoirs
// et les copies sans quitter le Studio, et en projeter une à toute la classe). Couche commune :
// shared/textes/index.ts. Personnel vouvoyé (Studio, erreurs du serveur) ; textes des écrans de la classe
// neutres ; le texte du mode compagnon, lu par les seuls étudiants, est écrit au tutoiement.
import { creerTextes } from "./index";

export const t = creerTextes({
  // ── Bouton d'en-tête du Studio ──
  "bouton": "Devoirs",
  "bouton.actif": "Devoirs · copie montrée",
  "bouton.aide": "Voir les devoirs et les copies du cours, et en montrer une à toute la classe, sans quitter le direct.",

  // ── Vue « Devoirs et copies » ──
  "vue.titre": "Devoirs et copies · {code}",
  "vue.revenir": "Revenir au studio",
  "vue.direct": "Le direct continue : la classe vous entend.",
  "vue.mains.une": "1 main levée",
  "vue.mains": "{n} mains levées",
  "vue.partage": "Votre écran est partagé dans la visio : la classe et l'enregistrement voient cette page. Les noms sont masqués.",
  "vue.avantDirect": "Vous pourrez montrer une copie une fois le direct démarré. En attendant, vous pouvez tout regarder.",
  "vue.chargement": "Chargement…",
  "vue.erreur": "Impossible de charger les devoirs. Vérifiez votre connexion.",
  "vue.reessayer": "Réessayer",

  // ── Étape 1 : devoirs ──
  "devoirs.titre": "1. Choisissez un devoir",
  "devoirs.changer": "Changer de devoir",
  "devoirs.vide": "Ce cours n'a pas encore de devoir.",
  "devoirs.rendues.zero": "Aucune copie rendue",
  "devoirs.rendues.une": "1 copie rendue sur {inscrits}",
  "devoirs.rendues": "{n} copies rendues sur {inscrits}",
  "devoirs.limite": "Date limite : {date}",
  "devoirs.ouvert": "Encore ouvert jusqu'au {date}",
  "devoirs.retards": "Retards acceptés",
  "devoirs.quiz": "Interrogation en ligne : les réponses restent privées, elle ne se montre pas en direct.",

  // ── Étape 2 : copies ──
  "copies.titre": "2. Choisissez une copie",
  "copies.retour": "Tous les devoirs",
  "copies.recherche": "Rechercher un prénom",
  "copies.vide": "Aucune copie rendue pour ce devoir.",
  "copies.aucunResultat": "Aucune copie à ce prénom.",
  "copies.retard": "En retard",
  "copies.rendueLe": "rendue le {date}",
  "copies.anonyme": "Copie {n}",
  "copies.aLEcran": "À l'écran",
  "copies.info": "La classe ne voit jamais le nom de l'étudiant, sauf si vous le choisissez. La note et vos commentaires ne sont jamais montrés.",
  "resume.texte": "texte",
  "resume.photo": "1 photo",
  "resume.photos": "{n} photos",
  "resume.pdf": "{n} PDF",
  "resume.document": "1 document",
  "resume.documents": "{n} documents",
  "resume.video": "1 vidéo",
  "resume.videos": "{n} vidéos",
  "resume.son": "1 son",
  "resume.sons": "{n} sons",
  "resume.autre": "1 autre fichier",
  "resume.autres": "{n} autres fichiers",

  // ── Étape 3 : aperçu ──
  "apercu.titre": "3. Vérifiez puis projetez",
  "apercu.choisir": "Choisissez une copie dans la liste : vous la voyez ici avant la classe.",
  "apercu.prive": "Aperçu pour vous seul : la classe ne voit rien tant que vous n'avez pas appuyé sur « Projeter à la classe ».",
  "apercu.page": "Page {n} sur {total}",
  "apercu.precedente": "Page précédente",
  "apercu.suivante": "Page suivante",
  "apercu.tourner": "Tourner",
  "apercu.nom": "Montrer le prénom à la classe",
  "apercu.nom.aide": "La classe lira « {etiquette} ».",
  "apercu.entete": "Cacher le haut de la page",
  "apercu.entete.aide": "L'étudiant y écrit souvent son nom. Désactivez si la consigne y figure.",
  "apercu.entete.indispo": "Vérifiez que le nom de l'étudiant n'est pas écrit sur la page avant de la montrer.",
  "apercu.preparation": "Préparation de la copie…",
  "apercu.preparationDoc": "Préparation du document (jusqu'à une minute)…",
  "apercu.erreur": "Cette page n'a pas pu être préparée. Essayez une autre page ou une autre copie.",
  "apercu.retards.un": "Ce devoir accepte encore les copies en retard : un étudiant qui ne l'a pas rendu verra cette page.",
  "apercu.retards": "Ce devoir accepte encore les copies en retard : {n} étudiants qui ne l'ont pas rendu verront cette page.",
  "apercu.projeter": "Projeter à la classe",
  "apercu.projeterPlace": "Projeter à la place",
  "apercu.projeter.aide": "La page s'affiche à la place de la diapo dans les cinq salles et chez les étudiants en ligne.",
  "apercu.envoi": "Envoi à la classe…",
  "apercu.dejaProjetee": "La classe voit déjà cette page.",
  "apercu.zoom": "Zoom de l'aperçu",
  "apercu.lire": "Lire en grand",
  "apercu.preparationProjeter": "Le document se prépare : ses pages s'ajoutent à la fin de la liste dès qu'il est prêt.",

  // ── Confirmation : devoir encore ouvert ──
  "ouvert.titre": "Des étudiants peuvent encore rendre ce devoir",
  "ouvert.texte.un": "Un étudiant peut encore rendre ou remplacer sa copie jusqu'au {date}. En montrant une copie, vous lui montrez une réponse.",
  "ouvert.texte": "{n} étudiants peuvent encore rendre ou remplacer leur copie jusqu'au {date}. En montrant une copie, vous leur montrez une réponse.",
  "ouvert.confirmer": "Montrer quand même",
  "ouvert.annuler": "Annuler",

  // ── Fichiers non projetables ──
  "non.video": "Vidéo jointe : elle ne se projette pas en direct.",
  "non.video.lien": "Ouvrir la page des copies dans un nouvel onglet",
  "non.audio": "Enregistrement audio : il ne se projette pas en direct.",
  "non.heic": "Photo au format iPhone (HEIC) : ce campus ne sait pas encore l'afficher.",
  "non.pdf": "PDF : ce campus ne sait pas encore l'afficher en direct.",
  "non.document": "Document Word, Excel ou PowerPoint : ce campus ne sait pas encore l'afficher en direct. Demandez une photo ou un PDF.",
  "non.zip": "Fichier compressé : il ne s'affiche pas en direct.",
  "non.format": "Ce fichier ne se projette pas.",
  "non.erreur": "Fichier abîmé ou illisible.",
  "non.taille": "Fichier trop lourd pour être montré en direct.",
  "non.indisponible": "Le fichier n'a pas pu être lu. Réessayez dans un instant.",
  "non.pages": "Seules les {max} premières pages se montrent en direct.",
  "non.rien": "Rien dans cette copie ne se projette en direct.",

  // ── Copie à l'écran (Studio, fenêtre présentateur) ──
  "copie.etat": "Copie montrée aux salles · page {n} / {total}",
  "copie.etatCorrige": "Corrigé montré aux salles · page {n} / {total}",
  "copie.zoom": "Zoom",
  "zone.page": "Page entière",
  "zone.haut": "Haut",
  "zone.milieu": "Milieu",
  "zone.bas": "Bas",
  "copie.zoom.aide": "Agrandit une partie de la page dans les salles.",
  "copie.revenir": "Revenir aux diapos",
  "copie.arreter": "Arrêter de montrer la copie",
  "copie.revenir.diapo": "Les salles retrouvent la diapo {n}.",
  "copie.revenir.cameras": "Les salles retrouvent les caméras.",
  "copie.touches": "← → ou télécommande : pages de la copie, puis retour aux diapos.",
  "copie.bande": "Copie à l'écran · page {n} / {total} · touches ← →",
  "copie.envoi": "Envoi…",

  // ── Toasts ──
  "toast.projetee": "La copie s'affiche dans les cinq salles et chez les étudiants en ligne.",
  "toast.video": "La vidéo s'arrête : la copie la remplace.",
  "toast.retour": "Les salles revoient vos diapos.",
  "toast.retourCameras": "Les salles revoient les caméras.",
  "toast.remplacee": "L'étudiant vient de remplacer sa copie : elle n'est plus montrée. Rouvrez « Devoirs » pour montrer la nouvelle version.",
  "toast.partage": "Votre partage d'écran passe en grand : la copie n'est plus montrée.",
  "toast.corrigeModifie": "Le corrigé vient d'être modifié : il n'est plus montré. Rouvrez « Devoirs » pour montrer la nouvelle version.",

  // ── Écrans de la classe ──
  "classe.anonyme": "Copie d'un étudiant",
  "classe.nom": "Copie {de}{prenom} {initiale}",
  "classe.corrige": "Corrigé du devoir",
  "classe.legende": "{etiquette} · {devoir} · page {n} / {total}",
  "classe.legendeCourte": "{etiquette} · p. {n}/{total}",
  "classe.agrandir": "Agrandir",
  "lecteur.fermer": "Fermer",
  "lecteur.aide": { vous: "Faites défiler pour lire toute la page.", tu: "Fais défiler pour lire toute la page." },
  "classe.chargement": "La copie arrive…",
  "classe.compagnon": "Regarde l'écran de la salle : le formateur montre une copie.",
  "invite.carton": "Le formateur montre une copie d'étudiant à la classe. Elle reste réservée aux étudiants du cours.",

  // ── Replay et bilan ──
  "replay.titre": "Montré à la classe pendant le cours",
  "replay.copie": "Copie d'un étudiant · devoir « {devoir} »",
  "replay.corrige": "Corrigé du devoir « {devoir} »",
  "replay.revoir": "Revoir ce moment",
  "replay.note": "Les copies ne sont pas gardées dans le replay : elles n'étaient visibles que pendant le cours.",
  "bilan.copie": "Copie d'un étudiant montrée à la classe (devoir « {devoir} »)",
  "bilan.copieNom": "Copie d'un étudiant montrée à la classe, prénom affiché (devoir « {devoir} »)",
  "bilan.corrige": "Corrigé du devoir « {devoir} » montré à la classe",
  "bilan.fin": "Fin de la copie montrée ({duree})",
  "bilan.remplacee": "Copie retirée de l'écran : l'étudiant l'a remplacée",
  "bilan.corrigeModifie": "Corrigé retiré de l'écran : il a été modifié",
  "bilan.nomAffiche": "Prénom de l'étudiant affiché à la classe (devoir « {devoir} »)",
  "bilan.nomMasque": "Prénom de l'étudiant de nouveau masqué (devoir « {devoir} »)",
  "duree.secondes": "{n} s",
  "duree.minutes": "{n} min",

  // ── Erreurs du serveur ──
  "erreur.droits": "Seuls le formateur du cours, la direction et la vie scolaire qui anime ce cours montrent les copies pendant le direct.",
  "erreur.termine": "Le direct est terminé.",
  "erreur.pasEnDirect": "Les copies se montrent pendant le direct : démarrez d'abord le direct.",
  "erreur.planB": "Plan B en cours : la classe suit le lien de secours, la copie ne s'afficherait pas.",
  "erreur.autreCours": "Cette copie n'appartient pas à un devoir de ce cours.",
  "erreur.quiz": "Les interrogations en ligne ne se montrent pas en direct : leurs réponses restent privées.",
  "erreur.page": "Cette page n'existe pas dans la copie.",
  "erreur.preparation": "Le document est encore en préparation : réessayez dans quelques secondes.",
  "erreur.echec": "La copie n'a pas pu être préparée. Réessayez, ou montrez une autre copie.",
  "erreur.aucune": "Aucune copie n'est montrée en ce moment.",
  "erreur.changee": "La projection a changé pendant la préparation : réessayez.",
  "erreur.ouvert": "Des étudiants peuvent encore rendre ce devoir : confirmez avant de montrer une copie.",
  "erreur.plusMontree": "Cette copie n'est plus montrée à la classe.",
  "erreur.copieChangee": "L'étudiant vient de remplacer sa copie : regardez la nouvelle version avant de la montrer.",
  "erreur.copieRemplacee": "L'étudiant vient de remplacer sa copie : elle n'est plus montrée. Rouvrez « Devoirs » pour montrer la nouvelle version.",
  "erreur.corrigeModifie": "Le corrigé vient d'être modifié : il n'est plus montré. Rouvrez « Devoirs » pour montrer la nouvelle version.",

  // ── Corrigé (lot 5) ──
  "corrige.titre": "Corrigé du devoir",
  "corrige.projeter": "Voir le corrigé",
  "corrige.montrable": "Peut être montré à la classe",
  "corrige.absent": "Pas encore de corrigé pour ce devoir.",
  "corrige.nonValide": "Le corrigé n'est pas encore validé : il ne se montre pas à la classe.",
  "corrige.avantLimite": "Le corrigé se montre après la date limite ({date}).",
  "corrige.retards": "Ce devoir accepte les copies en retard : le corrigé ne se montre pas, pour qu'aucune copie rendue plus tard ne le recopie. Pour le montrer, refusez les retards dans les réglages du devoir.",
  "corrige.notes.une": "Encore une copie à noter ou à publier : le corrigé se montre une fois toutes les notes publiées.",
  "corrige.notes": "Encore {n} copies à noter ou à publier : le corrigé se montre une fois toutes les notes publiées.",
});

/**
 * « d' » devant une voyelle, un h ou un « y » suivi d'une consonne (Yves), sinon « de » : « Copie d'Awa K. »,
 * « Copie de Yao K. », « Copie d'Hervé T. ». Même règle sur le serveur et dans le Studio.
 */
export function deDevant(prenom: string): string {
  const s = prenom.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /^[aeiouh]/.test(s) || /^y[^aeiouy]/.test(s) ? "d'" : "de ";
}
