import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Phone, Mail, Clock, Euro, GraduationCap, Building, FileText, CreditCard, ShoppingBag, CheckCircle } from "lucide-react";

interface TariffData {
  site: string;
  location: string;
  phone: string;
  email: string;
  accountInfo?: string;
  programs: {
    name: string;
    duration: string;
    fees: {
      inscription: string;
      mensualite: string;
      total: string;
    };
    description?: string;
    requiredDocuments?: string[];
    uniform?: {
      tissu: string;
      cravate: string;
      blouse?: string;
    };
    supplies?: string[];
  }[];
}

// Données réelles des sites 2IAE
const tariffData: TariffData[] = [
  {
    site: "2IAE PALMERAIE",
    location: "Abidjan - Riviera Palmeraie",
    phone: "+225 XX XX XX XX",
    email: "palmeraie@2iae.ci",
    accountInfo: "N° COMPTE AFG BANK-CI : 01201 013457690001 04",
    programs: [
      {
        name: "BTS - Orientés 1ère Année",
        duration: "2 ans",
        fees: {
          inscription: "85 000 F CFA",
          mensualite: "Échéancier: 85 000 + 90 000 + 75 000", 
          total: "250 000 F CFA"
        },
        description: "Formation BTS (Rentrée académique 2025-2026). Droit d'inscription: 85 000 F + Frais annexes: 165 000 F.",
        requiredDocuments: [
          "2 Extraits de naissance Originaux",
          "Photocopie du dernier bulletin de notes de la terminale",
          "2 photos d'identité de même tirage",
          "2 Copies légalisées de l'attestation de réussite du bac ou relevé de notes du bac",
          "Photocopie de la CNI ou attestation d'identité en cours de validité"
        ],
        uniform: {
          tissu: "25 000 F CFA (Achat obligatoire à 2IAE)",
          cravate: "5 000 F CFA",
          blouse: "10 000 F CFA (OBLIGATOIRE pour les filières industrielles et SI)"
        },
        supplies: [
          "1 Paquet de Marker non permanent pour tableau (Schneider - Memo - Bic STA)",
          "1 Paquet de papier Rame",
          "1 Chemise à Rabat pour les nouveaux étudiants"
        ]
      }
    ]
  },
  {
    site: "2IAE YAMOUSSOUKRO",
    location: "Yamoussoukro Centre",
    phone: "+225 XX XX XX XX",
    email: "yamoussoukro@2iae.ci",
    programs: [
      {
        name: "Formation Orientée",
        duration: "1 an",
        fees: {
          inscription: "À définir",
          mensualite: "À définir",
          total: "À définir"
        }
      }
    ]
  },
  {
    site: "2IAE AZAGUIÉ",
    location: "Azaguié Centre",
    phone: "+225 XX XX XX XX",
    email: "azaguie@2iae.ci",
    programs: [
      {
        name: "Formation Orientée",
        duration: "1 an",
        fees: {
          inscription: "À définir",
          mensualite: "À définir",
          total: "À définir"
        }
      }
    ]
  },
  {
    site: "2IAE YOPOUGON",
    location: "Yopougon Centre",
    phone: "+225 XX XX XX XX",
    email: "yopougon@2iae.ci",
    programs: [
      {
        name: "Formation Orientée",
        duration: "1 an",
        fees: {
          inscription: "À définir",
          mensualite: "À définir",
          total: "À définir"
        }
      }
    ]
  }
];

