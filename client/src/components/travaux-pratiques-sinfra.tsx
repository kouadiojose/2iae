// Mise en avant, sur la page d'accueil, de la journée de travaux pratiques
// des étudiants de Yamoussoukro à Sinfra (samedi 17 octobre 2026), juste
// sous celle d'Azaguié : même journée, autre ville, autre campus. Trois
// photos, l'essentiel, et le lien vers le récit (/travaux-pratiques-sinfra).
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const N = " ";
const D = "/images/sinfra-2026";

export function TravauxPratiquesSinfra() {
  return (
    <section
      className="py-16 bg-[#f7f3ee] overflow-hidden"
      data-testid="section-tp-sinfra"
    >
      <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-10 items-center">
        <div className="lg:order-2">
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">
            Travaux pratiques · Sinfra · 17{N}octobre 2026
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight mb-5">
            Le même jour, Yamoussoukro dans les serres de l'école.
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-7">
            Les étudiants du campus de Yamoussoukro ont pris le car pour Sinfra
            : une journée de travaux pratiques au Centre de développement du
            vivrier, le site où l'école forme sur le terrain les étudiants de
            Yamoussoukro et de M'Batto.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/travaux-pratiques-sinfra">
              <Button
                className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto w-full sm:w-auto"
                data-testid="button-tp-sinfra"
              >
                La journée à Sinfra
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 lg:mt-0 lg:order-1">
          <Link href="/travaux-pratiques-sinfra">
            <div className="grid grid-cols-5 grid-rows-2 gap-3 h-[340px] sm:h-[420px] cursor-pointer group">
              <figure className="col-span-3 row-span-2 relative overflow-hidden rounded-xl">
                <img
                  src={`${D}/serre-production.jpg`}
                  alt="Une serre en pleine production au Centre de développement du vivrier de Sinfra"
                  loading="lazy"
                  className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-8 pb-2 text-xs font-semibold text-white">
                  Une serre en production
                </figcaption>
              </figure>
              <figure className="col-span-2 relative overflow-hidden rounded-xl">
                <img
                  src={`${D}/serres-visite.jpg`}
                  alt="Les étudiants de Yamoussoukro à l'entrée des serres de l'école à Sinfra"
                  loading="lazy"
                  className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2 text-xs font-semibold text-white">
                  À l'entrée des serres
                </figcaption>
              </figure>
              <figure className="col-span-2 relative overflow-hidden rounded-xl">
                <img
                  src={`${D}/serre-goutte-a-goutte.jpg`}
                  alt="Irrigation au goutte-à-goutte dans une serre tout juste plantée"
                  loading="lazy"
                  className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2 text-xs font-semibold text-white">
                  Le goutte-à-goutte
                </figcaption>
              </figure>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
