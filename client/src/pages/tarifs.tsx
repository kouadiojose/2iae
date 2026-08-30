// Tarifs officiels de la rentrée — refonte orientée conversion : montants
// clairs par campus, fiche officielle téléchargeable, pièces et fournitures,
// et moyens de paiement sécurisés mis en avant.
import { usePageMeta } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import type { Tariff } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  MapPin,
  Phone,
  FileText,
  ShieldCheck,
  CheckCircle,
  Download,
  ShoppingBag,
  Loader2,
} from "lucide-react";

// Fiches officielles téléchargeables, par campus.
const FICHES: Record<string, string> = {
  PALMERAIE: "/docs/fiche-rentree-2026-palmeraie.pdf",
  YAMOUSSOUKRO: "/docs/fiche-rentree-2026-yamoussoukro.pdf",
  YOPOUGON: "/docs/fiche-rentree-2026-yopougon.pdf",
  AZAGUI: "/docs/fiche-rentree-2026-azaguie.pdf",
};

function ficheDe(site: string): string | null {
  const s = site.toUpperCase();
  for (const [cle, url] of Object.entries(FICHES)) if (s.includes(cle)) return url;
  return null;
}

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} F CFA`;

export default function Tarifs() {
  usePageMeta(
    "Tarifs Rentrée 2026-2027 — BTS au Groupe 2IAE | frais officiels par campus",
    "Les tarifs officiels 2026-2027 du Groupe 2IAE : 100 000 F d'inscription, frais annexes par campus, pièces à fournir, fournitures et paiement sécurisé (virement, chèque, Wave, Orange Money — aucun paiement en espèces).",
    "/tarifs",
  );

  const { data, isLoading } = useQuery<{ success: boolean; tariffs: Tariff[] }>({
    queryKey: ["/api/tariffs"],
  });
  const tarifs = (data?.tariffs ?? []).filter((t) => t.isActive !== false);
  const premier = tarifs[0];
  const documents = Array.isArray(premier?.requiredDocuments)
    ? (premier!.requiredDocuments as string[])
    : [];
  const fournitures = Array.isArray(premier?.supplies)
    ? (premier!.supplies as string[])
    : [];

  return (
    <div className="min-h-screen">
      <section className="py-16 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-4">
            Rentrée académique 2026-2027 · BTS Orientés 1ère année
          </p>
          <h1 className="font-serif text-4xl md:text-5xl mb-4" data-testid="text-page-title">
            Des tarifs clairs. Aucune surprise.
          </h1>
          <p className="text-xl text-white/85 max-w-3xl mx-auto">
            Les frais officiels de chaque campus, la fiche à télécharger, et un
            paiement 100 % traçable — virement, chèque, Wave ou Orange Money.
          </p>
        </div>
      </section>

      {/* Réassurance paiement */}
      <section className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
          <span className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Aucun paiement en espèces aux caisses
          </span>
          <span className="text-muted-foreground">
            Moyens acceptés : <strong className="text-foreground">Virement bancaire · Chèque · Wave · Orange Money</strong>
          </span>
        </div>
      </section>

      {/* Cartes par campus */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
              {tarifs.map((t) => {
                const fiche = ficheDe(t.site);
                return (
                  <Card key={t.id} className="professional-shadow border-0 flex flex-col" data-testid={`card-tarif-${t.id}`}>
                    <CardContent className="p-6 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h2 className="text-xl font-bold text-foreground">{t.site}</h2>
                        <Badge variant="secondary">{t.programDuration || "2 ans"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-5">
                        <MapPin className="h-4 w-4 shrink-0" /> {t.location}
                      </p>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Droit d'inscription</span>
                          <span className="font-semibold text-foreground">{fcfa(t.inscriptionFee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frais annexes</span>
                          <span className="font-semibold text-foreground">{fcfa(t.fraisAnnexes)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 mt-2">
                          <span className="font-bold text-foreground">Total 1ère année</span>
                          <span className="font-serif text-2xl font-semibold text-primary">{fcfa(t.totalFee)}</span>
                        </div>
                      </div>

                      {t.accountInfo && (
                        <p className="text-xs text-muted-foreground mt-4 bg-muted rounded-md p-2">
                          {t.accountInfo}
                        </p>
                      )}

                      <div className="mt-auto pt-5 space-y-2">
                        {fiche && (
                          <a href={fiche} target="_blank" rel="noreferrer" className="block">
                            <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/5" data-testid={`button-fiche-${t.id}`}>
                              <Download className="h-4 w-4 mr-2" />
                              Fiche officielle du campus (PDF)
                            </Button>
                          </a>
                        )}
                        <Link href="/preinscription" className="block">
                          <Button className="w-full bg-[#E8720C] hover:bg-[#c96208] text-white font-bold">
                            Je me préinscris sur ce campus
                          </Button>
                        </Link>
                        {t.phone && (
                          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                            <Phone className="h-3 w-3" /> {t.phone}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <p className="text-center text-sm text-muted-foreground mt-8">
            L'échéancier de paiement détaillé figure au verso de la fiche
            officielle de chaque campus, et reste disponible auprès du service
            des admissions.
          </p>
        </div>
      </section>

      {/* Pièces à fournir et fournitures */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-4 max-w-5xl grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-5 flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" /> Pièces à fournir
            </h2>
            <ul className="space-y-3">
              {documents.map((d) => (
                <li key={d} className="flex gap-2 text-gray-700">
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-5 flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" /> Fournitures de rentrée
            </h2>
            <ul className="space-y-3">
              {fournitures.map((f) => (
                <li key={f} className="flex gap-2 text-gray-700">
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 bg-muted rounded-xl p-5">
              <p className="font-semibold text-foreground mb-1">
                Bacheliers orientés par l'État
              </p>
              <p className="text-sm text-muted-foreground">
                Votre affectation par la Direction de l'Orientation et des
                Bourses vaut préinscription : présentez-vous directement au
                campus avec vos pièces, ou préinscrivez-vous en ligne pour être
                rappelé.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 gradient-bg text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="font-serif text-3xl md:text-4xl mb-4">
            Une question sur les frais ou l'échéancier ?
          </h2>
          <p className="text-white/85 mb-8 max-w-2xl mx-auto">
            Un conseiller vous répond et vous accompagne jusqu'à l'inscription.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/preinscription">
              <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white px-8 py-4 text-lg h-auto font-bold">
                Je me préinscris
              </Button>
            </Link>
            <a
              href={"https://wa.me/2250747726729?text=" + encodeURIComponent("Bonjour, j'ai une question sur les tarifs de la rentrée 2026-2027.")}
              target="_blank"
              rel="noreferrer"
            >
              <Button className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg h-auto font-semibold">
                Poser ma question sur WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
