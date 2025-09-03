import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, GraduationCap } from "lucide-react";
import { ProgramModal } from "@/components/ProgramModal";
import type { Program } from "@shared/schema";

export default function AdminPrograms() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  // Fetch programs data
  const { data: programsData, isLoading } = useQuery<{ success: boolean; programs: Program[] }>({
    queryKey: ["/api/admin/programs"],
  });

  const programs = programsData?.programs || [];

  // Delete program mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/programs/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
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

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest(`/api/admin/programs/${id}`, "PUT", { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
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

  const handleCreate = () => {
    setEditingProgram(null);
    setModalOpen(true);
  };

  const handleEdit = (program: Program) => {
    setEditingProgram(program);
    setModalOpen(true);
  };

  const handleDelete = (program: Program) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la filière "${program.name}" ?`)) {
      deleteMutation.mutate(program.id);
    }
  };

  const handleToggleActive = (program: Program) => {
    toggleActiveMutation.mutate({
      id: program.id,
      isActive: !program.isActive
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "BTS TERTIAIRES":
        return "bg-blue-100 text-blue-800";
      case "BTS INDUSTRIEL":
        return "bg-green-100 text-green-800";
      case "LICENCE/MASTER":
        return "bg-purple-100 text-purple-800";
      case "CERTIFICAT":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
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
        <Button 
          onClick={handleCreate}
          className="bg-orange-600 hover:bg-orange-700"
          data-testid="button-create-program"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle Filière
        </Button>
      </div>

      {/* Programs List */}
      <div className="grid gap-4">
        {programs.length === 0 ? (
          <Card data-testid="card-empty-state">
            <CardContent className="text-center py-12">
              <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                Aucune filière trouvée
              </h3>
              <p className="text-gray-500 mb-4">
                Commencez par créer votre première filière
              </p>
              <Button 
                onClick={handleCreate}
                className="bg-orange-600 hover:bg-orange-700"
                data-testid="button-create-first-program"
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer une filière
              </Button>
            </CardContent>
          </Card>
        ) : (
          programs.map((program) => (
            <Card key={program.id} data-testid={`card-program-${program.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold" data-testid={`text-program-name-${program.id}`}>
                        {program.name}
                      </h3>
                      <span 
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(program.category)}`}
                        data-testid={`badge-program-category-${program.id}`}
                      >
                        {program.category}
                      </span>
                      <Switch
                        checked={program.isActive}
                        onCheckedChange={() => handleToggleActive(program)}
                        disabled={toggleActiveMutation.isPending}
                        data-testid={`switch-program-active-${program.id}`}
                      />
                    </div>
                    
                    {program.description && (
                      <p className="text-gray-600 mb-3" data-testid={`text-program-description-${program.id}`}>
                        {program.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {program.level && (
                        <span data-testid={`text-program-level-${program.id}`}>
                          Niveau: {program.level}
                        </span>
                      )}
                      {program.duration && (
                        <span data-testid={`text-program-duration-${program.id}`}>
                          Durée: {program.duration}
                        </span>
                      )}
                      {program.order && (
                        <span data-testid={`text-program-order-${program.id}`}>
                          Ordre: {program.order}
                        </span>
                      )}
                    </div>
                    
                    {program.imageUrl && (
                      <div className="mt-3">
                        <img 
                          src={program.imageUrl} 
                          alt={program.name}
                          className="w-20 h-12 object-cover rounded border"
                          data-testid={`img-program-preview-${program.id}`}
                          onLoad={() => console.log('✅ Image program liste chargée:', program.imageUrl)}
                          onError={(e) => {
                            console.error('❌ Image program liste failed to load:', program.imageUrl);
                            console.error('Error details:', e);
                            // Force reload for DigitalOcean Spaces
                            if (program.imageUrl?.includes('digitaloceanspaces.com')) {
                              setTimeout(() => {
                                const img = e.target as HTMLImageElement;
                                img.src = program.imageUrl + '?v=' + Date.now();
                              }, 2000);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(program)}
                      data-testid={`button-edit-program-${program.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(program)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-program-${program.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Program Modal */}
      <ProgramModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingProgram={editingProgram}
      />
    </div>
  );
}