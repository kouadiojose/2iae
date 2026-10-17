// Journée de travaux pratiques à l'Université de l'Entrepreneuriat
// d'Azaguié Ahoua, le samedi 17 octobre 2026.
//
// Le récit ne reprend que ce que disent les vidéos de la journée (le
// fondateur Séraphin Koua au centre d'incubation, les étudiants au verger)
// et ce que montrent les photos. Dans la vidéo, le fondateur date la
// journée du « samedi 18 octobre » : le samedi était le 17, date retenue.
// Les noms des intervenants professionnels, mal restitués par la
// transcription, ne sont pas publiés.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";

const N = " ";
const D = "/images/tp-azaguie-2026";
const V = "/videos/tp-azaguie-2026";

export const PHOTOS_TP_AZAGUIE = [
  { src: `${D}/p06.jpg`, legende: "Bâtiment : les premières années, casqués et équipés, avant le terrain" },
  { src: `${D}/p09.jpg`, legende: "Bâtiment : la mire en main, sur le site" },
  { src: `${D}/p04.jpg`, legende: "Production végétale : traitement des papayers" },
  { src: `${D}/p18.jpg`, legende: "Au verger, les explications d'un encadreur" },
  { src: `${D}/p13.jpg`, legende: "Production animale : la volaille de la ferme-école" },
  { src: `${D}/p12.jpg`, legende: "Visite des installations de la ferme-école" },
  { src: `${D}/p24.jpg`, legende: "Arrosoirs en main, entre les papayers" },
  { src: `${D}/p02.jpg`, legende: "Le geste, répété sur la parcelle" },
  { src: `${D}/p08.jpg`, legende: "Les étudiants du bâtiment sur le site" },
  { src: `${D}/p11.jpg`, legende: "Devant les bâtiments du campus" },
  { src: `${D}/p27.jpg`, legende: "L'arrivée en car à Azaguié" },
  { src: `${D}/p25.jpg`, legende: "En route vers les ateliers" },
  { src: `${D}/p21.jpg`, legende: "En salle : le programme de la journée" },
  { src: `${D}/p22.jpg`, legende: "En salle, avant le terrain" },
  { src: `${D}/p29.jpg`, legende: "Les étudiants réunis en salle" },
  { src: `${D}/p32.jpg`, legende: "Rassemblement sur le site" },
];

const FILIERES = [
  ["Production végétale", "au verger et sur les parcelles"],
  ["Production animale", "à la ferme-école"],
  ["Bâtiment", "sur le site, casque et mire en main"],
  ["Ressources humaines et communication", "au relais de la communication de la journée"],
  ["Logistique", "à l'organisation de la journée"],
  ["Comptabilité", "à la gestion des finances"],
];

function Video({ src, poster, titre, vertical = false }: { src: string; poster: string; titre: string; vertical?: boolean }) {
  return (
    <figure className={vertical ? "mx-auto w-full max-w-[300px]" : ""}>
      <div className="rounded-xl overflow-hidden shadow-xl ring-4 ring-[#E8720C]/50 bg-black">
        <video
          className={`w-full h-auto block bg-black ${vertical ? "aspect-[9/16]" : "aspect-video"}`}
          src={src}
          poster={poster}
          controls
          playsInline
          preload="none"
        >
          Votre navigateur ne prend pas en charge la lecture vidéo.
        </video>
      </div>
      <figcaption className="text-sm text-muted-foreground mt-2">{titre}</figcaption>
    </figure>
  );
}

