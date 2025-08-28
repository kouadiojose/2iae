import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import type { Program } from "@shared/schema";

interface ProgramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProgram?: Program | null;
}

interface FormData {
  name: string;
  category: string;
  imageUrl?: string;
  description?: string;
  duration?: string;
  level?: string;
  order?: string;
  isActive: boolean;
}

export function ProgramModal({ open, onOpenChange, editingProgram }: ProgramModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    category: "",
    imageUrl: "",
    description: "",
    duration: "",
    level: "",
    order: "",
    isActive: true
  });
  
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Reset form when modal opens/closes or when editing program changes
  useEffect(() => {
    if (editingProgram) {
      setFormData({
        name: editingProgram.name || "",
        category: editingProgram.category || "",
        imageUrl: editingProgram.imageUrl || "",
        description: editingProgram.description || "",
        duration: editingProgram.duration || "",
        level: editingProgram.level || "",
        order: editingProgram.order || "",
        isActive: editingProgram.isActive ?? true
      });
      setPreviewImage(editingProgram.imageUrl || null);
    } else {
      setFormData({
        name: "",
        category: "",
        imageUrl: "",
        description: "",
        duration: "",
        level: "",
        order: "",
        isActive: true
      });
      setPreviewImage(null);
    }
  }, [editingProgram, open]);

  // Image upload handler
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);

      const response = await fetch('/api/admin/programs/upload', {
        method: 'POST',
        body: uploadFormData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'upload');
      }

      const result = await response.json();
      
      if (result.success) {
        setFormData(prev => ({ ...prev, imageUrl: result.image.imageUrl }));
        setPreviewImage(result.image.imageUrl);
        toast({
          title: "Image uploadée",
          description: "L'image a été uploadée avec succès",
        });
      } else {
        throw new Error(result.error || 'Erreur lors de l\'upload');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Erreur lors de l'upload de l'image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove image
  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, imageUrl: "" }));
    setPreviewImage(null);
  };

  // Create program mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest('/api/admin/programs', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
      toast({
        title: "Filière créée",
        description: "La filière a été créée avec succès",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la création",
        variant: "destructive",
      });
    }
  });

  // Update program mutation
  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest(`/api/admin/programs/${editingProgram?.id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
      toast({
        title: "Filière mise à jour",
        description: "La filière a été mise à jour avec succès",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la mise à jour",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Champ requis",
        description: "Le nom de la filière est requis",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.category.trim()) {
      toast({
        title: "Champ requis",
        description: "La catégorie est requise",
        variant: "destructive",
      });
      return;
    }

    if (editingProgram) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {editingProgram ? "Modifier la Filière" : "Nouvelle Filière"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la filière *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Finance Comptabilité & Gestion"
                required
                data-testid="input-program-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Catégorie *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger data-testid="select-program-category">
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTS TERTIAIRES">BTS TERTIAIRES</SelectItem>
                  <SelectItem value="BTS INDUSTRIEL">BTS INDUSTRIEL</SelectItem>
                  <SelectItem value="LICENCE/MASTER">LICENCE/MASTER</SelectItem>
                  <SelectItem value="CERTIFICAT">CERTIFICAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Niveau</Label>
              <Input
                id="level"
                value={formData.level}
                onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
                placeholder="Ex: BTS, Licence, Master"
                data-testid="input-program-level"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Durée</Label>
              <Input
                id="duration"
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                placeholder="Ex: 2 ans, 3 ans"
                data-testid="input-program-duration"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description de la filière, objectifs, débouchés..."
              rows={3}
              data-testid="textarea-program-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order">Ordre d'affichage</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData(prev => ({ ...prev, order: e.target.value }))}
                placeholder="Ex: 1, 2, 3..."
                data-testid="input-program-order"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="isActive">Statut</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  data-testid="switch-program-active"
                />
                <Label htmlFor="isActive">
                  {formData.isActive ? "Active" : "Inactive"}
                </Label>
              </div>
            </div>
          </div>

          {/* Image Upload Section */}
          <div className="space-y-3">
            <Label>Image de la filière</Label>
            
            {previewImage ? (
              <div className="relative">
                <img 
                  src={previewImage} 
                  alt="Aperçu" 
                  className="w-full h-48 object-cover rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                  data-testid="button-remove-image"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-2">Aucune image sélectionnée</p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                data-testid="button-upload-image"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadingImage ? "Upload en cours..." : "Choisir une image"}
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              className="bg-orange-600 hover:bg-orange-700"
              disabled={isSubmitting}
              data-testid="button-submit"
            >
              {isSubmitting 
                ? (editingProgram ? "Modification..." : "Création...") 
                : (editingProgram ? "Modifier" : "Créer")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}