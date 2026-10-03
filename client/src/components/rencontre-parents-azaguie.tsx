// Réunion de la direction avec les parents d'élèves sur le campus
// d'Azaguié (Université de l'Entrepreneuriat), le samedi 3 octobre 2026 :
// une séance en salle, puis la visite du terrain. Tout ce qui est affirmé
// ici se voit sur les photos (salle de réunion, bassins de pisciculture,
// cultures, bâtiments du campus) ; le 83,54 % est le résultat officiel du
// campus au BTS 2026, déjà publié sur /resultats-bts-2026.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const N = " ";

const PHOTOS = [
  {
    src: "/images/rencontre-parents-azaguie-3.jpg",
    alt: "Réunion de la direction du Groupe 2IAE avec les parents d'élèves et les étudiants, en salle, sur le campus d'Azaguié",
    legende: "La réunion",
  },
  {
    src: "/images/rencontre-parents-azaguie-1.jpg",
    alt: "Parents d'élèves et membres de la direction au bord des bassins de pisciculture de la ferme-école d'Azaguié",
    legende: "Les bassins de pisciculture",
  },
  {
    src: "/images/rencontre-parents-azaguie-5.jpg",
    alt: "Visite des cultures de la ferme-école d'Azaguié avec les parents d'élèves",
    legende: "Les cultures de la ferme-école",
  },
  {
    src: "/images/rencontre-parents-azaguie-4.jpg",
    alt: "Les parents d'élèves visitent le campus de l'Université de l'Entrepreneuriat à Azaguié",
    legende: "Le campus",
  },
];

export function RencontreParentsAzaguie() {
  return (
    <section className="py-16 bg-white" data-testid="section-rencontre-azaguie">
      <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 items-center">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">
            Rencontre parents · Azaguié · 3{N}octobre 2026
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-5 leading-tight">
            À Azaguié, les parents ont vu le terrain.
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Ce samedi, la direction du Groupe 2IAE a reçu les parents d'élèves
            sur le campus de l'Université de l'Entrepreneuriat. Une réunion
            d'abord, puis la visite de ce qui fait l'école : les bassins de
            pisciculture, les cultures de la ferme-école, les bâtiments du
            campus.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-6">
            C'est ici que le groupe obtient son meilleur résultat au BTS 2026 :{" "}
            <strong className="text-foreground">83,54{N}% d'admis</strong>. On
            l'apprend en pratiquant.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/preinscription">
              <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto w-full sm:w-auto">
                Je me préinscris
              </Button>
            </Link>
            <Link href="/universite-entrepreneuriat">
              <Button variant="outline" className="font-semibold px-8 py-3 h-auto w-full sm:w-auto">
                Le campus d'Azaguié
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PHOTOS.map((p, i) => (
            <figure key={p.src} className={`relative overflow-hidden rounded-xl ${i === 0 ? "col-span-2 sm:col-span-3 aspect-[16/9]" : "aspect-[4/3]"} ${i === 3 ? "col-span-2 sm:col-span-1" : ""}`}>
              <img src={p.src} alt={p.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" data-testid={`img-rencontre-azaguie-${i + 1}`} />
              <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2 text-xs font-semibold text-white">
                {p.legende}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
