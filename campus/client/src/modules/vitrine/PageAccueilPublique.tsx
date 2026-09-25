// Accueil public du campus (maquette « 01 Accueil ») : « Un cours. Cinq
// campus. En direct. », le prochain live annoncé avec son compte à rebours,
// les trois façons de suivre, la salle live en démonstration, le réseau des
// salles, l'application, les formateurs et les cours annoncés.
//
// Tout vient de la vitrine publique (/api/public/vitrine) : quand rien n'est
// encore annoncé, les sections de données se replient et la page reste belle.
import { useQuery } from "@tanstack/react-query";
import { BellRing, Camera, Download, Gauge, Laptop, Presentation, Smartphone, WifiOff } from "lucide-react";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { dateCourte } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { AvertissementNavigateur } from "@/modules/pwa/AvertissementNavigateur";
import { useInstallation } from "@/modules/pwa/installation";
import { plateforme, estInstallee } from "@/modules/pwa/outils";
import type { Vitrine } from "@shared/api";
import type { SitePublic } from "@shared/schema";
import {
  CarteCoursPublic,
  CarteFormateurPublic,
  CarteProchainLive,
  EnTetePublic,
  PiedPublic,
  TitreSectionPublic,
  sallesDepuisSites,
  type AncreNav,
} from "./composants";
import { DemoSalleLive } from "./DemoSalleLive";
import { Telephones } from "./Telephones";
import { allerA, liveAMettreEnAvant, nomCampus, SEUIL_EFFECTIF, SITES_DE_SECOURS, useTitreDocument, ville } from "./outils";

const MODES = [
  {
    n: "01",
    titre: "Téléphone",
    texte: "Application légère, optimisée pour la 4G. Live, questions, replays et devoirs depuis le téléphone.",
    detail: "Son + diapos : environ 12 à 15 Mo par heure",
    icone: Smartphone,
    fond: "bg-orange-clair text-encre",
  },
  {
    n: "02",
    titre: "Ordinateur",
    texte: "Espace complet dans le navigateur : cours, classe virtuelle, diapositives, messages et notes.",
    detail: "Vidéo, replays et fiches de révision",
    icone: Laptop,
    fond: "bg-orange text-encre",
  },
  {
    n: "03",
    titre: "Salle de conférence",
    texte: "Chaque campus se connecte en salle. Les étudiants lèvent la main, le formateur leur donne la parole.",
    detail: "5 salles équipées : écran, caméra, micro",
    icone: Presentation,
    fond: "bg-encre text-white",
  },
];

const FONCTIONS = [
  { tag: "Cours", titre: "Modules et parcours", texte: "Chapitres, ressources PDF, vidéos et progression par étudiant, organisés par filière et par campus." },
  {
    tag: "Live",
    titre: "Classe virtuelle",
    texte: "Visioconférence intégrée : salles de campus, main levée, questions votées, sondages éclair et diapositives.",
  },
  {
    tag: "Replay",
    titre: "Revoir chaque séance",
    texte: "Chaque séance est enregistrée et publiée dans le cours, avec sa fiche de révision et sa transcription.",
  },
  {
    tag: "Évaluation",
    titre: "Devoirs et interrogations",
    texte: "Rendre un devoir en photo, reçu horodaté, interrogations chronométrées et carnet de notes.",
  },
  {
    tag: "Échanges",
    titre: "Messages et salons de cours",
    texte: "Écrire à ses formateurs comme sur WhatsApp. Questions du cours modérées par les formateurs.",
  },
  { tag: "IA", titre: "Assistant pédagogique", texte: "Fiches de révision, explications et exercices tirés du cours. L'IA propose, le formateur valide." },
  {
    tag: "Hors ligne",
    titre: "Le réseau coupe, le campus continue",
    texte: "Les pages consultées restent sur le téléphone ; un devoir écrit sans réseau part tout seul au retour.",
  },
  { tag: "Émargement", titre: "Présence en un code", texte: "En salle, un code à 4 chiffres affiché à l'écran ; en ligne, la présence se compte toute seule." },
];

