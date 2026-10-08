// /enseigner/relire — les devoirs écrits par l'IA (QCM et exercice de la
// routine du soir). Ils partent aux étudiants sans le formateur (amendement de
// José, VALIDATION_OBLIGATOIRE = false). Depuis la correction automatique
// (8 octobre 2026), ce qui compte est leur corrigé : chaque devoir mène à sa
// page des corrigés du jour (/enseigner/corriges/:id), où le formateur le
// valide ou le modifie. Reste ici, en action secondaire, « Ne pas le mettre en
// avant » (il reste dans « Devoirs », le campus ne le pousse plus).
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Badge, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { formaterDate } from "@shared/textes";
import { selonNombre, t } from "@shared/textes/enseigner";
import { t as tc } from "@shared/textes/corrections";
import type { ARelireDto, CorpsValidation, DevoirARelire, StatutValidation } from "@shared/engagement/enseigner";

const LETTRES = "ABCDEFGHIJ";

export default function QcmARelire() {
  const tx = useTextes(t);
  const txc = useTextes(tc);
  const { data, isLoading, error, refetch } = useQuery<ARelireDto>({ queryKey: ["/api/enseigner/a-relire"] });

  return (
    <Page className="max-w-2xl gap-6">
      <Link href="/enseigner" className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {tx("relire.retour")}
      </Link>
      <header className="flex flex-col gap-1.5">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">{txc("corriges.etiquette")}</span>
        <h1 className="titre-page">{tx("relire.titre")}</h1>
        <p className="text-[15px] leading-relaxed text-texte-pale">{txc("relire.intro")}</p>
      </header>
      {isLoading ? (
        <Chargement lignes={3} />
      ) : error || !data ? (
        <Erreur message={(error as Error)?.message ?? "Erreur"} reessayer={() => void refetch()} />
      ) : data.devoirs.length ? (
        <ul className="flex flex-col gap-4">
          {data.devoirs.map((d) => (
            <li key={d.id}>
              <CarteDevoir d={d} />
            </li>
          ))}
        </ul>
      ) : (
        <EtatVide icone={<CheckCircle2 className="h-6 w-6" />} titre={tx("relire.vide")} />
      )}
    </Page>
  );
}

function CarteDevoir({ d }: { d: DevoirARelire }) {
  const tx = useTextes(t);
  const txc = useTextes(tc);
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState<StatutValidation | "annule" | null>(null);

  async function decider(statut: StatutValidation | null) {
    setEnvoi(statut ?? "annule");
    try {
      const corps: CorpsValidation = { statut };
      await post(`/api/enseigner/devoirs-auto/${d.id}/validation`, corps);
      toast(tx(statut ? `relire.fait.${statut}` : "relire.fait.annule"));
      await rafraichir("/api/enseigner");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  }

  const etat = !d.publie
    ? tx("relire.masque")
    : d.validation === "a_revoir"
      ? tx("relire.aRevoir")
      : d.propose
        ? tx("relire.propose")
        : d.proposeLe
          ? tx("relire.proposeLe", { v: { quand: formaterDate(d.proposeLe, { style: "jourHeure" }) } })
          : null;

  return (
    <Carte className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge ton="orange">
          <Sparkles className="h-3 w-3" aria-hidden /> {tx(d.type === "quiz" ? "relire.quiz" : "relire.depot")}
        </Badge>
        <span className="font-mono text-xs font-semibold text-orange-fonce">{d.coursCode}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[17px] font-extrabold leading-snug">{d.titre}</h2>
        <p className="text-sm text-texte-pale">
          {d.seanceTitre}
          {etat && <span className={cn("block", d.validation === "a_revoir" ? "text-alerte" : "text-texte-gris")}>{etat}</span>}
        </p>
      </div>

      {d.questions.length > 0 && (
        <>
          <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-bold text-orange-fonce">
            {ouvert ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
            {ouvert ? tx("relire.masquerQuestions") : selonNombre(tx, "relire.voirQuestions", d.questions.length)}
          </button>
          {ouvert && (
            <ol className="flex flex-col gap-3">
              {d.questions.map((q, i) => (
                <li key={q.id} className="flex flex-col gap-1.5 rounded-xl bg-creme p-3">
                  <p className="text-[15px] font-semibold leading-snug">
                    {i + 1}. {q.enonce}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {q.options.map((o, j) => {
                      const bonne = q.bonnes.includes(j);
                      return (
                        <li key={j} className={cn("flex items-start gap-2 rounded-lg px-2 py-1 text-sm", bonne ? "bg-succes-clair font-semibold text-succes" : "text-texte-doux")}>
                          <span className="font-mono text-xs">{LETTRES[j]}</span>
                          <span className="flex-1">{o}</span>
                          {bonne && <Check className="h-4 w-4 shrink-0" aria-label={tx("relire.bonneReponse")} />}
                        </li>
                      );
                    })}
                  </ul>
                  {q.explication && <p className="text-[13px] leading-snug text-texte-gris">{q.explication}</p>}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      {d.consigne && <p className="line-clamp-6 whitespace-pre-line rounded-xl bg-creme p-3 text-sm leading-relaxed text-texte-doux">{d.consigne.replace(/[#*_]/g, "")}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {/* Le corrigé se vérifie (et se valide) sur sa page : c'est lui qui sert de barème au campus. */}
        <LienBouton href={`/enseigner/corriges/${d.id}`} taille="sm" className="min-h-[44px]">
          {txc("relire.voirCorrige")} <ArrowRight className="h-4 w-4" aria-hidden />
        </LienBouton>
        {d.validation === "a_revoir" ? (
          <Bouton variante="fantome" taille="sm" chargement={envoi === "annule"} onClick={() => void decider(null)} className="min-h-[44px]">
            {tx("relire.annuler")}
          </Bouton>
        ) : (
          <Bouton variante="fantome" taille="sm" chargement={envoi === "a_revoir"} onClick={() => void decider("a_revoir")} className="min-h-[44px]">
            {tx("relire.nePasProposer")}
          </Bouton>
        )}
      </div>
    </Carte>
  );
}
