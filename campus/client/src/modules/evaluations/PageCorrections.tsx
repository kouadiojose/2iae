// /corrections (formateur, équipe) : les devoirs avec des copies à corriger
// d'abord, puis ceux en cours et les terminés. Accès aux carnets de notes.
import { useQuery } from "@tanstack/react-query";
import { Plus, CheckSquare, BookOpenCheck } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { CarteLien, TitreSection } from "@/components/ui/carte";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { useMoiConnecte } from "@/lib/auth";
import { useCanal } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { pluriel } from "@/lib/utils";
import type { ListeDevoirs, DevoirEnseignantResume } from "@shared/schema";
import { LigneDevoirEnseignant } from "./composants/LigneDevoirEnseignant";

type CoursEnseigne = { id: number; code: string; titre: string; couleur: string };

export default function PageCorrections() {
  const moi = useMoiConnecte();
  const maintenant = useMaintenant(60_000);
  const { data, isLoading, error, refetch } = useQuery<ListeDevoirs>({ queryKey: ["/api/devoirs"] });
  const { data: mesCours } = useQuery<CoursEnseigne[]>({ queryKey: ["/api/evaluations/cours"] });
  // Une copie arrive : la liste se met à jour toute seule.
  useCanal(`u:${moi.id}`, (e) => {
    if (e.type === "copie-recue") void rafraichir("/api/devoirs");
  });

  const devoirs: DevoirEnseignantResume[] = data?.vue === "enseignant" ? data.devoirs : [];
  const aCorriger = devoirs
    .filter((d) => d.type === "depot" && (d.compteurs.aCorriger > 0 || d.compteurs.corrigees > 0))
    .sort((a, b) => a.dateLimite.localeCompare(b.dateLimite));
  const ids = new Set(aCorriger.map((d) => d.id));
  const enCours = devoirs.filter((d) => !ids.has(d.id) && new Date(d.dateLimite).getTime() >= maintenant).sort((a, b) => a.dateLimite.localeCompare(b.dateLimite));
  const termines = devoirs.filter((d) => !ids.has(d.id) && new Date(d.dateLimite).getTime() < maintenant);
  const totalACorriger = aCorriger.reduce((s, d) => s + d.compteurs.aCorriger, 0);

  return (
    <Page className="max-w-5xl">
      <EnTetePage
        etiquette="Devoirs et interrogations"
        titre="Corrections"
        sousTitre={data ? (totalACorriger ? `${pluriel(totalACorriger, "copie")} vous attend${totalACorriger > 1 ? "ent" : ""}.` : "Aucune copie en attente de correction.") : undefined}
        actions={
          <LienBouton href="/enseigner/devoirs/nouveau" icone={<Plus className="h-5 w-5" />} className="min-h-[48px]">
            Nouveau devoir
          </LienBouton>
        }
      />

      {isLoading ? (
        <Chargement lignes={3} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
      ) : !devoirs.length ? (
        <EtatVide
          icone={<CheckSquare className="h-6 w-6" />}
          titre="Aucun devoir pour l'instant."
          texte="Créez un devoir à rendre (photo du cahier, fichier ou texte) ou une interrogation corrigée automatiquement. Les étudiants sont prévenus dès qu'il ouvre, et reçoivent un rappel la veille."
          action={
            <LienBouton href="/enseigner/devoirs/nouveau" icone={<Plus className="h-4 w-4" />} className="min-h-[48px]">
              Créer un devoir
            </LienBouton>
          }
        />
      ) : (
        <>
          {aCorriger.length > 0 && (
            <section>
              <TitreSection titre="Copies à corriger" />
              <div className="flex flex-col gap-3">
                {aCorriger.map((d) => (
                  <LigneDevoirEnseignant key={d.id} d={d} maintenant={maintenant} />
                ))}
              </div>
            </section>
          )}
          {enCours.length > 0 && (
            <section>
              <TitreSection titre="En cours" />
              <div className="flex flex-col gap-3">
                {enCours.map((d) => (
                  <LigneDevoirEnseignant key={d.id} d={d} maintenant={maintenant} />
                ))}
              </div>
            </section>
          )}
          {termines.length > 0 && (
            <section>
              <TitreSection titre="Terminés" />
              <div className="flex flex-col gap-3">
                {termines.map((d) => (
                  <LigneDevoirEnseignant key={d.id} d={d} maintenant={maintenant} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {mesCours && mesCours.length > 0 && (
        <section>
          <TitreSection titre="Carnets de notes" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mesCours.map((c) => (
              <CarteLien key={c.id} href={`/enseigner/notes/${c.id}`} className="flex min-h-[72px] items-center gap-3 p-4">
                <BookOpenCheck className="h-6 w-6 shrink-0" style={{ color: c.couleur }} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-mono text-[11px] font-semibold text-orange-fonce">{c.code}</span>
                  <span className="truncate text-[15px] font-bold">{c.titre}</span>
                </span>
              </CarteLien>
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
