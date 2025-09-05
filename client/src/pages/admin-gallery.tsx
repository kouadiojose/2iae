import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Edit, Trash2, Upload, Image as ImageIcon, Video, Eye, ArrowLeft, Play } from "lucide-react";
import { Link } from "wouter";

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

const ALBUM_CATEGORIES = [
  "Événements",
  "Campus",
  "Formations",
  "Vie étudiante",
  "Cérémonies",
  "Infrastructures",
  "Activités",
  "Conférences"
];

export default function AdminGallery() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [isAlbumDialogOpen, setIsAlbumDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [albumFormData, setAlbumFormData] = useState({
    title: "",
    description: "",
    category: "",
    coverImage: "",
    isActive: true,
    order: "1"
  });
  const [itemFormData, setItemFormData] = useState({
    title: "",
    description: "",
    mediaUrl: "",
    mediaType: "image" as "image" | "video",
    thumbnailUrl: "",
    albumId: "",
    isActive: true,
    order: "1"
  });
  const [isUploading, setIsUploading] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);

  // Queries
  const { data: albumsData, isLoading: albumsLoading } = useQuery({
    queryKey: ["/api/admin/albums"],
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/admin/gallery-items", selectedAlbum?.id],
    enabled: !!selectedAlbum?.id,
  });

  // Mutations
  const createAlbumMutation = useMutation({
    mutationFn: (data: typeof albumFormData) => apiRequest("/api/admin/albums", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/albums"] });
      setIsAlbumDialogOpen(false);
      resetAlbumForm();
      toast({
        title: "Succès",
        description: "Album créé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la création de l'album",
        variant: "destructive",
      });
    },
  });

  const updateAlbumMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof albumFormData }) => 
      apiRequest(`/api/admin/albums/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/albums"] });
      setIsAlbumDialogOpen(false);
      setEditingAlbum(null);
      resetAlbumForm();
      toast({
        title: "Succès",
        description: "Album mis à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la mise à jour de l'album",
        variant: "destructive",
      });
    },
  });

  const deleteAlbumMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/albums/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/albums"] });
      setSelectedAlbum(null);
      toast({
        title: "Succès",
        description: "Album supprimé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression de l'album",
        variant: "destructive",
      });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (data: typeof itemFormData) => apiRequest("/api/admin/gallery-items", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery-items"] });
      setIsItemDialogOpen(false);
      resetItemForm();
      toast({
        title: "Succès",
        description: "Élément ajouté avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de l'ajout de l'élément",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof itemFormData }) => 
      apiRequest(`/api/admin/gallery-items/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery-items"] });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      resetItemForm();
      toast({
        title: "Succès",
        description: "Élément mis à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la mise à jour de l'élément",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/gallery-items/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery-items"] });
      toast({
        title: "Succès",
        description: "Élément supprimé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression de l'élément",
        variant: "destructive",
      });
    },
  });

  // Utility functions
  const resetAlbumForm = () => {
    setAlbumFormData({
      title: "",
      description: "",
      category: "",
      coverImage: "",
      isActive: true,
      order: "1"
    });
  };

  const resetItemForm = () => {
    setItemFormData({
      title: "",
      description: "",
      mediaUrl: "",
      mediaType: "image",
      thumbnailUrl: "",
      albumId: selectedAlbum?.id || "",
      isActive: true,
      order: "1"
    });
  };

  const openEditAlbum = (album: Album) => {
    setEditingAlbum(album);
    setAlbumFormData({
      title: album.title,
      description: album.description || "",
      category: album.category,
      coverImage: album.coverImage || "",
      isActive: album.isActive,
      order: album.order
    });
    setIsAlbumDialogOpen(true);
  };

  const openEditItem = (item: GalleryItem) => {
    setEditingItem(item);
    setItemFormData({
      title: item.title || "",
      description: item.description || "",
      mediaUrl: item.mediaUrl,
      mediaType: item.mediaType,
      thumbnailUrl: item.thumbnailUrl || "",
      albumId: item.albumId,
      isActive: item.isActive,
      order: item.order
    });
    setIsItemDialogOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("media", file);

      const response = await fetch("/api/admin/gallery-upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      
      if (result.success) {
        setItemFormData(prev => ({
          ...prev,
          mediaUrl: result.mediaUrl,
          mediaType: file.type.startsWith("video/") ? "video" : "image"
        }));
        
        toast({
          title: "Succès",
          description: "Fichier uploadé avec succès",
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de l'upload du fichier",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const albums = (albumsData as any)?.albums || [];
  const items = (itemsData as any)?.items || [];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au tableau de bord
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Gestion des Galeries
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Gérez les albums et médias de votre galerie
            </p>
          </div>
        </div>
        
        <Dialog open={isAlbumDialogOpen} onOpenChange={setIsAlbumDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetAlbumForm} data-testid="button-create-album">
              <Plus className="h-4 w-4 mr-2" />
              Nouvel Album
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAlbum ? "Modifier l'album" : "Créer un nouvel album"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Titre de l'album *</Label>
                <Input
                  id="title"
                  value={albumFormData.title}
                  onChange={(e) => setAlbumFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Nom de l'album..."
                  data-testid="input-album-title"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={albumFormData.description}
                  onChange={(e) => setAlbumFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description de l'album..."
                  rows={3}
                  data-testid="input-album-description"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="category">Catégorie *</Label>
                <Select 
                  value={albumFormData.category} 
                  onValueChange={(value) => setAlbumFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger data-testid="select-album-category">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALBUM_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="coverImage">Image de couverture (URL)</Label>
                <Input
                  id="coverImage"
                  value={albumFormData.coverImage}
                  onChange={(e) => setAlbumFormData(prev => ({ ...prev, coverImage: e.target.value }))}
                  placeholder="URL de l'image de couverture..."
                  data-testid="input-album-cover"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="order">Ordre d'affichage</Label>
                <Input
                  id="order"
                  type="number"
                  value={albumFormData.order}
                  onChange={(e) => setAlbumFormData(prev => ({ ...prev, order: e.target.value }))}
                  data-testid="input-album-order"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={albumFormData.isActive}
                  onCheckedChange={(checked) => setAlbumFormData(prev => ({ ...prev, isActive: checked }))}
                  data-testid="switch-album-active"
                />
                <Label htmlFor="isActive">Album actif</Label>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAlbumDialogOpen(false);
                  setEditingAlbum(null);
                  resetAlbumForm();
                }}
                data-testid="button-cancel-album"
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (editingAlbum) {
                    updateAlbumMutation.mutate({ id: editingAlbum.id, data: albumFormData });
                  } else {
                    createAlbumMutation.mutate(albumFormData);
                  }
                }}
                disabled={!albumFormData.title || !albumFormData.category || createAlbumMutation.isPending || updateAlbumMutation.isPending}
                data-testid="button-save-album"
              >
                {createAlbumMutation.isPending || updateAlbumMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingAlbum ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Albums List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Albums ({albums.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {albumsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : albums.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Aucun album créé
                </div>
              ) : (
                <div className="space-y-3">
                  {albums.map((album: Album) => (
                    <div
                      key={album.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedAlbum?.id === album.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedAlbum(album)}
                      data-testid={`card-album-${album.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate" data-testid={`text-album-title-${album.id}`}>
                            {album.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {album.category}
                            </Badge>
                            {!album.isActive && (
                              <Badge variant="outline" className="text-xs">
                                Inactif
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditAlbum(album);
                            }}
                            data-testid={`button-edit-album-${album.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Êtes-vous sûr de vouloir supprimer cet album ?")) {
                                deleteAlbumMutation.mutate(album.id);
                              }
                            }}
                            data-testid={`button-delete-album-${album.id}`}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gallery Items */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {selectedAlbum ? (
                    <>
                      <Video className="h-5 w-5" />
                      Médias - {selectedAlbum.title} ({items.length})
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5" />
                      Sélectionnez un album
                    </>
                  )}
                </CardTitle>
                
                {selectedAlbum && (
                  <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={resetItemForm} data-testid="button-add-media">
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter média
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          {editingItem ? "Modifier le média" : "Ajouter un média"}
                        </DialogTitle>
                      </DialogHeader>
                      
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Upload fichier</Label>
                          <Input
                            type="file"
                            accept="image/*,video/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file);
                              }
                            }}
                            disabled={isUploading}
                            data-testid="input-file-upload"
                          />
                          {isUploading && (
                            <div className="flex items-center gap-2 text-sm text-blue-600">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Upload en cours...
                            </div>
                          )}
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="mediaUrl">URL du média *</Label>
                          <Input
                            id="mediaUrl"
                            value={itemFormData.mediaUrl}
                            onChange={(e) => setItemFormData(prev => ({ ...prev, mediaUrl: e.target.value }))}
                            placeholder="URL du fichier média..."
                            data-testid="input-media-url"
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="mediaType">Type de média</Label>
                          <Select 
                            value={itemFormData.mediaType} 
                            onValueChange={(value: "image" | "video") => setItemFormData(prev => ({ ...prev, mediaType: value }))}
                          >
                            <SelectTrigger data-testid="select-media-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="image">Image</SelectItem>
                              <SelectItem value="video">Vidéo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="itemTitle">Titre</Label>
                          <Input
                            id="itemTitle"
                            value={itemFormData.title}
                            onChange={(e) => setItemFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Titre du média..."
                            data-testid="input-media-title"
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="itemDescription">Description</Label>
                          <Textarea
                            id="itemDescription"
                            value={itemFormData.description}
                            onChange={(e) => setItemFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Description du média..."
                            rows={2}
                            data-testid="input-media-description"
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="itemOrder">Ordre</Label>
                          <Input
                            id="itemOrder"
                            type="number"
                            value={itemFormData.order}
                            onChange={(e) => setItemFormData(prev => ({ ...prev, order: e.target.value }))}
                            data-testid="input-media-order"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="itemActive"
                            checked={itemFormData.isActive}
                            onCheckedChange={(checked) => setItemFormData(prev => ({ ...prev, isActive: checked }))}
                            data-testid="switch-media-active"
                          />
                          <Label htmlFor="itemActive">Média actif</Label>
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setIsItemDialogOpen(false);
                            setEditingItem(null);
                            resetItemForm();
                          }}
                          data-testid="button-cancel-media"
                        >
                          Annuler
                        </Button>
                        <Button
                          onClick={() => {
                            const dataToSubmit = {
                              ...itemFormData,
                              albumId: selectedAlbum?.id || ""
                            };
                            if (editingItem) {
                              updateItemMutation.mutate({ id: editingItem.id, data: dataToSubmit });
                            } else {
                              createItemMutation.mutate(dataToSubmit);
                            }
                          }}
                          disabled={!itemFormData.mediaUrl || createItemMutation.isPending || updateItemMutation.isPending}
                          data-testid="button-save-media"
                        >
                          {createItemMutation.isPending || updateItemMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          {editingItem ? "Mettre à jour" : "Ajouter"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedAlbum ? (
                <div className="text-center py-16 text-gray-500">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Sélectionnez un album pour gérer ses médias</p>
                </div>
              ) : itemsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Video className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucun média dans cet album</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.map((item: GalleryItem) => (
                    <div
                      key={item.id}
                      className="relative group border rounded-lg overflow-hidden"
                      data-testid={`card-media-${item.id}`}
                    >
                      <div className="aspect-square overflow-hidden">
                        {item.mediaType === "video" ? (
                          <div className="relative w-full h-full bg-gray-100">
                            <video 
                              src={item.mediaUrl} 
                              className="w-full h-full object-cover"
                              data-testid={`video-preview-${item.id}`}
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <Play className="h-8 w-8 text-white" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={item.mediaUrl}
                            alt={item.title || "Media"}
                            className="w-full h-full object-cover"
                            data-testid={`img-preview-${item.id}`}
                          />
                        )}
                      </div>
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditItem(item)}
                            data-testid={`button-edit-media-${item.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              if (confirm("Supprimer ce média ?")) {
                                deleteItemMutation.mutate(item.id);
                              }
                            }}
                            data-testid={`button-delete-media-${item.id}`}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Media type badge */}
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-xs">
                          {item.mediaType === "video" ? "Vidéo" : "Photo"}
                        </Badge>
                      </div>
                      
                      {!item.isActive && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="outline" className="text-xs">
                            Inactif
                          </Badge>
                        </div>
                      )}
                      
                      {item.title && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-white text-xs truncate" data-testid={`text-media-title-${item.id}`}>
                            {item.title}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}