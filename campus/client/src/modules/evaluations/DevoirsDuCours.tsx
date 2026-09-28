// Devoirs et interrogations d'un cours, intégrés à la page du cours (onglet
// « Devoirs »). Étudiant : ses devoirs avec leur statut. Formateur / équipe :
// les compteurs de copies, « Nouveau devoir » et le carnet de notes.
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus, BookOpenCheck } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import type { ListeDevoirs, DevoirEtudiantResume } from "@shared/schema";
import { CarteDevoir } from "./composants/CarteDevoir";
import { LigneDevoirEnseignant } from "./composants/LigneDevoirEnseignant";

/** Ordre de l'étudiant : ce qui reste à faire d'abord (par échéance), puis le reste (le plus récent d'abord). */
function trierEtudiant(liste: DevoirEtudiantResume[]) {
  const aFaire = (d: DevoirEtudiantResume) => ["a_rendre", "en_retard", "en_cours"].includes(d.statut);
  return [...liste].sort((a, b) => {
    if (aFaire(a) !== aFaire(b)) return aFaire(a) ? -1 : 1;
    return aFaire(a) ? a.dateLimite.localeCompare(b.dateLimite) : b.dateLimite.localeCompare(a.dateLimite);
  });
}

export function DevoirsDuCours({ coursId, enseignant }: { coursId: number; enseignant: boolean }) {
  const maintenant = useMaintenant(60_000);
  const { data, isLoading, error, refetch } = useQuery<ListeDevoirs>({ queryKey: [`/api/devoirs?cours=${coursId}`] });

  if (isLoading) return <Chargement lignes={2} />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Devoirs indisponibles."} reessayer={() => void refetch()} />;

  if (data.vue === "enseignant" || enseignant) {
    const liste = data.vue === "enseignant" ? data.devoirs : [];
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <LienBouton href={`/enseigner/devoirs/nouveau?cours=${coursId}`} icone={<Plus className="h-4 w-4" />} className="min-h-[48px]">
            Nouveau devoir
          </LienBouton>
          <LienBouton href={`/enseigner/notes/${coursId}`} variante="contour" icone={<BookOpenCheck className="h-4 w-4" />} className="min-h-[48px]">
            Carnet de notes
          </LienBouton>
        </div>
        {liste.length ? (
          <div className="flex flex-col gap-3">
            {liste.map((d) => (
              <LigneDevoirEnseignant key={d.id} d={d} maintenant={maintenant} />
            ))}
          </div>
        ) : (
          <EtatVide
            icone={<ClipboardList className="h-6 w-6" />}
            titre="Aucun devoir dans ce cours."
            texte="Donnez un devoir à rendre (photo du cahier, fichier ou texte) ou une interrogation corrigée automatiquement. Les étudiants sont prévenus et reçoivent un rappel la veille."
          />
        )}
      </div>
    );
  }

  const liste = trierEtudiant(data.devoirs);
  return liste.length ? (
    <div className="flex flex-col gap-3">
      {liste.map((d) => (
        <CarteDevoir key={d.id} d={d} maintenant={maintenant} />
      ))}
      <LienBouton href="/devoirs" variante="fantome" className="min-h-[48px] self-start">
        Tous mes devoirs
      </LienBouton>
    </div>
  ) : (
    <EtatVide
      icone={<ClipboardList className="h-6 w-6" />}
      titre="Pas encore de devoir dans ce cours."
      texte="Quand ton formateur donne un devoir ou une interrogation, il apparaît ici avec sa date limite, et tu reçois un rappel la veille."
    />
  );
}
