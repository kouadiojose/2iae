import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Calendar, User, Tag, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface News {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
  imageUrl: string | null;
  date: string;
  category: string;
  author: string;
  featured: boolean;
  isActive: boolean;
  albumId?: string | null;
}

interface NewsImage {
  id: string;
  newsId: string;
  imageUrl: string;
  caption: string | null;
  order: number | null;
  createdAt: Date | null;
}

interface ImageLightboxProps {
  images: NewsImage[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

function ImageLightbox({ images, currentIndex, onClose, onNext, onPrev }: ImageLightboxProps) {
  const currentImage = images[currentIndex];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70"
        >
          <ArrowLeft className="h-6 w-6 rotate-45" />
        </button>

        {/* Navigation buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-70"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-70"
            >
              <ArrowLeft className="h-6 w-6 rotate-180" />
            </button>
          </>
        )}

        {/* Image */}
        <div className="flex items-center justify-center h-full">
          <img
            src={currentImage.imageUrl}
            alt={currentImage.caption || `Image ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Caption and counter */}
        {(currentImage.caption || images.length > 1) && (
          <div className="absolute bottom-4 left-4 right-4 text-center text-white">
            {currentImage.caption && (
              <p className="text-lg mb-2 bg-black bg-opacity-50 rounded px-4 py-2">
                {currentImage.caption}
              </p>
            )}
            {images.length > 1 && (
              <p className="text-sm bg-black bg-opacity-50 rounded px-3 py-1 inline-block">
                {currentIndex + 1} / {images.length}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActualiteDetail() {
  const params = useParams();
  const newsId = params.id;

  // Fetch news details
  const { data: news, isLoading: newsLoading } = useQuery({
    queryKey: [`/api/news/${newsId}`],
    enabled: !!newsId,
  });

  // Fetch news images
  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: [`/api/news/${newsId}/images`],
    enabled: !!newsId,
  });

  const newsItem = news as News;
  const images: NewsImage[] = (imagesData as any)?.images || [];

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const nextImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex === 0 ? images.length - 1 : lightboxIndex - 1);
    }
  };

  if (newsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!newsItem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Actualité introuvable</h1>
            <Link href="/actualites">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour aux actualités
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back button */}
        <Link href="/actualites">
          <Button variant="outline" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux actualités
          </Button>
        </Link>

        {/* Article header */}
        <article className="space-y-6">
          <header className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-orange-100 text-orange-800">{newsItem.category}</Badge>
              {newsItem.featured && (
                <Badge className="bg-green-100 text-green-800">À la une</Badge>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 leading-tight">
              {newsItem.title}
            </h1>

            <div className="flex items-center gap-6 text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{newsItem.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{newsItem.author}</span>
              </div>
            </div>

            {newsItem.summary && (
              <p className="text-lg text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
                {newsItem.summary}
              </p>
            )}
          </header>

          {/* Main image */}
          {newsItem.imageUrl && (
            <div className="rounded-lg overflow-hidden shadow-lg">
              <img
                src={newsItem.imageUrl}
                alt={newsItem.title}
                className="w-full h-64 md:h-80 object-cover"
              />
            </div>
          )}

          {/* Article content */}
          {newsItem.content && (
            <Card>
              <CardContent className="p-6">
                <div 
                  className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: newsItem.content.replace(/\n/g, '<br>') }}
                />
              </CardContent>
            </Card>
          )}

          {/* Album photo lié à l'événement */}
          {newsItem.albumId && (
            <Link href={`/galerie/${newsItem.albumId}`}>
              <Card className="border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer" data-testid="card-album-lie">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-6 w-6 text-orange-600" />
                    <span className="font-semibold text-gray-900">
                      Voir l'album photo de cet événement
                    </span>
                  </div>
                  <span className="text-orange-600 font-bold">→</span>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Image gallery */}
          {images.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="h-5 w-5 text-orange-600" />
                  <h2 className="text-xl font-semibold text-gray-800">
                    Galerie d'images ({images.length})
                  </h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => openLightbox(index)}
                    >
                      <img
                        src={image.imageUrl}
                        alt={image.caption || `Image ${index + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  ))}
                </div>

                {images.some(img => img.caption) && (
                  <div className="mt-4 text-sm text-gray-600">
                    <p>Cliquez sur une image pour l'agrandir et voir les légendes.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </article>

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <ImageLightbox
            images={images}
            currentIndex={lightboxIndex}
            onClose={closeLightbox}
            onNext={nextImage}
            onPrev={prevImage}
          />
        )}
      </div>
    </div>
  );
}