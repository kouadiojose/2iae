import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Calendar, ExternalLink, Play, Camera, Eye, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Project } from "@shared/schema";

export default function CabinetPage() {
  const [selectedStatus, setSelectedStatus] = useState<"all" | "upcoming" | "completed">("all");
  const [, setLocation] = useLocation();

  // Fetch projects from API
  const { data: projectsData, isLoading, error } = useQuery({
    queryKey: ["/api/projects"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
        {/* Header Section */}
        <section className="py-20 gradient-bg text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
              Cabinet 2IAE
            </h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-page-subtitle">
              Découvrez nos projets en cours et nos réalisations qui transforment l'écosystème entrepreneurial en Côte d'Ivoire
            </p>
          </div>
        </section>

        {/* Loading state */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 rounded w-1/4 mb-8"></div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-80 bg-gray-300 rounded"></div>
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
              Cabinet 2IAE
            </h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-page-subtitle">
              Découvrez nos projets en cours et nos réalisations qui transforment l'écosystème entrepreneurial en Côte d'Ivoire
            </p>
          </div>
        </section>

        {/* Error state */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto">
              <p className="text-red-600 mb-4" data-testid="text-error-message">
                Erreur lors du chargement des projets
              </p>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
                data-testid="button-retry"
              >
                Réessayer
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const projects: Project[] = (projectsData as any)?.projects || [];

  // Filter projects based on selected status
  const filteredProjects = projects.filter(project => {
    if (selectedStatus === "all") return true;
    return project.status === selectedStatus;
  });

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long', 
      year: 'numeric'
    });
  };

  // Helper function to get status badge variant and text
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'upcoming':
        return { 
          variant: 'secondary' as const, 
          text: 'À venir', 
          icon: Clock,
          color: 'text-orange-600'
        };
      case 'completed':
        return { 
          variant: 'default' as const, 
          text: 'Terminé', 
          icon: CheckCircle,
          color: 'text-green-600'
        };
      default:
        return { 
          variant: 'outline' as const, 
          text: status, 
          icon: Clock,
          color: 'text-gray-600'
        };
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 bg-white/20 text-white border-white/30" data-testid="badge-section">
            Innovation & Impact
          </Badge>
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Cabinet 2IAE
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-page-subtitle">
            Découvrez nos projets en cours et nos réalisations qui transforment l'écosystème entrepreneurial en Côte d'Ivoire
          </p>
        </div>
      </section>

      {/* Projects Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-4 mb-12 justify-center">
            <Button
              onClick={() => setSelectedStatus("all")}
              variant={selectedStatus === "all" ? "default" : "outline"}
              className="flex items-center gap-2"
              data-testid="button-filter-all"
            >
              <Eye className="w-4 h-4" />
              Tous les projets
            </Button>
            <Button
              onClick={() => setSelectedStatus("upcoming")}
              variant={selectedStatus === "upcoming" ? "default" : "outline"}
              className="flex items-center gap-2"
              data-testid="button-filter-upcoming"
            >
              <Clock className="w-4 h-4" />
              Projets à venir
            </Button>
            <Button
              onClick={() => setSelectedStatus("completed")}
              variant={selectedStatus === "completed" ? "default" : "outline"}
              className="flex items-center gap-2"
              data-testid="button-filter-completed"
            >
              <CheckCircle className="w-4 h-4" />
              Projets terminés
            </Button>
          </div>

          {/* Projects Grid */}
          {filteredProjects.length === 0 ? (
            <div className="text-center py-20">
              <h3 className="text-2xl font-semibold text-gray-600 mb-4" data-testid="text-no-projects">
                Aucun projet disponible
              </h3>
              <p className="text-gray-500" data-testid="text-no-projects-description">
                {selectedStatus === "all" 
                  ? "Aucun projet n'est actuellement disponible."
                  : `Aucun projet ${selectedStatus === "upcoming" ? "à venir" : "terminé"} pour le moment.`
                }
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProjects.map((project) => {
                const statusInfo = getStatusInfo(project.status);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <Card 
                    key={project.id} 
                    className="overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                    onClick={() => setLocation(`/cabinet/${project.id}`)}
                    data-testid={`card-project-${project.id}`}
                  >
                    <CardHeader className="p-0">
                      {/* Project main image */}
                      {project.images && Array.isArray(project.images) && project.images.length > 0 ? (
                        <div className="relative h-48 bg-gray-100">
                          <img
                            src={Array.isArray(project.images) ? project.images[0] as string : ''}
                            alt={project.title}
                            className="w-full h-full object-cover"
                            data-testid={`img-project-${project.id}`}
                          />
                          {/* Status badge overlay */}
                          <div className="absolute top-3 left-3">
                            <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.text}
                            </Badge>
                          </div>
                          {/* Media indicators */}
                          <div className="absolute bottom-3 right-3 flex gap-2">
                            {Array.isArray(project.images) && project.images.length > 1 && (
                              <Badge variant="secondary" className="bg-black/70 text-white border-0">
                                <Camera className="w-3 h-3 mr-1" />
                                {project.images.length}
                              </Badge>
                            )}
                            {Array.isArray(project.videos) && project.videos.length > 0 && (
                              <Badge variant="secondary" className="bg-black/70 text-white border-0">
                                <Play className="w-3 h-3 mr-1" />
                                {project.videos.length}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-48 bg-gradient-to-br from-orange-100 to-green-100 flex items-center justify-center">
                          <div className="text-center">
                            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">Aucune image</p>
                          </div>
                        </div>
                      )}
                    </CardHeader>
                    
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                        <Badge variant={statusInfo.variant} data-testid={`badge-status-${project.id}`}>
                          {statusInfo.text}
                        </Badge>
                      </div>
                      
                      <h3 className="text-xl font-semibold mb-3 line-clamp-2" data-testid={`text-title-${project.id}`}>
                        {project.title}
                      </h3>
                      
                      <p className="text-gray-600 mb-4 line-clamp-3" data-testid={`text-description-${project.id}`}>
                        {project.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span data-testid={`text-date-${project.id}`}>
                            {project.status === 'upcoming' && project.startDate
                              ? formatDate(project.startDate.toString())
                              : project.status === 'completed' && project.endDate
                              ? formatDate(project.endDate.toString())
                              : 'Date non définie'
                            }
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="p-2 h-auto text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/cabinet/${project.id}`);
                            }}
                            data-testid={`button-view-${project.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {(project as any).link && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="p-2 h-auto"
                              onClick={(e) => e.stopPropagation()}
                              asChild
                              data-testid={`button-link-${project.id}`}
                            >
                              <a 
                                href={(project as any).link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                aria-label={`Voir le lien du projet ${project.title}`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-20 bg-gradient-to-br from-orange-50 to-green-50">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 bg-orange-100 text-orange-800 border-orange-200" data-testid="badge-cta">
            Rejoignez-nous
          </Badge>
          <h2 className="text-3xl font-bold mb-6" data-testid="text-cta-title">
            Participez à nos projets futurs
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8" data-testid="text-cta-description">
            Vous avez un projet innovant ou souhaitez collaborer avec le Cabinet 2IAE ? 
            Contactez-nous pour explorer les possibilités de partenariat.
          </p>
          <Button asChild size="lg" data-testid="button-contact">
            <a href="/contact">Nous contacter</a>
          </Button>
        </div>
      </section>
    </div>
  );
}