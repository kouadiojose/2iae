// /android : l'application Android du campus. Un bouton pour télécharger
// l'APK (2 Mo), les trois écrans qu'Android montre pendant l'installation,
// dessinés tels qu'ils apparaissent, ce que l'application apporte, et le
// partage sur WhatsApp. Sur ordinateur : un QR code à scanner avec le
// téléphone. Dans l'application elle-même : « vous y êtes déjà ».
import type { ReactNode } from "react";
import { BellRing, CheckCircle2, Download, Link2, MessageCircle, RefreshCw, ShieldCheck, Smartphone, Zap } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { cn } from "@/lib/utils";
import { Qr } from "@/modules/pilotage/composants/Qr";
import { APPLICATION_ANDROID as APP } from "@/modules/pwa/android";
import { estApplicationAndroid, plateforme } from "@/modules/pwa/outils";
import { EnTetePagePublique, LienFleche, TitreSectionPublic } from "./composants";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { useTitreDocument } from "./outils";

const MESSAGE_PARTAGE = `Installe l'application du campus numérique 2IAE sur ton téléphone Android : ${APP.pageComplete}`;

/** Une boîte de dialogue Android, dessinée : le bouton à toucher est entouré d'orange. */
function Dialogue({ icone, titre, texte, boutons, choix }: { icone?: ReactNode; titre?: string; texte: string; boutons: string[]; choix: string }) {
  return (
    <div className="rounded-[26px] bg-[#EEF0F4] p-3" aria-hidden>
      <div className="flex flex-col gap-3 rounded-[20px] bg-white px-5 pb-3.5 pt-5 shadow-sm">
        {icone && <div className="flex justify-center">{icone}</div>}
        {titre && <p className="text-center text-[15px] font-bold text-encre">{titre}</p>}
        <p className="text-[13.5px] leading-snug text-[#44474E]">{texte}</p>
        <div className="flex flex-wrap justify-end gap-1">
          {boutons.map((b) => (
            <span
              key={b}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-bold text-[#1B5FC1]",
                b === choix && "bg-orange-pale text-encre ring-2 ring-orange ring-offset-1",
              )}
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function IconeApp({ taille = 52 }: { taille?: number }) {
  return <img src="/icons/icone-192.png" alt="" width={taille} height={taille} className="rounded-[14px] shadow-carte" style={{ width: taille, height: taille }} />;
}

const ETAPES: { titre: string; texte: ReactNode; ecran: ReactNode }[] = [
  {
    titre: "Télécharger",
    texte: (
      <>
        Touchez <strong className="text-encre">« Télécharger l'application »</strong>. Si Chrome vous demande une confirmation, touchez{" "}
        <strong className="text-encre">« Télécharger quand même »</strong>.
      </>
    ),
    ecran: (
      <Dialogue
        texte="Ce type de fichier peut endommager votre appareil. Voulez-vous quand même télécharger Campus-2IAE.apk ?"
        boutons={["Annuler", "Télécharger quand même"]}
        choix="Télécharger quand même"
      />
    ),
  },
  {
    titre: "Autoriser",
    texte: (
      <>
        Touchez <strong className="text-encre">« Ouvrir »</strong>. La première fois, Android demande d'autoriser Chrome : touchez{" "}
        <strong className="text-encre">« Paramètres »</strong>, activez <strong className="text-encre">« Autoriser cette source »</strong>, puis revenez en arrière.
      </>
    ),
    ecran: (
      <Dialogue
        texte="Pour votre sécurité, votre téléphone n'est pas autorisé à installer des applications inconnues provenant de cette source."
        boutons={["Annuler", "Paramètres"]}
        choix="Paramètres"
      />
    ),
  },
  {
    titre: "Installer",
    texte: (
      <>
        Touchez <strong className="text-encre">« Installer »</strong>. Si Play Protect affiche un message, laissez-le analyser l'application ou touchez{" "}
        <strong className="text-encre">« Installer quand même »</strong>.
      </>
    ),
    ecran: <Dialogue icone={<IconeApp />} titre="Campus 2IAE" texte="Voulez-vous installer cette application ?" boutons={["Annuler", "Installer"]} choix="Installer" />,
  },
];

const AVANTAGES: { icone: typeof Zap; titre: string; texte: string }[] = [
  { icone: Zap, titre: "S'ouvre d'un toucher", texte: "L'icône Campus 2IAE est avec vos applications. Pas de barre d'adresse, pas de lien à retrouver." },
  { icone: BellRing, titre: "Les rappels des cours", texte: "Une notification la veille, puis 15 minutes avant chaque cours en direct, et à chaque nouveau devoir." },
  { icone: Link2, titre: "Les liens s'ouvrent dedans", texte: "Un lien du campus reçu sur WhatsApp ouvre directement l'application." },
  { icone: RefreshCw, titre: "Toujours à jour", texte: "L'application se met à jour toute seule, avec le campus. Rien à retélécharger." },
  { icone: Smartphone, titre: "Légère", texte: `${APP.taille} à télécharger. Le mode « son + diapos » consomme environ 12 à 15 Mo par heure de cours.` },
  { icone: ShieldCheck, titre: "Signée par 2IAE", texte: "Elle n'ouvre que campus.2iae.com, avec votre compte habituel. Elle ne lit ni vos contacts ni vos fichiers." },
];

const QUESTIONS: { q: string; r: ReactNode }[] = [
  {
    q: "Faut-il un compte ?",
    r: "Oui : le même que sur le site. Si vous êtes déjà connecté dans Chrome, l'application vous reconnaît. Sinon, connectez-vous avec votre code étudiant ou votre e-mail.",
  },
  {
    q: "Pourquoi n'est-elle pas sur le Play Store ?",
    r: "Elle le sera. En attendant, l'installation directe depuis campus.2iae.com donne exactement la même application, signée par 2IAE.",
  },
  {
    q: "Il faut Chrome ?",
    r: "Oui, à jour. Il est déjà sur presque tous les téléphones Android. Sans Chrome, le campus s'ouvre quand même, dans le navigateur du téléphone.",
  },
  {
    q: "Et sur iPhone ?",
    r: (
      <>
        Pas de téléchargement : ouvrez campus.2iae.com dans Safari, touchez <strong className="text-encre">Partager</strong> puis{" "}
        <strong className="text-encre">« Sur l'écran d'accueil »</strong>. Le campus s'installe comme une application.
      </>
    ),
  },
];

function BlocTelechargement() {
  const p = plateforme();
  if (estApplicationAndroid())
    return (
      <div className="flex max-w-[560px] items-start gap-3 rounded-2xl bg-[#E4F5EA] px-5 py-4 text-[16px] leading-snug text-[#1F5A36]">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <p>
          <strong>Vous êtes déjà dans l'application.</strong> Pour la partager, envoyez le lien ci-dessous sur WhatsApp.
        </p>
      </div>
    );
  if (p === "ordinateur")
    return (
      <div className="flex max-w-[620px] flex-col gap-5 rounded-3xl border border-ligne bg-white p-5 sm:flex-row sm:items-center">
        <Qr texte={APP.pageComplete} titre="QR code de la page de l'application Android" className="h-40 w-40 shrink-0 self-center" />
        <div className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-tight">Scannez avec votre téléphone Android.</p>
          <p className="text-[15px] leading-relaxed text-texte-pale">
            Ouvrez l'appareil photo, visez le QR code : cette page s'ouvre sur le téléphone, avec le bouton de téléchargement.
          </p>
          <p className="font-mono text-sm text-orange-fonce">campus.2iae.com/android</p>
          <a href={APP.apk} download className="inline-flex min-h-[40px] items-center gap-1.5 self-start text-[14px] font-bold text-texte-doux hover:text-encre">
            <Download className="h-4 w-4" aria-hidden /> Ou télécharger le fichier APK ({APP.taille}) pour le partager
          </a>
        </div>
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <LienBouton href={APP.apk} telecharger taille="lg" className="min-h-[60px] self-start text-[17px]" icone={<Download className="h-5 w-5" />}>
        Télécharger l'application
      </LienBouton>
      <p className="font-mono text-[13px] text-texte-gris">
        {APP.taille} · version {APP.version} · {APP.androidMinimum} et plus
      </p>
      {p === "ios" && (
        <p className="max-w-[520px] rounded-2xl bg-creme px-4 py-3 text-[15px] leading-relaxed text-texte-pale">
          Vous êtes sur iPhone : ce fichier ne s'installe que sur Android. Sur iPhone, touchez <strong className="text-encre">Partager</strong> dans Safari puis{" "}
          <strong className="text-encre">« Sur l'écran d'accueil »</strong>.
        </p>
      )}
    </div>
  );
}

export default function PageAndroid() {
  useTitreDocument("L'application Android · Campus numérique 2IAE");
  const p = plateforme();

  return (
    <MiseEnPagePublique>
      <EnTetePagePublique
        fil={[{ libelle: "Application Android" }]}
        etiquette="Application Android"
        titre="Le campus dans votre téléphone."
        texte="Les cours en direct, les devoirs, les replays et les messages de vos formateurs, dans une application qui s'ouvre d'un toucher. Gratuite, légère, pensée pour les forfaits prépayés."
      >
        <BlocTelechargement />
      </EnTetePagePublique>

      {/* Les trois étapes */}
      <section className="bg-creme py-14 sm:py-20">
        <div className="conteneur">
          <TitreSectionPublic
            etiquette="Installation"
            titre="Trois étapes, une minute."
            texte="Android montre ces écrans pendant l'installation. Le bouton à toucher est entouré d'orange."
          />
          <ol className="grid gap-5 md:grid-cols-3">
            {ETAPES.map((e, i) => (
              <li key={e.titre} className="flex flex-col gap-4 rounded-3xl bg-white p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-orange text-lg font-black text-encre">{i + 1}</span>
                  <h3 className="text-xl font-extrabold">{e.titre}</h3>
                </div>
                <p className="text-[15px] leading-relaxed text-texte-pale">{e.texte}</p>
                <div className="mt-auto">{e.ecran}</div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex items-center gap-4 rounded-3xl bg-encre px-5 py-4 text-white sm:px-6">
            <IconeApp taille={48} />
            <p className="text-[15px] leading-snug text-nuit-doux">
              <strong className="text-white">C'est fait.</strong> L'icône <strong className="text-white">Campus 2IAE</strong> est avec vos applications. À la première
              ouverture, connectez-vous puis acceptez les notifications : vous recevrez les rappels des cours.
            </p>
          </div>
        </div>
      </section>

      {/* Ce que l'application apporte */}
      <section className="conteneur py-14 sm:py-20">
        <TitreSectionPublic etiquette="Pourquoi l'installer" titre="Tout le campus, plus vite." />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AVANTAGES.map(({ icone: Icone, titre, texte }) => (
            <li key={titre} className="flex flex-col gap-2.5 rounded-3xl border border-ligne p-5 sm:p-6">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-pale text-orange-fonce">
                <Icone className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-lg font-extrabold">{titre}</h3>
              <p className="text-[15px] leading-relaxed text-texte-pale">{texte}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Questions et partage */}
      <section className="conteneur grid gap-8 pb-16 sm:pb-24 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <TitreSectionPublic etiquette="Questions" titre="Bon à savoir." className="mb-5" />
          <dl className="flex flex-col divide-y divide-ligne border-y border-ligne">
            {QUESTIONS.map(({ q, r }) => (
              <div key={q} className="flex flex-col gap-1.5 py-4">
                <dt className="text-[17px] font-extrabold">{q}</dt>
                <dd className="text-[15px] leading-relaxed text-texte-pale">{r}</dd>
              </div>
            ))}
          </dl>
          <LienFleche href="/questions" className="mt-3">
            Toutes les questions fréquentes
          </LienFleche>
        </div>
        <aside className="flex flex-col gap-4 self-start rounded-3xl bg-orange p-6 text-encre">
          <MessageCircle className="h-8 w-8" aria-hidden />
          <h2 className="text-[26px] font-black leading-none tracking-serre">Partagez-la à votre classe.</h2>
          <p className="text-[15px] leading-relaxed">Un message WhatsApp suffit : le lien ouvre cette page, avec le bouton de téléchargement.</p>
          <LienBouton href={`https://wa.me/?text=${encodeURIComponent(MESSAGE_PARTAGE)}`} externe variante="encre" taille="lg" className="min-h-[56px] self-start">
            Partager sur WhatsApp
          </LienBouton>
          {p !== "ordinateur" && <p className="font-mono text-sm">campus.2iae.com/android</p>}
        </aside>
      </section>
    </MiseEnPagePublique>
  );
}
