// /enseigner/mon-cours/:coursId/mur — « Le mur du cours » du professeur : écrire aux étudiants (un lien, un fichier, une
// consigne) et relire le fil. « Retour au cours », bande du cours, puis MurDuCours (variante professeur).
import { useQuery } from "@tanstack/react-query";
import { Page } from "@/components/layout/coquille";
import { BandeauCours, RetourGros } from "@/components/ui/gros-blocs";
import { useTextes } from "@/lib/textes";
import { t as tMur } from "@shared/textes/mur";
import type { MurDto } from "@shared/mur";
import { MurDuCours, urlMur } from "./MurDuCours";

export default function PageMurProfesseur({ coursId }: { coursId: string }) {
  const tx = useTextes(tMur);
  const id = Number(coursId);
  const { data } = useQuery<MurDto>({ queryKey: [urlMur(id, "professeur")], staleTime: 10_000 });
  return (
    <Page className="gap-6 sm:gap-8">
      <RetourGros href={`/enseigner/mon-cours/${id}`}>Retour au cours</RetourGros>
      <BandeauCours couleur={data?.cours.couleur ?? "#E4793A"} etiquette={data?.cours.titre ?? ""} titre={tx("titre")} />
      <MurDuCours coursId={id} variante="professeur" />
    </Page>
  );
}
