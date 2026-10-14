// Textes de la régie des cours en direct (profil « Chargé de cours », droit « animer » : ext-profils.ts) :
// « Mon espace » (/regie), lien intervenant (fenêtre, message WhatsApp), repère de régie dans le Studio,
// fenêtre d'ouverture de la classe, préparation en mode régie, radio des téléphones qui part d'un autre poste,
// garde « au plus tôt une heure avant » (routes/regie.ts). Couche commune : shared/textes/index.ts.
// Personnel vouvoyé ; pas de tiret long ; mots du lexique du campus (jamais « session » ni « streaming »).
// Le libellé et la description du profil restent dans ext-profils.ts (la matrice unique des droits).
import { creerTextes } from "./index";

export const t = creerTextes({
  // ── Navigation ──────────────────────────────────────────────────────────
  "nav.espace": "Mon espace",
  "nav.regieDirection": "Régie des cours",

  // ── « Mon espace » ──────────────────────────────────────────────────────
  "espace.etiquette": "Régie des cours",
  "espace.titre": "Mon espace",
  "espace.sousTitre": "Les cours du jour de tous les campus : ouvrez la classe, ajoutez le PowerPoint et les vidéos, envoyez le lien au formateur.",
  "espace.sousTitre.campus": "Les cours du jour du campus de {campus} : ouvrez la classe, ajoutez le PowerPoint et les vidéos, envoyez le lien au formateur.",
  "espace.aujourdhui": "Aujourd'hui · {date}",
  "espace.aujourdhui.vide": "Aucun cours aujourd'hui. Les cours des prochains jours sont plus bas : vous pouvez déjà les préparer.",
  "espace.aujourdhui.videTitre": "Pas de cours aujourd'hui",
  "espace.semaine": "Cette semaine",
  "espace.semaine.vide": "Aucun autre cours d'ici {date}.",
  "espace.actualise": "La page se met à jour toute seule.",

  // ── États d'un cours ────────────────────────────────────────────────────
  "etat.aVenir": "À venir",
  "etat.ouverteAvance": "Classe ouverte · le cours commence à {heure}",
  "etat.enDirect": "En direct",
  "etat.terminee": "Terminé",
  "etat.annulee": "Annulé",
  "etat.nonOuverte": "Pas ouvert à l'heure",

  // ── Carte d'un cours ────────────────────────────────────────────────────
  "carte.formateurConnecte": "connecté",
  "carte.formateurAbsent": "pas encore connecté",
  "carte.sansFormateur": "Formateur à confirmer",
  "carte.salles.un": "{n} salle connectée sur {total}",
  "carte.salles": "{n} salles connectées sur {total}",
  "carte.sansSalle": "Aucune salle de campus pour ce cours",
  "carte.diapos.un": "1 diapo",
  "carte.diapos": "{n} diapos",
  "carte.ressources.un": "1 vidéo ou document",
  "carte.ressources": "{n} vidéos et documents",
  "carte.rienPrepare": "Pas encore de PowerPoint ni de vidéo",
  "carte.motif": "Motif : {motif}",

  // ── Boutons ─────────────────────────────────────────────────────────────
  "bouton.ouvrir": "Ouvrir la classe",
  "bouton.ouverture": "Ouverture…",
  "bouton.entrer": "Entrer dans le Studio",
  "bouton.preparer": "Préparer",
  "bouton.lienIntervenant": "Lien intervenant",
  "bouton.ouvreA": "La classe s'ouvre à {heure}",
  "bouton.ouvreLe": "La classe s'ouvre {jour} à {heure}",

  // ── Toasts et erreurs ───────────────────────────────────────────────────
  "toast.ouverte": "La classe est ouverte dans les campus.",
  "erreur.tropTot": "La classe s'ouvre au plus tôt une heure avant le cours, à {heure}. D'ici là, vous pouvez la préparer.",

  // ── Studio ──────────────────────────────────────────────────────────────
  "studio.regie": "Vous faites la régie de ce cours · formateur : {formateur}",
  "studio.regie.sansFormateur": "Vous faites la régie de ce cours",
  "studio.regie.aide":
    "Votre micro et votre caméra sont coupés en entrant : ouvrez votre micro seulement pour parler à la classe. Le formateur garde toute la main s'il est là.",
  "demarrage.titre": "Ouvrir la classe de {formateur} ?",
  "demarrage.titre.sansFormateur": "Ouvrir la classe ?",
  "demarrage.texte": "Les cinq salles et les étudiants en ligne sont prévenus que la classe est ouverte. Votre micro et votre caméra restent coupés.",
  "demarrage.bouton": "Ouvrir la classe",

  // ── Lien intervenant ────────────────────────────────────────────────────
  "intervenant.titre": "Lien intervenant",
  "intervenant.description":
    "Pour la personne qui doit parler pendant le cours (le formateur s'il n'arrive pas à se connecter, un invité) : elle entre avec son micro et sa caméra, et peut montrer son écran, sans compte ni mot de passe.",
  "intervenant.prudence": "Envoyez-le seulement à cette personne : quiconque a ce lien peut parler aux cinq salles.",
  "intervenant.valable": "Valable pour ce cours seulement, jusqu'au {jour} à {heure} (heure d'Abidjan). La visio ouvre 30 minutes avant le début.",
  "intervenant.copier": "Copier le lien",
  "intervenant.copie": "Lien copié",
  "intervenant.copieImpossible": "Copie impossible : sélectionnez le lien à la main.",
  "intervenant.whatsapp": "Envoyer sur WhatsApp",
  "intervenant.whatsappA": "Envoyer à {nom} sur WhatsApp",
  "intervenant.message":
    "Bonjour {nom}, pour le cours « {titre} » ({jour} à {heure}, heure d'Abidjan) : entrez dans la classe avec votre micro et votre caméra en ouvrant ce lien, sans compte ni mot de passe :\n{lien}\nCe lien est personnel : merci de ne pas le transférer.",
  "intervenant.message.sansNom":
    "Bonjour, pour le cours « {titre} » ({jour} à {heure}, heure d'Abidjan) : entrez dans la classe avec votre micro et votre caméra en ouvrant ce lien, sans compte ni mot de passe :\n{lien}\nCe lien est personnel : merci de ne pas le transférer.",
  "intervenant.expire": "Ce cours est terminé : le lien ne marche plus.",
  "intervenant.annule": "Ce cours a été annulé : le lien ne marche plus.",

  // ── Préparation en mode régie ───────────────────────────────────────────
  "preparation.regie": "Vous préparez ce cours pour {formateur} : le PowerPoint, les vidéos et les sondages. L'horaire et le titre se changent dans l'emploi du temps.",
  "preparation.regie.sansFormateur": "Vous préparez ce cours : le PowerPoint, les vidéos et les sondages. L'horaire et le titre se changent dans l'emploi du temps.",
  "preparation.quand": "{jour} · {heures} (heure d'Abidjan)",
  "preparation.plan": "Plan du cours",
  "retour.espace": "Revenir à mon espace",

  // ── Radio des téléphones ────────────────────────────────────────────────
  "radio.ailleurs": "Radio des téléphones : elle part d'un autre poste (le formateur ou la régie), rien à faire",

  // ── Invitation (e-mail du compte) ───────────────────────────────────────
  "invitation.regie": "Vous y ferez la régie des cours en direct : ouvrir la classe, PowerPoint et vidéos, lien du formateur.",
});
