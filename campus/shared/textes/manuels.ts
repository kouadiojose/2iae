// Textes des manuels illustrés (PDF de client/public/guides/, voir client/src/modules/manuels/manuels.ts) :
// la carte « Mon manuel illustré » de l'accueil étudiant, les entrées du menu du compte et les liens de la
// fenêtre « Besoin d'aide ? » de la page de connexion. Le lien de l'accueil du formateur est dans
// travail.ts (liens.manuel), avec les autres liens de cet accueil.
// Étudiants tutoyés, personnel vouvoyé ; variables {pages} et {poids}.
import { creerTextes } from "./index";

export const t = creerTextes({
  // ── Carte de l'accueil étudiant ──────────────────────────────────────────
  "carte.titre": { tu: "Mon manuel illustré", vous: "Le manuel illustré" },
  "carte.texte": {
    tu: "Te connecter, suivre un cours, rendre un devoir, lire ta note : un geste par page, en images.",
    vous: "Se connecter, suivre un cours, rendre un devoir, lire sa note : un geste par page, en images.",
  },
  "carte.infos": "PDF · {pages} pages · {poids}",
  "carte.ouvrir": "Ouvrir le manuel",
  "carte.forfait": { tu: "En Wi-Fi si ton forfait est petit.", vous: "En Wi-Fi si votre forfait est petit." },

  // ── Menu du compte (photo en haut à droite), sur toutes les pages ────────
  "menu.mien": "Mon manuel illustré (PDF)",
  "menu.etudiants": "Manuel de l'étudiant (PDF)",
  "menu.formateurs": "Manuel du formateur (PDF)",

  // ── « Besoin d'aide ? » de la page de connexion (personne encore inconnue) ──
  "aide.titre": "Les manuels illustrés",
  "aide.texte": "Se connecter, la première fois, le code oublié : tout est expliqué en images.",
  "aide.etudiants": "Manuel de l'étudiant",
  "aide.formateurs": "Manuel du formateur",
  "aide.infos": "PDF · {poids}",
});
