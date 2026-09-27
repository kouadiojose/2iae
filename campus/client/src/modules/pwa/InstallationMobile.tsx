// Sur téléphone, le campus propose de lui-même son installation sur l'écran
// d'accueil, comme sur l'ordinateur : une feuille qui monte du bas de l'écran,
// quelques secondes après l'ouverture, pour toute personne connectée.
//
//   - Android (Chrome, Edge) : un bouton, la fenêtre système s'ouvre ;
//   - iPhone (Safari, Chrome) : le geste exact, illustré (Partager → « Sur
//     l'écran d'accueil ») ;
//   - navigateur intégré (lien ouvert depuis WhatsApp, Facebook…) : on ne peut
//     pas installer d'ici ; la feuille explique comment ouvrir le campus dans
//     Safari ou Chrome, et copie le lien.
//
// « Plus tard » est retenu 7 jours ; jamais pendant un live (coquille plein écran).
import { useEffect, useState } from "react";
import { Download, Share, X, Copy, MoreVertical, MoreHorizontal, PlusSquare, Bell, Wifi, Zap } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import { toast } from "@/components/ui/toast";
import { useInstallation } from "./installation";
import { formuler, plateforme, lireLocal, ecrireLocal } from "./outils";

export const CLE_REFUS_INSTALLATION = "campus:installation-refusee";
export const RELANCE_INSTALLATION_MS = 7 * 86_400_000;
const CLE_SESSION = "campus:installation-proposee";

export function installationRefuseeRecemment(): boolean {
  const t = Number(lireLocal(CLE_REFUS_INSTALLATION) || 0);
  return t > 0 && Date.now() - t < RELANCE_INSTALLATION_MS;
}

type Contexte = "android" | "ios-safari" | "ios-chrome" | "integre-ios" | "integre-android";

/** Où la personne se trouve : le geste d'installation en dépend. */
export function contexteInstallation(): Contexte | null {
  const p = plateforme();
  if (p === "ordinateur" || typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const integre = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|TikTok|MicroMessenger/i.test(ua);
  if (p === "android") return integre || /; wv\)/.test(ua) ? "integre-android" : "android";
  // Sur iPhone, un navigateur intégré (WKWebView) n'annonce pas « Safari/ ».
  if (integre || !/Safari\//.test(ua)) return "integre-ios";
  return /CriOS|EdgiOS|FxiOS/.test(ua) ? "ios-chrome" : "ios-safari";
}

function Etape({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] leading-snug">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange text-sm font-extrabold text-encre">{n}</span>
      <span className="flex flex-wrap items-center gap-1.5 pt-1">{children}</span>
    </li>
  );
}

const Touche = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-grid h-7 min-w-7 place-items-center rounded-lg border border-ligne bg-white px-1 text-encre shadow-sm">{children}</span>
);

/** Le geste à faire, selon le téléphone et le navigateur. */
export function EtapesInstallation({ contexte, tu }: { contexte: Contexte; tu: boolean }) {
  const f = (a: string, b: string) => (tu ? a : b);
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopie(true);
      toast(f("Lien copié : colle-le dans Safari ou Chrome.", "Lien copié : collez-le dans Safari ou Chrome."));
    } catch {
      toast(window.location.origin);
    }
  };
  if (contexte === "ios-safari")
    return (
      <ol className="flex flex-col gap-2.5">
        <Etape n={1}>
          {f("Touche", "Touchez")} <Touche><Share className="h-4 w-4" /></Touche> Partager, en bas de l'écran.
          <span className="basis-full text-[13px] text-texte-gris">
            {f("Tu ne le vois pas ? Touche d'abord", "Vous ne le voyez pas ? Touchez d'abord")} <Touche><MoreHorizontal className="h-3.5 w-3.5" /></Touche> {f("en bas à droite.", "en bas à droite.")}
          </span>
        </Etape>
        <Etape n={2}>
          {f("Descends et choisis", "Descendez et choisissez")} <Touche><PlusSquare className="h-4 w-4" /></Touche> « Sur l'écran d'accueil ».
        </Etape>
        <Etape n={3}>{f("Touche « Ajouter » : l'icône 2IAE apparaît avec tes applications.", "Touchez « Ajouter » : l'icône 2IAE apparaît avec vos applications.")}</Etape>
      </ol>
    );
  if (contexte === "ios-chrome")
    return (
      <ol className="flex flex-col gap-2.5">
        <Etape n={1}>
          {f("Touche", "Touchez")} <Touche><Share className="h-4 w-4" /></Touche> Partager, {f("en haut à droite, dans la barre d'adresse.", "en haut à droite, dans la barre d'adresse.")}
        </Etape>
        <Etape n={2}>
          {f("Choisis", "Choisissez")} <Touche><PlusSquare className="h-4 w-4" /></Touche> « Sur l'écran d'accueil ».
        </Etape>
        <Etape n={3}>{f("Touche « Ajouter » : c'est fait.", "Touchez « Ajouter » : c'est fait.")}</Etape>
      </ol>
    );
  if (contexte === "android")
    return (
      <ol className="flex flex-col gap-2.5">
        <Etape n={1}>
          {f("Touche le menu", "Touchez le menu")} <Touche><MoreVertical className="h-4 w-4" /></Touche> {f("en haut à droite de Chrome.", "en haut à droite de Chrome.")}
        </Etape>
        <Etape n={2}>{f("Choisis « Installer l'application » (ou « Ajouter à l'écran d'accueil »).", "Choisissez « Installer l'application » (ou « Ajouter à l'écran d'accueil »).")}</Etape>
        <Etape n={3}>{f("Confirme : l'icône 2IAE apparaît avec tes applications.", "Confirmez : l'icône 2IAE apparaît avec vos applications.")}</Etape>
      </ol>
    );
  // Navigateur intégré : il faut d'abord ouvrir le campus dans le vrai navigateur du téléphone.
  const navigateur = contexte === "integre-ios" ? "Safari" : "Chrome";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-snug text-texte-doux">
        {f(
          `Tu as ouvert le campus depuis une application (WhatsApp, Facebook…). Pour l'installer, ouvre-le dans ${navigateur} :`,
          `Vous avez ouvert le campus depuis une application (WhatsApp, Facebook…). Pour l'installer, ouvrez-le dans ${navigateur} :`,
        )}
      </p>
      <ol className="flex flex-col gap-2.5">
        <Etape n={1}>
          {f("Touche", "Touchez")} <Touche>{contexte === "integre-ios" ? <MoreHorizontal className="h-4 w-4" /> : <MoreVertical className="h-4 w-4" />}</Touche>
          {f(` (ou l'icône de boussole), puis « Ouvrir dans ${navigateur} ».`, ` (ou l'icône de boussole), puis « Ouvrir dans ${navigateur} ».`)}
        </Etape>
        <Etape n={2}>{f("Le campus s'ouvre et te propose de l'installer.", "Le campus s'ouvre et vous propose de l'installer.")}</Etape>
      </ol>
      <Bouton variante="contour" className="min-h-[48px] self-start" icone={<Copy className="h-4 w-4" />} onClick={() => void copier()}>
        {copie ? "Lien copié" : f(`Copier le lien pour ${navigateur}`, `Copier le lien pour ${navigateur}`)}
      </Bouton>
    </div>
  );
}

