// « Les salles du jour », pour qu'on la trouve (José, 13 octobre 2026 : « je ne vois pas là où envoyer le message
// whatsapp »). Trois entrées vers /pilotage/salles :
//   - CarteActionSalles : en haut du tableau de la direction, les jours où il reste des liens à envoyer (ou des
//     écrans à préparer) ; toute la carte est un bouton ;
//   - CarteLienSalles : la petite carte d'avant, à sa place, les autres jours ;
//   - CarteCasquetteSalles : sur l'accueil du formateur dont l'autre casquette est la direction ; un toucher le fait
//     passer en Direction et ouvre directement la page.
// Les nombres viennent d'un compte léger, sans aucun lien d'écran (CompteSallesDuJour) ; les messages déjà marqués
// « Envoyé » depuis ce navigateur (repères de la page) sont retirés du compte.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, MessageCircle, MonitorSmartphone, Repeat } from "lucide-react";
import type { CompteSallesDuJour } from "@shared/salles";
import { t as textesSalles } from "@shared/textes/salles";
import { CarteLien } from "@/components/ui/carte";
import { toast } from "@/components/ui/toast";
import { basculerCasquette } from "@/lib/auth";
import { useTextes } from "@/lib/textes";

export const PAGE_SALLES = "/pilotage/salles";

/** Messages du jour pas encore marqués « Envoyé » dans ce navigateur. */
function restantsAEnvoyer(c: CompteSallesDuJour): number {
  try {
    return c.envois.filter((cle) => localStorage.getItem(cle) !== "1").length;
  } catch {
    return c.messages;
  }
}

export type EtatSallesDuJour = { restants: number; aPreparer: number; aFaire: boolean; charge: boolean };

/**
 * Le compte du jour (url : /api/pilotage/salles-du-jour/compte pour l'équipe, /api/casquette/salles-du-jour pour un
 * formateur à double casquette). aFaire : des liens restent à envoyer, ou des écrans à préparer.
 */
export function useSallesDuJour(url: string, actif: boolean): EtatSallesDuJour {
  const { data, isSuccess, isError } = useQuery<CompteSallesDuJour>({ queryKey: [url], enabled: actif, staleTime: 30_000, refetchInterval: 5 * 60_000 });
  const restants = data ? restantsAEnvoyer(data) : 0;
  const aPreparer = data?.aPreparer ?? 0;
  return { restants, aPreparer, aFaire: restants + aPreparer > 0, charge: isSuccess || isError };
}

/** Tableau de la direction, en haut : « 10 liens de salles à envoyer aujourd'hui ». */
export function CarteActionSalles({ restants, aPreparer }: { restants: number; aPreparer: number }) {
  const tx = useTextes(textesSalles);
  const titre = restants
    ? restants === 1
      ? tx("action.titre.un")
      : tx("action.titre", { v: { n: restants } })
    : aPreparer === 1
      ? tx("action.titre.aPreparer.un")
      : tx("action.titre.aPreparer", { v: { n: aPreparer } });
  return (
    <Link
      href={PAGE_SALLES}
      aria-label={`${titre}. ${restants ? tx("action.bouton") : tx("action.bouton.aPreparer")}`}
      className="group flex flex-col gap-4 rounded-[24px] border-2 border-orange bg-orange-pale p-5 text-encre no-underline transition-colors hover:bg-orange-clair hover:text-encre sm:flex-row sm:items-center sm:gap-6 sm:p-7"
    >
      <span className="flex min-w-0 flex-1 items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-orange text-encre" aria-hidden>
          {restants ? <MessageCircle className="h-7 w-7" /> : <MonitorSmartphone className="h-7 w-7" />}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wider text-orange-profond">{tx("action.etiquette")}</span>
          <span className="text-[22px] font-black leading-tight tracking-serre sm:text-[28px]">{titre}</span>
          {restants > 0 && <span className="text-[16px] leading-snug text-texte-doux">{tx("action.texte")}</span>}
          {restants > 0 && aPreparer > 0 && (
            <span className="text-[15px] font-semibold leading-snug text-alerte">
              {aPreparer === 1 ? tx("action.aPreparer.un") : tx("action.aPreparer", { v: { n: aPreparer } })}
            </span>
          )}
        </span>
      </span>
      <span className="inline-flex min-h-[56px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[14px] bg-encre px-4 text-[16px] font-bold text-white transition-colors group-hover:bg-orange group-hover:text-encre min-[400px]:px-6 min-[400px]:text-[17px]">
        {restants ? tx("action.bouton") : tx("action.bouton.aPreparer")} <ArrowRight className="h-5 w-5" aria-hidden />
      </span>
    </Link>
  );
}

/** La petite carte d'avant, à sa place dans le tableau, les jours où il n'y a rien à envoyer. */
export function CarteLienSalles() {
  const tx = useTextes(textesSalles);
  return (
    <CarteLien href={PAGE_SALLES} className="flex min-h-[64px] items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">
        <MonitorSmartphone className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-extrabold">{tx("jour.lien")}</span>
        <span className="text-[13px] text-texte-gris">{tx("jour.lien.texte")}</span>
      </span>
      <ArrowRight className="ml-auto h-5 w-5 shrink-0" />
    </CarteLien>
  );
}

/**
 * Accueil du formateur dont l'autre casquette est la direction : « Les liens des salles du jour · Passez en Direction
 * pour les envoyer sur WhatsApp ». Un toucher : il passe en Direction et arrive sur la page (pas sur le tableau).
 */
export function CarteCasquetteSalles({ restants, aPreparer }: { restants: number; aPreparer: number }) {
  const tx = useTextes(textesSalles);
  const [envoi, setEnvoi] = useState(false);
  const compte = [
    restants ? (restants === 1 ? tx("casquette.carte.compte.un") : tx("casquette.carte.compte", { v: { n: restants } })) : null,
    aPreparer ? (aPreparer === 1 ? tx("casquette.carte.aPreparer.un") : tx("casquette.carte.aPreparer", { v: { n: aPreparer } })) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      disabled={envoi}
      onClick={() => {
        setEnvoi(true);
        basculerCasquette(PAGE_SALLES).catch((e) => {
          setEnvoi(false);
          toast((e as Error).message, "erreur");
        });
      }}
      className="flex min-h-[76px] w-full items-center gap-3.5 rounded-2xl border-2 border-orange bg-orange-pale px-4 py-3.5 text-left text-encre transition-colors hover:bg-orange-clair disabled:opacity-60"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange text-encre" aria-hidden>
        <MessageCircle className="h-6 w-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[17px] font-extrabold leading-snug">{tx("casquette.carte.titre")}</span>
        <span className="text-[15px] leading-snug text-texte-doux">{tx("casquette.carte.texte")}</span>
        {compte && <span className="text-[14px] font-bold leading-snug text-orange-profond">{compte}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-encre px-3 py-2.5 text-[15px] font-bold text-white" aria-hidden>
        <Repeat className="h-5 w-5" />
        <span className="hidden min-[440px]:inline">{tx("casquette.carte.bouton")}</span>
      </span>
    </button>
  );
}