/** Étiquette de la maquette : « Rentrée 2026 » d'août à décembre, « Année 2026-2027 » ensuite. */
function periode(maintenant: number): string {
  const d = new Date(maintenant);
  const annee = d.getUTCFullYear();
  return d.getUTCMonth() >= 7 ? `Rentrée ${annee}` : `Année ${annee - 1}-${annee}`;
}

/** Les chiffres ne s'affichent que s'ils servent le campus (pas de « 4 étudiants »). */
function chiffresParlants(c: Vitrine["chiffres"] | undefined) {
  if (!c) return [];
  const liste = [
    { valeur: c.etudiants, libelle: "étudiants", seuil: 100 },
    { valeur: c.formateurs, libelle: "formateurs", seuil: 5 },
    { valeur: c.cours, libelle: "cours en ligne", seuil: 5 },
    { valeur: c.heuresDeDirect, libelle: "heures de direct", seuil: 20 },
  ].filter((x) => x.valeur >= x.seuil);
  return liste.length >= 2 ? liste : [];
}

const fmtNombre = new Intl.NumberFormat("fr-FR");

export default function PageAccueilPublique() {
  useTitreDocument("Campus numérique 2IAE · Un cours. Cinq campus. En direct.");
  const maintenant = useMaintenant(30_000);
  const vitrineQ = useQuery<Vitrine>({ queryKey: ["/api/public/vitrine"], staleTime: 60_000, refetchInterval: 120_000 });
  const sitesQ = useQuery<SitePublic[]>({ queryKey: ["/api/public/sites"], staleTime: 5 * 60_000 });
  const { peutInstaller, installer } = useInstallation();

  const v = vitrineQ.data;
  const sites = sitesQ.data?.length ? sitesQ.data : SITES_DE_SECOURS;
  const live = v ? liveAMettreEnAvant(v.lives, maintenant) : null;
  const coursRepli = !live ? (v?.cours.find((c) => c.dateDebut && new Date(c.dateDebut).getTime() > maintenant) ?? null) : null;
  const chiffres = chiffresParlants(v?.chiffres);
  const villesFormateurs = [...new Set((v?.formateurs ?? []).map((f) => ville(f.localisation)).filter(Boolean))] as string[];

  const ancres: AncreNav[] = [
    { id: "salle-live", libelle: "La salle live" },
    { id: "campus", libelle: "Les campus" },
    { id: "application", libelle: "L'application" },
    ...(v?.formateurs.length ? [{ id: "formateurs", libelle: "Formateurs" }] : []),
    ...(v?.cours.length ? [{ id: "cours", libelle: "Cours à venir" }] : []),
  ];

  return (
    <div className="min-h-dvh bg-white">
      <EnTetePublic ancres={ancres} liveEnDirect={live?.enDirect ? live : null} />
      <AvertissementNavigateur vouvoiement />

      <main>
        {/* Héros */}
        <section className="conteneur grid items-center gap-10 pb-10 pt-10 sm:pt-16 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col gap-6">
            <span className="etiquette">L'École des Entrepreneurs · {periode(maintenant)}</span>
            <h1 className="text-[44px] font-black leading-[.95] tracking-tres-serre sm:text-[clamp(44px,6vw,84px)]">
              Un cours.
              <br />
              Cinq campus.
              <br />
              <span className="text-orange">En direct.</span>
            </h1>
            <p className="max-w-[520px] text-[17px] leading-[1.55] text-texte-doux sm:text-[19px]">
              Le campus numérique du Groupe 2IAE réunit les étudiants d'Abidjan, Yamoussoukro, M'Batto et Azaguié autour des mêmes formateurs, depuis leur
              téléphone, leur ordinateur ou la salle de conférence de leur campus.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <LienBouton href="/connexion" taille="lg" className="min-h-[56px] px-[26px] text-base font-extrabold">
                Accéder à mon campus
              </LienBouton>
              <a
                href="#salle-live"
                onClick={(e) => {
                  e.preventDefault();
                  allerA("salle-live");
                }}
                className="inline-flex min-h-[56px] items-center justify-center rounded-[14px] border-[1.5px] border-encre bg-white px-[26px] text-base font-bold text-encre no-underline transition-colors hover:bg-orange-pale hover:text-encre"
              >
                Voir la salle live
              </a>
            </div>
          </div>
          <CarteProchainLive live={live} coursRepli={coursRepli} salles={sallesDepuisSites(sites)} chargement={vitrineQ.isLoading} />
        </section>

        {/* Trois façons de suivre */}
        <section className="conteneur py-10">
          <TitreSectionPublic titre="Suivre le cours, où que vous soyez." texte="La même classe, le même formateur, les mêmes échanges. Seul l'écran change." />
          <div className="grid gap-4 md:grid-cols-3">
            {MODES.map((m) => {
              const Icone = m.icone;
              return (
                <div key={m.n} className={cn("flex min-h-[220px] flex-col justify-between gap-6 rounded-3xl p-6 sm:min-h-[260px] sm:p-7", m.fond)}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[13px] opacity-75">{m.n}</span>
                    <Icone className="h-6 w-6 opacity-80" aria-hidden />
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <h3 className="text-[28px] font-extrabold tracking-[-0.02em]">{m.titre}</h3>
                    <p className="text-[15px] leading-normal opacity-85">{m.texte}</p>
                    <span className="mt-1 font-mono text-xs opacity-70">{m.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tout le campus au même endroit */}
        <section className="conteneur py-10">
          <div className="flex flex-col gap-8 rounded-[32px] bg-creme p-5 sm:p-[clamp(24px,4vw,48px)]">
            <div className="flex max-w-[640px] flex-col gap-2.5">
              <span className="etiquette">Tout le campus au même endroit</span>
              <h2 className="text-[28px] font-black leading-[1.02] tracking-serre sm:text-[clamp(28px,3.2vw,44px)]">
                Cours, classes live, devoirs et replays dans un seul espace.
              </h2>
            </div>
            <div className="grid gap-px overflow-hidden rounded-[20px] bg-ligne sm:grid-cols-2 xl:grid-cols-4">
              {FONCTIONS.map((f) => (
                <div key={f.tag} className="flex flex-col gap-2.5 bg-white p-5 sm:p-[26px]">
                  <span className="font-mono text-xs font-semibold text-orange-fonce">{f.tag}</span>
                  <h3 className="text-xl font-extrabold tracking-[-0.01em]">{f.titre}</h3>
                  <p className="text-[15px] leading-[1.55] text-texte-moyen">{f.texte}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* La salle live, en démonstration */}
        <section id="salle-live" className="mt-10 scroll-mt-14 bg-nuit py-14 text-white sm:py-20">
          <div className="conteneur flex flex-col gap-8">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="flex max-w-2xl flex-col gap-2.5">
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">Démonstration · la salle live</span>
                <h2 className="text-[30px] font-black leading-none tracking-serre text-white sm:text-[clamp(30px,3.6vw,48px)]">Voici la classe en direct.</h2>
              </div>
              <p className="max-w-[440px] text-base leading-normal text-nuit-doux">
                Le formateur voit les cinq salles, donne la parole et répond aux questions les plus votées. Essayez : votez pour une question, levez la main.
              </p>
            </div>
            <DemoSalleLive />
          </div>
        </section>

        {/* Un réseau de salles connectées */}
        <section id="campus" className="conteneur scroll-mt-20 py-14 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h2 className="text-[30px] font-black leading-[1.02] tracking-serre sm:text-[clamp(28px,3.2vw,44px)]">Un réseau de salles connectées.</h2>
              <p className="max-w-[460px] text-base leading-[1.55] text-texte-moyen">
                Chaque campus dispose d'une salle de conférence équipée : écran, caméra et micro de salle. Les étudiants se réunissent, le formateur les voit et
                leur donne la parole.
              </p>
              {chiffres.length > 0 && (
                <dl className="mt-2 grid max-w-[460px] grid-cols-2 gap-3">
                  {chiffres.map((c) => (
                    <div key={c.libelle} className="rounded-2xl bg-creme px-4 py-3">
                      <dt className="font-mono text-xs uppercase tracking-wider text-texte-gris">{c.libelle}</dt>
                      <dd className="text-3xl font-black tabular-nums tracking-serre">{fmtNombre.format(c.valeur)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <ul className="flex flex-col border-t-2 border-encre">
              {sites.map((s) => (
                <li
                  key={s.slug}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1 border-b border-ligne py-4 sm:grid-cols-[1fr_auto_auto] sm:py-[18px]"
                >
                  <span className="text-xl font-extrabold tracking-[-0.01em] sm:text-[22px]">{nomCampus(s)}</span>
                  <span className="order-3 font-mono text-xs text-texte-gris sm:order-none">{s.salle}</span>
                  <span className="row-span-2 self-center whitespace-nowrap rounded-full bg-orange-clair px-2.5 py-[5px] font-mono text-xs text-orange-profond sm:row-span-1">
                    {s.etudiants >= SEUIL_EFFECTIF ? `${fmtNombre.format(s.etudiants)} inscrits` : "Salle connectée"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Le campus dans la poche */}
        <section id="application" className="conteneur scroll-mt-20 py-14 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-col gap-5">
              <span className="etiquette">Application mobile</span>
              <h2 className="text-[36px] font-black leading-[.98] tracking-tres-serre sm:text-[clamp(36px,4.6vw,64px)]">Le campus dans la poche.</h2>
              <p className="max-w-[460px] text-[17px] leading-[1.55] text-texte-doux">
                Suivre le live, lever la main, poser une question, revoir le replay et rendre un devoir depuis un téléphone. Mode données réduites pour les
                connexions mobiles.
              </p>
              <ul className="grid max-w-[520px] gap-3 sm:grid-cols-2">
                {[
                  { icone: BellRing, texte: "Un rappel 15 minutes avant chaque cours en direct" },
                  { icone: Camera, texte: "Un devoir rendu en photo, avec son reçu" },
                  { icone: WifiOff, texte: "Les pages consultées restent sans réseau" },
                  { icone: Gauge, texte: "Mode données réduites pour les petits forfaits" },
                ].map(({ icone: Icone, texte }) => (
                  <li key={texte} className="flex items-start gap-3 text-[15px] leading-snug">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-clair text-orange-fonce">
                      <Icone className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span className="pt-1.5">{texte}</span>
                  </li>
                ))}
              </ul>
              {!estInstallee() &&
                (peutInstaller ? (
                  <Bouton taille="lg" className="min-h-[56px] self-start" icone={<Download className="h-5 w-5" />} onClick={() => void installer()}>
                    Installer l'application
                  </Bouton>
                ) : (
                  <p className="max-w-[460px] rounded-2xl bg-creme px-4 py-3 text-[15px] leading-relaxed text-texte-pale">
                    {plateforme() === "ios" ? (
                      <>
                        Sur iPhone : ouvrez le campus dans Safari, touchez <strong className="text-encre">Partager</strong> puis{" "}
                        <strong className="text-encre">« Sur l'écran d'accueil »</strong>.
                      </>
                    ) : (
                      <>
                        Rien à télécharger : ouvrez le campus dans Chrome, touchez le menu <strong className="text-encre">⋮</strong> puis{" "}
                        <strong className="text-encre">« Ajouter à l'écran d'accueil »</strong>.
                      </>
                    )}
                  </p>
                ))}
            </div>
            <Telephones />
          </div>
        </section>

        {/* Formateurs annoncés */}
        {v && v.formateurs.length > 0 && (
          <section className="conteneur py-10">
            <TitreSectionPublic
              id="formateurs"
              etiquette="Ils enseignent au campus"
              titre="Des formateurs d'ici et d'ailleurs."
              texte={
                villesFormateurs.length
                  ? `Depuis ${villesFormateurs.slice(0, 3).join(", ")}${villesFormateurs.length > 3 ? "…" : ""}, ils enseignent en direct aux cinq campus.`
                  : "Ils enseignent en direct aux cinq campus, où qu'ils soient."
              }
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {v.formateurs.map((f) => (
                <CarteFormateurPublic key={f.slug} formateur={f} />
              ))}
            </div>
          </section>
        )}

        {/* Cours à venir */}
        {v && v.cours.length > 0 && (
          <section className="conteneur py-10">
            <TitreSectionPublic
              id="cours"
              etiquette="Cours ouverts"
              titre="Les prochains cours."
              texte="Chaque cours est suivi en même temps dans les salles de conférence et sur les téléphones."
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {v.cours.map((c) => (
                <CarteCoursPublic key={c.slug} cours={c} />
              ))}
            </div>
          </section>
        )}

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
      </main>

      <PiedPublic sites={sites} />
    </div>
  );
}
