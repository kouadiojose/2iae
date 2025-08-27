import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

// Programmes basés sur l'ancien site de 2IAE
const programs = [
  // BTS TERTIAIRES
  {
    id: "finance-comptabilite-gestion",
    title: "FINANCE COMPTABILITÉ & GESTION D'ENTREPRISE",
    category: "BTS TERTIAIRES",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "2 ans",
    level: "BTS"
  },
  {
    id: "gestion-commerciale",
    title: "GESTION COMMERCIALE",
    category: "BTS TERTIAIRES", 
    image: "https://images.unsplash.com/photo-1556761175-4b46a572b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "2 ans",
    level: "BTS"
  },
  {
    id: "ressources-humaines-communication",
    title: "RESSOURCES HUMAINES & COMMUNICATION",
    category: "BTS TERTIAIRES",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "2 ans",
    level: "BTS"
  },
  {
    id: "logistique",
    title: "LOGISTIQUE",
    category: "BTS TERTIAIRES",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "2 ans",
    level: "BTS"
  },
  
  // BTS INDUSTRIEL
  {
    id: "science-information",
    title: "SCIENCE DE L'INFORMATION",
    category: "BTS INDUSTRIEL",
    image: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "2 ans",
    level: "BTS"
  },
  {
    id: "informatique-ida",
    title: "INFORMATIQUE DÉVELOPPEUR D'APPLICATIONS (IDA)",
    category: "BTS INDUSTRIEL",
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "2 ans",
    level: "BTS"
  },
  {
    id: "genie-civil-batiment",
    title: "GÉNIE CIVIL OPTION BÂTIMENT (GBAT)",
    category: "BTS INDUSTRIEL",
    image: "https://images.unsplash.com/photo-1541976590-713941681591?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "2 ans",
    level: "BTS"
  },
  {
    id: "genie-civil-travaux-publics",
    title: "GÉNIE CIVIL OPTION TRAVAUX PUBLICS",
    category: "BTS INDUSTRIEL",
    image: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "2 ans",
    level: "BTS"
  },
  {
    id: "agriculture-tropicale",
    title: "AGRICULTURE TROPICALE OPTION - PRODUCTION VÉGÉTALE (ATPV)",
    category: "BTS INDUSTRIEL",
    image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "2 ans",
    level: "BTS"
  },
  
  // LICENCE/MASTER
  {
    id: "management-entrepreneuriat",
    title: "MANAGEMENT & ENTREPRENEURIAT",
    category: "LICENCE/MASTER",
    image: "https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "3 ans",
    level: "Licence"
  },
  {
    id: "marketing-digital",
    title: "MARKETING DIGITAL & COMMUNICATION",
    category: "LICENCE/MASTER",
    image: "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "3 ans",
    level: "Licence"
  },
  {
    id: "gestion-financiere",
    title: "GESTION FINANCIÈRE & CONTRÔLE",
    category: "LICENCE/MASTER",
    image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "3 ans",
    level: "Licence"
  },
  
  // CERTIFICAT
  {
    id: "creation-entreprise",
    title: "CRÉATION & GESTION D'ENTREPRISE",
    category: "CERTIFICAT",
    image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "6 mois",
    level: "Certificat"
  },
  {
    id: "comptabilite-analytique",
    title: "COMPTABILITÉ ANALYTIQUE & FISCALITÉ",
    category: "CERTIFICAT",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "4 mois",
    level: "Certificat"
  },
  {
    id: "leadership-management",
    title: "LEADERSHIP & MANAGEMENT D'ÉQUIPE",
    category: "CERTIFICAT",
    image: "https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500",
    duration: "3 mois",
    level: "Certificat"
  }
];

const categories = [
  { id: "ALL", label: "ALL", color: "bg-orange-500" },
  { id: "BTS TERTIAIRES", label: "BTS TERTIAIRES", color: "bg-gray-800" },
  { id: "BTS INDUSTRIEL", label: "BTS INDUSTRIEL", color: "bg-gray-800" },
  { id: "LICENCE/MASTER", label: "LICENCE/MASTER", color: "bg-gray-800" },
  { id: "CERTIFICAT", label: "CERTIFICAT", color: "bg-gray-800" }
];

export default function FilieresPage() {
  const [activeCategory, setActiveCategory] = useState("ALL");

  // Filter programs based on active category
  const filteredPrograms = activeCategory === "ALL" 
    ? programs 
    : programs.filter(program => program.category === activeCategory);

  return (
    <div className="min-h-screen pt-20">
      {/* Header Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Nos Filières de Formation
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-page-subtitle">
            Découvrez nos programmes de formation conçus pour former les entrepreneurs et leaders de demain
          </p>
        </div>
      </section>

      {/* Programs Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-6 py-3 rounded-lg font-semibold text-sm uppercase tracking-wide transition-all duration-300 ${
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

          {/* Programs Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPrograms.map((program) => (
              <Card 
                key={program.id} 
                className="group overflow-hidden professional-shadow hover-lift border-0 cursor-pointer"
                data-testid={`card-program-${program.id}`}
              >
                <div className="relative h-64 overflow-hidden">
                  <img 
                    src={program.image}
                    alt={program.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    data-testid={`img-program-${program.id}`}
                  />
                  {/* Dark Overlay with Title */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent">
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 
                        className="text-white font-bold text-lg leading-tight"
                        data-testid={`text-program-title-${program.id}`}
                      >
                        {program.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-2 text-white/80 text-sm">
                        <span data-testid={`text-program-level-${program.id}`}>{program.level}</span>
                        <span>•</span>
                        <span data-testid={`text-program-duration-${program.id}`}>{program.duration}</span>
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
              </Card>
            ))}
          </div>

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
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto" data-testid="text-cta-subtitle">
            Rejoignez des centaines d'étudiants qui ont choisi 2IAE pour leur avenir professionnel
          </p>
          <Link href="/contact">
            <Button 
              className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg h-auto font-semibold"
              data-testid="button-cta-contact"
            >
              Déposer Ma Candidature
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}