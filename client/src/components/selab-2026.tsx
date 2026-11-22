// Mise en avant, en tête de la page d'accueil, de la victoire du Groupe 2IAE
// à la compétition inter-écoles du SELAB 2026 (Sommet de l'élevage
// d'Abidjan, dimanche 22 novembre 2026). Le récit : /selab-2026.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ARTICLE_SELAB } from "@/pages/selab-2026";

const D = "/images/selab-2026";

export function Selab2026() {
  return (
    <section className="py-16 bg-[#0b2a20] text-white overflow-hidden" data-testid="section-selab-2026">
      <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-10 items-center">
        <div className="lg:order-2">
          <p className="text-xs tracking-[0.25em] uppercase text-[#E9C46A] mb-3">SELAB 2026 · Sommet de l'élevage d'Abidjan</p>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-5">
            Compétition inter-écoles{"\u00a0"}: <span className="text-[#E9C46A]">2IAE l'emporte.</span>
          </h2>
          <p className="text-white/80 leading-relaxed mb-5">
            Dimanche 22 novembre, nos étudiants ont remporté la compétition inter-écoles du ministère des Ressources animales
            et halieutiques. Troisièmes à la théorie, ils ont dominé l'épreuve pratique.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-7">
            <div className="rounded-xl border border-[#E9C46A]/40 bg-white/5 px-4 py-3">
              <p className="font-sans font-bold text-3xl text-[#E9C46A] leading-none">1<sup className="text-base">er</sup></p>
              <p className="text-xs text-white/75 mt-1">au classement général</p>
            </div>
            <div className="rounded-xl border border-[#E9C46A]/40 bg-white/5 px-4 py-3">
              <p className="font-sans font-bold text-3xl text-[#E9C46A] leading-none">74{"\u00a0"}%</p>
              <p className="text-xs text-white/75 mt-1">à l'épreuve pratique</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/selab-2026">
              <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto w-full sm:w-auto" data-testid="button-selab-2026">
                Voir la victoire
              </Button>
            </Link>
            <Link href="/preinscription">
              <Button variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white font-semibold px-8 py-3 h-auto w-full sm:w-auto">
                Je me préinscris
              </Button>
            </Link>
          </div>
          <a href={ARTICLE_SELAB} target="_blank" rel="noopener noreferrer" className="inline-block mt-5 text-sm font-semibold text-[#E9C46A] underline underline-offset-4">
            Lu dans Green Media Africa ↗
          </a>
        </div>

        <div className="mt-2 lg:mt-0 lg:order-1">
          <Link href="/selab-2026">
            <div className="grid grid-cols-5 grid-rows-2 gap-3 h-[320px] sm:h-[420px] cursor-pointer group">
              <figure className="col-span-5 sm:col-span-3 row-span-2 relative overflow-hidden rounded-xl">
                <img src={`${D}/p01.jpg`} alt="Les étudiants du Groupe 2IAE, médailles au cou, sur la scène du SELAB 2026" loading="lazy" className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-8 pb-2 text-xs font-semibold">Remise des prix et des distinctions</figcaption>
              </figure>
              <figure className="hidden sm:block col-span-2 relative overflow-hidden rounded-xl">
                <img src={`${D}/p02.jpg`} alt="Les lauréats sur la scène du SELAB 2026" loading="lazy" className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              </figure>
              <figure className="hidden sm:block col-span-2 relative overflow-hidden rounded-xl">
                <img src={`${D}/p04.jpg`} alt="La scène du Sommet de l'élevage d'Abidjan" loading="lazy" className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              </figure>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
