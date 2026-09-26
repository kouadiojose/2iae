// /pilotage/programme/:id/imprimer : fac-similé d'une session, même en
// brouillon (marqué « Projet · non publié ») pour la faire valider.
import { useQuery } from "@tanstack/react-query";
import type { SessionEditionDto } from "@shared/schema";
import { PageImpression } from "./ImpressionProgramme";

export default function PageImprimerPilotage({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery<SessionEditionDto>({ queryKey: ["/api/pilotage/programme/sessions", id] });
  return (
    <PageImpression
      session={data}
      chargement={isLoading}
      erreur={error as Error | null}
      retour={`/pilotage/programme/${id}`}
      libelleRetour="Retour à l'éditeur"
      projet={data ? data.statut !== "publiee" : false}
    />
  );
}
