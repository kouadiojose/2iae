// Valeurs par défaut du site public du campus : les faits réels du Groupe
// 2IAE (site 2iae.com, affiches officielles des résultats du BTS 2026). La
// production les affiche dès le déploiement, sans saisie ; la direction les
// remplace depuis « Site public » du back-office (table contenusSite).
//
// Fichier à part du schéma commun (shared/schema) : seuls le serveur et les
// pages publiques le chargent, pas les pages de l'application.
import type { ContenuCampus, ContenusSite } from "./schema/ext-vitrine";

export const CONTENUS_PAR_DEFAUT: ContenusSite = {
  accueil: {
    etiquette: "L'école des entrepreneurs · Année académique 2026-2027",
    titre: "Un cours.\nCinq campus.\nEn direct.",
    sousTitre:
      "Les étudiants des cinq campus du Groupe 2IAE suivent les mêmes formateurs, en direct : dans la salle de conférence de leur campus, sur leur téléphone ou sur leur ordinateur.",
  },
  apropos: {
    chapeau:
      "Depuis 2006, le Groupe Écoles 2IAE International forme en Côte d'Ivoire des étudiants qui entreprennent. Son nom le dit : Institut International des Affaires en Entrepreneuriat.",
    groupe: [
      "Le Groupe Écoles 2IAE International a été créé en 2006 par Séraphin Koua, son fondateur et président-directeur général. Depuis sa création, tous les étudiants y suivent des cours d'entrepreneuriat, quelle que soit leur filière : c'est « l'école des entrepreneurs ».",
      "Le groupe compte cinq campus en Côte d'Ivoire : Abidjan Riviera Palmeraie, son siège, Abidjan Yopougon, Yamoussoukro, Azaguié et M'Batto. À Azaguié Ahoua, l'Université de l'Entrepreneuriat accueille un internat, une ferme et des serres. Le groupe forme plus de 1 500 apprenants chaque année ; il dispose de quatre incubateurs et d'un bureau au Canada.",
      "Au BTS 2026, 67,38 % des candidats du groupe ont été admis, pour une moyenne nationale de 42,48 %. Le 9 septembre 2026, Séraphin Koua a reçu le Prix du Meilleur Fondateur.",
    ].join("\n\n"),
    campusNumerique: [
      "Le campus numérique est la salle de classe commune des cinq campus. Un formateur, où qu'il soit dans le monde, enseigne en direct à toutes les salles de conférence du groupe en même temps, et aux étudiants qui suivent sur leur téléphone ou leur ordinateur.",
      "Il est pensé pour la Côte d'Ivoire : il fonctionne sur un téléphone simple, ménage les forfaits prépayés, continue quand le réseau coupe. Chaque étudiant y retrouve ses cours, ses devoirs, ses notes, ses replays et ses formateurs.",
      "À 2IAE, on apprend aussi avec les méthodes d'aujourd'hui, dont l'intelligence artificielle : un assistant aide chaque étudiant à réviser, et l'initiation à l'IA ouvre l'année 2026-2027.",
    ].join("\n\n"),
    chiffres: [
      { valeur: "2006", libelle: "année de création du groupe" },
      { valeur: "5", libelle: "campus en Côte d'Ivoire" },
      { valeur: "+1 500", libelle: "apprenants chaque année" },
      { valeur: "67,38 %", libelle: "d'admis au BTS 2026, pour 42,48 % au niveau national" },
    ],
  },
  questions: {
    liste: [
      {
        id: "premiere-connexion",
        theme: "connexion",
        question: "Comment je me connecte la première fois ?",
        reponse:
          "La vie scolaire de ton campus te remet ta fiche de connexion. Elle porte ton matricule, un code provisoire à 6 chiffres et un QR code. Scanne le QR code avec l'appareil photo de ton téléphone : le campus s'ouvre sans rien taper. Sinon, touche « Se connecter », tape ton matricule puis ton code provisoire. Le campus te demande ensuite de choisir ton propre code secret.",
        visible: true,
      },
      {
        id: "code-provisoire",
        theme: "connexion",
        question: "Mon code provisoire ne marche pas.",
        reponse:
          "Le code provisoire est valable 30 jours, jusqu'à ce que tu choisisses ton code secret. Vérifie que tu tapes bien ton matricule, et non ton nom. Après 5 essais manqués, le compte se bloque 15 minutes par sécurité. Si le problème continue, écris à la vie scolaire de ton campus : elle peut te remettre un nouveau code.",
        visible: true,
      },
      {
        id: "code-oublie",
        theme: "connexion",
        question: "J'ai oublié mon code secret.",
        reponse:
          "Sur la page « Se connecter », touche « Code oublié ? ». Si ton compte a une adresse e-mail, tu reçois un lien pour choisir un nouveau code. Sinon, la vie scolaire de ton campus est prévenue et te remet un nouveau code. Tu peux aussi lui écrire sur WhatsApp depuis cette page.",
        visible: true,
      },
      {
        id: "telephone-partage",
        theme: "connexion",
        question: "Je partage mon téléphone. Comment protéger mon compte ?",
        reponse:
          "Au moment de te connecter, coche « Téléphone partagé » : le campus te déconnecte dès que tu fermes le navigateur. Ne donne ton code secret à personne.",
        visible: true,
      },
      {
        id: "forfait",
        theme: "suivre",
        question: "Combien de données consomme un cours en direct ?",
        reponse:
          "Cela dépend de ta façon de suivre. Dans la salle de conférence de ton campus, ton téléphone sert seulement à poser des questions et à voter : moins de 5 Mo par heure. En « son + diapos », le mode conseillé sur forfait : environ 12 à 15 Mo par heure. En vidéo : 150 à 250 Mo par heure. À la fin du cours, le campus t'indique ce qu'il t'a coûté.",
        visible: true,
      },
      {
        id: "reseau-coupe",
        theme: "suivre",
        question: "Le réseau coupe pendant le cours. Qu'est-ce que je rate ?",
        reponse:
          "À ton retour, le campus te montre ce que tu as raté : les questions posées et le fil du cours. Les cours enregistrés sont ensuite disponibles en replay dans ton espace. Tu peux aussi suivre dans la salle de conférence de ton campus.",
        visible: true,
      },
      {
        id: "application",
        theme: "suivre",
        question: "Faut-il installer une application ?",
        reponse:
          "Non, rien à télécharger dans un magasin d'applications. Ouvre le campus dans Chrome puis ajoute-le à l'écran d'accueil : il s'ouvre alors comme une application, reste léger, et les pages déjà consultées restent disponibles sans réseau.",
        visible: true,
      },
      {
        id: "devoir",
        theme: "suivre",
        question: "Comment rendre un devoir ?",
        reponse:
          "Ouvre le devoir, photographie ta copie avec ton téléphone ou joins un fichier, puis touche « Rendre ». Tu reçois aussitôt un reçu numéroté et horodaté. Sans réseau, le devoir part tout seul dès que la connexion revient.",
        visible: true,
      },
      {
        id: "correction",
        theme: "suivre",
        question: "Qui corrige mes devoirs ?",
        reponse:
          "Le campus corrige tes copies après la date limite, d'après le corrigé de ton formateur : tu reçois ta note critère par critère, avec des conseils. Une note te semble fausse ? Demande une relecture depuis le devoir : ton formateur relit ta copie et garde toujours le dernier mot. Une copie en vidéo, ou difficile à lire, est corrigée par ton formateur.",
        visible: true,
      },
      {
        id: "assistant",
        theme: "suivre",
        question: "À quoi sert l'assistant IA ?",
        reponse:
          "C'est un tuteur disponible à toute heure, qui s'appuie sur les leçons de tes cours. Il t'explique autrement, te fait réviser et t'aide à comprendre un devoir sans le faire à ta place. Il se met en pause pendant les interrogations.",
        visible: true,
      },
      {
        id: "releve-parents",
        theme: "parents",
        question: "Je suis parent. Comment suivre la scolarité de mon enfant ?",
        reponse:
          "La vie scolaire du campus peut vous transmettre un lien vers le relevé de votre enfant : sa présence aux cours et ses moyennes. Ce lien s'ouvre sans compte et peut être retiré à tout moment. Demandez-le à la vie scolaire du campus de votre enfant.",
        visible: true,
      },
      {
        id: "donnees-enfant",
        theme: "parents",
        question: "Qui voit les données de mon enfant ?",
        reponse:
          "L'étudiant, ses formateurs et l'équipe de son campus (vie scolaire et direction). Le site public ne montre jamais le nom d'un étudiant. La page Confidentialité détaille ce que le campus garde et pourquoi.",
        visible: true,
      },
      {
        id: "inscription",
        theme: "inscription",
        question: "Comment s'inscrire au Groupe 2IAE ?",
        reponse:
          "La préinscription se fait en ligne sur www.2iae.com/preinscription, ou auprès de l'un des cinq campus. Une fois inscrit, l'étudiant reçoit sa fiche de connexion au campus numérique.",
        visible: true,
      },
      {
        id: "qui-peut-suivre",
        theme: "inscription",
        question: "Qui peut suivre les cours du campus numérique ?",
        reponse:
          "Les étudiants inscrits dans l'un des cinq campus du Groupe 2IAE. Chaque étudiant a son propre compte, lié à son matricule.",
        visible: true,
      },
    ],
  },
  contacts: {
    telephones: ["+225 05 84 24 90 90", "+225 27 22 51 81 75"],
    whatsapp: "+225 07 47 72 67 29",
    email: "contacts@2iae.com",
    facebook: "https://www.facebook.com/Groupe2ife2iae",
    siteWeb: "https://www.2iae.com",
    preinscription: "https://www.2iae.com/preinscription",
    bureauCanada: "85 rue St-Charles Ouest, bureau 201, Longueuil (Québec) J4H 1C5",
    rc: "CI-ABJ-2006-B-1935-CC 0688352 Y",
    agrement: "2006/597/METFP-CAB/DEP",
  },
  confidentialite: {
    responsable: "Groupe Écoles 2IAE International",
    contact: "contacts@2iae.com",
    conservation: [
      "Les données scolaires (présences, devoirs, notes, messages) sont conservées pendant toute la scolarité de l'étudiant : elles forment son dossier scolaire.",
      "Les connexions expirent d'elles-mêmes : après 90 jours sans visite pour un étudiant ou un écran de salle, après 30 jours pour les formateurs et l'équipe.",
      "La durée d'archivage après la fin de la scolarité est fixée par la direction du Groupe 2IAE. Elle vous est communiquée sur simple demande.",
    ].join("\n\n"),
    miseAJour: "2026-09-26",
  },
};

