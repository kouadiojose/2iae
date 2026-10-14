// Profils de l'équipe administrative : ce que chaque membre de l'équipe (rôle
// « vie_scolaire ») peut voir et faire. La direction (rôle « admin ») a tous
// les droits. Le périmètre (un campus ou tout le groupe) reste donné par le
// site du compte (server/auth.ts : perimetreSites).
//
// Matrice UNIQUE du campus : le serveur l'applique (server/auth.ts : peut,
// exigerDroit, droitSiEquipe), le client s'en sert pour ses menus et ses
// boutons (le serveur reste la vraie barrière). Pour changer ce qu'un profil
// peut faire, on change DROITS_PROFILS, et seulement ici.
//
// Compte de l'équipe sans profil (profil NULL, comptes créés avant les
// profils) : profil « vie_scolaire », comme avant.
//
// Chargé de cours (José, 14 octobre 2026) : la régie des cours en direct à la
// place de la direction (ouvrir la classe, PowerPoint et vidéos, projection,
// lien intervenant, parole), par le droit « animer », sans rien d'autre. Son
// espace : « Mon espace » (/regie, routes/regie.ts), navigation réduite.
//
// Chargé du campus (José, 14 octobre 2026 au soir : « chaque campus aura son propre accès, géré par le chargé
// du campus ») : UN compte par campus, rattaché à son campus (site_id obligatoire), droit unique « espace_campus ».
// Son espace : /mon-campus (routes/espace-campus.ts), un gros carré par cours de son campus, puis cinq gros blocs
// (live, leçons, résumés, examens, notes en lecture). « Entrer dans le live » fait de l'ordinateur l'écran de la
// salle pour le cours choisi : il entre dans la classe COMME UNE SALLE (estEcran), jamais comme animateur. Il n'a
// pas « animer » : avec ce droit, regieCours ferait de lui le formateur de la classe (jeton propriétaire,
// enregistrement, « Terminer », main levée refusée) ; ni « notes » : enseigneCours le rendrait enseignant des
// cours propres à son campus (créer des devoirs, publier des notes).
import type { Role } from "./base";

export const PROFILS_EQUIPE = ["scolarite", "vie_scolaire", "secretariat", "pedagogie", "charge_cours", "campus"] as const;
export type ProfilEquipe = (typeof PROFILS_EQUIPE)[number];

/** Profil appliqué à un compte de l'équipe qui n'en a pas (comptes d'avant les profils). */
export const PROFIL_PAR_DEFAUT: ProfilEquipe = "vie_scolaire";

export const DROITS = [
  "comptes_voir",
  "comptes_gerer",
  "nouveau_code",
  "comptes_personnel",
  "crm",
  "argent",
  "classes",
  "suivi",
  "presences_voir",
  "presences",
  "notes",
  "programme",
  "annonces",
  "outils_campus",
  "animer",
  "espace_campus",
] as const;
export type Droit = (typeof DROITS)[number];

/** Ce que recouvre chaque droit (libellés de l'interface, vouvoiement). */
export const LIBELLES_DROITS: Record<Droit, string> = {
  comptes_voir: "Voir l'annuaire et les comptes des étudiants",
  comptes_gerer: "Inscrire les étudiants, créer et modifier leurs comptes (import, liens d'inscription, fiches de connexion)",
  nouveau_code: "Donner un nouveau code à un étudiant qui a oublié le sien",
  comptes_personnel: "Gérer les comptes du personnel et des formateurs (nouveau code, invitation)",
  crm: "Dossiers administratifs, pièces du dossier, relances, préinscrits du site",
  argent: "Frais de scolarité, échéances, versements et reçus",
  classes: "Créer, modifier et supprimer les classes",
  suivi: "Étudiants à contacter et notes de suivi",
  presences_voir: "Consulter les présences et les absences",
  presences: "Justifier les absences, pointer les présents, déclarer l'effectif des salles",
  notes: "Devoirs, évaluations, corrections, notes et relevés des parents",
  programme: "Cours, programme et emploi du temps, séances en direct, formateurs",
  annonces: "Annonces et événements de l'agenda",
  outils_campus: "Écrans des salles, réglages et consommation de la visio, budget de l'assistant IA, liste de la rentrée",
  animer:
    "Régie des cours en direct : ouvrir et fermer la classe, PowerPoint et vidéos avant et pendant le cours, projection, lien intervenant, parole et mains levées, sondages, discussion (sans notes ni emploi du temps)",
  espace_campus:
    "Espace du campus : les cours de son campus en gros carrés, l'écran de la salle pendant le live (ouvrir le cours dès 1 h avant), les leçons, résumés, examens et notes publiées des étudiants de son campus, en lecture",
};

