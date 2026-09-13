// Le reportage du journal de 13 h de la RTI sur la Journée d'Excellence
// BTS 2026. Tout ce qui est affirmé ici est visible à l'écran dans la
// vidéo : le titre du sujet, le trophée « Excell'Ados — meilleurs résultats
// BTS 2026 », et l'incrustation qui présente le fondateur comme lauréat.
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
            Journal de 13 h · RTI 1
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4 leading-tight">
            4 distinctions au BTS 2026. La télévision nationale était là.
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            À la Journée d'Excellence BTS 2026, le Groupe 2IAE reçoit
            4 distinctions et le trophée Excell'Ados des meilleurs résultats.
            Le journal de 13 h de la RTI y consacre son reportage —
            « Enseignement supérieur : des établissements distingués pour
            leurs résultats au BTS 2026 » — et tend son micro à notre
            fondateur, Séraphin Koua.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Ce n'est pas une publicité : c'est le journal télévisé. Deux
            minutes.
          </p>

          {avecCta && (
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/preinscription">
                <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto w-full sm:w-auto">
                  Je me préinscris
                </Button>
              </Link>
              <Link href="/resultats-bts-2026">
                <Button
                  variant="outline"
                  className="font-semibold px-8 py-3 h-auto w-full sm:w-auto"
                >
                  Tous les résultats BTS 2026
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
