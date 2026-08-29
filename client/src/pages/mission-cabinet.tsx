// Textes d'origine restaurés depuis l'ancien site 2iae.com (pages/mission-cabinet).
import { Card, CardContent } from "@/components/ui/card";

export default function MissionCabinetPage() {
  return (
    <div className="min-h-screen">
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Mission du Cabinet
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            2IAE, cabinet d'étude, d'assistance et de formation
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-4xl space-y-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Création</h2>
            <p className="text-gray-700 leading-relaxed">
              2IAE est un cabinet d'étude, d'assistance et de formation agréé
              par le Fonds de Développement et de la Formation Professionnelle
              (FDFP) sous le N° FDFP-G/N° 037-2008/AAB/FB/PHC.KT.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              L'équipe du cabinet
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Notre équipe est composée d'experts nationaux et internationaux
              qui ont déjà fait leurs preuves dans plusieurs structures de
              grande renommée. Aussi, sommes-nous convaincus que, mise à votre
              service, cette expertise vous gratifiera d'une exceptionnelle
              qualité de travail, comme nous l'avons déjà prouvé au sein de
              diverses entreprises.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Synthèse des références du cabinet
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Le cabinet de formation 2IAE a organisé ces dernières années
              environ 100 thèmes de formation continue dans divers domaines de
              gestion, et des formations spécialisées dans plusieurs
              entreprises nationales et internationales. En dehors des
              formations inter-entreprises, nos programmes de gestion sont
              fréquentés par tous les secteurs, privés comme publics, tels
              que :
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-gray-700 mb-4">
              {[
                "L'Agence Emploi Jeunes (AEJ)",
                "Le Ministère de la Culture et de la Francophonie",
                "L'INSAAC",
                "La LONACI",
                "Le Ministère du Commerce et de l'Industrie",
                "Le Groupe ETEP",
                "L'OIM",
              ].map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Le cabinet 2IAE a à son actif la formation et l'insertion de 500
              jeunes dans les domaines du bâtiment et de l'agriculture, en
              partenariat avec l'Agence Emploi Jeunes (AEJ).
            </p>
          </div>

          <Card className="professional-shadow border-0 bg-gray-50">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Références spécifiques
              </h3>
              <ul className="space-y-2 text-gray-700">
                {[
                  "Séminaire de formation en Gestion des Ressources Humaines (Séminaire international)",
                  "Séminaire de formation en Gestion budgétaire (Séminaire international)",
                  "Séminaire de formation en Informatique (Séminaire international)",
                  "Séminaire de formation en Organisation et Management des projets (Séminaire international)",
                  "Séminaires internationaux et séminaires spécialisés",
                  "Formations diverses",
                ].map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
