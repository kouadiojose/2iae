// /campus/:slug : un campus. Ce qu'on y étudie (filières présentées au BTS
// 2026), sa salle de conférence et les cours du campus numérique qui y sont
// suivis (emploi du temps de ses classes, cours présentés, prochains lives),
// la vie scolaire à contacter, l'adresse et l'itinéraire. Un fait qui manque
// (pas de résultat publié, pas de filière renseignée) est dit simplement.
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { GraduationCap, MapPin, MessageCircle, Navigation, Phone, Presentation, SearchX, Trophy } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Squelette } from "@/components/ui/divers";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CampusDetailPublic, CampusPublic } from "@shared/schema";
import { BoutonWhatsappCampus, CarteCoursPublic, EnTetePagePublique, EtatVidePublic, Paragraphes, PhotoCampus } from "./composants";
import { useProgrammePublic, useSitePublicOuSecours } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { SemaineAuCampus } from "./SemaineAuCampus";
import { formatTaux, lienTelephone, useTitreDocument } from "./outils";

/** Photos réelles livrées avec le campus, par campus (la photo principale se change dans le back-office). */
const GALERIES: Record<string, { src: string; legende: string; largeur: number; hauteur: number }[]> = {
  azaguie: [
    { src: "/images/azaguie-palmiers.jpg", legende: "L'Université de l'Entrepreneuriat, à Azaguié Ahoua", largeur: 800, hauteur: 603 },
    { src: "/images/azaguie-internat.jpg", legende: "L'internat : salle de cours, dortoir, bâtiment", largeur: 454, hauteur: 680 },
    { src: "/images/azaguie-serre.jpg", legende: "Récolte sous serre", largeur: 800, hauteur: 600 },
  ],
};

