import { useState } from "react";
import { useAdminLogin, useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { admin, isAuthenticated } = useAdmin();
  const loginMutation = useAdminLogin();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/admin/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    loginMutation.mutate(
      { username, password },
      {
        onSuccess: async (data) => {
          if (data.success) {
            toast({
              title: "Connexion réussie",
              description: `Bienvenue, ${data.admin.username}!`,
            });
            
            // Force a small delay to ensure React Query cache is updated
            setTimeout(() => {
              setLocation("/admin/dashboard");
            }, 100);
          } else {
            toast({
              title: "Erreur de connexion",
              description: data.message,
              variant: "destructive",
            });
          }
        },
        onError: () => {
          toast({
            title: "Erreur",
            description: "Une erreur s'est produite lors de la connexion",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Administration 2IAE
          </CardTitle>
          <p className="text-gray-600">
            Connectez-vous pour accéder à l'administration
          </p>
        </CardHeader>
        <CardContent>
          {/* Identifiants par défaut - mode développement */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm font-medium text-blue-800 mb-1">
              Identifiants par défaut (développement) :
            </p>
            <p className="text-xs text-blue-600">
              Utilisateur : <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">admin</code>
            </p>
            <p className="text-xs text-blue-600">
              Mot de passe : <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">admin2iae2024!</code>
            </p>
          </div>
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            data-testid="admin-login-form"
          >
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Entrez votre nom d'utilisateur"
                disabled={loginMutation.isPending}
                data-testid="input-admin-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                  disabled={loginMutation.isPending}
                  data-testid="input-admin-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-admin-login"
            >
              {loginMutation.isPending ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
