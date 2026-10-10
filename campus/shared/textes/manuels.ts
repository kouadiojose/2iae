// Textes des manuels illustrés (PDF de client/public/guides/, voir client/src/modules/manuels/manuels.ts) :
// la carte « Mon manuel illustré » de l'accueil étudiant, le lien de l'accueil du formateur, les entrées du menu
// du compte et les liens de la fenêtre « Besoin d'aide ? » de la page de connexion. Tous les textes des manuels
// sont ici : un manuel refait, un seul fichier à relire. Variables {pages} et {poids}.
import { creerTextes } from "./index";

export const t = creerTextes({
  // Ligne d'informations sous le titre d'un manuel (le poids est affiché avant le téléchargement : petits forfaits).
  infos: "PDF · {pages} pages · {poids}",

  // ── Carte de l'accueil étudiant (seuls les étudiants la voient : tutoiement) ──
  "carte.titre": "Mon manuel illustré",
  "carte.forfait": "En Wi-Fi si ton forfait est petit.",
  // Le fichier reste dans les téléchargements du téléphone. La couverture du manuel des étudiants cite ce libellé.
  "carte.telecharger": "Télécharger le manuel",

  // ── Lien de l'accueil du formateur (vouvoiement) ──────────────────────────
  "formateur.titre": "Le manuel illustré",
  "formateur.detail": "Le campus pas à pas, en images.",

  // ── Menu du compte (photo en haut à droite), sur toutes les pages ────────
  "menu.mien": "Mon manuel illustré (PDF)",
  "menu.etudiants": "Manuel de l'étudiant (PDF)",
  "menu.formateurs": "Manuel du formateur (PDF)",

  // ── « Besoin d'aide ? » de la page de connexion (personne encore inconnue) ──
  "aide.titre": "Les manuels illustrés",
  "aide.texte": "Se connecter, suivre un cours, les devoirs : tout est expliqué en images.",
  "aide.etudiants": "Manuel de l'étudiant",
  "aide.formateurs": "Manuel du formateur",
  "aide.infos": "PDF · {poids}",
});