function Fait({ icone, titre, children, className }: { icone: ReactNode; titre: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-3xl border border-ligne bg-white p-5 sm:p-6", className)}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-clair text-orange-fonce">{icone}</span>
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">{titre}</h2>
      </div>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

function Filieres({ campus: c }: { campus: CampusPublic }) {
  const familles = [
    { cle: "tertiaire", titre: "Filières tertiaires" },
    { cle: "industriel", titre: "Filières industrielles" },
  ] as const;
  if (!c.filieres.length) {
    return (
      <EtatVidePublic
        icone={<GraduationCap className="h-6 w-6" />}
        titre="Les filières de ce campus seront bientôt présentées ici."
        texte="Pour connaître les formations proposées à la rentrée, contactez le campus ou le standard du groupe."
        action={<BoutonWhatsappCampus campus={c} texte={`Bonjour, quelles filières sont proposées au campus 2IAE de ${c.nomCourt} ?`} />}
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {familles
        .map((f) => ({ ...f, liste: c.filieres.filter((x) => x.famille === f.cle) }))
        .filter((f) => f.liste.length)
        .map((f) => (
          <div key={f.cle} className="flex flex-col gap-3 rounded-3xl bg-creme p-5 sm:p-6">
            <h3 className="text-lg font-extrabold">{f.titre}</h3>
            <ul className="flex flex-col">
              {f.liste.map((x) => (
                <li key={x.code} className="grid grid-cols-[72px_1fr] items-baseline gap-3 border-t border-ligne py-3 first:border-t-0">
                  <span className="font-mono text-sm font-semibold text-orange-fonce">{x.code}</span>
                  <span className="text-[15px] font-semibold leading-snug">BTS {x.nom}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

export default function PageUnCampus({ slug }: { slug: string }) {
  const site = useSitePublicOuSecours();
  const detailQ = useQuery<CampusDetailPublic>({ queryKey: ["/api/public/campus", slug], staleTime: 60_000 });
  const programmeQ = useProgrammePublic();
  const introuvable = detailQ.error instanceof ErreurApi && detailQ.error.statut === 404;
  // Réseau coupé : les faits livrés avec le code (sans les cours).
  const c = detailQ.data?.campus ?? (detailQ.isError && !introuvable ? site.campus.find((x) => x.slug === slug) : undefined);
  useTitreDocument(c ? `Campus 2IAE ${c.nom}` : null);
  const autres = site.campus.filter((x) => x.slug !== slug);
  const galerie = GALERIES[slug] ?? [];
  const cours = detailQ.data?.cours ?? [];
  const lives = detailQ.data?.lives ?? [];

  if (detailQ.isLoading) {
    return (
      <MiseEnPagePublique>
        <div className="conteneur grid gap-10 py-10 lg:grid-cols-2" aria-busy="true">
          <div className="flex flex-col gap-4">
            <Squelette className="h-4 w-40" />
            <Squelette className="h-24 w-full" />
            <Squelette className="h-16 w-3/4" />
          </div>
          <Squelette className="aspect-[4/3] rounded-[28px]" />
        </div>
      </MiseEnPagePublique>
    );
  }

  if (!c) {
    return (
      <MiseEnPagePublique>
        <EnTetePagePublique fil={[{ href: "/campus", libelle: "Campus" }, { libelle: "Introuvable" }]} titre="Ce campus n'existe pas." />
        <section className="conteneur pb-16">
          <EtatVidePublic
            icone={<SearchX className="h-6 w-6" />}
            titre="L'adresse de cette page est peut-être incomplète."
            texte="Le Groupe 2IAE compte cinq campus : retrouvez-les tous sur la page des campus."
            action={<LienBouton href="/campus">Voir les cinq campus</LienBouton>}
          />
        </section>
      </MiseEnPagePublique>
    );
  }

  const telephones = c.telephone ? [c.telephone] : site.contacts.telephones;

  return (
    <MiseEnPagePublique>
      <section className="conteneur grid items-start gap-8 pb-10 pt-6 sm:pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        <EnTetePagePublique
          className="!px-0 !pb-0 !pt-0"
          titreClasse="text-[clamp(32px,9vw,38px)] md:text-[clamp(34px,4.3vw,64px)]"
          fil={[{ href: "/campus", libelle: "Campus" }, { libelle: c.nomCourt }]}
          etiquette={c.slug === "riviera" ? "Campus 2IAE · Siège du groupe" : "Campus 2IAE"}
          titre={c.nom}
          texte={c.localite && c.localite !== c.nom && c.localite !== c.nomCourt ? c.localite : undefined}
          actions={
            <>
              <a
                href={c.itineraire}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-orange px-6 text-base font-bold text-encre no-underline hover:bg-encre hover:text-white"
              >
                <Navigation className="h-5 w-5" /> Itinéraire
              </a>
              <BoutonWhatsappCampus campus={c} className="min-h-[52px] rounded-[14px] px-6 text-base" />
            </>
          }
        >
          {c.presentation && <Paragraphes texte={c.presentation} className="max-w-[620px]" />}
        </EnTetePagePublique>
        <figure className="flex flex-col gap-2">
          <PhotoCampus campus={c} eager className="aspect-[4/3] w-full rounded-[28px]" />
          {c.photoUrl && <figcaption className="font-mono text-xs text-texte-gris">Le campus 2IAE de {c.nomCourt}</figcaption>}
        </figure>
      </section>

      {/* Les faits */}
      <section className="conteneur pb-12">
        <div className={cn("grid gap-4 sm:grid-cols-2", c.resultat ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
          <Fait icone={<MapPin className="h-4 w-4" />} titre="Adresse">
            <p className="text-[16px] font-semibold leading-snug">{c.adresse || "Adresse bientôt précisée"}</p>
            <p className="text-[15px] text-texte-pale">{c.localite}</p>
            <a href={c.itineraire} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex min-h-[40px] items-center gap-1.5 text-[15px] font-bold">
              Ouvrir dans Google Maps
            </a>
          </Fait>
          <Fait icone={<Presentation className="h-4 w-4" />} titre="Salle de conférence">
            <p className="text-[16px] font-semibold leading-snug">{c.salle}</p>
            <p className="text-[15px] leading-relaxed text-texte-pale">Écran, caméra et micro : les étudiants y suivent le cours en direct avec les autres campus.</p>
          </Fait>
          {c.resultat && (
            <Fait icone={<Trophy className="h-4 w-4" />} titre={`Résultats ${c.resultat.libelle}`}>
              <p className="text-[44px] font-black leading-none tracking-serre">{formatTaux(c.resultat.taux)}</p>
              <p className="text-[15px] text-texte-pale">d'admis, tels que publiés par le Groupe 2IAE.</p>
            </Fait>
          )}
          <Fait icone={<Phone className="h-4 w-4" />} titre={c.telephone ? "Contact du campus" : "Contact"}>
            <ul className="flex flex-col">
              {telephones.map((t) => (
                <li key={t}>
                  <a href={lienTelephone(t)} className="inline-flex min-h-[40px] items-center text-[16px] font-semibold text-encre no-underline hover:text-orange-fonce">
                    {t}
                  </a>
                </li>
              ))}
            </ul>
            {!c.telephone && <p className="text-[14px] text-texte-pale">Standard du Groupe 2IAE</p>}
          </Fait>
        </div>
      </section>

      {/* Ce qu'on y étudie */}
      <section className="conteneur pb-12 sm:pb-16">
        <div className="mb-6 flex flex-col gap-2">
          <span className="etiquette">Ce qu'on y étudie</span>
          <h2 className="text-[30px] font-black leading-none tracking-serre sm:text-[40px]">Les filières du campus.</h2>
          {c.filieres.length > 0 && <p className="text-base text-texte-pale">Filières présentées au BTS 2026. Et, pour tous les étudiants, des cours d'entrepreneuriat.</p>}
        </div>
        <Filieres campus={c} />
      </section>

      {/* Au campus numérique */}
      <section className="bg-creme py-14 sm:py-16">
        <div className="conteneur flex flex-col gap-10">
          <SemaineAuCampus
            programme={programmeQ.data}
            lives={lives}
            chargement={programmeQ.isLoading}
            siteId={c.id}
            videTexte={`Dès que le service des études publie l'emploi du temps des classes de ${c.nomCourt}, leurs cours en direct s'affichent ici.`}
          />
          {cours.length > 0 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-[26px] font-black tracking-serre sm:text-[32px]">Les cours suivis dans sa salle</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cours.map((x) => (
                  <CarteCoursPublic key={x.slug} cours={x} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Galerie */}
      {galerie.length > 0 && (
        <section className="conteneur py-14 sm:py-16">
          <h2 className="mb-6 text-[26px] font-black tracking-serre sm:text-[32px]">Le campus en images</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {galerie.map((g) => (
              <li key={g.src}>
                <figure className="flex flex-col gap-2">
                  <img src={g.src} alt={g.legende} width={g.largeur} height={g.hauteur} loading="lazy" decoding="async" className="aspect-[4/3] w-full rounded-3xl object-cover" />
                  <figcaption className="text-[14px] text-texte-pale">{g.legende}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* La vie scolaire */}
      <section className="conteneur py-14 sm:py-16">
        <div className="grid gap-6 rounded-[28px] bg-encre p-6 text-white sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">La vie scolaire</span>
            <h2 className="text-[28px] font-black leading-tight tracking-serre sm:text-[36px]">Une question sur la scolarité à {c.nomCourt} ?</h2>
            <p className="max-w-2xl text-[16px] leading-relaxed text-nuit-doux">
              Fiche de connexion, code oublié, emploi du temps, absence à justifier : la vie scolaire du campus répond{c.whatsappCampus ? " sur WhatsApp" : ""}.
              Les parents peuvent aussi lui demander le lien du relevé de leur enfant.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <BoutonWhatsappCampus campus={c} className="min-h-[52px] text-base" />
            {telephones[0] && (
              <a
                href={lienTelephone(telephones[0])}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-nuit-bord px-5 text-base font-bold text-white no-underline hover:border-orange hover:text-orange"
              >
                <Phone className="h-5 w-5" /> {telephones[0]}
              </a>
            )}
            {!c.whatsapp && (
              <span className="inline-flex items-center gap-2 text-sm text-nuit-gris">
                <MessageCircle className="h-4 w-4" /> WhatsApp bientôt disponible
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Les autres campus */}
      <section className="conteneur pb-16">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">Les autres campus</h2>
        <ul className="flex flex-wrap gap-2">
          {autres.map((x) => (
            <li key={x.slug}>
              <Link
                href={`/campus/${x.slug}`}
                className="inline-flex min-h-[48px] items-center rounded-full border border-ligne px-5 text-[15px] font-bold text-encre no-underline hover:border-orange hover:text-encre"
              >
                {x.nom}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </MiseEnPagePublique>
  );
}
