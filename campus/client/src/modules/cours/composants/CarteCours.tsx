// Carte d'un cours dans « Mes cours », à la maquette : code mono orange,
// titre, méta, grand pourcentage et barre de progression. Côté formateur :
// état de publication, leçons en brouillon, classes et site.
import { Link } from "wouter";
import { Radio, PenLine, Globe } from "lucide-react";
import { Badge, BarreProgression } from "@/components/ui/divers";
import { LienBouton } from "@/components/ui/bouton";
import { jourLong, heure, heureDouble } from "@/lib/dates";
import { cn, pluriel } from "@/lib/utils";
import { LIBELLES_STATUT } from "../outils";
import type { CoursResume } from "@shared/schema";

function LigneSeance({ cours, formateur }: { cours: CoursResume; formateur?: boolean }) {
  const s = cours.prochaineSeance;
  if (!s) return null;
  if (s.statut === "en_direct") {
    return (
      <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-direct">
        <span className="point-direct" /> En direct maintenant
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-texte-pale">
      <Radio className="h-3.5 w-3.5 text-orange-fonce" />
      Prochain live : {jourLong(s.debut)} · {formateur ? heureDouble(s.debut) : heure(s.debut)}
    </span>
  );
}

/** Carte étudiant : toute la carte mène au cours. */
export function CarteCoursEtudiant({ cours }: { cours: CoursResume }) {
  const pct = cours.progression ?? 0;
  const fini = cours.nbLecons > 0 && pct === 100;
  const meta = [
    cours.formateur ? `${cours.formateur.prenom} ${cours.formateur.nom}${cours.formateur.ville ? ` · depuis ${cours.formateur.ville}` : ""}` : null,
    cours.nbLecons ? pluriel(cours.nbLecons, "leçon") : "Leçons à venir",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={`/cours/${cours.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white px-5 py-[18px] text-encre no-underline transition-colors hover:border-orange hover:text-encre focus-visible:border-orange"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[11px] font-semibold text-orange-fonce">{cours.code}</span>
          <span className="text-[17px] font-bold leading-snug">{cours.titre}</span>
          <span className="text-[13px] text-texte-gris">{meta}</span>
        </div>
        <span className={cn("shrink-0 text-[22px] font-extrabold tabular-nums", fini && "text-succes")} aria-label={`${pct} % terminé`}>
          {pct}%
        </span>
      </div>
      <BarreProgression valeur={pct} ton={fini ? "succes" : "orange"} />
      <LigneSeance cours={cours} />
    </Link>
  );
}

/** Carte formateur / équipe : voir le cours, ou le modifier. */
export function CarteCoursEnseignant({ cours, montrerFormateur }: { cours: CoursResume; montrerFormateur?: boolean }) {
  const tonStatut = cours.statut === "publie" ? "succes" : cours.statut === "archive" ? "gris" : "alerte";
  const details = [
    pluriel(cours.nbLecons, "leçon publiée", "leçons publiées"),
    cours.nbBrouillons ? pluriel(cours.nbBrouillons, "brouillon") : null,
    pluriel(cours.nbClasses, "classe"),
    cours.nbEtudiants !== null ? pluriel(cours.nbEtudiants, "étudiant") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-col rounded-2xl border border-ligne bg-white transition-colors hover:border-orange">
      <Link href={`/cours/${cours.id}`} className="flex flex-col gap-2 px-5 pb-3 pt-[18px] text-encre no-underline hover:text-encre">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-orange-fonce">{cours.code}</span>
          <Badge ton={tonStatut}>{LIBELLES_STATUT[cours.statut]}</Badge>
          {cours.publierSurSite ? (
            <Badge ton="encre">
              <Globe className="h-3 w-3" /> Sur 2iae.com
            </Badge>
          ) : cours.proposeSurSite ? (
            <Badge ton="orange">
              <Globe className="h-3 w-3" /> Proposé au site
            </Badge>
          ) : null}
        </div>
        <span className="text-[17px] font-bold leading-snug">{cours.titre}</span>
        <span className="text-[13px] text-texte-gris">{details}</span>
        {montrerFormateur && (
          <span className="text-[13px] text-texte-pale">
            {cours.formateur ? `Formateur : ${cours.formateur.prenom} ${cours.formateur.nom}` : "Aucun formateur pour l'instant"}
          </span>
        )}
        <LigneSeance cours={cours} formateur />
      </Link>
      {cours.enseignant && (
        <div className="mt-auto flex items-center justify-end gap-2 border-t border-ligne-douce px-4 py-2.5">
          <LienBouton href={`/enseigner/cours/${cours.id}`} variante="contour" taille="sm" icone={<PenLine className="h-4 w-4" />} className="min-h-[44px]">
            Modifier
          </LienBouton>
        </div>
      )}
    </div>
  );
}
