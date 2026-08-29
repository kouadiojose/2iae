// Textes d'origine restaurés depuis l'ancien site 2iae.com (pages/objectif).
import { Card, CardContent } from "@/components/ui/card";
import { Target, Flag, Compass } from "lucide-react";

const BLOCS = [
  {
    icone: Target,
    titre: "Objectifs",
    items: [
      "Inculquer l'esprit d'entrepreneuriat",
      "Former à l'auto-emploi",
    ],
  },
  {
    icone: Flag,
    titre: "Buts",
    intro:
      "Offrir un choix de carrière différent : créer son emploi… et celui des autres en se lançant en affaires. 2IAE existe pour :",
    items: [
      "Sensibiliser les jeunes à l'entrepreneuriat.",
      "Aider les jeunes à se créer un réseau de contacts pendant leurs études.",
      "Aider les jeunes à démystifier les services offerts par les organismes de financement.",
      "Contribuer au développement économique et à l'aide au démarrage, tout en les mettant en contact avec les personnes responsables.",
    ],
  },
  {
    icone: Compass,
    titre: "Missions",
    items: [
      "Former et insérer des lauréats opérationnels pour contribuer économiquement et socialement au développement.",
      "Transmettre l'esprit d'entrepreneuriat, le sens des responsabilités, l'ouverture sur le monde des affaires, le sens de l'éthique et le leadership.",
      "Former des cadres capables de créer et de diriger des PME et PMI à forte valeur ajoutée.",
      "Actualiser les connaissances des travailleurs du privé et du public ainsi que le niveau de connaissance des cadres en entreprise.",
      "Former des entrepreneurs avec des projets bancables.",
    ],
  },
];

export default function ObjectifsPage() {
  return (
    <div className="min-h-screen">
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Objectifs – Buts – Missions
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            La raison d'être du Groupe Écoles 2IAE International
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-5xl grid gap-8 md:grid-cols-3">
          {BLOCS.map((bloc) => (
            <Card key={bloc.titre} className="professional-shadow border-0">
              <CardContent className="p-8">
                <bloc.icone className="h-10 w-10 text-primary mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {bloc.titre}
                </h2>
                {"intro" in bloc && bloc.intro && (
                  <p className="text-gray-700 mb-4">{bloc.intro}</p>
                )}
                <ul className="space-y-3 text-gray-700">
                  {bloc.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
