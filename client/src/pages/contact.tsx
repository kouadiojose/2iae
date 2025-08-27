import { useState } from "react";
import { MapPin, Phone, Mail, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  program: string;
  message: string;
}

const contactInfo = [
  {
    icon: MapPin,
    title: "Adresse",
    details: [
      "Abidjan, Riviera Palmeraie",
      "rue ministère, centre de pharmacie",
      "rue ministère et carrefour MACI CANARA (Siège)"
    ],
    color: "primary"
  },
  {
    icon: Phone,
    title: "Téléphone",
    details: [
      "(+225) 27 22 81 87 76",
      "(+225) 07 57 82 82",
      "(+225) 06 05 29 28"
    ],
    color: "secondary"
  },
  {
    icon: Mail,
    title: "Email",
    details: [
      "contact@2iae.com",
      "info@2iae.com",
      "admissions@2iae.com"
    ],
    color: "accent"
  },
  {
    icon: Clock,
    title: "Horaires",
    details: [
      "Lun - Ven: 8h00 - 18h00",
      "Samedi: 8h00 - 14h00",
      "Dimanche: Fermé"
    ],
    color: "primary"
  }
];

const programs = [
  "Management et Entrepreneuriat",
  "Marketing Digital & E-Commerce", 
  "Gestion des Entreprises",
  "Formation Continue",
  "Autre"
];

const subjects = [
  "Demande d'Information",
  "Candidature",
  "Partenariat Entreprise",
  "Stages et Emplois",
  "Support Technique",
  "Autre"
];

