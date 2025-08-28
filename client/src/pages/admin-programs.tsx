import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import type { Program, InsertProgram, UpdateProgram } from "@shared/schema";

export default function AdminPrograms() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<InsertProgram>>({
    name: "",
    category: "",
    description: "",
    imageUrl: "",
    duration: "",
    level: "",
    order: "1"
  });

  // Fetch programs data
  const { data: programsData, isLoading } = useQuery<{ success: boolean; programs: Program[] }>({
    queryKey: ["/api/admin/programs"],
  });

  const programs = programsData?.programs || [];

  // Create program mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertProgram) => {
      return await apiRequest("POST", "/api/admin/programs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programs"] });
      toast({
        title: "Succès",
        description: "Filière créée avec succès",
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

  // Update program mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProgram }) => {
      return await apiRequest("PUT", `/api/admin/programs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programs"] });
      toast({
        title: "Succès",
        description: "Filière mise à jour avec succès",
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

  // Delete program mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/programs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programs"] });
      toast({
        title: "Succès",
        description: "Filière supprimée avec succès",
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
      name: "",
      category: "",
      description: "",
      imageUrl: "",
      duration: "",
      level: "",
      order: "1"
    });
  };

  const handleSubmit = () => {
    if (!formData.name?.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom de la filière est obligatoire",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category?.trim()) {
      toast({
        title: "Erreur",
        description: "La catégorie est obligatoire",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ 
        id: editingId, 
        data: formData as UpdateProgram 
      });
    } else {
      createMutation.mutate(formData as InsertProgram);
    }
  };

  const startEdit = (program: Program) => {
    setFormData({
      name: program.name,
      category: program.category,
      description: program.description ?? "",
      imageUrl: program.imageUrl ?? "",
      duration: program.duration ?? "",
      level: program.level ?? "",
      order: program.order ?? "1"
    });
    setEditingId(program.id);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const handleToggleActive = (program: Program) => {
    updateMutation.mutate({
      id: program.id,
      data: { isActive: !program.isActive }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" data-testid="page-admin-programs">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Gestion des Filières
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            Gérez les programmes et filières de l'école
          </p>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <Card className="mb-8" data-testid="card-program-form">
          <CardHeader>
            <CardTitle data-testid="text-form-title">
              {editingId ? "Modifier la Filière" : "Ajouter une Filière"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nom de la filière *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Licence en Management"
                  data-testid="input-name"
                />
              </div>

              <div>
                <Label htmlFor="category">Catégorie *</Label>
                <Select 
                  value={formData.category || ""} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Choisir une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="licence">Licence</SelectItem>
                    <SelectItem value="master">Master</SelectItem>
                    <SelectItem value="mba">MBA</SelectItem>
                    <SelectItem value="formation-continue">Formation Continue</SelectItem>
                    <SelectItem value="certificat">Certificat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description complète</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description détaillée de la filière, objectifs, débouchés..."
                rows={4}
                data-testid="textarea-description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Durée</Label>
                <Input
                  id="duration"
                  value={formData.duration || ""}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="Ex: 3 ans, 2 semestres..."
                  data-testid="input-duration"
                />
              </div>

              <div>
                <Label htmlFor="level">Niveau</Label>
                <Select 
                  value={formData.level || ""} 
                  onValueChange={(value) => setFormData({ ...formData, level: value })}
                >
                  <SelectTrigger data-testid="select-level">
                    <SelectValue placeholder="Choisir un niveau" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bac">Bac</SelectItem>
                    <SelectItem value="bac+1">Bac+1</SelectItem>
                    <SelectItem value="bac+2">Bac+2</SelectItem>
                    <SelectItem value="bac+3">Bac+3</SelectItem>
                    <SelectItem value="bac+4">Bac+4</SelectItem>
                    <SelectItem value="bac+5">Bac+5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="imageUrl">URL de l'image</Label>
                <Input
                  id="imageUrl"
                  value={formData.imageUrl || ""}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://... ou /assets/..."
                  data-testid="input-image-url"
                />
              </div>

              <div>
                <Label htmlFor="order">Ordre d'affichage</Label>
                <Input
                  id="order"
                  type="number"
                  value={formData.order || ""}
                  onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                  placeholder="1"
                  data-testid="input-order"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
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
                onClick={() => {
                  if (editingId) {
                    cancelEdit();
                  } else {
                    setShowAddForm(false);
                    resetForm();
                  }
                }}
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
          data-testid="button-add-program"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une Filière
        </Button>
      )}

      {/* Programs List */}
      <div className="grid gap-6">
        {programs.map((program, index) => (
          <Card key={program.id} data-testid={`card-program-${index}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle data-testid={`text-program-name-${index}`}>
                    {program.name}
                  </CardTitle>
                  <CardDescription data-testid={`text-program-category-${index}`}>
                    {program.category}
                  </CardDescription>
                  {program.description && (
                    <p className="text-sm text-muted-foreground mt-2" data-testid={`text-program-description-${index}`}>
                      {program.description.length > 150 
                        ? `${program.description.substring(0, 150)}...`
                        : program.description
                      }
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={program.isActive ?? true}
                    onCheckedChange={() => handleToggleActive(program)}
                    data-testid={`switch-active-${index}`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {program.isActive ? "Actif" : "Inactif"}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Durée:</span>
                  <p className="text-sm" data-testid={`text-program-duration-${index}`}>
                    {program.duration || "Non spécifiée"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Niveau:</span>
                  <p className="text-sm" data-testid={`text-program-level-${index}`}>
                    {program.level || "Non spécifié"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Ordre:</span>
                  <p className="text-sm" data-testid={`text-program-order-${index}`}>
                    {program.order ?? "1"}
                  </p>
                </div>
              </div>

              {program.imageUrl && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-muted-foreground">Image:</span>
                  <p className="text-sm text-blue-600 break-all" data-testid={`text-program-image-${index}`}>
                    {program.imageUrl}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(program)}
                  data-testid={`button-edit-${index}`}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteMutation.mutate(program.id)}
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

        {programs.length === 0 && (
          <Card data-testid="card-no-programs">
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground mb-4">Aucune filière configurée</p>
              <Button onClick={() => setShowAddForm(true)} data-testid="button-add-first-program">
                <Plus className="h-4 w-4 mr-2" />
                Créer la première filière
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}