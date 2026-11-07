// Mise en avant, en tête de la page d'accueil, des deux Prix spéciaux
// panafricains ICS 2025-2026 (remis le 31 octobre 2026) : le Groupe 2IAE
// « Meilleure école de formation », Séraphin Koua « Meilleur dirigeant des
// grandes écoles ». Le récit complet : /prix-ics-2026.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PRIX_ICS } from "@/pages/prix-ics-2026";

const N = " ";
const D = "/images/prix-ics-2026";

export function PrixIcs() {
  return (
    <section className="py-16 bg-[#0b1f3a] text-white overflow-hidden" data-testid="section-prix-ics">
      <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] gap-10 items-center">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-[#E9C46A] mb-3">
            Prix spéciaux panafricains ICS 2025‑2026 · 31{N}octobre{N}2026
          </p>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-6">
            Deux prix pour le Groupe 2IAE et son fondateur.
          </h2>
          <ul className="flex flex-col gap-3 mb-7">
            {PRIX_ICS.map((p) => (
              <li key={p.titre} className="rounded-xl border border-[#E9C46A]/40 bg-white/5 px-5 py-4">
                <span className="block font-serif text-xl text-[#E9C46A] leading-snug">{p.titre}</span>
                <span className="block text-sm text-white/75 mt-1">{p.laureat}</span>
              </li>
            ))}
          </ul>
          <p className="text-white/75 leading-relaxed mb-7">
            Décernés par l'Interafricaine de communication et de sondages, remis à l'Ivotel, au Plateau. «{N}C'est toute la
            Côte d'Ivoire qui gagne{N}», a dit Séraphin Koua.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/prix-ics-2026">
              <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto w-full sm:w-auto" data-testid="button-prix-ics">
                La remise des prix
              </Button>
            </Link>
            <Link href="/preinscription">
              <Button variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white font-semibold px-8 py-3 h-auto w-full sm:w-auto">
                Je me préinscris
              </Button>
            </Link>
          </div>
          <Link href="/prix-ics-2026#life-tv">
            <span className="inline-flex items-center gap-2 mt-5 text-sm font-semibold text-[#E9C46A] underline underline-offset-4 cursor-pointer" data-testid="lien-life-tv">
              ▶ Vu au journal de 12{N}h{N}45 de Life TV
            </span>
          </Link>
        </div>

        <Link href="/prix-ics-2026">
          <div className="grid grid-cols-5 grid-rows-2 gap-3 h-[340px] sm:h-[440px] cursor-pointer group">
            <figure className="col-span-3 row-span-2 relative overflow-hidden rounded-xl">
              <img src={`${D}/fondateur-trophee.jpg`} alt="Séraphin Koua, fondateur du Groupe 2IAE, trophée ICS en main" loading="lazy" className="absolute inset-0 w-full !h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
              <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-8 pb-2 text-xs font-semibold">Le trophée</figcaption>
            </figure>
            <figure className="col-span-2 relative overflow-hidden rounded-xl">
              <img src={`${D}/p01.jpg`} alt="Les lauréats ICS 2025-2026, trophées en main" loading="lazy" className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2 text-xs font-semibold">Les lauréats</figcaption>
            </figure>
            <figure className="col-span-2 relative overflow-hidden rounded-xl">
              <img src={`${D}/p02.jpg`} alt="Le fondateur et le trophée avec les étudiants du Groupe 2IAE" loading="lazy" className="absolute inset-0 w-full !h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2 text-xs font-semibold">Avec les étudiants</figcaption>
            </figure>
          </div>
        </Link>
      </div>
    </section>
  );
}
