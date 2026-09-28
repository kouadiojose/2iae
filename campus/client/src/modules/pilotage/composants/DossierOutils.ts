// Outils partagés par les onglets du dossier étudiant (CRM) et la page
// Relances : cache du dossier, dates relatives des relances, icônes du journal.
import { StickyNote, Phone, MessageCircle, MessageSquare, CalendarClock, Mail, Users, type LucideIcon } from "lucide-react";
import type { DossierCrm, ScolariteEtudiant, TypeSuivi } from "@shared/schema";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { aujourdhui } from "../outils-crm";

/** Clé de requête (et adresse) du dossier CRM d'un étudiant. */
export const urlCrm = (etudiantId: number | string) => `/api/pilotage/etudiants/${etudiantId}/crm`;

/** Met à jour le dossier CRM en cache (réponse du serveur), sans attendre une nouvelle lecture. */
export function majCrm(etudiantId: number, f: (d: DossierCrm) => DossierCrm) {
  queryClient.setQueryData<DossierCrm>([urlCrm(etudiantId)], (d) => (d ? f(d) : d));
}

/**
 * Marque comme périmées les listes qui résument ce dossier (étudiants,
 * scolarité, relances, tableau, « À contacter »). La page ouverte n'est pas
 * relue : elle a déjà la réponse du serveur.
 */
export function perimerListes(etudiantId: number) {
  const dossier = `/api/pilotage/etudiants/${etudiantId}`;
  return queryClient.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey[0];
      if (typeof k !== "string" || k === dossier || k === `${dossier}/crm`) return false;
      return ["/api/pilotage/etudiants", "/api/pilotage/scolarite", "/api/pilotage/relances", "/api/pilotage/tableau", "/api/pilotage/a-contacter"].some((p) => k.startsWith(p));
    },
  });
}

/** Nouvelle scolarité renvoyée par le serveur : affichée tout de suite, relue, et les listes suivront. */
export async function majScolarite(etudiantId: number, s: ScolariteEtudiant) {
  majCrm(etudiantId, (d) => ({ ...d, scolarite: s }));
  await Promise.all([rafraichir(urlCrm(etudiantId)), perimerListes(etudiantId)]);
}

// ── Dates des relances (AAAA-MM-JJ, heure d'Abidjan = UTC) ─────────────────

/** Décale un jour AAAA-MM-JJ de n jours. */
export function decalerJour(jour: string, n: number): string {
  const x = new Date(`${jour.slice(0, 10)}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** Aujourd'hui + n jours. */
export const dansJours = (n: number) => decalerJour(aujourdhui(), n);

/** Nombre de jours entre aujourd'hui et ce jour (négatif : passé). */
export function ecartJours(jour: string): number {
  const a = Date.parse(`${aujourdhui()}T12:00:00Z`);
  const b = Date.parse(`${jour.slice(0, 10)}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** « aujourd'hui », « hier », « demain », « il y a 3 jours », « dans 3 jours ». */
export function jourRelatif(jour: string): string {
  const n = ecartJours(jour);
  if (n === 0) return "aujourd'hui";
  if (n === -1) return "hier";
  if (n === 1) return "demain";
  return n < 0 ? `il y a ${-n} jours` : `dans ${n} jours`;
}

/** Raccourcis d'échéance proposés pour une relance. */
export const RACCOURCIS_ECHEANCE: { libelle: string; jours: number }[] = [
  { libelle: "Demain", jours: 1 },
  { libelle: "Dans 3 jours", jours: 3 },
  { libelle: "Dans 7 jours", jours: 7 },
];

// ── Journal ────────────────────────────────────────────────────────────────

export const ICONES_SUIVI: Record<TypeSuivi, LucideIcon> = {
  note: StickyNote,
  appel: Phone,
  whatsapp: MessageCircle,
  sms: MessageSquare,
  rendez_vous: CalendarClock,
  email: Mail,
  famille: Users,
};

/** Mobile Money : une référence de transaction est attendue (elle évite d'encaisser deux fois). */
export const MOYENS_MOBILES = ["wave", "orange_money", "mtn_money", "moov_money"] as const;
