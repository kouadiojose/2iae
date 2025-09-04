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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  ArrowLeft, 
  Edit3, 
  Save, 
  Home,
  FileText,
  Users,
  Phone,
  Building,
  Image as ImageIcon,
  Type,
  Link as LinkIcon,
  Quote,
  Star,
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

// Structure logique du site pour l'admin
const siteStructure = {
  accueil: {
    title: "Page d'Accueil",
    icon: Home,
    sections: {
      hero: {
        title: "Bannière Principale (Slider)",
        description: "Slider avec 3 slides présentant l'école",
        elements: [
          { key: "hero_slide1_title", label: "Slide 1 - Grand Titre", type: "text" },
          { key: "hero_slide1_subtitle", label: "Slide 1 - Sous-titre", type: "text" },
          { key: "hero_slide1_description", label: "Slide 1 - Description", type: "textarea" },
          { key: "hero_slide1_btn_primary", label: "Slide 1 - Bouton Principal", type: "text" },
          { key: "hero_slide1_btn_primary_link", label: "Slide 1 - Lien Bouton Principal", type: "text" },
          { key: "hero_slide1_btn_secondary", label: "Slide 1 - Bouton Secondaire", type: "text" },
          { key: "hero_slide1_btn_secondary_link", label: "Slide 1 - Lien Bouton Secondaire", type: "text" },
          { key: "hero_slide1_image", label: "Slide 1 - Image", type: "image" },
        ]
      },
      founder: {
        title: "Message du Fondateur",
        description: "Section avec photo et message du directeur général",
        elements: [
          { key: "founder_badge", label: "Badge (ex: Message du Fondateur)", type: "text" },
          { key: "founder_title", label: "Titre Principal", type: "text" },
          { key: "founder_quote", label: "Citation/Déclaration", type: "textarea" },
          { key: "founder_vision", label: "Vision/Description", type: "textarea" },
          { key: "founder_role", label: "Rôle du Fondateur", type: "text" },
          { key: "founder_organization", label: "Organisation", type: "text" },
          { key: "founder_image", label: "Photo du Fondateur", type: "image" },
        ]
      },
      institutes: {
        title: "Nos Instituts",
        description: "Section présentant les 3 instituts de formation",
        elements: [
          { key: "institutes_title", label: "Titre de Section", type: "text" },
          { key: "institutes_subtitle", label: "Sous-titre de Section", type: "text" },
          { key: "institute1_title", label: "Institut 1 - Titre", type: "text" },
          { key: "institute2_title", label: "Institut 2 - Titre", type: "text" },
          { key: "institute3_title", label: "Institut 3 - Titre", type: "text" },
        ]
      },
      features: {
        title: "Pourquoi Nous Choisir",
        description: "4 points forts avec icônes",
        elements: [
          { key: "features_title", label: "Titre de Section", type: "text" },
          { key: "features_subtitle", label: "Sous-titre de Section", type: "text" },
          { key: "feature1_title", label: "Fonctionnalité 1 - Titre", type: "text" },
          { key: "feature1_description", label: "Fonctionnalité 1 - Description", type: "text" },
          { key: "feature2_title", label: "Fonctionnalité 2 - Titre", type: "text" },
          { key: "feature2_description", label: "Fonctionnalité 2 - Description", type: "text" },
          { key: "feature3_title", label: "Fonctionnalité 3 - Titre", type: "text" },
          { key: "feature3_description", label: "Fonctionnalité 3 - Description", type: "text" },
          { key: "feature4_title", label: "Fonctionnalité 4 - Titre", type: "text" },
          { key: "feature4_description", label: "Fonctionnalité 4 - Description", type: "text" },
        ]
      },
      cta: {
        title: "Appel à l'Action",
        description: "Section finale avec boutons d'action",
        elements: [
          { key: "cta_title", label: "Titre CTA", type: "text" },
          { key: "cta_subtitle", label: "Sous-titre CTA", type: "text" },
          { key: "cta_btn1_text", label: "Bouton 1 - Texte", type: "text" },
          { key: "cta_btn1_link", label: "Bouton 1 - Lien", type: "text" },
          { key: "cta_btn2_text", label: "Bouton 2 - Texte", type: "text" },
          { key: "cta_btn2_link", label: "Bouton 2 - Lien", type: "text" },
        ]
      }
    }
  },
  filieres: {
    title: "Page Filières",
    icon: FileText,
    sections: {
      header: {
        title: "En-tête de Page",
        description: "Titre et description de la page filières",
        elements: [
          { key: "filieres_page_title", label: "Titre de Page", type: "text" },
          { key: "filieres_page_subtitle", label: "Sous-titre de Page", type: "text" },
        ]
      },
      programs: {
        title: "Programmes de Formation",
        description: "Liste des filières disponibles",
        elements: [
          { key: "program1_title", label: "Programme 1 - Titre", type: "text" },
          { key: "program1_description", label: "Programme 1 - Description", type: "textarea" },
          { key: "program1_duration", label: "Programme 1 - Durée", type: "text" },
          { key: "program2_title", label: "Programme 2 - Titre", type: "text" },
          { key: "program2_description", label: "Programme 2 - Description", type: "textarea" },
          { key: "program3_title", label: "Programme 3 - Titre", type: "text" },
          { key: "program3_description", label: "Programme 3 - Description", type: "textarea" },
        ]
      }
    }
  },
  apropos: {
    title: "Page À Propos",
    icon: Users,
    sections: {
      header: {
        title: "En-tête de Page",
        description: "Titre et description de la page à propos",
        elements: [
          { key: "apropos_page_title", label: "Titre de Page", type: "text" },
          { key: "apropos_page_subtitle", label: "Sous-titre de Page", type: "text" },
        ]
      },
      mission: {
        title: "Notre Mission",
        description: "Mission et vision de l'école",
        elements: [
          { key: "mission_badge", label: "Badge Mission", type: "text" },
          { key: "mission_title", label: "Titre Mission", type: "text" },
          { key: "mission_paragraph1", label: "Paragraphe 1", type: "textarea" },
          { key: "mission_paragraph2", label: "Paragraphe 2", type: "textarea" },
          { key: "mission_paragraph3", label: "Paragraphe 3", type: "textarea" },
          { key: "mission_image", label: "Image Mission", type: "image" },
        ]
      }
    }
  },
  contact: {
    title: "Page Contact", 
    icon: Phone,
    sections: {
      header: {
        title: "En-tête Contact",
        description: "Informations de contact et formulaire",
        elements: [
          { key: "contact_page_title", label: "Titre de Page", type: "text" },
          { key: "contact_page_subtitle", label: "Sous-titre de Page", type: "text" },
          { key: "contact_address", label: "Adresse", type: "textarea" },
          { key: "contact_phone", label: "Téléphone", type: "text" },
          { key: "contact_email", label: "Email", type: "text" },
        ]
      }
    }
  }
};

