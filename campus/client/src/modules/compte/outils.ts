// Petits outils du module compte (connexion, bienvenue, profil).
import { accueilDuRole } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { Moi } from "@shared/schema";

/**
 * Adresse de retour après connexion (?retour=…), seulement si elle reste
 * sur le campus : jamais « //site-pirate.com » ni une page de connexion.
 */
export function retourSur(brut: string | null | undefined): string | null {
  if (!brut) return null;
  if (!brut.startsWith("/") || brut.startsWith("//") || brut.startsWith("/\\")) return null;
  if (/^\/(connexion|activer|bienvenue|mot-de-passe-oublie|reinitialiser)(\/|\?|$)/.test(brut)) return null;
  return brut;
}

/** Il reste des étapes obligatoires : code provisoire à remplacer ou charte à accepter. */
export const doitPasserParBienvenue = (m: Pick<Moi, "doitChangerMotDePasse" | "charteAccepteeLe">) =>
  m.doitChangerMotDePasse || !m.charteAccepteeLe;

/** Où envoyer la personne juste après sa connexion. */
export function destinationApresConnexion(m: Moi, retour: string | null): string {
  if (doitPasserParBienvenue(m)) return `/bienvenue${retour ? `?retour=${encodeURIComponent(retour)}` : ""}`;
  return retour ?? accueilDuRole(m.role);
}

/** Enregistre la personne connectée (après connexion, activation ou nouveau code). */
export function installerMoi(m: Moi, viderCache = false) {
  // Un autre compte était peut-être ouvert sur ce téléphone : on ne garde rien de ses données.
  if (viderCache) queryClient.clear();
  queryClient.setQueryData(["/api/auth/moi"], m);
}

/** Même règle que codeSecretAcceptable() côté serveur : refuse 123456, 000000, 654321… */
export function codeAcceptable(code: string): boolean {
  if (!/^\d+$/.test(code)) return true;
  if (/^(\d)\1+$/.test(code)) return false;
  const suites = "0123456789012345678909876543210987654321";
  if (suites.includes(code)) return false;
  return !["123123", "121212", "101010", "112233", "159753", "200000", "202020"].includes(code);
}

/** L'identifiant tapé est une adresse e-mail (personnel du campus). */
export const ressembleEmail = (identifiant: string) => identifiant.includes("@");

/** Ressemble à un matricule 2IAE (« 24GC0123 ») : sert à pré-remplir le message d'aide. */
export const ressembleMatricule = (identifiant: string) => /^\d{2}[A-Za-z]{2,4}\d{3,5}$/.test(identifiant.trim());

/** Lien WhatsApp avec un message pré-rempli. */
export function lienWhatsApp(numero: string, texte: string) {
  return `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(texte)}`;
}

export const attendre = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** Étudiants tutoyés, personnel vouvoyé. */
export const tuOuVous = (m: Pick<Moi, "role">) => (tu: string, vous: string) => (m.role === "etudiant" ? tu : vous);
