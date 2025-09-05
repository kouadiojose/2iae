import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Image as ImageIcon, Play, Calendar, Grid, Eye } from "lucide-react";
import { useState } from "react";

interface GalleryItem {
  id: string;
  albumId: string;
  title: string | null;
  description: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl: string | null;
  isActive: boolean;
  order: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

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
  items: GalleryItem[];
}

interface ApiResponse {
  success: boolean;
  album: Album;
}

export default function AlbumDetail() {
  const [match, params] = useRoute("/galerie/:id");
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["/api/albums", params?.id],
    enabled: !!params?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-16">
          <div className="flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-lg">Chargement de l'album...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Album non trouvé
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            L'album que vous recherchez n'existe pas ou a été supprimé.
          </p>
          <Link href="/galerie">
            <Button data-testid="button-back-gallery">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la galerie
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const album = data.album;
  const items = album.items || [];

  const openModal = (item: GalleryItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header Section */}
      <section className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-orange-600 text-white py-16">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link href="/galerie">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-white/20 hover:text-white"
                data-testid="button-breadcrumb-gallery"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour à la galerie
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Album Info */}
            <div>
              <Badge 
                variant="secondary" 
                className="bg-white/90 text-gray-900 mb-4"
                data-testid="badge-album-category"
              >
                {album.category}
              </Badge>
              <h1 
                className="text-4xl md:text-5xl font-bold mb-4"
                data-testid="text-album-title"
              >
                {album.title}
              </h1>
              {album.description && (
                <p 
                  className="text-xl text-blue-100 mb-4"
                  data-testid="text-album-description"
                >
                  {album.description}
                </p>
              )}
              <div className="flex items-center gap-6 text-blue-100">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date(album.createdAt).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Grid className="h-4 w-4" />
                  <span>{items.length} élément{items.length > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {/* Cover Image */}
            <div className="relative aspect-video overflow-hidden rounded-lg shadow-xl">
              {album.coverImage ? (
                <img
                  src={album.coverImage}
                  alt={album.title}
                  className="w-full h-full object-cover"
                  data-testid="img-album-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                  <ImageIcon className="h-16 w-16 text-white/60" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Aucun média dans cet album
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Cet album ne contient pas encore de photos ou vidéos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {items.map((item) => (
                <Card 
                  key={item.id} 
                  className="group cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  onClick={() => openModal(item)}
                  data-testid={`card-gallery-item-${item.id}`}
                >
                  <div className="relative aspect-square overflow-hidden">
                    {item.mediaType === "video" ? (
                      <div className="relative">
                        <img
                          src={item.thumbnailUrl || item.mediaUrl}
                          alt={item.title || "Vidéo"}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          data-testid={`img-video-thumbnail-${item.id}`}
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <div className="bg-white/90 rounded-full p-3">
                            <Play className="h-6 w-6 text-gray-900" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={item.mediaUrl}
                        alt={item.title || "Image"}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        data-testid={`img-gallery-image-${item.id}`}
                      />
                    )}
                    
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="text-white text-center">
                        <Eye className="h-6 w-6 mx-auto mb-1" />
                        <span className="text-sm">Voir</span>
                      </div>
                    </div>
                    
                    {/* Media Type Badge */}
                    <div className="absolute top-2 right-2">
                      <Badge 
                        variant="secondary" 
                        className="bg-black/50 text-white border-0"
                        data-testid={`badge-media-type-${item.id}`}
                      >
                        {item.mediaType === "video" ? "Vidéo" : "Photo"}
                      </Badge>
                    </div>
                  </div>

                  {item.title && (
                    <CardContent className="p-3">
                      <h4 
                        className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2"
                        data-testid={`text-item-title-${item.id}`}
                      >
                        {item.title}
                      </h4>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Modal for viewing media */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent 
          className="max-w-4xl w-full max-h-[90vh] p-0 overflow-hidden"
          data-testid="dialog-media-viewer"
        >
          {selectedItem && (
            <div className="relative">
              <div className="relative">
                {selectedItem.mediaType === "video" ? (
                  <video
                    src={selectedItem.mediaUrl}
                    controls
                    className="w-full h-auto max-h-[70vh] object-contain"
                    data-testid="video-player"
                  />
                ) : (
                  <img
                    src={selectedItem.mediaUrl}
                    alt={selectedItem.title || "Image"}
                    className="w-full h-auto max-h-[70vh] object-contain"
                    data-testid="img-modal-viewer"
                  />
                )}
              </div>
              
              {(selectedItem.title || selectedItem.description) && (
                <div className="p-6 bg-white dark:bg-gray-800">
                  {selectedItem.title && (
                    <h3 
                      className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                      data-testid="text-modal-title"
                    >
                      {selectedItem.title}
                    </h3>
                  )}
                  {selectedItem.description && (
                    <p 
                      className="text-gray-600 dark:text-gray-300"
                      data-testid="text-modal-description"
                    >
                      {selectedItem.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}