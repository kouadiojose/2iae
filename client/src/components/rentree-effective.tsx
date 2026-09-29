// La rentrée 2026-2027 est effective depuis le lundi 28 septembre 2026, et
// elle a commencé par le cours d'initiation à l'intelligence artificielle.
// Sources : la vidéo tournée le jour même (« l'IA est un outil d'aide à la
// décision », « on ne va pas revenir en arrière », cours hors programme
// offert par l'école), et l'emploi du temps officiel publié sur le campus
// numérique (campus.2iae.com/programme). Les prochains cours sont lus en
// direct via /api/campus/programme : ils suivent les annulations et
// disparaissent quand il n'y a plus rien à venir.
//
// Trois étages : la vidéo et l'essentiel côte à côte, les prochains cours
// en cartes sur toute la largeur, puis l'appel aux retardataires en bandeau.
// L'appel n'a de sens que pendant les premières semaines : la section
// disparaît d'elle-même à la date ci-dessous.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useProgrammeCampus } from "@/components/emploi-du-temps-campus";
import type { OccurrenceCampus, CreneauCampus } from "@shared/campus";

const FIN_APPEL_RENTREE = new Date("2026-11-01T00:00:00Z");
const N = " ";

export function rentreeEffectiveActive(): boolean {
  return Date.now() < FIN_APPEL_RENTREE.getTime();
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-09-30 » → { jour: « mercredi », date: « 30 septembre » } (jour civil, sans fuseau). */
function jourEtDate(jour: string): { jour: string; date: string } {
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return { jour: JOURS[d.getUTCDay()], date: `${j === 1 ? "1er" : j}${N}${MOIS[m - 1]}` };
}

/** « 2026-09-30T13:00:00.000Z » → « 13 h » ; « …08:30… » → « 8 h 30 » (Abidjan = UTC). */
function heure(iso: string): string {
  const h = Number(iso.slice(11, 13));
  const mn = iso.slice(14, 16);
  return mn === "00" ? `${h}${N}h` : `${h}${N}h${N}${mn}`;
}

function ProchainsCours() {
  const { programme } = useProgrammeCampus();
  if (!programme) return null;
  const creneaux = new Map<number, CreneauCampus>();
  for (const s of programme.sessions) for (const c of s.creneaux) creneaux.set(c.id, c);
  const aVenir: OccurrenceCampus[] = programme.prochaines.filter((o) => o.statut !== "terminee").slice(0, 4);
  if (!aVenir.length) return null;

  return (
    <div className="mt-12" data-testid="liste-prochains-cours">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 mb-5">
        <p className="text-xs tracking-[0.25em] uppercase text-primary">Les prochains cours</p>
        <Link href="/campus-numerique">
          <span className="text-sm font-semibold text-primary hover:underline cursor-pointer">
            Tout l'emploi du temps du campus numérique →
          </span>
        </Link>
      </div>
      <ul className="-mx-4 px-4 scroll-px-4 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible">
        {aVenir.map((o) => {
          const c = creneaux.get(o.creneauId);
          const { jour, date } = jourEtDate(o.date);
          const annule = o.statut === "annulee";
          return (
            <li
              key={`${o.creneauId}-${o.date}`}
              className="snap-start shrink-0 w-[78%] sm:w-[46%] md:w-auto rounded-xl border border-border bg-white p-5 flex flex-col"
              style={{ boxShadow: `inset 0 4px 0 ${c?.cours?.couleur ?? "#E8720C"}` }}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{jour}</p>
              <p className="font-serif text-2xl text-foreground leading-tight mt-1">{date}</p>
              <p className="text-sm text-muted-foreground mb-4">{o.statut === "en_direct" ? "En direct" : heure(o.debut)}</p>
              <p className={`font-semibold text-foreground leading-snug mt-auto ${annule ? "line-through opacity-60" : ""}`}>
                {o.libelle}
                {annule ? " — annulé" : ""}
              </p>
              {(o.intervenant || c?.mention) && (
                <p className="text-sm text-muted-foreground mt-1">
                  {o.intervenant}
                  {o.intervenant && c?.mention ? <span className="block text-xs">{c.mention}</span> : c?.mention}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RentreeEffective() {
  if (!rentreeEffectiveActive()) return null;
  return (
    <section className="py-16 bg-white" data-testid="section-rentree-effective">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* 1. La vidéo et l'essentiel, côte à côte */}
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="rounded-xl overflow-hidden shadow-2xl ring-4 ring-[#E8720C]/60">
            <video
              className="w-full h-auto block bg-black aspect-video"
              src="/videos/rentree-2026-cours-ia.mp4"
              poster="/videos/rentree-2026-cours-ia-poster.jpg"
              controls
              playsInline
              preload="none"
              data-testid="video-rentree-effective"
            >
              Votre navigateur ne prend pas en charge la lecture vidéo.
            </video>
          </div>

          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">
              Rentrée 2026-2027 · Effective depuis le{N}28{N}septembre
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-5 leading-tight">
              Les cours ont repris.
              <span className="block text-primary">Par l'intelligence artificielle.</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Lundi 28 septembre à 8{N}h{N}30, les étudiants de première et de
              deuxième année de BTS ont repris les cours. Le premier : une
              initiation à l'intelligence artificielle, donnée en direct sur
              notre campus numérique par José Kouadio, ingénieur logiciel senior
              et fondateur de Markel Technology. Le même cours, au même moment,
              dans tous nos campus.
            </p>
            <p className="border-l-4 border-[#E8720C] pl-4 text-foreground font-medium leading-relaxed">
              Premier conseil aux étudiants : l'IA est un outil d'aide à la
              décision. On ne lui confie pas tout.
            </p>
          </div>
        </div>

        {/* 2. Les prochains cours, lus en direct sur le campus numérique */}
        <ProchainsCours />

        {/* 3. L'appel aux retardataires */}
        <div className="mt-12 bg-[#E8720C] rounded-xl p-7 md:p-8 flex flex-col md:flex-row md:items-center gap-6" data-testid="bandeau-retardataires">
          <div className="flex-1">
            <p className="font-serif text-2xl md:text-3xl text-white mb-2">Encore à la maison{N}?</p>
            <p className="text-white/90 leading-relaxed max-w-2xl">
              Le cours d'IA ne figure pas au programme du BTS : l'école l'offre à
              ses étudiants. Il a commencé lundi, et on ne reviendra pas en
              arrière. Chaque jour à la maison est un cours manqué.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <Link href="/preinscription">
              <Button className="bg-white text-[#E8720C] hover:bg-white/90 font-bold px-8 py-3 h-auto w-full" data-testid="button-rentree-inscription">
                Je m'inscris maintenant
              </Button>
            </Link>
            <Link href="/tarifs">
              <Button variant="outline" className="border-white/70 bg-transparent text-white hover:bg-white/10 hover:text-white font-semibold px-8 py-3 h-auto w-full">
                Les tarifs — paiement échelonné
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
