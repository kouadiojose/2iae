// /releve/:jeton : le relevé envoyé aux parents par WhatsApp (page publique,
// sans compte). Lisible sur un téléphone et imprimable : nom, classe, campus,
// moyennes par cours, présence aux cours en direct. Rien d'autre.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Link2Off } from "lucide-react";
import type { ReleveParent } from "@shared/schema";
import { get, ErreurApi } from "@/lib/api";
import { dateComplete } from "@/lib/dates";
import { cn, note, pluriel } from "@/lib/utils";

export default function PageReleve({ jeton }: { jeton: string }) {
  const { data, isLoading, error } = useQuery<ReleveParent, ErreurApi>({
    queryKey: ["releve", jeton],
    queryFn: () => get<ReleveParent>(`/api/releve/${encodeURIComponent(jeton)}`),
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    // Page privée : jamais indexée par les moteurs de recherche.
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  useEffect(() => {
    document.title = data ? `Relevé de ${data.etudiant.prenom} ${data.etudiant.nom} · 2IAE` : "Relevé · Campus numérique 2IAE";
  }, [data]);

  return (
    <div className="min-h-dvh bg-creme px-4 py-6 print:bg-white print:p-0 sm:py-10">
      <style>{"@page { size: A4 portrait; margin: 14mm; } @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>
      <main className="mx-auto flex max-w-[720px] flex-col gap-6 rounded-[28px] bg-white p-6 shadow-carte print:max-w-none print:rounded-none print:p-0 print:shadow-none sm:p-10">
        <header className="flex items-center gap-4 border-b border-ligne pb-5">
          <img src="/marque-2iae.svg" alt="Groupe 2IAE" className="h-12 w-auto" />
          <div className="border-l border-ligne-forte pl-4">
            <div className="text-[15px] font-extrabold leading-tight">Groupe 2IAE International</div>
            <div className="font-mono text-xs text-texte-gris">Campus numérique · relevé scolaire</div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <div className="h-10 w-2/3 animate-pulse rounded-xl bg-creme" />
            <div className="h-32 animate-pulse rounded-2xl bg-creme" />
          </div>
        ) : error || !data ? (
          <div className="flex flex-col items-start gap-3 py-6">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-clair text-orange-fonce">
              <Link2Off className="h-7 w-7" />
            </span>
            <h1 className="text-3xl font-black tracking-serre">Ce relevé n'est plus disponible.</h1>
            <p className="text-base text-texte-pale">
              {error?.statut === 0 ? error.message : "Le lien a été désactivé ou remplacé par la vie scolaire. Demandez-leur un nouveau lien : ils vous l'enverront sur WhatsApp."}
            </p>
          </div>
        ) : (
          <>
            <section>
              <span className="etiquette">Relevé de l'étudiant</span>
              <h1 className="mt-1 text-[36px] font-black leading-[1.05] tracking-serre sm:text-[44px]">
                {data.etudiant.prenom} {data.etudiant.nom}
              </h1>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-3">
                <div>
                  <dt className="font-mono text-xs uppercase tracking-wider text-texte-gris">Classe</dt>
                  <dd className="font-semibold">{data.classe ?? "–"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs uppercase tracking-wider text-texte-gris">Campus</dt>
                  <dd className="font-semibold">{data.campus ?? "–"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs uppercase tracking-wider text-texte-gris">Année scolaire</dt>
                  <dd className="font-semibold">{data.anneeScolaire ?? "–"}</dd>
                </div>
              </dl>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-encre p-5 text-white">
                <div className="font-mono text-xs uppercase tracking-wider text-nuit-gris">Moyenne générale</div>
                <div className="mt-1 text-5xl font-black">{data.moyenneGenerale === null ? "–" : note(data.moyenneGenerale)}</div>
                <div className="mt-1 text-sm text-nuit-doux">{data.moyenneGenerale === null ? "Pas encore de note publiée." : "Moyenne des cours notés, sur 20."}</div>
              </div>
              <div className="rounded-2xl bg-orange p-5 text-encre">
                <div className="font-mono text-xs uppercase tracking-wider">Présence aux cours en direct</div>
                <div className="mt-1 text-5xl font-black">{data.presence.taux === null ? "–" : `${data.presence.taux} %`}</div>
                <div className="mt-1 text-sm">
                  {data.presence.seances
                    ? `Présence à ${data.presence.presents} ${data.presence.presents > 1 ? "séances" : "séance"} sur ${data.presence.seances}${data.presence.justifiees ? `, dont ${pluriel(data.presence.justifiees, "absence justifiée", "absences justifiées")} non comptée${data.presence.justifiees > 1 ? "s" : ""}` : ""}.`
                    : "Aucun cours en direct pour l'instant."}
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-extrabold">Moyennes par cours</h2>
              {!data.moyennes.length ? (
                <p className="mt-2 text-[15px] text-texte-pale">Aucun cours pour l'instant.</p>
              ) : (
                <table className="mt-3 w-full text-left text-[15px]">
                  <thead className="font-mono text-xs uppercase tracking-wider text-texte-gris">
                    <tr className="border-b border-ligne">
                      <th className="py-2 pr-3 font-normal">Cours</th>
                      <th className="py-2 pr-3 text-right font-normal">Notes</th>
                      <th className="py-2 text-right font-normal">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ligne-douce">
                    {data.moyennes.map((m) => (
                      <tr key={m.code}>
                        <td className="py-3 pr-3">
                          <div className="font-semibold">{m.titre}</div>
                          <div className="font-mono text-xs text-texte-gris">{m.code}</div>
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums text-texte-pale">{m.notes}</td>
                        <td className={cn("py-3 text-right text-lg font-black tabular-nums", m.moyenne !== null && m.moyenne < 10 && "text-danger")}>{m.moyenne === null ? "–" : note(m.moyenne)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <footer className="flex flex-col gap-3 border-t border-ligne pt-5 text-sm text-texte-pale">
              <p>
                Relevé établi le {dateComplete(data.date).toLowerCase()} par le campus numérique du Groupe 2IAE International. Les moyennes tiennent compte des coefficients des devoirs ; la présence en ligne est comptée à partir de 70 % de la durée du cours.
              </p>
              <p>Ce lien est personnel : la vie scolaire peut le désactiver à tout moment. Pour toute question, contactez la vie scolaire du campus.</p>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[48px] items-center gap-2 self-start rounded-xl bg-creme px-5 font-bold text-encre hover:bg-orange-clair print:hidden"
              >
                <Printer className="h-4 w-4" /> Imprimer ou enregistrer en PDF
              </button>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
