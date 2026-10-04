// /bibliotheque/recherches/:id — les livres proposés pour un sujet, vérifiés
// d'abord, avec le conseil de l'IA pour aborder le sujet.
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { dateCourte } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { CarteLivrePropose } from "./composants";
import type { RechercheBiblioDto } from "@shared/schema/ext-bibliotheque";

export default function PageRecherche({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const { data, error, isLoading, refetch } = useQuery<RechercheBiblioDto>({ queryKey: [`/api/bibliotheque/recherches/${id}`] });
  if (isLoading) return <Page><Chargement lignes={4} /></Page>;
  if (error || !data) return <Page><Erreur message={(error as Error)?.message ?? "Recherche introuvable."} reessayer={() => void refetch()} /></Page>;
  const verifies = data.livres.filter((l) => l.verifie).length;
  return (
    <Page className="max-w-3xl gap-6">
      <LienBouton href="/bibliotheque" variante="fantome" taille="sm" icone={<ArrowLeft className="h-4 w-4" />} className="-mb-3 -ml-2 self-start">
        Bibliothèque
      </LienBouton>
      <EnTetePage
        etiquette={`Recherche · ${dateCourte(data.creeLe)}`}
        titre={data.sujet}
        sousTitre={`${data.livres.length} livre${data.livres.length > 1 ? "s" : ""} proposé${data.livres.length > 1 ? "s" : ""}, dont ${verifies} vérifié${verifies > 1 ? "s" : ""} dans les catalogues des bibliothèques.`}
      />
      {data.conseil && (
        <div className="flex items-start gap-3 rounded-2xl bg-orange-clair p-4 text-[15px] leading-relaxed text-encre">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
          <p>{data.conseil}</p>
        </div>
      )}
      {data.livres.length ? (
        <ul className="flex flex-col gap-3">
          {data.livres.map((l) => (
            <li key={l.id}>
              <CarteLivrePropose livre={l} />
            </li>
          ))}
        </ul>
      ) : (
        <EtatVide
          titre="Aucun livre retenu"
          texte={etudiant ? "Aucun livre n'a pu être vérifié pour ce sujet. Reformule-le plus simplement (par exemple « béton armé » plutôt qu'une phrase longue)." : "Aucun livre n'a pu être vérifié pour ce sujet. Reformulez-le plus simplement."}
          action={<LienBouton href="/bibliotheque">Nouvelle recherche</LienBouton>}
        />
      )}
      <p className="text-sm text-texte-gris">
        « Vérifié » : le livre existe bien dans le catalogue de la Bibliothèque nationale de France ou d'Open Library (titre, auteur, éditeur, année). « À vérifier » : l'IA en est sûre, mais aucun catalogue public ne l'a retrouvé.
      </p>
    </Page>
  );
}
