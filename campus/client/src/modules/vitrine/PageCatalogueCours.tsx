// /cours-ouverts : les cours que la direction présente au public (case
// « Annoncer sur 2iae.com »), en cartes. Rien de publié : la page reste utile
// et mène à l'emploi du temps, qui liste tous les cours de la session.
import { BookOpen, MonitorSmartphone, Presentation, Repeat } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Squelette } from "@/components/ui/divers";
import { CarteCoursPublic, EnTetePagePublique, EtatVidePublic } from "./composants";
import { useVitrine } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { useTitreDocument } from "./outils";

const PRINCIPES = [
  { icone: Presentation, titre: "Un formateur, cinq salles", texte: "Chaque cours est diffusé en même temps dans les salles de conférence des cinq campus." },
  { icone: MonitorSmartphone, titre: "Aussi au téléphone", texte: "Les étudiants inscrits suivent en ligne, en son et diapositives quand le forfait est petit." },
  { icone: Repeat, titre: "Revoir et réviser", texte: "Les cours enregistrés restent disponibles en replay, avec leur fiche de révision." },
];

export default function PageCatalogueCours() {
  useTitreDocument("Les cours en direct · Campus numérique 2IAE");
  const { data: v, isLoading } = useVitrine();
  const cours = v?.cours ?? [];

  return (
    <MiseEnPagePublique>
      <EnTetePagePublique
        fil={[{ libelle: "Cours" }]}
        etiquette="Cours ouverts"
        titre="Les cours en direct."
        texte="Les cours du campus numérique présentés au public : ce qu'on y apprend, le formateur, les prochaines séances. Chacun est suivi en même temps dans les cinq campus."
      />

      <section className="conteneur pb-14">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Squelette key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : cours.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cours.map((c) => (
              <CarteCoursPublic key={c.slug} cours={c} />
            ))}
          </div>
        ) : (
          <EtatVidePublic
            icone={<BookOpen className="h-6 w-6" />}
            titre="Aucun cours n'est encore présenté au public."
            texte="Les fiches des cours paraissent ici quand la direction les annonce. Les cours de la session en cours, eux, sont déjà dans l'emploi du temps."
            action={<LienBouton href="/programme">Voir l'emploi du temps</LienBouton>}
          />
        )}
      </section>

      <section className="conteneur pb-16">
        <ul className="grid gap-px overflow-hidden rounded-[28px] bg-ligne md:grid-cols-3">
          {PRINCIPES.map(({ icone: Icone, titre, texte }) => (
            <li key={titre} className="flex flex-col gap-3 bg-creme p-6 sm:p-8">
              <Icone className="h-6 w-6 text-orange-fonce" aria-hidden />
              <h2 className="text-xl font-extrabold tracking-[-0.01em]">{titre}</h2>
              <p className="text-[15px] leading-relaxed text-texte-moyen">{texte}</p>
            </li>
          ))}
        </ul>
      </section>
    </MiseEnPagePublique>
  );
}
