import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, Edit, Plus, Save, X } from "lucide-react";
import type { Institute, InsertInstitute, UpdateInstitute } from "@shared/schema";

export default function AdminInstitutes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<InsertInstitute>>({
    title: "",
    description: "",
    link: "/filieres",
    buttonText: "EN SAVOIR PLUS",
    bgColor: "from-gray-800 to-gray-900",
    order: "1"
  });

  // Fetch institutes
  const { data: institutesData, isLoading } = useQuery<{ success: boolean; institutes: Institute[] }>({
    queryKey: ["/api/admin/institutes"],
  });

  const institutes = institutesData?.institutes || [];

  // Create institute mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertInstitute) => {
      return await apiRequest("POST", "/api/admin/institutes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/institutes"] });
      toast({
        title: "Succès",
        description: "Institut créé avec succès",
      });
      setShowAddForm(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création",
        variant: "destructive",
      });
    },
  });

  // Update institute mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInstitute }) => {
      return await apiRequest("PUT", `/api/admin/institutes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/institutes"] });
      toast({
        title: "Succès",
        description: "Institut mis à jour avec succès",
      });
      setEditingId(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la mise à jour",
        variant: "destructive",
      });
    },
  });

  // Delete institute mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/institutes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/institutes"] });
      toast({
        title: "Succès",
        description: "Institut supprimé avec succès",
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

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      link: "/filieres",
      buttonText: "EN SAVOIR PLUS",
      bgColor: "from-gray-800 to-gray-900",
      order: "1"
    });
  };

  const handleSubmit = () => {
    if (!formData.title?.trim()) {
      toast({
        title: "Erreur",
        description: "Le titre est obligatoire",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ 
        id: editingId, 
        data: formData as UpdateInstitute 
      });
    } else {
      createMutation.mutate(formData as InsertInstitute);
    }
  };

  const startEdit = (institute: Institute) => {
    setFormData({
      title: institute.title,
      description: institute.description ?? "",
      link: institute.link ?? "/filieres",
      buttonText: institute.buttonText ?? "EN SAVOIR PLUS",
      bgColor: institute.bgColor ?? "from-gray-800 to-gray-900",
      order: institute.order ?? "1"
    });
    setEditingId(institute.id);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowAddForm(false);
    resetForm();
  };

  const handleToggleActive = (institute: Institute) => {
    updateMutation.mutate({
      id: institute.id,
      data: { isActive: !institute.isActive }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" data-testid="admin-institutes-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
          Gestion des Instituts
        </h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Gérez les instituts affichés sur la page d'accueil
        </p>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <Card className="mb-8" data-testid="card-institute-form">
          <CardHeader>
            <CardTitle data-testid="text-form-title">
              {editingId ? "Modifier l'Institut" : "Ajouter un Institut"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                value={formData.title || ""}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Nom de l'institut"
                data-testid="input-title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description optionnelle"
                data-testid="textarea-description"
              />
            </div>

            <div>
              <Label htmlFor="link">Lien</Label>
              <Input
                id="link"
                value={formData.link || ""}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="/filieres"
                data-testid="input-link"
              />
            </div>

            <div>
              <Label htmlFor="buttonText">Texte du bouton</Label>
              <Input
                id="buttonText"
                value={formData.buttonText || ""}
                onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                placeholder="EN SAVOIR PLUS"
                data-testid="input-button-text"
              />
            </div>

            <div>
              <Label htmlFor="bgColor">Couleur de fond (gradient)</Label>
              <Select 
                value={formData.bgColor || "from-gray-800 to-gray-900"} 
                onValueChange={(value) => setFormData({ ...formData, bgColor: value })}
              >
                <SelectTrigger data-testid="select-bg-color">
                  <SelectValue placeholder="Choisir un gradient" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="from-gray-800 to-gray-900">Gris foncé</SelectItem>
                  <SelectItem value="from-blue-800 to-blue-900">Bleu foncé</SelectItem>
                  <SelectItem value="from-green-800 to-green-900">Vert foncé</SelectItem>
                  <SelectItem value="from-orange-800 to-orange-900">Orange foncé</SelectItem>
                  <SelectItem value="from-purple-800 to-purple-900">Violet foncé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="order">Ordre d'affichage</Label>
              <Input
                id="order"
                value={formData.order || ""}
                onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                placeholder="1"
                data-testid="input-order"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                {editingId ? "Mettre à jour" : "Créer"}
              </Button>
              <Button
                variant="outline"
                onClick={cancelEdit}
                data-testid="button-cancel"
              >
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Button */}
      {!showAddForm && !editingId && (
        <Button
          onClick={() => setShowAddForm(true)}
          className="mb-6"
          data-testid="button-add-institute"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un Institut
        </Button>
      )}

      {/* Institutes List */}
      <div className="grid gap-6">
        {institutes.map((institute, index) => (
          <Card key={institute.id} data-testid={`card-institute-${index}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle data-testid={`text-institute-title-${index}`}>
                    {institute.title}
                  </CardTitle>
                  <CardDescription data-testid={`text-institute-description-${index}`}>
                    {institute.description || "Aucune description"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={institute.isActive ?? true}
                    onCheckedChange={() => handleToggleActive(institute)}
                    data-testid={`switch-active-${index}`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {institute.isActive ? "Actif" : "Inactif"}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Lien:</span>
                  <p className="text-sm" data-testid={`text-institute-link-${index}`}>
                    {institute.link ?? "/filieres"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Bouton:</span>
                  <p className="text-sm" data-testid={`text-institute-button-${index}`}>
                    {institute.buttonText || "EN SAVOIR PLUS"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Ordre:</span>
                  <p className="text-sm" data-testid={`text-institute-order-${index}`}>
                    {institute.order ?? "1"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(institute)}
                  data-testid={`button-edit-${index}`}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteMutation.mutate(institute.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${index}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {institutes.length === 0 && (
          <Card data-testid="card-no-institutes">
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">Aucun institut configuré</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}