export default function Tarifs() {
  const [selectedSite, setSelectedSite] = useState(tariffData[0].site);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-600 to-green-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4">Nos Tarifs</h1>
            <p className="text-xl text-orange-100 max-w-3xl mx-auto">
              Découvrez les tarifs de nos formations dans nos différents sites du Groupe École 2IAE.
              Des formations de qualité à des prix accessibles.
            </p>
          </div>
        </div>
      </div>

      {/* Sites Overview */}
      <div className="py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Nos 4 Sites à Votre Service
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Le Groupe École 2IAE vous accompagne dans votre formation avec 4 sites répartis 
              sur le territoire ivoirien.
            </p>
          </div>

          {/* Sites Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {tariffData.map((site, index) => (
              <Card 
                key={site.site}
                className={`cursor-pointer transition-all duration-300 hover:shadow-lg border-2 ${
                  selectedSite === site.site 
                    ? 'border-orange-500 bg-orange-50' 
                    : 'border-gray-200 hover:border-orange-300'
                }`}
                onClick={() => setSelectedSite(site.site)}
                data-testid={`site-card-${index}`}
              >
                <CardHeader className="text-center">
                  <Building className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                  <CardTitle className="text-lg font-bold text-gray-800">
                    {site.site}
                  </CardTitle>
                  <CardDescription className="flex items-center justify-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {site.location}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Site Details */}
          <Tabs value={selectedSite} onValueChange={setSelectedSite} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              {tariffData.map((site) => (
                <TabsTrigger 
                  key={site.site} 
                  value={site.site}
                  className="text-xs sm:text-sm"
                  data-testid={`tab-${site.site.toLowerCase().replace(/\s/g, '-')}`}
                >
                  {site.site.replace('2IAE ', '')}
                </TabsTrigger>
              ))}
            </TabsList>

            {tariffData.map((site) => (
              <TabsContent key={site.site} value={site.site}>
                <div className="grid lg:grid-cols-3 gap-8">
                  {/* Site Info */}
                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-orange-600">
                        <Building className="h-5 w-5" />
                        {site.site}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>{site.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="h-4 w-4" />
                        <span>{site.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="h-4 w-4" />
                        <span>{site.email}</span>
                      </div>
                      {site.accountInfo && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 text-blue-700 text-sm">
                            <CreditCard className="h-4 w-4" />
                            <span className="font-medium">Compte Bancaire</span>
                          </div>
                          <p className="text-xs text-blue-600 mt-1">{site.accountInfo}</p>
                        </div>
                      )}
                      <div className="mt-6">
                        <Button 
                          className="w-full bg-orange-600 hover:bg-orange-700"
                          data-testid="contact-site-button"
                        >
                          Contacter ce site
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Programs and Pricing */}
                  <div className="lg:col-span-2">
                    <h3 className="text-2xl font-bold text-gray-800 mb-6">
                      Formations et Tarifs
                    </h3>
                    <div className="space-y-6">
                      {site.programs.map((program, programIndex) => (
                        <Card key={programIndex} className="border-l-4 border-l-orange-500">
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="flex items-center gap-2 text-gray-800">
                                  <GraduationCap className="h-5 w-5" />
                                  {program.name}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2 mt-2">
                                  <Clock className="h-4 w-4" />
                                  Durée: {program.duration}
                                </CardDescription>
                              </div>
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                {program.duration}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {/* Professional Payment Schedule Table */}
                            <div className="mt-6">
                              <h4 className="text-lg font-bold text-gray-800 mb-4 text-center">
                                ÉCHÉANCIER : {program.name.toUpperCase()} : {site.site}
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
                                        85 000
                                      </td>
                                      <td className="border-2 border-gray-800 px-4 py-3 text-center">
                                        -
                                      </td>
                                      <td className="border-2 border-gray-800 px-4 py-3 text-center">
                                        -
                                      </td>
                                      <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold">
                                        85 000
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
                                        90 000
                                      </td>
                                      <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold">
                                        75 000
                                      </td>
                                      <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold">
                                        165 000
                                      </td>
                                    </tr>
                                    <tr className="bg-gray-50">
                                      <td className="border-2 border-gray-800 px-4 py-3 font-bold text-gray-800">
                                        TOTAL
                                      </td>
                                      <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-orange-600">
                                        85 000
                                      </td>
                                      <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-orange-600">
                                        90 000
                                      </td>
                                      <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-orange-600">
                                        75 000
                                      </td>
                                      <td className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-green-600 text-lg">
                                        250 000
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
                            {program.description && (
                              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                                <p className="text-sm text-gray-700">{program.description}</p>
                              </div>
                            )}

                            {/* Additional Information Sections */}
                            <div className="mt-6 grid md:grid-cols-1 lg:grid-cols-3 gap-4">
                              {/* Required Documents */}
                              {program.requiredDocuments && (
                                <Card className="border-orange-200">
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
                                      <FileText className="h-4 w-4" />
                                      Pièces à Fournir
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <ul className="space-y-1">
                                      {program.requiredDocuments.map((doc, index) => (
                                        <li key={index} className="flex items-start gap-2 text-xs">
                                          <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                                          <span>{doc}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Uniform Costs */}
                              {program.uniform && (
                                <Card className="border-green-200">
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                                      <ShoppingBag className="h-4 w-4" />
                                      Frais de Tenue
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-2 text-xs">
                                      <div className="flex justify-between">
                                        <span>Tissu uniforme:</span>
                                        <span className="font-medium">{program.uniform.tissu}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Cravate:</span>
                                        <span className="font-medium">{program.uniform.cravate}</span>
                                      </div>
                                      {program.uniform.blouse && (
                                        <div className="flex justify-between">
                                          <span>Blouse:</span>
                                          <span className="font-medium">{program.uniform.blouse}</span>
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Supplies */}
                              {program.supplies && (
                                <Card className="border-purple-200">
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2 text-purple-600">
                                      <ShoppingBag className="h-4 w-4" />
                                      Fournitures
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <ul className="space-y-1">
                                      {program.supplies.map((supply, index) => (
                                        <li key={index} className="flex items-start gap-2 text-xs">
                                          <CheckCircle className="h-3 w-3 text-purple-500 mt-0.5 flex-shrink-0" />
                                          <span>{supply}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Prêt à Commencer Votre Formation ?
          </h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Contactez-nous dès aujourd'hui pour obtenir plus d'informations sur nos programmes
            et découvrir comment nous pouvons vous aider à atteindre vos objectifs professionnels.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="contact-general-button"
            >
              Nous Contacter
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white text-white hover:bg-white hover:text-gray-900"
              data-testid="download-brochure-button"
            >
              Télécharger la Brochure
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}