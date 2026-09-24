// /campus-numerique — présentation du campus numérique 2IAE sur le site :
// un cours, cinq campus, en direct ; cours annoncés, lives à venir,
// formateurs, annonces. Les données viennent de la vitrine du campus (en
// cache côté serveur) ; sans elle, la page reste une présentation complète.
import { Link } from "wouter";
import { Laptop, MonitorPlay, Smartphone } from "lucide-react";
import { usePageMeta } from "@/lib/seo";
import { SITES_CAMPUS_REPLI } from "@shared/campus";
import {
  BOUTON_PRINCIPAL,
  BOUTON_SECONDAIRE,
  CarteCoursCampus,
  CarteFormateurCampus,
  CarteProchainLive,
  ETIQUETTE,
  LienCampus,
  LigneLive,
  ORANGE_TEXTE,
  dateComplete,
  liveEnDirect,
  useMaintenant,
  useVitrineCampus,
} from "@/components/campus-numerique";

const MODES = [
  {
    n: "01",
    icone: MonitorPlay,
    titre: "Dans la salle de conférence de son campus",
    texte: "Grand écran, caméra et micro de salle : les étudiants se retrouvent ensemble, le formateur les voit et leur donne la parole.",
    fond: "bg-[#1a1815] text-white",
  },
  {
    n: "02",
    icone: Smartphone,
    titre: "Sur son téléphone",
    texte: "Même en 4G, avec un mode audio et diapositives qui économise les données. Les replays restent disponibles après le cours.",
    fond: "bg-[#E8720C] text-[#1a1815]",
  },
  {
    n: "03",
    icone: Laptop,
    titre: "Sur un ordinateur",
    texte: "Depuis chez soi ou au cybercafé : le cours en direct, les questions au formateur, les devoirs et les notes au même endroit.",
    fond: "bg-white text-[#1a1815] border border-[#EADFD5]",
  },
];

const CE_QUE_L_ON_Y_FAIT = [
  ["Cours en direct", "Le formateur enseigne aux cinq salles et aux étudiants connectés, en même temps."],
  ["Replays", "Chaque cours se revoit, avec une fiche de révision validée par le formateur."],
  ["Devoirs", "On rend son devoir en photo depuis son téléphone et on reçoit un reçu."],
  ["Échanges", "Questions au formateur, messages et annonces de la vie scolaire."],
  ["Émargement", "Un code affiché dans la salle : la présence est notée en un geste."],
  ["Assistant IA", "Un tuteur qui fait réfléchir plutôt que de donner les réponses."],
];

