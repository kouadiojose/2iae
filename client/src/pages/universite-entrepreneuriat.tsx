// Textes d'origine restaurés depuis l'ancien site 2iae.com
// (pages/universite-entrepreunariat et pages/supports-pedagogiques).
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/lib/seo";
import { SectionVideos } from "@/components/video-youtube";

const SUPPORTS = [
  {
    titre: "Les serres et l'étang piscicole",
    texte:
      "Les étudiants en agriculture tropicale végétale et animale ont des outils de plus pour leur formation, afin d'expérimenter et surtout de pratiquer.",
  },
  {
    titre: "Les chantiers",
    texte:
      "Le groupe 2IAE met à la disposition de ses étudiants des chantiers, pour la pratique dans le domaine du génie civil option bâtiment.",
  },
  {
    titre: "La ferme du groupe",
    texte:
      "La ferme est située à Azaguié Ahoua sur le site de l'Université de l'Entrepreneuriat. L'expérimentation, la recherche : voilà quelques buts de la ferme. Nous y avons des bœufs, des lapins, des oies, des cabris, des moutons, des cailles, des pintades, des poulets, etc.",
  },
  {
    titre: "Les champs d'expérimentation",
    texte:
      "La pratique dans le domaine agricole ne pourrait se faire sans un champ d'expérimentation. Le groupe 2IAE International possède un champ de 10 hectares à Azaguié M'bromé et un autre de 5 hectares à Bingerville.",
  },
];

const ETAPES = [
  "Le château d'eau de l'Université de l'Entrepreneuriat : désormais l'eau courante est en accès illimité.",
  "Une unité de production sera installée à Azaguié sur le site de l'Université.",
  "Un sanctuaire de qualité et un exemple de protection de l'environnement.",
  "Un internat fonctionnel accueille les étudiants sur le site d'Azaguié.",
  "Bientôt la fin des travaux à Azaguié : l'école des entrepreneurs grandit.",
];

export default function UniversiteEntrepreneuriatPage() {
  usePageMeta(
    "Université de l'Entrepreneuriat d'Azaguié — ferme-école et internat | 2IAE",
    "Le campus agro-pastoral du Groupe 2IAE à Azaguié : ferme-école, champs d'expérimentation, étang piscicole, internat. La pédagogie par la pratique en conditions réelles.",
    '/universite-entrepreneuriat',
  );

  return (
    <div className="min-h-screen">
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Université de l'Entrepreneuriat
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            Le campus d'Azaguié Ahoua : un site dédié à la formation pratique,
            à l'expérimentation et à l'incubation
          </p>
          <p className="mt-6 inline-block bg-[#E8720C] text-white font-bold px-5 py-2 rounded-full">
            83,54 % d'admis au BTS 2026 — le meilleur taux du groupe
          </p>
        </div>
      </section>

      {/* Le campus en images */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-4 max-w-6xl grid sm:grid-cols-3 gap-6">
          <img
            src="/images/universite-azaguie-batiment.jpg"
            alt="Le bâtiment principal de l'Université de l'Entrepreneuriat d'Azaguié"
            loading="lazy"
            className="w-full h-64 object-cover rounded-xl professional-shadow"
            data-testid="img-universite-batiment"
          />
          <img
            src="/images/campus-azaguie-palmiers.jpg"
            alt="Le campus verdoyant, ses palmiers et ses étudiants"
            loading="lazy"
            className="w-full h-64 object-cover rounded-xl professional-shadow"
            data-testid="img-universite-campus"
          />
          <img
            src="/images/internat-triptyque.jpg"
            alt="Salle de classe, dortoirs de l'internat et cour intérieure"
            loading="lazy"
            className="w-full h-64 object-cover rounded-xl professional-shadow"
            data-testid="img-universite-internat"
          />
          <img
            src="/images/topographie-groupe.jpg"
            alt="Travaux pratiques de topographie sur le terrain du campus : niveaux, trépieds, casques et gilets"
            loading="lazy"
            className="w-full h-64 object-cover rounded-xl professional-shadow"
            data-testid="img-universite-topographie"
          />
          <img
            src="/images/topographie-etudiante-2.jpg"
            alt="Une étudiante en génie civil effectue une visée au niveau de chantier"
            loading="lazy"
            className="w-full h-64 object-cover rounded-xl professional-shadow"
            data-testid="img-universite-topographie-etudiante"
          />
          <img
            src="/images/chantier-ecole-visite.jpg"
            alt="Visite du chantier-école : les étudiants en casques sur un bâtiment en construction"
            loading="lazy"
            className="w-full h-64 object-cover rounded-xl professional-shadow"
            data-testid="img-universite-chantier"
          />
          <img
            src="/images/cacao-feves-ecabossage.jpg"
            alt="Écabossage du cacao aux champs-écoles : un étudiant trie les fèves fraîches"
            loading="lazy"
            className="w-full h-64 object-cover rounded-xl professional-shadow"
            data-testid="img-universite-cacao"
          />
          <img
            src="/images/elevage-lapins-ferme.jpg"
            alt="La ferme pédagogique : travaux pratiques de cuniculture avec les étudiants"
            loading="lazy"
            className="w-full h-64 object-cover rounded-xl professional-shadow"
            data-testid="img-universite-lapins"
          />
          <img
            src="/images/bassin-piscicole-filet.jpg"
            alt="Pêche au filet dans les bassins de tilapias du centre piscicole"
            loading="lazy"
            className="w-full h-64 object-cover rounded-xl professional-shadow"
            data-testid="img-universite-piscicole"
          />
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Les supports pédagogiques du campus
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            {SUPPORTS.map((s) => (
              <Card key={s.titre} className="professional-shadow border-0">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {s.titre}
                  </h3>
                  <p className="text-gray-700 leading-relaxed">{s.texte}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            Les grandes étapes du chantier
          </h2>
          <ul className="space-y-3 text-gray-700 max-w-2xl mx-auto">
            {ETAPES.map((e) => (
              <li key={e} className="flex gap-3">
                <span className="text-primary font-bold">•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SectionVideos
        titre="L'Université de l'Entrepreneuriat en vidéo"
        videos={[
          { id: "hKpt_P694Zw", titre: "À la découverte de l'Université de l'Entrepreneuriat" },
          { id: "HdYP7CxQjIY", titre: "Bienvenue à la meilleure université de l'entrepreneuriat" },
          { id: "z2yFuxXwxhs", titre: "Visite d'une délégation de l'Union Européenne sur le site d'Azaguié Ahoua" },
          { id: "CC4oP9QSkcQ", titre: "Le vice-doyen de l'Université de Sherbrooke en visite" },
          { id: "KY_cP1Bb-5Q", titre: "C'midi (RTI) : la visite d'Investisseurs & Partenaires" },
          { id: "D2-U4TtAdxg", titre: "Visite du chantier de l'Université à Azaguié" },
        ]}
      />
    </div>
  );
}