export default function AdminContent() {
  const [, setLocation] = useLocation();
  const { admin, isAuthenticated, isLoading } = useAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<{ key: string; label: string; type: string; value: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedPage, setSelectedPage] = useState("accueil");

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
      const response = await apiRequest(`/api/admin/content/${key}`, "PUT", data);
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

  const handleEdit = (element: { key: string; label: string; type: string }, currentValue: string = "") => {
    setEditingItem({ ...element, value: currentValue });
    setEditValue(currentValue);
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
        return <ImageIcon className="h-4 w-4" />;
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

  // Helper function to get current value for an element
  const getCurrentValue = (key: string): string => {
    const content = (contentData as any)?.content;
    if (!content) return "";
    const item = content.find((item: SiteContent) => item.key === key);
    return item ? item.value : "";
  };

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

  const currentPageData = siteStructure[selectedPage as keyof typeof siteStructure];

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
                <p className="text-sm text-gray-500">Modifiez les contenus par page et section</p>
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
        {/* Page Selection Tabs */}
        <Tabs value={selectedPage} onValueChange={setSelectedPage} className="w-full mb-8">
          <TabsList className="grid w-full grid-cols-4">
            {Object.entries(siteStructure).map(([pageKey, pageData]) => {
              const IconComponent = pageData.icon;
              return (
                <TabsTrigger key={pageKey} value={pageKey} className="flex items-center space-x-2">
                  <IconComponent className="h-4 w-4" />
                  <span>{pageData.title}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Page Content */}
          {Object.entries(siteStructure).map(([pageKey, pageData]) => (
            <TabsContent key={pageKey} value={pageKey} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <pageData.icon className="h-5 w-5 mr-2" />
                    {pageData.title}
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* Sections */}
              <Accordion type="single" collapsible className="w-full">
                {Object.entries(pageData.sections).map(([sectionKey, sectionData]) => (
                  <AccordionItem key={sectionKey} value={sectionKey}>
                    <AccordionTrigger className="text-left">
                      <div>
                        <h3 className="text-lg font-semibold">{sectionData.title}</h3>
                        <p className="text-sm text-gray-500">{sectionData.description}</p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 pt-4">
                        {sectionData.elements.map((element) => {
                          const currentValue = getCurrentValue(element.key);
                          const isEditing = editingItem?.key === element.key;
                          
                          return (
                            <Card key={element.key}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    {getTypeIcon(element.type)}
                                    <div>
                                      <h4 className="font-medium">{element.label}</h4>
                                      <Badge variant="outline" className={getTypeColor(element.type)}>
                                        {element.type}
                                      </Badge>
                                    </div>
                                  </div>
                                  {!isEditing && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleEdit(element, currentValue)}
                                      data-testid={`button-edit-${element.key}`}
                                    >
                                      <Edit3 className="h-4 w-4 mr-2" />
                                      Modifier
                                    </Button>
                                  )}
                                </div>

                                {isEditing ? (
                                  <div className="space-y-3">
                                    <div>
                                      <Label htmlFor="edit-value">Contenu</Label>
                                      {element.type === "textarea" ? (
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
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                      <p className="text-gray-900 whitespace-pre-wrap">
                                        {currentValue || <em className="text-gray-400">Aucun contenu</em>}
                                      </p>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500">
                                      Clé: <code className="bg-gray-100 px-1 rounded">{element.key}</code>
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}