import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, Phone, Mail } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export default function ContactSection() {
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    phone: "",
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
        title: "Message envoyé",
        description: "Votre demande a été envoyée avec succès. Nous vous répondrons rapidement.",
      });
      setFormData({ name: "", email: "", phone: "", message: "" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de l'envoi de votre message.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.message) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs du formulaire.",
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
    <section id="contact" className="py-20 gradient-bg">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <h2 className="text-4xl font-bold mb-6" data-testid="text-contact-title">
              Contactez-Nous
            </h2>
            <p className="text-xl mb-8 text-white/90" data-testid="text-contact-subtitle">
              Prêt à rejoindre l'élite de demain ? Contactez-nous pour plus d'informations sur nos programmes.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center space-x-4" data-testid="contact-address">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <MapPin className="text-white text-lg h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium" data-testid="text-contact-address-label">Adresse</p>
                  <p className="text-white/90" data-testid="text-contact-address-value">
                    Abidjan, Riviera Palmeraie, rue ministère, centre de pharmacie rue ministère et carrefour MACI CANARA (Siège)
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4" data-testid="contact-phone">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Phone className="text-white text-lg h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium" data-testid="text-contact-phone-label">Téléphone</p>
                  <p className="text-white/90" data-testid="text-contact-phone-value">
                    (+225) 27 22 81 87 76 / 07 57 82 82 / 06 05 29 28
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4" data-testid="contact-email">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Mail className="text-white text-lg h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium" data-testid="text-contact-email-label">Email</p>
                  <p className="text-white/90" data-testid="text-contact-email-value">
                    contact@2iae.com
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <Card className="shadow-2xl">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-6 text-foreground" data-testid="text-contact-form-title">
                Demande d'Information
              </h3>
              <form onSubmit={handleSubmit} className="space-y-6" data-testid="form-contact">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium text-foreground mb-2">
                      Nom complet
                    </Label>
                    <Input 
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Votre nom"
                      data-testid="input-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-foreground mb-2">
                      Email
                    </Label>
                    <Input 
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="votre@email.com"
                      data-testid="input-email"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-foreground mb-2">
                    Téléphone
                  </Label>
                  <Input 
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+225 XX XX XX XX XX"
                    data-testid="input-phone"
                  />
                </div>
                <div>
                  <Label htmlFor="message" className="text-sm font-medium text-foreground mb-2">
                    Message
                  </Label>
                  <Textarea 
                    id="message"
                    rows={4}
                    value={formData.message}
                    onChange={(e) => handleInputChange("message", e.target.value)}
                    placeholder="Votre message..."
                    data-testid="textarea-message"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 text-lg h-auto"
                  disabled={contactMutation.isPending}
                  data-testid="button-submit-contact"
                >
                  {contactMutation.isPending ? "Envoi en cours..." : "Envoyer la demande"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
