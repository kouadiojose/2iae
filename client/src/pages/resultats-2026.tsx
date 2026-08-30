// Résultats BTS 2026 — l'affiche officielle du groupe et le détail par
// campus, tels que publiés par l'établissement.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/lib/seo";

const CAMPUS = [
  {
    nom: "Université de l'Entrepreneuriat — 2IAE Azaguié",
    taux: "83,54 %",
    image: "/images/resultats-2026-azaguie.jpg",
    fort: "ATPV 93,75 % · ATPA 90,62 %",
  },
  {
    nom: "2IAE Yamoussoukro",
    taux: "68,18 %",
    image: "/images/resultats-2026-yamoussoukro.jpg",
    fort: "ATPA 100 % · ATPV 84,61 %",
  },
  {
    nom: "2IAE Yopougon",
    taux: "64,13 %",
    image: "/images/resultats-2026-yopougon.jpg",
    fort: "ATPV 93,33 % · RHCOM 92,3 %",
  },
  {
    nom: "2IAE Palmeraie",
    taux: "58,40 %",
    image: "/images/resultats-2026-palmeraie.jpg",
    fort: "ATPA 90,9 % · ATPV et RHCOM 88,23 %",
  },
];

export default function Resultats2026Page() {
  usePageMeta(
    "Résultats BTS 2026 du Groupe 2IAE : 67,38 % d'admis (national : 42,48 %)",
    "Les résultats provisoires du BTS 2026 campus par campus : Azaguié 83,54 %, Yamoussoukro 68,18 % (ATPA 100 %), Yopougon 64,13 %, Palmeraie 58,40 %. Taux global 67,38 % contre 42,48 % au national.",
    "/resultats-bts-2026",
  );

  return (
    <div className="min-h-screen">
      <section className="py-16 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-4">
            Résultats provisoires · BTS 2026 · 20 ans au service de l'excellence
          </p>
          <h1 className="font-serif text-4xl md:text-5xl mb-4" data-testid="text-page-title">
            67,38 % d'admis au BTS 2026.
          </h1>
          <p className="text-xl text-white/85 max-w-3xl mx-auto">
            Contre 42,48 % au niveau national — la preuve, campus par campus
            et filière par filière, que l'exigence paie.
          </p>
        </div>
      </section>

      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <img
            src="/images/resultats-bts-2026.jpg"
            alt="Affiche officielle des résultats provisoires BTS 2026 du Groupe 2IAE"
            className="w-full rounded-xl professional-shadow"
            data-testid="img-resultats-global"
          />
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="font-serif text-3xl md:text-4xl text-foreground text-center mb-10">
            Le détail par campus
          </h2>
          <div className="grid md:grid-cols-2 gap-10">
            {CAMPUS.map((c) => (
              <Card key={c.nom} className="professional-shadow border-0 overflow-hidden">
                <img
                  src={c.image}
                  alt={`Performances BTS 2026 — ${c.nom} : ${c.taux} d'admis`}
                  loading="lazy"
                  className="w-full h-auto"
                />
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-foreground">{c.nom}</h3>
                    <p className="text-sm text-muted-foreground">
                      Filières en tête : {c.fort}
                    </p>
                  </div>
                  <p className="font-serif text-3xl font-semibold text-primary whitespace-nowrap">
                    {c.taux}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-muted-foreground text-sm mt-8">
            Résultats provisoires publiés par le Groupe 2IAE — taux national
            BTS 2026 : 42,48 %.
          </p>
        </div>
      </section>

      <section className="py-16 gradient-bg text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="font-serif text-3xl md:text-4xl mb-4">
            Votre réussite commence ici.
          </h2>
          <p className="text-white/85 mb-8 max-w-2xl mx-auto">
            Rejoignez l'école qui prouve ses résultats — la préinscription
            prend cinq minutes, gratuite et sans engagement.
          </p>
          <Link href="/preinscription">
            <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white px-10 py-4 text-lg h-auto font-bold">
              Je me préinscris
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
