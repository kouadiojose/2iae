// /pilotage/formateurs/:id/presentation : la direction prépare, relit et
// publie la présentation de 30 secondes d'un formateur.
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Page, EnTetePage } from "@/components/layout/coquille";
import type { ShowreelEditionDto } from "@shared/schema";
import { EditeurPresentation } from "./EditeurPresentation";

export default function PagePresentationFormateur({ id }: { id: string }) {
  const n = Number(id);
  const q = useQuery<ShowreelEditionDto>({ queryKey: ["/api/showreels", String(n)], enabled: Number.isInteger(n) && n > 0 });
  const nom = q.data?.formateur.nomAffiche;
  return (
    <Page large>
      <EnTetePage
        etiquette="Formateurs · présentation de 30 secondes"
        titre={nom ? `Présentation de ${nom}` : "Présentation du formateur"}
        sousTitre={
          q.data
            ? [q.data.formateur.titre, q.data.formateur.campus.cours ? `${q.data.formateur.campus.cours.titre}${q.data.formateur.campus.jourLibelle ? `, le ${q.data.formateur.campus.jourLibelle.toLowerCase()}` : ""}` : null].filter(Boolean).join(" · ") || undefined
            : undefined
        }
        actions={
          <LienBouton href="/pilotage/formateurs" variante="fantome" icone={<ArrowLeft className="h-4 w-4" />}>
            Tous les formateurs
          </LienBouton>
        }
      />
      <EditeurPresentation cible={n} />
    </Page>
  );
}
