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
import type { Role } from "./base";

export const PROFILS_EQUIPE = ["scolarite", "vie_scolaire", "secretariat", "pedagogie"] as const;
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
};

export type DefinitionProfil = {
  libelle: string;
  /** Une phrase, montrée à la direction quand elle choisit le profil. */
  description: string;
  droits: readonly Droit[];
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
    droits: DROITS,
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
};

export const LIBELLES_PROFILS: Record<ProfilEquipe, string> = {
  scolarite: DROITS_PROFILS.scolarite.libelle,
  vie_scolaire: DROITS_PROFILS.vie_scolaire.libelle,
  secretariat: DROITS_PROFILS.secretariat.libelle,
  pedagogie: DROITS_PROFILS.pedagogie.libelle,
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
  if (/vie scolaire|\bcpe\b|surveill|educat|conseiller principal/.test(f)) return "vie_scolaire";
  if (/pedago|des etudes|etudes|formation|coordinat|enseign|academ/.test(f)) return "pedagogie";
  if (/scolarite|inscription|caiss|comptab|econom|financ|admission/.test(f)) return "scolarite";
  if (/secretar|accueil|reception|standard|hotesse|assistant/.test(f)) return "secretariat";
  return null;
}
