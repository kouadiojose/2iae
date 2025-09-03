import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Image, Trash2, MoveUp, MoveDown, Edit3, Save, X, Upload } from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch images for this news
  const { data: imagesData, isLoading } = useQuery({
    queryKey: [`/api/admin/news/${newsId}/images`],
    enabled: !!newsId && isEditable,
  });

  const images: NewsImage[] = (imagesData as any)?.images || [];

  // Upload image mutation (local file upload)
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('order', String(images.length + 1));

      const response = await fetch(`/api/admin/news/${newsId}/images/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/news/${newsId}/images`] });
      setUploadingCount(prev => prev - 1);
      toast({
        title: "Succès",
        description: "Image uploadée avec succès",
      });
    },
    onError: (error: any) => {
      setUploadingCount(prev => prev - 1);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'upload de l'image",
        variant: "destructive",
      });
    },
  });

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Erreur",
          description: "Le fichier est trop volumineux. Taille maximale : 10MB",
          variant: "destructive",
        });
        return;
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Erreur",
          description: "Type de fichier non autorisé. Utilisez JPG, PNG, GIF ou WebP.",
          variant: "destructive",
        });
        return;
      }

      setUploadingCount(prev => prev + 1);
      uploadImageMutation.mutate(file);
    }
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={false}
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-orange-500 hover:bg-orange-600"
            disabled={uploadImageMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadImageMutation.isPending ? "Upload en cours..." : "Ajouter une image à la galerie"}
          </Button>
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
                    onLoad={() => console.log('✅ Image news chargée:', image.imageUrl)}
                    onError={(e) => {
                      console.error('❌ Image news failed to load:', image.imageUrl);
                      console.error('Error details:', e);
                      // Force reload for DigitalOcean Spaces
                      if (image.imageUrl.includes('digitaloceanspaces.com')) {
                        setTimeout(() => {
                          const img = e.target as HTMLImageElement;
                          img.src = image.imageUrl + '?v=' + Date.now();
                        }, 2000);
                      }
                    }}
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