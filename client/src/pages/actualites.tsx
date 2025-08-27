import { Calendar, User, ArrowRight, Tag } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const featuredNews = {
  id: 1,
  title: "2IAE International Ouvre Son Centre d'Incubation d'Entreprises",
  summary: "Un nouveau centre d'incubation de 500m² pour accompagner les jeunes entrepreneurs dans la création et le développement de leurs startups.",
  image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
  date: "15 Mars 2024",
  category: "Innovation",
  author: "Direction 2IAE",
  featured: true
};

const news = [
  {
    id: 2,
    title: "Partenariat Stratégique avec 5 Nouvelles Entreprises",
    summary: "Extension de notre réseau de partenaires pour offrir plus d'opportunités de stages et d'emplois à nos étudiants.",
    image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    date: "8 Mars 2024",
    category: "Partenariats",
    author: "Service Relations Entreprises"
  },
  {
    id: 3,
    title: "Lancement du Programme Executive MBA",
    summary: "Nouveau programme destiné aux cadres supérieurs souhaitant développer leurs compétences en leadership entrepreneurial.",
    image: "https://images.unsplash.com/photo-1556761175-4b46a572b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    date: "1 Mars 2024",
    category: "Formation",
    author: "Direction Pédagogique"
  },
  {
    id: 4,
    title: "Journée Portes Ouvertes : Plus de 300 Visiteurs",
    summary: "Grand succès de notre journée portes ouvertes avec des témoignages inspirants d'anciens étudiants devenus entrepreneurs.",
    image: "https://images.unsplash.com/photo-1523580846011-d3982bc861b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    date: "25 Février 2024",
    category: "Événements",
    author: "Service Communication"
  },
  {
    id: 5,
    title: "Digitalisation Complète des Cours",
    summary: "Mise en place d'une plateforme d'apprentissage en ligne moderne pour compléter l'enseignement présentiel.",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    date: "20 Février 2024",
    category: "Technologie",
    author: "Direction Technique"
  },
  {
    id: 6,
    title: "Concours d'Innovation : 1er Prix à un Étudiant 2IAE",
    summary: "Victoire remarquable de notre étudiant au concours national d'innovation avec son projet de fintech.",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    date: "15 Février 2024",
    category: "Réussite Étudiante",
    author: "Service Étudiants"
  },
  {
    id: 7,
    title: "Signature d'un Accord avec l'Université de Sherbrooke",
    summary: "Renouvellement et extension de notre partenariat stratégique avec l'université canadienne pour 5 années supplémentaires.",
    image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    date: "10 Février 2024",
    category: "International",
    author: "Direction Générale"
  }
];

const categories = ["Tous", "Innovation", "Formation", "Partenariats", "Événements", "Technologie", "Réussite Étudiante", "International"];