function Titre({ etiquette, titre, id }: { etiquette: string; titre: string; id?: string }) {
  return (
    <div className="mb-8">
      <p className={`${ETIQUETTE} ${ORANGE_TEXTE} mb-3`}>{etiquette}</p>
      <h2 id={id} className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight text-[#1a1815]">
        {titre}
      </h2>
    </div>
  );
}

/** Encadré pédagogique quand une liste est vide : ce qui apparaîtra ici, et que faire en attendant. */
function EtatVide({ texte }: { texte: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[#d9c9bb] bg-white/70 p-6 sm:p-8 text-center">
      <p className="mx-auto max-w-xl text-lg text-[#5e554f]">{texte}</p>
      <Link href="/preinscription" className={`mt-4 inline-flex items-center font-semibold ${ORANGE_TEXTE} underline-offset-4 hover:underline`}>
        Se préinscrire pour être prévenu
      </Link>
    </div>
  );
}

export default function CampusNumeriquePage() {
  usePageMeta(
    "Campus numérique 2IAE — un cours, cinq campus, en direct | Groupe 2IAE",
    "Au campus numérique du Groupe 2IAE, un même formateur enseigne en direct aux salles de conférence de nos cinq campus et aux étudiants connectés depuis leur téléphone. Cours annoncés, formateurs et prochains lives.",
    "/campus-numerique",
  );
  const { vitrine, campusUrl, chargement } = useVitrineCampus();
  const maintenant = useMaintenant(60_000);
  const sites = vitrine?.campus.sites.length ? vitrine.campus.sites : SITES_CAMPUS_REPLI;
  // Lives à venir (et celui en cours) : les lives passés disparaissent seuls.
  const lives = (vitrine?.lives ?? []).filter(
    (l) => liveEnDirect(l, maintenant) || Date.parse(l.debut) > maintenant,
  );
  const chiffres = vitrine?.chiffres;
  const tuilesChiffres: [number, string][] = chiffres
    ? ([
        [chiffres.etudiants, "étudiants inscrits"],
        [chiffres.formateurs, "formateurs"],
        [chiffres.cours, "cours ouverts"],
        [chiffres.heuresDeDirect, "heures de cours en direct"],
      ] as [number, string][]).filter(([n]) => n > 0)
    : [];

  return (
    <div className="min-h-screen bg-white mobile-safe">
      {/* Héros : la promesse et le prochain rendez-vous */}
      <section className="bg-white mobile-no-overflow">
        <div className="container mx-auto mobile-padding grid items-center gap-10 py-12 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <div>
            <p className={`${ETIQUETTE} ${ORANGE_TEXTE} mb-5`} data-testid="text-campus-kicker">
              L'École des Entrepreneurs · Campus numérique
            </p>
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[0.98] text-[#1a1815]" data-testid="text-campus-titre">
              Un cours.
              <br />
              Cinq campus.
              <br />
              <span className="text-[#E8720C]">En direct.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg lg:text-xl leading-relaxed text-[#3d382f]">
              Le campus numérique du Groupe 2IAE réunit les étudiants de Riviera Palmeraie, Yopougon, Yamoussoukro,
              Azaguié et M'Batto autour des mêmes formateurs, depuis la salle de conférence de leur campus, leur
              téléphone ou leur ordinateur.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LienCampus href={campusUrl} className={BOUTON_PRINCIPAL} testId="link-acceder-campus">
                Accéder au campus
              </LienCampus>
              <Link href="/preinscription" className={BOUTON_SECONDAIRE} data-testid="link-campus-preinscription">
                Préinscription
              </Link>
            </div>
            <p className="mt-3 text-sm text-[#6b625b]">
              Étudiant 2IAE ? Connectez-vous avec votre matricule et votre code secret.
            </p>
          </div>
          <CarteProchainLive vitrine={vitrine} campusUrl={campusUrl} />
        </div>
      </section>

      {/* Cours annoncés */}
      <section className="bg-background mobile-no-overflow" aria-labelledby="titre-cours">
        <div className="container mx-auto mobile-padding py-14 lg:py-20">
          <Titre etiquette="Cours annoncés" titre="Les prochains cours du campus" id="titre-cours" />
          {chargement ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-80 animate-pulse rounded-3xl bg-white/80" />
              ))}
            </div>
          ) : vitrine && vitrine.cours.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {vitrine.cours.map((c) => (
                <CarteCoursCampus key={c.slug} cours={c} vitrine={vitrine} />
              ))}
            </div>
          ) : (
            <EtatVide texte="Les cours annoncés par nos formateurs apparaîtront ici, avec leur date de début et le compte à rebours du premier live." />
          )}
        </div>
      </section>

      {/* Lives à venir */}
      {vitrine && (
        <section className="bg-white mobile-no-overflow" aria-labelledby="titre-lives">
          <div className="container mx-auto mobile-padding py-14 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <Titre etiquette="Lives à venir" titre="Au programme des deux prochaines semaines" id="titre-lives" />
                <p className="max-w-md text-lg text-[#5e554f]">
                  Chaque live est diffusé en même temps dans les salles de conférence des campus concernés et sur le
                  téléphone des étudiants. Heures d'Abidjan.
                </p>
              </div>
              {lives.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {lives.map((l) => (
                    <LigneLive key={l.id} live={l} vitrine={vitrine} />
                  ))}
                </div>
              ) : (
                <EtatVide texte="Aucun live public n'est programmé pour le moment. Les prochains apparaîtront ici dès que la direction des études les aura planifiés." />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Formateurs */}
      <section className="bg-background mobile-no-overflow" aria-labelledby="titre-formateurs">
        <div className="container mx-auto mobile-padding py-14 lg:py-20">
          <Titre etiquette="Formateurs" titre="Nos formateurs, ici et à l'international" id="titre-formateurs" />
          {vitrine && vitrine.formateurs.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {vitrine.formateurs.map((f) => (
                <CarteFormateurCampus key={f.slug} formateur={f} />
              ))}
            </div>
          ) : (
            <EtatVide texte="Les formateurs qui enseignent au campus numérique seront présentés ici, avec leur parcours et leurs cours, dès qu'ils auront accepté d'apparaître sur le site." />
          )}
        </div>
      </section>

      {/* Annonces publiques */}
      {vitrine && vitrine.annonces.length > 0 && (
        <section className="bg-white mobile-no-overflow" aria-labelledby="titre-annonces">
          <div className="container mx-auto mobile-padding py-14 lg:py-20">
            <Titre etiquette="Annonces" titre="Les nouvelles du campus" id="titre-annonces" />
            <div className="grid gap-4 md:grid-cols-2">
              {vitrine.annonces.map((a) => (
                <article key={a.id} className="rounded-3xl border border-[#EADFD5] bg-[#fbf6f2] p-6" data-testid={`annonce-campus-${a.id}`}>
                  <p className={`${ETIQUETTE} ${ORANGE_TEXTE}`}>{dateComplete(a.publieeLe)}</p>
                  <h3 className="mt-2 text-xl font-bold text-[#1a1815]">{a.titre}</h3>
                  <p className="mt-2 whitespace-pre-line leading-relaxed text-[#5e554f]">{a.corps}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trois façons de suivre */}
      <section className="bg-white mobile-no-overflow" aria-labelledby="titre-modes">
        <div className="container mx-auto mobile-padding py-14 lg:py-20">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <h2 id="titre-modes" className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight text-[#1a1815]">
              Suivre le cours, où que l'on soit.
            </h2>
            <p className="max-w-md text-lg text-[#5e554f]">La même classe, le même formateur, les mêmes échanges. Seul l'écran change.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {MODES.map(({ n, icone: Icone, titre, texte, fond }) => (
              <div key={n} className={`flex min-h-[240px] flex-col justify-between gap-6 rounded-3xl p-7 ${fond}`}>
                <div className="flex items-center justify-between">
                  <span className="font-['IBM_Plex_Mono',ui-monospace,monospace] text-sm opacity-75">{n}</span>
                  <Icone className="h-7 w-7 opacity-80" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold leading-tight tracking-tight">{titre}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed opacity-90">{texte}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tout le campus au même endroit + réseau des salles */}
      <section className="bg-white mobile-no-overflow pb-14 lg:pb-20">
        <div className="container mx-auto mobile-padding">
          <div className="rounded-[32px] bg-[#fbf6f2] p-6 sm:p-10 lg:p-12">
            <p className={`${ETIQUETTE} ${ORANGE_TEXTE} mb-3`}>Tout le campus au même endroit</p>
            <h2 className="max-w-3xl font-serif text-3xl sm:text-4xl leading-tight text-[#1a1815]">
              Cours en direct, replays, devoirs et échanges dans un seul espace.
            </h2>
            <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-[#EADFD5] sm:grid-cols-2 lg:grid-cols-3">
              {CE_QUE_L_ON_Y_FAIT.map(([titre, texte]) => (
                <div key={titre} className="bg-white p-6">
                  <h3 className="text-lg font-extrabold text-[#1a1815]">{titre}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[#5e554f]">{texte}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <div>
              <h2 className="font-serif text-3xl sm:text-4xl leading-tight text-[#1a1815]">Un réseau de salles connectées.</h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-[#5e554f]">
                Chaque campus dispose d'une salle de conférence équipée : écran, caméra et micro de salle. Les étudiants
                s'y réunissent, le formateur les voit et leur donne la parole, campus par campus.
              </p>
            </div>
            <ul className="border-t-2 border-[#1a1815]">
              {sites.map((s) => (
                <li key={s.nom} className="flex items-center justify-between gap-4 border-b border-[#EADFD5] py-4">
                  <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1a1815]">{s.nom}</span>
                  <span className="font-['IBM_Plex_Mono',ui-monospace,monospace] text-xs sm:text-sm text-right text-[#6b625b]">{s.salle}</span>
                </li>
              ))}
            </ul>
          </div>

          {tuilesChiffres.length > 0 && (
            <dl className="mt-14 grid grid-cols-2 gap-6 rounded-3xl border border-[#EADFD5] p-6 sm:p-8 lg:grid-cols-4" data-testid="chiffres-campus">
              {tuilesChiffres.map(([n, libelle]) => (
                <div key={libelle}>
                  <dt className="sr-only">{libelle}</dt>
                  <dd className="font-['IBM_Plex_Mono',ui-monospace,monospace] text-3xl sm:text-4xl font-semibold text-[#1a1815]">
                    {n.toLocaleString("fr-FR")}
                  </dd>
                  <dd className="mt-1 text-[15px] text-[#6b625b]" aria-hidden="true">{libelle}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* Appel final */}
      <section className="gradient-bg text-white mobile-no-overflow">
        <div className="container mx-auto mobile-padding py-16 text-center lg:py-20">
          <figure>
            <blockquote className="mx-auto max-w-3xl font-serif text-3xl sm:text-5xl leading-tight">
              «&nbsp;À 2IAE, on n'apprend pas seulement assis en classe comme dans le passé&nbsp;: on apprend avec les
              nouvelles méthodologies, notamment l'intelligence artificielle.&nbsp;»
            </blockquote>
            <figcaption className={`${ETIQUETTE} mt-5 text-[#F0A868]`}>Séraphin Koua, fondateur du Groupe 2IAE</figcaption>
          </figure>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/preinscription" className={BOUTON_PRINCIPAL} data-testid="link-campus-cta-preinscription">
              Se préinscrire
            </Link>
            <LienCampus
              href={campusUrl}
              className="inline-flex min-h-[52px] items-center justify-center rounded-xl border-2 border-white/80 px-7 py-3 text-lg font-semibold text-white hover:bg-white/10"
              testId="link-campus-cta-acceder"
            >
              Accéder au campus
            </LienCampus>
          </div>
        </div>
      </section>
    </div>
  );
}
