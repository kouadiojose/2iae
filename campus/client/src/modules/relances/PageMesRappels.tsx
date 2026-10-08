// /mes-rappels (étudiant, lien depuis le profil) : heure du rappel
// d'entraînement, rappels oui ou non, pause de 7 jours, e-mails oui ou non.
// Chaque choix s'enregistre aussitôt. La page dit honnêtement que certains
// jours, tirés au sort, le rappel d'entraînement ne part pas (mesure de son effet).
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Clock, Mail, PauseCircle, Smartphone, FlaskConical } from "lucide-react";
import type { MajReglagesRappels, ReglagesRappels } from "@shared/engagement/relances";
import { HEURE_CHOISIE, libelleHeure } from "@shared/engagement/relances";
import { t } from "@shared/textes/relances";
import { formaterDate } from "@shared/textes";
import { put, ErreurApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Interrupteur } from "@/components/ui/champs";
import { Chargement, Erreur } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const CLE = "/api/rappels/reglages";
/** Heures proposées : de 7 h à 20 h 30, toutes les demi-heures. */
const HEURES = Array.from({ length: (HEURE_CHOISIE.max - HEURE_CHOISIE.min) / 30 + 1 }, (_, i) => HEURE_CHOISIE.min + i * 30);

function Bloc({ icone, titre, description, action, children }: { icone: ReactNode; titre: string; description?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="rounded-[20px] border border-ligne bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">{icone}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-extrabold leading-tight">{titre}</h2>
          {description && <p className="mt-1 text-[14.5px] leading-snug text-texte-pale">{description}</p>}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

export default function PageMesRappels() {
  const tx = useTextes(t);
  const { data, isLoading, error, refetch } = useQuery<ReglagesRappels>({ queryKey: [CLE] });
  const [envoi, setEnvoi] = useState(false);

  async function changer(maj: MajReglagesRappels) {
    if (envoi) return;
    setEnvoi(true);
    try {
      queryClient.setQueryData([CLE], await put<ReglagesRappels>(CLE, maj));
      toast(tx("page.enregistre"));
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Une erreur est survenue.", "erreur");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Page className="max-w-[720px]">
      <EnTetePage etiquette={tx("page.etiquette")} titre={tx("page.titre")} sousTitre={tx("page.sous_titre")} />
      {isLoading ? (
        <Chargement lignes={4} />
      ) : error || !data ? (
        <Erreur message={(error as Error)?.message ?? "Réglages indisponibles."} reessayer={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3">
          {!data.telephoneAbonne && (
            <div className="flex flex-col gap-3 rounded-2xl bg-creme p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                <Smartphone className="h-5 w-5 shrink-0 text-orange-fonce" /> {tx("page.telephone.non")}
              </p>
              <LienBouton href="/profil#rappels" variante="encre" className="min-h-[44px]">
                {tx("page.telephone.activer")}
              </LienBouton>
            </div>
          )}

          {data.pauseAutomatique && data.rappelsActifs && (
            <div className="flex flex-col gap-3 rounded-2xl border border-alerte/30 bg-alerte-clair p-4">
              <p className="text-[15px] leading-snug">{tx("page.pause_auto")}</p>
              <Bouton variante="encre" className="min-h-[44px] self-start" chargement={envoi} onClick={() => void changer({ rappelsActifs: true })}>
                {tx("page.pause_auto.reprendre")}
              </Bouton>
            </div>
          )}

          <Bloc
            icone={<BellRing className="h-5 w-5" />}
            titre={tx("page.actifs.titre")}
            description={tx("page.actifs.description")}
            action={<Interrupteur actif={data.rappelsActifs} libelle={tx("page.actifs.titre")} onChange={(v) => void changer({ rappelsActifs: v })} />}
          />

          {data.rappelsActifs && (
            <Bloc icone={<Clock className="h-5 w-5" />} titre={tx("page.heure.titre")} description={tx("page.heure.description")}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={data.heureRappel === null}
                  onClick={() => data.heureRappel !== null && void changer({ heureRappel: null })}
                  className={cn(
                    "min-h-[48px] rounded-xl border-[1.5px] px-3 text-[15px] font-bold",
                    data.heureRappel === null ? "border-encre bg-encre text-white" : "border-ligne bg-white text-encre",
                  )}
                >
                  {tx("page.heure.auto")}
                </button>
                <label className="relative">
                  <span className="sr-only">{tx("page.heure.choisir")}</span>
                  <select
                    value={data.heureRappel ?? ""}
                    onChange={(e) => e.target.value && void changer({ heureRappel: Number(e.target.value) })}
                    className={cn(
                      "min-h-[48px] w-full appearance-none rounded-xl border-[1.5px] bg-white px-3 text-center text-[15px] font-bold",
                      data.heureRappel !== null ? "border-encre bg-encre text-white" : "border-ligne text-encre",
                    )}
                  >
                    <option value="">{tx("page.heure.choisir")}</option>
                    {HEURES.map((h) => (
                      <option key={h} value={h}>
                        {libelleHeure(h)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-3 text-[14px] text-texte-pale" aria-live="polite">
                {data.heureRappel !== null
                  ? tx("page.heure.choisie", { v: { heure: libelleHeure(data.heureRappel) } })
                  : tx(data.heureAutomatique === 19 * 60 ? "page.heure.auto_defaut" : "page.heure.auto_detail", { v: { heure: libelleHeure(data.heureAutomatique) } })}
              </p>
            </Bloc>
          )}

          {data.rappelsActifs && (
            <Bloc icone={<PauseCircle className="h-5 w-5" />} titre={tx("page.pause.titre")} description={tx("page.pause.description")}>
              {data.pauseJusquAu ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[15px] font-semibold">
                    {tx("page.pause.en_cours", { v: { jour: formaterDate(`${data.pauseJusquAu}T12:00:00Z`, { style: "jour" }) } })}
                  </p>
                  <Bouton variante="contour" className="min-h-[44px]" chargement={envoi} onClick={() => void changer({ pause: false })}>
                    {tx("page.pause.reprendre")}
                  </Bouton>
                </div>
              ) : (
                <Bouton variante="doux" className="min-h-[44px]" chargement={envoi} onClick={() => void changer({ pause: true })}>
                  {tx("page.pause.bouton")}
                </Bouton>
              )}
            </Bloc>
          )}

          <Bloc
            icone={<Mail className="h-5 w-5" />}
            titre={tx("page.emails.titre")}
            description={data.aUneAdresse ? tx("page.emails.description") : tx("page.emails.sans_adresse")}
            action={data.aUneAdresse ? <Interrupteur actif={data.emailsActifs} libelle={tx("page.emails.titre")} onChange={(v) => void changer({ emailsActifs: v })} /> : undefined}
          >
            {!data.aUneAdresse && (
              <LienBouton href="/profil" variante="contour" className="min-h-[44px]">
                {tx("page.emails.ajouter")}
              </LienBouton>
            )}
          </Bloc>

          <p className="flex items-start gap-2 rounded-2xl bg-creme p-4 text-[14px] leading-snug text-texte-doux">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-texte-gris" />
            {tx("page.temoin")}
          </p>
        </div>
      )}
    </Page>
  );
}
