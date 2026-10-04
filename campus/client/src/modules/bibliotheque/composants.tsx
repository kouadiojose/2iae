// Pièces communes de la bibliothèque : couverture, carte d'un livre, notice.
import { useState } from "react";
import { BadgeCheck, BookOpen, ChevronRight, CircleAlert, ExternalLink } from "lucide-react";
import { CarteLien } from "@/components/ui/carte";
import { Badge } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import { LIBELLES_NIVEAUX, LIBELLES_SOURCES, type LivreDto, type LivreProposeDto } from "@shared/schema/ext-bibliotheque";

/** Couverture du catalogue, ou une couverture dessinée (initiales du titre) si elle manque. */
export function Couverture({ livre, className }: { livre: Pick<LivreDto, "titre" | "auteurs" | "couvertureUrl">; className?: string }) {
  const [echec, setEchec] = useState(false);
  if (livre.couvertureUrl && !echec) {
    return (
      <img
        src={livre.couvertureUrl}
        alt=""
        loading="lazy"
        onError={() => setEchec(true)}
        onLoad={(e) => {
          // Open Library renvoie parfois une image de 1 px quand la couverture manque.
          if ((e.target as HTMLImageElement).naturalWidth < 10) setEchec(true);
        }}
        className={cn("aspect-[2/3] shrink-0 rounded-md bg-creme object-cover shadow-carte", className)}
      />
    );
  }
  return (
    <span className={cn("flex aspect-[2/3] shrink-0 flex-col justify-between overflow-hidden rounded-md bg-encre p-2 text-white shadow-carte", className)} aria-hidden>
      <BookOpen className="h-4 w-4 text-orange" />
      <span className="line-clamp-4 text-[10px] font-bold leading-tight">{livre.titre}</span>
    </span>
  );
}

export function BadgeVerification({ livre }: { livre: Pick<LivreDto, "source"> }) {
  return livre.source ? (
    <Badge ton="succes">
      <BadgeCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden />
      Vérifié
    </Badge>
  ) : (
    <Badge ton="gris">
      <CircleAlert className="mr-1 inline h-3.5 w-3.5" aria-hidden />À vérifier
    </Badge>
  );
}

export const ligneAuteurs = (l: Pick<LivreDto, "auteurs" | "annee" | "editeur">) =>
  [l.auteurs || "Auteur inconnu", l.editeur, l.annee ? String(l.annee) : null].filter(Boolean).join(" · ");

/** Livre proposé par une recherche : couverture, notice, raison du choix. */
export function CarteLivrePropose({ livre }: { livre: LivreProposeDto }) {
  return (
    <CarteLien href={`/bibliotheque/livres/${livre.id}`} className="flex gap-4 p-4">
      <Couverture livre={livre} className="w-16 sm:w-20" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge ton="orange">{LIBELLES_NIVEAUX[livre.niveau]}</Badge>
          <BadgeVerification livre={livre} />
        </span>
        <span className="text-[17px] font-extrabold leading-snug">{livre.titre}</span>
        <span className="text-sm text-texte-pale">{ligneAuteurs(livre)}</span>
        <span className="text-[15px] leading-relaxed">{livre.pourquoi}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 self-center text-texte-gris" aria-hidden />
    </CarteLien>
  );
}

/** Livre dans une liste courte (récents, populaires). */
export function CarteLivreCompacte({ livre }: { livre: LivreDto }) {
  return (
    <CarteLien href={`/bibliotheque/livres/${livre.id}`} className="flex items-center gap-3 px-3 py-3">
      <Couverture livre={livre} className="w-11" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 font-bold leading-snug">{livre.titre}</span>
        <span className="truncate text-sm text-texte-pale">{livre.auteurs}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
    </CarteLien>
  );
}

/** Où le livre a été vérifié, avec le lien vers la notice publique. */
export function LigneCatalogue({ livre }: { livre: LivreDto }) {
  if (!livre.source) {
    return (
      <p className="text-sm text-texte-pale">
        Ce livre n'a pas été retrouvé dans les catalogues publics. Il existe sans doute, mais vérifie le titre exact à la bibliothèque ou auprès de ton formateur avant de le citer.
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-texte-pale">
      <span>
        Notice vérifiée : {LIBELLES_SOURCES[livre.source]}
        {livre.isbn ? ` · ISBN ${livre.isbn}` : ""}
        {livre.pages ? ` · ${livre.pages} pages` : ""}
      </span>
      {livre.lienCatalogue && (
        <a href={livre.lienCatalogue} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold">
          Voir la notice <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      )}
    </p>
  );
}
