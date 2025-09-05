import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Phone, Mail, Clock, Euro, GraduationCap, Building } from "lucide-react";

interface TariffData {
  site: string;
  location: string;
  phone: string;
  email: string;
  programs: {
    name: string;
    duration: string;
    fees: {
      inscription: string;
      mensualite: string;
      total: string;
    };
    description?: string;
  }[];
}

// Données temporaires - à remplacer par les vraies données des PDFs
const tariffData: TariffData[] = [
  {
    site: "2IAE PALMERAIE",
    location: "Abidjan - Cocody Palmeraie",
    phone: "+225 XX XX XX XX",
    email: "palmeraie@2iae.ci",
    programs: [
      {
        name: "BTS Gestion Commerciale",
        duration: "2 ans",
        fees: {
          inscription: "À définir",
          mensualite: "À définir", 
          total: "À définir"
        }
      },
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
                            <div className="grid md:grid-cols-3 gap-4">
                              <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Frais d'inscription</div>
                                <div className="text-xl font-bold text-orange-600">
                                  {program.fees.inscription}
                                </div>
                              </div>
                              <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Mensualité</div>
                                <div className="text-xl font-bold text-orange-600">
                                  {program.fees.mensualite}
                                </div>
                              </div>
                              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="text-sm text-green-600 mb-1">Coût total</div>
                                <div className="text-xl font-bold text-green-600">
                                  {program.fees.total}
                                </div>
                              </div>
                            </div>
                            {program.description && (
                              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                                <p className="text-sm text-gray-700">{program.description}</p>
                              </div>
                            )}
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