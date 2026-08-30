import { useState, useEffect } from "react";
import { usePageMeta } from "@/lib/seo";
import { ChevronLeft, ChevronRight, Play, Calendar, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { imageActualite, IMAGE_PAR_DEFAUT } from "@/lib/imageActualite";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useQuery } from "@tanstack/react-query";
import { type Slider, type FounderMessage, type Institute } from "@shared/schema";
import { VideoYoutube } from "@/components/video-youtube";

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
    title: "La ferme-école d'Azaguié",
    description:
      "Parcelles expérimentales, élevages, étang piscicole : les étudiants produisent et commercialisent réellement.",
    icon: "🌾"
  },
  {
    title: "Les chantiers-écoles",
    description:
      "Génie civil et filières industrielles : de vrais ouvrages, menés par les étudiants sous encadrement professionnel.",
    icon: "🏗️"
  },
  {
    title: "Le projet d'entreprise",
    description:
      "Chaque étudiant construit et soutient un projet de création d'entreprise, accompagné de l'idée au plan d'affaires.",
    icon: "🚀"
  },
  {
    title: "Le réseau pour se lancer",
    description:
      "Anciens, partenaires et programmes d'insertion (OIM, Union européenne, Agence Emploi Jeunes) pour passer du diplôme à l'activité.",
    icon: "🤝"
  }
];

