// Sous-navigation du pilotage : toutes les pages de la vie scolaire à portée
// de pouce (la barre du bas n'a que cinq places).
import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useMoiConnecte } from "@/lib/auth";
import { cn } from "@/lib/utils";

const PAGES: { href: string; libelle: string; prefixes?: string[]; direction?: boolean }[] = [
  { href: "/pilotage", libelle: "Tableau" },
  { href: "/pilotage/suivi", libelle: "À contacter" },
  { href: "/pilotage/comptes", libelle: "Comptes", prefixes: ["/pilotage/comptes", "/pilotage/etudiants", "/pilotage/fiches"] },
  { href: "/pilotage/classes", libelle: "Classes et campus" },
  { href: "/pilotage/cours", libelle: "Cours" },
  { href: "/pilotage/planning", libelle: "Planning" },
  { href: "/pilotage/presences", libelle: "Présences" },
  { href: "/pilotage/annonces", libelle: "Annonces" },
  { href: "/pilotage/site", libelle: "Site 2iae.com" },
  { href: "/pilotage/ia", libelle: "Budget IA" },
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
        {PAGES.filter((p) => !p.direction || moi.role === "admin").map((p) => {
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
