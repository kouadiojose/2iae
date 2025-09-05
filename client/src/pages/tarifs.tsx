import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tariff } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Euro,
  GraduationCap,
  Building,
  FileText,
  CreditCard,
  ShoppingBag,
  CheckCircle,
} from "lucide-react";

// Convert Tariff from DB to display format
function formatTariff(tariff: Tariff) {
  return {
    site: tariff.site,
    location: tariff.location,
    phone: tariff.phone || "+225 XX XX XX XX",
    email: tariff.email || `${tariff.site.toLowerCase().replace(/\s+/g, '')}@2iae.ci`,
    accountInfo: tariff.accountInfo,
    program: {
      name: tariff.programName,
      duration: tariff.programDuration || "2 ans",
      fees: {
        inscription: tariff.inscriptionFee,
        fraisAnnexes: tariff.fraisAnnexes,
        total: tariff.totalFee,
        echancier: {
          premier: tariff.firstPayment,
          deuxieme: tariff.secondPayment,
          troisieme: tariff.thirdPayment
        }
      },
      description: tariff.description,
      requiredDocuments: Array.isArray(tariff.requiredDocuments) 
        ? tariff.requiredDocuments as string[]
        : [],
      uniform: typeof tariff.uniformCosts === 'object' && tariff.uniformCosts !== null
        ? tariff.uniformCosts as { tissu?: string; cravate?: string; blouse?: string }
        : undefined,
      supplies: Array.isArray(tariff.supplies)
        ? tariff.supplies as string[]
        : []
    }
  };
}

