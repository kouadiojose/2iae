// /replays — Enregistrements : les replays vidéo de tous les cours, pour les
// formateurs (les leurs et ceux des collègues) et l'équipe. Une alerte arrive
// dès qu'un nouveau est prêt ; « Nouveau » s'efface quand on l'ouvre.
import { useMemo, useState } from "react";
import { Clapperboard, Search } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { LigneReplay, useReplays } from "./replays";
import { sansAccents } from "./outils";

type Filtre = "tous" | "nouveaux" | "miens" | "autres";

const moisDe = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

export default function PageEnregistrements() {
  const moi = useMoiConnecte();
  const { data, error, isLoading, refetch } = useReplays();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [recherche, setRecherche] = useState("");
  const formateur = moi.role === "formateur";

  const liste = useMemo(() => {
    const mots = sansAccents(recherche.trim()).split(/\s+/).filter(Boolean);
    return (data?.replays ?? []).filter((r) => {
      if (filtre === "nouveaux" && !r.nouveau) return false;
      if (filtre === "miens" && !r.mien) return false;
      if (filtre === "autres" && r.mien) return false;
      if (!mots.length) return true;
      const texte = sansAccents(`${r.titre} ${r.coursCode} ${r.coursTitre} ${r.formateur ?? ""}`);
      return mots.every((m) => texte.includes(m));
    });
  }, [data, filtre, recherche]);

  // Regroupés par mois (le plus récent d'abord, comme la liste).
  const parMois = useMemo(() => {
    const groupes: { mois: string; replays: typeof liste }[] = [];
    for (const r of liste) {
      const mois = moisDe.format(new Date(r.debut));
      const dernier = groupes[groupes.length - 1];
      if (dernier?.mois === mois) dernier.replays.push(r);
      else groupes.push({ mois, replays: [r] });
    }
    return groupes;
  }, [liste]);

  if (isLoading) return <Page><Chargement lignes={4} /></Page>;
  if (error || !data) return <Page><Erreur message={(error as Error)?.message ?? "Enregistrements indisponibles."} reessayer={() => void refetch()} /></Page>;

  const miens = data.replays.filter((r) => r.mien).length;
  const options: { valeur: Filtre; libelle: string; compteur?: number }[] = [
    { valeur: "tous", libelle: "Tous", compteur: data.replays.length },
    ...(data.nouveaux ? [{ valeur: "nouveaux" as const, libelle: "Nouveaux", compteur: data.nouveaux }] : []),
    ...(formateur ? [{ valeur: "miens" as const, libelle: "Mes cours", compteur: miens }, { valeur: "autres" as const, libelle: "Autres cours", compteur: data.replays.length - miens }] : []),
  ];

  return (
    <Page className="max-w-4xl gap-6">
      <EnTetePage
        etiquette="Enregistrements"
        titre="Vidéos des cours"
        sousTitre={
          formateur
            ? "Les vidéos de tous les cours : les vôtres et celles de vos collègues. Vous êtes prévenu dès qu'un nouvel enregistrement est prêt."
            : "Les vidéos de tous les cours, dès que l'enregistrement est prêt."
        }
      />

      {data.replays.length > 0 && (
        <div className="flex flex-col gap-3">
          <label className="relative">
            <span className="sr-only">Rechercher un enregistrement</span>
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" aria-hidden />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Cours, séance ou formateur"
              className="min-h-12 w-full rounded-2xl border border-ligne bg-white pl-12 pr-4 text-base outline-none focus:border-orange"
            />
          </label>
          <Onglets valeur={filtre} onChange={setFiltre} options={options} className="self-start" />
        </div>
      )}

      {!data.replays.length ? (
        <EtatVide
          icone={<Clapperboard className="h-6 w-6" />}
          titre="Aucun enregistrement pour l'instant"
          texte="Chaque live enregistré arrive ici quand la vidéo est prête, en général moins d'une heure après la fin du cours. Vous recevrez une alerte."
        />
      ) : !liste.length ? (
        <p className="rounded-2xl bg-creme p-4 text-[15px] text-texte-pale">Aucun enregistrement ne correspond. Essayez un autre mot ou un autre filtre.</p>
      ) : (
        parMois.map((g) => (
          <section key={g.mois} className="flex flex-col gap-2.5" aria-label={g.mois}>
            <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">{g.mois}</h2>
            <ul className="flex flex-col gap-2.5">
              {g.replays.map((r) => (
                <li key={r.seanceId}>
                  <LigneReplay replay={r} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Page>
  );
}
