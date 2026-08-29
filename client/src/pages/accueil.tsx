import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play, Calendar, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { imageActualite, IMAGE_PAR_DEFAUT } from "@/lib/imageActualite";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useQuery } from "@tanstack/react-query";
import { type Slider, type FounderMessage, type Institute } from "@shared/schema";

interface News {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  imageUrl: string | null;
  date: string;
  category: string;
  author: string;
  featured: boolean;
  isActive: boolean;
}

// Interface pour les slides formatés
interface FormattedSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  primaryButton: string;
  primaryLink: string;
  secondaryButton: string;
  secondaryLink: string;
}
import oldSiteImage from "@assets/image_1756294873587.png";
import schoolBrochureImage from "@assets/image_1756295342176.png";

// Fallback slides en cas d'erreur ou de chargement
const fallbackSlides: FormattedSlide[] = [
  {
    id: "fallback-1",
    title: "L'École Où L'Apprentissage Prend Vie",
    subtitle: "2IAE, entreprendre pour devenir l'élite de demain",
    description: "Former une nouvelle génération d'entrepreneurs capables de transformer l'économie africaine",
    image: schoolBrochureImage,
    primaryButton: "Découvrir nos Filières",
    primaryLink: "/filieres",
    secondaryButton: "En Savoir Plus",
    secondaryLink: "/a-propos"
  }
];

// Fonction pour adapter les données de la DB au format du composant
function formatSlideData(slides: Slider[]): FormattedSlide[] {
  return slides
    .filter(slide => slide.isActive) // Seulement les sliders actifs
    .sort((a, b) => parseInt(a.order || "0") - parseInt(b.order || "0")) // Trier par ordre
    .map(slide => ({
      id: slide.id,
      title: slide.title,
      subtitle: slide.subtitle || "",
      description: slide.description || "",
      image: slide.imageUrl || schoolBrochureImage,
      primaryButton: slide.button1Text || "Découvrir",
      primaryLink: slide.button1Link || "/filieres",
      secondaryButton: slide.button2Text || "En Savoir Plus",
      secondaryLink: slide.button2Link || "/a-propos"
    }));
}

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

