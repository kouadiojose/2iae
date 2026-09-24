// Invitation à installer le campus sur l'écran d'accueil du téléphone (PWA).
//
// Chrome Android : bouton « Installer » (fenêtre système gardée par
// installation.ts). Sinon, le geste à faire : menu ⋮ « Ajouter à l'écran
// d'accueil » (Android) ou Partager « Sur l'écran d'accueil » (iPhone).
// « Plus tard » est retenu 30 jours sur le téléphone.
import { useState } from "react";
import { Download, MoreVertical, Share, X } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { Bouton } from "@/components/ui/bouton";
import { toast } from "@/components/ui/toast";
import { useInstallation } from "./installation";
import { formuler, plateforme, lireLocal, ecrireLocal } from "./outils";

const CLE_REFUS = "campus:installation-refusee";
const RELANCE_MS = 30 * 86_400_000;

function refusRecent(): boolean {
  const t = Number(lireLocal(CLE_REFUS) || 0);
  return t > 0 && Date.now() - t < RELANCE_MS;
}

export function InviteInstallation() {
  const { moi } = useMoi();
  const f = (tu: string, vous: string) => formuler(moi?.role, tu, vous);
  const { peutInstaller, installee, installer } = useInstallation();
  const [refuse, setRefuse] = useState(refusRecent);
  const [enCours, setEnCours] = useState(false);
  const p = plateforme();

  if (installee || refuse) return null;
  // Sur ordinateur, on ne propose l'installation que si le navigateur sait la faire.
  if (!peutInstaller && p === "ordinateur") return null;

  const plusTard = () => {
    ecrireLocal(CLE_REFUS, String(Date.now()));
    setRefuse(true);
  };

  async function lancer() {
    setEnCours(true);
    try {
      const ok = await installer();
      if (ok) toast(f("Le campus est sur ton écran d'accueil.", "Le campus est sur votre écran d'accueil."));
      else plusTard();
    } finally {
      setEnCours(false);
    }
  }

  const etapes =
    p === "ios"
      ? [
          { icone: <Share className="h-4 w-4" />, texte: f("Touche Partager, en bas de Safari.", "Touchez Partager, en bas de Safari.") },
          { icone: null, texte: f("Choisis « Sur l'écran d'accueil ».", "Choisissez « Sur l'écran d'accueil ».") },
          { icone: null, texte: f("Touche « Ajouter » : l'icône 2IAE apparaît.", "Touchez « Ajouter » : l'icône 2IAE apparaît.") },
        ]
      : [
          { icone: <MoreVertical className="h-4 w-4" />, texte: f("Touche le menu ⋮ en haut à droite de Chrome.", "Touchez le menu ⋮ en haut à droite de Chrome.") },
          { icone: null, texte: f("Choisis « Ajouter à l'écran d'accueil » (ou « Installer l'application »).", "Choisissez « Ajouter à l'écran d'accueil » (ou « Installer l'application »).") },
          { icone: null, texte: f("Confirme : l'icône 2IAE apparaît avec tes autres applications.", "Confirmez : l'icône 2IAE apparaît avec vos autres applications.") },
        ];

  return (
    <section className="relative flex flex-col gap-4 rounded-2xl border border-ligne bg-creme p-5" aria-label="Installer le campus">
      <button type="button" onClick={plusTard} className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full text-texte-pale hover:bg-white hover:text-encre" aria-label="Plus tard">
        <X className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-4 pr-10">
        <img src="/icons/icone-192.png" alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-[16px] shadow-carte" />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-lg font-extrabold leading-tight">{f("Mets le campus sur ton écran d'accueil", "Mettez le campus sur votre écran d'accueil")}</h3>
          <p className="text-[15px] leading-snug text-texte-pale">
            Il s'ouvre d'un toucher, comme une application, même avec un petit réseau.
          </p>
        </div>
      </div>

      {peutInstaller ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Bouton taille="lg" pleineLargeur className="sm:w-auto" icone={<Download className="h-5 w-5" />} chargement={enCours} onClick={() => void lancer()}>
            Installer le campus
          </Bouton>
          <Bouton taille="lg" variante="fantome" className="sm:w-auto" onClick={plusTard}>
            Plus tard
          </Bouton>
        </div>
      ) : (
        <>
          <ol className="flex flex-col gap-2.5">
            {etapes.map((e, i) => (
              <li key={i} className="flex items-start gap-3 text-base">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange text-sm font-extrabold text-encre">{i + 1}</span>
                <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {e.texte}
                  {e.icone && <span className="inline-grid h-6 w-6 place-items-center rounded-md border border-ligne bg-white text-encre">{e.icone}</span>}
                </span>
              </li>
            ))}
          </ol>
          <Bouton variante="contour" className="min-h-[48px] self-start" onClick={plusTard}>
            C'est fait, merci
          </Bouton>
        </>
      )}
    </section>
  );
}
