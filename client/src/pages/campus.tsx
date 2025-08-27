import { Building, Wifi, BookOpen, Users, Coffee, Car, Shield, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";

const campusFeatures = [
  {
    icon: Building,
    title: "Salles de Cours Modernes",
    description: "Amphithéâtres et salles équipées des dernières technologies pédagogiques",
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400"
  },
  {
    icon: BookOpen,
    title: "Bibliothèque & Centre de Documentation",
    description: "Plus de 10,000 ouvrages et accès aux bases de données internationales",
    image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400"
  },
  {
    icon: Users,
    title: "Laboratoire Informatique",
    description: "50 postes équipés des logiciels professionnels les plus récents",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400"
  },
  {
    icon: Coffee,
    title: "Espaces de Détente",
    description: "Cafétéria, espaces verts et zones de coworking pour les étudiants",
    image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400"
  },
  {
    icon: Wifi,
    title: "Connexion Haut Débit",
    description: "WiFi gratuit dans tous les espaces du campus",
    image: "https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400"
  },
  {
    icon: Car,
    title: "Parking Sécurisé",
    description: "Stationnement gratuit et sécurisé pour étudiants et visiteurs",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400"
  }
];

const services = [
  {
    icon: Shield,
    title: "Sécurité 24/7",
    description: "Campus sécurisé avec surveillance permanente et contrôle d'accès"
  },
  {
    icon: Clock,
    title: "Accès Étendu",
    description: "Ouvert de 7h à 22h du lundi au samedi pour s'adapter à votre emploi du temps"
  },
  {
    icon: Users,
    title: "Support Étudiant",
    description: "Service d'aide et d'orientation disponible pour tous les étudiants"
  },
  {
    icon: Wifi,
    title: "Infrastructure IT",
    description: "Réseau informatique moderne et support technique dédié"
  }
];

const virtualTourSpots = [
  {
    name: "Hall d'Accueil",
    description: "Espace d'accueil moderne avec réception et espaces d'attente confortables",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500"
  },
  {
    name: "Amphithéâtre Principal",
    description: "Amphithéâtre de 200 places avec équipement audiovisuel de dernière génération",
    image: "https://images.unsplash.com/photo-1523580846011-d3982bc861b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500"
  },
  {
    name: "Salles de Séminaires",
    description: "Espaces modulables pour travaux de groupe et séminaires spécialisés",
    image: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500"
  },
  {
    name: "Centre d'Incubation",
    description: "Espaces dédiés aux startups et projets entrepreneuriaux des étudiants",
    image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500"
  }
];

export default function CampusPage() {
  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Notre Campus
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-page-subtitle">
            Découvrez un environnement d'apprentissage moderne et inspirant, conçu pour favoriser l'excellence académique et l'innovation
          </p>
        </div>
      </section>

      {/* Campus Overview */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <Badge className="bg-primary/10 text-primary mb-6" data-testid="badge-campus-overview">
                Campus 2IAE
              </Badge>
              <h2 className="text-4xl font-bold mb-6 text-foreground" data-testid="text-overview-title">
                Un Cadre d'Excellence pour Votre Réussite
              </h2>
              <div className="space-y-4 text-lg text-muted-foreground">
                <p data-testid="text-overview-paragraph-1">
                  Notre campus moderne de <strong className="text-foreground">5000m²</strong> situé au cœur d'Abidjan offre un environnement propice à l'apprentissage et à l'innovation. Chaque espace a été pensé pour créer les meilleures conditions d'étude et d'épanouissement personnel.
                </p>
                <p data-testid="text-overview-paragraph-2">
                  Avec des infrastructures de pointe et des équipements technologiques modernes, nous offrons à nos étudiants un cadre d'apprentissage comparable aux meilleures écoles internationales.
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mt-8">
                <div className="text-center" data-testid="stat-surface">
                  <div className="text-3xl font-bold text-primary">5000m²</div>
                  <div className="text-muted-foreground">Surface Totale</div>
                </div>
                <div className="text-center" data-testid="stat-capacity">
                  <div className="text-3xl font-bold text-secondary">800+</div>
                  <div className="text-muted-foreground">Capacité Étudiants</div>
                </div>
                <div className="text-center" data-testid="stat-rooms">
                  <div className="text-3xl font-bold text-accent">25+</div>
                  <div className="text-muted-foreground">Salles Équipées</div>
                </div>
              </div>
            </div>
            <div>
              <img 
                src="https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"
                alt="Campus 2IAE International - Vue d'ensemble"
                className="rounded-2xl professional-shadow w-full h-auto"
                data-testid="img-campus-overview"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Campus Features */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" data-testid="text-features-title">
              Infrastructures & Équipements
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-features-subtitle">
              Des installations modernes au service de votre formation
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {campusFeatures.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card key={index} className="overflow-hidden hover-lift professional-shadow border-0" data-testid={`card-feature-${index}`}>
                  <div className="relative">
                    <img 
                      src={feature.image}
                      alt={feature.title}
                      className="w-full h-48 object-cover"
                      data-testid={`img-feature-${index}`}
                    />
                    <div className="absolute top-4 left-4">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                        <IconComponent className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold mb-3" data-testid={`text-feature-title-${index}`}>
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground" data-testid={`text-feature-description-${index}`}>
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Virtual Tour */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" data-testid="text-tour-title">
              Visite Virtuelle
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-tour-subtitle">
              Explorez nos espaces depuis chez vous
            </p>
          </div>
          
          <Tabs defaultValue="0" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-8">
              {virtualTourSpots.map((spot, index) => (
                <TabsTrigger key={index} value={index.toString()} className="text-xs lg:text-sm" data-testid={`tab-tour-${index}`}>
                  {spot.name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {virtualTourSpots.map((spot, index) => (
              <TabsContent key={index} value={index.toString()}>
                <Card className="overflow-hidden professional-shadow" data-testid={`card-tour-spot-${index}`}>
                  <div className="grid lg:grid-cols-2 gap-0">
                    <div className="relative">
                      <img 
                        src={spot.image}
                        alt={spot.name}
                        className="w-full h-80 lg:h-full object-cover"
                        data-testid={`img-tour-spot-${index}`}
                      />
                    </div>
                    <CardContent className="p-8 lg:p-12 flex flex-col justify-center">
                      <h3 className="text-3xl font-bold mb-6" data-testid={`text-tour-spot-title-${index}`}>
                        {spot.name}
                      </h3>
                      <p className="text-lg text-muted-foreground mb-8" data-testid={`text-tour-spot-description-${index}`}>
                        {spot.description}
                      </p>
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-fit" data-testid={`button-tour-360-${index}`}>
                        Voir en 360°
                      </Button>
                    </CardContent>
                  </div>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" data-testid="text-services-title">
              Services Campus
            </h2>
            <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-services-subtitle">
              Tous les services pour faciliter votre quotidien d'étudiant
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((service, index) => {
              const IconComponent = service.icon;
              return (
                <Card key={index} className="bg-white/10 border-white/20 text-white hover-lift" data-testid={`card-service-${index}`}>
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                      <IconComponent className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold mb-4" data-testid={`text-service-title-${index}`}>
                      {service.title}
                    </h3>
                    <p className="text-white/80" data-testid={`text-service-description-${index}`}>
                      {service.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Location & Access */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" data-testid="text-location-title">
              Localisation & Accès
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-location-subtitle">
              Facilement accessible depuis tous les quartiers d'Abidjan
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12">
            <Card className="professional-shadow" data-testid="card-location-map">
              <CardContent className="p-0">
                <div className="w-full h-80 bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Building className="h-12 w-12 text-primary mx-auto mb-4" />
                    <p className="text-lg font-semibold" data-testid="text-map-placeholder">Plan Interactif</p>
                    <p className="text-muted-foreground" data-testid="text-map-description">Campus 2IAE International</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="space-y-6">
              <Card className="professional-shadow" data-testid="card-address-info">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center" data-testid="text-address-title">
                    <Building className="h-5 w-5 text-primary mr-2" />
                    Adresse Complète
                  </h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p data-testid="text-address-line-1">Riviera Palmeraie, rue ministère</p>
                    <p data-testid="text-address-line-2">Centre de pharmacie rue ministère</p>
                    <p data-testid="text-address-line-3">Carrefour MACI CANARA (Siège)</p>
                    <p data-testid="text-address-line-4">Abidjan, Côte d'Ivoire</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="professional-shadow" data-testid="card-transport-info">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center" data-testid="text-transport-title">
                    <Car className="h-5 w-5 text-secondary mr-2" />
                    Moyens de Transport
                  </h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li data-testid="text-transport-taxi">• Taxi et VTC disponibles</li>
                    <li data-testid="text-transport-bus">• Lignes de bus 15, 23, 42</li>
                    <li data-testid="text-transport-metro">• Proche station métro Riviera</li>
                    <li data-testid="text-transport-parking">• Parking gratuit 200 places</li>
                  </ul>
                </CardContent>
              </Card>
              
              <Card className="professional-shadow" data-testid="card-hours-info">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center" data-testid="text-hours-title">
                    <Clock className="h-5 w-5 text-accent mr-2" />
                    Horaires d'Ouverture
                  </h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p data-testid="text-hours-weekdays"><strong>Lun - Ven:</strong> 7h00 - 22h00</p>
                    <p data-testid="text-hours-saturday"><strong>Samedi:</strong> 8h00 - 18h00</p>
                    <p data-testid="text-hours-sunday"><strong>Dimanche:</strong> Fermé</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Visit CTA */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6" data-testid="text-visit-cta-title">
            Visitez Notre Campus
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto" data-testid="text-visit-cta-subtitle">
            Rien ne vaut une visite pour découvrir l'environnement exceptionnel de 2IAE International
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg h-auto"
                data-testid="button-visit-cta-schedule"
              >
                Planifier une Visite
              </Button>
            </Link>
            <Button 
              variant="outline"
              className="px-8 py-4 text-lg h-auto"
              data-testid="button-visit-cta-brochure"
            >
              Télécharger la Brochure
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}