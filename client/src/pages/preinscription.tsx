// Formulaire de préinscription — pensé pour la rentrée : court, rassurant,
// et enregistré via l'API contact existante (sujet « Préinscription »).
import { useState } from "react";
import { usePageMeta } from "@/lib/seo";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Phone, MessageCircle } from "lucide-react";

const SITES = [
  "Abidjan – Riviera Palmeraie",
  "Abidjan – Yopougon",
  "Yamoussoukro",
  "Azaguié (Université de l'Entrepreneuriat, internat)",
  "M'Batto",
];

const NIVEAUX = [
  "BTS 1ère année (nouveau bachelier)",
  "BTS 2ème année",
  "Licence professionnelle",
  "Certificat professionnel",
  "Je ne sais pas encore",
];

const FILIERES = [
  "Finance Comptabilité & Gestion d'Entreprise",
  "Gestion Commerciale",
  "Ressources Humaines & Communication",
  "Logistique",
  "Science de l'Information",
  "Informatique Développeur d'Applications (IDA)",
  "Génie Civil option Bâtiment (GBAT)",
  "Génie Civil option Travaux Publics",
  "Agriculture Tropicale – Production Végétale (ATPV)",
  "Agriculture Tropicale – Production Animale (ATPA)",
  "Management & Entrepreneuriat (Licence)",
  "Marketing Digital & Communication (Licence)",
  "Gestion Financière & Contrôle (Licence)",
  "Je souhaite être conseillé(e)",
];

const WHATSAPP = "https://wa.me/2250747726729?text=" +
  encodeURIComponent("Bonjour, je souhaite faire ma préinscription au Groupe 2IAE.");

