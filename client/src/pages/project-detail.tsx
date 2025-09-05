import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useLocation } from "wouter";
import { Calendar, ArrowLeft, Camera, Play, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type Project } from "@shared/schema";

export default function ProjectDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const projectId = params.id;

  // Fetch project details
  const { data: projectData, isLoading, error } = useQuery({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
        {/* Loading Hero */}
        <section className="py-20 gradient-bg text-white">
          <div className="container mx-auto px-4">
            <div className="animate-pulse">
              <div className="h-8 bg-white/20 rounded w-32 mb-6"></div>
              <div className="h-12 bg-white/20 rounded w-3/4 mb-4"></div>
              <div className="h-6 bg-white/20 rounded w-1/2"></div>
            </div>
          </div>
        </section>

        {/* Loading Content */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="animate-pulse space-y-8">
              <div className="h-64 bg-gray-300 rounded-lg"></div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-300 rounded w-full"></div>
                <div className="h-4 bg-gray-300 rounded w-5/6"></div>
                <div className="h-4 bg-gray-300 rounded w-4/6"></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (error || !(projectData as { project: Project })?.project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
        {/* Error Hero */}
        <section className="py-20 gradient-bg text-white">
          <div className="container mx-auto px-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/cabinet")}
              className="text-white hover:bg-white/10 mb-6"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux projets
            </Button>
            <h1 className="text-4xl font-bold mb-4">Projet non trouvé</h1>
            <p className="text-xl text-white/90">
              Le projet que vous recherchez n'existe pas ou n'est plus disponible.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const project: Project = (projectData as { project: Project }).project;

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long', 
      year: 'numeric'
    });
  };

  // Helper function to get status info
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

  const statusInfo = getStatusInfo(project.status);
  const StatusIcon = statusInfo.icon;
  const images = Array.isArray(project.images) ? project.images as string[] : [];
  const videos = Array.isArray(project.videos) ? project.videos as string[] : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Hero Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/cabinet")}
            className="text-white hover:bg-white/10 mb-6"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux projets
          </Button>

          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-4">
              <Badge variant={statusInfo.variant} className="bg-white/10 text-white border-white/20">
                <StatusIcon className="w-4 h-4 mr-2" />
                {statusInfo.text}
              </Badge>
              {images.length > 0 && (
                <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
                  <Camera className="w-3 h-3 mr-1" />
                  {images.length} {images.length > 1 ? 'images' : 'image'}
                </Badge>
              )}
              {videos.length > 0 && (
                <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
                  <Play className="w-3 h-3 mr-1" />
                  {videos.length} {videos.length > 1 ? 'vidéos' : 'vidéo'}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6" data-testid="text-project-title">
              {project.title}
            </h1>

            <div className="flex items-center gap-6 text-white/90">
              {project.startDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span data-testid="text-start-date">
                    Début: {formatDate(project.startDate.toString())}
                  </span>
                </div>
              )}
              {project.endDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span data-testid="text-end-date">
                    Fin: {formatDate(project.endDate.toString())}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Main Content Column */}
            <div className="lg:col-span-2 space-y-8">
              {/* Project Description */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Description du projet</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-lg leading-relaxed text-gray-700" data-testid="text-project-description">
                      {project.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Images Gallery */}
              {images.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Galerie d'images ({images.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      {images.map((imageUrl, index) => (
                        <div 
                          key={index} 
                          className="relative aspect-video rounded-lg overflow-hidden bg-gray-100"
                          data-testid={`img-gallery-${index}`}
                        >
                          <img
                            src={imageUrl}
                            alt={`${project.title} - Image ${index + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Videos Section */}
              {videos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="w-5 h-5" />
                      Vidéos ({videos.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {videos.map((videoUrl, index) => (
                        <div 
                          key={index} 
                          className="relative aspect-video rounded-lg overflow-hidden bg-gray-100"
                          data-testid={`video-${index}`}
                        >
                          <video
                            src={videoUrl}
                            controls
                            className="w-full h-full object-cover"
                            aria-label={`${project.title} - Vidéo ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Project Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Statut</span>
                    <Badge variant={statusInfo.variant}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusInfo.text}
                    </Badge>
                  </div>

                  {project.startDate && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Date de début</span>
                        <span className="font-medium" data-testid="text-sidebar-start-date">
                          {formatDate(project.startDate.toString())}
                        </span>
                      </div>
                    </>
                  )}

                  {project.endDate && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Date de fin</span>
                        <span className="font-medium" data-testid="text-sidebar-end-date">
                          {formatDate(project.endDate.toString())}
                        </span>
                      </div>
                    </>
                  )}

                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Images</span>
                    <span className="font-medium">{images.length}</span>
                  </div>

                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Vidéos</span>
                    <span className="font-medium">{videos.length}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Contact CTA */}
              <Card className="bg-gradient-to-br from-orange-50 to-green-50 border-orange-200">
                <CardHeader>
                  <CardTitle className="text-orange-800">Intéressé par ce projet ?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4 text-sm">
                    Contactez-nous pour en savoir plus sur ce projet ou pour discuter d'une collaboration.
                  </p>
                  <Button asChild className="w-full bg-orange-600 hover:bg-orange-700" data-testid="button-contact">
                    <a href="/contact">
                      Nous contacter
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* Back to Projects */}
              <Card>
                <CardContent className="pt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setLocation("/cabinet")}
                    className="w-full"
                    data-testid="button-back-sidebar"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voir tous les projets
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}