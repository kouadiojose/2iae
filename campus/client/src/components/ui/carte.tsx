import type { HTMLAttributes, ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function Carte({ className, ...reste }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-ligne bg-white p-5", className)} {...reste} />;
}

/** Carte cliquable (bordure orange au survol, comme « Mes cours » de la maquette). */
export function CarteLien({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-2xl border border-ligne bg-white p-5 text-encre no-underline transition-colors hover:border-orange hover:text-encre focus-visible:border-orange",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Grand panneau crème de la maquette (« Tout le campus au même endroit »). */
export function Panneau({ className, ...reste }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[32px] bg-creme p-6 sm:p-10", className)} {...reste} />;
}

/** Titre de section avec lien « tout voir » optionnel. */
export function TitreSection({ titre, action, className }: { titre: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 className="text-xl font-extrabold">{titre}</h2>
      {action}
    </div>
  );
}