const parcoursAdmission = [
  {
    n: "01",
    titre: "Préinscription en ligne",
    texte:
      "Identité, contact et filière souhaitée. Aucun document requis à cette étape.",
  },
  {
    n: "02",
    titre: "Entretien d'orientation",
    texte:
      "Un conseiller vous rappelle rapidement pour valider votre projet et votre filière, sur campus ou par téléphone.",
  },
  {
    n: "03",
    titre: "Dépôt du dossier",
    texte:
      "Relevé de notes, extrait de naissance, photos d'identité. Dépôt sur le campus de votre choix.",
  },
  {
    n: "04",
    titre: "Inscription & rentrée",
    texte:
      "Confirmation de votre place, options internat, et accueil de rentrée sur votre campus.",
  },
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
  usePageMeta(
    "Groupe 2IAE International — Grande École en Côte d'Ivoire | L'École des Entrepreneurs",
    "Grande école de référence en Côte d'Ivoire depuis 2006 : 67,38 % d'admis au BTS 2026, 5 campus avec internat, ferme-école, entrepreneuriat pour tous. Préinscriptions ouvertes.",
    '/',
  );

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

  // Fond du hero : une photo fixe sous le voile blanc → orange.
  // Le campus verdoyant d'Azaguié, palmiers et étudiants en orange.
  const heroImage = "/images/campus-azaguie-palmiers.jpg";

  return (
    <div className="min-h-screen mobile-safe">
      {/* Hero éditorial — photo fixe en filigrane sous un voile blanc → orange léger */}
      <section className="relative overflow-hidden mobile-no-overflow">
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-[center_55%]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(95deg, rgba(255,255,255,0.95) 0%, rgba(255,251,246,0.88) 38%, rgba(255,245,233,0.55) 62%, rgba(255,240,224,0.22) 82%, rgba(232,114,12,0.18) 100%)",
          }}
        />
        <div className="relative container mx-auto mobile-padding py-20 lg:py-28">
          <p className="text-xs sm:text-sm tracking-[0.25em] uppercase text-[#E8720C] mb-6" data-testid="text-hero-kicker">
            Grande école · Côte d'Ivoire · Depuis 2006
          </p>
          <h1
            className="font-serif text-4xl sm:text-5xl lg:text-7xl leading-[1.05] max-w-4xl text-[#1a1815]"
            data-testid="text-hero-title"
          >
            L'exigence forme les cadres.
            <br />
            <span className="text-[#E8720C]">L'audace forme les entrepreneurs.</span>
          </h1>
          <p className="mt-6 text-lg lg:text-xl text-[#3d382f] max-w-2xl">
            BTS, licences et certificats sur cinq campus. Ferme-école,
            chantiers-écoles, internats : ici, on apprend un métier en le
            pratiquant — et on apprend à créer son emploi.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link href="/preinscription">
              <Button
                className="bg-[#E8720C] hover:bg-[#c96208] text-white px-8 py-4 text-lg h-auto font-bold w-full sm:w-auto shadow-lg"
                data-testid="button-hero-preinscription"
              >
                Se préinscrire
              </Button>
            </Link>
            <Link href="/filieres">
              <Button
                variant="outline"
                className="border-[#1a1815]/40 text-[#1a1815] bg-white/70 hover:bg-white px-8 py-4 text-lg h-auto font-semibold w-full sm:w-auto"
                data-testid="button-hero-filieres"
              >
                Les filières
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Le spot de la rentrée — visible dès l'arrivée, juste sous le hero */}
      <section className="bg-[#1a1815] mobile-no-overflow">
        <div className="container mx-auto mobile-padding py-12 lg:py-16">
          <div className="text-center mb-8">
            <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-3">
              À voir · Rentrée 2026-2027
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white">
              Comment choisir une école d'excellence ?
            </h2>
            <p className="text-white/70 mt-3 max-w-2xl mx-auto">
              64 secondes pour comprendre ce qui fait la différence — activez
              le son 🔊
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <div className="rounded-xl overflow-hidden shadow-2xl ring-4 ring-[#E8720C]/60">
              <video
                className="w-full h-auto block bg-black"
                src="/videos/spot-rentree.mp4"
                poster="/videos/spot-rentree-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                controls
                preload="metadata"
                data-testid="video-spot-rentree"
              />
              <p className="bg-black/80 text-white/90 text-sm px-4 py-3">
                Comment choisir une école d'excellence ?
              </p>
            </div>
            <div className="rounded-xl overflow-hidden shadow-2xl ring-4 ring-[#E8720C]/60">
              <video
                className="w-full h-auto block bg-black"
                src="/videos/spot-20-ans.mp4"
                poster="/videos/spot-20-ans-poster.jpg"
                playsInline
                controls
                preload="metadata"
                data-testid="video-spot-20-ans"
              />
              <p className="bg-black/80 text-white/90 text-sm px-4 py-3">
                20 ans au service de la Nation — le film du groupe
              </p>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link href="/preinscription">
              <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white px-8 py-3 h-auto font-bold">
                Je choisis 2IAE — je me préinscris
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Résultats BTS 2026 — l'affiche officielle et les preuves */}
      <section className="bg-background border-b border-border mobile-no-overflow">
        <div className="container mx-auto mobile-padding py-14 grid lg:grid-cols-2 gap-10 items-center">
          <div className="order-2 lg:order-1">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">
              Résultats · BTS 2026 · 20 ans au service de l'excellence
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-6">
              67,38 % d'admis. La preuve que l'exigence paie.
            </h2>
            <div className="grid grid-cols-2 gap-6">
              {[
                ["83,54 %", "d'admis à 2IAE Azaguié — le campus de l'Université de l'Entrepreneuriat"],
                ["67,38 %", "taux global de nos écoles, contre 42,48 % au niveau national"],
                ["100 %", "de stages garantis pour nos étudiants"],
                ["+80 %", "des diplômés insérés dans l'emploi"],
              ].map(([n, l]) => (
                <div key={l}>
                  <p className="font-serif text-3xl lg:text-4xl font-semibold text-primary">{n}</p>
                  <p className="text-sm text-muted-foreground mt-1">{l}</p>
                </div>
              ))}
            </div>
            <Link href="/preinscription">
              <Button className="mt-8 bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto">
                Rejoindre une école qui prouve ses résultats
              </Button>
            </Link>
          </div>
          <div className="order-1 lg:order-2">
            <img
              src="/images/resultats-bts-2026.jpg"
              alt="Résultats provisoires BTS 2026 du Groupe 2IAE : Azaguié 83,54 %, Yamoussoukro 68,18 %, Yopougon 64,13 %, Palmeraie 58,40 % — taux global 67,38 % contre 42,48 % au national"
              loading="lazy"
              className="w-full max-w-xl mx-auto rounded-xl professional-shadow"
              data-testid="img-resultats-2026"
            />
          </div>
        </div>
      </section>

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
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">
              Entrepreneuriat & pédagogie par la pratique
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl mb-4 text-foreground" data-testid="text-features-title">
              On n'enseigne pas l'entreprise. On la fait vivre.
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-features-subtitle">
              Tout étudiant 2IAE, quelle que soit sa filière, suit un parcours
              de création d'entreprise et apprend son métier en conditions
              réelles.
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

      {/* Parcours d'admission */}
      <section className="py-20 bg-background mobile-no-overflow">
        <div className="container mx-auto mobile-padding">
          <div className="text-center mb-14">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">
              Admissions · Rentrée 2026-2027
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground">
              Votre préinscription en cinq minutes.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {parcoursAdmission.map((e) => (
              <div key={e.n} className="relative">
                <p className="font-serif text-5xl text-primary/30 font-semibold">{e.n}</p>
                <h3 className="text-lg font-bold text-foreground mt-2">{e.titre}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{e.texte}</p>
              </div>
            ))}
          </div>
          <div className="max-w-3xl mx-auto mt-12 bg-muted rounded-xl p-6 text-center">
            <p className="font-semibold text-foreground">Étudiants orientés par l'État</p>
            <p className="text-muted-foreground text-sm mt-1">
              2IAE accueille les bacheliers orientés par la Direction de
              l'Orientation et des Bourses : votre affectation vaut
              préinscription, contactez directement votre campus.
            </p>
          </div>
          <div className="text-center mt-10">
            <Link href="/preinscription">
              <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white px-10 py-4 text-lg h-auto font-bold">
                Commencer ma préinscription
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Internat */}
      <section className="gradient-bg text-white mobile-no-overflow">
        <div className="container mx-auto mobile-padding py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-3">
              L'internat 2IAE
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight">
              Étudier, dormir, réussir — au même endroit.
            </h2>
            <p className="text-white/85 text-lg leading-relaxed mt-6">
              Chambres encadrées, restauration, études surveillées le soir.
              L'internat de l'Université de l'Entrepreneuriat d'Azaguié offre
              aux étudiants venus de toute la Côte d'Ivoire un cadre sûr,
              propice au travail — et rassurant pour les parents.
            </p>
            <Link href="/preinscription">
              <Button className="mt-6 bg-white text-[#1a1815] hover:bg-white/90 font-bold px-8 py-3 h-auto">
                Demander une place
              </Button>
            </Link>
          </div>
          <img
            src="/images/internat-triptyque.jpg"
            alt="L'internat 2IAE : salle de classe équipée, dortoirs, et la cour intérieure du campus"
            loading="lazy"
            className="w-full max-w-md mx-auto rounded-xl shadow-2xl"
            data-testid="img-internat"
          />
        </div>
      </section>

      {/* Partenaires de confiance */}
      <section className="py-16 bg-background mobile-no-overflow">
        <div className="container mx-auto mobile-padding">
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-8 text-center">
            Ils nous font confiance
          </p>
          <div className="grid sm:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              ["OIM — Nations Unies", "Partenaire des programmes de réinsertion : formation pratique de centaines de migrants de retour, sur le campus d'Azaguié."],
              ["Union européenne", "Programmes de formation et d'insertion professionnelle pour les jeunes."],
              ["Agence Emploi Jeunes", "Plus de 500 jeunes formés et insérés dans le bâtiment et l'agriculture."],
            ].map(([t, d]) => (
              <Card key={t} className="professional-shadow border-0">
                <CardContent className="p-6">
                  <h3 className="font-bold text-foreground">{t}</h3>
                  <p className="text-muted-foreground text-sm mt-2">{d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Témoignages vidéo — de vrais étudiants */}
      <section className="py-20 bg-muted mobile-no-overflow">
        <div className="container mx-auto mobile-padding">
          <div className="text-center mb-12">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">
              Résultats & réussite
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground">
              Les chiffres parlent. Nos étudiants aussi.
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            <VideoYoutube id="OaseOLm8en4" titre="Témoignage étudiants 2IAE — la pratique" />
            <VideoYoutube id="k_nQqttfZJA" titre="Tout le monde a sa place au Groupe 2IAE" />
            <VideoYoutube id="FnnI71-42xQ" titre="Témoignage des étudiants admissibles au BTS" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 text-white mobile-no-overflow overflow-hidden">
        <img
          src="/images/etudiants-evenement.jpg"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#1a1815]/80" />
        <div className="relative container mx-auto mobile-padding text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6" data-testid="text-cta-title">
            Écrivez la prochaine réussite.
          </h2>
          <p className="text-lg lg:text-xl mb-8 text-white/90 max-w-2xl mx-auto" data-testid="text-cta-subtitle">
            La préinscription prend cinq minutes, elle est gratuite et sans
            engagement — un conseiller vous rappelle pour la suite.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/preinscription">
              <Button
                className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg h-auto font-semibold"
                data-testid="button-cta-contact"
              >
                Se préinscrire
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