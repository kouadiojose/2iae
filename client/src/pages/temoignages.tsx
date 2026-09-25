// Avis aux anciens étudiants — appel à témoignages lancé par le Département
// Communication pour les 20 ans de l'école. Le formulaire reprend exactement
// les informations demandées dans l'avis (nom complet, localisation,
// entreprise créée ou poste occupé, années d'expérience), de sorte que
// chaque témoignage arrive structuré plutôt qu'en texte libre.
import { useState } from "react";
import { usePageMeta } from "@/lib/seo";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, MessageCircle } from "lucide-react";

const SITUATIONS = [
  "J'ai créé ma propre entreprise",
  "Je suis salarié(e) dans une entreprise",
  "J'exerce en indépendant",
  "Je poursuis mes études",
];

const EXPERIENCE = [
  "Moins d'un an",
  "1 à 2 ans",
  "3 à 5 ans",
  "6 à 10 ans",
  "Plus de 10 ans",
];

const WHATSAPP =
  "https://wa.me/2250747726729?text=" +
  encodeURIComponent(
    "Bonjour, je suis un(e) ancien(ne) étudiant(e) du Groupe 2IAE et je souhaite témoigner de mon parcours.",
  );

export default function TemoignagesPage() {
  usePageMeta(
    "Avis aux anciens étudiants — partagez votre réussite | Groupe 2IAE",
    "Vous avez été formé au Groupe Écoles 2IAE ? Témoignez de votre parcours et de votre réussite professionnelle. Vos témoignages célèbrent les 20 ans de l'école des entrepreneurs.",
    "/temoignages",
  );

  const { toast } = useToast();
  const [envoye, setEnvoye] = useState(false);
  const [f, setF] = useState({
    name: "",
    phone: "",
    email: "",
    localisation: "",
    situation: "",
    poste: "",
    experience: "",
    promotion: "",
    parcours: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const message =
        `Témoignage d'ancien étudiant\n` +
        `Localisation : ${f.localisation || "non précisée"}\n` +
        `Situation : ${f.situation || "non précisée"}\n` +
        `Entreprise créée ou poste occupé : ${f.poste || "non précisé"}\n` +
        `Années d'expérience : ${f.experience || "non précisé"}\n` +
        `Filière et année de sortie : ${f.promotion || "non précisées"}\n` +
        `Parcours et témoignage : ${f.parcours || "non renseigné"}`;
      return apiRequest("/api/contact", "POST", {
        name: f.name,
        email: f.email || "temoignage@2iae.com",
        phone: f.phone,
        subject: "Témoignage d'ancien étudiant",
        message,
      });
    },
    onSuccess: () => setEnvoye(true),
    onError: () =>
      toast({
        title: "Erreur",
        description:
          "L'envoi a échoué. Réessayez, ou écrivez-nous directement sur WhatsApp.",
        variant: "destructive",
      }),
  });

  const pret =
    f.name.trim().length >= 3 &&
    f.phone.trim().length >= 8 &&
    f.localisation.trim().length >= 2;

  return (
    <div className="min-h-screen">
      <section className="py-16 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-4">
            Avis aux anciens étudiants · 20 ans du Groupe 2IAE
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl mb-4"
            data-testid="text-page-title"
          >
            Votre réussite est notre meilleure preuve.
          </h1>
          <p className="text-xl text-white/85 max-w-3xl mx-auto">
            Vous avez été formé au Groupe Écoles 2IAE et vous souhaitez
            témoigner de la qualité de votre formation ? Faites-nous part de
            votre parcours et de votre réussite professionnelle après 2IAE.
          </p>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="bg-white rounded-xl professional-shadow p-8">
            <h2 className="font-serif text-2xl text-foreground mb-4">
              Pourquoi votre témoignage compte
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              L'école fête ses 20 ans. Vingt ans, cela ne se raconte pas avec
              des slogans : cela se raconte avec des parcours. Le vôtre dira à
              un bachelier qui hésite aujourd'hui ce que devient, cinq ou dix
              ans plus tard, un étudiant passé par nos amphis, nos champs-écoles
              et nos chantiers.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Plus nous serons nombreux, plus la célébration aura de sens — et
              c'est ensemble que nous fêterons les 20 ans de votre école,
              l'école des entrepreneurs.
            </p>
            <p className="text-sm text-muted-foreground mt-6 pt-6 border-t border-border">
              Département Communication, Groupe Écoles 2IAE International.
            </p>
          </div>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
          {envoye ? (
            <Card className="professional-shadow border-0 text-center">
              <CardContent className="p-10">
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="font-serif text-2xl text-foreground mb-2">
                  Merci {f.name} !
                </h2>
                <p className="text-muted-foreground mb-6">
                  Votre témoignage est bien arrivé au Département
                  Communication. Nous vous recontacterons au {f.phone} pour la
                  suite — et peut-être pour vous inviter à la célébration des
                  20 ans.
                </p>
                <a href={WHATSAPP} target="_blank" rel="noreferrer">
                  <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Ajouter une photo sur WhatsApp
                  </Button>
                </a>
              </CardContent>
            </Card>
          ) : (
            <Card className="professional-shadow border-0">
              <CardContent className="p-8 space-y-5">
                <h2 className="font-serif text-2xl text-foreground">
                  Racontez-nous votre parcours
                </h2>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="tem-nom">Nom et prénoms *</Label>
                    <Input
                      id="tem-nom"
                      value={f.name}
                      onChange={(e) => setF({ ...f, name: e.target.value })}
                      placeholder="Ex. : Kouassi Aya Marie"
                      data-testid="input-temoignage-nom"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tem-localisation">
                      Où vivez-vous aujourd'hui ? *
                    </Label>
                    <Input
                      id="tem-localisation"
                      value={f.localisation}
                      onChange={(e) =>
                        setF({ ...f, localisation: e.target.value })
                      }
                      placeholder="Ex. : Abidjan, Bouaké, Canada…"
                      data-testid="input-temoignage-localisation"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="tem-tel">Téléphone *</Label>
                    <Input
                      id="tem-tel"
                      value={f.phone}
                      onChange={(e) => setF({ ...f, phone: e.target.value })}
                      placeholder="Ex. : 07 47 72 67 29"
                      data-testid="input-temoignage-telephone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tem-email">E-mail</Label>
                    <Input
                      id="tem-email"
                      type="email"
                      value={f.email}
                      onChange={(e) => setF({ ...f, email: e.target.value })}
                      placeholder="Facultatif"
                      data-testid="input-temoignage-email"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label>Votre situation aujourd'hui</Label>
                    <Select
                      value={f.situation}
                      onValueChange={(v) => setF({ ...f, situation: v })}
                    >
                      <SelectTrigger data-testid="select-temoignage-situation">
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        {SITUATIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Années d'expérience</Label>
                    <Select
                      value={f.experience}
                      onValueChange={(v) => setF({ ...f, experience: v })}
                    >
                      <SelectTrigger data-testid="select-temoignage-experience">
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPERIENCE.map((e) => (
                          <SelectItem key={e} value={e}>
                            {e}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="tem-poste">
                    L'entreprise que vous avez créée, ou le poste que vous
                    occupez
                  </Label>
                  <Input
                    id="tem-poste"
                    value={f.poste}
                    onChange={(e) => setF({ ...f, poste: e.target.value })}
                    placeholder="Ex. : Gérante de la ferme avicole Bénédiction, ou Chef de chantier chez…"
                    data-testid="input-temoignage-poste"
                  />
                </div>

                <div>
                  <Label htmlFor="tem-promo">
                    Votre filière et votre année de sortie
                  </Label>
                  <Input
                    id="tem-promo"
                    value={f.promotion}
                    onChange={(e) => setF({ ...f, promotion: e.target.value })}
                    placeholder="Ex. : BTS Production animale, promotion 2019"
                    data-testid="input-temoignage-promotion"
                  />
                </div>

                <div>
                  <Label htmlFor="tem-parcours">Votre témoignage</Label>
                  <Textarea
                    id="tem-parcours"
                    rows={5}
                    value={f.parcours}
                    onChange={(e) => setF({ ...f, parcours: e.target.value })}
                    placeholder="Ce que la formation vous a apporté, ce que vous faites aujourd'hui, ce que vous diriez à un bachelier qui hésite…"
                    data-testid="input-temoignage-parcours"
                  />
                </div>

                <Button
                  className="w-full bg-[#E8720C] hover:bg-[#c96208] text-white font-bold py-3 h-auto"
                  disabled={!pret || mutation.isPending}
                  onClick={() => mutation.mutate()}
                  data-testid="button-envoyer-temoignage"
                >
                  {mutation.isPending ? "Envoi…" : "Envoyer mon témoignage"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Les champs marqués d'une étoile sont nécessaires pour vous
                  recontacter. Vous préférez écrire ?{" "}
                  <a
                    href={WHATSAPP}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    Témoignez sur WhatsApp
                  </a>
                  .
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
