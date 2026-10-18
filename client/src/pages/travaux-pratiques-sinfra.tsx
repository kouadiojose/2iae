// Journée de travaux pratiques des étudiants du campus de Yamoussoukro au
// Centre de développement du vivrier de Sinfra, le samedi 17 octobre 2026.
//
// Le centre et ses serres appartiennent à l'école : c'est là que se font les
// travaux pratiques des campus de Yamoussoukro et de M'Batto (précision de
// la direction). Le récit s'en tient aux vidéos du départ, au montage des
// étudiants (citations reprises de ses textes) et aux photos des serres.
// Le même jour, les campus d'Abidjan et d'Azaguié étaient en travaux
// pratiques à Azaguié : renvoi vers /travaux-pratiques-azaguie.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { VideoReportage } from "@/components/video-reportage";

const N = " ";
const D = "/images/sinfra-2026";
const V = "/videos/sinfra-2026";

export const PHOTOS_SINFRA = [
  { src: `${D}/serres-rangee.jpg`, legende: "La rangée de serres de l'école" },
  { src: `${D}/serres-visite.jpg`, legende: "Les étudiants à l'entrée des serres" },
  { src: `${D}/serre-production.jpg`, legende: "Une serre en pleine production" },
  { src: `${D}/serre-cultures.jpg`, legende: "Cultures en lignes" },
  { src: `${D}/serre-goutte-a-goutte.jpg`, legende: "Goutte-à-goutte : une serre tout juste plantée" },
];

