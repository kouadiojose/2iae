import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import oldSiteImage from "@assets/image_1756294873587.png";
import schoolBrochureImage from "@assets/image_1756295342176.png";

const heroSlides = [
  {
    id: 1,
    title: "L'École Où L'Apprentissage Prend Vie",
    subtitle: "2IAE, entreprendre pour devenir l'élite de demain",
    description: "Former une nouvelle génération d'entrepreneurs capables de transformer l'économie africaine",
    image: schoolBrochureImage,
    primaryButton: "Découvrir nos Filières",
    primaryLink: "/filieres",
    secondaryButton: "En Savoir Plus",
    secondaryLink: "/a-propos"
  },
  {
    id: 2,
    title: "Excellence Académique & Innovation",
    subtitle: "Partenariat avec l'Université de Sherbrooke, Canada",
    description: "Une formation d'excellence reconnue internationalement avec des diplômes homologués",
    image: "https://images.unsplash.com/photo-1523580846011-d3982bc861b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=600",
    primaryButton: "Voir nos Programmes",
    primaryLink: "/filieres",
    secondaryButton: "Campus Virtuel",
    secondaryLink: "/campus"
  },
  {
    id: 3,
    title: "L'École des Entrepreneurs",
    subtitle: "Centre d'incubation opérationnel",
    description: "Accompagnement complet avec stages garantis et supports pédagogiques modernes",
    image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=600",
    primaryButton: "Nous Contacter",
    primaryLink: "/contact",
    secondaryButton: "Voir le Campus",
    secondaryLink: "/campus"
  }
];

const features = [
  {
    title: "Formation Digitalisée",
    description: "Technologies éducatives de pointe",
    icon: "💻"
  },
  {
    title: "Stages Garantis",
    description: "Partenariats avec les entreprises",
    icon: "🏢"
  },
  {
    title: "Diplômes Homologués",
    description: "Reconnaissance internationale",
    icon: "🎓"
  },
  {
    title: "Accompagnement Personnalisé",
    description: "Suivi individualisé",
    icon: "🤝"
  }
];

export default function AccueilPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Slider Section */}
      <section className="relative h-screen overflow-hidden">
        <div className="absolute inset-0 slider-gradient">
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        {/* Slider Content */}
        <div className="relative h-full flex items-center">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center h-full min-h-[80vh]">
              <div className="text-white animate-fade-in-up">
                <Badge className="bg-white/20 text-white border-white/30 mb-6" data-testid="badge-welcome">
                  Bienvenue au Groupe Écoles 2IAE International
                </Badge>
                
                <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight" data-testid="text-hero-title">
                  {heroSlides[currentSlide].title}
                </h1>
                
                <h2 className="text-2xl lg:text-3xl mb-6 text-white/90 font-medium" data-testid="text-hero-subtitle">
                  {heroSlides[currentSlide].subtitle}
                </h2>
                
                <p className="text-xl mb-8 text-white/80 leading-relaxed max-w-lg" data-testid="text-hero-description">
                  {heroSlides[currentSlide].description}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href={heroSlides[currentSlide].primaryLink}>
                    <Button 
                      className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg h-auto font-semibold"
                      data-testid="button-hero-primary"
                    >
                      {heroSlides[currentSlide].primaryButton}
                    </Button>
                  </Link>
                  <Link href={heroSlides[currentSlide].secondaryLink}>
                    <Button 
                      variant="outline"
                      className="border-2 border-white text-white hover:bg-white hover:text-primary px-8 py-4 text-lg h-auto"
                      data-testid="button-hero-secondary"
                    >
                      {heroSlides[currentSlide].secondaryButton}
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div className="relative animate-fade-in-up">
                <img 
                  src={heroSlides[currentSlide].image}
                  alt={heroSlides[currentSlide].title}
                  className="rounded-2xl professional-shadow w-full h-auto max-h-[600px] object-cover"
                  data-testid="img-hero-slide"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Slider Controls */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-4">
          <button 
            onClick={prevSlide}
            className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
            data-testid="button-slide-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <div className="flex space-x-2">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentSlide ? "bg-white" : "bg-white/50"
                }`}
                data-testid={`button-slide-dot-${index}`}
              />
            ))}
          </div>
          
          <button 
            onClick={nextSlide}
            className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
            data-testid="button-slide-next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
            data-testid="button-slide-play-pause"
          >
            <Play className={`h-5 w-5 ${isPlaying ? "opacity-100" : "opacity-60"}`} />
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground" data-testid="text-features-title">
              Pourquoi Choisir 2IAE ?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-features-subtitle">
              Une approche moderne et professionnelle de l'enseignement entrepreneurial
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="hover-lift professional-shadow border-0" data-testid={`card-feature-${index}`}>
                <CardContent className="p-8 text-center">
                  <div className="text-5xl mb-6" data-testid={`icon-feature-${index}`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-card-foreground" data-testid={`text-feature-title-${index}`}>
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground" data-testid={`text-feature-description-${index}`}>
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6" data-testid="text-cta-title">
            Prêt à Rejoindre l'Élite de Demain ?
          </h2>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto" data-testid="text-cta-subtitle">
            Découvrez nos programmes de formation et commencez votre parcours entrepreneurial dès aujourd'hui
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button 
                className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg h-auto font-semibold"
                data-testid="button-cta-contact"
              >
                Nous Contacter
              </Button>
            </Link>
            <Link href="/filieres">
              <Button 
                variant="outline"
                className="border-2 border-white text-white hover:bg-white hover:text-primary px-8 py-4 text-lg h-auto"
                data-testid="button-cta-programs"
              >
                Voir nos Filières
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}