// Sites du groupe — adresses restaurées depuis l'ancien site 2iae.com
// (pages/nous-trouver et pied de page), coordonnées actualisées.
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/lib/seo";
import { MapPin, Phone, Mail } from "lucide-react";

const SITES = [
  {
    nom: "Abidjan – Riviera Palmeraie (Siège)",
    adresse:
      "Rue ministre, entre la pharmacie rue ministre et le carrefour MACI CANADA",
  },
  {
    nom: "Abidjan – Yopougon",
    adresse:
      "Quartier millionnaire, derrière le Groupe Scolaire Saint Louis (ancien Bel-Air)",
  },
  {
    nom: "Yamoussoukro",
    adresse:
      "Quartier millionnaire (école) ; bureau aux 220 logements, voisin de la clinique Grâce des Lacs",
  },
  {
    nom: "Azaguié Ahoua",
    adresse:
      "Site de l'Université de l'Entrepreneuriat — un internat fonctionnel y accueille les étudiants",
  },
  {
    nom: "M'Batto",
    adresse: "À côté de la gendarmerie",
  },
  {
    nom: "Canada – Longueuil (Québec)",
    adresse: "85 rue St-Charles Ouest, bureau 201, Longueuil (Québec) J4H 1C5",
  },
];

export default function NousTrouverPage() {
  usePageMeta(
    "Où nous trouver — 5 campus en Côte d'Ivoire | Groupe 2IAE",
    "Les adresses des campus 2IAE : Abidjan Riviera Palmeraie (siège), Yopougon, Yamoussoukro, Azaguié (internat) et M'Batto, plus le bureau de Longueuil au Canada.",
    '/nous-trouver',
  );

  return (
    <div className="min-h-screen">
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Où Nous Trouver ?
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            Le Groupe Écoles 2IAE International est présent sur cinq sites en
            Côte d'Ivoire et au Canada
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-5xl grid gap-6 md:grid-cols-2">
          {SITES.map((s) => (
            <Card key={s.nom} className="professional-shadow border-0">
              <CardContent className="p-6 flex gap-4">
                <MapPin className="h-7 w-7 text-primary shrink-0 mt-1" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    {s.nom}
                  </h2>
                  <p className="text-gray-700">{s.adresse}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="container mx-auto px-4 max-w-5xl mt-10 flex flex-wrap justify-center gap-8 text-gray-700">
          <span className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" /> +225 05 84 24 90 90 (appel & WhatsApp) · 27 22 51 81 75 · WhatsApp 07 47 72 67 29
          </span>
          <span className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> contacts@2iae.com
          </span>
        </div>
      </section>
    </div>
  );
}
