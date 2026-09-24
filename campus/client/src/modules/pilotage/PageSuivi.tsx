// /pilotage/suivi : « Qui décroche ? » en détail. Chaque étudiant avec ses
// raisons, ce qu'il faut faire, et les gestes : WhatsApp, dossier, suivi.
import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PartyPopper } from "lucide-react";
import type { ListeAContacter, TypeRaisonContact } from "@shared/schema";
import { LIBELLES_RAISONS } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { Selection } from "@/components/ui/champs";
import { SousNav } from "./composants/SousNav";
import { LigneAContacter } from "./composants/LigneAContacter";
import { FenetreSuivi } from "./composants/FenetreSuivi";
import { useReferences } from "./outils";

type Filtre = "tous" | TypeRaisonContact;

export default function PageSuivi() {
  const recherche = new URLSearchParams(useSearch());
  const { data, isLoading, error, refetch } = useQuery<ListeAContacter>({ queryKey: ["/api/pilotage/a-contacter"] });
  const refs = useReferences();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [site, setSite] = useState(recherche.get("site") ?? "");
  const [suivi, setSuivi] = useState<{ id: number; prenom: string; nom: string } | null>(null);

  const lignes = useMemo(
    () =>
      (data?.lignes ?? []).filter(
        (l) => (filtre === "tous" || l.raisons.some((r) => r.type === filtre)) && (!site || String(l.etudiant.siteId) === site),
      ),
    [data, filtre, site],
  );

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Suivi des étudiants"
        titre="À contacter"
        sousTitre="Jamais activé après 7 jours, plus vu depuis 7 jours, deux lives manqués d'affilée, devoir échu non rendu. Un message ou un appel suffit souvent."
      />

      {data && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Onglets<Filtre>
            valeur={filtre}
            onChange={setFiltre}
            options={[
              { valeur: "tous", libelle: "Tous", compteur: data.total },
              ...(Object.keys(LIBELLES_RAISONS) as TypeRaisonContact[]).map((t) => ({ valeur: t, libelle: LIBELLES_RAISONS[t], compteur: data.parRaison[t] })),
            ]}
          />
          {refs.data?.toutLeGroupe && (
            <Selection aria-label="Campus" value={site} onChange={(e) => setSite(e.target.value)} className="sm:w-56">
              <option value="">Tous les campus</option>
              {refs.data.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nomCourt}
                </option>
              ))}
            </Selection>
          )}
        </div>
      )}

      {isLoading ? (
        <Chargement lignes={4} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !lignes.length ? (
        <EtatVide
          icone={<PartyPopper className="h-6 w-6" />}
          titre={data?.total ? "Personne dans ce filtre." : "Personne à relancer pour l'instant."}
          texte="La liste se met à jour toute seule : un étudiant y apparaît dès qu'une des quatre règles le concerne, et en sort dès qu'il revient."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" aria-live="polite">
          {lignes.map((l) => (
            <LigneAContacter key={l.etudiant.id} ligne={l} onSuivi={setSuivi} />
          ))}
        </ul>
      )}

      <FenetreSuivi etudiant={suivi} onFermer={() => setSuivi(null)} />
    </Page>
  );
}
