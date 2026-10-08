// Textes du chantier C3 (rappels qui arrivent) : ce qui s'affiche sur l'écran
// verrouillé (résumé du matin, rappels de devoir, boutons), la carte des
// rappels de l'accueil, la vérification « L'as-tu reçu ? », le guide par
// marque et la proposition d'activer les rappels au bon moment.
// Étudiants tutoyés, personnel vouvoyé ; on écrit « rappel », jamais « notification push ».
import { creerTextes, type Dictionnaire } from "./index";

/**
 * Espaces insécables de la typographie française (avant « : ? ! ; », dans les
 * guillemets) : sur un écran de 360 px, jamais un deux-points ni un guillemet
 * seul en début de ligne. Les textes s'écrivent avec des espaces ordinaires.
 */
function insecables<D extends Dictionnaire>(d: D): D {
  const fixer = (s: string) => s.replace(/ ([:;?!»])/g, " $1").replace(/« /g, "« ");
  return Object.fromEntries(Object.entries(d).map(([cle, v]) => [cle, typeof v === "string" ? fixer(v) : { tu: fixer(v.tu), vous: fixer(v.vous) }])) as D;
}

export const t = creerTextes(insecables({
  // ── Écran verrouillé ─────────────────────────────────────────────────────
  "push.note.titre": "Nouvelle note disponible",
  "push.note.corps": { tu: "Ouvre le campus pour la découvrir.", vous: "Ouvrez le campus pour la découvrir." },
  "push.masque.titre": "Nouveau sur le campus",
  "push.masque.corps": { tu: "Ouvre le campus pour voir.", vous: "Ouvrez le campus pour voir." },
  "action.rejoindre": "Rejoindre",
  "action.rendre": { tu: "Rendre mon devoir", vous: "Rendre le devoir" },
  "action.quiz": { tu: "Faire l'interrogation", vous: "Ouvrir l'interrogation" },

  // Résumé du matin : l'échéance du jour en tête, jamais un message en clair.
  "resume.echeance.depot": { tu: "Aujourd'hui : rends « {titre} » avant {heure}", vous: "Aujourd'hui : « {titre} » à rendre avant {heure}" },
  "resume.echeance.quiz": {
    tu: "Aujourd'hui : fais l'interrogation « {titre} » avant {heure}",
    vous: "Aujourd'hui : interrogation « {titre} » à faire avant {heure}",
  },
  "resume.echeance.corps": { tu: "Touche ici pour t'y mettre maintenant.", vous: "Touchez ici pour vous y mettre maintenant." },
  "resume.plus.un": "+ 1 nouveauté sur le campus",
  "resume.plus.n": "+ {n} nouveautés sur le campus",
  "resume.titre": { tu: "{n} nouveautés t'attendent sur le campus", vous: "{n} nouveautés vous attendent sur le campus" },
  "resume.corps": { tu: "Ouvre le campus pour les voir.", vous: "Ouvrez le campus pour les voir." },

  // Rappels d'un devoir : la veille entre 17 h et 20 h, le jour même à partir de 12 h.
  "devoir.veille.titre.depot": "Rappel : « {titre} » à rendre demain",
  "devoir.veille.titre.quiz": "Rappel : interrogation « {titre} » demain",
  "devoir.veille.corps": { tu: "{code} · il te reste jusqu'à demain {heure} (heure d'Abidjan).", vous: "{code} · à rendre avant demain {heure} (heure d'Abidjan)." },
  "devoir.jourj.titre.depot": { tu: "Aujourd'hui : rends « {titre} » avant {heure}", vous: "Aujourd'hui : « {titre} » à rendre avant {heure}" },
  "devoir.jourj.titre.quiz": {
    tu: "Aujourd'hui : fais l'interrogation « {titre} » avant {heure}",
    vous: "Aujourd'hui : interrogation « {titre} » avant {heure}",
  },
  "devoir.jourj.corps": { tu: "{code} · il te reste quelques heures (heure d'Abidjan).", vous: "{code} · il reste quelques heures (heure d'Abidjan)." },

  // Réponses du serveur
  "erreur.inconnu": { tu: "Ce téléphone n'est plus inscrit aux rappels : réactive-les.", vous: "Ce téléphone n'est plus inscrit aux rappels : réactivez-les." },

  // ── Carte des rappels (accueil) ──────────────────────────────────────────
  "carte.activer.titre": { tu: "Ne rate plus ton cours : active les rappels", vous: "Ne manquez plus un cours : activez les rappels" },
  "carte.activer.texte": {
    tu: "3 rappels par jour au plus, jamais la nuit : avant chaque cours en direct, la veille d'une échéance et quand un formateur te répond.",
    vous: "3 rappels par jour au plus, jamais la nuit : avant chaque cours en direct et quand un message vous attend.",
  },
  "carte.activer.bouton": "Activer les rappels",
  "carte.activer.aide": {
    tu: "Ton téléphone va demander l'autorisation : touche « Autoriser ».",
    vous: "Votre téléphone va demander l'autorisation : touchez « Autoriser ».",
  },
  "carte.perdu.titre": { tu: "Tes rappels ne marchent plus sur ce téléphone", vous: "Vos rappels ne fonctionnent plus sur ce téléphone" },
  "carte.perdu.texte": {
    tu: "Ton téléphone a oublié son inscription aux rappels. Réactive-les en un toucher pour ne rien rater.",
    vous: "Votre téléphone a oublié son inscription aux rappels. Réactivez-les en un toucher.",
  },
  "carte.perdu.bouton": "Réactiver les rappels",
  "carte.bloque.titre": "Les rappels sont bloqués sur ce téléphone",
  "carte.bloque.texte": {
    tu: "Sans rappel, tu risques de rater le début d'un cours ou une échéance. Tu peux les débloquer en trois gestes.",
    vous: "Sans rappel, vous risquez de manquer le début d'un cours. Vous pouvez les débloquer en trois gestes.",
  },
  "carte.bloque.bouton": "Voir comment débloquer",
  "carte.verifier.titre": { tu: "Vérifions que tes rappels arrivent", vous: "Vérifions que vos rappels arrivent" },
  "carte.verifier.texte": {
    tu: "Certains téléphones bloquent les rappels sans prévenir. Un essai suffit pour en avoir le cœur net.",
    vous: "Certains téléphones bloquent les rappels sans prévenir. Un essai suffit pour en avoir le cœur net.",
  },
  "carte.pasRecu.titre": { tu: "Tes rappels n'arrivent pas encore", vous: "Vos rappels n'arrivent pas encore" },
  "carte.pasRecu.texte": {
    tu: "Ton téléphone les bloque sans doute pour économiser la batterie. Un réglage suffit, puis renvoie un essai.",
    vous: "Votre téléphone les bloque sans doute pour économiser la batterie. Un réglage suffit, puis renvoyez un essai.",
  },
  "carte.plusTard": "Plus tard",
  "carte.active": "Rappels activés sur ce téléphone.",
  "carte.refusTemporaire": { tu: "Pas de souci : tu pourras activer les rappels plus tard.", vous: "Pas de souci : vous pourrez activer les rappels plus tard." },
  "carte.erreur": { tu: "L'inscription aux rappels a échoué. Réessaie dans un instant.", vous: "L'inscription aux rappels a échoué. Réessayez dans un instant." },

  // ── Vérification « L'as-tu reçu ? » ──────────────────────────────────────
  "verif.essai": "M'envoyer un essai",
  "verif.question": {
    tu: "Un rappel d'essai vient de partir. L'as-tu reçu sur ce téléphone ?",
    vous: "Un rappel d'essai vient de partir. L'avez-vous reçu sur ce téléphone ?",
  },
  "verif.questionPlusTard": { tu: "As-tu reçu le rappel d'essai sur ce téléphone ?", vous: "Avez-vous reçu le rappel d'essai sur ce téléphone ?" },
  "verif.delai": "Il peut mettre jusqu'à une minute à arriver.",
  "verif.oui": "Oui, je l'ai reçu",
  "verif.non": "Non, rien reçu",
  "verif.ok": { tu: "Parfait : tes rappels arrivent sur ce téléphone.", vous: "Parfait : vos rappels arrivent sur ce téléphone." },
  "verif.nuit": {
    tu: "Il est tard : rien ne sonne entre 21 h et 6 h. L'essai partira demain matin ; reviens ici nous dire s'il est arrivé.",
    vous: "Il est tard : rien ne sonne entre 21 h et 6 h. L'essai partira demain matin ; revenez ici nous dire s'il est arrivé.",
  },
  "verif.plafond": {
    tu: "Tu as déjà reçu 3 rappels aujourd'hui : l'essai partira demain matin. Reviens ici nous dire s'il est arrivé.",
    vous: "Vous avez déjà reçu 3 rappels aujourd'hui : l'essai partira demain matin. Revenez ici nous dire s'il est arrivé.",
  },
  "verif.indisponible": "Les rappels ne sont pas disponibles pour le moment.",
  "verif.renvoyer": "Renvoyer un essai",
  "verif.attente": { tu: "Patiente une minute avant un nouvel essai.", vous: "Patientez une minute avant un nouvel essai." },

  // ── Guide par marque (Android) ───────────────────────────────────────────
  "guide.titre": { tu: "Quelle est la marque de ton téléphone ?", vous: "Quelle est la marque de votre téléphone ?" },
  "guide.sousTitre": { tu: "Un toucher suffit : on te montre quoi régler.", vous: "Un toucher suffit : le campus vous montre quoi régler." },
  "guide.marque.tecno": "TECNO",
  "guide.marque.infinix": "Infinix",
  "guide.marque.itel": "itel",
  "guide.marque.samsung": "Samsung",
  "guide.marque.autre": "Autre marque",
  "guide.etapesTitre": { tu: "Sur ton {marque}", vous: "Sur votre {marque}" },
  "guide.tecno.1": { tu: "Ouvre l'application Phone Master.", vous: "Ouvrez l'application Phone Master." },
  "guide.tecno.2": { tu: "Touche « Démarrage auto » (ou « Gestion du démarrage »).", vous: "Touchez « Démarrage auto » (ou « Gestion du démarrage »)." },
  "guide.tecno.3": { tu: "Active {app}.", vous: "Activez {app}." },
  "guide.infinix.1": { tu: "Ouvre Phone Master (ou « Gestionnaire du téléphone »).", vous: "Ouvrez Phone Master (ou « Gestionnaire du téléphone »)." },
  "guide.infinix.2": { tu: "Touche « Démarrage auto ».", vous: "Touchez « Démarrage auto »." },
  "guide.infinix.3": { tu: "Active {app}.", vous: "Activez {app}." },
  "guide.itel.1": { tu: "Ouvre Phone Master (ou Paramètres › Batterie).", vous: "Ouvrez Phone Master (ou Paramètres › Batterie)." },
  "guide.itel.2": { tu: "Touche « Démarrage auto » (ou « Gestion du lancement »).", vous: "Touchez « Démarrage auto » (ou « Gestion du lancement »)." },
  "guide.itel.3": { tu: "Active {app}.", vous: "Activez {app}." },
  "guide.samsung.1": { tu: "Ouvre Paramètres › Batterie (ou « Entretien de l'appareil »).", vous: "Ouvrez Paramètres › Batterie (ou « Entretien de l'appareil »)." },
  "guide.samsung.2": {
    tu: "Touche « Limites d'utilisation en arrière-plan », puis « Applis jamais en veille ».",
    vous: "Touchez « Limites d'utilisation en arrière-plan », puis « Applis jamais en veille ».",
  },
  "guide.samsung.3": { tu: "Ajoute {app} à la liste.", vous: "Ajoutez {app} à la liste." },
  "guide.autre.1": { tu: "Ouvre Paramètres › Applications › {app}.", vous: "Ouvrez Paramètres › Applications › {app}." },
  "guide.autre.2": {
    tu: "Touche « Batterie » et choisis « Sans restriction » (ou « Ne pas optimiser »).",
    vous: "Touchez « Batterie » et choisissez « Sans restriction » (ou « Ne pas optimiser »).",
  },
  "guide.autre.3": { tu: "Touche « Notifications » et vérifie qu'elles sont autorisées.", vous: "Touchez « Notifications » et vérifiez qu'elles sont autorisées." },
  "guide.notifications": {
    tu: "Vérifie aussi que {app} a le droit d'afficher des notifications : Paramètres › Applications › {app} › Notifications.",
    vous: "Vérifiez aussi que {app} a le droit d'afficher des notifications : Paramètres › Applications › {app} › Notifications.",
  },
  "guide.iphone": {
    tu: "Sur iPhone : Réglages › Notifications › Campus 2IAE, puis « Autoriser les notifications ».",
    vous: "Sur iPhone : Réglages › Notifications › Campus 2IAE, puis « Autoriser les notifications ».",
  },
  "guide.ordinateur": {
    tu: "Sur ordinateur : laisse le navigateur ouvert et autorise les notifications du campus dans ses réglages.",
    vous: "Sur ordinateur : laissez le navigateur ouvert et autorisez les notifications du campus dans ses réglages.",
  },
  "guide.aussiApp": { tu: "Fais de même pour l'application Campus 2IAE.", vous: "Faites de même pour l'application Campus 2IAE." },
  "guide.ensuite": { tu: "Ensuite, renvoie un essai.", vous: "Ensuite, renvoyez un essai." },
  "guide.changer": "Changer de marque",
  "guide.aide": "Besoin d'aide ?",
  "guide.aideTexte": { tu: "Écris à la vie scolaire sur WhatsApp : elle t'aide à régler ton téléphone.", vous: "Écrivez à la vie scolaire sur WhatsApp : elle vous aide à régler votre téléphone." },

  // ── Proposition au bon moment ────────────────────────────────────────────
  "proposer.rendu.titre": "Un rappel avant la prochaine échéance ?",
  "proposer.rendu.texte": {
    tu: "Le campus te prévient la veille, puis le jour même si tu n'as pas encore rendu. Jamais la nuit.",
    vous: "Le campus vous prévient la veille, puis le jour même. Jamais la nuit.",
  },
  "proposer.live.titre": { tu: "On te prévient avant le prochain cours ?", vous: "Être prévenu avant le prochain cours ?" },
  "proposer.live.texte": {
    tu: "Un rappel 15 minutes avant chaque cours en direct. 3 rappels par jour au plus, jamais la nuit.",
    vous: "Un rappel 15 minutes avant chaque cours en direct. 3 rappels par jour au plus, jamais la nuit.",
  },
  "proposer.revision.titre": { tu: "Un rappel pour ta révision de demain ?", vous: "Un rappel pour votre révision de demain ?" },
  "proposer.revision.texte": "3 rappels par jour au plus, jamais la nuit.",
  "proposer.bouton": "Activer les rappels",
}));
