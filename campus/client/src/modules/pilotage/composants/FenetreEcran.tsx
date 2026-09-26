// « Installer l'écran de la salle » d'un campus : sur l'ordinateur branché à
// l'écran de la salle de conférence, ouvrir l'adresse courte et taper le code
// de 8 caractères (ou ouvrir le lien reçu). L'ordinateur reste ensuite connecté.
// Chaque ouverture de la fenêtre prépare un nouveau code : le précédent ne
// marche plus.
import { useEffect, useRef, useState } from "react";
import { Copy, MessageCircle, Link2, MonitorSmartphone, TriangleAlert } from "lucide-react";
import type { InstallationEcran } from "@shared/lancement";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Erreur, Squelette } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { post, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { heure, jourLong } from "@/lib/dates";
import { Qr } from "./Qr";
import { copier } from "../outils";

export function FenetreEcran({ site, onFermer }: { site: { id: number; nom: string } | null; onFermer: () => void }) {
  const [inst, setInst] = useState<InstallationEcran | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const demande = useRef<number | null>(null);

  useEffect(() => {
    if (!site) {
      demande.current = null;
      return;
    }
    if (demande.current === site.id) return;
    demande.current = site.id;
    setInst(null);
    setErreur(null);
    post<InstallationEcran>(`/api/pilotage/sites/${site.id}/ecran`)
      .then((r) => {
        setInst(r);
        void rafraichir("/api/pilotage/rentree", "/api/pilotage/comptes");
      })
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : "Une erreur est survenue. Réessayez dans un instant."));
  }, [site]);

  if (!site) return null;
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      large
      titre={`Installer l'écran · ${site.nom}`}
      description="À faire une fois, sur l'ordinateur branché à l'écran de la salle de conférence. Il reste ensuite connecté."
      pied={
        inst ? (
          <>
            <Bouton variante="contour" icone={<Copy className="h-4 w-4" />} onClick={async () => toast((await copier(inst.message)) ? "Instructions copiées" : "Copie impossible : sélectionnez le texte à la main.", "info")}>
              Copier les instructions
            </Bouton>
            <a
              href={inst.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange px-5 py-3 text-[15px] font-bold text-encre no-underline hover:bg-encre hover:text-white"
            >
              <MessageCircle className="h-4 w-4" />
              Envoyer sur WhatsApp
            </a>
          </>
        ) : undefined
      }
    >
      {erreur ? (
        <Erreur message={erreur} />
      ) : !inst ? (
        <div className="flex flex-col gap-3 pb-2" aria-busy="true">
          <Squelette className="h-32" />
          <Squelette className="h-16" />
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <ol className="flex flex-col gap-4">
            <li className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange font-black text-encre">1</span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold">Sur l'ordinateur de la salle, ouvrez cette adresse :</p>
                <p className="mt-1 break-all font-mono text-lg font-semibold text-encre">{inst.adresseCourte}</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange font-black text-encre">2</span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold">Tapez le code :</p>
                <p className="mt-1 font-mono text-[36px] font-bold leading-none tracking-[0.12em] tabular-nums sm:text-[44px]" aria-label={`Code ${inst.code.split("").join(" ")}`}>
                  {inst.code.slice(0, 4)}
                  <span className="text-texte-gris"> </span>
                  {inst.code.slice(4)}
                </p>
                <p className="mt-1.5 text-sm text-texte-pale">Lettres et chiffres, sans 0, O, 1, I ni L : aucune confusion possible.</p>
                <p className="mt-2 text-sm text-texte-pale">
                  Valable jusqu'au {jourLong(inst.expireLe)} à {heure(inst.expireLe)} (heure d'Abidjan), une seule fois.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-creme font-black text-encre">
                <MonitorSmartphone className="h-4 w-4" />
              </span>
              <p className="text-[15px] text-texte-doux">
                C'est tout : l'écran de <strong>{inst.salle}</strong> affiche aussitôt le prochain cours. Laissez la page ouverte, il restera connecté les jours suivants.
              </p>
            </li>
          </ol>

          <div className="flex flex-col gap-4 rounded-2xl bg-creme p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="etiquette">Ou le lien direct</div>
              <p className="mt-1.5 break-all font-mono text-[13px] leading-snug">{inst.lien}</p>
              <button
                type="button"
                onClick={async () => toast((await copier(inst.lien)) ? "Lien copié" : "Copie impossible : sélectionnez le lien à la main.", "info")}
                className="mt-1 flex min-h-[44px] items-center gap-2 text-[15px] font-bold text-orange-fonce hover:text-encre"
              >
                <Link2 className="h-4 w-4" /> Copier le lien
              </button>
            </div>
            <Qr texte={inst.lien} className="w-28 shrink-0 self-center rounded-xl bg-white p-2" titre="QR du lien d'installation" />
          </div>

          {!inst.nouveau && (
            <p className="flex items-start gap-2 rounded-xl bg-alerte-clair px-4 py-3 text-sm text-alerte">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Les codes préparés avant celui-ci ne marchent plus. Un écran déjà installé reste connecté.
            </p>
          )}
        </div>
      )}
    </Fenetre>
  );
}
