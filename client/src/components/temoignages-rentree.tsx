// Les étudiants racontent leurs premiers jours de cours (rentrée 2026-2027),
// filmés à l'école à la troisième séance de la rentrée, et l'annonce du prochain cours en
// direct du campus numérique. Les citations sont reprises de leurs propres
// mots (transcription des vidéos), à peine resserrées ; leurs noms ne sont
// pas publiés : la transcription ne les restitue pas avec certitude.
// L'annonce du cours disparaît d'elle-même à la fin du cours.
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const N = " ";

const TEMOIGNAGES = [
  {
    video: "/videos/temoignage-etudiant-2026-1.mp4",
    poster: "/videos/temoignage-etudiant-2026-1-poster.jpg",
    citation: `L'IA est un très bon outil pour un étudiant, mais un mauvais maître : il ne faut pas l'utiliser pour faire nos devoirs à notre place.`,
    qui: "Étudiante en 2e année de BTS · Communication",
  },
  {
    video: "/videos/temoignage-etudiant-2026-2.mp4",
    poster: "/videos/temoignage-etudiant-2026-2-poster.jpg",
    citation: `J'ai connu Gemini, Claude et ChatGPT, et j'ai appris à bien les utiliser dans mes études et dans la vie quotidienne.`,
    qui: "Étudiant en 2e année de BTS · Finance comptabilité",
  },
  {
    video: "/videos/temoignage-etudiant-2026-3.mp4",
    poster: "/videos/temoignage-etudiant-2026-3-poster.jpg",
    citation: `Ça s'est très bien passé. Il a bien expliqué, on a fait beaucoup de choses. Merci d'avoir mis de bons professeurs.`,
    qui: "Étudiante en 1re année de BTS · Gestion commerciale",
  },
  {
    video: "/videos/temoignage-etudiant-2026-4.mp4",
    poster: "/videos/temoignage-etudiant-2026-4-poster.jpg",
    citation: `Pour avoir la bonne réponse, il faut poser la bonne question. Ici, on forme bien les étudiants : venez vous inscrire.`,
    qui: "Étudiant en 1re année · Agriculture tropicale, production végétale · Yamoussoukro",
  },
];

/** Prochain cours en direct : mercredi 7 octobre 2026, 8 h 30 – 10 h 30 (heure d'Abidjan = GMT). */
const FIN_COURS_ANGLAIS = new Date("2026-10-07T10:30:00Z");

function ProchainCours() {
  if (Date.now() >= FIN_COURS_ANGLAIS.getTime()) return null;
  return (
    <div className="mt-12 rounded-xl bg-[#0d2c54] text-white p-7 md:p-9 grid md:grid-cols-[auto_1fr] gap-7 items-start" data-testid="annonce-cours-anglais">
      <img
        src="/images/formateur-ben-anderson-k.jpg"
        alt="Ben Anderson K., consultant formateur en anglais des spécialités"
        className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover ring-4 ring-[#E8720C]"
        loading="lazy"
      />
      <div>
        <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-3">
          Prochain cours en direct · Mercredi 7{N}octobre · 8{N}h{N}30 – 10{N}h{N}30
        </p>
        <h3 className="font-serif text-2xl md:text-3xl leading-tight mb-1">Anglais professionnel et employabilité</h3>
        <p className="text-white/70 italic mb-5">Former les leaders de demain</p>
        <p className="font-semibold mb-2">Avec Ben Anderson K., consultant formateur en anglais des spécialités</p>
        <ul className="text-white/85 leading-relaxed space-y-1 mb-6 list-disc pl-5">
          <li>Inspecteur principal, option anglais professionnel</li>
          <li>Spécialiste de l'employabilité, conseiller technique du directeur général de l'Emploi depuis 2016</li>
          <li>Traducteur assermenté et interprète professionnel ; formateur en anglais opérationnel, notamment à l'ENA</li>
          <li>Directeur exécutif de la Chambre de commerce, d'industrie et d'innovation Israël – Côte d'Ivoire</li>
        </ul>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/preinscription">
            <Button className="bg-[#E8720C] hover:bg-[#c96208] text-white font-bold px-7 py-3 h-auto w-full sm:w-auto">Je m'inscris pour suivre les cours</Button>
          </Link>
          <Link href="/campus-numerique">
            <Button variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white font-semibold px-7 py-3 h-auto w-full sm:w-auto">
              L'emploi du temps du campus numérique
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function TemoignagesRentree() {
  return (
    <section className="py-16 bg-[#f7f3ee]" data-testid="section-temoignages-rentree">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="max-w-3xl mb-10">
          <p className="text-xs tracking-[0.25em] uppercase text-primary mb-3">Témoignages · Premiers jours de cours</p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight mb-4">Trois jours de cours. Ce qu'ils en disent.</h2>
          <p className="text-muted-foreground leading-relaxed">
            Intelligence artificielle, marketing digital : depuis le 28{N}septembre, nos étudiants suivent en direct, sur le campus numérique, des
            formateurs qui enseignent depuis l'étranger. L'une d'eux le résume :{" "}
            <span className="text-foreground font-medium">
              «{N}Des amis à moi vont débuter en novembre. Je pense qu'ils seront très en retard par rapport à nous.{N}»
            </span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {TEMOIGNAGES.map((t, i) => (
            <figure key={t.video} className="bg-white rounded-xl overflow-hidden shadow-sm border border-border flex flex-col" data-testid={`temoignage-rentree-${i + 1}`}>
              <video className="w-full aspect-video bg-black block" src={t.video} poster={t.poster} controls playsInline preload="none">
                Votre navigateur ne prend pas en charge la lecture vidéo.
              </video>
              <figcaption className="p-5 flex flex-col flex-1">
                <blockquote className="font-serif text-lg text-foreground leading-snug mb-3">«{N}{t.citation}{N}»</blockquote>
                <p className="text-sm text-muted-foreground mt-auto">{t.qui}</p>
              </figcaption>
            </figure>
          ))}
        </div>

        <ProchainCours />
      </div>
    </section>
  );
}
