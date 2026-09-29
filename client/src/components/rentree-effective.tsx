// La rentrée 2026-2027 est effective depuis le lundi 28 septembre 2026, et
// elle a commencé par le cours d'initiation à l'intelligence artificielle.
// Sources : la vidéo tournée le jour même (« l'IA est un outil d'aide à la
// décision », « on ne va pas revenir en arrière », cours hors programme
// offert par l'école), et l'emploi du temps officiel publié sur le campus
// numérique (campus.2iae.com/programme) : première session du 28 septembre
// au 10 octobre, intervenants et intitulés des cours. La liste des prochains
// cours est lue en direct sur le campus via /api/campus/programme : elle
// suit les annulations et disparaît quand il n'y a plus rien à venir.
//
// L'appel aux retardataires n'a de sens que pendant les premières semaines :
// la section disparaît d'elle-même à la date ci-dessous.
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

/** « 2026-09-30 » → « mercredi 30 septembre » (jour civil, sans fuseau). */
function jourEtDate(jour: string): string {
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return `${JOURS[d.getUTCDay()]} ${j === 1 ? "1er" : j} ${MOIS[m - 1]}`;
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
  const aVenir: OccurrenceCampus[] = programme.prochaines
    .filter((o) => o.statut !== "terminee")
    .slice(0, 5);
  if (!aVenir.length) return null;

  return (
    <div className="rounded-lg border border-border bg-[#faf7f3] p-5 mb-6" data-testid="liste-prochains-cours">
      <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">Les prochains cours</p>
      <ul className="divide-y divide-border">
        {aVenir.map((o) => {
          const c = creneaux.get(o.creneauId);
          const qui = [o.intervenant, c?.mention].filter(Boolean).join(" · ");
          return (
            <li key={`${o.creneauId}-${o.date}`} className="py-2.5 flex items-baseline gap-4">
              <span className="w-32 sm:w-40 shrink-0 text-sm text-muted-foreground first-letter:uppercase">
                {jourEtDate(o.date)}
                <span className="block text-xs">
                  {o.statut === "en_direct" ? "En direct" : heure(o.debut)}
                </span>
              </span>
              <span className="min-w-0">
                <span className={`block font-semibold text-foreground ${o.statut === "annulee" ? "line-through opacity-60" : ""}`}>
                  {o.libelle}
                  {o.statut === "annulee" ? " — annulé" : ""}
                </span>
                {qui && <span className="block text-sm text-muted-foreground">{qui}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <Link href="/campus-numerique">
        <span className="inline-block mt-3 text-sm font-semibold text-primary hover:underline cursor-pointer">
          Tout l'emploi du temps du campus numérique →
        </span>
      </Link>
    </div>
  );
}

export function RentreeEffective() {
  if (!rentreeEffectiveActive()) return null;
  return (
    <section className="py-14 bg-white" data-testid="section-rentree-effective">
      <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-2 gap-10 items-start">
        <div className="lg:sticky lg:top-24 rounded-xl overflow-hidden shadow-2xl ring-4 ring-[#E8720C]/60">
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
            et fondateur de Markel Technology.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Premier conseil aux étudiants : l'IA est un outil d'aide à la
            décision. On ne lui confie pas tout.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Le même cours, au même moment, dans tous nos campus : chaque salle
            de conférence le suit sur grand écran, lève la main, et le
            formateur lui donne la parole. Au programme de cette première
            session, jusqu'au 10 octobre : l'initiation à l'IA avec deux
            consultants, l'un canadien, l'autre allemand ; le marketing
            digital avec Claude Trépanier, président de Rhizoviva System, à
            Montréal ; et un séminaire chaque samedi.
          </p>

          <ProchainsCours />

          <div className="bg-[#fff4ea] border-l-4 border-[#E8720C] rounded-r-lg p-5 mb-6">
            <p className="font-serif text-xl text-foreground mb-2">
              Encore à la maison{N}?
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Le cours d'IA ne figure pas au programme du BTS : l'école l'offre
              à ses étudiants. Il a commencé lundi, et on ne reviendra pas en
              arrière. Chaque jour à la maison est un cours manqué —
              inscrivez-vous et venez prendre votre place.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/preinscription">
              <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-8 py-3 h-auto w-full sm:w-auto" data-testid="button-rentree-inscription">
                Je m'inscris maintenant
              </Button>
            </Link>
            <Link href="/tarifs">
              <Button variant="outline" className="font-semibold px-8 py-3 h-auto w-full sm:w-auto">
                Les tarifs — paiement échelonné
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
