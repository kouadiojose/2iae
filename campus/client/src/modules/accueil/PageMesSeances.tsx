// /mes-seances — « Mes séances » du formateur : toutes les séances qu'il a données, la plus récente d'abord,
// en grandes cartes (CarteSeance : vidéo, cours résumé, QCM, exercice, présents), avec « Voir plus ».
// Un choix de cours seulement quand il en enseigne plusieurs. Le serveur limite le fil à ses cours.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Selection } from "@/components/ui/champs";
import { FilDesSeances } from "@/components/seances/FilDesSeances";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/travail";
import type { CoursResume } from "@shared/schema";

export default function PageMesSeances() {
  const tx = useTextes(t);
  const [cours, setCours] = useState("");
  const { data: mesCours } = useQuery<CoursResume[]>({ queryKey: ["/api/cours"], staleTime: 5 * 60_000 });
  const enseignes = (mesCours ?? []).filter((c) => c.enseignant);
  return (
    <Page>
      <EnTetePage titre={tx("seances.titre")} sousTitre={tx("seances.sousTitre")} />
      {enseignes.length > 1 && (
        <Selection libelle={tx("seances.cours")} value={cours} onChange={(e) => setCours(e.target.value)} className="sm:max-w-sm [&_select]:min-h-[52px] [&_select]:text-[16px]">
          <option value="">{tx("seances.tousCours")}</option>
          {enseignes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.titre}
            </option>
          ))}
        </Selection>
      )}
      <FilDesSeances filtres={{ cours }} />
    </Page>
  );
}
