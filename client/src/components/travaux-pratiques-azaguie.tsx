// Mise en avant, sur la page d'accueil, de la journée de travaux pratiques
// d'Azaguié (samedi 17 octobre 2026) : trois photos, l'essentiel en deux
// phrases, et le lien vers le récit complet (/travaux-pratiques-azaguie).
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const N = " ";
const D = "/images/tp-azaguie-2026";

export function TravauxPratiquesAzaguie() {
  return (
    <section className="py-16 bg-[#0b1f3a] text-white overflow-hidden" data-testid="section-tp-azaguie">
      <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 items-center">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-3">
            Travaux pratiques · Azaguié · 17{N}octobre 2026
          </p>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-5">
            Sur le terrain, avant même le premier cours de spécialité.
          </h2>
          <p className="text-white/80 leading-relaxed mb-4">
            Toute une journée d'immersion pour les premières années d'Abidjan et d'Azaguié, à l'Université de l'Entrepreneuriat : au verger, à
            la ferme, sur le chantier. Le bâtiment s'est formé devant des maisons construites par les promotions
            précédentes, de la fondation au crépissage.
          </p>
          <p className="text-white/80 leading-relaxed mb-7">
            Les autres filières ont fait tourner la journée : la communication, la logistique, les finances.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/travaux-pratiques-azaguie">
              <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto w-full sm:w-auto" data-testid="button-tp-azaguie">
                Le récit de la journée
              </Button>
            </Link>
            <Link href="/preinscription">
              <Button variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white font-semibold px-8 py-3 h-auto w-full sm:w-auto">
                Je me préinscris
              </Button>
            </Link>
          </div>
        </div>

        <Link href="/travaux-pratiques-azaguie">
          <div className="grid grid-cols-5 grid-rows-2 gap-3 h-[340px] sm:h-[420px] cursor-pointer group">
            <figure className="col-span-3 row-span-2 relative overflow-hidden rounded-xl">
              <img src={`${D}/p06.jpg`} alt="Les étudiants de première année du bâtiment, casqués, à Azaguié" loading="lazy" className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-8 pb-2 text-xs font-semibold">Le bâtiment, sur le site</figcaption>
            </figure>
            <figure className="col-span-2 relative overflow-hidden rounded-xl">
              <img src={`${D}/p04.jpg`} alt="Une étudiante traite les papayers du verger de la ferme-école d'Azaguié" loading="lazy" className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2 text-xs font-semibold">Au verger</figcaption>
            </figure>
            <figure className="col-span-2 relative overflow-hidden rounded-xl">
              <img src={`${D}/p13.jpg`} alt="La volaille de la ferme-école d'Azaguié" loading="lazy" className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2 text-xs font-semibold">À la ferme</figcaption>
            </figure>
          </div>
        </Link>
      </div>
    </section>
  );
}
