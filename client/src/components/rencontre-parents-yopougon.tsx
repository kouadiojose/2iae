// Rencontre du fondateur avec les parents d'élèves et le personnel du campus
// de Yopougon, le samedi 26 septembre 2026. Tout ce qui est affirmé ici est
// dit par Séraphin Koua lui-même dans la vidéo tournée à l'issue de la
// réunion : 64 % cette année contre 54 % l'année précédente, l'objectif de
// 80 %, la filière bâtiment « à surveiller comme du lait sur le feu », et le
// premier module de la rentrée consacré à l'intelligence artificielle.
// Le 64,13 % est le chiffre officiel déjà publié sur /resultats-bts-2026.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function RencontreParentsYopougon() {
  return (
    <section className="py-14 bg-[#f7f3ee]" data-testid="section-rencontre-yopougon">
      <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,340px)_1fr] gap-10 items-start">
        <div className="mx-auto w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl ring-4 ring-[#0d2c54]/80">
          <video
            className="w-full h-auto block bg-black aspect-[9/16]"
            src="/videos/rencontre-parents-yopougon-2026.mp4"
            poster="/videos/rencontre-parents-yopougon-2026-poster.jpg"
            controls
            playsInline
            preload="none"
            data-testid="video-rencontre-yopougon"
          >
            Votre navigateur ne prend pas en charge la lecture vidéo.
          </video>
        </div>

        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">
            Rencontre parents · Campus de Yopougon · 26 septembre 2026
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-5 leading-tight">
            <span className="block">54 % l'an dernier.</span>
            <span className="block">64 % cette année.</span>
            <span className="block text-primary">80 % l'an prochain.</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Ce samedi, notre fondateur Séraphin Koua a réuni les parents
            d'élèves et le personnel du campus de Yopougon. Il est venu avec
            les résultats : <strong className="text-foreground">64,13 %
            d'admis au BTS 2026</strong>, contre 54 % l'année précédente. Dix
            points de mieux, et un engagement pris devant les familles :
            80 % l'an prochain.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Il a lui-même nommé la filière qui doit progresser : le bâtiment,
            « à surveiller comme du lait sur le feu ». Il y sera en personne,
            dans les salles de classe.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Rentrée le lundi 28 septembre. Premier module : l'intelligence
            artificielle, deux semaines avec trois consultants — canadien,
            allemand et français — sur notre campus numérique.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <img
              src="/images/rencontre-parents-yopougon-1.jpg"
              alt="Séraphin Koua, fondateur du Groupe 2IAE, en réunion avec les parents d'élèves et le personnel du campus de Yopougon"
              className="w-full aspect-[4/3] object-cover rounded-lg"
              loading="lazy"
              data-testid="img-rencontre-yopougon-1"
            />
            <img
              src="/images/rencontre-parents-yopougon-2.jpg"
              alt="Parents d'élèves et personnel du campus 2IAE de Yopougon écoutant le fondateur, le 26 septembre 2026"
              className="w-full aspect-[4/3] object-cover rounded-lg"
              loading="lazy"
              data-testid="img-rencontre-yopougon-2"
            />
          </div>

          <p className="text-sm text-foreground font-medium mb-6">
            Les résultats étaient affichés derrière lui. Une minute quarante.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/preinscription">
              <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto w-full sm:w-auto">
                Je me préinscris
              </Button>
            </Link>
            <Link href="/resultats-bts-2026">
              <Button variant="outline" className="font-semibold px-8 py-3 h-auto w-full sm:w-auto">
                Les résultats campus par campus
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
