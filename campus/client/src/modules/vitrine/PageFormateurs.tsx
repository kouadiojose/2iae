// /formateurs : les formateurs présentés au public, seulement avec leur
// accord (consentementSite) et la validation de la direction. Personne de
// présenté : la page explique pourquoi et mène à l'emploi du temps.
import { Globe2, ShieldCheck, UsersRound } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Squelette } from "@/components/ui/divers";
import { CarteFormateurPublic, EnTetePagePublique, EtatVidePublic } from "./composants";
import { useVitrine } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { useTitreDocument, ville } from "./outils";

export default function PageFormateurs() {
  useTitreDocument("Les formateurs · Campus numérique 2IAE");
  const { data: v, isLoading } = useVitrine();
  const formateurs = v?.formateurs ?? [];
  const villes = [...new Set(formateurs.map((f) => ville(f.localisation)).filter(Boolean))] as string[];

  return (
    <MiseEnPagePublique>
      <EnTetePagePublique
        fil={[{ libelle: "Formateurs" }]}
        etiquette="Ils enseignent au campus"
        titre="Des formateurs d'ici et d'ailleurs."
        texte={
          villes.length
            ? `Depuis ${villes.slice(0, 4).join(", ")}${villes.length > 4 ? "…" : ""}, ils enseignent en direct aux cinq campus du Groupe 2IAE.`
            : "Où qu'ils se trouvent dans le monde, ils enseignent en direct aux cinq campus du Groupe 2IAE, en même temps."
        }
      />

      <section className="conteneur pb-14">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Squelette key={i} className="h-56 rounded-3xl" />
            ))}
          </div>
        ) : formateurs.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {formateurs.map((f) => (
              <CarteFormateurPublic key={f.slug} formateur={f} />
            ))}
          </div>
        ) : (
          <EtatVidePublic
            icone={<UsersRound className="h-6 w-6" />}
            titre="Leurs portraits arrivent."
            texte="Chaque formateur choisit d'être présenté ici. En attendant, l'emploi du temps dit qui enseigne chaque jour de la semaine."
            action={<LienBouton href="/programme">Voir l'emploi du temps</LienBouton>}
          />
        )}
      </section>

      <section className="conteneur pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-[28px] bg-creme p-6 sm:p-8">
            <Globe2 className="h-6 w-6 text-orange-fonce" aria-hidden />
            <h2 className="text-2xl font-extrabold tracking-[-0.02em]">Enseigner à distance, en direct</h2>
            <p className="text-[15px] leading-relaxed text-texte-moyen">
              Le formateur enseigne depuis l'endroit où il se trouve. Il voit les salles de conférence des cinq campus, donne la parole à une salle ou à un
              étudiant, répond aux questions les plus votées et lance des sondages éclair.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-[28px] border border-ligne p-6 sm:p-8">
            <ShieldCheck className="h-6 w-6 text-orange-fonce" aria-hidden />
            <h2 className="text-2xl font-extrabold tracking-[-0.02em]">Présenté avec son accord</h2>
            <p className="text-[15px] leading-relaxed text-texte-moyen">
              Un formateur n'apparaît sur cette page que s'il l'a accepté dans son profil, et après validation de la direction. Il peut retirer son accord à
              tout moment : sa fiche disparaît aussitôt.
            </p>
          </div>
        </div>
      </section>
    </MiseEnPagePublique>
  );
}
