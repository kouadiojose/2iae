import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Program } from "@shared/schema";

const categories = [
  { id: "ALL", label: "ALL", color: "bg-orange-500" },
  { id: "BTS TERTIAIRES", label: "BTS TERTIAIRES", color: "bg-gray-800" },
  { id: "BTS INDUSTRIEL", label: "BTS INDUSTRIEL", color: "bg-gray-800" },
  { id: "LICENCE/MASTER", label: "LICENCE/MASTER", color: "bg-gray-800" },
  { id: "CERTIFICAT", label: "CERTIFICAT", color: "bg-gray-800" },
];

export default function FilieresPage() {
  const [activeCategory, setActiveCategory] = useState("ALL");

  // Fetch programs from API
  const { data: programsData, isLoading } = useQuery<{
    success: boolean;
    programs: Program[];
  }>({
    queryKey: ["/api/programs"],
  });

  const programs = programsData?.programs || [];

  // Filter programs based on active category
  const filteredPrograms =
    activeCategory === "ALL"
      ? programs
      : programs.filter((program) => program.category === activeCategory);

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Nos Filières de Formation
          </h1>
          <p
            className="text-xl text-white/90 max-w-3xl mx-auto"
            data-testid="text-page-subtitle"
          >
            Découvrez nos programmes de formation conçus pour former les
            entrepreneurs et leaders de demain
          </p>
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="py-10 bg-gray-50 border-b border-gray-100">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-3xl md:text-4xl font-extrabold text-orange-500">
              67,38&nbsp;%
            </p>
            <p className="text-sm text-gray-600 mt-1">
              d'admis au BTS 2026 au Groupe 2IAE, contre 42,48&nbsp;% au
              niveau national
            </p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-extrabold text-orange-500">
              2006
            </p>
            <p className="text-sm text-gray-600 mt-1">
              l'année de création de l'École des Entrepreneurs
            </p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-extrabold text-orange-500">
              5 campus
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Abidjan (Palmeraie, Yopougon), Yamoussoukro, Azaguié, M'Batto —
              et un bureau au Canada
            </p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-extrabold text-orange-500">
              100&nbsp;%
            </p>
            <p className="text-sm text-gray-600 mt-1">
              des étudiants reçoivent des cours d'entrepreneuriat, quelle que
              soit la filière
            </p>
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-12 px-4">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-xs sm:text-sm uppercase tracking-wide transition-all duration-300 ${
                  activeCategory === category.id
                    ? category.color + " text-white shadow-lg"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
                data-testid={`button-category-${category.id.toLowerCase().replace(/[\/\s]/g, "-")}`}
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-16">
              <p className="text-xl text-gray-500">
                Chargement des filières...
              </p>
            </div>
          )}

          {/* Programs Grid */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {filteredPrograms.map((program) => (
                <Card
                  key={program.id}
                  className="group overflow-hidden professional-shadow hover-lift border-0 cursor-pointer"
                  data-testid={`card-program-${program.id}`}
                >
                  <div className="relative h-48 sm:h-64 overflow-hidden">
                    <img
                      src={
                        program.imageUrl ||
                        "https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500"
                      }
                      alt={program.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      data-testid={`img-program-${program.id}`}
                    />
                    {/* Dark Overlay with Title */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent">
                      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                        <h3
                          className="text-white font-bold text-base sm:text-lg leading-tight"
                          data-testid={`text-program-title-${program.id}`}
                        >
                          {program.name}
                        </h3>
                        <div className="flex items-center gap-2 sm:gap-3 mt-2 text-white/80 text-xs sm:text-sm">
                          <span
                            data-testid={`text-program-level-${program.id}`}
                          >
                            {program.level || "BTS"}
                          </span>
                          <span>•</span>
                          <span
                            data-testid={`text-program-duration-${program.id}`}
                          >
                            {program.duration || "2 ans"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Hover overlay with CTA */}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Link href="/contact">
                        <Button
                          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3"
                          data-testid={`button-program-contact-${program.id}`}
                        >
                          Plus d'Infos
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {program.description && (
                    <CardContent className="p-4 sm:p-6">
                      <p
                        className="text-gray-600 text-sm leading-relaxed"
                        data-testid={`text-program-description-${program.id}`}
                      >
                        {program.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Lien vers le détail des instituts */}
          {!isLoading && filteredPrograms.length > 0 && (
            <div className="text-center mt-12">
              <Link href="/instituts">
                <Button
                  variant="outline"
                  className="border-orange-500 text-orange-600 hover:bg-orange-50 font-semibold px-8 py-3 h-auto"
                  data-testid="button-instituts"
                >
                  Objectifs, débouchés et conditions d'entrée par filière →
                </Button>
              </Link>
            </div>
          )}

          {/* No programs found message */}
          {filteredPrograms.length === 0 && (
            <div className="text-center py-16">
              <p className="text-xl text-gray-500">
                Aucun programme trouvé dans cette catégorie.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6" data-testid="text-cta-title">
            Prêt à Commencer Votre Formation ?
          </h2>
          <p
            className="text-xl text-white/90 mb-8 max-w-2xl mx-auto"
            data-testid="text-cta-subtitle"
          >
            Rejoignez des centaines d'étudiants qui ont choisi 2IAE pour leur
            avenir professionnel
          </p>
          <Link href="/contact">
            <Button
              className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg h-auto font-semibold"
              data-testid="button-cta-contact"
            >
              Faire ma Préinscription
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
