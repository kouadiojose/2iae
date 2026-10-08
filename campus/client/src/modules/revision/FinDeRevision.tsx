// Fin de la révision : « 4/5 · prochaine révision demain », « Encore 5 cartes »,
// ce que l'étudiant vient de gagner (C5) et l'invitation aux rappels (C3), chacun
// sous une limite silencieuse : s'ils plantent, l'écran reste.
import { RotateCcw, CloudOff, CheckCircle2, Users } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { LimiteSilencieuse } from "@/components/ui/limite-silencieuse";
import { useTextes } from "@/lib/textes";
import { formaterDate } from "@shared/textes";
import { t } from "@shared/textes/revision";
import type { Jour } from "@shared/engagement/calendrier";
// Emplacements du plan d'engagement (campus/ENGAGEMENT.md), remplis par C5 et C3.
import { GainDuJour } from "@/modules/progression/GainDuJour";
import { ProposerRappel } from "@/modules/rappels/ProposerRappel";

export function FinDeRevision({
  bonnes,
  total,
  prochaine,
  demain,
  encore,
  onEncore,
  defiReleve,
  envoi,
  enAttente,
  onFermer,
  libelleFermer,
}: {
  bonnes: number;
  total: number;
  prochaine: Jour;
  demain: boolean;
  /** Cartes d'avance qui restent dans le paquet (« Encore 5 cartes »). */
  encore: number;
  onEncore: () => void;
  defiReleve: boolean;
  envoi: "envoi" | "envoye" | "en_file" | "rien";
  enAttente: number;
  onFermer: () => void;
  libelleFermer: string;
}) {
  const tx = useTextes(t);
  const message = bonnes >= total - (total > 3 ? 1 : 0) ? tx("fin.bravo") : bonnes >= total / 2 ? tx("fin.bien") : tx("fin.courage");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 rounded-3xl bg-creme px-5 py-7 text-center" role="status">
        <span className="font-mono text-xs uppercase tracking-wider text-texte-gris">{tx("fin.etiquette")}</span>
        <p className="text-5xl font-black tabular-nums tracking-serre">
          {bonnes}
          <span className="text-2xl text-texte-gris">/{total}</span>
        </p>
        <p className="text-[17px] font-bold">
          {demain ? tx("fin.demain") : tx("fin.prochaine", { v: { jour: formaterDate(`${prochaine}T12:00:00Z`, { style: "jour" }) } })}
        </p>
        <p className="max-w-sm text-[15px] leading-relaxed text-texte-doux">{message}</p>
      </div>

      {defiReleve && (
        <p className="flex items-center gap-2 rounded-2xl bg-orange-pale px-4 py-3 text-[15px] font-bold">
          <Users className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
          {tx("fin.defiReleve")}
        </p>
      )}

      <LimiteSilencieuse nom="GainDuJour">
        <GainDuJour moment="revision" />
      </LimiteSilencieuse>

      <p className="flex items-center gap-2 text-sm text-texte-pale" aria-live="polite">
        {envoi === "en_file" || (envoi !== "envoye" && enAttente > 0) ? (
          <>
            <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
            {tx("fin.attente", { v: { n: Math.max(enAttente, 1) } })}
          </>
        ) : envoi === "envoye" ? (
          <>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-succes" aria-hidden />
            {tx("fin.enregistre")}
          </>
        ) : null}
      </p>

      <div className="flex flex-col gap-2">
        {encore > 0 && (
          <Bouton taille="lg" pleineLargeur onClick={onEncore} icone={<RotateCcw className="h-5 w-5" />}>
            {tx("fin.encore", { v: { n: Math.min(encore, 5) } })}
          </Bouton>
        )}
        <Bouton taille="lg" variante={encore > 0 ? "contour" : "principal"} pleineLargeur onClick={onFermer}>
          {libelleFermer}
        </Bouton>
      </div>

      <LimiteSilencieuse nom="ProposerRappel">
        <ProposerRappel moment="revision" />
      </LimiteSilencieuse>
    </div>
  );
}