/** Les cinq campus (slugs de la table sites), tels que publiés sur 2iae.com et sur les affiches du BTS 2026. */
export const CAMPUS_PAR_DEFAUT: Record<string, ContenuCampus> = {
  riviera: {
    adresse: "Rue ministre, entre la pharmacie rue ministre et le carrefour MACI CANADA",
    localite: "Riviera Palmeraie, Cocody, Abidjan",
    telephone: "",
    photoUrl: "/images/campus-riviera.jpg",
    lienCarte: "",
    filieres: ["ATPA", "ATPV", "RHCOM", "LOG", "IDA", "FCGE", "GTP", "GBAT"],
    resultat: { libelle: "BTS 2026", taux: 58.4 },
    presentation: "Le siège du Groupe Écoles 2IAE International, à Cocody.",
  },
  yopougon: {
    adresse: "Quartier millionnaire, derrière le Groupe Scolaire Saint Louis (ancien Bel-Air)",
    localite: "Yopougon, Abidjan",
    telephone: "",
    photoUrl: "/images/campus-yopougon.jpg",
    lienCarte: "",
    filieres: ["ATPV", "RHCOM", "ATPA", "GEC", "LOG", "GBAT"],
    resultat: { libelle: "BTS 2026", taux: 64.13 },
    presentation: "",
  },
  yamoussoukro: {
    adresse: "Quartier millionnaire (école). Bureau aux 220 logements, voisin de la clinique Grâce des Lacs",
    localite: "Yamoussoukro",
    telephone: "",
    photoUrl: "/images/campus-yamoussoukro.jpg",
    lienCarte: "",
    filieres: ["ATPA", "ATPV", "LOG", "FCGE"],
    resultat: { libelle: "BTS 2026", taux: 68.18 },
    presentation: "",
  },
  azaguie: {
    adresse: "Université de l'Entrepreneuriat",
    localite: "Azaguié Ahoua",
    telephone: "+225 07 07 88 77 04",
    photoUrl: "/images/campus-azaguie.jpg",
    lienCarte: "",
    filieres: ["ATPV", "ATPA", "GBAT"],
    resultat: { libelle: "BTS 2026", taux: 83.54 },
    presentation:
      "L'Université de l'Entrepreneuriat du Groupe 2IAE. Un internat, une ferme (bœufs, lapins, moutons, volailles), un étang piscicole et des serres. Les étudiants cultivent aussi des champs à Azaguié M'bromé (10 ha) et à Bingerville (5 ha). Le groupe y compte quatre incubateurs.",
  },
  mbatto: {
    adresse: "À côté de la gendarmerie",
    localite: "M'Batto",
    telephone: "",
    photoUrl: "/images/campus-mbatto.jpg",
    lienCarte: "",
    filieres: [],
    resultat: null,
    presentation: "",
  },
};

/** Contenu vide pour un campus que le code ne connaît pas (nouveau site). */
export const CAMPUS_VIERGE: ContenuCampus = {
  adresse: "",
  localite: "",
  telephone: "",
  photoUrl: null,
  lienCarte: "",
  filieres: [],
  resultat: null,
  presentation: "",
};
