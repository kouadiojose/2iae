// État du formulaire de l'éditeur (informations, classes, site) et calcul
// des seules différences à envoyer : la vie scolaire ou la direction ne
// renvoient jamais un champ qu'elles n'ont pas touché.
import type { CoursDetail } from "@shared/schema";

export type FormulaireCours = {
  titre: string;
  description: string;
  objectifs: string;
  couleur: string;
  imageUrl: string;
  /** « AAAA-MM-JJ » ou vide. */
  dateDebut: string;
  dateFin: string;
  /** Identifiant en texte (liste déroulante) ou vide. */
  formateurId: string;
  accrocheSite: string;
  proposeSurSite: boolean;
  publierSurSite: boolean;
  /** Triés, pour comparer simplement. */
  classeIds: number[];
};

export function depuisDetail(c: CoursDetail): FormulaireCours {
  return {
    titre: c.titre,
    description: c.description,
    objectifs: c.objectifs,
    couleur: c.couleur.toUpperCase(),
    imageUrl: c.imageUrl ?? "",
    dateDebut: c.dateDebut ? c.dateDebut.slice(0, 10) : "",
    dateFin: c.dateFin ? c.dateFin.slice(0, 10) : "",
    formateurId: c.formateur ? String(c.formateur.id) : "",
    accrocheSite: c.accrocheSite ?? "",
    proposeSurSite: c.proposeSurSite,
    publierSurSite: c.publierSurSite,
    classeIds: c.classes.map((cl) => cl.id).sort((a, b) => a - b),
  };
}

// Heure d'Abidjan = UTC : une date de cours est un jour, stocké à minuit UTC.
const versIso = (jour: string) => (jour ? `${jour}T00:00:00.000Z` : null);

/** Corps du PATCH /api/cours/:id : uniquement les champs modifiés. */
export function differences(f: FormulaireCours, base: FormulaireCours): Record<string, unknown> {
  const corps: Record<string, unknown> = {};
  if (f.titre !== base.titre) corps.titre = f.titre.trim();
  if (f.description !== base.description) corps.description = f.description;
  if (f.objectifs !== base.objectifs) corps.objectifs = f.objectifs;
  if (f.couleur !== base.couleur) corps.couleur = f.couleur;
  if (f.imageUrl !== base.imageUrl) corps.imageUrl = f.imageUrl || null;
  if (f.dateDebut !== base.dateDebut) corps.dateDebut = versIso(f.dateDebut);
  if (f.dateFin !== base.dateFin) corps.dateFin = versIso(f.dateFin);
  if (f.formateurId !== base.formateurId) corps.formateurId = f.formateurId ? Number(f.formateurId) : null;
  if (f.accrocheSite !== base.accrocheSite) corps.accrocheSite = f.accrocheSite.trim() || null;
  if (f.proposeSurSite !== base.proposeSurSite) corps.proposeSurSite = f.proposeSurSite;
  if (f.publierSurSite !== base.publierSurSite) corps.publierSurSite = f.publierSurSite;
  return corps;
}

export const classesChangees = (f: FormulaireCours, base: FormulaireCours) =>
  f.classeIds.length !== base.classeIds.length || f.classeIds.some((id, i) => id !== base.classeIds[i]);

export const estModifie = (f: FormulaireCours, base: FormulaireCours) =>
  Object.keys(differences(f, base)).length > 0 || classesChangees(f, base);

/** Contrôles avant l'envoi (le serveur vérifie de toute façon). */
export function erreursFormulaire(f: FormulaireCours): Partial<Record<keyof FormulaireCours, string>> {
  const e: Partial<Record<keyof FormulaireCours, string>> = {};
  if (f.titre.trim().length < 3) e.titre = "Le titre doit faire au moins 3 lettres.";
  if (f.dateDebut && f.dateFin && f.dateFin < f.dateDebut) e.dateFin = "La fin doit venir après le début.";
  if (f.imageUrl && !/^(https:\/\/\S+|\/api\/fichiers\/\d+)$/.test(f.imageUrl)) e.imageUrl = "Adresse d'image invalide (elle commence par https://).";
  if (f.accrocheSite.length > 180) e.accrocheSite = "180 caractères au plus.";
  return e;
}