/** La feuille d'installation, montée par la coquille des pages connectées (hors live). */
export function InstallationMobile() {
  const { moi } = useMoi();
  const { peutInstaller, installee, installer } = useInstallation();
  const [ouverte, setOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const contexte = contexteInstallation();
  const tu = moi?.role === "etudiant";
  const f = (a: string, b: string) => formuler(moi?.role, a, b);

  useEffect(() => {
    if (!moi || !contexte || installee || installationRefuseeRecemment()) return;
    try {
      if (window.sessionStorage.getItem(CLE_SESSION)) return;
    } catch {
      /* stockage indisponible : on propose quand même */
    }
    const t = window.setTimeout(() => setOuverte(true), 3500);
    return () => window.clearTimeout(t);
  }, [moi, contexte, installee]);

  if (!ouverte || !contexte || installee) return null;

  const fermer = (refus: boolean) => {
    setOuverte(false);
    try {
      window.sessionStorage.setItem(CLE_SESSION, "1");
    } catch {
      /* rien */
    }
    if (refus) ecrireLocal(CLE_REFUS_INSTALLATION, String(Date.now()));
  };
  const lancer = async () => {
    setEnCours(true);
    try {
      if (await installer()) {
        toast(f("Le campus est sur ton écran d'accueil.", "Le campus est sur votre écran d'accueil."));
        fermer(false);
      }
    } finally {
      setEnCours(false);
    }
  };
  const boutonSysteme = contexte === "android" && peutInstaller;

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-encre/40" role="dialog" aria-modal="true" aria-labelledby="titre-installation" onClick={() => fermer(false)}>
      <section
        className="relative w-full max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-2xl animate-monte"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ligne" aria-hidden />
        <button type="button" onClick={() => fermer(false)} className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full text-texte-pale hover:bg-creme hover:text-encre" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-4 pr-10">
          <img src="/icons/icone-192.png" alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-[18px] shadow-carte" />
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-orange-fonce">Application</p>
            <h2 id="titre-installation" className="font-sans text-[21px] font-extrabold leading-tight tracking-serre text-encre">
              {f("Installe le campus 2IAE sur ton téléphone", "Installez le campus 2IAE sur votre téléphone")}
            </h2>
          </div>
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-2 text-center text-[12.5px] leading-tight text-texte-doux">
          <li className="flex flex-col items-center gap-1.5 rounded-2xl bg-creme px-2 py-3">
            <Zap className="h-5 w-5 text-orange-fonce" aria-hidden /> S'ouvre d'un toucher
          </li>
          <li className="flex flex-col items-center gap-1.5 rounded-2xl bg-creme px-2 py-3">
            <Bell className="h-5 w-5 text-orange-fonce" aria-hidden /> Rappels avant chaque cours
          </li>
          <li className="flex flex-col items-center gap-1.5 rounded-2xl bg-creme px-2 py-3">
            <Wifi className="h-5 w-5 text-orange-fonce" aria-hidden /> Marche avec un petit réseau
          </li>
        </ul>
        <div className={cn("mt-5", !boutonSysteme && "rounded-2xl border border-ligne p-4")}>
          {boutonSysteme ? (
            <Bouton taille="lg" pleineLargeur icone={<Download className="h-5 w-5" />} chargement={enCours} onClick={() => void lancer()}>
              Installer le campus
            </Bouton>
          ) : (
            <EtapesInstallation contexte={contexte} tu={tu} />
          )}
        </div>
        <div className="mt-3 flex justify-center">
          <Bouton variante="fantome" onClick={() => fermer(true)} className="min-h-[48px]">
            Plus tard
          </Bouton>
        </div>
      </section>
    </div>
  );
}