export default function TravauxPratiquesSinfraPage() {
  usePageMeta(
    "Travaux pratiques à Sinfra : les étudiants de Yamoussoukro dans les serres de l'école | Groupe 2IAE",
    "Samedi 17 octobre 2026, les étudiants du campus de Yamoussoukro en travaux pratiques au Centre de développement du vivrier de Sinfra, dans les serres de l'école : cultures vivrières, irrigation au goutte-à-goutte, pratiques agricoles.",
    "/travaux-pratiques-sinfra",
  );

  return (
    <div className="mobile-safe">
      {/* Héros : la rangée de serres */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        <img src={`${D}/serres-rangee.jpg`} alt="La rangée de serres de l'école au Centre de développement du vivrier de Sinfra" className="absolute inset-0 w-full !h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1f3a] via-[#0b1f3a]/70 to-[#0b1f3a]/10" />
        <div className="relative container mx-auto px-4 max-w-6xl pb-14 pt-32 text-white">
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-4">
            Travaux pratiques · Sinfra · Samedi 17{N}octobre 2026
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] max-w-4xl">
            Les étudiants de Yamoussoukro dans les serres de l'école.
          </h1>
          <p className="mt-6 text-lg text-white/85 max-w-2xl leading-relaxed">
            Une journée de travaux pratiques au Centre de développement du vivrier de Sinfra, le site où l'école forme sur
            le terrain les étudiants de Yamoussoukro et de M'Batto.
          </p>
        </div>
      </section>

      {/* Le départ */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 items-center">
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">Le départ · Campus de Yamoussoukro</p>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight mb-5">
              À peine la rentrée faite, la première sortie.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Samedi matin, devant le campus de Yamoussoukro, les étudiants sont montés, garçons comme filles, dans le car
              offert par l'école. Direction Sinfra, pour leur première sortie de l'année 2026‑2027.
            </p>
            <p className="border-l-4 border-[#E8720C] pl-4 font-serif text-xl text-foreground leading-snug mb-2">
              «{N}Je suis ravie et impatiente.{N}»
            </p>
            <p className="text-sm text-muted-foreground pl-5">
              Une étudiante, avant le départ. Et le BTS dans deux ans{N}? «{N}Je vous le promets.{N}»
            </p>
          </div>
          <VideoReportage
            src={`${V}/avant-depart-yamoussoukro.mp4`}
            poster={`${V}/avant-depart-yamoussoukro-poster.jpg`}
            titre="Devant le campus de Yamoussoukro, avant le départ · 1 min 10"
          />
        </div>
      </section>

      {/* Dans les serres */}
      <section className="py-16 bg-[#0b1f3a] text-white" data-testid="section-serres-sinfra">
        <div className="container mx-auto px-4 max-w-6xl">
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-3">Centre de développement du vivrier · Sinfra</p>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-4">Dans les serres de l'école.</h2>
          <p className="text-white/80 leading-relaxed max-w-3xl mb-10">
            Une rangée de serres, l'irrigation au goutte‑à‑goutte, des cultures en lignes : certaines serres sont en
            pleine production, d'autres tout juste plantées. C'est ici que les étudiants de Yamoussoukro et de M'Batto
            font leurs travaux pratiques.
          </p>
          <div className="grid md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-6 items-start">
            <div className="w-full max-w-[320px] mx-auto md:max-w-none md:sticky md:top-24 [&_figcaption]:text-white/70">
              <VideoReportage
                format="aspect-[368/496]"
                src={`${V}/visite-vivrier-sinfra.mp4`}
                poster={`${V}/visite-vivrier-sinfra-poster.jpg`}
                titre="La journée, racontée par les étudiants · 55 s"
              />
            </div>
            <div>
              <div className="grid grid-cols-2 gap-3" data-testid="galerie-sinfra">
                {PHOTOS_SINFRA.map((p, i) => (
                  <figure key={p.src} className={`relative overflow-hidden rounded-xl aspect-[16/9] ${i === 0 ? "col-span-2" : ""}`}>
                    <img src={p.src} alt={p.legende} loading="lazy" className="absolute inset-0 w-full !h-full object-cover" />
                    <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-8 pb-2 text-xs font-semibold text-white">
                      {p.legende}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* La parole des étudiants */}
      <section className="py-16 bg-[#f7f3ee]">
        <div className="container mx-auto px-4 max-w-4xl">
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-6">Ce qu'en disent les étudiants</p>
          <blockquote className="border-l-4 border-[#E8720C] pl-6">
            <p className="font-serif text-2xl md:text-3xl text-foreground leading-snug">
              «{N}Cette immersion nous a permis de découvrir les pratiques agricoles, l'importance des cultures vivrières
              et les initiatives qui contribuent au développement de notre agriculture.{N}»
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mt-5">
              «{N}Au-delà de la découverte, cette expérience nous rappelle que l'entrepreneuriat, l'innovation et le
              travail sont des leviers essentiels pour bâtir l'avenir.{N}»
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mt-5">
              «{N}Nous adressons nos sincères remerciements à notre fondateur pour cette belle initiative et pour cette
              opportunité d'apprentissage sur le terrain.{N}»
            </p>
            <footer className="text-sm text-muted-foreground mt-5">Les étudiants du campus de Yamoussoukro, dans leur récit de la journée</footer>
          </blockquote>
        </div>
      </section>

      {/* Le départ en vidéo, et le renvoi vers Azaguié */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-5">Le départ en vidéo</p>
          <div className="grid sm:grid-cols-2 gap-5">
            <VideoReportage
              src={`${V}/depart-campus-yamoussoukro.mp4`}
              poster={`${V}/depart-campus-yamoussoukro-poster.jpg`}
              titre="« Le pratico-pratique en action » · 42 s"
            />
            <VideoReportage
              src={`${V}/embarquement-car-sinfra.mp4`}
              poster={`${V}/embarquement-car-sinfra-poster.jpg`}
              titre="L'embarquement dans le car · 1 min 47"
            />
          </div>

          <Link href="/travaux-pratiques-azaguie">
            <div
              className="group mt-14 grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] rounded-xl overflow-hidden border border-border cursor-pointer"
              data-testid="renvoi-azaguie"
            >
              <div className="relative min-h-[180px]">
                <img src="/images/tp-azaguie-2026/p06.jpg" alt="Les étudiants du bâtiment, casqués, à Azaguié" loading="lazy" className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              </div>
              <div className="p-6 md:p-8 bg-[#eef2f8]">
                <p className="text-xs tracking-[0.2em] uppercase text-[#0d2c54] font-semibold mb-2">Le même jour, à Azaguié</p>
                <p className="font-serif text-2xl text-foreground leading-snug mb-3">
                  Les premières années d'Abidjan et d'Azaguié en travaux pratiques à l'Université de l'Entrepreneuriat.
                </p>
                <span className="font-semibold text-[#0d2c54] underline underline-offset-4 group-hover:no-underline">Leur journée →</span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Appel */}
      <section className="py-14 bg-[#E8720C]">
        <div className="container mx-auto px-4 max-w-6xl flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 text-white">
            <p className="font-serif text-3xl leading-tight mb-2">L'école des entrepreneurs se vit sur le terrain.</p>
            <p className="text-white/90">Les inscriptions sont ouvertes. Les cours ont commencé.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link href="/preinscription">
              <Button className="bg-white text-[#E8720C] hover:bg-white/90 font-bold px-8 py-3 h-auto w-full">Je me préinscris</Button>
            </Link>
            <Link href="/campus">
              <Button variant="outline" className="border-white/70 bg-transparent text-white hover:bg-white/10 hover:text-white font-semibold px-8 py-3 h-auto w-full">
                Nos cinq campus
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
