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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTariffSchema, type Tariff, type InsertTariff } from "@shared/schema";
import { 
  ArrowLeft, 
  Plus,
  Edit3, 
  Trash2,
  Eye,
  EyeOff,
  Euro,
  MapPin,
  Phone,
  Mail,
  Building,
  CreditCard
} from "lucide-react";

export default function AdminTariffs() {
  const [, setLocation] = useLocation();
  const { admin, isAuthenticated, isLoading } = useAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);

  // Get all tariffs
  const { data: tariffsData, isLoading: tariffsLoading } = useQuery({
    queryKey: ["/api/admin/tariffs"],
    enabled: isAuthenticated,
  });

  const form = useForm<InsertTariff>({
    resolver: zodResolver(insertTariffSchema),
    defaultValues: {
      site: "",
      location: "",
      phone: "",
      email: "",
      accountInfo: "",
      programName: "BTS - Orientés 1ère Année",
      programDuration: "2 ans",
      inscriptionFee: 85000,
      fraisAnnexes: 140000,
      totalFee: 225000,
      firstPayment: 85000,
      secondPayment: 85000,
      thirdPayment: 55000,
      requiredDocuments: [
        "2 Extraits de naissance Originaux",
        "Photocopie du dernier bulletin de notes de la terminale",
        "2 photos d'identité de même tirage",
        "2 Copies légalisées de l'attestation de réussite du bac ou relevé de notes du bac",
        "Photocopie de la CNI ou attestation d'identité en cours de validité"
      ],
      uniformCosts: {},
      supplies: [
        "1 Paquet de Marker non permanent pour tableau (Schneider - Memo - Bic STA)",
        "1 Paquet de papier Rame",
        "1 Chemise à Rabat pour les nouveaux étudiants"
      ],
      description: "",
      order: "1",
    },
  });

  // Create tariff mutation
  const createTariffMutation = useMutation({
    mutationFn: async (data: InsertTariff) => {
      return await apiRequest("/api/admin/tariffs", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      setDialogOpen(false);
      setEditingTariff(null);
      form.reset();
      toast({
        title: "Succès",
        description: "Tarif créé avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création du tarif",
        variant: "destructive",
      });
    },
  });

  // Update tariff mutation
  const updateTariffMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTariff> }) => {
      return await apiRequest(`/api/admin/tariffs/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      setDialogOpen(false);
      setEditingTariff(null);
      form.reset();
      toast({
        title: "Succès",
        description: "Tarif mis à jour avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la mise à jour du tarif",
        variant: "destructive",
      });
    },
  });

  // Delete tariff mutation
  const deleteTariffMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/tariffs/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      toast({
        title: "Succès",
        description: "Tarif supprimé avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression du tarif",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertTariff) => {
    if (editingTariff) {
      updateTariffMutation.mutate({ id: editingTariff.id, data });
    } else {
      createTariffMutation.mutate(data);
    }
  };

  const handleEdit = (tariff: Tariff) => {
    setEditingTariff(tariff);
    form.reset({
      site: tariff.site,
      location: tariff.location,
      phone: tariff.phone ?? "",
      email: tariff.email ?? "",
      accountInfo: tariff.accountInfo ?? "",
      programName: tariff.programName,
      programDuration: tariff.programDuration ?? "2 ans",
      inscriptionFee: tariff.inscriptionFee,
      fraisAnnexes: tariff.fraisAnnexes,
      totalFee: tariff.totalFee,
      firstPayment: tariff.firstPayment,
      secondPayment: tariff.secondPayment,
      thirdPayment: tariff.thirdPayment,
      requiredDocuments: tariff.requiredDocuments as string[] || [],
      uniformCosts: tariff.uniformCosts as Record<string, any> || {},
      supplies: tariff.supplies as string[] || [],
      description: tariff.description ?? "",
      order: tariff.order ?? "1",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce tarif ?")) {
      deleteTariffMutation.mutate(id);
    }
  };

  const handleCreateNew = () => {
    setEditingTariff(null);
    form.reset();
    setDialogOpen(true);
  };

  if (!isAuthenticated && !isLoading) {
    setLocation("/admin/login");
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  const tariffs = (tariffsData as { tariffs: Tariff[] })?.tariffs || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <main className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setLocation("/admin")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gestion des Tarifs</h1>
              <p className="text-gray-600">Gérer les tarifs des 4 sites 2IAE</p>
            </div>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateNew} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nouveau Tarif
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTariff ? "Modifier le Tarif" : "Créer un Nouveau Tarif"}
                </DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Site Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="site"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom du Site</FormLabel>
                          <FormControl>
                            <Input placeholder="2IAE PALMERAIE" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Localisation</FormLabel>
                          <FormControl>
                            <Input placeholder="Abidjan - Riviera Palmeraie" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Téléphone</FormLabel>
                          <FormControl>
                            <Input placeholder="+225 XX XX XX XX" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="site@2iae.ci" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Program Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="programName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Programme</FormLabel>
                          <FormControl>
                            <Input placeholder="BTS - Orientés 1ère Année" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="programDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Durée</FormLabel>
                          <FormControl>
                            <Input placeholder="2 ans" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Fees Structure */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="text-lg font-semibold">Structure des Frais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="inscriptionFee"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Droits d'inscription (F CFA)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="fraisAnnexes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Frais Annexes (F CFA)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="totalFee"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total (F CFA)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Payment Schedule */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="text-lg font-semibold">Échéancier de Paiement</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="firstPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>1er Versement (F CFA)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="secondPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>2ème Versement (F CFA)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="thirdPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>3ème Versement (F CFA)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="accountInfo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Informations Bancaires</FormLabel>
                          <FormControl>
                            <Input placeholder="N° COMPTE AFG BANK-CI : 01201 013457690001 04" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Description du programme..." {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="order"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ordre d'affichage</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createTariffMutation.isPending || updateTariffMutation.isPending}
                    >
                      {editingTariff ? "Mettre à jour" : "Créer"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5" />
              Tarifs des Sites 2IAE
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tariffsLoading ? (
              <div className="text-center py-8">Chargement des tarifs...</div>
            ) : tariffs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun tarif configuré. Créez le premier tarif.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Échéancier</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tariffs.map((tariff: Tariff) => (
                    <TableRow key={tariff.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-orange-500" />
                          {tariff.site}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          {tariff.location}
                        </div>
                      </TableCell>
                      <TableCell>{tariff.programName}</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {tariff.totalFee.toLocaleString()} F CFA
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-600">
                          {tariff.firstPayment.toLocaleString()} + {tariff.secondPayment.toLocaleString()} + {tariff.thirdPayment.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tariff.isActive ? "default" : "secondary"}>
                          {tariff.isActive ? (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              Actif
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3 mr-1" />
                              Inactif
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(tariff)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(tariff.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}