export default function Tarifs() {
  const [selectedSite, setSelectedSite] = useState<string>("");

  // Fetch tariffs from API
  const { data: tariffsResponse, isLoading, error } = useQuery({
    queryKey: ["/api/tariffs"],
  });

  const tariffs = (tariffsResponse as { tariffs: Tariff[] })?.tariffs || [];
  const formattedTariffs = tariffs.map(formatTariff);

  // Auto-select first site when data loads
  if (!selectedSite && formattedTariffs.length > 0) {
    setSelectedSite(formattedTariffs[0].site);
  }

  const selectedTariff = formattedTariffs.find(t => t.site === selectedSite);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Nos Tarifs</h1>
            <div className="flex justify-center items-center py-16">
              <div className="text-lg text-gray-600">Chargement des tarifs...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || formattedTariffs.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Nos Tarifs</h1>
            <div className="flex justify-center items-center py-16">
              <div className="text-lg text-gray-600">
                Les tarifs ne sont pas encore disponibles. Contactez-nous pour plus d'informations.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 py-16">
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Nos Tarifs
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Découvrez les tarifs transparents de nos formations dans tous nos sites 2IAE.
            <br />
            Des échéanciers flexibles pour faciliter votre parcours académique.
          </p>
        </div>

        {/* Sites Tabs */}
        <Tabs 
          value={selectedSite} 
          onValueChange={setSelectedSite}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-2 bg-white shadow-lg">
            {formattedTariffs.map((tariff) => (
              <TabsTrigger
                key={tariff.site}
                value={tariff.site}
                className="flex flex-col items-center gap-2 p-4 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700"
              >
                <Building className="h-5 w-5" />
                <span className="text-sm font-medium text-center">
                  {tariff.site}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {formattedTariffs.map((site) => (
            <TabsContent
              key={site.site}
              value={site.site}
              className="mt-8"
            >
              <div className="grid gap-8">
                {/* Site Header */}
                <Card className="bg-gradient-to-r from-orange-600 to-orange-700 text-white">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl font-bold flex items-center gap-3">
                          <Building className="h-6 w-6" />
                          {site.site}
                        </CardTitle>
                        <CardDescription className="text-orange-100 mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="h-4 w-4" />
                            {site.location}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              {site.phone}
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {site.email}
                            </div>
                          </div>
                        </CardDescription>
                      </div>
                      <Badge className="bg-white text-orange-600 hover:bg-orange-50">
                        <GraduationCap className="h-4 w-4 mr-2" />
                        {site.program.duration}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>

                {/* Program Card */}
                <Card className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <GraduationCap className="h-6 w-6 text-green-600" />
                      {site.program.name}
                      <Badge variant="outline" className="ml-auto">
                        <Clock className="h-3 w-3 mr-1" />
                        {site.program.duration}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Professional Payment Schedule Table */}
                    {site.program.fees.total > 0 && (
                      <div className="mt-6">
                        <h4 className="text-lg font-bold text-gray-800 mb-4 text-center">
                          ÉCHÉANCIER : {site.program.name.toUpperCase()} : {site.site}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border-2 border-gray-800 bg-white">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border-2 border-gray-800 px-4 py-3 text-left font-bold text-gray-800">
                                  LIBELLÉ
                                </th>
                                <th className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-gray-800">
                                  1er Vers<br/>Obligatoire
                                </th>
                                <th className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-gray-800">
                                  2ème vers<br/>(1 mois après le 1er Vers.)
                                </th>
                                <th className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-gray-800">
                                  3ème vers.
                                </th>
                                <th className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-gray-800">
                                  TOTAL
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border-2 border-gray-800 px-4 py-3 font-medium text-gray-800">
                                  Droit d'inscription
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold">
                                  {site.program.fees.inscription.toLocaleString()}
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center">
                                  -
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center">
                                  -
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold">
                                  {site.program.fees.inscription.toLocaleString()}
                                </td>
                              </tr>
                              <tr>
                                <td className="border-2 border-gray-800 px-4 py-3 font-medium text-gray-800">
                                  Frais Annexes
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center">
                                  -
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold">
                                  {site.program.fees.echancier.deuxieme.toLocaleString()}
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold">
                                  {site.program.fees.echancier.troisieme.toLocaleString()}
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold">
                                  {site.program.fees.fraisAnnexes.toLocaleString()}
                                </td>
                              </tr>
                              <tr className="bg-gray-50">
                                <td className="border-2 border-gray-800 px-4 py-3 font-bold text-gray-800">
                                  TOTAL
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-orange-600">
                                  {site.program.fees.echancier.premier.toLocaleString()}
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-orange-600">
                                  {site.program.fees.echancier.deuxieme.toLocaleString()}
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-orange-600">
                                  {site.program.fees.echancier.troisieme.toLocaleString()}
                                </td>
                                <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-green-600 text-lg">
                                  {site.program.fees.total.toLocaleString()}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Important Note */}
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800 font-medium">
                            <strong>NB :</strong> L'étudiant pourra accéder aux cours après s'être acquitté des frais comme indiqué dans le tableau ci-dessus.
                          </p>
                        </div>
                      </div>
                    )}

                    {site.program.description && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-700">{site.program.description}</p>
                      </div>
                    )}

                    {/* Additional Information */}
                    <div className="grid md:grid-cols-3 gap-6 mt-8">
                      {/* Required Documents */}
                      {site.program.requiredDocuments && site.program.requiredDocuments.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center text-green-700">
                              <FileText className="h-4 w-4 mr-2" />
                              Pièces à Fournir
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {site.program.requiredDocuments.map((doc, index) => (
                                <li key={index} className="flex items-start gap-3 text-sm">
                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  <span className="leading-relaxed">{doc}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}

                      {/* Uniform Costs */}
                      {site.program.uniform && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center text-blue-700">
                              <ShoppingBag className="h-4 w-4 mr-2" />
                              Frais de Tenue
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3 text-sm">
                              {site.program.uniform.tissu && (
                                <div className="flex justify-between items-start">
                                  <span className="font-medium">Tissu uniforme:</span>
                                  <span className="text-right ml-2">{site.program.uniform.tissu}</span>
                                </div>
                              )}
                              {site.program.uniform.cravate && (
                                <div className="flex justify-between items-start">
                                  <span className="font-medium">Cravate:</span>
                                  <span className="text-right ml-2">{site.program.uniform.cravate}</span>
                                </div>
                              )}
                              {site.program.uniform.blouse && (
                                <div className="flex justify-between items-start">
                                  <span className="font-medium">Blouse:</span>
                                  <span className="text-right ml-2">{site.program.uniform.blouse}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Supplies */}
                      {site.program.supplies && site.program.supplies.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center text-purple-700">
                              <ShoppingBag className="h-4 w-4 mr-2" />
                              Fournitures
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {site.program.supplies.map((supply, index) => (
                                <li key={index} className="flex items-start gap-3 text-sm">
                                  <CheckCircle className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                  <span className="leading-relaxed">{supply}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* Bank Account Info */}
                    {site.accountInfo && (
                      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="h-4 w-4 text-gray-600" />
                          <span className="font-medium text-gray-800">Informations Bancaires</span>
                        </div>
                        <p className="text-sm text-gray-700 font-mono">{site.accountInfo}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Contact Section */}
        <div className="mt-16 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl text-gray-900">
                Besoin d'informations complémentaires ?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">
                Notre équipe est à votre disposition pour répondre à toutes vos questions concernant nos tarifs et modalités de paiement.
              </p>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                Nous Contacter
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}