// Recent News Grid Component
function RecentNewsGrid() {
  const { data: newsData, isLoading, error } = useQuery({
    queryKey: ["/api/news"],
    retry: false,
  });

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="overflow-hidden professional-shadow animate-pulse">
            <div className="h-48 bg-gray-300"></div>
            <CardContent className="p-6">
              <div className="h-4 bg-gray-300 rounded mb-2"></div>
              <div className="h-6 bg-gray-300 rounded mb-3"></div>
              <div className="h-4 bg-gray-300 rounded mb-4"></div>
              <div className="h-10 bg-gray-300 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Impossible de charger les actualités pour le moment.</p>
      </div>
    );
  }

  const news: News[] = (newsData as any)?.news || [];
  const activeNews = news.filter((item: News) => item.isActive);
  
  // Get the 4 most recent news (sorted by date, most recent first)
  const recentNews = activeNews
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  if (recentNews.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">Aucune actualité disponible pour le moment.</p>
        <p className="text-sm text-muted-foreground">Revenez bientôt pour découvrir nos dernières nouvelles !</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {recentNews.map((article: News) => (
          <Card key={article.id} className="overflow-hidden professional-shadow hover-lift h-full flex flex-col" data-testid={`card-recent-news-${article.id}`}>
            <div className="relative">
              <img
                src={imageActualite(article.imageUrl)}
                alt={article.title}
                onError={(e) => {
                  // Même garde-fou qu'en page Actualités : une URL externe
                  // devenue injoignable laisserait une carte sans visuel.
                  const img = e.currentTarget;
                  if (img.dataset.repli === "1") return;
                  img.dataset.repli = "1";
                  img.src = IMAGE_PAR_DEFAUT;
                }}
                className="w-full h-48 object-cover"
                data-testid={`img-recent-news-${article.id}`}
              />
              <div className="absolute top-4 left-4">
                <Badge className="bg-orange-500 hover:bg-orange-600" data-testid={`badge-recent-news-category-${article.id}`}>
                  {article.category}
                </Badge>
              </div>
            </div>
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1" data-testid={`text-recent-news-date-${article.id}`}>
                  <Calendar className="h-4 w-4" />
                  {formatDate(article.date)}
                </div>
              </div>
              <h3 className="text-lg font-bold mb-3 flex-1 line-clamp-2" data-testid={`text-recent-news-title-${article.id}`}>
                {article.title}
              </h3>
              <p className="text-muted-foreground mb-4 line-clamp-3 text-sm" data-testid={`text-recent-news-summary-${article.id}`}>
                {article.summary || "Découvrez cette actualité importante de 2IAE International."}
              </p>
              <Link href={`/actualites/${article.slug}`}>
                <Button variant="outline" size="sm" className="w-full mt-auto hover:bg-orange-100" data-testid={`button-recent-news-read-more-${article.id}`}>
                  Lire la suite
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* See All News Button */}
      <div className="text-center mt-12">
        <Link href="/actualites">
          <Button 
            size="lg" 
            className="bg-orange-500 hover:bg-orange-600 px-8 py-3"
            data-testid="button-see-all-news"
          >
            Voir toutes les actualités
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </>
  );
}

export default function AccueilPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const { getContentByKey, getContentBySection, isLoading: contentLoading } = useSiteContent();
  
  // Récupérer les sliders depuis l'API
  const { data: slidersData, isLoading: slidersLoading, error } = useQuery({
    queryKey: ["/api/sliders"],
  });

  // Récupérer le message du fondateur depuis l'API
  const { data: founderData, isLoading: founderLoading } = useQuery({
    queryKey: ["/api/founder-message"],
  });

  // Récupérer les instituts depuis l'API
  const { data: institutesData, isLoading: institutesLoading } = useQuery<{ success: boolean; institutes: Institute[] }>({
    queryKey: ["/api/institutes"],
  });
  
  // Formater les données et gérer les fallbacks
  const heroSlides = slidersData && typeof slidersData === 'object' && 'sliders' in slidersData && Array.isArray(slidersData.sliders) && slidersData.sliders.length > 0 
    ? formatSlideData(slidersData.sliders as Slider[])
    : fallbackSlides;

  useEffect(() => {
    if (isPlaying && heroSlides.length > 0) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, heroSlides.length]);
  
  // Réinitialiser le slide courant si les données changent
  useEffect(() => {
    if (currentSlide >= heroSlides.length && heroSlides.length > 0) {
      setCurrentSlide(0);
    }
  }, [heroSlides.length, currentSlide]);

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
    <div className="min-h-screen mobile-safe">
      {/* Hero Slider Section */}
      <section className="relative min-h-[80vh] lg:h-[70vh] overflow-hidden mobile-no-overflow">
        <div className="absolute inset-0 slider-gradient">
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        {/* Slider Content */}
        <div className="relative h-full flex items-center mobile-no-overflow">
          <div className="container mx-auto mobile-padding">
            {slidersLoading ? (
              /* État de chargement */
              <div className="grid lg:grid-cols-2 gap-12 items-center h-full min-h-[80vh]">
                <div className="text-white animate-pulse">
                  <div className="w-80 h-8 bg-white/20 rounded mb-6"></div>
                  <div className="w-full h-16 bg-white/20 rounded mb-6"></div>
                  <div className="w-96 h-12 bg-white/20 rounded mb-6"></div>
                  <div className="w-full h-20 bg-white/20 rounded mb-8"></div>
                  <div className="flex gap-4">
                    <div className="w-48 h-14 bg-white/20 rounded"></div>
                    <div className="w-40 h-14 bg-white/20 rounded"></div>
                  </div>
                </div>
                <div className="w-full h-[600px] bg-white/20 rounded-2xl animate-pulse"></div>
              </div>
            ) : (
              /* Contenu du slider */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-8 lg:py-0 lg:h-full lg:min-h-[80vh]">
                <div className="text-white animate-fade-in-up space-y-4 lg:space-y-6">
                  <Badge className="bg-white/20 text-white border-white/30 text-xs lg:text-sm" data-testid="badge-welcome">
                    Bienvenue au Groupe Écoles 2IAE International
                  </Badge>
                  
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-7xl font-bold leading-tight" data-testid="text-hero-title">
                    {heroSlides[currentSlide]?.title || getContentByKey("homepage_title")}
                  </h1>
                  
                  <h2 className="text-sm sm:text-lg md:text-xl lg:text-3xl text-white/90 font-medium" data-testid="text-hero-subtitle">
                    {heroSlides[currentSlide]?.subtitle || getContentByKey("homepage_subtitle")}
                  </h2>
                  
                  <p className="text-sm sm:text-base lg:text-xl text-white/80 leading-relaxed max-w-lg" data-testid="text-hero-description">
                    {heroSlides[currentSlide]?.description}
                  </p>
                  
                  <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
                    <Link href={heroSlides[currentSlide]?.primaryLink || "/filieres"}>
                      <Button 
                        className="bg-white text-primary hover:bg-white/90 px-4 py-2 lg:px-8 lg:py-4 text-sm lg:text-lg h-auto font-semibold w-full lg:w-auto"
                        data-testid="button-hero-primary"
                      >
                        {heroSlides[currentSlide]?.primaryButton || "Découvrir"}
                      </Button>
                    </Link>
                    <Link href={heroSlides[currentSlide]?.secondaryLink || "/a-propos"}>
                      <Button 
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 lg:px-8 lg:py-4 text-sm lg:text-lg h-auto font-semibold w-full lg:w-auto"
                        data-testid="button-hero-secondary"
                      >
                        {heroSlides[currentSlide]?.secondaryButton || "En Savoir Plus"}
                      </Button>
                    </Link>
                  </div>
                </div>
                
                <div className="relative animate-fade-in-up mobile-no-overflow order-first lg:order-last">
                  <img 
                    src={heroSlides[currentSlide]?.image || schoolBrochureImage}
                    alt={heroSlides[currentSlide]?.title || "École 2IAE"}
                    className="rounded-lg lg:rounded-2xl professional-shadow w-full h-auto max-h-[250px] lg:max-h-[600px] object-cover"
                    data-testid="img-hero-slide"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Slider Controls - Repositionnés pour éviter les chevauchements */}
        {!slidersLoading && heroSlides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 hidden lg:flex items-center space-x-4">
            <button 
              onClick={prevSlide}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
              data-testid="button-slide-prev"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div className="flex space-x-1">
              {heroSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentSlide ? "bg-white" : "bg-white/50"
                  }`}
                  data-testid={`button-slide-dot-${index}`}
                />
              ))}
            </div>
            
            <button 
              onClick={nextSlide}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
              data-testid="button-slide-next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </section>

      {/* Bandeau Rentrée — préinscriptions */}
      <section className="py-14 bg-orange-500 text-white mobile-no-overflow">
        <div className="container mx-auto mobile-padding">
          <div className="text-center mb-8">
            <h2
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold"
              data-testid="text-rentree-title"
            >
              Rentrée académique : les préinscriptions sont ouvertes !
            </h2>
            <p className="text-white/90 mt-3 max-w-3xl mx-auto text-lg">
              Parents, futurs bacheliers : choisissez une école qui prouve ses
              résultats et forme des jeunes capables de créer leur emploi.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center mb-10">
            <div>
              <p className="text-3xl lg:text-4xl font-extrabold">67,38&nbsp;%</p>
              <p className="text-sm text-white/90 mt-1">
                d'admis au BTS 2026, contre 42,48&nbsp;% au niveau national
              </p>
            </div>
            <div>
              <p className="text-3xl lg:text-4xl font-extrabold">500+</p>
              <p className="text-sm text-white/90 mt-1">
                jeunes formés et insérés avec l'Agence Emploi Jeunes
              </p>
            </div>
            <div>
              <p className="text-3xl lg:text-4xl font-extrabold">Internat</p>
              <p className="text-sm text-white/90 mt-1">
                un cadre sécurisé sur le campus de l'Université de
                l'Entrepreneuriat à Azaguié
              </p>
            </div>
            <div>
              <p className="text-3xl lg:text-4xl font-extrabold">Canada</p>
              <p className="text-sm text-white/90 mt-1">
                des partenariats internationaux, dont l'Université de
                Sherbrooke
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/preinscription">
              <Button
                className="bg-white text-orange-600 hover:bg-white/90 px-8 py-4 text-lg h-auto font-bold w-full sm:w-auto"
                data-testid="button-rentree-preinscription"
              >
                Je fais ma préinscription
              </Button>
            </Link>
            <Link href="/tarifs">
              <Button
                className="bg-gray-900 text-white hover:bg-gray-800 px-8 py-4 text-lg h-auto font-semibold w-full sm:w-auto"
                data-testid="button-rentree-tarifs"
              >
                Voir les tarifs par site
              </Button>
            </Link>
            <Link href="/instituts">
              <Button
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8 py-4 text-lg h-auto font-semibold w-full sm:w-auto"
                data-testid="button-rentree-filieres"
              >
                Filières et débouchés
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Founder Message Section */}
      <section className="py-20 bg-background mobile-no-overflow">
        <div className="container mx-auto mobile-padding">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <Badge className="bg-primary/10 text-primary mb-6" data-testid="badge-founder-message">
                Message du Fondateur
              </Badge>
              {founderLoading ? (
                <div className="space-y-4">
                  <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ) : founderData && typeof founderData === 'object' && 'founderMessage' in founderData && founderData.founderMessage && (founderData.founderMessage as FounderMessage).isActive ? (
                <>
                  <h2 className="text-4xl font-bold mb-6 text-foreground" data-testid="text-founder-title">
                    {(founderData.founderMessage as FounderMessage).title || "Entreprendre pour Devenir l'Élite de Demain"}
                  </h2>
                  <blockquote className="text-lg text-muted-foreground mb-6 italic border-l-4 border-primary pl-6 text-justify" data-testid="text-founder-quote">
                    "{(founderData.founderMessage as FounderMessage).quote}"
                  </blockquote>
                  <p className="text-lg text-muted-foreground mb-8 text-justify" data-testid="text-founder-vision">
                    {(founderData.founderMessage as FounderMessage).vision}
                  </p>
                  <div className="flex items-center space-x-4" data-testid="founder-info">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-lg">PDG</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground" data-testid="text-founder-name">
                        {(founderData.founderMessage as FounderMessage).founderName || "Directeur Général"}
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid="text-founder-role">
                        {(founderData.founderMessage as FounderMessage).founderRole || "Directeur Général & Fondateur"}
                      </p>
                      <p className="text-muted-foreground" data-testid="text-founder-org">
                        {(founderData.founderMessage as FounderMessage).founderOrganization || "Groupe Écoles 2IAE International"}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-4xl font-bold mb-6 text-foreground" data-testid="text-founder-title">
                    "Entreprendre pour Devenir l'Élite de Demain"
                  </h2>
                  <blockquote className="text-lg text-muted-foreground mb-6 italic border-l-4 border-primary pl-6 text-justify" data-testid="text-founder-quote">
                    "Si en Côte D'Ivoire, les Écoles et les Universités ont réussi dans les programmes de formation des cadres, les moyennes et grandes entreprises, elles ont connu moins de succès dans les programmes destinés aux cadres des petites entreprises, et moins encore dans la formation d'entrepreneurs."
                  </blockquote>
                  <p className="text-lg text-muted-foreground mb-8 text-justify" data-testid="text-founder-vision">
                    C'est de cette vision qu'est né 2IAE International, pour combler ce vide et former une nouvelle génération d'entrepreneurs capables de transformer l'économie africaine.
                  </p>
                  <div className="flex items-center space-x-4" data-testid="founder-info">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-lg">PDG</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground" data-testid="text-founder-role">
                        Directeur Général & Fondateur
                      </p>
                      <p className="text-muted-foreground" data-testid="text-founder-org">
                        Groupe Écoles 2IAE International
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="order-1 lg:order-2">
              <img 
                src={
                  founderData && typeof founderData === 'object' && 'founderMessage' in founderData && founderData.founderMessage && (founderData.founderMessage as FounderMessage).founderImageUrl
                    ? (founderData.founderMessage as FounderMessage).founderImageUrl!
                    : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=700"
                }
                alt="Directeur Général 2IAE International"
                className="rounded-2xl professional-shadow w-full max-w-sm h-auto mx-auto"
                data-testid="img-founder"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Recent News Section */}
      <section className="py-20 bg-background mobile-no-overflow">
        <div className="container mx-auto mobile-padding">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground" data-testid="text-news-title">
              Récentes Actualités
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-news-subtitle">
              Suivez les dernières nouvelles et innovations de 2IAE International
            </p>
          </div>
          
          <RecentNewsGrid />
        </div>
      </section>

      {/* Institutes Section */}
      <section className="py-20 bg-muted mobile-no-overflow">
        <div className="container mx-auto mobile-padding">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 text-foreground" data-testid="text-institutes-title">
              NOS INSTITUTS
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-institutes-subtitle">
              Entreprendre Pour Devenir L'Élite De Demain.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {institutesLoading ? (
              // État de chargement pour les instituts
              Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="overflow-hidden hover-lift professional-shadow border-0 bg-gradient-to-br from-gray-800 to-gray-900 text-white">
                  <CardContent className="p-8 h-80 flex flex-col justify-between">
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="w-64 h-6 bg-white/20 rounded mb-4 mx-auto animate-pulse"></div>
                      <div className="w-16 h-1 bg-primary mx-auto mb-6"></div>
                    </div>
                    <div className="text-center">
                      <div className="w-32 h-12 bg-white/20 rounded mx-auto animate-pulse"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : institutesData?.institutes && institutesData.institutes.length > 0 ? (
              // Afficher les instituts depuis la base de données
              institutesData.institutes
                .filter(institute => institute.isActive)
                .sort((a, b) => parseInt(a.order || "1") - parseInt(b.order || "1"))
                .map((institute, index) => (
                  <Card 
                    key={institute.id} 
                    className={`overflow-hidden hover-lift professional-shadow border-0 bg-gradient-to-br ${institute.bgColor || 'from-gray-800 to-gray-900'} text-white`}
                    data-testid={`card-institute-${index}`}
                  >
                    <CardContent className="p-8 h-80 flex flex-col justify-between">
                      <div className="flex-1 flex flex-col justify-center">
                        <h3 className="text-xl font-bold mb-4 text-center leading-tight" data-testid={`text-institute-title-${index}`}>
                          {institute.title}
                        </h3>
                        {institute.description && (
                          <p className="text-sm text-center text-white/80 mb-4" data-testid={`text-institute-description-${index}`}>
                            {institute.description}
                          </p>
                        )}
                        <div className="w-16 h-1 bg-primary mx-auto mb-6"></div>
                      </div>
                      <div className="text-center">
                        <Link href={institute.link || "/filieres"}>
                          <Button 
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3"
                            data-testid={`button-institute-${index}`}
                          >
                            {institute.buttonText || "EN SAVOIR PLUS"}
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))
            ) : (
              // Fallback instituts statiques si aucune donnée en DB
              <>
                <Card className="overflow-hidden hover-lift professional-shadow border-0 bg-gradient-to-br from-gray-800 to-gray-900 text-white" data-testid="card-institute-management">
                  <CardContent className="p-8 h-80 flex flex-col justify-between">
                    <div className="flex-1 flex flex-col justify-center">
                      <h3 className="text-xl font-bold mb-4 text-center leading-tight" data-testid="text-institute-management-title">
                        INSTITUTS DE FORMATION EN MANAGEMENT
                      </h3>
                      <div className="w-16 h-1 bg-primary mx-auto mb-6"></div>
                    </div>
                    <div className="text-center">
                      <Link href="/filieres">
                        <Button 
                          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3"
                          data-testid="button-institute-management"
                        >
                          EN SAVOIR PLUS
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden hover-lift professional-shadow border-0 bg-gradient-to-br from-gray-800 to-gray-900 text-white" data-testid="card-institute-technology">
                  <CardContent className="p-8 h-80 flex flex-col justify-between">
                    <div className="flex-1 flex flex-col justify-center">
                      <h3 className="text-xl font-bold mb-4 text-center leading-tight" data-testid="text-institute-technology-title">
                        INSTITUTS DE FORMATION AUX NOUVELLES TECHNOLOGIES
                      </h3>
                      <div className="w-16 h-1 bg-primary mx-auto mb-6"></div>
                    </div>
                    <div className="text-center">
                      <Link href="/filieres">
                        <Button 
                          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3"
                          data-testid="button-institute-technology"
                        >
                          EN SAVOIR PLUS
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden hover-lift professional-shadow border-0 bg-gradient-to-br from-gray-800 to-gray-900 text-white" data-testid="card-institute-agriculture">
                  <CardContent className="p-8 h-80 flex flex-col justify-between">
                    <div className="flex-1 flex flex-col justify-center">
                      <h3 className="text-xl font-bold mb-4 text-center leading-tight" data-testid="text-institute-agriculture-title">
                        INSTITUTS DE FORMATION AGRICOLE
                      </h3>
                      <div className="w-16 h-1 bg-primary mx-auto mb-6"></div>
                    </div>
                    <div className="text-center">
                      <Link href="/filieres">
                        <Button 
                          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3"
                          data-testid="button-institute-agriculture"
                        >
                          EN SAVOIR PLUS
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-20 bg-background mobile-no-overflow">
        <div className="container mx-auto mobile-padding">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 text-foreground" data-testid="text-features-title">
              Pourquoi Nous Choisir ?
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-features-subtitle">
              Une approche moderne et professionnelle de l'enseignement entrepreneurial
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
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
      <section className="py-20 gradient-bg text-white mobile-no-overflow">
        <div className="container mx-auto mobile-padding text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6" data-testid="text-cta-title">
            Prêt à Rejoindre l'Élite de Demain ?
          </h2>
          <p className="text-lg lg:text-xl mb-8 text-white/90 max-w-2xl mx-auto" data-testid="text-cta-subtitle">
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
                className="bg-green-500 text-white hover:bg-green-600 px-8 py-4 text-lg h-auto font-semibold"
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