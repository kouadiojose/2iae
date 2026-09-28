// /campus : les cinq campus du Groupe 2IAE avec leurs vraies informations
// (adresse publiée sur 2iae.com, photo réelle, salle de conférence, résultat
// au BTS 2026, filières, contact), l'itinéraire Google Maps et le bureau au
// Canada. Tout se modifie dans « Site public » du back-office.
import { Link } from "wouter";
import { ArrowRight, MapPin, Navigation, Presentation } from "lucide-react";
import { Squelette } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import type { CampusPublic } from "@shared/schema";
import { BoutonWhatsappCampus, EnTetePagePublique, PhotoCampus } from "./composants";
import { useSitePublic, useSitePublicOuSecours } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { formatTaux, typo, useTitreDocument } from "./outils";

function LigneCampus({ campus: c, rang }: { campus: CampusPublic; rang: number }) {
  return (
    <article className="grid gap-5 rounded-[28px] border border-ligne bg-white p-4 sm:p-5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-7">
      <Link href={`/campus/${c.slug}`} className="block overflow-hidden rounded-[20px]" tabIndex={-1} aria-hidden>
        <PhotoCampus campus={c} className="aspect-[16/10] h-full w-full transition-transform duration-300 hover:scale-[1.02] md:aspect-auto md:min-h-[220px]" eager={rang < 2} />
      </Link>
      <div className="flex min-w-0 flex-col gap-4 py-1">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-texte-gris">
            {String(rang + 1).padStart(2, "0")}
            {c.slug === "riviera" ? " · Siège du groupe" : ""}
          </span>
          <h2 className="text-[28px] font-black leading-[1.02] tracking-serre sm:text-[34px]">
            <Link href={`/campus/${c.slug}`} className="text-encre no-underline hover:text-orange-fonce">
              {c.nom}
            </Link>
          </h2>
          {c.localite && <p className="text-[15px] text-texte-pale">{c.localite}</p>}
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
            <div>
              <dt className="sr-only">Adresse</dt>
              <dd className="text-[15px] leading-snug text-texte-doux">{c.adresse || "Adresse bientôt précisée"}</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <Presentation className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
            <div>
              <dt className="sr-only">Salle de conférence</dt>
              <dd className="text-[15px] leading-snug text-texte-doux">{c.salleNommee ? `${c.salle}, reliée au campus numérique` : "Salle de conférence reliée au campus numérique"}</dd>
            </div>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          {c.resultat && (
            <span className="rounded-full bg-encre px-3 py-1.5 font-mono text-xs text-white">
              {formatTaux(c.resultat.taux)} d'admis au {c.resultat.libelle}
            </span>
          )}
          {c.filieres.map((f) => (
            <span key={f.code} title={f.nom} className="rounded-full bg-orange-clair px-2.5 py-1 font-mono text-xs text-orange-profond">
              {f.code}
            </span>
          ))}
          {!c.resultat && !c.filieres.length && <span className="text-[14px] text-texte-gris">Filières bientôt présentées ici : renseignez-vous auprès du campus.</span>}
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
          <Link
            href={`/campus/${c.slug}`}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-orange px-5 text-[15px] font-bold text-encre no-underline hover:bg-encre hover:text-white"
          >
            Découvrir le campus <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href={c.itineraire}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-[1.5px] border-encre px-5 text-[15px] font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre"
          >
            <Navigation className="h-4 w-4" /> Itinéraire
          </a>
          <BoutonWhatsappCampus campus={c} />
        </div>
      </div>
    </article>
  );
}

export default function PageCampus() {
  useTitreDocument("Les cinq campus du Groupe 2IAE");
  const { site: charge, chargement } = useSitePublic();
  const site = useSitePublicOuSecours();

  return (
    <MiseEnPagePublique>
      <EnTetePagePublique
        fil={[{ libelle: "Campus" }]}
        etiquette="Les campus du Groupe 2IAE"
        titre="Cinq campus, une même classe."
        texte="Chaque campus a sa salle de conférence, reliée au campus numérique. Ses étudiants y suivent le même cours, au même moment, avec le même formateur."
      />

      {site.apropos.chiffres.length > 0 && (
        <section className="conteneur pb-10">
          <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-[24px] bg-ligne", site.apropos.chiffres.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
            {site.apropos.chiffres.map((c) => (
              <div key={c.libelle} className="flex flex-col gap-1 bg-creme p-5 sm:p-6">
                <dt className="order-2 text-[14px] leading-snug text-texte-pale">{typo(c.libelle)}</dt>
                <dd className="order-1 text-[30px] font-black leading-none tracking-serre min-[400px]:text-[34px] sm:text-[44px]">{typo(c.valeur)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="conteneur flex flex-col gap-4 pb-12">
        {chargement && !charge
          ? [0, 1, 2].map((i) => <Squelette key={i} className="h-[280px] rounded-[28px]" />)
          : site.campus.map((c, i) => <LigneCampus key={c.slug} campus={c} rang={i} />)}
      </section>

      <section className="conteneur pb-16">
        <div className="flex flex-col gap-2 rounded-[28px] bg-creme p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex flex-col gap-1">
            <span className="etiquette">Et au Canada</span>
            <h2 className="text-2xl font-extrabold tracking-[-0.02em]">Le bureau du groupe au Canada</h2>
          </div>
          <p className="text-[16px] leading-relaxed text-texte-doux sm:text-right">{site.contacts.bureauCanada}</p>
        </div>
      </section>
    </MiseEnPagePublique>
  );
}
