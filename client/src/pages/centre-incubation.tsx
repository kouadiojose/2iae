// Textes d'origine restaurés depuis l'ancien site 2iae.com (pages/centre-incubation).
import { Card, CardContent } from "@/components/ui/card";
import { Factory, Bird, Fish, Sprout, Building2, Sun } from "lucide-react";

const CENTRES = [
  {
    icone: Factory,
    titre: "L'usine d'attiéké",
    texte:
      "L'attiéké étant un mets de grande consommation, nos apprenants seront formés à la transformation, à la production puis à la commercialisation en grande quantité de ce produit sur le plan national voire international.",
  },
  {
    icone: Bird,
    titre: "Le centre d'incubation animalier",
    texte:
      "La ferme du groupe est à Azaguié Ahoua sur le site de l'Université de l'Entrepreneuriat. On peut y trouver des bœufs, des canards, des oies, des moutons, des lapins, des pintades et 3 poulaillers pouvant contenir 3 000 poulets.",
  },
  {
    icone: Sprout,
    titre: "Le centre d'incubation végétal",
    texte:
      "Le centre d'incubation végétal permet la formation pratique des apprenants à travers différentes spéculations produites par eux-mêmes. Ces spéculations constitueront les premiers produits que vendront nos incubés à la fin de la formation. Il existe au sein du centre des champs-écoles : un champ à Bingerville sur 5 ha (manioc, aubergine, riz, piment, maïs, chou), un champ à Azaguié M'bromé sur 10 ha (banane, cacao) et un champ expérimental pour les étudiants sur le site de l'université d'Azaguié Ahoua (piment, aubergine, banane, cacao). Des serres expérimentales abritent des pépinières de banane, de cacao et de palmier à huile.",
  },
  {
    icone: Building2,
    titre: "Le centre d'incubation en bâtiment",
    texte:
      "Le chantier-école est à Azaguié Ahoua. L'Université, n'étant pas encore terminée, sert pour la formation pratique et le travail rémunéré des apprenants. En plus des constructions en cours, il existe également des parcelles aménagées qui servent à apprendre les bases des métiers du bâtiment.",
  },
  {
    icone: Fish,
    titre: "Le centre piscicole",
    texte:
      "Composé de 4 bassins qui accueillent de 500 à 1 500 poissons (Tilapia Nilotica).",
  },
  {
    icone: Sun,
    titre: "Le séchoir artificiel",
    texte:
      "Ce séchoir permet aux étudiants en agriculture du Groupe 2IAE de faire des expériences afin de performer dans leur formation.",
  },
];

export default function CentreIncubationPage() {
  return (
    <div className="min-h-screen">
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Centre d'Incubation
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            Des unités de production réelles pour la formation pratique et
            l'incubation des apprenants
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-5xl grid gap-8 md:grid-cols-2">
          {CENTRES.map((c) => (
            <Card key={c.titre} className="professional-shadow border-0">
              <CardContent className="p-6">
                <c.icone className="h-9 w-9 text-primary mb-3" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {c.titre}
                </h2>
                <p className="text-gray-700 leading-relaxed">{c.texte}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
