// /le-direct : comment on suit un cours du campus numérique. Dans la salle de
// conférence de son campus, au téléphone (son et diapos, consommation
// honnête en Mo), à l'ordinateur ; l'aperçu de l'écran du cours ; l'assistant
// IA ; l'application installable et le hors-ligne ; avant le premier cours.
import type { ReactNode } from "react";
import { BellRing, Camera, Check, Download, KeyRound, Laptop, Presentation, Smartphone, Sparkles, WifiOff, X } from "lucide-react";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { cn } from "@/lib/utils";
import { useInstallation } from "@/modules/pwa/installation";
import { estInstallee, plateforme } from "@/modules/pwa/outils";
import { ApercuSalleLive } from "./ApercuSalleLive";
import { EnTetePagePublique, LienFleche, TitreSectionPublic } from "./composants";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { Telephones } from "./Telephones";
import { useTitreDocument } from "./outils";

type Mode = { icone: typeof Smartphone; titre: string; accroche: string; points: string[]; conso: string; fond: string; puce: string };

const MODES: Mode[] = [
  {
    icone: Presentation,
    titre: "Dans la salle de conférence de votre campus",
    accroche: "Le cours s'affiche sur grand écran, avec le son de la salle. Les étudiants suivent ensemble, comme en amphithéâtre.",
    points: [
      "Pour émarger, un code à 4 chiffres s'affiche à l'écran et change chaque minute.",
      "La salle lève la main : le formateur lui donne la parole.",
      "Le téléphone sert à poser des questions, voter et répondre aux sondages.",
    ],
    conso: "Moins de 5 Mo par heure sur le téléphone",
    fond: "bg-encre text-white",
    puce: "bg-orange text-encre",
  },
  {
    icone: Smartphone,
    titre: "Au téléphone",
    accroche: "Le mode « son + diapos » transmet la voix du formateur et ses diapositives, comme une radio. Il est pensé pour les forfaits prépayés.",
    points: [
      "Si le réseau coupe, l'écoute reprend toute seule, et le campus montre ce que vous avez raté.",
      "La vidéo reste possible quand le réseau et le forfait le permettent.",
      "Questions, main levée et sondages, comme dans la salle.",
    ],
    conso: "Son + diapos : environ 12 à 15 Mo par heure",
    fond: "bg-orange text-encre",
    puce: "bg-encre text-white",
  },
  {
    icone: Laptop,
    titre: "À l'ordinateur",
    accroche: "La classe complète dans le navigateur : la vidéo du formateur, ses diapositives en grand, les échanges.",
    points: ["Les questions votées, les sondages éclair, la main levée.", "Après le cours : le replay, la fiche de révision et la transcription.", "Rien à installer."],
    conso: "Vidéo : 150 à 250 Mo par heure",
    fond: "bg-creme text-encre",
    puce: "bg-orange text-encre",
  },
];

/** Consommation affichée honnêtement (CONCEPTION §9.14) et ce qu'elle représente pour 1 Go de forfait. */
const CONSOMMATION = [
  { mode: "En salle, téléphone pour voter", mo: "moins de 5 Mo", max: 5, parGo: "plus de 200 heures" },
  { mode: "Son + diapos", mo: "12 à 15 Mo", max: 15, parGo: "66 à 83 heures" },
  { mode: "Vidéo", mo: "150 à 250 Mo", max: 250, parGo: "4 à 6 heures" },
];

const IA_FAIT = [
  "Explique autrement une notion mal comprise.",
  "Résume l'essentiel d'une leçon et fait réviser avec des questions.",
  "Aide à comprendre un devoir, sans le faire à la place de l'étudiant.",
  "Dit de quelle leçon vient sa réponse.",
  "Prend ses exemples en Côte d'Ivoire.",
];
const IA_NE_FAIT_PAS = [
  "Il ne met jamais une note : le formateur décide.",
  "Il se met en pause pendant les interrogations.",
  "Il ne reçoit jamais le nom de l'étudiant.",
  "Il ne remplace pas le formateur : il prépare, le formateur valide.",
];

const ETAPES: { icone: typeof KeyRound; titre: string; texte: ReactNode }[] = [
  {
    icone: KeyRound,
    titre: "Se connecter avec sa fiche",
    texte: "La vie scolaire remet à chaque étudiant sa fiche de connexion : matricule, code provisoire et QR code. Le QR code ouvre le campus sans rien taper.",
  },
  { icone: Check, titre: "Choisir son code secret", texte: "Six caractères au moins, à ne donner à personne. Il remplace le code provisoire." },
  { icone: Download, titre: "Installer le campus", texte: "Sur l'écran d'accueil du téléphone : il s'ouvre comme une application et garde les pages consultées." },
  { icone: BellRing, titre: "Activer les rappels", texte: "Un rappel arrive 15 minutes avant chaque cours en direct." },
];

