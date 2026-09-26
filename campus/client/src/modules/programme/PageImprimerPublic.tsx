// /programme/:id/imprimer : le fac-similé imprimable d'un emploi du temps publié
// (lien « Imprimer » du site public et de l'espace étudiant et formateur).
import { useQuery } from "@tanstack/react-query";
import type { SessionDetailDto } from "@shared/schema";
import { PageImpression } from "./ImpressionProgramme";

/** Adresse de retour passée en paramètre (?retour=/emploi-du-temps), limitée au campus. */
function retourDemande(defaut: string): string {
  const r = new URLSearchParams(window.location.search).get("retour");
  return r && r.startsWith("/") && !r.startsWith("//") ? r : defaut;
}

export default function PageImprimerPublic({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery<SessionDetailDto>({ queryKey: [`/api/public/programme/${id}`] });
  const retour = retourDemande(`/programme/${id}`);
  return (
    <PageImpression
      session={data?.session}
      chargement={isLoading}
      erreur={error as Error | null}
      retour={retour}
      libelleRetour={retour === "/emploi-du-temps" ? "Mon emploi du temps" : "Retour au programme"}
    />
  );
}
