// SELAB 2026 (Sommet de l'élevage d'Abidjan) : le Groupe 2IAE remporte la
// compétition inter-écoles.
//
// Sources : l'article de Green Media Africa (rubrique Ressources animales),
// transmis en captures par la direction (dimanche 22 novembre 2026,
// compétition du MIRAH, phase théorique puis épreuve pratique, classement,
// propos d'Aka Alain), les photos et la vidéo de la remise des prix (écran
// de scène : jury École présidé par le Prof. Serge Bakou).
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { VideoReportage } from "@/components/video-reportage";

const N = " ";
const D = "/images/selab-2026";
const V = "/videos/selab-2026";

export const ARTICLE_SELAB =
  "https://www.greenmediaafrica.ci/ressourcesanimales/article-selab-2026-lecole-des-entrepreneurs-2iae-remporte-la-competition-inter-ecoles-112622/2757";

const EPREUVES = [
  "La palpation et le sexage des lapins",
  "L'identification des signes cliniques",
  "La désinfection",
  "L'appréciation des ressources fourragères",
  "Le bien-être des animaux",
];

const PHOTOS = [
  { src: `${D}/p02.jpg`, legende: "Sur la scène de la remise des prix et des distinctions" },
  { src: `${D}/p03.jpg`, legende: "Médailles au cou, attestations en main" },
  { src: `${D}/p04.jpg`, legende: "Au Sommet de l'élevage d'Abidjan" },
  { src: `${D}/p05.jpg`, legende: "Les lauréats de la compétition inter-écoles" },
  { src: `${D}/p06.jpg`, legende: "Les félicitations du jury" },
];