function CarteMode({ mode: m, rang }: { mode: Mode; rang: number }) {
  const Icone = m.icone;
  return (
    <article className={cn("flex flex-col gap-6 rounded-[28px] p-6 sm:p-8", m.fond)}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] opacity-75">{String(rang + 1).padStart(2, "0")}</span>
        <Icone className="h-7 w-7 opacity-85" aria-hidden />
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[28px]">{m.titre}</h3>
        <p className="text-[16px] leading-relaxed opacity-90">{m.accroche}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {m.points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-[15px] leading-snug">
            <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full", m.puce)}>
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            </span>
            <span className="opacity-90">{p}</span>
          </li>
        ))}
      </ul>
      <p className="mt-auto rounded-2xl bg-black/10 px-4 py-3 font-mono text-[13px]">{m.conso}</p>
    </article>
  );
}

export default function PageLeDirect() {
  useTitreDocument("Suivre un cours en direct · Campus numérique 2IAE");
  const { peutInstaller, installer } = useInstallation();

  return (
    <MiseEnPagePublique>
      <EnTetePagePublique
        fil={[{ libelle: "Le direct" }]}
        etiquette="Le direct"
        titre="Suivre un cours en direct."
        texte="Le formateur enseigne depuis l'endroit où il se trouve. Au même moment, les cinq salles de conférence et les étudiants connectés suivent le même cours. Chacun choisit sa façon de suivre, selon son réseau et son forfait."
        actions={
          <>
            <LienBouton href="/programme" taille="lg" className="min-h-[56px]">
              Voir l'emploi du temps
            </LienBouton>
            <LienBouton href="/connexion" variante="contour" taille="lg" className="min-h-[56px]">
              Accéder à mon campus
            </LienBouton>
          </>
        }
      />

      {/* Trois façons de suivre */}
      <section className="conteneur pb-14 sm:pb-20">
        <div className="grid gap-4 lg:grid-cols-3">
          {MODES.map((m, i) => (
            <CarteMode key={m.titre} mode={m} rang={i} />
          ))}
        </div>
      </section>

      {/* Ce que coûte un cours */}
      <section className="conteneur pb-14 sm:pb-20">
        <TitreSectionPublic
          etiquette="Chaque méga compte"
          titre="Ce que coûte une heure de cours."
          texte="Des estimations honnêtes, pour choisir en connaissance de cause. À la fin de chaque cours, le campus affiche aussi ce qu'il vous a coûté."
        />
        <div className="overflow-hidden rounded-[28px] border border-ligne">
          <div className="hidden grid-cols-[1.2fr_2fr_1fr] gap-6 bg-creme px-6 py-3 font-mono text-xs uppercase tracking-wider text-texte-gris md:grid">
            <span>Façon de suivre</span>
            <span>Par heure de cours</span>
            <span>Avec 1 Go de forfait</span>
          </div>
          <ul>
            {CONSOMMATION.map((c) => (
              <li key={c.mode} className="grid gap-3 border-t border-ligne px-5 py-5 first:border-t-0 sm:px-6 md:grid-cols-[1.2fr_2fr_1fr] md:items-center md:gap-6">
                <span className="text-lg font-extrabold">{c.mode}</span>
                <div className="flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-creme" role="img" aria-label={`${c.mo} par heure`}>
                    <div className="h-full rounded-full bg-orange" style={{ width: `${Math.max(2, (c.max / 250) * 100)}%` }} />
                  </div>
                  <span className="w-[112px] shrink-0 text-right font-mono text-sm font-semibold">{c.mo}</span>
                </div>
                <span className="text-[15px] text-texte-doux">
                  <span className="md:hidden">Avec 1 Go : </span>
                  {c.parGo}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Aperçu de l'écran du cours */}
      <section className="bg-nuit py-14 text-white sm:py-20">
        <div className="conteneur flex flex-col gap-8">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex max-w-2xl flex-col gap-2.5">
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">Aperçu · l'écran du cours</span>
              <h2 className="text-[30px] font-black leading-none tracking-serre text-white sm:text-[clamp(30px,3.6vw,48px)]">Voici la classe en direct.</h2>
            </div>
            <p className="max-w-[440px] text-base leading-normal text-nuit-doux">
              Le formateur voit les cinq salles, donne la parole et répond aux questions les plus votées. Essayez : votez pour une question, levez la main.
            </p>
          </div>
          <ApercuSalleLive />
          <p className="font-mono text-xs text-nuit-gris">Exemple d'écran : les questions et le résumé sont donnés à titre d'illustration.</p>
        </div>
      </section>

      {/* L'assistant IA */}
      <section className="conteneur py-14 sm:py-20">
        <TitreSectionPublic
          etiquette="L'assistant IA"
          titre="Un tuteur à toute heure. L'humain décide."
          texte="Chaque étudiant dispose d'un assistant qui s'appuie sur les leçons de ses cours. Il fait apprendre ; il ne fait pas le travail à la place."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-[28px] bg-orange-clair p-6 sm:p-8">
            <h3 className="flex items-center gap-2.5 text-xl font-extrabold">
              <Sparkles className="h-5 w-5 text-orange-fonce" aria-hidden /> Ce qu'il fait
            </h3>
            <ul className="flex flex-col gap-3">
              {IA_FAIT.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] leading-snug">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" strokeWidth={3} aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4 rounded-[28px] border border-ligne p-6 sm:p-8">
            <h3 className="flex items-center gap-2.5 text-xl font-extrabold">
              <X className="h-5 w-5 text-texte-gris" aria-hidden /> Ce qu'il ne fait pas
            </h3>
            <ul className="flex flex-col gap-3">
              {IA_NE_FAIT_PAS.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] leading-snug">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-texte-gris" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* L'application et le hors-ligne */}
      <section className="bg-creme py-14 sm:py-20">
        <div className="conteneur grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-5">
            <span className="etiquette">L'application</span>
            <h2 className="text-[36px] font-black leading-[.98] tracking-tres-serre sm:text-[clamp(36px,4.6vw,60px)]">Le campus dans la poche.</h2>
            <p className="max-w-[480px] text-[17px] leading-[1.55] text-texte-doux">
              Rien à télécharger dans un magasin d'applications : le campus s'installe depuis le navigateur, sur l'écran d'accueil du téléphone. Il reste
              léger et continue quand le réseau coupe.
            </p>
            <ul className="grid max-w-[540px] gap-3 sm:grid-cols-2">
              {[
                { icone: WifiOff, texte: "Les pages déjà consultées restent disponibles sans réseau" },
                { icone: Camera, texte: "Un devoir rendu en photo part tout seul au retour du réseau" },
                { icone: BellRing, texte: "Un rappel 15 minutes avant chaque cours en direct" },
                { icone: Smartphone, texte: "Pensé pour un téléphone simple et un forfait prépayé" },
              ].map(({ icone: Icone, texte }) => (
                <li key={texte} className="flex items-start gap-3 text-[15px] leading-snug">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-orange-fonce">
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
                <p className="max-w-[480px] rounded-2xl bg-white px-4 py-3 text-[15px] leading-relaxed text-texte-pale">
                  {plateforme() === "ios" ? (
                    <>
                      Sur iPhone : ouvrez le campus dans Safari, touchez <strong className="text-encre">Partager</strong> puis{" "}
                      <strong className="text-encre">« Sur l'écran d'accueil »</strong>.
                    </>
                  ) : (
                    <>
                      Sur Android : ouvrez le campus dans Chrome, touchez le menu <strong className="text-encre">⋮</strong> puis{" "}
                      <strong className="text-encre">« Ajouter à l'écran d'accueil »</strong>.
                    </>
                  )}
                </p>
              ))}
            {!estInstallee() && plateforme() !== "ios" && <LienFleche href="/android">Télécharger l'application Android (2 Mo)</LienFleche>}
          </div>
          <Telephones />
        </div>
      </section>

      {/* Avant le premier cours */}
      <section className="conteneur py-14 sm:py-20">
        <TitreSectionPublic etiquette="Pour les étudiants" titre="Avant le premier cours." lien={{ href: "/questions", libelle: "Questions fréquentes" }} />
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ETAPES.map(({ icone: Icone, titre, texte }, i) => (
            <li key={titre} className="flex flex-col gap-3 rounded-3xl border border-ligne p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-orange text-lg font-black text-encre">{i + 1}</span>
                <Icone className="h-5 w-5 text-texte-gris" aria-hidden />
              </div>
              <h3 className="text-lg font-extrabold">{titre}</h3>
              <p className="text-[15px] leading-relaxed text-texte-pale">{texte}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <LienBouton href="/connexion" taille="lg" className="min-h-[56px]">
            Me connecter au campus
          </LienBouton>
          <LienFleche href="/campus">Trouver la vie scolaire de mon campus</LienFleche>
        </div>
      </section>
    </MiseEnPagePublique>
  );
}
