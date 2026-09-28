// « Installer l'écran de la salle » d'un campus : sur l'ordinateur branché à
// l'écran de la salle de conférence, ouvrir l'adresse courte et taper le code
// de 8 caractères (ou ouvrir le lien reçu). L'ordinateur reste ensuite connecté.
// Le lien et le code sont permanents et réutilisables (un ordinateur de salle
// peut changer) : la fenêtre réaffiche ceux en place. « Changer le lien et le
// code » en prépare de nouveaux ; les anciens ne marchent plus.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle, Link2, MonitorSmartphone, RefreshCw, TriangleAlert } from "lucide-react";
import type { EtatEcranSalle, InstallationEcran } from "@shared/lancement";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Erreur, Squelette } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { post, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { jourLong } from "@/lib/dates";
import { Qr } from "./Qr";
import { copier } from "../outils";

export function FenetreEcran({ site, onFermer }: { site: { id: number; nom: string } | null; onFermer: () => void }) {
  const etat = useQuery<EtatEcranSalle>({ queryKey: [`/api/pilotage/sites/${site?.id}/ecran`], enabled: Boolean(site), staleTime: 0 });
  const [neuf, setNeuf] = useState<InstallationEcran | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const inst = neuf && neuf.siteId === site?.id ? neuf : (etat.data?.installation ?? null);

  const preparer = async () => {
    if (!site) return;
    setEnvoi(true);
    setErreurEnvoi(null);
    try {
      const r = await post<InstallationEcran>(`/api/pilotage/sites/${site.id}/ecran`);
      setNeuf(r);
      setConfirmer(false);
      void rafraichir("/api/pilotage/rentree", "/api/pilotage/comptes", `/api/pilotage/sites/${site.id}/ecran`);
    } catch (e) {
      setErreurEnvoi(e instanceof ErreurApi ? e.message : "Une erreur est survenue. Réessayez dans un instant.");
    } finally {
      setEnvoi(false);
    }
  };
  const fermer = () => {
    setNeuf(null);
    setConfirmer(false);
    setErreurEnvoi(null);
    onFermer();
  };

  if (!site) return null;
  return (
    <Fenetre
      ouverte
      onFermer={fermer}
      large
      titre={`Installer l'écran · ${site.nom}`}
      description="Sur l'ordinateur branché à l'écran de la salle de conférence. Le lien et le code restent valables : ils réinstallent l'écran sur un nouvel ordinateur si besoin."
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
      {etat.isError || erreurEnvoi ? (
        <Erreur message={erreurEnvoi ?? (etat.error as Error).message} />
      ) : etat.isLoading ? (
        <div className="flex flex-col gap-3 pb-2" aria-busy="true">
          <Squelette className="h-32" />
          <Squelette className="h-16" />
        </div>
      ) : !inst ? (
        <div className="flex flex-col items-start gap-4 pb-2">
          <p className="text-[15px] leading-relaxed text-texte-doux">
            Aucun lien d'installation n'est en place pour cette salle. Préparez-en un : il restera valable, sur autant d'ordinateurs que nécessaire.
          </p>
          <Bouton taille="lg" chargement={envoi} onClick={() => void preparer()} icone={<MonitorSmartphone className="h-5 w-5" />}>
            Préparer le lien et le code
          </Bouton>
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
                <p className="mt-2 text-sm text-texte-pale">Sans date limite, sur autant d'ordinateurs que nécessaire. En place depuis le {jourLong(inst.depuis)}.</p>
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

          {neuf && !neuf.nouveau ? (
            <p className="flex items-start gap-2 rounded-xl bg-alerte-clair px-4 py-3 text-sm text-alerte">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Nouveau lien et nouveau code : les précédents ne marchent plus. Les écrans déjà installés restent connectés.
            </p>
          ) : confirmer ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-alerte/40 bg-alerte-clair p-4">
              <p className="flex items-start gap-2 text-sm text-alerte">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Le lien et le code actuels ne marcheront plus, pour personne. À faire seulement s'ils ont circulé au-delà des responsables de la salle. Les
                écrans déjà installés restent connectés.
              </p>
              <div className="flex flex-wrap gap-2">
                <Bouton variante="danger" chargement={envoi} onClick={() => void preparer()}>
                  Oui, changer le lien et le code
                </Bouton>
                <Bouton variante="fantome" onClick={() => setConfirmer(false)}>
                  Garder ceux-ci
                </Bouton>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmer(true)}
              className="flex min-h-[44px] items-center gap-2 self-start text-sm font-bold text-texte-pale hover:text-encre"
            >
              <RefreshCw className="h-4 w-4" /> Changer le lien et le code
            </button>
          )}
        </div>
      )}
    </Fenetre>
  );
}
