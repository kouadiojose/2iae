// La rentrée 2026-2027 est effective depuis le lundi 28 septembre 2026, et
// elle a commencé sur tous les campus par l'initiation à l'intelligence
// artificielle. Tout ce qui est affirmé ici est dit dans la vidéo tournée le
// jour même, ou écrit sur l'affiche officielle du module qu'on y voit :
// « Formation certifiante », « Début lundi 28 septembre à 8 h 30 sur
// l'ensemble des campus de 2IAE », « via notre campus numérique », et la
// présentation de José Kouadio. La formation ne fait pas partie du programme
// du BTS : l'école l'offre à ses étudiants (« on ne va pas revenir en
// arrière » pour ceux qui restent à la maison).
//
// L'appel aux retardataires n'a de sens que pendant les premières semaines :
// la section disparaît d'elle-même à la date ci-dessous.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const FIN_APPEL_RENTREE = new Date("2026-11-01T00:00:00Z");

export function rentreeEffectiveActive(): boolean {
  return Date.now() < FIN_APPEL_RENTREE.getTime();
}

export function RentreeEffective() {
  if (!rentreeEffectiveActive()) return null;
  return (
    <section className="py-14 bg-white" data-testid="section-rentree-effective">
      <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-2 gap-10 items-center">
        <div className="rounded-xl overflow-hidden shadow-2xl ring-4 ring-[#E8720C]/60">
          <video
            className="w-full h-auto block bg-black aspect-video"
            src="/videos/rentree-2026-cours-ia.mp4"
            poster="/videos/rentree-2026-cours-ia-poster.jpg"
            controls
            playsInline
            preload="none"
            data-testid="video-rentree-effective"
          >
            Votre navigateur ne prend pas en charge la lecture vidéo.
          </video>
        </div>

        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">
            Rentrée 2026-2027 · Effective depuis le{"\u00a0"}28{"\u00a0"}septembre
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-5 leading-tight">
            Les cours ont repris.
            <span className="block text-primary">Par l'intelligence artificielle.</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Lundi 28 septembre à 8{" "}h{" "}30, la rentrée a eu lieu
            sur nos quatre campus : Azaguié, Yamoussoukro, Yopougon et la
            Palmeraie. Premier cours, partout à la fois : une initiation
            pratique à l'intelligence artificielle, formation certifiante
            donnée sur notre campus numérique par José Kouadio, ingénieur
            logiciel senior — vingt ans d'ingénierie logicielle entre
            New York, Toronto et la France.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Premier conseil aux étudiants : l'IA est un outil d'aide à la
            décision. On ne lui confie pas tout.
          </p>

          <div className="bg-[#fff4ea] border-l-4 border-[#E8720C] rounded-r-lg p-5 mb-6">
            <p className="font-serif text-xl text-foreground mb-2">
              Encore à la maison ?
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Cette formation ne figure pas au programme du BTS : l'école
              l'offre à ses étudiants. Elle a commencé lundi, et on ne
              reviendra pas en arrière. Chaque jour à la maison est un cours
              manqué — inscrivez-vous et venez prendre votre place.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/preinscription">
              <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto w-full sm:w-auto" data-testid="button-rentree-inscription">
                Je m'inscris maintenant
              </Button>
            </Link>
            <Link href="/tarifs">
              <Button variant="outline" className="font-semibold px-8 py-3 h-auto w-full sm:w-auto">
                Les tarifs — paiement échelonné
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