export default function Selab2026Page() {
  usePageMeta(
    "SELAB 2026 : le Groupe 2IAE remporte la compétition inter-écoles | Groupe 2IAE",
    "Dimanche 22 novembre 2026, au SELAB 2026, les étudiants du Groupe 2IAE remportent la compétition inter-écoles du ministère des Ressources animales et halieutiques : premiers au classement général, premiers à l'épreuve pratique avec 74 %.",
    "/selab-2026",
  );

  return (
    <div className="mobile-safe">
      {/* Héros : les lauréats sur scène */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        <img
          src={`${D}/p01.jpg`}
          alt="Les étudiants du Groupe 2IAE, médailles au cou et attestations en main, sur la scène de la remise des prix du SELAB 2026"
          className="absolute inset-0 w-full !h-full object-cover object-[center_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b2a20] via-[#0b2a20]/75 to-[#0b2a20]/10" />
        <div className="relative container mx-auto px-4 max-w-6xl pb-14 pt-32 text-white">
          <p className="text-xs tracking-[0.25em] uppercase text-[#E9C46A] mb-4">
            SELAB 2026 · Sommet de l'élevage d'Abidjan
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] max-w-4xl">
            Compétition inter-écoles{N}:<span className="block text-[#E9C46A]">l'École des entrepreneurs l'emporte.</span>
          </h1>
          <p className="mt-6 text-lg text-white/85 max-w-2xl leading-relaxed">
            Dimanche 22 novembre 2026, les étudiants du Groupe 2IAE ont remporté la compétition inter-écoles organisée par le
            ministère des Ressources animales et halieutiques (MIRAH).
          </p>
        </div>
      </section>

      {/* Les chiffres */}
      <section className="bg-[#0b2a20] text-white border-t border-white/10" data-testid="chiffres-selab">
        <div className="container mx-auto px-4 max-w-6xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/15">
          {[
            ["1", "au classement général"],
            [`74${N}%`, "à l'épreuve pratique, la meilleure note"],
            ["3", "établissements en lice, sur 8 inscrits"],
          ].map(([v, l]) => (
            <div key={l} className="py-5 sm:py-7 sm:px-8 first:sm:pl-0">
              <p className="font-sans font-bold text-4xl text-[#E9C46A] leading-none">
                {v}
                {v === "1" && <sup className="text-lg">er</sup>}
              </p>
              <p className="text-sm text-white/75 mt-2">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Le récit et la vidéo */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-12 items-start">
          <article>
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">Une théorie, une pratique</p>
            <h2 className="font-serif text-3xl text-foreground leading-tight mb-5">
              Troisièmes à la théorie. Premiers sur le terrain.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              La compétition s'est jouée en deux temps. D'abord une phase théorique de vingt questions : l'école Foani a
              terminé en tête, devant l'école d'Adiaké ; l'École 2IAE s'est classée troisième.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Puis l'épreuve pratique, que les étudiants de 2IAE ont dominée avec un score de 74{N}%. Au programme :
            </p>
            <ul className="grid sm:grid-cols-2 gap-2 mb-5">
              {EPREUVES.map((e) => (
                <li key={e} className="rounded-lg border border-border bg-[#f3f8f4] px-4 py-2.5 text-foreground text-sm">
                  {e}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Au classement général, l'École 2IAE a été désignée première, devant les deux autres établissements
              participants. Sur la scène de la remise des prix, nos étudiants ont reçu médailles et attestations devant le
              jury École, présidé par le professeur Serge Bakou.
            </p>

            <blockquote className="border-l-4 border-[#E8720C] pl-6 mb-8">
              <p className="font-serif text-3xl text-foreground leading-snug">«{N}Nous avons été premiers.{N}»</p>
              <footer className="text-sm text-muted-foreground mt-3 leading-relaxed">
                Aka Alain, responsable de la production animale du Groupe 2IAE. Il a salué la performance et l'engagement des
                étudiants, et remercié le fondateur, Séraphin Koua, pour sa rigueur dans la formation.
              </footer>
            </blockquote>

            <p className="text-muted-foreground leading-relaxed mb-4">
              Le pratico-pratique, toujours : l'élevage s'apprend en pratique, à la ferme-école d'Azaguié comme dans les
              serres de Sinfra.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              <Link href="/travaux-pratiques-azaguie">
                <span className="text-primary underline underline-offset-4 cursor-pointer">Les travaux pratiques à Azaguié</span>
              </Link>
              <Link href="/travaux-pratiques-sinfra">
                <span className="text-primary underline underline-offset-4 cursor-pointer">Les travaux pratiques à Sinfra</span>
              </Link>
            </div>
          </article>
          <aside className="lg:sticky lg:top-24">
            <VideoReportage
              src={`${V}/remise-des-prix.mp4`}
              poster={`${V}/remise-des-prix-poster.jpg`}
              titre="La remise des prix et des distinctions, au SELAB 2026 · 38 s"
            />
          </aside>
        </div>
      </section>

      {/* Dans la presse */}
      <section className="py-14 bg-[#f7f3ee]">
        <div className="container mx-auto px-4 max-w-4xl">
          <a
            href={ARTICLE_SELAB}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-xl border border-border bg-white p-6 md:p-8 hover:shadow-lg transition-shadow"
            data-testid="lien-article-selab"
          >
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">Dans la presse · Green Media Africa</p>
            <p className="font-serif text-2xl md:text-3xl text-foreground leading-snug mb-3">
              «{N}SELAB 2026 : L'école des entrepreneurs 2IAE remporte la compétition inter-écoles{N}»
            </p>
            <span className="text-sm font-semibold text-primary underline underline-offset-4 group-hover:no-underline">
              Lire l'article (rubrique Ressources animales) ↗
            </span>
          </a>
        </div>
      </section>

      {/* En images */}
      <section className="py-16 bg-white" data-testid="galerie-selab">
        <div className="container mx-auto px-4 max-w-6xl">
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">En images</p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-8">Sur la scène du SELAB 2026.</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 grid-flow-dense">
            {PHOTOS.map((p, i) => (
              <figure
                key={p.src}
                className={`relative overflow-hidden rounded-xl ${i === 0 ? "col-span-2 md:row-span-2 aspect-[16/9] md:aspect-auto" : "aspect-[16/9]"}`}
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
            <p className="font-serif text-3xl leading-tight mb-2">L'école qui gagne sur le terrain.</p>
            <p className="text-white/90">Les inscriptions sont ouvertes. Cinq campus, une même exigence.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link href="/preinscription">
              <Button className="bg-white text-[#E8720C] hover:bg-white/90 font-bold px-8 py-3 h-auto w-full">Je me préinscris</Button>
            </Link>
            <Link href="/filieres">
              <Button variant="outline" className="border-white/70 bg-transparent text-white hover:bg-white/10 hover:text-white font-semibold px-8 py-3 h-auto w-full">
                Nos filières
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
