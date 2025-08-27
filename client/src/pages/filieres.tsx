import { GraduationCap, Users, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";

const programs = [
  {
    id: "management-entrepreneuriat",
    title: "Management et Entrepreneuriat",
    category: "Entrepreneuriat",
    duration: "3 ans",
    level: "Post-BTS",
    image: "https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400",
    description: "Formation complète en gestion d'entreprise, innovation et développement entrepreneurial avec une approche pratique du management moderne.",
    highlights: [
      "Création et gestion d'entreprise",
      "Leadership et management d'équipes",
      "Innovation et développement produit",
      "Stratégie d'entreprise",
      "Finance et comptabilité",
      "Marketing stratégique"
    ],
    careers: ["Entrepreneur", "Directeur Général", "Consultant en Management", "Chef de Projet"],
    color: "primary"
  },
  {
    id: "marketing-digital",
    title: "Marketing Digital & E-Commerce",
    category: "Digital",
    duration: "2 ans",
    level: "Post-BTS",
    image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400",
    description: "Maîtrisez les outils digitaux et les stratégies marketing pour l'ère numérique avec une spécialisation en e-commerce.",
    highlights: [
      "Stratégies digitales avancées",
      "Gestion des réseaux sociaux",
      "E-commerce et marketplace",
      "Analytics et data marketing",
      "SEO/SEA et référencement",
      "Content marketing"
    ],
    careers: ["Digital Manager", "E-commerce Manager", "Social Media Manager", "Growth Hacker"],
    color: "secondary"
  },
  {
    id: "gestion-entreprises",
    title: "Gestion des Entreprises",
    category: "Business",
    duration: "3 ans",
    level: "Post-BTS",
    image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400",
    description: "Développez vos compétences en gestion, finance et stratégie d'entreprise avec une formation axée sur la performance organisationnelle.",
    highlights: [
      "Gestion financière avancée",
      "Contrôle de gestion",
      "Ressources humaines",
      "Audit et conformité",
      "Stratégie d'entreprise",
      "Management opérationnel"
    ],
    careers: ["Contrôleur de Gestion", "Directeur Financier", "Auditeur", "Consultant Business"],
    color: "accent"
  }
];

const advantages = [
  {
    icon: GraduationCap,
    title: "Diplômes Homologués",
    description: "Reconnaissance internationale avec partenariat Université de Sherbrooke"
  },
  {
    icon: Users,
    title: "Classes Réduites",
    description: "Accompagnement personnalisé avec 25 étudiants maximum par classe"
  },
  {
    icon: Clock,
    title: "Flexibilité",
    description: "Cours du soir et weekend disponibles pour les professionnels"
  },
  {
    icon: CheckCircle,
    title: "Stages Garantis",
    description: "100% de placement en stage dans nos entreprises partenaires"
  }
];

export default function FilieresPage() {
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
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full lg:w-fit lg:grid-cols-4 mb-12">
              <TabsTrigger value="all">Toutes les Filières</TabsTrigger>
              <TabsTrigger value="entrepreneuriat">Entrepreneuriat</TabsTrigger>
              <TabsTrigger value="digital">Digital</TabsTrigger>
              <TabsTrigger value="business">Business</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-12">
              {programs.map((program, index) => (
                <Card key={program.id} className="overflow-hidden professional-shadow hover-lift" data-testid={`card-program-${program.id}`}>
                  <div className="grid lg:grid-cols-2 gap-0">
                    <div className="relative">
                      <img 
                        src={program.image}
                        alt={program.title}
                        className="w-full h-80 lg:h-full object-cover"
                        data-testid={`img-program-${program.id}`}
                      />
                      <div className="absolute top-4 left-4">
                        <Badge 
                          className={`${
                            program.color === "primary" ? "bg-primary text-primary-foreground" :
                            program.color === "secondary" ? "bg-secondary text-secondary-foreground" :
                            "bg-accent text-accent-foreground"
                          }`}
                          data-testid={`badge-program-category-${program.id}`}
                        >
                          {program.category}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-8 lg:p-12">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-3xl font-bold text-card-foreground" data-testid={`text-program-title-${program.id}`}>
                          {program.title}
                        </h2>
                        <div className="text-right text-sm text-muted-foreground">
                          <div data-testid={`text-program-duration-${program.id}`}>{program.duration}</div>
                          <div data-testid={`text-program-level-${program.id}`}>{program.level}</div>
                        </div>
                      </div>
                      
                      <p className="text-lg text-muted-foreground mb-8" data-testid={`text-program-description-${program.id}`}>
                        {program.description}
                      </p>
                      
                      <div className="grid md:grid-cols-2 gap-8 mb-8">
                        <div>
                          <h3 className="font-semibold text-lg mb-4" data-testid={`text-program-highlights-title-${program.id}`}>
                            Points Clés du Programme
                          </h3>
                          <ul className="space-y-2">
                            {program.highlights.map((highlight, hIndex) => (
                              <li key={hIndex} className="flex items-center text-muted-foreground" data-testid={`text-program-highlight-${program.id}-${hIndex}`}>
                                <CheckCircle className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                                {highlight}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-lg mb-4" data-testid={`text-program-careers-title-${program.id}`}>
                            Débouchés Professionnels
                          </h3>
                          <ul className="space-y-2">
                            {program.careers.map((career, cIndex) => (
                              <li key={cIndex} className="text-muted-foreground" data-testid={`text-program-career-${program.id}-${cIndex}`}>
                                • {career}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-4">
                        <Link href="/contact">
                          <Button 
                            className={`${
                              program.color === "primary" ? "bg-primary hover:bg-primary/90 text-primary-foreground" :
                              program.color === "secondary" ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground" :
                              "bg-accent hover:bg-accent/90 text-accent-foreground"
                            } px-8 py-3`}
                            data-testid={`button-program-contact-${program.id}`}
                          >
                            Demander Plus d'Infos
                          </Button>
                        </Link>
                        <Button 
                          variant="outline"
                          className="px-8 py-3"
                          data-testid={`button-program-brochure-${program.id}`}
                        >
                          Télécharger la Brochure
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </TabsContent>

            {/* Individual category tabs */}
            {["entrepreneuriat", "digital", "business"].map((category) => (
              <TabsContent key={category} value={category} className="space-y-12">
                {programs
                  .filter(p => p.category.toLowerCase() === category)
                  .map((program) => (
                    <Card key={program.id} className="overflow-hidden professional-shadow hover-lift">
                      {/* Same card structure as above */}
                      <div className="grid lg:grid-cols-2 gap-0">
                        <div className="relative">
                          <img 
                            src={program.image}
                            alt={program.title}
                            className="w-full h-80 lg:h-full object-cover"
                          />
                        </div>
                        <CardContent className="p-8 lg:p-12">
                          <h2 className="text-3xl font-bold mb-4">{program.title}</h2>
                          <p className="text-lg text-muted-foreground mb-8">{program.description}</p>
                          <Link href="/contact">
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3">
                              Demander Plus d'Infos
                            </Button>
                          </Link>
                        </CardContent>
                      </div>
                    </Card>
                  ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* Advantages Section */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" data-testid="text-advantages-title">
              Nos Avantages Pédagogiques
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-advantages-subtitle">
              Une approche moderne et personnalisée de l'enseignement supérieur
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {advantages.map((advantage, index) => {
              const IconComponent = advantage.icon;
              return (
                <Card key={index} className="text-center hover-lift professional-shadow border-0" data-testid={`card-advantage-${index}`}>
                  <CardContent className="p-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                      <IconComponent className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-4" data-testid={`text-advantage-title-${index}`}>
                      {advantage.title}
                    </h3>
                    <p className="text-muted-foreground" data-testid={`text-advantage-description-${index}`}>
                      {advantage.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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