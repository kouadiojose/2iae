// /enseigner/corriges — les corrigés du jour (décision de José du 8 octobre 2026). Chaque matin, le campus
// envoie au formateur le corrigé des devoirs de ses cours (questions et bonnes réponses du QCM ; consigne,
// grille et corrigé de l'exercice) : il les ouvre ici un par un et les valide ou les modifie. Sans réponse,
// un corrigé est tenu pour bon au bout de 24 h et sert de barème : le campus note les copies tout seul.
// En haut « À valider » (l'échéance la plus proche d'abord), puis « Récents » (encore modifiables).
// Lien de la notification et de l'e-mail du matin. Réponses en « no-store » côté serveur (bonnes réponses).
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChevronRight, ClipboardList, Clock3, ListChecks, PenLine } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { CarteLien, TitreSection } from "@/components/ui/carte";
import { Badge, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { useMoiConnecte } from "@/lib/auth";
import { dateCourte, jourLong } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { cn, nomComplet } from "@/lib/utils";
import { resumeCopies, texteEcheance } from "@/modules/evaluations/composants/CorrectionCampus";
import { selonNombre, t, type CleCorrections } from "@shared/textes/corrections";
import type { CorrigeAValider, ListeCorriges } from "@shared/engagement/corrections";
import type { Traducteur } from "@shared/textes";

type Tx = Traducteur<CleCorrections>;

export default function PageCorriges() {
  const tx = useTextes(t);
  const moi = useMoiConnecte();
  const maintenant = useMaintenant(60_000);
  const { data, isLoading, error, refetch } = useQuery<ListeCorriges>({ queryKey: ["/api/enseigner/corriges"] });

  return (
    <Page className="max-w-2xl gap-6">
      <Link
        href={moi.role === "formateur" ? "/enseigner" : "/corrections"}
        className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> {moi.role === "formateur" ? tx("corriges.retourAccueil") : "Corrections"}
      </Link>
      <header className="flex flex-col gap-1.5">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">{tx("corriges.etiquette")}</span>
        <h1 className="titre-page">{tx("corriges.titre")}</h1>
        <p className="text-[15px] leading-relaxed text-texte-pale">{tx("corriges.intro")}</p>
      </header>

      {isLoading ? (
        <Chargement lignes={3} />
      ) : error || !data ? (
        <Erreur message={(error as Error)?.message ?? "Erreur"} reessayer={() => void refetch()} />
      ) : (
        <>
          <section aria-labelledby="titre-a-valider" className="flex flex-col gap-3">
            <TitreSection
              className="mb-0"
              titre={
                <span id="titre-a-valider" className="flex items-center gap-2">
                  {tx("corriges.aValider")}
                  {data.aValider.length > 0 && <Badge ton="orange">{data.aValider.length}</Badge>}
                </span>
              }
            />
            {data.aValider.length ? (
              <ul className="flex flex-col gap-3">
                {data.aValider.map((c) => (
                  <li key={c.devoirId}>
                    <CarteAValider c={c} tx={tx} maintenant={maintenant} duFormateur={moi.role === "vie_scolaire"} />
                  </li>
                ))}
              </ul>
            ) : (
              <EtatVide icone={<CheckCircle2 className="h-6 w-6" />} titre={tx("corriges.vide.titre")} texte={tx("corriges.vide.texte")} />
            )}
            {data.enPreparation > 0 && (
              <p className="flex items-start gap-2 text-sm leading-snug text-texte-pale">
                <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
                {selonNombre(tx, "corriges.enPreparation", data.enPreparation)}
              </p>
            )}
          </section>

          {data.recents.length > 0 && (
            <section aria-labelledby="titre-recents" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 id="titre-recents" className="text-xl font-extrabold">
                  {tx("corriges.recents")}
                </h2>
                <p className="text-sm text-texte-pale">{tx("corriges.recents.aide")}</p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {data.recents.map((c) => (
                  <li key={c.devoirId}>
                    <LigneRecent c={c} tx={tx} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* La mise en avant des devoirs de l'IA (objectif du jour, rappels) reste réglable, en second. */}
      {moi.role !== "vie_scolaire" && (
        <Link href="/enseigner/relire" className="inline-flex min-h-[44px] items-center gap-1 self-start text-sm font-semibold text-texte-pale no-underline hover:text-encre">
          {tx("relire.lien")} <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      )}
    </Page>
  );
}

/** Type, cours et séance d'un corrigé : « QCM · IA-101 · séance du lundi 28 septembre ». */
function Origine({ c, tx }: { c: CorrigeAValider; tx: Tx }) {
  const quiz = c.type === "quiz";
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge ton={quiz ? "encre" : "gris"} className="py-0.5">
        {quiz ? <ListChecks className="h-3 w-3" aria-hidden /> : <ClipboardList className="h-3 w-3" aria-hidden />}
        {tx(quiz ? "corriges.quiz" : "corriges.depot")}
      </Badge>
      <span className="font-mono text-xs font-semibold text-orange-fonce">{c.coursCode}</span>
      {c.seance && <span className="text-[13px] text-texte-gris">{tx("corrige.seance", { v: { jour: jourLong(c.seance.debut) } })}</span>}
    </span>
  );
}

function CarteAValider({ c, tx, maintenant, duFormateur }: { c: CorrigeAValider; tx: Tx; maintenant: number; duFormateur: boolean }) {
  const detail = c.type === "quiz" ? selonNombre(tx, "corriges.questions", c.questions.length) : resumeCopies(tx, c)[0];
  return (
    <CarteLien href={`/enseigner/corriges/${c.devoirId}`} className="flex flex-col gap-3 border-orange/60 p-4 sm:p-5">
      <Origine c={c} tx={tx} />
      <span className="flex flex-col gap-0.5">
        <span className="text-[17px] font-extrabold leading-snug">{c.titre}</span>
        <span className="text-sm text-texte-pale">{detail}</span>
      </span>
      {c.echeanceLe && (
        <span className="flex items-start gap-2 rounded-xl bg-orange-pale px-3 py-2 text-sm font-semibold leading-snug text-encre">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
          {texteEcheance(tx, c.echeanceLe, maintenant, duFormateur)}
        </span>
      )}
      {/* Toute la carte s'ouvre ; le « bouton » dit ce qu'on y fait (contour : plusieurs cartes, pas de bouton orange). */}
      <span className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-[1.5px] border-encre bg-white text-[15px] font-bold text-encre">
        {tx("corriges.verifier")} <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </CarteLien>
  );
}

function LigneRecent({ c, tx }: { c: CorrigeAValider; tx: Tx }) {
  const tacite = c.statut === "tacite";
  const quand = c.valideLe ? dateCourte(c.valideLe) : null;
  return (
    <CarteLien href={`/enseigner/corriges/${c.devoirId}`} className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <Origine c={c} tx={tx} />
        <span className="font-bold leading-snug">{c.titre}</span>
        <span className={cn("text-[13px] leading-snug", tacite ? "text-texte-gris" : "text-succes")}>
          {tacite
            ? `${tx("statut.tacite")}${quand ? ` · ${quand}` : ""}`
            : `${tx("statut.valide")}${c.validePar ? ` · ${nomComplet(c.validePar)}` : ""}${quand ? ` · ${quand}` : ""}`}
        </span>
        <span className="text-[13px] leading-snug text-texte-pale">{resumeCopies(tx, c).join(" · ")}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
    </CarteLien>
  );
}
