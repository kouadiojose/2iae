import { useEffect } from "react";
import { useAdmin, useAdminLogout } from "@/hooks/useAdmin";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Settings, 
  FileText, 
  Users, 
  MessageSquare, 
  LogOut, 
  Edit3,
  Eye
} from "lucide-react";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { admin, isAuthenticated, isLoading } = useAdmin();
  const { toast } = useToast();
  const logoutMutation = useAdminLogout();

  // Get site content statistics
  const { data: contentData } = useQuery({
    queryKey: ["/api/admin/content"],
    enabled: isAuthenticated,
  });

  // Get contacts statistics  
  const { data: contactsData } = useQuery({
    queryKey: ["/api/contacts"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Déconnexion réussie",
          description: "À bientôt !",
        });
        setLocation("/admin/login");
      },
    });
  };

  if (isLoading) {
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

  const contentCount = (contentData as any)?.content?.length || 0;
  const contactsCount = (contactsData as any)?.contacts?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-primary mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Administration 2IAE
                </h1>
                <p className="text-sm text-gray-500">Tableau de bord</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{admin.username}</p>
                <p className="text-xs text-gray-500">{admin.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                data-testid="button-admin-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Bienvenue, {admin.username} !
          </h2>
          <p className="text-gray-600">
            Gérez facilement le contenu et les paramètres de votre site web 2IAE International.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Contenus</p>
                  <p className="text-2xl font-bold text-gray-900">{contentCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <MessageSquare className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Contacts</p>
                  <p className="text-2xl font-bold text-gray-900">{contactsCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Administrateurs</p>
                  <p className="text-2xl font-bold text-gray-900">1</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Badge variant="outline" className="text-green-600 border-green-600">
                  En ligne
                </Badge>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Statut</p>
                  <p className="text-lg font-bold text-gray-900">Actif</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Edit3 className="h-5 w-5 mr-2" />
                Gestion du contenu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Modifiez les textes, images et autres contenus du site web.
              </p>
              <Button 
                onClick={() => setLocation("/admin/content")}
                className="w-full"
                data-testid="button-manage-content"
              >
                Gérer le contenu
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="h-5 w-5 mr-2" />
                Voir le site
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Consultez le site web public pour voir vos modifications.
              </p>
              <Button 
                variant="outline"
                onClick={() => window.open("/", "_blank")}
                className="w-full"
                data-testid="button-view-site"
              >
                Ouvrir le site
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}