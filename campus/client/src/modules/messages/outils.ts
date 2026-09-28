// Outils du module messages (client) : heures façon WhatsApp, brouillons
// gardés sur le téléphone, clés d'envoi, écran d'ordinateur ou de téléphone.
import { useEffect, useState } from "react";
import { heure, dateCourte } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { queryClient } from "@/lib/queryClient";
import type { Role } from "@shared/schema";
import type { ConversationResume } from "@shared/schema";

const JOUR = 86_400_000;
const FUSEAU = "Africa/Abidjan";

/** Jour civil à Abidjan (GMT toute l'année) : nombre de jours depuis 1970. */
const numeroJour = (x: string | number | Date) => Math.floor(new Date(x).getTime() / JOUR);

export const memeJour = (a: string | number, b: string | number) => numeroJour(a) === numeroJour(b);

/** Heure de la liste : « 14h32 », « Hier », « lundi », « 22 sept. ». */
export function heureListe(iso: string, maintenant = maintenantServeur()): string {
  const ecart = numeroJour(maintenant) - numeroJour(iso);
  if (ecart <= 0) return heure(iso);
  if (ecart === 1) return "Hier";
  if (ecart < 7) return new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: FUSEAU }).format(new Date(iso));
  return dateCourte(iso);
}

/** Séparateur de jours du fil : « Aujourd'hui », « Hier », « Mardi 22 septembre ». */
export function libelleJour(iso: string, maintenant = maintenantServeur()): string {
  const ecart = numeroJour(maintenant) - numeroJour(iso);
  if (ecart <= 0) return "Aujourd'hui";
  if (ecart === 1) return "Hier";
  const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU };
  if (new Date(iso).getUTCFullYear() !== new Date(maintenant).getUTCFullYear()) options.year = "numeric";
  const t = new Intl.DateTimeFormat("fr-FR", options).format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** « 0:42 » */
export function dureeCourte(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Tutoiement pour les étudiants, vouvoiement pour les formateurs et l'équipe. */
export const selonRole = (role: Role, tu: string, vous: string) => (role === "etudiant" ? tu : vous);

/** Identifiant d'envoi (idempotence de la file d'envoi hors ligne). */
export function nouvelleCle(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* contexte non sécurisé : on retombe sur le hasard ci-dessous */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Brouillons (gardés sur le téléphone, par conversation) ─────────────────

const cleBrouillon = (id: number) => `campus:messages:brouillon:${id}`;

export function lireBrouillon(id: number): string {
  try {
    return localStorage.getItem(cleBrouillon(id)) ?? "";
  } catch {
    return "";
  }
}

export function ecrireBrouillon(id: number, texte: string) {
  try {
    if (texte.trim()) localStorage.setItem(cleBrouillon(id), texte);
    else localStorage.removeItem(cleBrouillon(id));
  } catch {
    /* stockage plein ou interdit : le brouillon reste en mémoire seulement */
  }
}

// ── Liste des conversations en cache ───────────────────────────────────────

export const CLE_LISTE = "/api/conversations";

/** Met à jour une ligne de la liste sans la recharger (ex. non lus remis à zéro). */
export function majLigneListe(id: number, maj: Partial<ConversationResume>) {
  queryClient.setQueryData<ConversationResume[]>([CLE_LISTE], (liste) => liste?.map((c) => (c.id === id ? { ...c, ...maj } : c)));
}

let minuterieListe: ReturnType<typeof setTimeout> | undefined;
/** Recharge la liste (regroupe les demandes rapprochées). */
export function rafraichirListe() {
  clearTimeout(minuterieListe);
  minuterieListe = setTimeout(() => void queryClient.invalidateQueries({ queryKey: [CLE_LISTE], exact: true }), 400);
}

// ── Écran ──────────────────────────────────────────────────────────────────

const REQUETE_ORDINATEUR = "(min-width: 1024px)";

/** Écran large : la liste et le fil côte à côte. Sur téléphone : deux écrans. */
export function useEstOrdinateur(): boolean {
  const [ordinateur, setOrdinateur] = useState(() => typeof window !== "undefined" && window.matchMedia(REQUETE_ORDINATEUR).matches);
  useEffect(() => {
    const mq = window.matchMedia(REQUETE_ORDINATEUR);
    const maj = () => setOrdinateur(mq.matches);
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, []);
  return ordinateur;
}

/** L'onglet est-il affiché ? (Le fil n'écoute le temps réel que dans ce cas.) */
export function useOngletVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  useEffect(() => {
    const maj = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", maj);
    return () => document.removeEventListener("visibilitychange", maj);
  }, []);
  return visible;
}

/**
 * Zone réellement visible du téléphone (le clavier la réduit) : le fil plein
 * écran suit la « visual viewport » pour que la zone de saisie reste au-dessus
 * du clavier, sur Android comme sur iPhone.
 */
export function useZoneVisible(): { hauteur: number; haut: number } | null {
  const lire = () => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    return vv ? { hauteur: Math.round(vv.height), haut: Math.round(vv.offsetTop) } : null;
  };
  const [zone, setZone] = useState(lire);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const maj = () => setZone(lire());
    vv.addEventListener("resize", maj);
    vv.addEventListener("scroll", maj);
    return () => {
      vv.removeEventListener("resize", maj);
      vv.removeEventListener("scroll", maj);
    };
  }, []);
  return zone;
}
