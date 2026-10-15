// Professeurs (José, 15 octobre 2026 : « depuis la direction, créer des professeurs et les attacher à une classe ; un
// cours peut avoir plusieurs professeurs ») : contrats partagés entre server/routes/professeurs.ts et la page
// « Professeurs » du pilotage (client/src/modules/pilotage/PageProfesseurs.tsx). Un professeur est un compte
// « formateur » ; le principal d'un cours est cours.formateur_id, les autres sont dans cours_formateurs.
import type { InvitationRemise } from "./lancement";
import type { StatutCours } from "./schema/cours";

export type EtatProfesseur = "a_inviter" | "invite" | "connecte" | "desactive";

export type CoursDuProfesseurDto = {
  coursId: number;
  code: string;
  titre: string;
  couleur: string;
  statut: StatutCours;
  principal: boolean;
  /** « 1BTS · 2BTS · 5 campus » ; "" sans classe. */
  classes: string;
  /** « 1BTS Riviera · 2BTS Yopougon » (≤ 3 classes), sinon comme `classes`. */
  classesDetail: string;
  sansClasse: boolean;
  /** La personne peut retirer, nommer principal, changer les classes. */
  gerable: boolean;
  /** « le lundi à 8h30 » s'il intervient dans un créneau publié de ce cours, sinon null. */
  programme: string | null;
};

export type ProfesseurDto = {
  id: number;
  prenom: string;
  nom: string;
  titre: string | null;
  photoUrl: string | null;
  /** Coordonnées et dates : null sans le droit « comptes du personnel ». */
  telephone: string | null;
  email: string | null;
  etat: EtatProfesseur;
  /** Dernier lien d'invitation préparé (ISO), dernière connexion (ISO). */
  inviteLe: string | null;
  vuLe: string | null;
  cours: CoursDuProfesseurDto[];
};

/** GET /api/pilotage/professeurs */
export type ProfesseursDto = { professeurs: ProfesseurDto[]; peutCreer: boolean; peutInviter: boolean; peutAttacher: boolean };

/** GET /api/pilotage/professeurs/cours */
export type CoursAAttacherDto = {
  id: number;
  code: string;
  titre: string;
  couleur: string;
  statut: StatutCours;
  classes: string;
  niveaux: string[];
  sansClasse: boolean;
  professeurs: { id: number; nom: string; principal: boolean }[];
};

/** GET /api/pilotage/cours/:id/professeurs */
export type ProfesseurDuCoursDto = {
  id: number;
  prenom: string;
  nom: string;
  photoUrl: string | null;
  principal: boolean;
  etat: EtatProfesseur;
  programme: string | null;
};

/** GET /api/pilotage/cours/:id/professeurs : la liste, et si la personne peut la changer (ajouter, principal, retirer). */
export type ProfesseursDuCoursDto = { professeurs: ProfesseurDuCoursDto[]; gerable: boolean };

/** POST /api/pilotage/professeurs/verifier { telephone?, email? } : le message d'erreur de chaque champ déjà pris, sinon null. */
export type VerificationProfesseurDto = { telephone: string | null; email: string | null };

/** POST, PUT, DELETE /api/pilotage/cours/:id/professeurs… */
export type ReponseProfesseursCours = {
  professeurs: ProfesseurDuCoursDto[];
  deja?: boolean;
  principal?: boolean;
  nouveauPrincipal?: string | null;
  avertissement?: string | null;
};

/** POST /api/pilotage/professeurs */
export type ProfesseurCreeDto = { professeur: ProfesseurDto; attaches: number[]; invitation: InvitationRemise | null };
