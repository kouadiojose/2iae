// Prix spéciaux panafricains ICS 2025-2026 : le Groupe 2IAE « Meilleure école
// de formation », son fondateur Séraphin Koua « Meilleur dirigeant des
// grandes écoles ». Lauréats dévoilés le vendredi 23 octobre 2026 par
// l'Interafricaine de communication et de sondages (ICS), prix remis le
// samedi 31 octobre 2026 à l'Ivotel, au Plateau.
//
// Sources : L'inter n° 8489 du mardi 27 octobre 2026 (page Économie), la
// vidéo de la remise (motifs lus au micro) et l'interview du fondateur à la
// presse le soir même. Les citations reprennent ces sources mot pour mot.
import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { VideoReportage } from "@/components/video-reportage";

const N = " ";
const D = "/images/prix-ics-2026";
const V = "/videos/prix-ics-2026";

export const PRIX_ICS = [
  {
    laureat: "Groupe Écoles 2IAE",
    titre: "Meilleure école de formation",
    motif: "Pour la qualité de la formation et les résultats obtenus.",
  },
  {
    laureat: "Séraphin Koua, fondateur",
    titre: "Meilleur dirigeant des grandes écoles",
    motif:
      "Pour sa gouvernance, la performance académique de l'établissement et son apport considérable au rayonnement de l'enseignement dans les grandes écoles privées de Côte d'Ivoire.",
  },
];

const PHOTOS = [
  { src: `${D}/p02.jpg`, legende: "Avec les étudiants du groupe" },
  { src: `${D}/p03.jpg`, legende: "Le fondateur entouré des invités" },
  { src: `${D}/p04.jpg`, legende: "Le trophée, à l'Ivotel" },
  { src: `${D}/p05.jpg`, legende: "Les lauréats devant les couleurs de l'ICS" },
  { src: `${D}/p06.jpg`, legende: "Les lauréats et leurs trophées" },
  { src: `${D}/p07.jpg`, legende: "Face à la presse" },
  { src: `${D}/p09.jpg`, legende: "La salle de la cérémonie" },
  { src: `${D}/p11.jpg`, legende: "Au premier rang" },
  { src: `${D}/p10.jpg`, legende: "Une salle comble" },
  { src: `${D}/p12.jpg`, legende: "Le public de la cérémonie" },
];

