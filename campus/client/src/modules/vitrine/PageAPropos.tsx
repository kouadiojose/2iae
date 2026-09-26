// /a-propos : le Groupe Écoles 2IAE International (faits réels : 2006, son
// fondateur, l'entrepreneuriat pour tous, les cinq campus, les résultats du
// BTS 2026), ses filières, et le campus numérique avec sa raison d'être.
// Les textes et les chiffres se modifient dans « Site public ».
import { ArrowUpRight } from "lucide-react";
import { Squelette } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import { FILIERES_BTS, LICENCES_PRO } from "@shared/schema";
import { CarteCampus, EnTetePagePublique, LienFleche, Paragraphes } from "./composants";
import { useSitePublic, useSitePublicOuSecours } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { lienPreinscription, typo, useTitreDocument } from "./outils";

const PHOTOS = [
  { src: "/images/tp-cacao.jpg", legende: "Travaux pratiques : récolte de cacao", largeur: 720, hauteur: 480 },
  { src: "/images/tp-topographie.jpg", legende: "Travaux pratiques de topographie", largeur: 720, hauteur: 480 },
  { src: "/images/etudiants-2iae.jpg", legende: "Des étudiants du Groupe 2IAE", largeur: 480, hauteur: 320 },
];

export default function PageAPropos() {
  useTitreDocument("À propos · Groupe Écoles 2IAE International");
  const { site: charge, chargement } = useSitePublic();
  const site = useSitePublicOuSecours();
  const a = site.apropos;
  const pret = !(chargement && !charge);

  return (
    <MiseEnPagePublique>
      <EnTetePagePublique
        fil={[{ libelle: "À propos" }]}
        etiquette="Groupe Écoles 2IAE International"
        titre="L'école des entrepreneurs."
        texte={pret ? a.chapeau : <Squelette className="h-16 w-full max-w-xl" />}
      />

      {/* Slogan et chiffres */}
      <section className="conteneur pb-12 sm:pb-16">
        <div className="flex flex-col gap-8 rounded-[32px] bg-encre p-6 text-white sm:p-10">
          <blockquote className="max-w-4xl text-[28px] font-black leading-[1.05] tracking-serre sm:text-[clamp(30px,3.8vw,52px)]">
            « 2IAE, entreprendre pour devenir <span className="text-orange">l'élite de demain.</span> »
          </blockquote>
          {a.chiffres.length > 0 && (
            <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-[20px] bg-nuit-ligne", a.chiffres.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
              {a.chiffres.map((c) => (
                <div key={c.libelle} className="flex flex-col gap-1.5 bg-nuit-panneau p-5 sm:p-6">
                  <dt className="order-2 text-[14px] leading-snug text-nuit-doux">{typo(c.libelle)}</dt>
                  <dd className="order-1 text-[30px] font-black leading-none tracking-serre text-orange min-[400px]:text-[34px] sm:text-[46px]">{typo(c.valeur)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* Le groupe */}
      <section className="conteneur grid gap-10 pb-12 sm:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
        <div className="flex flex-col gap-4">
          <span className="etiquette">Depuis 2006</span>
          <h2 className="text-[30px] font-black leading-none tracking-serre sm:text-[44px]">Le Groupe 2IAE.</h2>
          {pret ? <Paragraphes texte={a.groupe} /> : <Squelette className="h-60 w-full" />}
        </div>
        <ul className="grid grid-cols-2 gap-3 self-start">
          {PHOTOS.map((p, i) => (
            <li key={p.src} className={cn(i === 0 && "col-span-2")}>
              <figure className="flex flex-col gap-2">
                <img
                  src={p.src}
                  alt={p.legende}
                  width={p.largeur}
                  height={p.hauteur}
                  loading="lazy"
                  decoding="async"
                  className={cn("w-full rounded-3xl object-cover", i === 0 ? "aspect-[16/9]" : "aspect-[4/3]")}
                />
                <figcaption className="text-[13px] text-texte-pale">{p.legende}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      {/* Les filières */}
      <section className="bg-creme py-14 sm:py-16">
        <div className="conteneur flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <span className="etiquette">Les formations</span>
            <h2 className="text-[30px] font-black leading-none tracking-serre sm:text-[44px]">BTS et licences professionnelles.</h2>
            <p className="max-w-2xl text-base leading-relaxed text-texte-pale">Quelle que soit la filière, chaque étudiant suit aussi des cours d'entrepreneuriat.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {(
              [
                { titre: "BTS tertiaires", liste: FILIERES_BTS.filter((f) => f.famille === "tertiaire").map((f) => ({ code: f.code, nom: f.nom })) },
                { titre: "BTS industriels", liste: FILIERES_BTS.filter((f) => f.famille === "industriel").map((f) => ({ code: f.code, nom: f.nom })) },
                { titre: "Licences professionnelles (3 ans)", liste: LICENCES_PRO.map((nom) => ({ code: null, nom })) },
              ] as const
            ).map((g) => (
              <div key={g.titre} className="flex flex-col gap-3 rounded-3xl bg-white p-5 sm:p-6">
                <h3 className="text-lg font-extrabold">{g.titre}</h3>
                <ul className="flex flex-col">
                  {g.liste.map((f) => (
                    <li key={f.nom} className="grid grid-cols-[64px_1fr] items-baseline gap-3 border-t border-ligne-douce py-2.5 first:border-t-0">
                      <span className="font-mono text-xs font-semibold text-orange-fonce">{f.code ?? "Licence"}</span>
                      <span className="text-[15px] font-semibold leading-snug">{f.nom}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Les campus */}
      <section className="conteneur py-14 sm:py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[30px] font-black leading-none tracking-serre sm:text-[44px]">Cinq campus en Côte d'Ivoire.</h2>
          <LienFleche href="/campus">Tous les campus</LienFleche>
        </div>
        <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {site.campus.map((c) => (
            <li key={c.slug}>
              <CarteCampus campus={c} />
            </li>
          ))}
        </ul>
      </section>

      {/* Le campus numérique */}
      <section className="conteneur pb-16">
        <div className="grid gap-8 rounded-[32px] border border-ligne p-6 sm:p-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
          <div className="flex flex-col gap-4">
            <span className="etiquette">Le campus numérique</span>
            <h2 className="text-[30px] font-black leading-[1.02] tracking-serre sm:text-[44px]">Un cours. Cinq campus. En direct.</h2>
            <div className="flex flex-col gap-2 pt-2">
              <LienFleche href="/le-direct">Comment suivre un cours</LienFleche>
              <LienFleche href="/programme">L'emploi du temps</LienFleche>
            </div>
          </div>
          {pret ? <Paragraphes texte={a.campusNumerique} /> : <Squelette className="h-48 w-full" />}
        </div>
      </section>

      {/* Pour aller plus loin */}
      <section className="conteneur pb-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={site.contacts.siteWeb}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-encre px-6 text-base font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre"
          >
            Le site du groupe : www.2iae.com <ArrowUpRight className="h-5 w-5" />
          </a>
          <a
            href={lienPreinscription(undefined, site.contacts.preinscription)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-orange px-6 text-base font-bold text-encre no-underline hover:bg-encre hover:text-white"
          >
            Préinscription en ligne <ArrowUpRight className="h-5 w-5" />
          </a>
          {site.contacts.facebook && (
            <a
              href={site.contacts.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-6 text-base font-bold text-texte-doux no-underline hover:bg-creme hover:text-encre"
            >
              Le groupe sur Facebook <ArrowUpRight className="h-5 w-5" />
            </a>
          )}
        </div>
      </section>
    </MiseEnPagePublique>
  );
}
