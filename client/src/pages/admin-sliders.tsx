import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSliderSchema, type Slider, type InsertSlider } from "@shared/schema";
// ObjectUploader no longer needed - using direct base64 approach
import { 
  ArrowLeft, 
  Plus,
  Edit3, 
  Trash2,
  Eye,
  EyeOff,
  Images,
  Upload
} from "lucide-react";

export default function AdminSliders() {
  const [, setLocation] = useLocation();
  const { admin, isAuthenticated, isLoading } = useAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlider, setEditingSlider] = useState<Slider | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>("");
  const [currentImageData, setCurrentImageData] = useState<string | null>(null);
  
  // Debug: Monitor currentImageUrl changes
  useEffect(() => {
    console.log('🔄 currentImageUrl changed to:', currentImageUrl);
    if (currentImageUrl) {
      console.log('🧪 Testing if URL works in img element...');
    }
  }, [currentImageUrl]);

  // Get all sliders
  const { data: slidersData, isLoading: slidersLoading } = useQuery({
    queryKey: ["/api/admin/sliders"],
    enabled: isAuthenticated,
  });

  const form = useForm<InsertSlider>({
    resolver: zodResolver(insertSliderSchema),
    defaultValues: {
      title: "",
      subtitle: "",
      description: "",
      imageUrl: "",
      button1Text: "",
      button1Link: "",
      button2Text: "",
      button2Link: "",
      order: "1",
    },
  });

  // Create slider mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertSlider) => {
      const response = await apiRequest("POST", "/api/admin/sliders", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sliders"] });
      toast({
        title: "Succès",
        description: "Slider créé avec succès",
      });
      setDialogOpen(false);
      form.reset();
      setEditingSlider(null);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la création du slider",
        variant: "destructive",
      });
    }
  });

  // Update slider mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSlider> }) => {
      const response = await apiRequest("PUT", `/api/admin/sliders/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sliders"] });
      toast({
        title: "Succès",
        description: "Slider mis à jour avec succès",
      });
      setDialogOpen(false);
      form.reset();
      setEditingSlider(null);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la mise à jour du slider",
        variant: "destructive",
      });
    }
  });

  // Delete slider mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/sliders/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sliders"] });
      toast({
        title: "Succès",
        description: "Slider supprimé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression du slider",
        variant: "destructive",
      });
    }
  });

  // Toggle slider status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PUT", `/api/admin/sliders/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sliders"] });
      toast({
        title: "Succès",
        description: "Statut du slider mis à jour",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la mise à jour du statut",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleEdit = (slider: Slider) => {
    setEditingSlider(slider);
    
    // Use base64 data if available, otherwise use imageUrl
    const displayUrl = slider.imageData 
      ? `data:image/jpeg;base64,${slider.imageData}`
      : (slider.imageUrl ?? "");
    
    setCurrentImageUrl(displayUrl);
    setCurrentImageData(slider.imageData || null);
    
    form.reset({
      title: slider.title,
      subtitle: slider.subtitle ?? "",
      description: slider.description ?? "",
      imageUrl: displayUrl,
      button1Text: slider.button1Text ?? "",
      button1Link: slider.button1Link ?? "",
      button2Text: slider.button2Text ?? "",
      button2Link: slider.button2Link ?? "",
      order: slider.order ?? "1",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce slider ?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleStatus = (id: string, currentStatus: boolean | null) => {
    toggleStatusMutation.mutate({ id, isActive: !(currentStatus ?? false) });
  };

  const onSubmit = (data: InsertSlider) => {
    // Include base64 image data if available
    const submitData = {
      ...data,
      imageData: currentImageData || undefined
    };
    
    if (editingSlider) {
      updateMutation.mutate({ id: editingSlider.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleNewSlider = () => {
    setEditingSlider(null);
    setCurrentImageUrl("");
    setCurrentImageData(null);
    form.reset();
    setDialogOpen(true);
  };

  // Convert file to base64
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Simple base64 image upload
  const handleImageUpload = async (file: File) => {
    if (!file) return;
    
    const fileLimit = 5 * 1024 * 1024; // 5MB
    if (file.size > fileLimit) {
      toast({
        title: "Erreur",
        description: "L'image ne peut pas dépasser 5 MB",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log('🔄 Conversion en base64...');
      const dataUrl = await convertToBase64(file);
      
      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64Data = dataUrl.split(',')[1];
      
      // Update preview and store base64 data
      setCurrentImageUrl(dataUrl);
      setCurrentImageData(base64Data);
      form.setValue("imageUrl", dataUrl);
      
      console.log('✅ Image convertie et aperçu mis à jour');
      
      toast({
        title: "Succès",
        description: "Image chargée avec succès",
      });
      
    } catch (error) {
      console.error('❌ Erreur conversion base64:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du traitement de l'image",
        variant: "destructive",
      });
    }
  };

  if (isLoading || slidersLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !admin) {
    return null; // Will redirect
  }

  const sliders = (slidersData as any)?.sliders || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/admin/dashboard")}
                className="mr-4"
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Slider Principal
                </h1>
                <p className="text-sm text-gray-500">Gérez les bannières de votre site web</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{admin.username}</p>
              <p className="text-xs text-gray-500">Administrateur</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                <Images className="h-5 w-5 mr-2" />
                Liste des Sliders
              </CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleNewSlider}
                    className="bg-orange-600 hover:bg-orange-700"
                    data-testid="button-add-slider"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un nouveau slider
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingSlider ? "Modifier le slider" : "Créer un nouveau slider"}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Titre *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-slider-title" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="subtitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sous-titre</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} data-testid="input-slider-subtitle" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Brève Description</FormLabel>
                            <FormControl>
                              <Textarea {...field} value={field.value || ""} rows={3} data-testid="textarea-slider-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3">
                        <FormLabel>Image du slider</FormLabel>
                        <div className="w-full">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleImageUpload(file);
                              }
                            }}
                            className="hidden"
                            id="image-upload"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('image-upload')?.click()}
                            className="w-full"
                          >
                            <div className="flex items-center gap-2">
                              <Upload className="h-4 w-4" />
                              <span>Choisir une image</span>
                            </div>
                          </Button>
                        </div>
                        {currentImageUrl && (
                          <div className="relative">
                            <img
                              src={currentImageUrl}
                              alt="Aperçu de l'image" 
                              className="w-full max-w-md h-32 object-cover rounded-lg border-2 border-green-200"
                              crossOrigin="anonymous"
                              onLoad={() => console.log('✅ Image chargée avec succès!')}
                              onError={(e) => {
                                console.error('❌ Image failed to load - trying fallback');
                                // Essayer une approche différente
                                setTimeout(() => {
                                  const img = e.target as HTMLImageElement;
                                  img.src = currentImageUrl + '?t=' + Date.now(); // Cache bust
                                }, 1000);
                              }}
                            />
                            <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                              <Images className="h-3 w-3" />
                              Image chargée
                            </div>
                          </div>
                        )}
                        <FormField
                          control={form.control}
                          name="imageUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} value={field.value || ""} type="hidden" data-testid="input-slider-image" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Bouton 1</Label>
                          <FormField
                            control={form.control}
                            name="button1Text"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="Texte du bouton 1" data-testid="input-button1-text" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="button1Link"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="Lien du bouton 1" data-testid="input-button1-link" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Bouton 2</Label>
                          <FormField
                            control={form.control}
                            name="button2Text"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="Texte du bouton 2" data-testid="input-button2-text" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="button2Link"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="Lien du bouton 2" data-testid="input-button2-link" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="order"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ordre d'affichage</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} type="number" min="1" data-testid="input-slider-order" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDialogOpen(false)}
                          data-testid="button-cancel-slider"
                        >
                          Annuler
                        </Button>
                        <Button
                          type="submit"
                          disabled={createMutation.isPending || updateMutation.isPending}
                          className="bg-orange-600 hover:bg-orange-700"
                          data-testid="button-save-slider"
                        >
                          {editingSlider ? "Modifier" : "Créer"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {sliders.length === 0 ? (
              <div className="text-center py-12">
                <Images className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun slider trouvé
                </h3>
                <p className="text-gray-500 mb-4">
                  Commencez par créer votre premier slider pour la bannière principale.
                </p>
                <Button 
                  onClick={handleNewSlider}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un slider
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Sous-titre</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Bouton 1</TableHead>
                    <TableHead>Bouton 2</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sliders.map((slider: Slider, index: number) => (
                    <TableRow key={slider.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        {slider.imageData ? (
                          <img
                            src={`data:image/jpeg;base64,${slider.imageData}`}
                            alt={slider.title}
                            className="w-16 h-10 object-cover rounded"
                          />
                        ) : slider.imageUrl ? (
                          <img
                            src={slider.imageUrl}
                            alt={slider.title}
                            className="w-16 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-10 bg-gray-200 rounded flex items-center justify-center">
                            <Images className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{slider.title}</TableCell>
                      <TableCell>{slider.subtitle || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {slider.description || "-"}
                      </TableCell>
                      <TableCell>{slider.button1Text || "-"}</TableCell>
                      <TableCell>{slider.button2Text || "-"}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={(slider.isActive ?? false) ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => handleToggleStatus(slider.id, slider.isActive)}
                        >
                          {(slider.isActive ?? false) ? (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              Actif
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3 mr-1" />
                              Inactif
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(slider)}
                            data-testid={`button-edit-slider-${slider.id}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(slider.id)}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`button-delete-slider-${slider.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}