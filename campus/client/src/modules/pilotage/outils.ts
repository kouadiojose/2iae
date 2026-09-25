// Petits outils du module pilotage (vie scolaire et direction).
import { useQuery } from "@tanstack/react-query";
import type { FicheConnexion, ReferencesPilotage, StatutPresencePilotage, CompteLigne } from "@shared/schema";
import { LIBELLES_ROLES } from "@shared/schema";
import type { Ton } from "@/components/ui/divers";
import { dateCourte, relatif } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";

/** Campus et classes du périmètre, pour les sélecteurs (mis en cache 5 min). */
export function useReferences() {
  return useQuery<ReferencesPilotage>({ queryKey: ["/api/pilotage/references"], staleTime: 5 * 60_000 });
}

/** « 0707123456 » → « 07 07 12 34 56 » ; les numéros étrangers restent tels quels. */
export function telephoneLisible(tel: string | null | undefined): string {
  if (!tel) return "";
  const n = tel.replace(/\D/g, "");
  if (n.length === 10) return n.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return tel;
}

/** « 67 % » ou « – » quand il n'y a encore rien à mesurer. */
export const pourcent = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${n}\u202f%`);

/** « il y a 3 jours », ou « jamais ». */
export const vuLe = (iso: string | null | undefined) => (iso ? relatif(iso, maintenantServeur()) : "jamais");

/** Couleur de pastille pour chaque statut de présence (toujours accompagnée de son libellé). */
export const TON_PRESENCE: Record<StatutPresencePilotage, Ton> = {
  emarge: "succes",
  pointe: "succes",
  en_ligne: "succes",
  justifie: "gris",
  incident: "encre",
  partiel: "alerte",
  absent: "danger",
};

/** Couleur de case de la frise d'assiduité. */
export const FOND_PRESENCE: Record<StatutPresencePilotage, string> = {
  emarge: "bg-succes",
  pointe: "bg-succes",
  en_ligne: "bg-succes",
  justifie: "bg-texte-gris",
  incident: "bg-encre",
  partiel: "bg-alerte",
  absent: "bg-danger",
};

/** Libellé court du rôle pour les listes. */
export const libelleRole = (r: CompteLigne["role"]) => LIBELLES_ROLES[r];

/** État d'activation lisible : « Activé », « Code provisoire jusqu'au 24 oct. », « Code expiré », « Désactivé ». */
export function etatCompte(c: Pick<CompteLigne, "actif" | "active" | "codeExpireLe">): { texte: string; ton: Ton } {
  if (!c.actif) return { texte: "Désactivé", ton: "gris" };
  if (c.active) return { texte: "Activé", ton: "succes" };
  if (c.codeExpireLe && new Date(c.codeExpireLe).getTime() < maintenantServeur()) return { texte: "Code expiré", ton: "danger" };
  return { texte: c.codeExpireLe ? `Code provisoire · ${dateCourte(c.codeExpireLe)}` : "Pas encore activé", ton: "alerte" };
}

/**
 * Fiches venant d'être générées (création, import, nouveau code) : gardées en
 * mémoire le temps d'aller à la page d'impression, jamais enregistrées dans
 * le navigateur. Un rechargement de la page les efface : il faudra alors
 * régénérer les codes (la page le propose).
 */
let fichesEnMemoire: FicheConnexion[] = [];
export function memoriserFiches(fiches: FicheConnexion[]) {
  fichesEnMemoire = fiches;
}
export function fichesMemorisees(ids: number[]): FicheConnexion[] | null {
  if (!ids.length || fichesEnMemoire.length !== ids.length) return null;
  const parId = new Map(fichesEnMemoire.map((f) => [f.id, f]));
  const toutes = ids.map((id) => parId.get(id));
  return toutes.every(Boolean) ? (toutes as FicheConnexion[]) : null;
}

/** Adresse de la page d'impression pour ces comptes. */
export const lienFiches = (ids: number[]) => `/pilotage/fiches?ids=${ids.join(",")}`;

/** Copie un texte et le dit (les vieux navigateurs sans presse-papiers retombent sur une sélection manuelle). */
export async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

/** Lundi (AAAA-MM-JJ, heure d'Abidjan = UTC) de la semaine qui contient cette date. */
export function lundiIso(d: Date | number = maintenantServeur()): string {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

/** Décale une semaine (AAAA-MM-JJ) de n semaines. */
export function decalerSemaine(lundi: string, n: number): string {
  const x = new Date(`${lundi}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 7 * n);
  return x.toISOString().slice(0, 10);
}

/** « Semaine du 21 au 27 septembre » */
export function libelleSemaine(lundi: string): string {
  const debut = new Date(`${lundi}T00:00:00Z`);
  const fin = new Date(debut.getTime() + 6 * 86_400_000);
  const f = (d: Date, mois: boolean) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", ...(mois ? { month: "long" } : {}), timeZone: "Africa/Abidjan" }).format(d);
  const memeMois = debut.getUTCMonth() === fin.getUTCMonth();
  return `Semaine du ${f(debut, !memeMois)} au ${f(fin, true)}`;
}

/** Lit un paramètre de l'adresse (?seance=12). */
export function parametre(nom: string): string | null {
  return new URLSearchParams(window.location.search).get(nom);
}
