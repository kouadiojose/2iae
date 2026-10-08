// Bandeau « Relances automatiques » de « Qui décroche ? ». La direction règle
// le rappel d'entraînement, les relances des décrocheurs et les e-mails :
// « en essai » (calculé et affiché, rien ne part, par défaut), « en marche »
// ou « en pause », et le plafond d'e-mails par jour (40 par défaut). La vie
// scolaire voit seulement où en sont ces réglages (vouvoiement).
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings2, Send } from "lucide-react";
import type { ModeEmails, ModeRelances, MajReglageRelances, ReglageRelancesDto, CompteStatuts } from "@shared/engagement/relances";
import { EMAILS_PAR_JOUR_MAX } from "@shared/engagement/relances";
import { t } from "@shared/textes/relances";
import { formaterDate } from "@shared/textes";
import { put, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { Bouton } from "@/components/ui/bouton";
import { Badge } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { toast } from "@/components/ui/toast";

const vous = { registre: "vous" as const };
const CLE = "/api/pilotage/relances-auto/reglages";
const MODES: ModeRelances[] = ["essai", "actif", "pause"];
const MODES_EMAILS: ModeEmails[] = ["essai", "actif"];
const somme = (c: CompteStatuts, ...statuts: (keyof CompteStatuts)[]) => statuts.reduce((s, k) => s + (c[k] ?? 0), 0);
const TON = { essai: "alerte", actif: "succes", pause: "gris" } as const;

type Modes = { mode: ModeRelances; rappelsMode: ModeRelances; emailsMode: ModeEmails };

function ChoixMode<M extends string>({ titre, valeur, options, onChange, libelle }: { titre: string; valeur: M; options: M[]; onChange: (m: M) => void; libelle: (m: M) => string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-xs uppercase tracking-wider text-texte-gris">{titre}</span>
      <Onglets<M> valeur={valeur} onChange={onChange} options={options.map((o) => ({ valeur: o, libelle: libelle(o) }))} />
    </div>
  );
}

function Stat({ valeur, libelle }: { valeur: string | number; libelle: string }) {
  return (
    <div className="rounded-xl bg-creme px-3 py-2">
      <div className="text-[18px] font-extrabold leading-tight">{valeur}</div>
      <div className="text-[12px] leading-tight text-texte-pale">{libelle}</div>
    </div>
  );
}

export function ReglagesRelances({ estDirection, etat }: { estDirection: boolean; etat?: Modes | null }) {
  const { data } = useQuery<ReglageRelancesDto>({ queryKey: [CLE], enabled: estDirection });
  const [ouvert, setOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState<Required<MajReglageRelances> | null>(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    if (data) setBrouillon({ mode: data.mode, rappelsMode: data.rappelsMode, emailsMode: data.emailsMode, emailsParJour: data.emailsParJour });
  }, [data]);

  const source: Modes | null | undefined = estDirection ? data : etat;
  if (!source) return null;

  async function enregistrer() {
    if (!brouillon) return;
    setEnvoi(true);
    try {
      await put(CLE, brouillon);
      toast(t("pilotage.enregistre", vous));
      await rafraichir(CLE, "/api/pilotage/relances-auto");
      setOuvert(false);
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Une erreur est survenue.", "erreur");
    } finally {
      setEnvoi(false);
    }
  }

  const etats: [string, ModeRelances | ModeEmails][] = [
    ["pilotage.etat.rappels", source.rappelsMode],
    ["pilotage.etat.relances", source.mode],
    ["pilotage.etat.emails", source.emailsMode],
  ];
  const b = data?.bilan;
  return (
    <section className="rounded-2xl border border-ligne bg-white p-4" aria-labelledby="relances-auto-titre">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">
          <Send className="h-5 w-5" />
        </span>
        <h2 id="relances-auto-titre" className="min-w-0 flex-1 text-[17px] font-extrabold leading-tight">
          {t("pilotage.titre", vous)}
        </h2>
        {estDirection && (
          <Bouton variante="doux" taille="sm" className="min-h-[44px] shrink-0" icone={<Settings2 className="h-4 w-4" />} onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
            {ouvert ? "Fermer" : "Régler"}
          </Bouton>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {etats.map(([cle, m]) => (
          <Badge key={cle} ton={TON[m]}>
            {t(cle as "pilotage.etat.rappels", { ...vous, v: { mode: t(`pilotage.etat.${m}`, vous) } })}
          </Badge>
        ))}
      </div>
      {etats.some(([, m]) => m === "essai") && <p className="mt-2 text-[13px] leading-snug text-texte-pale">{t("pilotage.note.essai", vous)}</p>}
      {b && b.semaineSansEmail > 0 && (
        <p className="mt-2 rounded-xl bg-alerte-clair px-3 py-2 text-[13px] leading-snug text-alerte">
          {b.semaineSansEmail === 1 ? t("pilotage.semaine_sans_email.un", vous) : t("pilotage.semaine_sans_email", { ...vous, v: { n: b.semaineSansEmail } })}
        </p>
      )}
      {/* Les chiffres détaillés vivent dans le tableau « Engagement » (C8) ; ici, à la demande, pour régler en connaissance de cause. */}
      {ouvert && b && data && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat valeur={somme(b.rappels, "envoye", "pause_auto", "simulation")} libelle={t("pilotage.stat.rappels", vous)} />
          <Stat valeur={somme(b.relances, "envoye", "simulation")} libelle={t("pilotage.stat.relances", vous)} />
          <Stat valeur={`${b.revenus}/${b.relancesComptees}`} libelle={t("pilotage.stat.revenus", vous)} />
          <Stat valeur={b.aAppeler} libelle={t("pilotage.stat.appeler", vous)} />
          <Stat valeur={`${b.emailsAujourdhui}/${data.emailsParJour}`} libelle={t("pilotage.stat.emails", vous)} />
        </div>
      )}

      {estDirection && ouvert && brouillon && (
        <div className="mt-4 flex flex-col gap-4 border-t border-ligne-douce pt-4">
          <p className="text-[14px] leading-snug text-texte-pale">{t("pilotage.description", vous)}</p>
          <ChoixMode titre={t("pilotage.rappels", vous)} valeur={brouillon.rappelsMode} options={MODES} onChange={(m) => setBrouillon({ ...brouillon, rappelsMode: m })} libelle={(m) => t(`pilotage.mode.${m}`, vous)} />
          <ChoixMode titre={t("pilotage.relances", vous)} valeur={brouillon.mode} options={MODES} onChange={(m) => setBrouillon({ ...brouillon, mode: m })} libelle={(m) => t(`pilotage.mode.${m}`, vous)} />
          <ChoixMode
            titre={t("pilotage.emails", vous)}
            valeur={brouillon.emailsMode}
            options={MODES_EMAILS}
            onChange={(m) => setBrouillon({ ...brouillon, emailsMode: m })}
            libelle={(m) => t(`pilotage.mode_emails.${m}`, vous)}
          />
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs uppercase tracking-wider text-texte-gris">{t("pilotage.plafond", vous)}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={EMAILS_PAR_JOUR_MAX}
              value={brouillon.emailsParJour}
              onChange={(e) => setBrouillon({ ...brouillon, emailsParJour: Math.max(0, Math.min(EMAILS_PAR_JOUR_MAX, Math.trunc(Number(e.target.value) || 0))) })}
              className="min-h-[48px] w-32 rounded-xl border border-ligne bg-white px-4 text-base outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
            />
            <span className="text-[13px] text-texte-pale">{t("pilotage.plafond.aide", vous)}</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Bouton className="min-h-[48px]" chargement={envoi} onClick={() => void enregistrer()}>
              {t("pilotage.enregistrer", vous)}
            </Bouton>
            {data?.majLe && (
              <span className="text-[13px] text-texte-gris">
                {t("pilotage.maj", { ...vous, v: { date: formaterDate(data.majLe, { style: "court" }), qui: data.majPar ?? "la direction" } })}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