export default function ActualitesPage() {
  return (
    <div className="min-h-screen pt-20">
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
                    src={featuredNews.image}
                    alt={featuredNews.title}
                    className="w-full h-80 lg:h-full object-cover"
                    data-testid="img-featured-news"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-primary text-primary-foreground" data-testid="badge-featured-category">
                      {featuredNews.category}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-8 lg:p-12 flex flex-col justify-center">
                  <h3 className="text-3xl font-bold mb-4" data-testid="text-featured-title">
                    {featuredNews.title}
                  </h3>
                  <p className="text-lg text-muted-foreground mb-6" data-testid="text-featured-summary">
                    {featuredNews.summary}
                  </p>
                  <div className="flex items-center text-muted-foreground text-sm mb-6 space-x-4">
                    <div className="flex items-center" data-testid="featured-date">
                      <Calendar className="h-4 w-4 mr-2" />
                      {featuredNews.date}
                    </div>
                    <div className="flex items-center" data-testid="featured-author">
                      <User className="h-4 w-4 mr-2" />
                      {featuredNews.author}
                    </div>
                  </div>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-fit" data-testid="button-featured-read-more">
                    Lire la Suite
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* News Grid */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-2 mb-12" data-testid="categories-filter">
            {categories.map((category, index) => (
              <Badge 
                key={index}
                variant={index === 0 ? "default" : "outline"}
                className={`cursor-pointer hover:bg-primary hover:text-primary-foreground ${
                  index === 0 ? "bg-primary text-primary-foreground" : ""
                }`}
                data-testid={`badge-category-${index}`}
              >
                {category}
              </Badge>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {news.map((article) => (
              <Card key={article.id} className="overflow-hidden hover-lift professional-shadow" data-testid={`card-news-${article.id}`}>
                <div className="relative">
                  <img 
                    src={article.image}
                    alt={article.title}
                    className="w-full h-48 object-cover"
                    data-testid={`img-news-${article.id}`}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge 
                      className={`${
                        article.category === "Innovation" ? "bg-primary text-primary-foreground" :
                        article.category === "Formation" ? "bg-secondary text-secondary-foreground" :
                        article.category === "Partenariats" ? "bg-accent text-accent-foreground" :
                        "bg-muted text-muted-foreground"
                      }`}
                      data-testid={`badge-news-category-${article.id}`}
                    >
                      {article.category}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-3 line-clamp-2" data-testid={`text-news-title-${article.id}`}>
                    {article.title}
                  </h3>
                  <p className="text-muted-foreground mb-4 line-clamp-3" data-testid={`text-news-summary-${article.id}`}>
                    {article.summary}
                  </p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <div className="flex items-center" data-testid={`news-date-${article.id}`}>
                      <Calendar className="h-4 w-4 mr-2" />
                      {article.date}
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground mb-4" data-testid={`news-author-${article.id}`}>
                    <User className="h-4 w-4 mr-2" />
                    {article.author}
                  </div>
                  <Button variant="outline" className="w-full" data-testid={`button-news-read-more-${article.id}`}>
                    Lire Plus
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Subscription */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6" data-testid="text-newsletter-title">
            Restez Informé
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto" data-testid="text-newsletter-subtitle">
            Abonnez-vous à notre newsletter pour recevoir les dernières actualités de 2IAE International
          </p>
          <div className="max-w-md mx-auto flex gap-4">
            <input 
              type="email"
              placeholder="Votre adresse email"
              className="flex-1 px-4 py-3 rounded-lg text-foreground"
              data-testid="input-newsletter-email"
            />
            <Button 
              className="bg-white text-primary hover:bg-white/90 px-6"
              data-testid="button-newsletter-subscribe"
            >
              S'Abonner
            </Button>
          </div>
        </div>
      </section>

      {/* Events Preview */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4" data-testid="text-events-title">
              Événements à Venir
            </h2>
            <p className="text-xl text-muted-foreground" data-testid="text-events-subtitle">
              Ne manquez pas nos prochains événements et rencontres
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center hover-lift professional-shadow" data-testid="card-event-1">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2" data-testid="text-event-title-1">
                  Journée Portes Ouvertes
                </h3>
                <p className="text-muted-foreground mb-4" data-testid="text-event-date-1">
                  25 Avril 2024
                </p>
                <p className="text-muted-foreground" data-testid="text-event-description-1">
                  Découvrez nos programmes et rencontrez nos équipes pédagogiques
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover-lift professional-shadow" data-testid="card-event-2">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <User className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-xl font-bold mb-2" data-testid="text-event-title-2">
                  Conférence Entrepreneuriat
                </h3>
                <p className="text-muted-foreground mb-4" data-testid="text-event-date-2">
                  15 Mai 2024
                </p>
                <p className="text-muted-foreground" data-testid="text-event-description-2">
                  Rencontre avec des entrepreneurs à succès et anciens diplômés
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover-lift professional-shadow" data-testid="card-event-3">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Tag className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2" data-testid="text-event-title-3">
                  Forum Emploi & Stages
                </h3>
                <p className="text-muted-foreground mb-4" data-testid="text-event-date-3">
                  30 Mai 2024
                </p>
                <p className="text-muted-foreground" data-testid="text-event-description-3">
                  Rencontrez nos entreprises partenaires et trouvez votre stage
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}