export default function PrixIcs2026Page() {
  usePageMeta(
    "Prix ICS 2025-2026 : 2IAE Meilleure école de formation, Séraphin Koua Meilleur dirigeant | Groupe 2IAE",
    "Le Groupe 2IAE reçoit le Prix spécial panafricain ICS 2025-2026 de la Meilleure école de formation, et son fondateur Séraphin Koua celui du Meilleur dirigeant des grandes écoles. Remise des prix le 31 octobre 2026 à l'Ivotel, Abidjan-Plateau.",
    "/prix-ics-2026",
  );

  // Arrivée par /prix-ics-2026#life-tv (lien de l'accueil) : aller au reportage.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mobile-safe">
      {/* Héros : les trophées */}
      <section className="relative min-h-[72vh] flex items-end overflow-hidden">
        <img
          src={`${D}/hero.jpg`}
          alt="Séraphin Koua, fondateur du Groupe 2IAE (à droite), et un autre lauréat, trophées ICS en main, devant les couleurs de l'ICS et du Groupe 2IAE"
          className="absolute inset-0 w-full !h-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1f3a] via-[#0b1f3a]/75 to-[#0b1f3a]/10" />
        <div className="relative container mx-auto px-4 max-w-6xl pb-14 pt-32 text-white">
          <p className="text-xs tracking-[0.25em] uppercase text-[#E9C46A] mb-4">
            Prix spéciaux panafricains ICS 2025‑2026 · Abidjan, 31{N}octobre 2026
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] max-w-4xl">
            Meilleure école de formation.
            <span className="block text-[#E9C46A]">Meilleur dirigeant des grandes écoles.</span>
          </h1>
          <p className="mt-6 text-lg text-white/85 max-w-2xl leading-relaxed">
            Deux prix pour le Groupe 2IAE et son fondateur, Séraphin Koua, décernés par l'Interafricaine de communication et
            de sondages (ICS).
          </p>
        </div>
      </section>

      {/* Les deux prix */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-6" data-testid="cartes-prix-ics">
            {PRIX_ICS.map((p) => (
              <div key={p.titre} className="rounded-xl border border-[#E9C46A]/60 bg-[#fdf8ec] p-7 md:p-8">
                <p className="text-xs tracking-[0.2em] uppercase text-[#9a7420] font-semibold mb-3">
                  Prix spécial panafricain ICS 2025‑2026
                </p>
                <p className="font-serif text-3xl text-foreground leading-tight mb-2">{p.titre}</p>
                <p className="font-semibold text-foreground mb-4">{p.laureat}</p>
                <p className="text-muted-foreground leading-relaxed">{p.motif}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-12 items-start">
            <article>
              <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-4">Des lauréats choisis sur l'exemple</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Le vendredi 23 octobre 2026, l'Interafricaine de communication et de sondages a dévoilé les meilleurs
                entrepreneurs privés de Côte d'Ivoire dans trois domaines : la formation, le bâtiment et les travaux publics,
                l'industrie. Dans la formation, le jury a retenu le Groupe 2IAE, pour la diversité de son enseignement, des
                filières tertiaires aux filières industrielles, et parce qu'il forme ses étudiants à l'auto-emploi comme à
                l'emploi salarié.
              </p>
              <blockquote className="my-8 border-l-4 border-[#E8720C] pl-6">
                <p className="font-serif text-xl md:text-2xl text-foreground leading-snug">
                  «{N}Il ne s'agit pas forcément des plus grosses entreprises du pays, ni des plus puissantes financièrement.{N}»
                </p>
                <footer className="text-sm text-muted-foreground mt-3">
                  Yves Ibrahima Kéïta, directeur général de l'ICS. Le jury a jugé l'exemplarité des dirigeants en matière
                  de management et la qualité du travail accompli.
                </footer>
              </blockquote>
              <p className="text-muted-foreground leading-relaxed">
                Les prix ont été remis le samedi 31 octobre 2026 à l'Ivotel, au Plateau, devant une salle comble, aux côtés des
                deux autres lauréats de l'année : Davidal Entreprise pour le bâtiment et Sipema-CI pour l'industrie.
              </p>
            </article>
            <aside className="lg:sticky lg:top-24">
              <VideoReportage
                src={`${V}/remise-des-prix.mp4`}
                poster={`${V}/remise-des-prix-poster.jpg`}
                titre="La remise des deux prix, à l'Ivotel · 2 min 27"
              />
            </aside>
          </div>
        </div>
      </section>

      {/* À la télévision : Life TV */}
      <section id="life-tv" className="py-16 bg-[#f7f3ee] scroll-mt-20" data-testid="section-life-tv">
        <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-10 items-center">
          <VideoReportage
            src={`${V}/reportage-life-tv.mp4`}
            poster={`${V}/reportage-life-tv-poster.jpg`}
            titre="Life TV, journal de 12 h 45 : « Prix ICS 2025-2026, trois entreprises et leurs dirigeants distingués » · 1 min 24"
          />
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">À la télévision · Life TV</p>
            <h2 className="font-serif text-3xl text-foreground leading-tight mb-4">«{N}Doublement honoré.{N}»</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Le journal de 12{N}h{N}45 de Life TV a consacré son reportage aux trois lauréats. Parmi eux, Séraphin Koua,
              «{N}doublement honoré comme meilleur dirigeant de grande école, et son établissement désigné meilleure école de
              formation.{N}»
            </p>
            <p className="border-l-4 border-[#E8720C] pl-4 text-foreground leading-relaxed">
              «{N}Une double distinction qui intervient alors que l'adéquation entre les formations et les besoins du marché
              de l'emploi reste un défi majeur.{N}»
            </p>
          </div>
        </div>
      </section>

      {/* La parole du fondateur */}
      <section className="py-16 bg-[#0b1f3a] text-white" data-testid="section-fondateur-ics">
        <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 items-start">
          <div className="lg:sticky lg:top-24 [&_figcaption]:text-white/70">
            <VideoReportage
              src={`${V}/fondateur-presse.mp4`}
              poster={`${V}/fondateur-presse-poster.jpg`}
              titre="Séraphin Koua répond à la presse, le soir de la remise · 4 min"
            />
          </div>
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-[#E9C46A] mb-3">Le fondateur, le soir de la remise</p>
            <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-6">
              «{N}Vingt ans, ce n'est pas vingt jours. C'est toute une vie.{N}»
            </h2>
            <p className="text-white/80 leading-relaxed mb-5">
              Pour Séraphin Koua, ce prix est un couronnement : «{N}l'effort de mon équipe, l'effort des enseignants, l'effort
              des parents d'élèves, l'effort des étudiants. C'est toute la Côte d'Ivoire qui gagne.{N}»
            </p>
            <p className="text-white/80 leading-relaxed mb-5">
              Il y voit la confirmation d'une vision : «{N}l'entrepreneuriat est la porte d'entrée dans une économie
              émergente. Ce sont les entrepreneurs qui vont créer les entreprises, et ce sont les entreprises qui vont créer la
              valeur ajoutée.{N}» D'où l'importance du capital humain, et des incubateurs : «{N}on ne peut pas créer une école
              sans avoir des incubateurs.{N}»
            </p>
            <p className="text-white/80 leading-relaxed mb-5">
              La suite, vingt ans après la création de l'école : la transformation des matières premières. «{N}Nous ne devons
              pas avoir une économie de cueillette.{N}»
            </p>
            <div className="rounded-xl bg-white/5 border border-white/10 p-5">
              <p className="text-white/90 leading-relaxed">
                «{N}Quand vous avez une école, on vous pose deux questions : quels sont vos résultats, et que sont devenus vos
                anciens étudiants{N}?{N}»
              </p>
              <p className="text-sm text-white/70 mt-3">
                La réponse du groupe : 67,38{N}% d'admis au BTS 2026, et 66{N}% d'anciens étudiants insérés, mesurés par
                60{N}Decibels.{" "}
                <Link href="/resultats-bts-2026">
                  <span className="text-[#E9C46A] underline underline-offset-4 cursor-pointer">Les résultats</span>
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dans la presse */}
      <section className="py-16 bg-[#f7f3ee]">
        <div className="container mx-auto px-4 max-w-6xl grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 items-center">
          <figure className="rounded-xl overflow-hidden shadow-xl bg-white" data-testid="coupure-linter">
            <img
              src={`${D}/linter-27-octobre-2026.jpg`}
              alt="L'inter n° 8489 du 27 octobre 2026 : « Prix ICS Meilleur entrepreneur. Trois lauréats se partagent la récompense cette année »"
              loading="lazy"
              className="w-full h-auto block"
            />
          </figure>
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">Dans la presse</p>
            <h2 className="font-serif text-3xl text-foreground leading-tight mb-4">
              L'inter, mardi 27 octobre 2026
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Le quotidien a annoncé les lauréats dans sa page Économie (n°{N}8489) : «{N}Trois lauréats se partagent la
              récompense cette année.{N}»
            </p>
            <p className="border-l-4 border-[#E8720C] pl-4 text-foreground leading-relaxed">
              «{N}Dans le domaine de la formation, c'est le Groupe 2iae qui a été choisi pour le Prix spécial panafricain Ics
              2025-2026 de la Meilleure école de formation, pour la diversité de l'enseignement qui va des filières tertiaires
              aux filières industrielles.{N}»
            </p>
          </div>
        </div>
      </section>

      {/* La soirée en images */}
      <section className="py-16 bg-white" data-testid="galerie-prix-ics">
        <div className="container mx-auto px-4 max-w-6xl">
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">La soirée en images</p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-8">Samedi 31 octobre, à l'Ivotel.</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 grid-flow-dense">
            {PHOTOS.map((p, i) => (
              <figure
                key={p.src}
                className={`relative overflow-hidden rounded-xl ${[0, 6].includes(i) ? "col-span-2 md:row-span-2 aspect-[16/9] md:aspect-auto" : "aspect-[16/9]"}`}
              >
                <img src={p.src} alt={p.legende} loading="lazy" className="absolute inset-0 w-full !h-full object-cover" />
                <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-8 pb-2 text-xs font-semibold text-white">
                  {p.legende}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Appel */}
      <section className="py-14 bg-[#E8720C]">
        <div className="container mx-auto px-4 max-w-6xl flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 text-white">
            <p className="font-serif text-3xl leading-tight mb-2">Rejoignez la meilleure école de formation.</p>
            <p className="text-white/90">Les inscriptions sont ouvertes. Cinq campus, une même exigence.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link href="/preinscription">
              <Button className="bg-white text-[#E8720C] hover:bg-white/90 font-bold px-8 py-3 h-auto w-full">Je me préinscris</Button>
            </Link>
            <Link href="/historique">
              <Button variant="outline" className="border-white/70 bg-transparent text-white hover:bg-white/10 hover:text-white font-semibold px-8 py-3 h-auto w-full">
                Vingt ans d'histoire
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
