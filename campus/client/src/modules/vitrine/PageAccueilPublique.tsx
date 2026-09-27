// Accueil public du campus : court et fort. Le titre et le texte choisis par
// la direction, le PROCHAIN cours réel en direct (live annoncé, sinon
// l'emploi du temps publié), « Cette semaine au campus », les formateurs, les
// cinq campus, les trois façons de suivre, et la préinscription (pied de page).
// Chaque bloc renvoie vers SA page.
import { Link } from "wouter";
import { Laptop, Presentation, Smartphone, UsersRound } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Squelette } from "@/components/ui/divers";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { dateCourte } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { AvertissementNavigateur } from "@/modules/pwa/AvertissementNavigateur";
import type { ProgrammePublicDto } from "@shared/schema";
import type { Vitrine } from "@shared/api";
import {
  CarteCampus,
  CarteFormateurPublic,
  CarteProchainCours,
  depuisCours,
  depuisLive,
  depuisOccurrence,
  EtatVidePublic,
  LienFleche,
  TitreSectionPublic,
  sallesDepuisCampus,
  type ProchainCours,
} from "./composants";
import { ShowreelsAccueil } from "@/modules/showreel";
import { useProgrammePublic, useSitePublic, useSitePublicOuSecours, useVitrine } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { SemaineAuCampus } from "./SemaineAuCampus";
import { liveAMettreEnAvant, typo, useTitreDocument } from "./outils";

const MODES = [
  {
    titre: "Dans la salle de conférence",
    texte: "Chaque campus suit le cours sur grand écran. La salle lève la main, le formateur lui donne la parole.",
    detail: "Le téléphone pour voter : moins de 5 Mo par heure",
    icone: Presentation,
    fond: "bg-encre text-white",
  },
  {
    titre: "Au téléphone",
    texte: "Le son du formateur et ses diapositives, pensés pour les forfaits prépayés. La vidéo si le réseau le permet.",
    detail: "Son + diapos : environ 12 à 15 Mo par heure",
    icone: Smartphone,
    fond: "bg-orange text-encre",
  },
  {
    titre: "À l'ordinateur",
    texte: "La classe complète dans le navigateur : vidéo, diapositives, replays, devoirs et messages.",
    detail: "Vidéo : 150 à 250 Mo par heure",
    icone: Laptop,
    fond: "bg-orange-clair text-encre",
  },
];

/** Le prochain cours réel : un live annoncé, sinon le prochain créneau de l'emploi du temps, sinon un cours qui va commencer. */
function prochainCours(v: Vitrine | undefined, prog: ProgrammePublicDto | undefined, maintenant: number): ProchainCours | null {
  const live = v ? liveAMettreEnAvant(v.lives, maintenant) : null;
  if (live) {
    // Le live annoncé vient de l'emploi du temps : son créneau dit l'intervenant et les heures.
    const creneau = prog?.prochaines.find((o) => o.seanceId === live.id);
    return creneau ? { ...depuisOccurrence(creneau), enDirect: live.enDirect || creneau.statut === "en_direct" } : depuisLive(live);
  }
  const occ = prog?.prochaines
    .filter((o) => o.statut === "en_direct" || (o.statut === "prevue" && new Date(o.fin).getTime() > maintenant))
    .sort((a, b) => (a.statut === "en_direct" ? -1 : b.statut === "en_direct" ? 1 : a.debut.localeCompare(b.debut)))[0];
  if (occ) return depuisOccurrence(occ);
  const cours = v?.cours.find((c) => c.dateDebut && new Date(c.dateDebut).getTime() > maintenant);
  return cours ? depuisCours(cours) : null;
}

/** Titre saisi par la direction : une ligne par retour à la ligne, la dernière en orange. */
function TitreAccueil({ titre }: { titre: string }) {
  const lignes = titre
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <h1 className="text-[46px] font-black leading-[.95] tracking-tres-serre sm:text-[clamp(52px,6vw,88px)]">
      {lignes.map((l, i) => (
        <span key={i} className={cn("block", i === lignes.length - 1 && lignes.length > 1 && "text-orange")}>
          {typo(l)}
        </span>
      ))}
    </h1>
  );
}