export default function TravauxPratiquesAzaguiePage() {
  usePageMeta(
    "Journée de travaux pratiques à Azaguié : les premières années en immersion | Groupe 2IAE",
    "Samedi 17 octobre 2026, les étudiants de première année du Groupe 2IAE en immersion à l'Université de l'Entrepreneuriat d'Azaguié : production végétale, production animale, bâtiment. L'apprentissage par compétences, sur le terrain, avant même les cours de spécialité.",
    "/travaux-pratiques-azaguie",
  );

  return (
    <div className="mobile-safe">
      {/* Héros : la photo du bâtiment, en grand */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        <img src={`${D}/p06.jpg`} alt="Les étudiants de première année du bâtiment, casqués, sur le site de l'Université de l'Entrepreneuriat d'Azaguié" className="absolute inset-0 w-full !h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1f3a] via-[#0b1f3a]/70 to-[#0b1f3a]/10" />
        <div className="relative container mx-auto px-4 max-w-6xl pb-14 pt-32 text-white">
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-4">
            Travaux pratiques · Azaguié · Samedi 17{N}octobre 2026
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] max-w-4xl">
            Sur le terrain, avant même le premier cours de spécialité.
          </h1>
          <p className="mt-6 text-lg text-white/85 max-w-2xl leading-relaxed">
            Une journée d'immersion pour les premières années à l'Université de l'Entrepreneuriat d'Azaguié Ahoua : chaque
            filière à son poste, au verger, à la ferme, sur le chantier.
          </p>
        </div>
      </section>

      {/* Le récit, et la parole du fondateur */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-12 items-start">
          <article className="max-w-none">
            <p className="text-xl text-foreground leading-relaxed mb-6">
              Ce samedi, les étudiants de première année du Groupe 2IAE ont passé la journée au centre d'incubation de
              l'Université de l'Entrepreneuriat, à Azaguié Ahoua. Pas en salle : en situation, chacun dans son futur
              métier.
            </p>

            <h2 className="font-serif text-2xl md:text-3xl text-foreground mt-10 mb-4">Chaque filière à son poste</h2>
            <p className="text-muted-foreground leading-relaxed mb-5">
              Les étudiants de production végétale, de production animale et du bâtiment étaient en immersion sur le site.
              Les autres filières n'étaient pas spectatrices : la journée, elles l'ont fait tourner.
            </p>
            <ul className="grid sm:grid-cols-2 gap-3 mb-6">
              {FILIERES.map(([f, role]) => (
                <li key={f} className="rounded-lg border border-border bg-[#faf7f3] px-4 py-3">
                  <span className="block font-semibold text-foreground">{f}</span>
                  <span className="text-sm text-muted-foreground">{role}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Au verger, le fondateur du groupe, Séraphin Koua, tenait une papaye fraîchement récoltée :{" "}
              <span className="text-foreground">«{N}ça prouve que tout fonctionne bien.{N}»</span>
            </p>

            <h2 className="font-serif text-2xl md:text-3xl text-foreground mt-10 mb-4">Des maisons bâties par les étudiants</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les bâtiments du centre d'incubation n'ont pas été livrés par une entreprise. Ils ont été construits par les
              étudiants des promotions 2020, 2021, 2022 et 2023, de la fondation jusqu'au crépissage. C'est devant ces
              maisons que les nouveaux étudiants du bâtiment ont commencé leur année.
            </p>

            <h2 className="font-serif text-2xl md:text-3xl text-foreground mt-10 mb-4">L'apprentissage par compétences</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Le groupe a basculé dans l'APC, l'apprentissage par compétences. Les cours de spécialité commencent en novembre,
              mais les premières années viennent déjà s'imprégner des réalités de leur métier, avec des professionnels
              qui ont eux-mêmes été formés à l'APC. Cette formation, le groupe l'a menée avec son partenaire Catalyse Plus
              et un consultant venu du Canada.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Elle s'ajoute à ce que les étudiants ont déjà suivi depuis la rentrée sur le campus numérique :
              l'intelligence artificielle, le marketing digital, l'entrepreneuriat et l'innovation.
            </p>

            <blockquote className="my-10 border-l-4 border-[#E8720C] pl-6">
              <p className="font-serif text-2xl md:text-3xl text-foreground leading-snug">
                «{N}Pour la souveraineté alimentaire, nous, étudiants de 2IAE, sommes déterminés et engagés.{N}»
              </p>
              <footer className="text-sm text-muted-foreground mt-3">Les étudiants, au verger, une récolte de bananes à la main</footer>
            </blockquote>

            <h2 className="font-serif text-2xl md:text-3xl text-foreground mt-10 mb-4">Un appel à ceux qui sont encore à la maison</h2>
            <p className="text-muted-foreground leading-relaxed">
              Le fondateur en a profité pour s'adresser à ceux qui n'ont pas encore rejoint l'école : les cours ont
              commencé. Le gouvernement met l'accent sur l'employabilité des jeunes et sur la qualité de leur formation ;
              le Groupe 2IAE entend être l'école qui améliore les compétences et l'employabilité de ses étudiants.
            </p>
          </article>

          <aside className="flex flex-col gap-8 lg:sticky lg:top-24">
            <Video
              src={`${V}/pdg-journee-immersion.mp4`}
              poster={`${V}/pdg-journee-immersion-poster.jpg`}
              titre="Séraphin Koua, PDG du Groupe 2IAE, au centre d'incubation d'Azaguié · 2 min"
            />
            <div className="grid grid-cols-2 gap-4">
              <Video
                vertical
                src={`${V}/pdg-recolte-papaye.mp4`}
                poster={`${V}/pdg-recolte-papaye-poster.jpg`}
                titre="Au verger, la papaye du jour"
              />
              <div className="flex flex-col gap-4">
                <Video
                  src={`${V}/etudiants-souverainete-alimentaire.mp4`}
                  poster={`${V}/etudiants-souverainete-alimentaire-poster.jpg`}
                  titre="« Déterminés et engagés »"
                />
                <div className="rounded-xl bg-[#0d2c54] text-white p-4">
                  <p className="text-xs tracking-[0.2em] uppercase text-[#F0A868] mb-2">Azaguié</p>
                  <p className="font-serif text-3xl leading-none">83,54{N}%</p>
                  <p className="text-sm text-white/80 mt-1">d'admis au BTS 2026, le meilleur taux du groupe</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* La journée en images */}
      <section className="py-16 bg-[#f7f3ee]" data-testid="galerie-tp-azaguie">
        <div className="container mx-auto px-4 max-w-6xl">
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">La journée en images</p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-8">Du car au chantier.</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 grid-flow-dense">
            {PHOTOS_TP_AZAGUIE.slice(1).map((p, i) => (
              <figure
                key={p.src}
                className={`relative overflow-hidden rounded-xl ${[0, 6, 11].includes(i) ? "col-span-2 md:row-span-2 aspect-[4/3] md:aspect-auto" : "aspect-[4/3]"}`}
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
            <p className="font-serif text-3xl leading-tight mb-2">L'école des entrepreneurs se vit sur le terrain.</p>
            <p className="text-white/90">Les inscriptions sont ouvertes. Les cours ont commencé.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link href="/preinscription">
              <Button className="bg-white text-[#E8720C] hover:bg-white/90 font-bold px-8 py-3 h-auto w-full">Je me préinscris</Button>
            </Link>
            <Link href="/universite-entrepreneuriat">
              <Button variant="outline" className="border-white/70 bg-transparent text-white hover:bg-white/10 hover:text-white font-semibold px-8 py-3 h-auto w-full">
                Le campus d'Azaguié
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
