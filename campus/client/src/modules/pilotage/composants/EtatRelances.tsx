// État des relances automatiques d'un étudiant, dans « Qui décroche ? » :
// « Relancé le 9 oct. (rappel) · revenu le 10 ✓ » ou « 2 relances sans
// effet : à appeler », et l'historique des relances à la demande (vouvoiement).
// Le nombre de relances est celui qui est vraiment parti (le serveur le compte
// depuis son dernier acte) : une simulation de l'essai n'en est pas une.
import { useState } from "react";
import { BellRing, ChevronDown, PhoneCall } from "lucide-react";
import type { EtatRelanceEtudiant, LigneRelance } from "@shared/engagement/relances";
import { t } from "@shared/textes/relances";
import { formaterDate } from "@shared/textes";
import { cn } from "@/lib/utils";

const vous = { registre: "vous" as const };
const court = (iso: string) => formaterDate(iso, { style: "court" });
/** Jour d'une ligne (« AAAA-MM-JJ ») en « 9 oct. », sans décalage de fuseau. */
const jourCourt = (jour: string) => formaterDate(`${jour}T12:00:00Z`, { style: "court" });

function LigneHistorique({ l }: { l: LigneRelance }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-[13px] leading-snug">
      <span className="font-mono text-texte-gris">{jourCourt(l.jour)}</span>
      <span className="font-semibold text-encre">{t(`motif.${l.motif}`, vous)}</span>
      <span className="text-texte-pale">
        {t(`canal.${l.canal}`, vous)} · {t(`statut.${l.statut}`, vous)}
        {l.ouvertLe ? " · ouvert" : ""}
        {l.revenuLe ? ` · ${t("etat.revenu", { ...vous, v: { jour: court(l.revenuLe) } })}` : ""}
      </span>
    </li>
  );
}

export function EtatRelances({ etat }: { etat: EtatRelanceEtudiant }) {
  const [ouvert, setOuvert] = useState(false);
  const d = etat.derniere;
  if (!d && !etat.historique.length) return null;
  const essai = d?.statut === "simulation";
  const n = etat.relancesParties ?? 0;

  let resume: string | null = null;
  if (d && etat.etat === "a_appeler") {
    resume = essai
      ? t("etat.a_appeler.essai", vous)
      : n === 0
        ? t("etat.a_appeler.aucune", vous)
        : n === 1
          ? t("etat.a_appeler.un", vous)
          : t("etat.a_appeler", { ...vous, v: { n } });
  } else if (d) {
    const debut = t(essai ? "etat.relance.essai" : "etat.relance", { ...vous, v: { jour: jourCourt(d.jour), canal: t(`canal.${d.canal}`, vous) } });
    resume = `${debut} · ${d.revenuLe ? t("etat.revenu", { ...vous, v: { jour: court(d.revenuLe) } }) : etat.etat === "revenu" ? t("etat.revenu.depuis", vous) : t("etat.attente", vous)}`;
  }

  return (
    <div className="mt-3 rounded-xl bg-creme px-3 py-2.5">
      {resume && (
        <p className={cn("flex items-start gap-2 text-[14px] font-semibold leading-snug", etat.etat === "a_appeler" ? "text-danger" : etat.etat === "revenu" ? "text-succes" : "text-texte-doux")}>
          {etat.etat === "a_appeler" ? <PhoneCall className="mt-0.5 h-4 w-4 shrink-0" /> : <BellRing className="mt-0.5 h-4 w-4 shrink-0" />}
          {resume}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[13px] font-bold text-orange-fonce hover:text-encre"
      >
        {ouvert ? t("etat.historique.masquer", vous) : t("etat.historique", vous)}
        <ChevronDown className={cn("h-4 w-4 transition-transform", ouvert && "rotate-180")} />
      </button>
      {ouvert && (
        <ul className="mt-1 flex flex-col gap-1.5 pb-1">
          {etat.historique.length ? etat.historique.map((l) => <LigneHistorique key={l.id} l={l} />) : <li className="text-[13px] text-texte-pale">{t("etat.historique.vide", vous)}</li>}
        </ul>
      )}
    </div>
  );
}