export default function PageAccueilPublique() {
  const { site: contenu, chargement: chargementSite } = useSitePublic();
  const site = useSitePublicOuSecours();
  const vitrineQ = useVitrine();
  const programmeQ = useProgrammePublic();
  const maintenant = useMaintenant(30_000);
  useTitreDocument(`Campus numérique 2IAE · ${site.accueil.titre.replace(/\n/g, " ")}`);

  const v = vitrineQ.data;
  const prog = programmeQ.data;
  const prochain = prochainCours(v, prog, maintenant);
  const formateurs = v?.formateurs ?? [];

  return (
    <MiseEnPagePublique>
      <AvertissementNavigateur vouvoiement />

      {/* Héros */}
      <section className="conteneur grid items-center gap-10 pb-12 pt-8 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 lg:pb-16">
        <div className="flex flex-col gap-6">
          {chargementSite && !contenu ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <Squelette className="h-4 w-64" />
              <Squelette className="h-44 w-full max-w-xl" />
              <Squelette className="h-16 w-full max-w-lg" />
            </div>
          ) : (
            <>
              {site.accueil.etiquette && <span className="etiquette">{site.accueil.etiquette}</span>}
              <TitreAccueil titre={site.accueil.titre} />
              {site.accueil.sousTitre && <p className="max-w-[540px] text-[17px] leading-[1.55] text-texte-doux sm:text-[19px]">{typo(site.accueil.sousTitre)}</p>}
            </>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <LienBouton href="/connexion" taille="lg" className="min-h-[56px] px-[26px] text-base font-extrabold">
              Accéder à mon campus
            </LienBouton>
            <LienBouton href="/programme" variante="contour" taille="lg" className="min-h-[56px] px-[26px] text-base">
              Voir l'emploi du temps
            </LienBouton>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-texte-gris">
            {site.campus.map((c, i) => (
              <span key={c.slug} className="inline-flex items-center gap-2">
                {i > 0 && <span className="h-1 w-1 rounded-full bg-orange" aria-hidden />}
                <Link href={`/campus/${c.slug}`} className="text-texte-gris no-underline hover:text-encre">
                  {c.nomCourt}
                </Link>
              </span>
            ))}
          </p>
        </div>
        <CarteProchainCours prochain={prochain} salles={sallesDepuisCampus(site.campus)} chargement={vitrineQ.isLoading && programmeQ.isLoading} />
      </section>

      {/* Cette semaine au campus */}
      <section className="conteneur py-10 sm:py-14">
        <SemaineAuCampus programme={prog} lives={v?.lives ?? []} chargement={programmeQ.isLoading && vitrineQ.isLoading} />
      </section>

      {/* Formateurs */}
      <section className="conteneur py-10 sm:py-14">
        <TitreSectionPublic
          etiquette="Ils enseignent au campus"
          titre="Des formateurs d'ici et d'ailleurs."
          texte="Ils enseignent en direct aux cinq campus, où qu'ils se trouvent dans le monde."
          lien={formateurs.length ? { href: "/formateurs", libelle: "Tous les formateurs" } : undefined}
        />
        {/* Leurs présentations de 30 secondes, quand elles sont en ligne. */}
        <ShowreelsAccueil className="mb-8" />
        {formateurs.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {formateurs.slice(0, 3).map((f) => (
              <CarteFormateurPublic key={f.slug} formateur={f} />
            ))}
          </div>
        ) : (
          <EtatVidePublic
            icone={<UsersRound className="h-6 w-6" />}
            titre="Leurs portraits arrivent."
            texte="Un formateur n'est présenté ici qu'avec son accord. En attendant, l'emploi du temps dit qui enseigne chaque jour."
            action={<LienFleche href="/formateurs">La page des formateurs</LienFleche>}
          />
        )}
      </section>

      {/* Les cinq campus */}
      <section className="bg-creme py-14 sm:py-20">
        <div className="conteneur">
          <TitreSectionPublic
            etiquette="Un réseau de salles connectées"
            titre="Cinq campus, une même classe."
            texte="Chaque campus dispose d'une salle de conférence : écran, caméra et micro. Le même cours y est suivi en même temps."
            lien={{ href: "/campus", libelle: "Découvrir les campus" }}
          />
          <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {site.campus.map((c) => (
              <li key={c.slug}>
                <CarteCampus campus={c} />
              </li>
            ))}
          </ul>
          {site.campus.some((c) => c.resultat) && (
            <p className="mt-5 font-mono text-xs text-texte-gris">Taux d'admis aux examens, tels que publiés par le Groupe 2IAE.</p>
          )}
        </div>
      </section>

      {/* Trois façons de suivre */}
      <section className="conteneur py-14 sm:py-20">
        <TitreSectionPublic
          etiquette="Le direct"
          titre="Suivre le cours, où que vous soyez."
          texte="La même classe, le même formateur, les mêmes échanges. Seul l'écran change."
          lien={{ href: "/le-direct", libelle: "Comment suivre un cours" }}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m, i) => {
            const Icone = m.icone;
            return (
              <Link
                key={m.titre}
                href="/le-direct"
                className={cn(
                  "group flex min-h-[230px] flex-col justify-between gap-6 rounded-3xl p-6 no-underline transition-transform hover:-translate-y-0.5 sm:p-7",
                  i === 2 && "sm:col-span-2 lg:col-span-1",
                  m.fond,
                )}
              >
                <Icone className="h-7 w-7 opacity-80" aria-hidden />
                <div className="flex flex-col gap-2.5">
                  <h3 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">{m.titre}</h3>
                  <p className="text-[15px] leading-normal opacity-85">{m.texte}</p>
                  <span className="mt-1 font-mono text-xs opacity-75">{m.detail}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Actualités publiques du campus */}
      {v && v.annonces.length > 0 && (
        <section className="conteneur pb-14">
          <TitreSectionPublic etiquette="Actualités" titre="Au campus numérique." />
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {v.annonces.slice(0, 3).map((a) => (
              <li key={a.id} className="flex flex-col gap-2 rounded-3xl border border-ligne p-5 sm:p-6">
                <span className="font-mono text-xs text-texte-gris">{dateCourte(a.publieeLe)}</span>
                <h3 className="text-lg font-extrabold leading-snug">{a.titre}</h3>
                <p className="line-clamp-4 text-[15px] leading-relaxed text-texte-pale">{a.corps}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </MiseEnPagePublique>
  );
}
