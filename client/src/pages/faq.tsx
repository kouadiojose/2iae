// Questions fréquentes — la page que lisent les parents prudents, et que
// citent les moteurs de recherche et les assistants IA (le serveur sert le
// même contenu en JSON-LD FAQPage).
import { Link } from "wouter";
import { usePageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQS } from "@shared/faq";

export default function FaqPage() {
  usePageMeta(
    "Questions fréquentes — tarifs, filières, préinscription, internat | Groupe 2IAE",
    "Les réponses aux questions des parents et étudiants : frais de scolarité 2026-2027, filières et débouchés, préinscription en ligne, internat d'Azaguié, reconnaissance des diplômes, insertion professionnelle.",
    "/faq",
  );

  return (
    <div className="min-h-screen">
      <section className="py-16 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-4">
            Rentrée 2026-2027 · On répond à tout
          </p>
          <h1 className="font-serif text-4xl md:text-5xl mb-4" data-testid="text-page-title">
            Vos questions, nos réponses.
          </h1>
          <p className="text-xl text-white/85 max-w-3xl mx-auto">
            Tarifs, filières, internat, débouchés : tout ce que parents et
            étudiants demandent avant de choisir le Groupe 2IAE — avec des
            chiffres vérifiables, pas des promesses.
          </p>
        </div>
      </section>

      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <Accordion type="single" collapsible className="space-y-3" data-testid="faq-accordion">
            {FAQS.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`q-${i}`}
                className="bg-white rounded-xl professional-shadow border-0 px-5"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {f.r}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center bg-muted rounded-xl p-8">
            <h2 className="font-serif text-2xl text-foreground mb-2">
              Une autre question ?
            </h2>
            <p className="text-muted-foreground mb-6">
              Notre assistant en ligne répond immédiatement, et un conseiller
              vous rappelle gratuitement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/preinscription">
                <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto">
                  Je me préinscris
                </Button>
              </Link>
              <a
                href={"https://wa.me/2250747726729?text=" + encodeURIComponent("Bonjour, j'ai une question sur le Groupe 2IAE.")}
                target="_blank"
                rel="noreferrer"
              >
                <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 h-auto">
                  Poser ma question sur WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
