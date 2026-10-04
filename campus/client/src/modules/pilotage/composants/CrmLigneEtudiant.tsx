// Une ligne de la liste des étudiants (CRM) : carte sur téléphone, ligne de
// tableau sur ordinateur. Toute la ligne ouvre le dossier de l'étudiant.
import { Link } from "wouter";
import type { EtudiantCrmLigne } from "@shared/schema";
import { LIBELLES_STATUTS_SCOLARITE } from "@shared/schema";
import { Avatar, Badge } from "@/components/ui/divers";
import { cn, pluriel } from "@/lib/utils";
import { vuLe } from "../outils";
import { fcfa, TONS_STATUT } from "../outils-crm";

/** Colonnes du tableau sur ordinateur (en-tête et lignes). */
export const COLONNES_CRM = "lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1.2fr)]";

/** En-tête du tableau (ordinateur seulement). */
export function CrmEnTeteListe({ argent = true }: { argent?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn("hidden border-b border-ligne-douce bg-creme px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-texte-gris lg:grid lg:gap-4", COLONNES_CRM)}
    >
      <span>Étudiant</span>
      <span>Pièces</span>
      <span>{argent ? "Paiement" : ""}</span>
      <span>Relances</span>
      <span>Compte</span>
    </div>
  );
}

/** « Tronc commun 1BTS · Azaguié » contient déjà le campus : on ne le répète pas. */
function classeEtCampus(e: Pick<EtudiantCrmLigne, "classe" | "site">): string {
  return [e.classe, e.site && !(e.classe ?? "").includes(e.site) ? `Campus ${e.site}` : null].filter(Boolean).join(" · ") || "Sans classe";
}

/** argent : le profil voit les paiements (droit « argent », ext-profils.ts). */
export function CrmLigneEtudiant({ e, argent = true }: { e: EtudiantCrmLigne; argent?: boolean }) {
  const complet = e.pieces.recues >= e.pieces.requises;
  const f = e.finances;
  return (
    <li>
      <Link
        href={`/pilotage/etudiants/${e.id}`}
        className={cn(
          "flex flex-col gap-2 px-4 py-3.5 text-encre no-underline transition-colors hover:bg-creme hover:text-encre focus-visible:bg-creme lg:grid lg:items-center lg:gap-4",
          COLONNES_CRM,
          !e.actif && "opacity-70",
        )}
      >
        {/* Qui */}
        <span className="flex min-w-0 items-center gap-3">
          <Avatar prenom={e.prenom} nom={e.nom} photo={e.photoUrl} taille={40} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-base font-bold leading-snug">
                {e.prenom} {e.nom}
              </span>
              {e.statut !== "inscrit" && <Badge ton={TONS_STATUT[e.statut]}>{LIBELLES_STATUTS_SCOLARITE[e.statut]}</Badge>}
              {!e.actif && <Badge ton="gris">Compte désactivé</Badge>}
            </span>
            <span className="mt-0.5 block truncate text-sm text-texte-pale">
              {e.matricule && <span className="font-mono text-[13px] text-texte-doux">{e.matricule}</span>}
              {e.matricule && " · "}
              {classeEtCampus(e)}
            </span>
          </span>
        </span>

        {/* Le reste : une rangée compacte sur téléphone, des colonnes sur ordinateur. */}
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:pl-[52px] lg:contents">
          {/* Pièces */}
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="text-texte-pale lg:hidden">Pièces</span>
            <span className={cn("font-mono font-semibold tabular-nums", complet ? "text-succes" : "text-encre")}>
              {e.pieces.recues}/{e.pieces.requises}
            </span>
            <Segments pleins={e.pieces.recues} total={e.pieces.requises} />
            {e.pieces.aVerifier > 0 && <Badge ton="alerte">{e.pieces.aVerifier} à vérifier</Badge>}
          </span>

          {/* Paiement */}
          <span className="flex flex-col">
            {!argent ? (
              <span className="hidden text-texte-gris lg:inline" aria-hidden="true">
                –
              </span>
            ) : !f ? (
              <span className="text-texte-gris">Pas d'échéancier</span>
            ) : f.reste <= 0 ? (
              <span className="font-semibold text-succes">Soldé</span>
            ) : (
              <>
                <span className={cn("whitespace-nowrap", f.retard > 0 ? "font-bold text-danger" : "font-semibold")}>Reste {fcfa(f.reste)}</span>
                {f.retard > 0 && <span className="whitespace-nowrap text-xs font-semibold text-danger">dont {fcfa(f.retard)} en retard</span>}
              </>
            )}
          </span>

          {/* Relances */}
          {e.tachesOuvertes > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-semibold" title={e.tacheEnRetard ? "Une relance a dépassé sa date" : undefined}>
              {e.tacheEnRetard && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-danger" aria-hidden="true" />}
              {pluriel(e.tachesOuvertes, "relance")}
              {e.tacheEnRetard && <span className="sr-only">, dont au moins une en retard</span>}
            </span>
          ) : (
            <span className="hidden text-texte-gris lg:inline" aria-label="Aucune relance">
              –
            </span>
          )}

          {/* Compte */}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:flex-col lg:items-start">
            {e.actif && !e.compteActive && <Badge ton="alerte">Code pas encore utilisé</Badge>}
            <span className="text-xs text-texte-gris">Connexion&nbsp;: {vuLe(e.derniereConnexion)}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Petite jauge des pièces requises (une case par pièce). */
function Segments({ pleins, total }: { pleins: number; total: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-2 w-2.5 rounded-sm", i < pleins ? (pleins >= total ? "bg-succes" : "bg-orange") : "bg-ligne")} />
      ))}
    </span>
  );
}
