// Sous-navigation du pilotage : toutes les pages de la vie scolaire à portée
// de pouce (la barre du bas n'a que cinq places).
import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useMoiConnecte } from "@/lib/auth";
import { entreeVisible, type ElementNav } from "@/navigation";
import { cn } from "@/lib/utils";

// « droit » : ce que le profil de l'équipe doit permettre pour voir la page (shared/schema/ext-profils.ts).
const PAGES: ({ href: string; libelle: string; prefixes?: string[] } & Pick<ElementNav, "droit" | "sansDroit" | "direction">)[] = [
  { href: "/pilotage", libelle: "Tableau" },
  { href: "/pilotage/etudiants", libelle: "Étudiants", prefixes: ["/pilotage/etudiants", "/pilotage/preinscrits"], droit: "comptes_voir" },
  { href: "/pilotage/relances", libelle: "Relances", droit: "crm" },
  { href: "/pilotage/scolarite", libelle: "Scolarité", prefixes: ["/pilotage/scolarite", "/pilotage/recus"], droit: "argent" },
  { href: "/pilotage/rentree", libelle: "Rentrée", droit: "outils_campus" },
  { href: "/pilotage/suivi", libelle: "À contacter", droit: "suivi" },
  { href: "/pilotage/comptes", libelle: "Comptes", prefixes: ["/pilotage/comptes", "/pilotage/fiches"], droit: "comptes_voir" },
  { href: "/pilotage/classes", libelle: "Classes et campus" },
  { href: "/pilotage/cours", libelle: "Cours", droit: "programme" },
  { href: "/pilotage/programme", libelle: "Emploi du temps", prefixes: ["/pilotage/programme"], droit: "programme" },
  { href: "/emploi-du-temps", libelle: "Emploi du temps", sansDroit: "programme" },
  { href: "/pilotage/planning", libelle: "Planning" },
  { href: "/pilotage/presences", libelle: "Présences", droit: "presences_voir" },
  { href: "/pilotage/engagement", libelle: "Engagement", droit: "presences_voir" },
  { href: "/pilotage/annonces", libelle: "Annonces", droit: "annonces" },
  { href: "/pilotage/site", libelle: "Site public", droit: "outils_campus" },
  { href: "/pilotage/formateurs", libelle: "Présentations", prefixes: ["/pilotage/formateurs"], direction: true },
  { href: "/pilotage/visio", libelle: "Visio", droit: "outils_campus" },
  { href: "/pilotage/ia", libelle: "Budget IA", droit: "outils_campus" },
];

export function SousNav({ className }: { className?: string }) {
  const [chemin] = useLocation();
  const moi = useMoiConnecte();
  const barre = useRef<HTMLElement>(null);
  // Sur téléphone, la page ouverte reste visible dans la barre qui défile.
  useEffect(() => {
    const nav = barre.current;
    const actif = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && actif) nav.scrollLeft = Math.max(0, actif.offsetLeft - nav.clientWidth / 2 + actif.clientWidth / 2);
  }, [chemin]);
  return (
    <nav ref={barre} aria-label="Pages du pilotage" className={cn("relative -mx-4 overflow-x-auto px-4 sm:-mx-7 sm:px-7 print:hidden", className)}>
      <ul className="flex w-max gap-1.5">
        {PAGES.filter((p) => entreeVisible(p, moi)).map((p) => {
          const actif = chemin === p.href || (p.prefixes ?? []).some((x) => chemin === x || chemin.startsWith(`${x}/`));
          return (
            <li key={p.href}>
              <Link
                href={p.href}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold no-underline transition-colors",
                  actif ? "border-encre bg-encre text-white hover:text-white" : "border-ligne bg-white text-texte-doux hover:border-orange hover:text-encre",
                )}
              >
                {p.libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
