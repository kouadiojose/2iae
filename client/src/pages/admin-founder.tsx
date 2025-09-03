import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type FounderMessage, type UpdateFounderMessage } from "@shared/schema";
import { Upload, Save, ImageIcon, User } from "lucide-react";

export default function AdminFounder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [formData, setFormData] = useState<Partial<UpdateFounderMessage>>({
    title: "",
    quote: "",
    vision: "",
    founderName: "",
    founderRole: "",
    founderOrganization: "",
    founderImageUrl: ""
    // imageData removed - using founderImageUrl with physical storage
  });
  
  const [isUploading, setIsUploading] = useState(false);

  // Query pour récupérer le message du fondateur
  const { data: founderData, isLoading } = useQuery({
    queryKey: ["/api/admin/founder-message"],
  });

  // Mutation pour mettre à jour le message du fondateur
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateFounderMessage) => {
      const response = await apiRequest("PUT", "/api/admin/founder-message", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/founder-message"] });
      toast({
        title: "Succès",
        description: "Le message du fondateur a été mis à jour avec succès.",
      });
    },
    onError: (error) => {
      console.error("Erreur lors de la mise à jour:", error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la mise à jour.",
        variant: "destructive",
      });
    },
  });

  // Synchroniser les données du formulaire avec les données récupérées
  useEffect(() => {
    if (founderData && typeof founderData === 'object' && 'founderMessage' in founderData && founderData.founderMessage) {
      const data = founderData.founderMessage as FounderMessage;
      setFormData({
        title: data.title || "",
        quote: data.quote || "",
        vision: data.vision || "",
        founderName: data.founderName || "",
        founderRole: data.founderRole || "",
        founderOrganization: data.founderOrganization || "",
        founderImageUrl: data.founderImageUrl || ""
        // imageData: data.imageData || "" // Removed - no longer exists
      });
    }
  }, [founderData]);

  const handleInputChange = (field: keyof UpdateFounderMessage, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation des champs requis
    if (!formData.title || !formData.quote || !formData.vision || !formData.founderName || !formData.founderRole || !formData.founderOrganization) {
      toast({
        title: "Erreur de validation",
        description: "Tous les champs obligatoires doivent être renseignés.",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate(formData as UpdateFounderMessage);
  };

  // NOUVEAU SYSTÈME: Upload de fichier physique pour founder
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérification du type de fichier
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Type de fichier invalide",
        description: "Veuillez sélectionner un fichier image.",
        variant: "destructive",
      });
      return;
    }

    // Vérification de la taille (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "L'image ne doit pas dépasser 10 MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Créer FormData pour l'upload
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);
      
      // Upload vers le backend (stockage physique)
      const response = await fetch('/api/admin/founder/upload', {
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
          founderImageUrl: result.image.imageUrl
          // imageData removed - using founderImageUrl with physical storage
        }));
        
        console.log('✅ Image founder uploadée:', result.image.imageUrl);
        
        toast({
          title: "Succès",
          description: "Image uploadée avec succès",
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('❌ Erreur upload founder:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'upload de l'image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <User className="h-8 w-8 text-[#E67E22]" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion du Message du Fondateur</h1>
          <p className="text-gray-600">Modifiez le message et les informations du fondateur affichés sur le site</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Message du Fondateur
          </CardTitle>
          <CardDescription>
            Personnalisez le message inspirant du fondateur et ses informations personnelles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Titre */}
            <div className="space-y-2">
              <Label htmlFor="title">Titre de la section *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="ex: Message du Fondateur"
                required
                data-testid="input-title"
              />
            </div>

            {/* Citation inspirante */}
            <div className="space-y-2">
              <Label htmlFor="quote">Citation inspirante *</Label>
              <Textarea
                id="quote"
                value={formData.quote}
                onChange={(e) => handleInputChange("quote", e.target.value)}
                placeholder="Une citation motivante du fondateur..."
                rows={3}
                required
                data-testid="textarea-quote"
              />
            </div>

            {/* Vision/Message développé */}
            <div className="space-y-2">
              <Label htmlFor="vision">Vision et message développé *</Label>
              <Textarea
                id="vision"
                value={formData.vision}
                onChange={(e) => handleInputChange("vision", e.target.value)}
                placeholder="Le message complet du fondateur expliquant sa vision..."
                rows={6}
                required
                data-testid="textarea-vision"
              />
            </div>

            {/* Informations du fondateur */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="founderName">Nom du fondateur *</Label>
                <Input
                  id="founderName"
                  value={formData.founderName}
                  onChange={(e) => handleInputChange("founderName", e.target.value)}
                  placeholder="Dr. Prénom NOM"
                  required
                  data-testid="input-founder-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="founderRole">Fonction *</Label>
                <Input
                  id="founderRole"
                  value={formData.founderRole}
                  onChange={(e) => handleInputChange("founderRole", e.target.value)}
                  placeholder="Fondateur et Directeur Général"
                  required
                  data-testid="input-founder-role"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="founderOrganization">Organisation *</Label>
                <Input
                  id="founderOrganization"
                  value={formData.founderOrganization}
                  onChange={(e) => handleInputChange("founderOrganization", e.target.value)}
                  placeholder="2IAE International"
                  required
                  data-testid="input-founder-organization"
                />
              </div>
            </div>

            {/* Photo du fondateur */}
            <div className="space-y-4">
              <Label>Photo du fondateur</Label>
              
              {/* Aperçu de l'image actuelle */}
              {formData.founderImageUrl && (
                <div className="relative w-32 h-32 border-2 border-gray-200 rounded-lg overflow-hidden">
                  <img 
                    src={formData.founderImageUrl!} 
                    alt="Photo du fondateur"
                    className="w-full h-full object-cover"
                    onLoad={() => console.log('✅ Image fondateur chargée:', formData.founderImageUrl)}
                    onError={(e) => {
                      console.error('❌ Image fondateur failed to load:', formData.founderImageUrl);
                      console.error('Error details:', e);
                    }}
                  />
                </div>
              )}
              
              {/* Upload d'image */}
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('image-upload')?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2"
                  data-testid="button-upload-image"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#E67E22]"></div>
                      Upload en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {formData.founderImageUrl ? "Changer la photo" : "Ajouter une photo"}
                    </>
                  )}
                </Button>
                
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                {formData.founderImageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setFormData(prev => ({ 
                        ...prev, 
                        founderImageUrl: ""
                        // imageData: "" // Removed - no longer exists
                      }));
                    }}
                    className="text-red-600 hover:text-red-800"
                    data-testid="button-remove-image"
                  >
                    Supprimer
                  </Button>
                )}
              </div>
              
              <p className="text-sm text-gray-500">
                Formats acceptés: JPG, PNG, GIF. Taille maximale: 10 MB.
              </p>
            </div>

            {/* Bouton de sauvegarde */}
            <div className="pt-6 border-t">
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                className="bg-[#E67E22] hover:bg-[#D35400] text-white flex items-center gap-2"
                data-testid="button-save"
              >
                {updateMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Sauvegarder les modifications
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}