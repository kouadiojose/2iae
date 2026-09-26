// Fiche publique d'un formateur annoncé (/formateurs/:slug), publiée
// seulement avec son consentement : photo, titre, « depuis Lyon », bio, ses
// cours annoncés et son prochain cours en direct.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, MapPin, SearchX } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Avatar, EtatVide, Squelette } from "@/components/ui/divers";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { ErreurApi } from "@/lib/api";
import type { FicheFormateurPublique } from "@shared/schema";
import { BoutonPartager, BoutonsAcces, CarteCoursPublic, CarteProchainLive, ListeLives, sallesDepuisCampus } from "./composants";
import { useSitePublicOuSecours } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { ShowreelFormateur } from "@/modules/showreel";
import { liveAMettreEnAvant, useTitreDocument, ville } from "./outils";

export default function PageFormateurPublic({ slug }: { slug: string }) {
  const maintenant = useMaintenant(30_000);
  const ficheQ = useQuery<FicheFormateurPublique>({ queryKey: ["/api/public/formateurs", slug], staleTime: 60_000 });
  const site = useSitePublicOuSecours();
  const f = ficheQ.data;
  useTitreDocument(f ? `${f.prenom} ${f.nom} · Campus numérique 2IAE` : null);

  const introuvable = ficheQ.error instanceof ErreurApi && ficheQ.error.statut === 404;
  const live = f ? liveAMettreEnAvant(f.lives, maintenant) : null;
  const coursRepli = !live && f ? (f.coursDetail.find((c) => c.dateDebut && new Date(c.dateDebut).getTime() > maintenant) ?? null) : null;

  return (
    <MiseEnPagePublique>
      <div className="conteneur flex flex-col gap-12 pb-16 pt-6 sm:pt-8">
        <nav aria-label="Fil d'Ariane">
          <ol className="flex flex-wrap items-center gap-1 font-mono text-xs text-texte-gris">
            <li className="flex items-center gap-1">
              <Link href="/" className="inline-flex min-h-[32px] items-center text-texte-gris no-underline hover:text-encre">
                Accueil
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </li>
            <li className="flex items-center gap-1">
              <Link href="/formateurs" className="inline-flex min-h-[32px] items-center text-texte-gris no-underline hover:text-encre">
                Formateurs
              </Link>
              {f && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            </li>
            {f && (
              <li aria-current="page" className="text-texte-doux">
                {f.prenom} {f.nom}
              </li>
            )}
          </ol>
        </nav>

        {ficheQ.isLoading ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex flex-col gap-4">
              <Squelette className="h-32 w-32 rounded-full" />
              <Squelette className="h-14 w-2/3" />
              <Squelette className="h-20 w-full" />
            </div>
            <Squelette className="h-[420px] rounded-[28px]" />
          </div>
        ) : !f ? (
          <EtatVide
            icone={<SearchX className="h-6 w-6" />}
            titre={introuvable ? "Cette fiche n'est pas (ou plus) publiée." : "La fiche ne s'affiche pas."}
            texte={
              introuvable
                ? "Un formateur n'apparaît sur le campus public qu'avec son accord, qu'il peut retirer à tout moment."
                : "Vérifiez votre connexion et réessayez dans un instant."
            }
            action={<LienBouton href="/formateurs">Voir les formateurs</LienBouton>}
            className="my-10"
          />
        ) : (
          <>
            <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <Avatar prenom={f.prenom} nom={f.nom} photo={f.photoUrl} taille={120} className="ring-8 ring-orange-clair" />
                  <div className="flex min-w-0 flex-col gap-2">
                    <span className="etiquette">Formateur · Campus numérique 2IAE</span>
                    <h1 className="text-[40px] font-black leading-[.98] tracking-tres-serre sm:text-[clamp(40px,5vw,64px)]">
                      {f.prenom} {f.nom}
                    </h1>
                  </div>
                </div>
                {f.titre && <p className="max-w-[620px] text-[19px] font-semibold leading-snug text-texte-doux">{f.titre}</p>}
                {f.localisation && (
                  <p className="inline-flex items-center gap-2 font-mono text-sm text-texte-pale">
                    <MapPin className="h-4 w-4 text-orange-fonce" /> En direct depuis {f.localisation}, pour les cinq campus
                  </p>
                )}
                {f.bio && <p className="max-w-[620px] whitespace-pre-line text-[17px] leading-[1.6] text-texte-doux">{f.bio}</p>}
                <BoutonsAcces hrefEtudiant="/cours" libelleEtudiant="Je suis étudiant 2IAE : accéder à mes cours" codeCours={f.cours[0]?.code} />
                <BoutonPartager
                  className="-ml-3 self-start"
                  texte={`${f.prenom} ${f.nom}${f.titre ? `, ${f.titre}` : ""}${ville(f.localisation) ? `, enseigne en direct depuis ${ville(f.localisation)}` : ""} au campus numérique 2IAE. ${window.location.origin}/formateurs/${f.slug}`}
                />
              </div>
              <CarteProchainLive live={live} coursRepli={coursRepli} salles={sallesDepuisCampus(site.campus)} className="lg:sticky lg:top-24" />
            </section>

            {/* Sa présentation animée de 30 s (module showreel) : rien ne s'affiche tant qu'elle n'est pas publiée. */}
            <ShowreelFormateur slug={slug} className="w-full max-w-5xl" />

            {f.coursDetail.length > 0 && (
              <section className="flex flex-col gap-5">
                <h2 className="text-[26px] font-black tracking-serre sm:text-[32px]">
                  {f.coursDetail.length > 1 ? "Ses cours au campus numérique" : "Son cours au campus numérique"}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {f.coursDetail.map((c) => (
                    <CarteCoursPublic key={c.slug} cours={c} />
                  ))}
                </div>
              </section>
            )}

            {f.lives.length > 0 && (
              <section className="flex max-w-3xl flex-col gap-3">
                <h2 className="text-[26px] font-black tracking-serre sm:text-[32px]">Ses prochains cours en direct</h2>
                <p className="text-base text-texte-pale">Heure d'Abidjan (GMT).</p>
                <ListeLives lives={f.lives} avecCours />
              </section>
            )}
          </>
        )}
      </div>
    </MiseEnPagePublique>
  );
}