export default function ContactPage() {
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    phone: "",
    subject: "",
    program: "",
    message: ""
  });

  const { toast } = useToast();

  const contactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const response = await apiRequest("POST", "/api/contact", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message envoyé avec succès !",
        description: "Votre demande a été envoyée. Nous vous répondrons dans les plus brefs délais.",
      });
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        program: "",
        message: ""
      });
    },
    onError: () => {
      toast({
        title: "Erreur lors de l'envoi",
        description: "Une erreur s'est produite. Veuillez réessayer plus tard.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone || !formData.message) {
      toast({
        title: "Champs requis manquants",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    contactMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen pt-20">
      {/* Header Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Contactez-Nous
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-page-subtitle">
            Nous sommes là pour répondre à toutes vos questions et vous accompagner dans votre projet de formation
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {contactInfo.map((info, index) => {
              const IconComponent = info.icon;
              return (
                <Card key={index} className="text-center hover-lift professional-shadow border-0" data-testid={`card-contact-info-${index}`}>
                  <CardContent className="p-8">
                    <div className={`w-16 h-16 bg-${info.color}/10 rounded-full flex items-center justify-center mb-6 mx-auto`}>
                      <IconComponent className={`h-8 w-8 text-${info.color}`} />
                    </div>
                    <h3 className="text-xl font-bold mb-4" data-testid={`text-contact-info-title-${index}`}>
                      {info.title}
                    </h3>
                    <div className="space-y-1">
                      {info.details.map((detail, detailIndex) => (
                        <p key={detailIndex} className="text-muted-foreground text-sm" data-testid={`text-contact-info-detail-${index}-${detailIndex}`}>
                          {detail}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Form & Map */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="professional-shadow">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-center" data-testid="text-form-title">
                  Envoyez-nous un Message
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6" data-testid="form-contact">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name" className="text-sm font-medium mb-2 block">
                        Nom complet *
                      </Label>
                      <Input 
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        placeholder="Votre nom complet"
                        required
                        data-testid="input-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium mb-2 block">
                        Adresse Email *
                      </Label>
                      <Input 
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="votre@email.com"
                        required
                        data-testid="input-email"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone" className="text-sm font-medium mb-2 block">
                        Téléphone *
                      </Label>
                      <Input 
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        placeholder="+225 XX XX XX XX XX"
                        required
                        data-testid="input-phone"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject" className="text-sm font-medium mb-2 block">
                        Sujet de la demande
                      </Label>
                      <Select onValueChange={(value) => handleInputChange("subject", value)} data-testid="select-subject">
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir un sujet" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject, index) => (
                            <SelectItem key={index} value={subject} data-testid={`select-subject-option-${index}`}>
                              {subject}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="program" className="text-sm font-medium mb-2 block">
                      Programme d'intérêt
                    </Label>
                    <Select onValueChange={(value) => handleInputChange("program", value)} data-testid="select-program">
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un programme" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((program, index) => (
                          <SelectItem key={index} value={program} data-testid={`select-program-option-${index}`}>
                            {program}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-sm font-medium mb-2 block">
                      Message *
                    </Label>
                    <Textarea 
                      id="message"
                      rows={6}
                      value={formData.message}
                      onChange={(e) => handleInputChange("message", e.target.value)}
                      placeholder="Décrivez votre demande en détail..."
                      required
                      data-testid="textarea-message"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 text-lg h-auto"
                    disabled={contactMutation.isPending}
                    data-testid="button-submit-contact"
                  >
                    {contactMutation.isPending ? (
                      "Envoi en cours..."
                    ) : (
                      <>
                        Envoyer le Message
                        <Send className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Map & Additional Info */}
            <div className="space-y-8">
              <Card className="professional-shadow">
                <CardContent className="p-0">
                  <div className="w-full h-80 bg-muted rounded-lg flex items-center justify-center" data-testid="map-placeholder">
                    <div className="text-center">
                      <MapPin className="h-12 w-12 text-primary mx-auto mb-4" />
                      <p className="text-lg font-semibold">Plan d'Accès</p>
                      <p className="text-muted-foreground">Riviera Palmeraie, Abidjan</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="professional-shadow">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-6" data-testid="text-visit-title">
                    Nous Rendre Visite
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3" data-testid="visit-info-address">
                      <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Adresse</p>
                        <p className="text-muted-foreground text-sm">
                          Riviera Palmeraie, rue ministère<br />
                          Centre de pharmacie, carrefour MACI CANARA<br />
                          Abidjan, Côte d'Ivoire
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3" data-testid="visit-info-transport">
                      <div className="h-5 w-5 bg-secondary rounded-full mt-1 flex-shrink-0"></div>
                      <div>
                        <p className="font-medium">Transport</p>
                        <p className="text-muted-foreground text-sm">
                          Accessible en taxi, bus et transport en commun<br />
                          Parking disponible sur site
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3" data-testid="visit-info-metro">
                      <div className="h-5 w-5 bg-accent rounded-full mt-1 flex-shrink-0"></div>
                      <div>
                        <p className="font-medium">Repères</p>
                        <p className="text-muted-foreground text-sm">
                          Près du carrefour MACI CANARA<br />
                          Centre de pharmacie rue ministère
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" data-testid="text-faq-title">
              Questions Fréquentes
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-faq-subtitle">
              Trouvez rapidement les réponses aux questions les plus courantes
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="hover-lift professional-shadow" data-testid="card-faq-1">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3" data-testid="text-faq-question-1">
                  Comment s'inscrire à 2IAE ?
                </h3>
                <p className="text-muted-foreground" data-testid="text-faq-answer-1">
                  Vous pouvez vous inscrire en ligne ou directement sur notre campus. Les admissions se font sur étude du dossier et entretien.
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-lift professional-shadow" data-testid="card-faq-2">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3" data-testid="text-faq-question-2">
                  Quels sont les frais de scolarité ?
                </h3>
                <p className="text-muted-foreground" data-testid="text-faq-answer-2">
                  Les frais varient selon le programme choisi. Contactez-nous pour obtenir un devis détaillé et connaître nos facilités de paiement.
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-lift professional-shadow" data-testid="card-faq-3">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3" data-testid="text-faq-question-3">
                  Y a-t-il des bourses disponibles ?
                </h3>
                <p className="text-muted-foreground" data-testid="text-faq-answer-3">
                  Oui, nous proposons des bourses d'excellence et des aides financières selon les profils. Consultez notre service des admissions.
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-lift professional-shadow" data-testid="card-faq-4">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3" data-testid="text-faq-question-4">
                  Les stages sont-ils garantis ?
                </h3>
                <p className="text-muted-foreground" data-testid="text-faq-answer-4">
                  Absolument ! Nous garantissons un stage à tous nos étudiants grâce à notre réseau de plus de 50 entreprises partenaires.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}