export default function PreinscriptionPage() {
  usePageMeta(
    "Préinscription en ligne — Rentrée 2026-2027 | Groupe 2IAE Côte d'Ivoire",
    "Préinscrivez-vous en 5 minutes au Groupe 2IAE : BTS, licences, certificats sur 5 campus en Côte d'Ivoire. Gratuit, sans engagement — un conseiller vous rappelle.",
    '/preinscription',
  );

  const { toast } = useToast();
  const [envoye, setEnvoye] = useState(false);
  const [f, setF] = useState({
    name: "",
    phone: "",
    email: "",
    site: "",
    niveau: "",
    filiere: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const message =
        `Préinscription rentrée\n` +
        `Site souhaité : ${f.site || "non précisé"}\n` +
        `Niveau : ${f.niveau || "non précisé"}\n` +
        `Filière : ${f.filiere || "non précisée"}`;
      return apiRequest("/api/contact", "POST", {
        name: f.name,
        email: f.email || "preinscription@2iae.com",
        phone: f.phone,
        subject: "Préinscription",
        message,
      });
    },
    onSuccess: () => setEnvoye(true),
    onError: () =>
      toast({
        title: "Erreur",
        description:
          "L'envoi a échoué. Réessayez, ou contactez-nous directement sur WhatsApp.",
        variant: "destructive",
      }),
  });

  const pret = f.name.trim().length >= 3 && f.phone.trim().length >= 8;

  return (
    <div className="min-h-screen">
      <section className="py-16 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-page-title">
            Préinscription
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            2 minutes suffisent. Un conseiller vous rappelle pour finaliser
            votre dossier — sans engagement.
          </p>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
          {envoye ? (
            <Card className="professional-shadow border-0 text-center">
              <CardContent className="p-10">
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Préinscription bien reçue !
                </h2>
                <p className="text-gray-700 mb-6">
                  Merci {f.name}. Un conseiller du Groupe 2IAE vous contactera
                  très vite au {f.phone} pour finaliser votre dossier.
                </p>
                <a href={WHATSAPP} target="_blank" rel="noreferrer">
                  <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Accélérer sur WhatsApp
                  </Button>
                </a>
              </CardContent>
            </Card>
          ) : (
            <Card className="professional-shadow border-0">
              <CardContent className="p-8 space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="pre-nom">Nom et prénoms *</Label>
                    <Input
                      id="pre-nom"
                      value={f.name}
                      onChange={(e) => setF({ ...f, name: e.target.value })}
                      placeholder="Ex. : Kouassi Aya Marie"
                      data-testid="input-nom"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pre-tel">Téléphone (WhatsApp de préférence) *</Label>
                    <Input
                      id="pre-tel"
                      value={f.phone}
                      onChange={(e) => setF({ ...f, phone: e.target.value })}
                      placeholder="+225 XX XX XX XX XX"
                      data-testid="input-telephone"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="pre-email">Email (facultatif)</Label>
                  <Input
                    id="pre-email"
                    type="email"
                    value={f.email}
                    onChange={(e) => setF({ ...f, email: e.target.value })}
                    placeholder="votre@email.com"
                    data-testid="input-email"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label>Site souhaité</Label>
                    <Select value={f.site} onValueChange={(v) => setF({ ...f, site: v })}>
                      <SelectTrigger data-testid="select-site">
                        <SelectValue placeholder="Choisir un site" />
                      </SelectTrigger>
                      <SelectContent>
                        {SITES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Niveau</Label>
                    <Select value={f.niveau} onValueChange={(v) => setF({ ...f, niveau: v })}>
                      <SelectTrigger data-testid="select-niveau">
                        <SelectValue placeholder="Choisir un niveau" />
                      </SelectTrigger>
                      <SelectContent>
                        {NIVEAUX.map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Filière souhaitée</Label>
                  <Select value={f.filiere} onValueChange={(v) => setF({ ...f, filiere: v })}>
                    <SelectTrigger data-testid="select-filiere">
                      <SelectValue placeholder="Choisir une filière" />
                    </SelectTrigger>
                    <SelectContent>
                      {FILIERES.map((fi) => (
                        <SelectItem key={fi} value={fi}>{fi}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white text-lg font-bold py-6 h-auto"
                  disabled={!pret || mutation.isPending}
                  onClick={() => mutation.mutate()}
                  data-testid="button-envoyer"
                >
                  {mutation.isPending ? "Envoi en cours…" : "Envoyer ma préinscription"}
                </Button>
                <p className="text-sm text-gray-500 text-center">
                  Vos informations restent confidentielles et servent uniquement
                  à vous recontacter.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="mt-8 grid sm:grid-cols-3 gap-4 text-center">
            <a href={WHATSAPP} target="_blank" rel="noreferrer"
               className="flex items-center justify-center gap-2 border rounded-lg py-4 text-green-700 font-semibold hover:bg-green-50 transition-colors">
              <MessageCircle className="h-5 w-5" /> WhatsApp +225 07 47 72 67 29
            </a>
            <a href={"https://wa.me/2250584249090?text=" +
                encodeURIComponent("Bonjour, je souhaite faire ma préinscription au Groupe 2IAE.")}
               target="_blank" rel="noreferrer"
               className="flex items-center justify-center gap-2 border rounded-lg py-4 text-green-700 font-semibold hover:bg-green-50 transition-colors">
              <MessageCircle className="h-5 w-5" /> WhatsApp +225 05 84 24 90 90
            </a>
            <a href="tel:+2250584249090"
               className="flex items-center justify-center gap-2 border rounded-lg py-4 text-gray-800 font-semibold hover:bg-gray-50 transition-colors">
              <Phone className="h-5 w-5" /> Appeler +225 05 84 24 90 90
            </a>
          </div>

          <div className="mt-10 text-center">
            <img
              src="/images/famille-bts-2iae.jpg"
              alt="Trois étudiantes du Groupe 2IAE en uniforme révisent ensemble — la famille BTS de l'École des Entrepreneurs"
              loading="lazy"
              className="w-full max-w-md mx-auto rounded-xl professional-shadow"
            />
            <p className="text-muted-foreground text-sm mt-3">
              Rejoignez la famille BTS de l'École des Entrepreneurs.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
