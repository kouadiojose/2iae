// Pièces communes de la bibliothèque : couverture, carte d'un livre, notice.
import { useState } from "react";
import { Link } from "wouter";
import { BadgeCheck, BookOpen, BookOpenText, ChevronRight, CircleAlert, ExternalLink, Sparkles, Library } from "lucide-react";
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

/** « Lecture libre » (liseuse du campus) ou « Emprunt gratuit » (Internet Archive). */
export function BadgeLecture({ livre }: { livre: Pick<LivreDto, "lecture"> }) {
  if (!livre.lecture) return null;
  return livre.lecture.mode === "libre" ? (
    <Badge ton="orange">
      <BookOpenText className="mr-1 inline h-3.5 w-3.5" aria-hidden />
      Lecture libre
    </Badge>
  ) : (
    <Badge ton="gris">
      <Library className="mr-1 inline h-3.5 w-3.5" aria-hidden />
      Emprunt gratuit
    </Badge>
  );
}

/**
 * Livre recommandé par le bibliothécaire, sous sa réponse : couverture,
 * notice, et deux gestes, « Résumé » (la conversation continue sur ce livre)
 * et « Ouvrir » (la page du livre : lire, fiche, questions, exposé).
 */
export function CarteLivreCite({
  livre,
  onResume,
  desactive,
  etudiant,
}: {
  livre: LivreDto & { verifie: boolean };
  onResume: () => void;
  desactive?: boolean;
  etudiant: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-ligne bg-white p-3">
      <Link href={`/bibliotheque/livres/${livre.id}`} className="shrink-0" aria-label={`Ouvrir « ${livre.titre} »`}>
        <Couverture livre={livre} className="w-16" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          {livre.verifie ? (
            <BadgeVerification livre={livre} />
          ) : (
            <Badge ton="gris">
              <CircleAlert className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              Non retrouvé dans nos catalogues
            </Badge>
          )}
          <BadgeLecture livre={livre} />
        </div>
        <Link href={`/bibliotheque/livres/${livre.id}`} className="line-clamp-3 font-extrabold leading-snug text-encre no-underline hover:text-orange-fonce">
          {livre.titre}
        </Link>
        <span className="text-sm text-texte-pale">{ligneAuteurs(livre)}</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {livre.lecture?.mode === "libre" ? (
            // Livre lisible en entier : son dossier d'étude (lu une fois par le campus) plutôt qu'un résumé de mémoire.
            <Link
              href={`/bibliotheque/livres/${livre.id}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-encre px-3 text-sm font-bold text-white no-underline hover:bg-orange-fonce"
            >
              <Sparkles className="h-4 w-4" aria-hidden /> Dossier d'étude
            </Link>
          ) : (
            <button
              type="button"
              onClick={onResume}
              disabled={desactive}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-encre px-3 text-sm font-bold text-white hover:bg-orange-fonce disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" aria-hidden /> Résumé
            </button>
          )}
          <Link
            href={livre.lecture?.libreId ? `/bibliotheque/libres/${livre.lecture.libreId}` : `/bibliotheque/livres/${livre.id}${livre.lecture?.mode === "libre" ? "?onglet=lire" : ""}`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-ligne px-3 text-sm font-bold text-encre no-underline hover:border-orange"
          >
            {livre.lecture?.mode === "libre" ? <BookOpenText className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
            {livre.lecture?.mode === "libre" ? (etudiant ? "Lire le livre" : "Lire le livre") : "Ouvrir"}
          </Link>
        </div>
      </div>
    </div>
  );
}
