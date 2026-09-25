// Fiche publique d'un cours annoncé (/cours-ouverts/:slug) : ce qu'on y
// apprend, le programme, les prochains lives avec compte à rebours, le
// formateur, les campus où le suivre, et les deux portes d'entrée (étudiant,
// futur étudiant). C'est la page que l'on partage sur WhatsApp.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Check, MonitorSmartphone, SearchX } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { EtatVide, Squelette } from "@/components/ui/divers";
import { Markdown } from "@/components/ui/markdown";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { dateComplete } from "@/lib/dates";
import { ErreurApi } from "@/lib/api";
import { pluriel } from "@/lib/utils";
import type { SitePublic, FicheCoursPublique } from "@shared/schema";
import {
  BoutonPartager,
  BoutonsAcces,
  CarteFormateurPublic,
  CarteProchainLive,
  EnTetePublic,
  ListeLives,
  PiedPublic,
  quandCours,
  sallesDepuisCampus,
} from "./composants";
import { liveAMettreEnAvant, SITES_DE_SECOURS, useTitreDocument } from "./outils";

export default function PageCoursPublic({ slug }: { slug: string }) {
  const maintenant = useMaintenant(30_000);
  const ficheQ = useQuery<FicheCoursPublique>({ queryKey: ["/api/public/cours", slug], staleTime: 60_000 });
  const sitesQ = useQuery<SitePublic[]>({ queryKey: ["/api/public/sites"], staleTime: 5 * 60_000 });
  const sites = sitesQ.data?.length ? sitesQ.data : SITES_DE_SECOURS;
  const c = ficheQ.data;
  useTitreDocument(c ? `${c.titre} · Campus numérique 2IAE` : null);

  const introuvable = ficheQ.error instanceof ErreurApi && ficheQ.error.statut === 404;
  const live = c ? liveAMettreEnAvant(c.lives, maintenant) : null;

  return (
    <div className="min-h-dvh bg-white">
      <EnTetePublic liveEnDirect={live?.enDirect ? live : null} />
      <main className="conteneur flex flex-col gap-12 pb-16 pt-6 sm:pt-8">
        <Link href="/" className="inline-flex min-h-[44px] items-center gap-2 self-start font-mono text-xs uppercase tracking-[0.12em] text-texte-gris no-underline hover:text-encre">
          <ArrowLeft className="h-4 w-4" /> Campus numérique · cours ouverts
        </Link>

        {ficheQ.isLoading ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex flex-col gap-4">
              <Squelette className="h-4 w-32" />
              <Squelette className="h-14 w-full" />
              <Squelette className="h-14 w-2/3" />
              <Squelette className="h-20 w-full" />
            </div>
            <Squelette className="h-[420px] rounded-[28px]" />
          </div>
        ) : !c ? (
          <EtatVide
            icone={<SearchX className="h-6 w-6" />}
            titre={introuvable ? "Ce cours n'est pas (ou plus) annoncé." : "La fiche du cours ne s'affiche pas."}
            texte={
              introuvable
                ? "Il a peut-être été retiré du site ou son adresse a changé. Les cours annoncés sont sur l'accueil du campus numérique."
                : "Vérifiez votre connexion et réessayez dans un instant."
            }
            action={<LienBouton href="/">Voir les cours annoncés</LienBouton>}
            className="my-10"
          />
        ) : (
          <>
            <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.couleur }} aria-hidden />
                  <span className="etiquette">{c.code} · Cours ouvert</span>
                </div>
                <h1 className="text-[38px] font-black leading-[.98] tracking-tres-serre sm:text-[clamp(40px,5vw,68px)]">{c.titre}</h1>
                <p className="max-w-[620px] text-[17px] leading-[1.55] text-texte-doux sm:text-[19px]">{c.accroche}</p>
                <ul className="flex flex-wrap gap-2">
                  <li className="rounded-full bg-creme px-3 py-1.5 font-mono text-xs text-texte-doux">{quandCours(c, maintenant)}</li>
                  {c.nbCampus > 0 && (
                    <li className="rounded-full bg-creme px-3 py-1.5 font-mono text-xs text-texte-doux">
                      {c.nbCampus > 1 ? `En direct dans ${c.nbCampus} campus` : "En direct au campus numérique"}
                    </li>
                  )}
                  <li className="rounded-full bg-creme px-3 py-1.5 font-mono text-xs text-texte-doux">Replays et fiches de révision</li>
                </ul>
                <BoutonsAcces hrefEtudiant={`/cours/${c.coursId}`} libelleEtudiant="Je suis étudiant 2IAE : accéder au cours" codeCours={c.code} />
                {c.imageUrl && (
                  <img src={c.imageUrl} alt="" loading="lazy" decoding="async" className="aspect-[16/9] w-full max-w-[620px] rounded-3xl object-cover" />
                )}
                <BoutonPartager
                  className="-ml-3 self-start"
                  texte={`${c.titre} : un cours en direct au campus numérique 2IAE${c.dateDebut && new Date(c.dateDebut).getTime() > maintenant ? `, dès le ${dateComplete(c.dateDebut).toLowerCase()}` : ""}. ${window.location.origin}/cours-ouverts/${c.slug}`}
                />
              </div>
              <CarteProchainLive
                live={live}
                coursRepli={live ? null : c}
                salles={sallesDepuisCampus(c.campus)}
                titreSeance
                className="lg:sticky lg:top-24"
              />
            </section>

            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
              <div className="flex flex-col gap-12">
                {c.objectifs.length > 0 && (
                  <section className="flex flex-col gap-5">
                    <h2 className="text-[26px] font-black tracking-serre sm:text-[32px]">Ce que vous saurez faire</h2>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {c.objectifs.map((o) => (
                        <li key={o} className="flex items-start gap-3 rounded-2xl bg-creme p-4 text-base leading-snug">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange text-encre">
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                          <span className="pt-0.5">{o}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {c.description.trim() && (
                  <section className="flex flex-col gap-3">
                    <h2 className="text-[26px] font-black tracking-serre sm:text-[32px]">Le cours</h2>
                    <Markdown source={c.description} className="max-w-[680px] text-[16.5px]" />
                  </section>
                )}

                {c.programme.length > 0 && (
                  <section className="flex flex-col gap-4">
                    <h2 className="text-[26px] font-black tracking-serre sm:text-[32px]">Le programme</h2>
                    <ol className="flex flex-col border-t-2 border-encre">
                      {c.programme.map((m, i) => (
                        <li key={`${i}-${m.titre}`} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-b border-ligne py-4">
                          <span className="font-mono text-sm text-orange-fonce">{String(i + 1).padStart(2, "0")}</span>
                          <span className="text-lg font-bold leading-snug">{m.titre}</span>
                          <span className="font-mono text-xs text-texte-gris">{m.lecons ? pluriel(m.lecons, "leçon") : "bientôt"}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {c.lives.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <h2 className="text-[26px] font-black tracking-serre sm:text-[32px]">Les prochains cours en direct</h2>
                    <p className="text-base text-texte-pale">Heure d'Abidjan, avec l'heure de Paris pour les formateurs en France.</p>
                    <ListeLives lives={c.lives} />
                  </section>
                )}
              </div>

              <aside className="flex flex-col gap-8">
                {c.formateur && (
                  <section className="flex flex-col gap-3">
                    <h2 className="text-xl font-extrabold">Votre formateur</h2>
                    <CarteFormateurPublic formateur={c.formateur} />
                  </section>
                )}
                <section className="flex flex-col gap-3">
                  <h2 className="text-xl font-extrabold">Où suivre ce cours</h2>
                  <ul className="flex flex-col rounded-3xl border border-ligne px-5">
                    {c.campus.map((s) => (
                      <li key={s.slug} className="flex items-center justify-between gap-3 border-b border-ligne py-3.5 last:border-b-0">
                        <span className="text-base font-bold">{s.nomCourt}</span>
                        <span className="font-mono text-xs text-texte-gris">{s.salle}</span>
                      </li>
                    ))}
                    <li className="flex items-center gap-3 py-3.5">
                      <MonitorSmartphone className="h-5 w-5 text-orange-fonce" aria-hidden />
                      <span className="text-[15px] text-texte-doux">ou en ligne, depuis le téléphone ou l'ordinateur</span>
                    </li>
                  </ul>
                </section>
              </aside>
            </div>

            <section className="flex flex-col gap-5 rounded-[32px] bg-creme p-6 sm:flex-row sm:items-center sm:justify-between sm:p-10">
              <div className="flex max-w-xl flex-col gap-2">
                <h2 className="text-[26px] font-black leading-tight tracking-serre sm:text-[32px]">Prêt à suivre ce cours ?</h2>
                <p className="text-base text-texte-pale">
                  Étudiant 2IAE : connectez-vous avec votre matricule. Pas encore inscrit : la préinscription prend quelques minutes.
                </p>
              </div>
              <BoutonsAcces
                hrefEtudiant={`/cours/${c.coursId}`}
                libelleEtudiant="Accéder au cours"
                libellePreinscription="Faire ma préinscription"
                codeCours={c.code}
                className="sm:flex-nowrap"
              />
            </section>
          </>
        )}
      </main>
      <PiedPublic sites={sites} sansAppel={Boolean(c)} />
    </div>
  );
}
