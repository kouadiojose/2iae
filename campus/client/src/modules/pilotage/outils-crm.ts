// Outils communs du CRM des étudiants et de la scolarité (pilotage et
// espace « Mon dossier ») : montants, états des échéances et des pièces.
import type { EcheanceEtat, PieceDossier, StatutScolarite, MoyenPaiement } from "@shared/schema";
import { LIBELLES_MOYENS_PAIEMENT } from "@shared/schema";
import type { Ton } from "@/components/ui/divers";

/** « 150 000 F CFA » (espaces insécables fines, comme le reste du campus). */
export const fcfa = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${new Intl.NumberFormat("fr-FR").format(n)} F CFA`);

/** « 150 000 » sans l'unité (tableaux). */
export const montant = (n: number | null | undefined) => (n === null || n === undefined ? "–" : new Intl.NumberFormat("fr-FR").format(n));

/** Montant saisi (« 150 000 », « 150.000 ») → entier, ou null si illisible. */
export function lireMontant(saisie: string): number | null {
  const chiffres = saisie.replace(/[^\d]/g, "");
  if (!chiffres) return null;
  const n = Number(chiffres);
  return Number.isSafeInteger(n) ? n : null;
}

/** Aujourd'hui, AAAA-MM-JJ (heure d'Abidjan = UTC). */
export const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** « 31 oct. 2026 » depuis AAAA-MM-JJ (sans décalage de fuseau). */
export function jourCourt(jour: string | null | undefined): string {
  if (!jour) return "sans date";
  const d = new Date(`${jour.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export const ETATS_ECHEANCE: Record<EcheanceEtat["etat"], { texte: string; ton: Ton }> = {
  payee: { texte: "Payée", ton: "succes" },
  partielle: { texte: "En partie payée", ton: "alerte" },
  en_retard: { texte: "En retard", ton: "danger" },
  a_venir: { texte: "À venir", ton: "gris" },
  remise: { texte: "Remise", ton: "orange" },
};

export const ETATS_PIECE: Record<PieceDossier["statut"], { texte: string; ton: Ton }> = {
  recue: { texte: "Reçue", ton: "succes" },
  a_verifier: { texte: "À vérifier", ton: "alerte" },
  refusee: { texte: "À refaire", ton: "danger" },
  manquante: { texte: "Manquante", ton: "gris" },
};

export const TONS_STATUT: Record<StatutScolarite, Ton> = {
  inscrit: "succes",
  suspendu: "alerte",
  abandon: "danger",
  diplome: "encre",
  transfere: "gris",
};

export const libelleMoyen = (m: MoyenPaiement) => LIBELLES_MOYENS_PAIEMENT[m];

/** Moyens proposés en premier au guichet (les plus courants en Côte d'Ivoire). */
export const MOYENS_ORDONNES: MoyenPaiement[] = ["especes", "wave", "orange_money", "mtn_money", "moov_money", "virement", "cheque", "autre"];