export type DefinitionProfil = {
  libelle: string;
  /** Une phrase, montrée à la direction quand elle choisit le profil. */
  description: string;
  droits: readonly Droit[];
  /**
   * « regie » : profil limité à la régie des cours (accueil « Mon espace », navigation réduite, messagerie sans les
   * étudiants). « campus » : l'espace du campus (accueil /mon-campus, aucune autre page, ni messagerie ni annuaire).
   */
  espace?: "regie" | "campus";
};

export const DROITS_PROFILS: Record<ProfilEquipe, DefinitionProfil> = {
  scolarite: {
    libelle: "Scolarité",
    description:
      "Comptes et inscriptions des étudiants, nouveau code, dossiers et pièces, classes, notes et relevés, frais de scolarité ; cours, séances, horaires et ressources (pour aider les formateurs) ; présences en lecture.",
    droits: ["comptes_voir", "comptes_gerer", "nouveau_code", "crm", "argent", "classes", "suivi", "presences_voir", "notes", "programme", "annonces"],
  },
  vie_scolaire: {
    libelle: "Vie scolaire",
    description:
      "Tout le travail de l'équipe sur son périmètre : présences et absences, suivi des étudiants, comptes et nouveau code, dossiers, frais, programme, annonces.",
    // Tous les droits SAUF « animer » : la vie scolaire anime déjà par « programme », sur les cours propres à son
    // campus (enseigneCours) ; « animer » lui donnerait en plus les cours partagés, sans que personne l'ait demandé.
    // Ni « espace_campus » : la vie scolaire garde ses outils (pilotage, /salle?site=) ; un second accueil les lui
    // ferait perdre.
    droits: DROITS.filter((d) => d !== "animer" && d !== "espace_campus"),
  },
  secretariat: {
    libelle: "Secrétariat / accueil",
    description:
      "Annuaire des étudiants en lecture, nouveau code pour un étudiant qui a oublié le sien, préinscrits et dossiers (pièces), annonces et messages, emploi du temps en lecture.",
    droits: ["comptes_voir", "nouveau_code", "crm", "annonces"],
  },
  pedagogie: {
    libelle: "Responsable pédagogique",
    description:
      "Cours, programme et emploi du temps, formateurs, séances en direct et enregistrements, devoirs et notes ; présences et comptes des étudiants en lecture.",
    droits: ["comptes_voir", "presences_voir", "notes", "programme", "annonces"],
  },
  charge_cours: {
    libelle: "Chargé de cours",
    description:
      "Régie des cours en direct de tous les campus (ou d'un campus) : ouvrir et fermer la classe, ajouter le PowerPoint et les vidéos avant et pendant le cours, les projeter, envoyer le lien intervenant au formateur, donner la parole, sondages. Sans notes, ni dossiers, ni paiements, ni comptes, ni emploi du temps.",
    droits: ["animer"],
    espace: "regie",
  },
  campus: {
    libelle: "Chargé du campus",
    description:
      "Un accès par campus, pour la personne qui s'occupe des salles. Elle voit les cours de son campus en gros carrés, lance le live sur l'ordinateur de chaque salle, lit les leçons, les résumés, les examens et les notes de son campus. Rien d'autre.",
    droits: ["espace_campus"],
    espace: "campus",
  },
};

export const LIBELLES_PROFILS: Record<ProfilEquipe, string> = {
  scolarite: DROITS_PROFILS.scolarite.libelle,
  vie_scolaire: DROITS_PROFILS.vie_scolaire.libelle,
  secretariat: DROITS_PROFILS.secretariat.libelle,
  pedagogie: DROITS_PROFILS.pedagogie.libelle,
  charge_cours: DROITS_PROFILS.charge_cours.libelle,
  campus: DROITS_PROFILS.campus.libelle,
};

export const estProfilEquipe = (v: unknown): v is ProfilEquipe => typeof v === "string" && (PROFILS_EQUIPE as readonly string[]).includes(v);

type PersonneDroits = { role: Role; profil?: string | null };

/** Profil appliqué à un compte de l'équipe (null hors de l'équipe et pour la direction). */
export function profilDe(u: PersonneDroits): ProfilEquipe | null {
  if (u.role !== "vie_scolaire") return null;
  if (u.profil === null || u.profil === undefined) return PROFIL_PAR_DEFAUT;
  // Valeur inconnue en base : aucun droit (prudence), voir peut().
  return estProfilEquipe(u.profil) ? u.profil : null;
}

