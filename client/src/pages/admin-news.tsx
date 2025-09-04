import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Calendar, User, Tag, Image } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { NewsImageManager } from "@/components/NewsImageManager";

const newsCategories = [
  "Innovation",
  "Formation", 
  "Partenariats",
  "Événements",
  "Technologie",
  "Réussite Étudiante",
  "International"
];

const newsFormSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  slug: z.string().min(1, "Le slug est requis"),
  summary: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  imageData: z.string().optional(),
  date: z.string().min(1, "La date est requise"),
  category: z.string().min(1, "La catégorie est requise"),
  author: z.string().min(1, "L'auteur est requis"),
  featured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  order: z.string().optional(),
});

type NewsForm = z.infer<typeof newsFormSchema>;

interface News {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  imageUrl: string | null;
  imageData: string | null;
  date: string;
  category: string;
  author: string;
  featured: boolean;
  isActive: boolean;
  order: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export default function AdminNewsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<NewsForm>({
    title: "",
    slug: "",
    summary: "",
    content: "",
    imageUrl: "",
    imageData: "",
    date: new Date().toISOString().split('T')[0],
    category: newsCategories[0],
    author: "Direction 2IAE",
    featured: false,
    isActive: true,
    order: "1",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Function to generate slug from title
  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const { data: newsData, isLoading } = useQuery({
    queryKey: ["/api/admin/news"],
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: NewsForm) => {
      return await apiRequest("/api/admin/news", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Succès",
        description: "Actualité créée avec succès",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création de l'actualité",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NewsForm> }) => {
      return await apiRequest(`/api/admin/news/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      setIsDialogOpen(false);
      setEditingNews(null);
      resetForm();
      toast({
        title: "Succès",
        description: "Actualité mise à jour avec succès",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la mise à jour de l'actualité",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/news/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({
        title: "Succès",
        description: "Actualité supprimée avec succès",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression de l'actualité",
        variant: "destructive",
      });
    },
  });

  // Convert image to base64 directly
  // NOUVEAU SYSTÈME: Upload de fichier physique pour news
  const handleMainImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

      setUploadingImage(true);
      
      try {
        // Créer FormData pour l'upload
        const uploadFormData = new FormData();
        uploadFormData.append('image', file);
        
        // Upload vers le backend (stockage physique)
        const response = await fetch('/api/admin/news/temp/images/upload', {
          method: 'POST',
          body: uploadFormData,
        });
        
        if (!response.ok) {
          throw new Error('Upload failed');
        }
        
        const result = await response.json();
        
        if (result.success) {
          // Update form data with image URL (plus de base64)
          setFormData(prev => ({ 
            ...prev, 
            imageUrl: result.image.imageUrl,
            imageData: '' // Clear base64 data
          }));
          
          console.log('✅ Image news uploadée:', result.image.imageUrl);
          
          toast({
            title: "Succès",
            description: "Image uploadée avec succès",
          });
        } else {
          throw new Error(result.error || 'Upload failed');
        }
        
      } catch (error) {
        console.error('❌ Erreur upload news:', error);
        toast({
          title: "Erreur",
          description: "Erreur lors de l'upload de l'image",
          variant: "destructive",
        });
      } finally {
        setUploadingImage(false);
      }
    }
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      summary: "",
      content: "",
      imageUrl: "",
      imageData: "", // Legacy field - will be empty with new system
      date: new Date().toISOString().split('T')[0],
      category: newsCategories[0],
      author: "Direction 2IAE",
      featured: false,
      isActive: true,
      order: "1",
    });
  };

  const openCreateDialog = () => {
    setEditingNews(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (news: News) => {
    setEditingNews(news);
    setFormData({
      title: news.title,
      slug: news.slug,
      summary: news.summary || "",
      content: news.content || "",
      imageUrl: news.imageUrl || "",
      imageData: news.imageData || "",
      date: news.date,
      category: news.category,
      author: news.author,
      featured: news.featured,
      isActive: news.isActive,
      order: news.order || "1",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = newsFormSchema.parse(formData);
      
      if (editingNews) {
        updateMutation.mutate({ id: editingNews.id, data: validatedData });
      } else {
        createMutation.mutate(validatedData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erreur de validation",
          description: error.errors.map(err => err.message).join(", "),
          variant: "destructive",
        });
      }
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette actualité ?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const news: News[] = (newsData as any)?.news || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900" data-testid="text-page-title">
              Gestion des Actualités
            </h1>
            <p className="text-gray-600 mt-2">
              Gérer les actualités et articles du site
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={openCreateDialog}
                className="bg-orange-500 hover:bg-orange-600"
                data-testid="button-create-news"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Actualité
              </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid="text-dialog-title">
                  {editingNews ? "Modifier l'Actualité" : "Nouvelle Actualité"}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Titre *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        setFormData(prev => ({ 
                          ...prev, 
                          title: newTitle,
                          slug: generateSlug(newTitle)
                        }));
                      }}
                      placeholder="Titre de l'actualité"
                      required
                      data-testid="input-news-title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL) *</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="url-de-lactualite"
                      required
                      data-testid="input-news-slug"
                    />
                    <p className="text-sm text-gray-500">
                      L'URL sera: /actualites/{formData.slug || "url-de-lactualite"}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      required
                      data-testid="input-news-date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie *</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger data-testid="select-news-category">
                        <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {newsCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="author">Auteur *</Label>
                    <Input
                      id="author"
                      value={formData.author}
                      onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                      placeholder="Nom de l'auteur"
                      required
                      data-testid="input-news-author"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">Résumé</Label>
                  <Textarea
                    id="summary"
                    value={formData.summary}
                    onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                    placeholder="Brève description de l'actualité"
                    rows={3}
                    data-testid="textarea-news-summary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Contenu complet</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Contenu détaillé de l'actualité"
                    rows={6}
                    data-testid="textarea-news-content"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Image de l'actualité</Label>
                  <div className="space-y-4">
                    {(formData.imageData || formData.imageUrl) && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">Aperçu de l'image :</p>
                        <img 
                          src={formData.imageData 
                            ? `data:image/jpeg;base64,${formData.imageData}`
                            : formData.imageUrl!} 
                          alt="Aperçu" 
                          className="w-32 h-32 object-cover rounded border"
                          onLoad={() => console.log('✅ Image news principale chargée:', formData.imageUrl)}
                          onError={(e) => {
                            console.error('❌ Image news principale failed to load:', formData.imageUrl);
                            console.error('Error details:', e);
                            // Force reload for DigitalOcean Spaces
                            if (formData.imageUrl?.includes('digitaloceanspaces.com')) {
                              setTimeout(() => {
                                const img = e.target as HTMLImageElement;
                                img.src = formData.imageUrl + '?v=' + Date.now();
                              }, 2000);
                            }
                          }}
                        />
                      </div>
                    )}
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      style={{ display: 'none' }}
                      onChange={handleMainImageSelect}
                    />
                    
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="w-full bg-orange-500 hover:bg-orange-600"
                    >
                      <Image className="h-4 w-4 mr-2" />
                      {uploadingImage ? "Chargement..." : ((formData.imageData || formData.imageUrl) ? "Changer l'image" : "Choisir une image")}
                    </Button>
                    
                    <div className="text-sm text-gray-600 mt-2">
                      <p><strong>Note :</strong> Cette image sera utilisée comme image principale pour les listes d'actualités.</p>
                      <p>Utilisez la section "Galerie d'images" ci-dessous pour ajouter des images supplémentaires à l'article.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="order">Ordre d'affichage</Label>
                    <Input
                      id="order"
                      value={formData.order}
                      onChange={(e) => setFormData(prev => ({ ...prev, order: e.target.value }))}
                      placeholder="1"
                      data-testid="input-news-order"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="featured"
                      checked={formData.featured}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
                      data-testid="switch-news-featured"
                    />
                    <Label htmlFor="featured">À la une</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                      data-testid="switch-news-active"
                    />
                    <Label htmlFor="active">Actif</Label>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-orange-500 hover:bg-orange-600"
                    data-testid="button-save-news"
                  >
                    {editingNews ? "Modifier" : "Créer"}
                  </Button>
                </div>
              </form>

              {/* News Image Gallery Manager - Only show when editing an existing news */}
              {editingNews && (
                <div className="mt-6 border-t pt-6">
                  <NewsImageManager 
                    newsId={editingNews.id} 
                    isEditable={true} 
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {news.map((newsItem: News) => (
            <Card key={newsItem.id} className="overflow-hidden" data-testid={`card-news-${newsItem.id}`}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{newsItem.title}</CardTitle>
                      <div className="flex gap-1">
                        {newsItem.featured && (
                          <Badge className="bg-orange-100 text-orange-800">À la une</Badge>
                        )}
                        <Badge 
                          variant={newsItem.isActive ? "default" : "secondary"}
                          className={newsItem.isActive ? "bg-green-100 text-green-800" : ""}
                        >
                          {newsItem.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {newsItem.date}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {newsItem.author}
                      </div>
                      <div className="flex items-center gap-1">
                        <Tag className="h-4 w-4" />
                        {newsItem.category}
                      </div>
                    </div>

                    {newsItem.summary && (
                      <p className="text-gray-700 text-sm line-clamp-2">{newsItem.summary}</p>
                    )}
                  </div>
                  
                  {(newsItem.imageData || newsItem.imageUrl) && (
                    <div className="ml-4">
                      <img
                        src={newsItem.imageData 
                          ? `data:image/jpeg;base64,${newsItem.imageData}` 
                          : newsItem.imageUrl!}
                        alt={newsItem.title}
                        className="w-20 h-20 object-cover rounded"
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(newsItem)}
                    data-testid={`button-edit-news-${newsItem.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(newsItem.id)}
                    className="text-red-600 hover:text-red-700"
                    data-testid={`button-delete-news-${newsItem.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {news.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">Aucune actualité trouvée</p>
                <p className="text-sm text-gray-400">Créez votre première actualité pour commencer</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}