// Page affichée sans réseau quand l'écran demandé n'a jamais été ouvert sur
// ce téléphone (le service worker n'a donc rien gardé pour lui). Chargée avec
// l'application (jamais à la demande) : elle doit s'afficher hors ligne.
import { useEffect, useState } from "react";
import { WifiOff, RotateCw } from "lucide-react";
import { Marque } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";

/** Page demandée au départ (?page=/cours/3), limitée aux adresses du campus. */
function pageDemandee(): string | null {
  const page = new URLSearchParams(window.location.search).get("page");
  return page && page.startsWith("/") && !page.startsWith("//") && !page.startsWith("/hors-ligne") ? page : null;
}

export default function PageHorsLigne() {
  const [enLigne, setEnLigne] = useState(() => navigator.onLine);
  const cible = pageDemandee();

  const reessayer = () => {
    if (cible) window.location.assign(cible);
    else window.location.reload();
  };

  useEffect(() => {
    const on = () => setEnLigne(true);
    const off = () => setEnLigne(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="border-b border-ligne-douce">
        <div className="conteneur py-3">
          <Marque />
        </div>
      </header>
      <main className="conteneur flex flex-1 flex-col items-center justify-center gap-5 py-12 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-creme text-orange-fonce">
          <WifiOff className="h-9 w-9" aria-hidden />
        </span>
        <span className="etiquette">{enLigne ? "Le réseau revient" : "Hors ligne"}</span>
        <h1 className="max-w-md text-[32px] font-black leading-[1.05] tracking-serre sm:text-[40px]">
          {enLigne ? "Le réseau est revenu." : "Pas de réseau pour le moment."}
        </h1>
        <p className="max-w-md text-[17px] leading-relaxed text-texte-doux">
          {enLigne
            ? "La page peut maintenant s'ouvrir."
            : "Cette page n'est pas encore enregistrée sur ce téléphone. Elle s'ouvrira dès que le réseau revient."}
        </p>
        {!enLigne && (
          <p className="max-w-md rounded-2xl bg-creme px-5 py-4 text-[15px] leading-relaxed text-texte-pale">
            Les pages déjà consultées (accueil, cours, devoirs) restent disponibles sans réseau. Un devoir ou un message écrit maintenant partira tout seul au retour de la connexion.
          </p>
        )}
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Bouton taille="lg" pleineLargeur icone={<RotateCw className="h-5 w-5" />} onClick={reessayer}>
            {enLigne ? "Ouvrir la page" : "Réessayer"}
          </Bouton>
          <LienBouton href="/accueil" variante="contour" taille="lg" className="w-full">
            Revenir à l'accueil
          </LienBouton>
        </div>
      </main>
    </div>
  );
}
