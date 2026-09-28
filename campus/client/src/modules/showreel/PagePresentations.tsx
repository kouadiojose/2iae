// /pilotage/formateurs : les présentations de 30 secondes de tous les
// formateurs (direction) : où en est chacune, et l'accès à son éditeur.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, ExternalLink, Film } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Avatar, Badge, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import type { ShowreelResumeDto } from "@shared/schema";
import { heureH } from "./outils";
import { dateJour } from "./editeur/communs";

function Etat({ l }: { l: ShowreelResumeDto }) {
  if (l.enLigne && !l.modificationsNonPubliees) return <Badge ton="succes">● En ligne</Badge>;
  if (l.enLigne) return <Badge ton="alerte">En ligne · modifiée</Badge>;
  if (l.statut === "a_valider") return <Badge ton="alerte">{l.valideLe ? "Validée · à publier" : "À valider"}</Badge>;
  if (l.statut === "brouillon") return <Badge ton="gris">Brouillon</Badge>;
  return <Badge ton="gris">Pas commencée</Badge>;
}

const COMPOSITION: Record<string, string> = { ia: "composée par l'IA", secours: "composée sans IA", depart: "faits sûrs seulement", import: "préparée par la direction" };

export default function PagePresentations() {
  const q = useQuery<ShowreelResumeDto[]>({ queryKey: ["/api/pilotage/showreels"] });
  const liste = q.data ?? [];
  const aPublier = liste.filter((l) => l.statut === "a_valider" && l.valideLe).length;
  return (
    <Page>
      <EnTetePage
        etiquette="Formateurs"
        titre="Présentations de 30 secondes"
        sousTitre="Chaque formateur a sa présentation animée : sur sa page du site du campus, et à partager sur WhatsApp. Le formateur colle ses liens, l'assistant compose, il valide ; vous publiez."
      />
      {aPublier > 0 && <p className="rounded-2xl bg-alerte-clair px-4 py-3 text-[15px] font-semibold text-alerte">{aPublier > 1 ? `${aPublier} présentations validées attendent` : "Une présentation validée attend"} votre publication.</p>}
      {q.isLoading ? (
        <Chargement lignes={3} />
      ) : q.error ? (
        <Erreur message="La liste n'a pas pu être chargée." reessayer={() => void q.refetch()} />
      ) : !liste.length ? (
        <EtatVide icone={<Film className="h-5 w-5" />} titre="Aucun formateur pour l'instant" texte="Créez d'abord les comptes des formateurs dans Comptes : leur présentation se prépare ensuite ici." />
      ) : (
        <ul className="flex flex-col gap-3">
          {liste.map((l) => (
            <li key={l.formateurId}>
              <Link
                href={`/pilotage/formateurs/${l.formateurId}/presentation`}
                className={cn("flex items-center gap-4 rounded-2xl border border-ligne bg-white p-4 text-encre no-underline transition-colors hover:border-orange hover:text-encre", !l.actif && "opacity-60")}
              >
                <Avatar prenom={l.prenom} nom={l.nom} photo={l.photoUrl} taille={52} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[17px] font-extrabold">{l.nomAffiche}</span>
                    <Etat l={l} />
                    {!l.actif && <Badge ton="gris">Compte désactivé</Badge>}
                  </div>
                  <p className="truncate text-[14px] text-texte-pale">
                    {[l.cours ? `${l.cours}${l.jourLibelle ? ` · ${l.jourLibelle} ${heureH(l.heureDebut)}` : ""}` : "Pas encore de créneau à l'emploi du temps", l.titre].filter(Boolean).join(" · ")}
                  </p>
                  <p className="font-mono text-xs text-texte-gris">
                    {l.statut === "aucun"
                      ? "Pas encore ouverte"
                      : [`${l.nbPlans} plans`, l.composition ? COMPOSITION[l.composition] : null, l.nbSources ? `${l.nbSources} source${l.nbSources > 1 ? "s" : ""}` : "aucune source", l.publieLe ? `publiée le ${dateJour(l.publieLe)}` : l.majLe ? `modifiée le ${dateJour(l.majLe)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </div>
                {l.urlPublique && <ExternalLink className="hidden h-4 w-4 text-succes sm:block" aria-label="En ligne" />}
                <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
