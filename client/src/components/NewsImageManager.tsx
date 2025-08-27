import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Image, Trash2, MoveUp, MoveDown, Edit3, Save, X } from "lucide-react";
import type { UploadResult } from "@uppy/core";

interface NewsImage {
  id: string;
  newsId: string;
  imageUrl: string;
  caption: string | null;
  order: number | null;
  createdAt: Date | null;
}

interface NewsImageManagerProps {
  newsId: string;
  isEditable?: boolean;
}

export function NewsImageManager({ newsId, isEditable = true }: NewsImageManagerProps) {
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [uploadingCount, setUploadingCount] = useState(0);
  const queryClient = useQueryClient();

  // Fetch images for this news
  const { data: imagesData, isLoading } = useQuery({
    queryKey: [`/api/admin/news/${newsId}/images`],
    enabled: !!newsId && isEditable,
  });

  const images: NewsImage[] = (imagesData as any)?.images || [];

  // Create image mutation
  const createImageMutation = useMutation({
    mutationFn: async (data: { imageUrl: string; caption?: string; order?: number }) => {
      return await apiRequest(`/api/admin/news/${newsId}/images`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/news/${newsId}/images`] });
      toast({
        title: "Succès",
        description: "Image ajoutée avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'ajout de l'image",
        variant: "destructive",
      });
    },
  });

  // Update image mutation
  const updateImageMutation = useMutation({
    mutationFn: async (data: { imageId: string; caption?: string; order?: number }) => {
      return await apiRequest(`/api/admin/news-images/${data.imageId}`, "PUT", {
        caption: data.caption,
        order: data.order,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/news/${newsId}/images`] });
      setEditingImage(null);
      toast({
        title: "Succès",
        description: "Image mise à jour avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la mise à jour de l'image",
        variant: "destructive",
      });
    },
  });

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      return await apiRequest(`/api/admin/news-images/${imageId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/news/${newsId}/images`] });
      toast({
        title: "Succès",
        description: "Image supprimée avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression de l'image",
        variant: "destructive",
      });
    },
  });

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadURL = result.successful[0].uploadURL;
      if (uploadURL) {
        const urlParts = uploadURL.split('/');
        const filename = urlParts[urlParts.length - 1].split('?')[0];
        const relativePath = `/api/assets/news/${filename}`;
        
        // Get next order number
        const nextOrder = Math.max(...images.map(img => img.order || 0), 0) + 1;
        
        createImageMutation.mutate({
          imageUrl: relativePath,
          order: nextOrder,
        });
      }
    }
  };

  const handleEditImage = (image: NewsImage) => {
    setEditingImage(image.id);
    setEditCaption(image.caption || "");
  };

  const handleSaveEdit = (imageId: string, currentOrder: number) => {
    updateImageMutation.mutate({
      imageId,
      caption: editCaption,
      order: currentOrder,
    });
  };

  const handleCancelEdit = () => {
    setEditingImage(null);
    setEditCaption("");
  };

  const handleMoveImage = (imageId: string, direction: 'up' | 'down') => {
    const currentIndex = images.findIndex(img => img.id === imageId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const currentImage = images[currentIndex];
    const targetImage = images[targetIndex];

    // Swap orders
    updateImageMutation.mutate({
      imageId: currentImage.id,
      order: targetImage.order || targetIndex + 1,
    });

    setTimeout(() => {
      updateImageMutation.mutate({
        imageId: targetImage.id,
        order: currentImage.order || currentIndex + 1,
      });
    }, 100);
  };

  if (!isEditable) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Galerie d'images
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">Chargement des images...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Galerie d'images
          <Badge variant="secondary">{images.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload new image */}
        <div className="border-2 border-dashed border-orange-300 rounded-lg p-4 bg-orange-50">
          <ObjectUploader
            maxNumberOfFiles={1}
            maxFileSize={5 * 1024 * 1024}
            onGetUploadParameters={async () => {
              const response: any = await apiRequest("/api/objects/upload", "POST");
              setUploadingCount(prev => prev + 1);
              return {
                method: "PUT" as const,
                url: response.uploadURL,
              };
            }}
            onComplete={(result) => {
              setUploadingCount(prev => prev - 1);
              handleUploadComplete(result);
            }}
            buttonClassName="w-full bg-orange-500 hover:bg-orange-600"
          >
            <Image className="h-4 w-4 mr-2" />
            Ajouter une image à la galerie
          </ObjectUploader>
        </div>

        {/* Show uploading status */}
        {uploadingCount > 0 && (
          <div className="text-center text-orange-600 font-medium">
            Téléchargement en cours... ({uploadingCount})
          </div>
        )}

        {/* Images grid */}
        {images.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((image, index) => (
              <Card key={image.id} className="overflow-hidden">
                <div className="aspect-video bg-gray-100 relative">
                  <img
                    src={image.imageUrl}
                    alt={image.caption || `Image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary">#{image.order || index + 1}</Badge>
                  </div>
                </div>
                <CardContent className="p-3">
                  {editingImage === image.id ? (
                    <div className="space-y-2">
                      <Label htmlFor={`caption-${image.id}`}>Légende</Label>
                      <Input
                        id={`caption-${image.id}`}
                        value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)}
                        placeholder="Légende de l'image..."
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(image.id, image.order || index + 1)}
                          disabled={updateImageMutation.isPending}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Sauver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 min-h-[1.25rem]">
                        {image.caption || "Aucune légende"}
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditImage(image)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        
                        {index > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMoveImage(image.id, 'up')}
                            disabled={updateImageMutation.isPending}
                          >
                            <MoveUp className="h-3 w-3" />
                          </Button>
                        )}
                        
                        {index < images.length - 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMoveImage(image.id, 'down')}
                            disabled={updateImageMutation.isPending}
                          >
                            <MoveDown className="h-3 w-3" />
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteImageMutation.mutate(image.id)}
                          disabled={deleteImageMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Image className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Aucune image dans la galerie</p>
            <p className="text-sm">Utilisez le bouton ci-dessus pour ajouter des images</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}