/** La personne a-t-elle ce droit ? Direction : tout ; équipe : selon son profil ; autres rôles : rien. */
export function peut(u: PersonneDroits | null | undefined, droit: Droit): boolean {
  if (!u) return false;
  if (u.role === "admin") return true;
  const p = profilDe(u);
  return p !== null && DROITS_PROFILS[p].droits.includes(droit);
}

/** Droits qui donnent la régie d'une séance : « programme » (historique, avec le périmètre d'enseigneCours) ou « animer ». */
export const DROITS_REGIE = ["programme", "animer"] as const satisfies readonly Droit[];

/** La personne peut-elle faire la régie de cours (direction, profil « programme » ou « animer ») ? Le cours se vérifie à part (acces.ts : regieCours). */
export const peutRegie = (u: PersonneDroits | null | undefined): boolean => DROITS_REGIE.some((d) => peut(u, d));

/** Profil limité à la régie des cours (Chargé de cours) : accueil « Mon espace », navigation réduite. Faux pour la direction et les autres profils. */
export function estProfilRegie(u: PersonneDroits | null | undefined): boolean {
  const p = u ? profilDe(u) : null;
  return p !== null && DROITS_PROFILS[p].espace === "regie";
}

/** Profil « Chargé du campus » : un compte par campus, accueil /mon-campus (espace-campus). Faux pour la direction. */
export function estProfilCampus(u: PersonneDroits | null | undefined): boolean {
  const p = u ? profilDe(u) : null;
  return p !== null && DROITS_PROFILS[p].espace === "campus";
}

/**
 * Profils à espace réduit (régie, campus) : ni annuaire, ni messagerie avec les étudiants, ni accès large de
 * l'équipe aux fichiers (seulement les gardiens de chaque usage), ni guide ni visite de l'équipe.
 */
export function estProfilRestreint(u: PersonneDroits | null | undefined): boolean {
  const p = u ? profilDe(u) : null;
  return p !== null && Boolean(DROITS_PROFILS[p].espace);
}

/**
 * L'écran d'une salle de conférence dans une classe : un compte « salle » (ancien écran installé par son lien), ou
 * un compte de campus (« Entrer dans le live » : l'ordinateur de la salle montre le cours choisi). Il entre
 * toujours comme une salle : profil de visio « salle », caméra et micro de la salle, jamais animateur ; il compte
 * comme « salle connectée » de son campus (Studio, régie, direction).
 */
export const estEcran = (u: PersonneDroits | null | undefined): boolean => Boolean(u) && (u!.role === "salle" || estProfilCampus(u));

/** Profils qui ont ce droit (pour une requête : qui prévenir, qui peut recevoir une tâche…). */
export const profilsAvec = (droit: Droit): ProfilEquipe[] => PROFILS_EQUIPE.filter((p) => DROITS_PROFILS[p].droits.includes(droit));

/** Libellé du profil d'un compte (« Secrétariat / accueil »), « Direction » pour la direction. */
export function libelleProfil(u: PersonneDroits): string {
  if (u.role === "admin") return "Direction";
  const p = profilDe(u);
  return p ? LIBELLES_PROFILS[p] : "Profil inconnu";
}

/**
 * Profil proposé à la direction d'après la fonction saisie par la personne
 * (« Secrétaire », « Responsable pédagogique »…), null si rien ne correspond.
 */
export function profilSuggere(fonction: string | null | undefined): ProfilEquipe | null {
  const f = (fonction ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (!f.trim()) return null;
  // Avant la vie scolaire : « responsable du campus » n'est pas un surveillant.
  if (/charge du campus|charges du campus|responsable (du |de )?campus|chef (du |de )?campus|gestionnaire (du |de )?campus/.test(f)) return "campus";
  if (/vie scolaire|\bcpe\b|surveill|educat|conseiller principal/.test(f)) return "vie_scolaire";
  // Avant la pédagogie (« chargé de cours et coordination » doit donner la régie). Ailleurs, « chargé de cours »
  // désigne aussi un enseignant vacataire : la description du profil le dit à la direction, qui valide.
  if (/charge de cours|charges de cours|\bregie\b|regisseu/.test(f)) return "charge_cours";
  if (/pedago|des etudes|etudes|formation|coordinat|enseign|academ/.test(f)) return "pedagogie";
  if (/scolarite|inscription|caiss|comptab|econom|financ|admission/.test(f)) return "scolarite";
  if (/secretar|accueil|reception|standard|hotesse|assistant/.test(f)) return "secretariat";
  return null;
}
