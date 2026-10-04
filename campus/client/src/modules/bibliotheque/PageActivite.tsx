// /bibliotheque/activite — pour les formateurs et l'équipe : les sujets
// cherchés par les étudiants, les livres trouvés et les exposés préparés.
// La direction voit tout, la vie scolaire son campus, le formateur les
// étudiants de ses cours.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, Presentation, Library } from "lucide-react";
import { dateCourte, heure } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { CarteLien } from "@/components/ui/carte";
import { Chargement, Erreur, EtatVide, Badge, Chiffre } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import type { ActiviteBiblioDto } from "@shared/schema/ext-bibliotheque";

type Filtre = "tout" | "recherche" | "expose";

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function PageActivite() {
  const { data, error, isLoading, refetch } = useQuery<ActiviteBiblioDto>({ queryKey: ["/api/bibliotheque/activite"], refetchInterval: 60_000 });
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [texte, setTexte] = useState("");
  const lignes = useMemo(() => {
    const mots = sansAccents(texte.trim()).split(/\s+/).filter(Boolean);
    return (data?.lignes ?? []).filter((l) => {
      if (filtre !== "tout" && l.type !== filtre) return false;
      const t = sansAccents(`${l.etudiant.prenom} ${l.etudiant.nom} ${l.etudiant.classe ?? ""} ${l.etudiant.site ?? ""} ${l.sujet} ${l.livres.join(" ")}`);
      return mots.every((m) => t.includes(m));
    });
  }, [data, filtre, texte]);

  if (isLoading) return <Page><Chargement lignes={4} /></Page>;
  if (error || !data) return <Page><Erreur message={(error as Error)?.message ?? "Suivi indisponible."} reessayer={() => void refetch()} /></Page>;
  const recherches = data.lignes.filter((l) => l.type === "recherche");
  const exposes = data.lignes.filter((l) => l.type === "expose");
  const etudiants = new Set(data.lignes.map((l) => l.etudiant.id)).size;

  return (
    <Page className="max-w-4xl gap-6">
      <LienBouton href="/bibliotheque" variante="fantome" taille="sm" icone={<ArrowLeft className="h-4 w-4" />} className="-mb-3 -ml-2 self-start">
        Bibliothèque
      </LienBouton>
      <EnTetePage etiquette="Bibliothèque · Suivi" titre="Ce que cherchent les étudiants" sousTitre="Sujets, livres proposés et exposés préparés. Rafraîchi chaque minute pendant l'exercice." />
      <section className="grid grid-cols-3 gap-3" aria-label="Chiffres clés">
        <Chiffre libelle="Étudiants" valeur={etudiants} />
        <Chiffre libelle="Recherches" valeur={recherches.length} ton="orange" />
        <Chiffre libelle="Exposés" valeur={exposes.length} />
      </section>
      <div className="flex flex-col gap-3">
        <label className="relative">
          <span className="sr-only">Filtrer</span>
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" aria-hidden />
          <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Étudiant, classe, campus, sujet ou livre" className="min-h-12 w-full rounded-2xl border border-ligne bg-white pl-12 pr-4 text-base outline-none focus:border-orange" />
        </label>
        <Onglets<Filtre>
          valeur={filtre}
          onChange={setFiltre}
          options={[
            { valeur: "tout", libelle: "Tout", compteur: data.lignes.length },
            { valeur: "recherche", libelle: "Recherches", compteur: recherches.length },
            { valeur: "expose", libelle: "Exposés", compteur: exposes.length },
          ]}
          className="self-start"
        />
      </div>
      {!data.lignes.length ? (
        <EtatVide icone={<Library className="h-6 w-6" />} titre="Aucune activité pour l'instant" texte="Les recherches et les exposés des étudiants apparaîtront ici dès qu'ils utiliseront la bibliothèque." />
      ) : !lignes.length ? (
        <p className="rounded-2xl bg-creme p-4 text-[15px] text-texte-pale">Rien ne correspond à ce filtre.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {lignes.map((l) => (
            <li key={`${l.type}-${l.id}`}>
              <CarteLien href={l.type === "recherche" ? `/bibliotheque/recherches/${l.id}` : `/bibliotheque/exposes/${l.id}`} className="flex gap-3 px-4 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-creme text-orange-fonce">
                  {l.type === "recherche" ? <Search className="h-5 w-5" aria-hidden /> : <Presentation className="h-5 w-5" aria-hidden />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">
                      {l.etudiant.prenom} {l.etudiant.nom}
                    </span>
                    <Badge ton={l.type === "recherche" ? "gris" : "orange"}>{l.type === "recherche" ? "Recherche" : "Exposé"}</Badge>
                  </span>
                  <span className="text-[15px]">{l.sujet}</span>
                  {l.livres.length > 0 && <span className="line-clamp-2 text-sm text-texte-pale">{l.livres.join(" · ")}</span>}
                  <span className="font-mono text-xs text-texte-gris">
                    {[l.etudiant.classe, l.etudiant.site].filter(Boolean).join(" · ")}
                    {l.etudiant.classe || l.etudiant.site ? " · " : ""}
                    {dateCourte(l.le)} à {heure(l.le)}
                  </span>
                </span>
              </CarteLien>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
