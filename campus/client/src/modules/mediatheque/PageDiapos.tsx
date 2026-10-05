// /mediatheque/diapos/:id — le support d'un cours : les diapositives projetées
// pendant la séance, à feuilleter sur le téléphone, ou à imprimer et
// enregistrer en PDF depuis le navigateur.
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PlayCircle, Printer } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { dateCourte } from "@/lib/dates";
import { Page } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Chargement, Erreur } from "@/components/ui/divers";
import type { ReplayDto } from "@shared/schema/ext-live";

export default function PageDiapos({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const { data, error, isLoading, refetch } = useQuery<ReplayDto>({ queryKey: [`/api/seances/${id}/replay`] });

  if (isLoading) {
    return (
      <Page className="max-w-4xl">
        <Chargement lignes={6} />
      </Page>
    );
  }
  if (error || !data) {
    return (
      <Page className="max-w-4xl">
        <Erreur message={(error as Error)?.message ?? "Diapositives introuvables."} reessayer={() => void refetch()} />
      </Page>
    );
  }
  const s = data.seance;

  return (
    <Page className="max-w-4xl gap-5">
      {/* À l'impression : seulement les diapositives, une par page. */}
      <style>{`@media print { body * { visibility: hidden !important; } .zone-diapos, .zone-diapos * { visibility: visible !important; } .zone-diapos { position: absolute; inset: 0; } .zone-diapos figure { break-inside: avoid; page-break-inside: avoid; margin: 0 0 12px; } .sans-impression { display: none !important; } }`}</style>
      <Link href="/mediatheque" className="sans-impression inline-flex items-center gap-1.5 self-start text-sm font-bold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Médiathèque
      </Link>
      <div className="sans-impression flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">
          {s.coursCode} · {s.coursTitre}
        </span>
        <h1 className="text-[26px] font-black leading-tight sm:text-3xl">{s.titre}</h1>
        <p className="text-[15px] text-texte-pale">
          {dateCourte(s.debut)}
          {s.formateur ? ` · ${s.formateur}` : ""} · {data.diapos.length} diapositive{data.diapos.length > 1 ? "s" : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Bouton icone={<Printer className="h-4 w-4" />} onClick={() => window.print()} disabled={!data.diapos.length}>
            Imprimer ou enregistrer en PDF
          </Bouton>
          <LienBouton href={`/replays/${s.id}`} variante="contour" icone={<PlayCircle className="h-4 w-4" />}>
            {etudiant ? "Revoir le cours" : "Revoir la séance"}
          </LienBouton>
        </div>
        <p className="text-sm text-texte-gris">
          {etudiant
            ? "Pour garder le support : « Imprimer ou enregistrer en PDF », puis choisis « Enregistrer au format PDF » comme imprimante."
            : "Pour garder le support : « Imprimer ou enregistrer en PDF », puis choisir « Enregistrer au format PDF » comme imprimante."}
        </p>
      </div>
      {data.diapos.length ? (
        <div className="zone-diapos flex flex-col gap-4">
          {data.diapos.map((d) => (
            <figure key={d.fichierId} className="overflow-hidden rounded-2xl border border-ligne bg-white">
              <img src={d.url} alt={`Diapositive ${d.index + 1}`} loading="lazy" className="block w-full" />
              <figcaption className="sans-impression px-3 py-1.5 text-right font-mono text-xs text-texte-gris">
                {d.index + 1} / {data.diapos.length}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-creme px-4 py-3 text-sm text-texte-pale">Aucune diapositive n'a été projetée pendant cette séance.</p>
      )}
    </Page>
  );
}
