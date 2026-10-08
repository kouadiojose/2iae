// Bloc « Correction automatique » du tableau Engagement (/pilotage/engagement), pour la direction
// (chantier K4, décision de José du 8 octobre 2026). Corrigés (en préparation, à valider, validés, tenus
// pour bons), copies (en attente, notées, à revoir, en erreur), relectures, notes changées par les
// formateurs et écart moyen, et par formateur : qui répond au corrigé du jour. Vouvoiement.
// Contrat : BilanCorrections (shared/engagement/corrections.ts), GET /api/pilotage/corrections, périmètre de
// la personne. Une personne sans ce droit (403), ou un serveur qui n'a pas encore la route (404) : rien.
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BilanCorrections } from "@shared/engagement/corrections";
import { t, selonNombre, type CleEngagement } from "@shared/textes/engagement";
import type { Traducteur } from "@shared/textes";
import { useTextes } from "@/lib/textes";
import { ErreurApi } from "@/lib/api";
import { BarreProgression, Chargement, Erreur } from "@/components/ui/divers";
import { Carte, TitreSection } from "@/components/ui/carte";
import { cn } from "@/lib/utils";

type Tx = Traducteur<CleEngagement>;

const dateAbidjan = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });
const virgule = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

function Lecture({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-texte-pale">{children}</p>;
}

/** Un chiffre et ce qu'il compte ; « signal » : en couleur dès qu'il n'est pas nul (à revoir, en erreur). */
function Chiffre({ valeur, libelle, signal }: { valeur: number; libelle: string; signal?: "alerte" | "danger" }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-creme px-3 py-2.5">
      <span className={cn("text-2xl font-black tabular-nums tracking-serre text-encre", valeur > 0 && signal === "alerte" && "text-alerte", valeur > 0 && signal === "danger" && "text-danger")}>
        {valeur}
      </span>
      <span className="text-[13px] leading-snug text-texte-pale">{libelle}</span>
    </div>
  );
}

export function BlocCorrections() {
  const tx = useTextes(t);
  const q = useQuery<BilanCorrections>({ queryKey: ["/api/pilotage/corrections"], staleTime: 5 * 60_000 });
  const statut = q.error instanceof ErreurApi ? q.error.statut : 0;
  if (statut === 403 || statut === 404) return null;
  return (
    <section aria-labelledby="corrections" className="flex flex-col gap-4">
      <h2 id="corrections" className="text-2xl font-extrabold">
        {tx("corrections.titre")}
      </h2>
      {q.isLoading && <Chargement lignes={2} />}
      {q.error && !q.data && <Erreur message={tx("corrections.erreur")} reessayer={() => void q.refetch()} />}
      {q.data && <Contenu b={q.data} tx={tx} />}
    </section>
  );
}

function Contenu({ b, tx }: { b: BilanCorrections; tx: Tx }) {
  const depuis = new Date(b.depuis);
  return (
    <>
      <Lecture>{tx("corrections.lecture", { v: { date: Number.isNaN(depuis.getTime()) ? b.depuis : dateAbidjan.format(depuis) } })}</Lecture>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Carte className="flex flex-col gap-3 p-4 sm:p-5">
          <TitreSection titre={tx("corrections.corriges")} className="mb-0" />
          <div className="grid grid-cols-2 gap-2">
            <Chiffre valeur={b.corriges.enPreparation} libelle={tx("corrections.corriges.enPreparation")} />
            <Chiffre valeur={b.corriges.aValider} libelle={tx("corrections.corriges.aValider")} />
            <Chiffre valeur={b.corriges.valides} libelle={tx("corrections.corriges.valides")} />
            <Chiffre valeur={b.corriges.tacites} libelle={tx("corrections.corriges.tacites")} />
          </div>
          <Lecture>{tx("corrections.corriges.lecture")}</Lecture>
        </Carte>
        <Carte className="flex flex-col gap-3 p-4 sm:p-5">
          <TitreSection titre={tx("corrections.copies")} className="mb-0" />
          <div className="grid grid-cols-2 gap-2">
            <Chiffre valeur={b.copies.enFile} libelle={tx("corrections.copies.enFile")} />
            <Chiffre valeur={b.copies.notees} libelle={tx("corrections.copies.notees")} />
            <Chiffre valeur={b.copies.aRevoir} libelle={tx("corrections.copies.aRevoir")} signal="alerte" />
            <Chiffre valeur={b.copies.erreurs} libelle={tx("corrections.copies.erreurs")} signal="danger" />
          </div>
          <p className="text-sm font-bold text-encre">{selonNombre(tx, "corrections.copies.periode", b.noteesPeriode)}</p>
          <Lecture>{tx("corrections.copies.lecture")}</Lecture>
        </Carte>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Carte className="flex flex-col gap-2 p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-texte-gris">{tx("corrections.relectures")}</div>
          <span className={cn("text-4xl font-black tracking-serre text-encre", b.relectures.ouvertes > 0 && "text-alerte")}>{b.relectures.ouvertes}</span>
          <span className="text-[13px] text-texte-gris">{tx("corrections.relectures.detail", { v: { o: b.relectures.ouvertes, t: b.relectures.traitees } })}</span>
          <Lecture>{tx("corrections.relectures.lecture")}</Lecture>
        </Carte>
        <Carte className="flex flex-col gap-2 p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-texte-gris">{tx("corrections.changees")}</div>
          <span className="text-4xl font-black tracking-serre text-encre">{b.changees.n}</span>
          <span className="text-[13px] text-texte-gris">
            {b.changees.ecartMoyen === null ? tx("corrections.changees.sansEcart") : tx("corrections.changees.ecart", { v: { n: virgule(b.changees.ecartMoyen) } })}
          </span>
          <Lecture>{tx("corrections.changees.lecture")}</Lecture>
        </Carte>
      </div>

      <Carte className="flex flex-col gap-1 p-4 sm:p-5">
        <TitreSection titre={tx("corrections.formateurs")} className="mb-0" />
        {b.parFormateur.length ? (
          <ul className="grid gap-x-8 lg:grid-cols-2">
            {b.parFormateur.map((f) => {
              const servis = f.valides + f.tacites;
              const taux = servis ? Math.round((f.valides / servis) * 100) : null;
              return (
                <li key={f.id} className="flex flex-col gap-1.5 border-t border-ligne-douce py-3 first:border-t-0 lg:[&:nth-child(2)]:border-t-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-bold text-encre">{f.nom}</span>
                    <span className={cn("shrink-0 text-lg font-black tabular-nums", taux !== null && taux < 50 && "text-alerte")}>
                      {taux === null ? "–" : tx("corrections.formateurs.repond", { v: { n: taux } })}
                    </span>
                  </div>
                  {taux !== null && <BarreProgression valeur={taux} ton={taux >= 50 ? "succes" : "orange"} />}
                  <div className="text-[13px] text-texte-gris">{tx("corrections.formateurs.ligne", { v: { v: f.valides, t: f.tacites, a: f.aValider } })}</div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-2 text-sm text-texte-pale">{tx("corrections.formateurs.aucun")}</p>
        )}
        <Lecture>{tx("corrections.formateurs.lecture")}</Lecture>
      </Carte>
    </>
  );
}
