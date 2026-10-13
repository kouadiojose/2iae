// Textes des salles de conférence d'un campus (shared/salles.ts) : réglage des salles dans
// « Les campus », page « Les salles du jour », messages WhatsApp (un par salle et par jour, envoyés
// au coordinateur des salles) et rappel du matin de la direction. Couche commune :
// shared/textes/index.ts. Personnel vouvoyé ; pas de tiret long.
import { creerTextes } from "./index";

export const t = creerTextes({
  // ── Publics d'une salle ─────────────────────────────────────────────────
  "public.L1": "L1 · 1re année",
  "public.L2": "L2 · 2e année",
  "public.tous": "Toutes les classes",
  "public.L1.detail": "Classes 1BTS (et Licence 1)",
  "public.L2.detail": "Classes 2BTS (et Licence 2)",
  "public.tous.detail": "Les cours communs, et tout cours qui n'a pas de salle de son niveau",

  // ── « Les campus » : les salles de chaque campus ────────────────────────
  "campus.salles": "Salles de conférence",
  "campus.ajouter": "Ajouter une salle",
  "campus.installer": "Installer l'écran",
  "campus.regler": "Régler",
  "campus.ecran.installe": "Écran installé",
  "campus.ecran.vu": "Écran vu {quand}",
  "campus.ecran.aInstaller": "Écran à installer",
  "campus.lienJour": "Les salles du jour",
  "campus.allerSalles": "Les campus et leurs salles de conférence",
  "campus.lienJour.texte": "Les liens des écrans de chaque campus, à envoyer sur WhatsApp",

  // ── Fenêtre d'une salle (ajout, réglage) ────────────────────────────────
  "fenetre.ajout.titre": "Nouvelle salle · {campus}",
  "fenetre.ajout.description": "Une salle de plus dans ce campus, avec son propre écran et son propre lien.",
  "fenetre.reglage.titre": "{salle} · {campus}",
  "fenetre.reglage.description": "Le nom et le public de cette salle.",
  "fenetre.nom": "Nom de la salle",
  "fenetre.nom.aide": "Affiché sur l'écran de la salle, sur le QR d'émargement et dans le message WhatsApp.",
  "fenetre.nom.aide1": "Laissez vide pour reprendre le nom de la salle du campus ({nom}).",
  "fenetre.public": "Qui suit les cours dans cette salle ?",
  "fenetre.public.aide": "Chaque cours s'affiche dans une seule salle du campus : un cours de L1 dans la salle L1, un cours de L2 dans la salle L2. Un cours commun aux deux niveaux va dans la salle « Toutes les classes », sinon dans la salle 1.",
  "fenetre.ajouter": "Ajouter la salle",
  "fenetre.enregistrer": "Enregistrer",
  "fenetre.retirer": "Retirer cette salle",
  "fenetre.retirer.confirmer": "Retirer « {salle} » ?\n\nSon écran se déconnecte et son lien d'installation ne marche plus. Les autres salles du campus ne changent pas.",
  "toast.ajoutee": "Salle ajoutée. Installez maintenant son écran.",
  "toast.enregistree": "Salle enregistrée",
  "toast.retiree": "Salle retirée",

  // ── Page « Les salles du jour » ─────────────────────────────────────────
  "jour.etiquette": "Pilotage · Salles du jour",
  "jour.titre": "Les salles du jour",
  "jour.sousTitre": "Un message par salle : ses cours et le lien de son écran. Envoyez chaque message sur WhatsApp au coordinateur des salles, qui le transfère au responsable de la salle.",
  "jour.aujourdhui": "Aujourd'hui",
  "jour.demain": "Demain",
  "jour.envoyer": "Envoyer sur WhatsApp",
  "jour.copier": "Copier",
  "jour.copie": "Message copié",
  "jour.copieImpossible": "Copie impossible : sélectionnez le message à la main.",
  "jour.compte.zero": "Aucun message à envoyer : pas de cours dans les salles ce jour-là.",
  "jour.compte.un": "1 message à envoyer, un toucher par message.",
  "jour.compte": "{n} messages à envoyer, un toucher par message.",
  "jour.sansMessage": "Pas de cours dans cette salle ce jour-là : pas de message.",
  "jour.aPreparer": "Préparez d'abord le lien de l'écran : le message sera prêt ensuite.",
  "jour.aPreparer.compte.un": "1 salle attend d'abord le lien de son écran (Installer l'écran).",
  "jour.aPreparer.compte": "{n} salles attendent d'abord le lien de leur écran (Installer l'écran).",
  "jour.aucunCours": "Pas de cours",
  "jour.ecranAInstaller": "Écran à installer",
  "jour.ecranPret": "Lien de l'écran prêt",
  "jour.ecranInstalle": "Écran installé",
  "jour.installer": "Installer l'écran",
  "jour.alertes": "À régler avant d'envoyer",
  "jour.reglerSalles": "Régler les salles de ce campus",
  "jour.commun": "L1 et L2",
  "jour.apercu": "Voir le message",
  "jour.vide": "Aucun campus dans votre périmètre.",
  "jour.campus": "Campus {campus}",
  "jour.envoye": "Envoyé",
  "erreur": "Une erreur est survenue. Réessayez dans un instant.",
  "jour.lien": "Les salles du jour",
  "jour.lien.texte": "Les liens des écrans de chaque salle, à envoyer sur WhatsApp",

  // ── Numéro qui reçoit les liens (le coordinateur des salles) ────────────
  "numero.libelle": "Numéro WhatsApp qui reçoit les liens",
  "numero.changer": "Changer le numéro",
  "numero.aide": "Le coordinateur des salles. Un numéro ivoirien s'écrit avec ou sans +225 ; un autre pays, avec son indicatif.",
  "numero.enregistrer": "Enregistrer",
  "numero.enregistre": "Numéro enregistré",
  "numero.vers": "Les messages partent vers le {numero} (coordinateur des salles).",
  "numero.invalide": "Ce numéro n'est pas valable : 10 chiffres pour la Côte d'Ivoire (07 07 72 09 40), ou le numéro complet avec l'indicatif du pays.",
  "numero.reserve": "Seule la direction peut changer ce numéro.",

  // ── Message WhatsApp (un par salle et par jour) ─────────────────────────
  "message.seance": "{date}, {heures} : {cours}, {intervenant}",
  "message.seance.sansIntervenant": "{date}, {heures} : {cours}",
  "message.ecran": "Écran de la salle : {lien}",
  "message.ecranInstalle": "Écran de la salle : déjà installé",
  "message.commun": "{cours} (L1 et L2)",

  // ── Rappel du matin de la direction (6 h 30, heure d'Abidjan) ───────────
  "rappel.titre": "Les liens des salles du jour sont prêts",
  "rappel.corps.un": "1 message à envoyer sur WhatsApp (salles des cinq campus).",
  "rappel.corps": "{n} messages à envoyer sur WhatsApp (salles des cinq campus).",
  "rappel.aPreparer.un": "1 salle attend d'abord le lien de son écran.",
  "rappel.aPreparer": "{n} salles attendent d'abord le lien de leur écran.",

  // ── Alertes de « Les salles du jour » ───────────────────────────────────
  "alerte.sansSalle": "{cours} ({niveau}, {heure}) n'a pas de salle : ajoutez une salle {niveau}, ou réglez une salle sur « Toutes les classes ».",
  "alerte.sansSalle.autre": "{cours} ({heure}) n'a pas de salle : réglez une salle sur « Toutes les classes ».",
  "alerte.chevauchement": "{a} et {b} ont lieu en même temps ({heure}) dans {salle} : son écran n'en montrera qu'un. Ajoutez une salle, ou réglez le public de chaque salle (L1, L2).",
});
