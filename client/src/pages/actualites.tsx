import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, User, ArrowRight, Tag } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

/** Visuel de secours servi par le site, jamais par un tiers. */
const IMAGE_PAR_DEFAUT = "/api/assets/sliders/slider_1756752371617_9cvh4dv1bnj.jpg";

interface News {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  imageUrl: string | null;
  date: string;
  category: string;
  author: string;
  featured: boolean;
  isActive: boolean;
  order: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

const defaultCategories = ["Tous", "Innovation", "Formation", "Partenariats", "Événements", "Technologie", "Réussite Étudiante", "International"];

export default function ActualitesPage() {
  const [selectedCategory, setSelectedCategory] = useState("Tous");

  // Fetch news from API
  const { data: newsData, isLoading, error } = useQuery({
    queryKey: ["/api/news"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
        {/* Header Section */}
        <section className="py-20 gradient-bg text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
              Actualités & Événements
            </h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-page-subtitle">
              Suivez l'actualité de 2IAE International et découvrez nos dernières innovations pédagogiques
            </p>
          </div>
        </section>

        {/* Loading state */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 rounded w-1/4 mb-8"></div>
              <div className="h-80 bg-gray-300 rounded mb-12"></div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-64 bg-gray-300 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        {/* Header Section */}
        <section className="py-20 gradient-bg text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
              Actualités & Événements
            </h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-page-subtitle">
              Suivez l'actualité de 2IAE International et découvrez nos dernières innovations pédagogiques
            </p>
          </div>
        </section>

        {/* Error state */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-4">Erreur de chargement</h2>
            <p className="text-gray-600">Impossible de charger les actualités pour le moment.</p>
          </div>
        </section>
      </div>
    );
  }

  const news: News[] = (newsData as any)?.news || [];
  const activeNews = news.filter((item: News) => item.isActive);
  const featuredNews = activeNews.find((item: News) => item.featured);
  const regularNews = activeNews.filter((item: News) => !item.featured);

  // Get unique categories from news data
  const existingCategories = Array.from(new Set(activeNews.map((item: News) => item.category)));
  const categories = ["Tous", ...existingCategories.sort()];

  // Filter news by category
  const filteredNews = selectedCategory === "Tous" 
    ? regularNews 
    : regularNews.filter((item: News) => item.category === selectedCategory);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  /**
   * Repli quand une image ne se charge pas.
   *
   * Le repli par catégorie ne jouait que si `imageUrl` était vide. Or certaines
   * images pointent vers un site externe devenu injoignable (celle du prix
   * AfriBusiness renvoie une erreur 520) : la carte affichait alors le texte
   * de remplacement à la place du visuel. On bascule donc aussi à l'échec du
   * chargement, et une seule fois pour ne pas boucler si le repli échoue lui
   * aussi.
   */
  const surErreurImage = (
    e: React.SyntheticEvent<HTMLImageElement>,
    category: string,
  ) => {
    const img = e.currentTarget;
    if (img.dataset.repli === "2") return; // déjà au repli local : on s'arrête
    if (img.dataset.repli === "1") {
      img.dataset.repli = "2";
      img.src = IMAGE_PAR_DEFAUT;
      return;
    }
    img.dataset.repli = "1";
    img.src = getImageUrl(null, category);
  };

  // Get default image if none provided
  const getImageUrl = (imageUrl: string | null, category: string) => {
    if (imageUrl) return imageUrl;
    
    // Default images by category
    const defaultImages: { [key: string]: string } = {
      'Innovation': 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400',
      'Formation': 'https://images.unsplash.com/photo-1556761175-4b46a572b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300',
      'Partenariats': 'https://images.unsplash.com/photo-1521791136064-7986c2920216?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300',
      'Événements': 'https://images.unsplash.com/photo-1523580846011-d3982bc861b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300',
      'Technologie': 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300',
      'Réussite Étudiante': 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300',
      'International': 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300'
    };
    
    // Repli ultime servi par le site lui-même : les images de secours par
    // catégorie pointent vers un service externe, qui peut être bloqué ou
    // indisponible. Une carte sans visuel affiche alors son texte de
    // remplacement en clair, ce qui se voit immédiatement.
    return defaultImages[category] || IMAGE_PAR_DEFAUT;
  };

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Actualités & Événements
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-page-subtitle">
            Suivez l'actualité de 2IAE International et découvrez nos dernières innovations pédagogiques
          </p>
        </div>
      </section>

      {/* Featured News */}
      {featuredNews && (
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="mb-12">
              <h2 className="text-3xl font-bold mb-8" data-testid="text-featured-title">
                À la Une
              </h2>
              <Card className="overflow-hidden professional-shadow hover-lift" data-testid="card-featured-news">
                <div className="grid lg:grid-cols-2 gap-0">
                  <div className="relative">
                    <img 
                      src={getImageUrl(featuredNews.imageUrl, featuredNews.category)}
                      alt={featuredNews.title}
                      onError={(e) => surErreurImage(e, featuredNews.category)}
                      // object-contain plutôt que cover : les publications sont
                      // souvent des affiches où le taux de réussite occupe le
                      // centre. Un recadrage en bandeau coupait précisément le
                      // chiffre que l'affiche vient annoncer.
                      className="w-full h-80 lg:h-full object-contain bg-gray-50"
                      data-testid="img-featured-news"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-orange-500 hover:bg-orange-600" data-testid="badge-featured-category">
                        {featuredNews.category}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-8 flex flex-col justify-center">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1" data-testid="text-featured-date">
                        <Calendar className="h-4 w-4" />
                        {formatDate(featuredNews.date)}
                      </div>
                      <div className="flex items-center gap-1" data-testid="text-featured-author">
                        <User className="h-4 w-4" />
                        {featuredNews.author}
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-4" data-testid="text-featured-title">
                      {featuredNews.title}
                    </h3>
                    <p className="text-muted-foreground text-lg mb-6" data-testid="text-featured-summary">
                      {featuredNews.summary}
                    </p>
                    <Link href={`/actualites/${featuredNews.id}`}>
                      <Button className="w-fit bg-orange-500 hover:bg-orange-600" data-testid="button-featured-read-more">
                        Lire la suite
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </div>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Category Filter */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category: string, index: number) => (
              <Button
                key={index}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={`${
                  selectedCategory === category
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "hover:bg-orange-100"
                } transition-colors`}
                data-testid={`button-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Tag className="h-4 w-4 mr-1" />
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* News Grid */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12" data-testid="text-news-grid-title">
            {selectedCategory === "Tous" ? "Toutes les Actualités" : `Actualités - ${selectedCategory}`}
          </h2>
          
          {filteredNews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">
                Aucune actualité disponible {selectedCategory !== "Tous" && `pour la catégorie "${selectedCategory}"`}.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredNews.map((article: News) => (
                <Card key={article.id} className="overflow-hidden professional-shadow hover-lift h-full flex flex-col" data-testid={`card-news-${article.id}`}>
                  <div className="relative">
                    <img
                      src={getImageUrl(article.imageUrl, article.category)}
                      alt={article.title}
                      onError={(e) => surErreurImage(e, article.category)}
                      className="w-full h-48 object-contain bg-gray-50"
                      data-testid={`img-news-${article.id}`}
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-orange-500 hover:bg-orange-600" data-testid={`badge-news-category-${article.id}`}>
                        {article.category}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1" data-testid={`text-news-date-${article.id}`}>
                        <Calendar className="h-4 w-4" />
                        {formatDate(article.date)}
                      </div>
                      <div className="flex items-center gap-1" data-testid={`text-news-author-${article.id}`}>
                        <User className="h-4 w-4" />
                        {article.author}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-3 flex-1" data-testid={`text-news-title-${article.id}`}>
                      {article.title}
                    </h3>
                    <p className="text-muted-foreground mb-4 line-clamp-3" data-testid={`text-news-summary-${article.id}`}>
                      {article.summary || "Découvrez cette actualité importante de 2IAE International."}
                    </p>
                    <Link href={`/actualites/${article.slug}`}>
                      <Button variant="outline" className="w-full mt-auto hover:bg-orange-100" data-testid={`button-news-read-more-${article.id}`}>
                        Lire la suite
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Rejoignez l'Excellence Entrepreneuriale
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
            Découvrez nos programmes de formation et devenez l'entrepreneur de demain
          </p>
          <Link href="/filieres">
            <Button size="lg" className="bg-white text-primary hover:bg-gray-100" data-testid="button-cta-programs">
              Découvrir nos formations
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}