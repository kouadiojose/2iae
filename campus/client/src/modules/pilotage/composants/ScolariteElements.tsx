// Petits éléments communs aux écrans de la scolarité (pilotage, reçus et
// espace « Mon dossier » de l'étudiant).
import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Lien WhatsApp vert (nouvel onglet), assez grand pour le pouce. */
export function LienWhatsApp({ href, children, className, grand }: { href: string; children: ReactNode; className?: string; grand?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-encre no-underline transition-colors hover:bg-encre hover:text-white",
        grand ? "min-h-[56px] px-5 text-base" : "min-h-[44px] px-4 text-sm",
        className,
      )}
    >
      <MessageCircle className={cn("shrink-0", grand ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
      {children}
    </a>
  );
}

/** « Tronc commun 1BTS · Azaguié » : le campus n'est ajouté que s'il n'est pas déjà dans le nom de la classe. */
export function classeEtCampus(classe: string | null | undefined, site: string | null | undefined): string {
  if (!classe) return site ? `Campus ${site}` : "";
  if (!site || classe.includes(site)) return classe;
  return `${classe} · ${site}`;
}

/** Nom de la classe sans le campus en suffixe (listes déjà rangées par campus). */
export function classeSansCampus(classe: string, site: string | null | undefined): string {
  if (site && classe.endsWith(` · ${site}`)) return classe.slice(0, -(site.length + 3));
  return classe;
}

/** « septembre 2026 » depuis AAAA-MM-JJ. */
export function moisDe(jour: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${jour.slice(0, 7)}-15T12:00:00Z`));
}

/** « 28 septembre 2026 » depuis AAAA-MM-JJ (sans décalage de fuseau). */
export function jourEnLettres(jour: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${jour.slice(0, 10)}T12:00:00Z`));
}
