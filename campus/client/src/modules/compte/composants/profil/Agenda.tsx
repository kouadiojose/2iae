// Abonnement à l'agenda personnel (.ics, module agenda) : les lives et les
// échéances apparaissent tout seuls dans Google Agenda ou le calendrier du
// téléphone. Le lien est personnel : on peut en changer s'il a fuité.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Squelette } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import type { Moi } from "@shared/schema";
import { tuOuVous } from "../../outils";
import { Section } from "./Section";

/** GET /api/agenda/abonnement (module agenda). */
type AbonnementAgenda = { url: string; webcal: string; google: string };

const AIDE_GOOGLE = "https://support.google.com/calendar/answer/37100?hl=fr";

async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    // Anciens navigateurs ou page non sécurisée : sélection manuelle.
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.opacity = "0";
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand("copy");
    zone.remove();
    return ok;
  }
}

export function Agenda({ moi }: { moi: Moi }) {
  const t = tuOuVous(moi);
  const { data, isLoading, isError, refetch } = useQuery<AbonnementAgenda>({ queryKey: ["/api/agenda/abonnement"], retry: false, staleTime: 5 * 60_000 });
  const [copie, setCopie] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function copierLien() {
    if (!data) return;
    if (await copier(data.url)) {
      setCopie(true);
      toast("Lien copié.");
      setTimeout(() => setCopie(false), 2500);
    } else toast(t("Copie impossible : sélectionne le lien et copie-le.", "Copie impossible : sélectionnez le lien et copiez-le."), "erreur");
  }

  async function renouveler() {
    setEnvoi(true);
    try {
      queryClient.setQueryData(["/api/agenda/abonnement"], await post<AbonnementAgenda>("/api/agenda/abonnement/renouveler"));
      toast(t("Nouveau lien créé. Abonne-toi à nouveau avec lui.", "Nouveau lien créé. Abonnez-vous à nouveau avec lui."));
      setConfirmer(false);
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Une erreur est survenue.", "erreur");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Section
      id="agenda"
      titre="Mon agenda sur le téléphone"
      icone={<CalendarPlus className="h-5 w-5" />}
      description={t(
        "Tes cours en direct et tes dates de devoirs s'ajoutent tout seuls à Google Agenda ou au calendrier de ton téléphone.",
        "Vos séances et échéances s'ajoutent toutes seules à votre agenda (Google, Outlook, iPhone).",
      )}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Squelette className="h-12" />
          <Squelette className="h-12" />
        </div>
      ) : isError || !data ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-creme px-4 py-3.5">
          <p className="text-[15px] text-texte-doux">{t("Le lien d'agenda n'est pas disponible pour le moment.", "Le lien d'agenda n'est pas disponible pour le moment.")}</p>
          <Bouton variante="contour" taille="sm" onClick={() => void refetch()} className="min-h-[44px]">
            Réessayer
          </Bouton>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <LienBouton href={data.google} externe variante="encre" taille="lg" icone={<ExternalLink className="h-5 w-5" />} className="min-h-[52px] w-full sm:w-auto sm:self-start">
            Ajouter à Google Agenda
          </LienBouton>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lien-agenda" className="text-sm font-bold">
              {t("Ou copie ton lien personnel", "Ou copiez votre lien personnel")}
            </label>
            <div className="flex gap-2">
              <input
                id="lien-agenda"
                readOnly
                value={data.url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-h-[52px] min-w-0 flex-1 truncate rounded-xl border border-ligne bg-creme px-3 font-mono text-[13px] text-texte-doux outline-none focus:border-orange"
              />
              <Bouton variante="contour" onClick={() => void copierLien()} icone={copie ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} className="min-h-[52px] shrink-0">
                {copie ? "Copié" : "Copier"}
              </Bouton>
            </div>
          </div>
          <ul className="flex flex-col gap-1 text-[14px] text-texte-pale">
            <li>
              {t("Sur iPhone :", "Sur iPhone :")}{" "}
              <a href={data.webcal} className="font-bold">
                ouvrir dans Calendrier
              </a>
            </li>
            <li>
              {t("Besoin d'aide ?", "Besoin d'aide ?")}{" "}
              <a href={AIDE_GOOGLE} target="_blank" rel="noopener noreferrer" className="font-bold">
                S'abonner à un agenda dans Google Agenda
              </a>
            </li>
          </ul>
          <div className="rounded-2xl border border-dashed border-ligne p-3.5 text-[14px] text-texte-pale">
            {confirmer ? (
              <div className="flex flex-col gap-3">
                <p>{t("L'ancien lien cessera de marcher, partout où tu l'as ajouté. Continuer ?", "L'ancien lien cessera de fonctionner partout où il a été ajouté. Continuer ?")}</p>
                <div className="flex flex-wrap gap-2">
                  <Bouton variante="encre" taille="sm" chargement={envoi} onClick={() => void renouveler()} className="min-h-[44px]">
                    Oui, créer un nouveau lien
                  </Bouton>
                  <Bouton variante="fantome" taille="sm" onClick={() => setConfirmer(false)} className="min-h-[44px]">
                    Annuler
                  </Bouton>
                </div>
              </div>
            ) : (
              <p>
                {t("Ce lien est personnel : ne le partage pas.", "Ce lien est personnel : ne le partagez pas.")}{" "}
                <button type="button" onClick={() => setConfirmer(true)} className="inline-flex min-h-[44px] items-center gap-1 font-bold text-orange-fonce hover:text-encre">
                  <RefreshCw className="h-3.5 w-3.5" /> {t("Changer de lien", "Changer de lien")}
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
