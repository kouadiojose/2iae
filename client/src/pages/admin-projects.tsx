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
import { Plus, Edit, Trash2, Calendar, Upload, Play, Camera, CheckCircle, Clock, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { type Project } from "@shared/schema";

const projectFormSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().min(1, "La description est requise"),
  status: z.enum(["upcoming", "completed"], { required_error: "Le statut est requis" }),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
  order: z.string().optional(),
});

type ProjectForm = z.infer<typeof projectFormSchema>;

interface ProjectFormData extends ProjectForm {
  images: string[];
  videos: string[];
}

export default function AdminProjectsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<ProjectFormData>({
    title: "",
    description: "",
    status: "upcoming",
    startDate: "",
    endDate: "",
    isActive: true,
    order: "1",
    images: [],
    videos: []
  });

  // Fetch projects data
  const { data: projectsData, isLoading } = useQuery<{ success: boolean; projects: Project[] }>({
    queryKey: ["/api/admin/projects"],
  });

  const projects = projectsData?.projects || [];

  // Create/Update project mutation
  const saveProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const endpoint = editingProject 
        ? `/api/admin/projects/${editingProject.id}`
        : "/api/admin/projects";
      const method = editingProject ? "PUT" : "POST";
      
      return await apiRequest(endpoint, method, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsDialogOpen(false);
      setEditingProject(null);
      resetForm();
      toast({
        title: "Succès",
        description: editingProject ? "Projet mis à jour avec succès" : "Projet créé avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la sauvegarde",
        variant: "destructive",
      });
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/projects/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Succès",
        description: "Projet supprimé avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression",
        variant: "destructive",
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest(`/api/admin/projects/${id}`, "PUT", { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Succès",
        description: "Statut mis à jour avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la mise à jour",
        variant: "destructive",
      });
    },
  });

  // Upload media mutation
  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('media', file);
      
      const response = await fetch('/api/admin/projects/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const mediaUrl = data.media.mediaUrl;
      const mediaType = data.media.type;
      
      if (mediaType === 'video') {
        setFormData(prev => ({
          ...prev,
          videos: [...prev.videos, mediaUrl]
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, mediaUrl]
        }));
      }
      
      setUploadingMedia(false);
      toast({
        title: "Succès",
        description: "Média uploadé avec succès",
      });
    },
    onError: (error: any) => {
      setUploadingMedia(false);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'upload",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      status: "upcoming",
      startDate: "",
      endDate: "",
      isActive: true,
      order: "1",
      images: [],
      videos: []
    });
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setFormData({
      title: project.title,
      description: project.description,
      status: project.status as "upcoming" | "completed",
      startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
      endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : "",
      isActive: project.isActive ?? true,
      order: project.order || "1",
      images: Array.isArray(project.images) ? project.images as string[] : [],
      videos: Array.isArray(project.videos) ? project.videos as string[] : []
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProject(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadingMedia(true);
      uploadMediaMutation.mutate(file);
    }
  };

  const removeMedia = (url: string, type: 'image' | 'video') => {
    if (type === 'image') {
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter(img => img !== url)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        videos: prev.videos.filter(vid => vid !== url)
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = projectFormSchema.parse(formData);
      const submitData = {
        ...validatedData,
        images: formData.images,
        videos: formData.videos
      };
      
      saveProjectMutation.mutate(submitData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erreur de validation",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8" data-testid="admin-projects-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Gestion des Projets</h1>
          <p className="text-gray-600 mt-2" data-testid="text-page-description">
            Gérez les projets du Cabinet 2IAE - à venir et terminés
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} data-testid="button-create-project">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Projet
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">
                {editingProject ? "Modifier le Projet" : "Nouveau Projet"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="title">Titre du projet *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Plateforme d'entrepreneuriat digital"
                    data-testid="input-title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Décrivez le projet..."
                    rows={4}
                    data-testid="input-description"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Statut *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value as "upcoming" | "completed" })}
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Sélectionner le statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">À venir</SelectItem>
                        <SelectItem value="completed">Terminé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="order">Ordre d'affichage</Label>
                    <Input
                      id="order"
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                      placeholder="1"
                      data-testid="input-order"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Date de début</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      data-testid="input-start-date"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="endDate">Date de fin</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-active"
                  />
                  <Label htmlFor="isActive">Projet actif</Label>
                </div>
              </div>

              {/* Media Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Médias (Images & Vidéos)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    data-testid="button-upload-media"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingMedia ? "Upload..." : "Ajouter média"}
                  </Button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Images Preview */}
                {formData.images.length > 0 && (
                  <div>
                    <Label className="text-sm text-gray-600">Images ({formData.images.length})</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {formData.images.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Image ${index + 1}`}
                            className="w-full h-20 object-cover rounded border"
                            data-testid={`img-preview-${index}`}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6"
                            onClick={() => removeMedia(imageUrl, 'image')}
                            data-testid={`button-remove-image-${index}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Videos Preview */}
                {formData.videos.length > 0 && (
                  <div>
                    <Label className="text-sm text-gray-600">Vidéos ({formData.videos.length})</Label>
                    <div className="space-y-2 mt-2">
                      {formData.videos.map((videoUrl, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center">
                            <Play className="w-4 h-4 mr-2 text-blue-600" />
                            <span className="text-sm truncate" data-testid={`text-video-${index}`}>
                              Vidéo {index + 1}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeMedia(videoUrl, 'video')}
                            data-testid={`button-remove-video-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-4">
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
                  disabled={saveProjectMutation.isPending}
                  data-testid="button-save"
                >
                  {saveProjectMutation.isPending
                    ? "Sauvegarde..."
                    : editingProject
                    ? "Mettre à jour"
                    : "Créer le projet"
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const statusInfo = getStatusInfo(project.status);
          const StatusIcon = statusInfo.icon;
          
          return (
            <Card key={project.id} className="overflow-hidden" data-testid={`card-project-${project.id}`}>
              <CardHeader className="p-0">
                {/* Project Image */}
                {Array.isArray(project.images) && project.images.length > 0 ? (
                  <div className="relative h-48 bg-gray-100">
                    <img
                      src={project.images[0] as string}
                      alt={project.title}
                      className="w-full h-full object-cover"
                      data-testid={`img-project-${project.id}`}
                    />
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3">
                      <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.text}
                      </Badge>
                    </div>
                    {/* Media Count */}
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
              
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant={statusInfo.variant} data-testid={`badge-status-${project.id}`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusInfo.text}
                  </Badge>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={project.isActive ?? true}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: project.id, isActive: checked })}
                      disabled={toggleActiveMutation.isPending}
                      data-testid={`switch-active-${project.id}`}
                    />
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold mb-2 line-clamp-2" data-testid={`text-title-${project.id}`}>
                  {project.title}
                </h3>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-3" data-testid={`text-description-${project.id}`}>
                  {project.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span data-testid={`text-date-${project.id}`}>
                      {project.status === 'upcoming' && project.startDate
                        ? formatDate(project.startDate.toString())
                        : project.status === 'completed' && project.endDate
                        ? formatDate(project.endDate.toString())
                        : 'Date non définie'
                      }
                    </span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(project)}
                      data-testid={`button-edit-${project.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteProjectMutation.mutate(project.id)}
                      disabled={deleteProjectMutation.isPending}
                      data-testid={`button-delete-${project.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-20">
          <h3 className="text-2xl font-semibold text-gray-600 mb-4" data-testid="text-no-projects">
            Aucun projet pour le moment
          </h3>
          <p className="text-gray-500 mb-8" data-testid="text-no-projects-description">
            Créez votre premier projet pour le Cabinet 2IAE
          </p>
          <Button onClick={openCreateDialog} data-testid="button-create-first-project">
            <Plus className="w-4 h-4 mr-2" />
            Créer le premier projet
          </Button>
        </div>
      )}
    </div>
  );
}