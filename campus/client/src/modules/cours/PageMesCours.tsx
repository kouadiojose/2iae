// « Mes cours » : l'étudiant retrouve ses cours et sa progression ; le
// formateur ses cours (brouillons compris) et « Nouveau cours » ; l'équipe
// tous les cours du groupe.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Plus, Search, MessageCircleQuestion } from "lucide-react";
import { Page, EnTetePage, lienAide } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { useMoiConnecte } from "@/lib/auth";
import { pluriel } from "@/lib/utils";
import { CarteCoursEtudiant, CarteCoursEnseignant } from "./composants/CarteCours";
import { classeSansSite } from "./outils";
import type { CoursResume } from "@shared/schema";

export default function PageMesCours() {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const equipe = moi.role === "admin" || moi.role === "vie_scolaire";
  const { data, isLoading, error, refetch } = useQuery<CoursResume[]>({ queryKey: ["/api/cours"] });
  const [recherche, setRecherche] = useState("");

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q || !data) return data ?? [];
    return data.filter((c) => `${c.code} ${c.titre} ${c.formateur?.prenom ?? ""} ${c.formateur?.nom ?? ""}`.toLowerCase().includes(q));
  }, [data, recherche]);

  const etiquette = etudiant
    ? [moi.site ? `Campus ${moi.site.nomCourt}` : null, moi.classe ? classeSansSite(moi.classe.nom, moi.site?.nomCourt ?? "") : null].filter(Boolean).join(" · ") ||
      "Mes cours"
    : equipe
      ? "Tous les cours du groupe"
      : "Espace formateur";

  const sousTitre = etudiant
    ? data?.length
      ? "Touche un cours pour reprendre là où tu t'es arrêté."
      : undefined
    : data?.length
      ? `${pluriel(data.length, "cours", "cours")} · ${pluriel(
          data.filter((c) => c.statut === "brouillon").length,
          "brouillon",
        )}`
      : undefined;

  const aide = etudiant ? lienAide(moi) : null;

  return (
    <Page>
      <EnTetePage
        etiquette={etiquette}
        titre={equipe ? "Cours" : "Mes cours"}
        sousTitre={sousTitre}
        actions={
          !etudiant ? (
            <LienBouton href="/enseigner/cours/nouveau" icone={<Plus className="h-5 w-5" />} className="min-h-[48px]">
              Nouveau cours
            </LienBouton>
          ) : undefined
        }
      />

      {isLoading ? (
        <Chargement lignes={4} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
      ) : !data?.length ? (
        etudiant ? (
          <EtatVide
            icone={<BookOpen className="h-6 w-6" />}
            titre="Tes cours arrivent bientôt"
            texte="Dès que ta classe sera inscrite à un cours, il apparaîtra ici avec ta progression. Si la rentrée a commencé et que tu ne vois rien, préviens la vie scolaire de ton campus."
            action={
              aide ? (
                <LienBouton href={aide} externe variante="contour" icone={<MessageCircleQuestion className="h-5 w-5" />} className="min-h-[48px]">
                  Écrire à la vie scolaire
                </LienBouton>
              ) : (
                <LienBouton href="/messages" variante="contour" className="min-h-[48px]">
                  Écrire à la vie scolaire
                </LienBouton>
              )
            }
          />
        ) : (
          <EtatVide
            icone={<BookOpen className="h-6 w-6" />}
            titre={equipe ? "Aucun cours pour l'instant" : "Vous n'avez pas encore de cours"}
            texte="Créez un cours : donnez-lui un code et un titre, ajoutez vos chapitres et leçons, cochez les classes, puis publiez-le. Les étudiants seront prévenus."
            action={
              <LienBouton href="/enseigner/cours/nouveau" icone={<Plus className="h-5 w-5" />} className="min-h-[48px]">
                Créer un cours
              </LienBouton>
            }
          />
        )
      ) : (
        <>
          {!etudiant && data.length > 6 && (
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-4 top-[15px] h-5 w-5 text-texte-gris" aria-hidden />
              <Champ
                aria-label="Chercher un cours"
                placeholder="Chercher un cours, un code, un formateur…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="[&_input]:pl-11"
              />
            </div>
          )}
          {liste.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {liste.map((c) => (etudiant ? <CarteCoursEtudiant key={c.id} cours={c} /> : <CarteCoursEnseignant key={c.id} cours={c} montrerFormateur={equipe} />))}
            </div>
          ) : (
            <EtatVide titre="Aucun cours ne correspond" texte="Essayez avec le code du cours (« IA-101 ») ou le nom du formateur." />
          )}
        </>
      )}
    </Page>
  );
}
