// Le reportage du journal de 13 h de la RTI sur la Journée d'Excellence
// BTS 2026, où le groupe a reçu 4 distinctions. Tout ce qui est affirmé ici
// est visible à l'écran dans la vidéo : le titre du sujet, le trophée
// « Excell'Ados — meilleurs résultats BTS 2026 », et l'incrustation qui
// présente le fondateur comme lauréat.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function ReportageRtiBts({
  fond = "bg-white",
  avecCta = false,
}: {
  fond?: string;
  avecCta?: boolean;
}) {
  return (
    <section className={`py-14 ${fond}`} data-testid="section-reportage-rti">
      <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-2 gap-10 items-center">
        <div className="rounded-xl overflow-hidden shadow-2xl ring-4 ring-[#E8720C]/60">
          <video
            className="w-full h-auto block bg-black"
            src="/videos/reportage-rti-bts-2026.mp4"
            poster="/videos/reportage-rti-bts-2026-poster.jpg"
            controls
            playsInline
            preload="none"
            data-testid="video-reportage-rti"
          >
            Votre navigateur ne prend pas en charge la lecture vidéo.
          </video>
        </div>

        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">
            📺 RTI 1 · Journal de 13 h
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4 leading-tight">
            La télévision nationale est venue filmer nos distinctions.
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            « Enseignement supérieur : des établissements distingués pour leurs
            résultats au BTS 2026 » — sous ce titre, le journal de 13 h de la
            RTI a consacré son reportage à la Journée d'Excellence BTS 2026,
            où le Groupe 2IAE a reçu 4 distinctions et le trophée Excell'Ados
            des meilleurs résultats.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Au micro de la RTI, notre fondateur <strong>Séraphin Koua</strong>,
            présenté à l'écran comme « lauréat-fondateur d'école », aux côtés
            du président de l'Organisation des parents d'élèves et étudiants de
            Côte d'Ivoire. Deux minutes qui disent, sans nous, ce que valent nos
            résultats.
          </p>

          {avecCta && (
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/preinscription">
                <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto w-full sm:w-auto">
                  Je rejoins cette école
                </Button>
              </Link>
              <Link href="/resultats-bts-2026">
                <Button
                  variant="outline"
                  className="font-semibold px-8 py-3 h-auto w-full sm:w-auto"
                >
                  Voir tous les résultats
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
