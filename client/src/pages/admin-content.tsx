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
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  ArrowLeft, 
  Edit3, 
  Save, 
  Plus,
  FileText,
  Image,
  Type,
  AlignLeft
} from "lucide-react";

interface SiteContent {
  id: string;
  key: string;
  title: string;
  value: string;
  type: string;
  section: string;
  order: string;
  updatedAt: string;
}

export default function AdminContent() {
  const [, setLocation] = useLocation();
  const { admin, isAuthenticated, isLoading } = useAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<SiteContent | null>(null);
  const [editValue, setEditValue] = useState("");

  // Get all site content
  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ["/api/admin/content"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  // Update content mutation
  const updateMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/admin/content/${key}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content"] });
      toast({
        title: "Succès",
        description: "Contenu mis à jour avec succès",
      });
      setEditingItem(null);
      setEditValue("");
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la mise à jour",
        variant: "destructive",
      });
    }
  });

  const handleEdit = (item: SiteContent) => {
    setEditingItem(item);
    setEditValue(item.value);
  };

  const handleSave = () => {
    if (!editingItem) return;
    
    updateMutation.mutate({
      key: editingItem.key,
      data: { value: editValue }
    });
  };

  const handleCancel = () => {
    setEditingItem(null);
    setEditValue("");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "text":
        return <Type className="h-4 w-4" />;
      case "textarea":
        return <AlignLeft className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "text":
        return "bg-blue-100 text-blue-800";
      case "textarea":
        return "bg-green-100 text-green-800";
      case "image":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const groupedContent = (contentData as any)?.content?.reduce((acc: any, item: SiteContent) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {}) || {};

  if (isLoading || contentLoading) {
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
                  Gestion du contenu
                </h1>
                <p className="text-sm text-gray-500">Modifiez les textes et images du site</p>
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
        {Object.entries(groupedContent).map(([section, items]) => (
          <div key={section} className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 capitalize">
              Section: {section}
            </h2>
            
            <div className="grid gap-6">
              {(items as SiteContent[]).map((item) => (
                <Card key={item.id}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center">
                        {getTypeIcon(item.type)}
                        <span className="ml-2">{item.title}</span>
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className={getTypeColor(item.type)}>
                          {item.type}
                        </Badge>
                        {editingItem?.id !== item.id && (
                          <Button
                            size="sm"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.key}`}
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Modifier
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editingItem?.id === item.id ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="edit-value">Contenu</Label>
                          {item.type === "textarea" ? (
                            <Textarea
                              id="edit-value"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              rows={4}
                              className="mt-1"
                              data-testid="textarea-edit-content"
                            />
                          ) : (
                            <Input
                              id="edit-value"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="mt-1"
                              data-testid="input-edit-content"
                            />
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                            data-testid="button-save-content"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            {updateMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleCancel}
                            disabled={updateMutation.isPending}
                            data-testid="button-cancel-edit"
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-900 whitespace-pre-wrap">
                            {item.value}
                          </p>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Clé: <code className="bg-gray-100 px-1 rounded">{item.key}</code>
                          {" • "}
                          Dernière modification: {new Date(item.updatedAt).toLocaleString("fr-FR")}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {Object.keys(groupedContent).length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun contenu trouvé
              </h3>
              <p className="text-gray-500">
                Il n'y a actuellement aucun contenu à gérer.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}