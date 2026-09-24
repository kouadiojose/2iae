// /enseigner/notes/:coursId : carnet de notes d'un cours (formateur, équipe
// dans son périmètre). Étudiants en lignes, évaluations en colonnes avec leur
// coefficient, moyenne pondérée, moyennes par campus, export CSV.
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, BookOpenCheck } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Carte } from "@/components/ui/carte";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { dateCourte } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CarnetCours, CelluleCarnet } from "@shared/schema";
import { nombre } from "./outils";

function Cellule({ c }: { c: CelluleCarnet | undefined }) {
  if (!c || c.etat === "en_attente") return <span className="text-texte-gris">·</span>;
  if (c.etat === "non_rendu") return <span className="rounded-md bg-danger-clair px-1.5 py-0.5 font-mono text-xs font-semibold text-danger">NR</span>;
  if (c.etat === "a_corriger") return <span className="font-mono text-xs text-orange-fonce">à corriger</span>;
  return (
    <span className={cn("tabular-nums", c.etat === "brouillon" ? "italic text-texte-gris" : "font-bold")} title={c.etat === "brouillon" ? "Note pas encore publiée" : undefined}>
      {nombre(c.note)}
      {c.enRetard && <sup className="ml-0.5 text-[10px] text-danger">R</sup>}
    </span>
  );
}

export default function PageCarnet({ coursId }: { coursId: string }) {
  const id = Number(coursId);
  const { data, isLoading, error, refetch } = useQuery<CarnetCours>({ queryKey: ["/api/notes/cours", id], enabled: Number.isInteger(id) });

  return (
    <Page large>
      <Link href="/corrections" className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> Corrections
      </Link>
      {isLoading ? (
        <Chargement lignes={4} />
      ) : error || !data ? (
        <Erreur message={(error as Error)?.message ?? "Carnet introuvable."} reessayer={() => void refetch()} />
      ) : (
        <>
          <EnTetePage
            etiquette={`${data.cours.code} · Carnet de notes`}
            titre={data.cours.titre}
            sousTitre="Moyennes sur 20 pondérées par les coefficients, calculées sur les notes publiées. En italique : notes pas encore publiées. NR : non rendu. R : rendu en retard."
            actions={
              <a
                href={`/api/notes/cours/${id}/export`}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border-[1.5px] border-encre bg-white px-5 py-3 text-[15px] font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre"
              >
                <Download className="h-4 w-4" /> Exporter (CSV)
              </a>
            }
          />
          {!data.etudiants.length ? (
            <EtatVide icone={<BookOpenCheck className="h-6 w-6" />} titre="Aucun étudiant inscrit." texte="Les étudiants apparaissent ici dès que leur classe est rattachée au cours." />
          ) : !data.devoirs.length ? (
            <EtatVide icone={<BookOpenCheck className="h-6 w-6" />} titre="Aucune évaluation pour l'instant." texte="Chaque devoir et chaque interrogation du cours devient une colonne du carnet." />
          ) : (
            <Carte className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <thead className="bg-creme">
                    <tr>
                      <th className="sticky left-0 z-10 min-w-[180px] bg-creme px-4 py-3 text-left font-bold">Étudiant</th>
                      {data.devoirs.map((d) => (
                        <th key={d.id} className="min-w-[110px] px-3 py-3 text-center align-bottom font-semibold">
                          <Link href={`/enseigner/devoirs/${d.id}/copies`} className="line-clamp-2 text-encre no-underline hover:text-orange-fonce">
                            {d.titre}
                          </Link>
                          <span className="mt-1 block font-mono text-[11px] font-normal text-texte-gris">
                            /{nombre(d.bareme)} · ×{nombre(d.coefficient)} · {dateCourte(d.dateLimite)}
                          </span>
                        </th>
                      ))}
                      <th className="min-w-[90px] bg-encre px-3 py-3 text-center font-bold text-white">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.etudiants.map((e) => (
                      <tr key={e.id} className="border-t border-ligne-douce hover:bg-orange-pale/40">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                          <span className="block font-semibold">
                            {e.nom} {e.prenom}
                          </span>
                          <span className="font-mono text-[11px] text-texte-gris">
                            {e.matricule ?? "—"} · {e.site ?? "—"}
                          </span>
                        </td>
                        {data.devoirs.map((d) => (
                          <td key={d.id} className="px-3 py-2.5 text-center">
                            <Cellule c={e.notes[String(d.id)]} />
                          </td>
                        ))}
                        <td className="bg-creme/60 px-3 py-2.5 text-center text-base font-black tabular-nums">{nombre(e.moyenne)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Carte>
          )}
          {data.moyennesParSite.length > 1 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-extrabold">Par campus</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {data.moyennesParSite.map((s) => (
                  <div key={s.site} className="rounded-2xl border border-ligne bg-white p-4">
                    <div className="font-mono text-xs uppercase tracking-wider text-texte-gris">{s.site}</div>
                    <div className="mt-1 text-3xl font-black tabular-nums tracking-serre">{nombre(s.moyenne)}</div>
                    <div className="text-sm text-texte-pale">
                      {s.effectif} étudiant{s.effectif > 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Page>
  );
}
