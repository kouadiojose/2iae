// Textes des devoirs en groupe (groupes formés par les étudiants, novembre 2026). Couche commune :
// shared/textes/index.ts. Étudiants tutoyés, personnel vouvoyé. Vocabulaire du campus : « Rendre », jamais « soumettre ».
import { creerTextes } from "./index";

export const t = creerTextes({
  // ── Éditeur du devoir (vous) ──
  "editeur.enGroupe": "Devoir en groupe",
  "editeur.enGroupe.aide": "Les étudiants forment leurs groupes (tous campus). Un membre rend la copie pour tout le groupe : même copie, même note pour chacun.",
  "editeur.taille": "Taille maximale du groupe",
  "editeur.taille.aide": "De 2 à 6 étudiants.",

  // ── Page du devoir (tu) ──
  "titre": "Devoir en groupe",
  "intro": { tu: "Forme un groupe de {max} étudiants au plus, de n'importe quel campus. Un membre rend la copie pour tout le groupe : chacun reçoit la même copie et la même note.", vous: "Groupes de {max} étudiants au plus." },
  "aucun": { tu: "Aucun groupe pour l'instant. Crée le premier !", vous: "Aucun groupe pour l'instant." },
  "creer": "Créer un groupe",
  "creer.nom": "Nom du groupe (facultatif)",
  "creer.nom.defaut": "Groupe de {prenom}",
  "creer.valider": "Créer le groupe",
  "rejoindre": "Rejoindre",
  "quitter": "Quitter le groupe",
  "quitter.confirmer": { tu: "Quitter ce groupe ? Tu pourras en rejoindre un autre ou rendre seul.", vous: "Quitter ce groupe ?" },
  "complet": "Complet",
  "rendu": "Copie rendue",
  "monGroupe": "Mon groupe",
  "membres": "{n} sur {max}",
  "discussion": "Discussion du groupe",
  "ferme": { tu: "La date limite est passée : les groupes ne changent plus.", vous: "La date limite est passée : les groupes ne changent plus." },
  "fige": { tu: "Ton groupe a rendu sa copie : il ne change plus.", vous: "Ce groupe a rendu sa copie." },
  "seul": { tu: "Tu n'as pas de groupe : tu peux en rejoindre un, en créer un, ou rendre seul ta copie.", vous: "Sans groupe." },
  "seul.limite": { tu: "Tu n'es dans aucun groupe : tu peux quand même rendre ta copie seul.", vous: "Sans groupe : copie individuelle." },
  "rendrePourGroupe": { tu: "Ta copie sera rendue pour tout ton groupe ({nom}) : chaque membre la recevra.", vous: "Copie rendue pour le groupe « {nom} »." },
  "remplacerGroupe": { tu: "Ta nouvelle copie remplacera celle de tout ton groupe.", vous: "La nouvelle copie remplace celle du groupe." },
  "toast.cree": { tu: "Groupe créé. Invite tes camarades à le rejoindre.", vous: "Groupe créé." },
  "toast.rejoint": { tu: "Tu as rejoint le groupe.", vous: "Groupe rejoint." },
  "toast.quitte": { tu: "Tu as quitté le groupe.", vous: "Groupe quitté." },

  // ── Erreurs du serveur (tu : seuls les étudiants forment des groupes) ──
  "erreur.pasEnGroupe": { tu: "Ce devoir ne se fait pas en groupe.", vous: "Ce devoir ne se fait pas en groupe." },
  "erreur.ferme": { tu: "La date limite est passée : les groupes ne changent plus.", vous: "La date limite est passée : les groupes ne changent plus." },
  "erreur.dejaGroupe": { tu: "Tu es déjà dans un groupe pour ce devoir : quitte-le d'abord.", vous: "Cet étudiant est déjà dans un groupe." },
  "erreur.sansGroupe": { tu: "Tu n'es dans aucun groupe pour ce devoir.", vous: "Cet étudiant n'est dans aucun groupe." },
  "erreur.complet": { tu: "Ce groupe est complet ({max} membres).", vous: "Ce groupe est complet ({max} membres)." },
  "erreur.groupeRendu": { tu: "Ce groupe a déjà rendu sa copie : il ne change plus.", vous: "Ce groupe a déjà rendu sa copie." },
  "erreur.introuvable": { tu: "Ce groupe n'existe plus. Recharge la page.", vous: "Ce groupe n'existe plus." },
  "erreur.groupeChange": { tu: "Ton groupe a changé pendant l'envoi : ta copie n'est pas partie. Recharge la page et renvoie-la.", vous: "Le groupe a changé : rien n'a été enregistré." },
  "erreur.occupe": { tu: "Le campus est très occupé : rien n'a changé. Réessaie dans un instant.", vous: "Le campus est très occupé : rien n'a changé. Réessayez dans un instant." },

  // ── Liste des copies (vous) ──
  "copies.groupe": "Copie du groupe « {nom} »",
  "copies.membres": "Membres : {noms}",
  "copies.pourTous": "Votre correction (note, commentaires, vocal) s'applique à chaque membre du groupe.",
});
