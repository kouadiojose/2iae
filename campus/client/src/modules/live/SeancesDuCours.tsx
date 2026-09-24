// Séances live d'un cours (en direct, à venir, replays), intégrées à la page
// du cours (module cours). Le formateur y prépare ses séances.
import { useQuery } from "@tanstack/react-query";
import { Plus, Radio } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { TitreSection } from "@/components/ui/carte";
import { DecompteCourt } from "@/components/ui/compte-a-rebours";
import { LigneSeance, LienAgenda } from "./ui";
import type { SeanceResume } from "@shared/api";

export function SeancesDuCours({ coursId, enseignant }: { coursId: number; enseignant: boolean }) {
  const { data, error, isLoading, refetch } = useQuery<SeanceResume[]>({ queryKey: [`/api/seances?cours=${coursId}`] });
  if (isLoading) return <Chargement lignes={2} />;
  if (error) return <Erreur message={(error as Error).message} reessayer={() => void refetch()} />;
  const liste = data ?? [];
  const direct = liste.find((s) => s.statut === "en_direct");
  const avenir = liste.filter((s) => s.statut === "planifiee" || (s.statut === "annulee" && new Date(s.debut).getTime() > Date.now()));
  const passees = liste.filter((s) => s.statut === "terminee").reverse();
  const prochaine = avenir.find((s) => s.statut === "planifiee");

  return (
    <div className="flex flex-col gap-6">
      {enseignant && (
        <div className="flex justify-end">
          <LienBouton href={`/enseigner/seances/nouvelle?cours=${coursId}`} icone={<Plus className="h-4 w-4" />}>
            Nouvelle séance
          </LienBouton>
        </div>
      )}
      {direct && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-encre p-5 text-white">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#FF8A6B]">
              <span className="point-direct" /> En direct
            </span>
            <span className="text-xl font-extrabold">{direct.titre}</span>
          </div>
          <LienBouton href={`/live/${direct.id}`}>{enseignant ? "Ouvrir le studio" : "Rejoindre le live"}</LienBouton>
        </div>
      )}
      {!direct && prochaine && !enseignant && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-orange p-5 text-encre">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-wider">Prochain live dans <DecompteCourt cible={prochaine.debut} /></span>
            <span className="text-xl font-extrabold">{prochaine.titre}</span>
          </div>
          <LienAgenda seanceId={prochaine.id} className="rounded-xl border-[1.5px] border-encre px-4 py-3 text-encre hover:bg-encre hover:text-white" />
        </div>
      )}
      <section>
        <TitreSection titre="À venir" />
        {avenir.length ? (
          avenir.map((s) => <LigneSeance key={s.id} s={s} enseignant={enseignant} />)
        ) : (
          <EtatVide
            icone={<Radio className="h-6 w-6" />}
            titre="Aucun live programmé"
            texte={enseignant ? "Programmez une séance : les cinq campus et les étudiants en ligne seront prévenus." : "Les prochains lives de ce cours apparaîtront ici, avec un rappel la veille et 15 min avant."}
          />
        )}
      </section>
      {passees.length > 0 && (
        <section>
          <TitreSection titre="Replays" />
          {passees.map((s) => (
            <LigneSeance key={s.id} s={s} enseignant={enseignant} lien={enseignant ? `/enseigner/seances/${s.id}` : `/replays/${s.id}`} />
          ))}
        </section>
      )}
    </div>
  );
}
