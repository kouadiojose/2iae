import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Loader2, Camera, Video, Image as ImageIcon } from "lucide-react";

interface Album {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  category: string;
  isActive: boolean;
  order: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

interface ApiResponse {
  success: boolean;
  albums: Album[];
}

export default function Galerie() {
  const [location] = useLocation();

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["/api/albums"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-orange-600 text-white py-20">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Galerie Photos & Vidéos
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
              Découvrez la vie de notre école à travers nos albums photos et vidéos
            </p>
          </div>
        </section>

        {/* Loading State */}
        <div className="container mx-auto px-4 py-16">
          <div className="flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-lg">Chargement des albums...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
        <section className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-orange-600 text-white py-20">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Galerie Photos & Vidéos
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
              Découvrez la vie de notre école à travers nos albums photos et vidéos
            </p>
          </div>
        </section>

        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-red-600 text-lg">
            Erreur lors du chargement des albums. Veuillez réessayer plus tard.
          </p>
        </div>
      </div>
    );
  }

  const albums = data.albums;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-orange-600 text-white py-20">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Galerie Photos & Vidéos
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
            Découvrez la vie de notre école à travers nos albums photos et vidéos
          </p>
        </div>
      </section>

      {/* Albums Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {albums.length === 0 ? (
            <div className="text-center py-16">
              <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Aucun album disponible
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Les albums seront bientôt disponibles.
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  Nos Albums
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                  Explorez nos différents albums pour découvrir la richesse de la vie étudiante et les événements marquants de notre établissement.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {albums.map((album) => (
                  <Card 
                    key={album.id} 
                    className="group hover:shadow-lg transition-shadow duration-300 overflow-hidden bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    data-testid={`card-album-${album.id}`}
                  >
                    <div className="relative aspect-video overflow-hidden">
                      {album.coverImage ? (
                        <img
                          src={album.coverImage}
                          alt={album.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          data-testid={`img-album-cover-${album.id}`}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-100 to-orange-100 dark:from-blue-900 dark:to-orange-900 flex items-center justify-center">
                          <ImageIcon className="h-16 w-16 text-gray-400" />
                        </div>
                      )}
                      
                      {/* Category Badge */}
                      <div className="absolute top-3 left-3">
                        <Badge 
                          variant="secondary" 
                          className="bg-white/90 text-gray-900"
                          data-testid={`badge-category-${album.id}`}
                        >
                          {album.category}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-6">
                      <h3 
                        className="text-xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                        data-testid={`text-album-title-${album.id}`}
                      >
                        {album.title}
                      </h3>
                      
                      {album.description && (
                        <p 
                          className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3"
                          data-testid={`text-album-description-${album.id}`}
                        >
                          {album.description}
                        </p>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(album.createdAt).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                        
                        <Link href={`/galerie/${album.id}`}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                            data-testid={`button-view-album-${album.id}`}
                          >
                            Voir l'album
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-gradient-to-r from-blue-600 to-orange-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Rejoignez notre communauté
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Découvrez tous nos programmes de formation et devenez partie intégrante de notre école d'entrepreneuriat
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/formations">
              <Button 
                size="lg" 
                className="bg-white text-blue-600 hover:bg-blue-50"
                data-testid="button-view-programs"
              >
                Découvrir nos formations
              </Button>
            </Link>
            <Link href="/contact">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white hover:text-blue-600"
                data-testid="button-contact"
              >
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}