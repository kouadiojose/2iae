// Rubriques du site 2IAE.
//
// Elles servent deux fois : ce sont les valeurs autorisées pour `news.category`,
// et la page /actualites construit ses filtres à partir des catégories
// réellement présentes en base. Ajouter une rubrique ici la fait donc
// apparaître seule sur le site dès qu'un contenu l'utilise.

export interface Rubrique {
  /** Libellé affiché, et valeur stockée dans news.category */
  nom: string;
  /** Ce que la rubrique accueille — sert de consigne au classement */
  description: string;
  /** Indices lexicaux, en minuscules sans accents (voir normaliser()) */
  motsCles: string[];
  /**
   * Plancher d'importance : une publication de cette rubrique ne peut pas
   * passer à la une en dessous. Les rubriques du quotidien restent basses
   * pour nourrir le site sans encombrer la page d'accueil.
   */
  seuilUne: number;
}

export const RUBRIQUES: Rubrique[] = [
  {
    nom: "Cérémonies & Diplômes",
    description:
      "Remises de diplômes, cérémonies officielles, sorties de promotion, prestations de serment.",
    motsCles: [
      "remise de diplome", "diplome", "diplomes", "ceremonie", "graduation",
      "sortie de promotion", "promotion", "laureat", "parrain", "majorant",
    ],
    seuilUne: 60,
  },
  {
    nom: "Partenariats",
    description:
      "Conventions, accords, signatures avec des entreprises, institutions ou universités.",
    motsCles: [
      "partenariat", "convention", "accord", "signature", "collaboration",
      "protocole", "memorandum", "cooperation", "signe avec",
    ],
    seuilUne: 60,
  },
  {
    nom: "Admissions",
    description:
      "Inscriptions, rentrée, concours d'entrée, dossiers de candidature, frais de scolarité.",
    motsCles: [
      "inscription", "inscriptions", "rentree", "admission", "concours",
      "candidature", "dossier", "recrutement etudiant", "place disponible",
      "scolarite", "orientation", "bts", "licence", "master",
    ],
    seuilUne: 55,
  },
  {
    nom: "Distinctions",
    description:
      "Prix, récompenses, classements, nominations, reconnaissances obtenues par l'école ou ses membres.",
    motsCles: [
      "prix", "recompense", "distinction", "award", "trophee", "laureat",
      "nomination", "classement", "medaille", "felicitation", "honneur",
    ],
    seuilUne: 60,
  },
  {
    nom: "Événements",
    description:
      "Conférences, forums, journées portes ouvertes, séminaires, ateliers, salons.",
    motsCles: [
      "conference", "forum", "seminaire", "atelier", "colloque", "salon",
      "journee portes ouvertes", "jpo", "webinaire", "table ronde", "invitation",
      "rendez-vous", "edition",
    ],
    seuilUne: 50,
  },
  {
    nom: "Vie du campus",
    description:
      "Quotidien de l'école : cours, travaux pratiques, sport, culture, activités étudiantes, ambiance.",
    motsCles: [
      "campus", "etudiant", "etudiants", "cours", "travaux pratiques", "tp",
      "sport", "tournoi", "culture", "club", "sortie", "visite", "stage",
      "amphi", "salle", "vie etudiante", "ambiance",
    ],
    seuilUne: 85, // le quotidien ne monte à la une qu'exceptionnellement
  },
  {
    nom: "Formations",
    description:
      "Filières, programmes, contenus pédagogiques, nouvelles offres de formation.",
    motsCles: [
      "filiere", "filieres", "formation", "programme", "cursus", "specialite",
      "module", "certification", "nouvelle offre", "parcours",
    ],
    seuilUne: 55,
  },
  {
    nom: "International",
    description:
      "Mobilité, échanges, missions et représentations à l'étranger.",
    motsCles: [
      "international", "etranger", "mobilite", "echange", "delegation",
      "mission", "dubai", "france", "canada", "afrique", "voyage", "ambassade",
    ],
    seuilUne: 60,
  },
  {
    nom: "Communiqués",
    description:
      "Annonces officielles de la direction, informations pratiques, avis, communiqués.",
    motsCles: [
      "communique", "annonce", "avis", "information importante", "direction",
      "note", "rappel", "report", "fermeture", "ouverture",
    ],
    seuilUne: 65,
  },
];

/** Rubrique de repli quand rien ne ressort — jamais mise en avant d'office. */
export const RUBRIQUE_DEFAUT = "Vie du campus";

export const NOMS_RUBRIQUES = RUBRIQUES.map((r) => r.nom);

export function trouverRubrique(nom: string | undefined | null): Rubrique | undefined {
  if (!nom) return undefined;
  const cible = nom.trim().toLowerCase();
  return RUBRIQUES.find((r) => r.nom.toLowerCase() === cible);
}

/** Minuscules sans accents ni ponctuation, pour comparer du texte saisi librement. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
