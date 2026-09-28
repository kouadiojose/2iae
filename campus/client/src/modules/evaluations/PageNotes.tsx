// /notes (étudiant) : moyenne par cours (sur 20, pondérée par les
// coefficients) et le détail de chaque évaluation. Seules les notes publiées
// par les formateurs apparaissent.
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, ArrowLeft, ChevronRight } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { Chargement, EtatVide, Erreur, Badge } from "@/components/ui/divers";
import { dateCourte } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { NotesEtudiant, EvaluationNote } from "@shared/schema";
import { useEvenementsDevoirs } from "./PageDevoirs";
import { nombre } from "./outils";

const ETATS: Record<Exclude<EvaluationNote["etat"], "note">, { libelle: string; ton: "gris" | "danger" | "orange" }> = {
  en_correction: { libelle: "En correction", ton: "orange" },
  non_rendu: { libelle: "Non rendu", ton: "danger" },
  a_venir: { libelle: "À venir", ton: "gris" },
};

export default function PageNotes() {
  const { data, isLoading, error, refetch } = useQuery<NotesEtudiant>({ queryKey: ["/api/notes"] });
  useEvenementsDevoirs();
  const cours = data?.cours ?? [];
  const avecEvaluations = cours.filter((c) => c.evaluations.length);

  return (
    <Page className="max-w-3xl">
      <Link href="/devoirs" className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> Mes devoirs
      </Link>
      <EnTetePage
        etiquette="Carnet de notes"
        titre="Mes notes"
        sousTitre="Moyennes sur 20, pondérées par les coefficients. Seules les notes publiées par tes formateurs comptent."
      />
      {isLoading ? (
        <Chargement lignes={3} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
      ) : !avecEvaluations.length ? (
        <EtatVide
          icone={<GraduationCap className="h-6 w-6" />}
          titre="Pas encore de note."
          texte="Tes notes apparaîtront ici dès que tes formateurs les publieront, cours par cours, avec ta moyenne."
          action={
            <LienBouton href="/devoirs" variante="contour" className="min-h-[48px]">
              Voir mes devoirs
            </LienBouton>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {avecEvaluations.map((c) => (
            <section key={c.coursId} className="overflow-hidden rounded-[24px] border border-ligne bg-white">
              <div className="flex items-center justify-between gap-4 p-5" style={{ boxShadow: `inset 6px 0 0 ${c.couleur}` }}>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-[11px] font-semibold text-orange-fonce">{c.code}</span>
                  <h2 className="text-lg font-extrabold leading-snug">{c.titre}</h2>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-texte-gris">Moyenne</div>
                  <div className={cn("text-[34px] font-black leading-none tracking-tres-serre tabular-nums", c.moyenne === null && "text-texte-gris")}>
                    {nombre(c.moyenne)}
                    <span className="text-base text-texte-gris">/20</span>
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-ligne-douce border-t border-ligne-douce">
                {c.evaluations.map((e) => (
                  <li key={e.devoirId}>
                    <Link
                      href={e.type === "quiz" ? `/quiz/${e.devoirId}` : `/devoirs/${e.devoirId}`}
                      className="flex min-h-[64px] items-center gap-3 px-5 py-3 text-encre no-underline hover:bg-creme hover:text-encre"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[15px] font-semibold leading-snug">{e.titre}</span>
                        <span className="font-mono text-[11px] text-texte-gris">
                          {e.type === "quiz" ? "Interrogation" : "Devoir"} · <span className="whitespace-nowrap">{dateCourte(e.dateLimite)}</span> ·{" "}
                          <span className="whitespace-nowrap">coef. {nombre(e.coefficient)}</span>
                        </span>
                      </div>
                      {e.etat === "note" ? (
                        <span className="shrink-0 text-right">
                          <span className="text-xl font-black tabular-nums">{nombre(e.note)}</span>
                          <span className="font-mono text-xs text-texte-gris">/{nombre(e.bareme)}</span>
                        </span>
                      ) : (
                        <Badge ton={ETATS[e.etat].ton} className="shrink-0">
                          {ETATS[e.etat].libelle}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-texte-gris" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-center text-sm text-texte-gris">Une note te semble fausse ? Écris à ton formateur depuis la page du devoir.</p>
        </div>
      )}
    </Page>
  );
}
