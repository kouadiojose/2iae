// Reçu de paiement imprimable, commun à la vie scolaire (/pilotage/recus/:id)
// et à l'étudiant (/mon-dossier/recus/:id). Une carte au format A5 : lisible
// sur un téléphone, et seule sur la feuille à l'impression (A4 ou A5).
// Les tailles du reçu sont en rem : à l'impression, la taille de base de la
// page est réduite et tout le reçu rétrécit d'un bloc pour tenir sur un A5.
import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, ReceiptText } from "lucide-react";
import type { RecuPaiement } from "@shared/schema";
import { ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { cn } from "@/lib/utils";
import { fcfa, montant, libelleMoyen } from "../outils-crm";
import { LienWhatsApp, jourEnLettres } from "./ScolariteElements";

const fmtEmis = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

/** « Soixante mille francs CFA » */
function enToutesLettres(lettres: string): string {
  const t = lettres.trim();
  return `${t.charAt(0).toUpperCase()}${t.slice(1)} francs CFA`;
}

/** Texte court partagé sur WhatsApp par la vie scolaire (aux parents, en général). */
function texteWhatsApp(r: RecuPaiement): string {
  return [
    `Reçu de paiement ${r.numero}${r.annule ? " (ANNULÉ)" : ""}`,
    `${r.etudiant.prenom} ${r.etudiant.nom}${r.etudiant.matricule ? ` (${r.etudiant.matricule})` : ""}`,
    `Montant : ${fcfa(r.montant)}, le ${jourEnLettres(r.dateVersement)}`,
    r.apres && !r.annule ? `Reste à payer : ${fcfa(r.apres.reste)}` : null,
    "Groupe Écoles 2IAE International",
  ]
    .filter(Boolean)
    .join("\n");
}

function Info({ titre, children, className }: { titre: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="font-mono text-[0.6875rem] uppercase tracking-wider text-texte-gris">{titre}</dt>
      <dd className="mt-0.5 break-words text-[0.9375rem] font-semibold leading-snug">{children}</dd>
    </div>
  );
}

/** La carte du reçu elle-même (sans barre d'outils). encaissePar n'apparaît que pour l'équipe. */
export function Recu({ recu, equipe = false }: { recu: RecuPaiement; equipe?: boolean }) {
  const r = recu;
  return (
    <article className="recu relative mx-auto w-full max-w-[35rem] overflow-hidden rounded-[1.5rem] border border-ligne bg-white text-encre shadow-carte" aria-labelledby="titre-recu">
      <div className="h-2 bg-orange" aria-hidden />

      {r.annule && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center overflow-hidden">
          <span className="-rotate-[24deg] select-none rounded-[1rem] border-[0.375rem] border-danger/60 px-6 py-1 text-[4.5rem] font-black leading-none tracking-[0.12em] text-danger/50 sm:text-[5.5rem]">
            ANNULÉ
          </span>
        </div>
      )}

      <div className="relative flex flex-col gap-5 p-5 sm:p-8">
        <h1 id="titre-recu" className="sr-only">
          Reçu de paiement {r.numero}
        </h1>

        <header className="flex items-center gap-3">
          <img src="/marque-2iae.png" alt="2IAE" className="h-12 w-auto shrink-0" />
          <div className="min-w-0 border-l border-ligne-forte pl-3 leading-tight">
            <div className="text-[0.9375rem] font-extrabold">Groupe Écoles 2IAE International</div>
            {r.site && <div className="mt-0.5 text-[0.8125rem] text-texte-pale">{r.site}</div>}
          </div>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-y border-ligne py-4">
          <div className="min-w-0">
            <div className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-orange-fonce">Reçu de paiement</div>
            <div className="mt-1 font-mono text-[1.625rem] font-bold leading-none tracking-tight sm:text-[1.875rem]">{r.numero}</div>
          </div>
          <div className="sm:text-right">
            <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-texte-gris">Date du versement</div>
            <div className="mt-0.5 text-[0.9375rem] font-bold">{jourEnLettres(r.dateVersement)}</div>
          </div>
        </div>

        {r.annule && (
          <div role="note" className="relative z-20 rounded-[1rem] bg-danger-clair px-4 py-3 text-[0.9375rem] text-danger">
            <strong>Versement annulé</strong> le {fmtEmis.format(new Date(r.annule.le))}.
            {r.annule.motif ? <> Motif : « {r.annule.motif} ».</> : null} Ce reçu n'a plus de valeur.
          </div>
        )}

        <section>
          <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-texte-gris">Reçu de</div>
          <div className="mt-1 font-titre text-[1.875rem] font-semibold leading-[1.05] [font-size-adjust:0.5] sm:text-[2.125rem]">
            {r.etudiant.prenom} <span className="uppercase">{r.etudiant.nom}</span>
          </div>
          {r.etudiant.matricule && <div className="mt-1 font-mono text-[0.875rem] text-texte-doux">Matricule {r.etudiant.matricule}</div>}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <Info titre="Classe" className="col-span-2 sm:col-span-1">
              {r.classe ?? "–"}
            </Info>
            <Info titre="Année scolaire" className="col-span-2 sm:col-span-1">
              {r.anneeScolaire}
            </Info>
          </dl>
        </section>

        <section className="rounded-[1.125rem] bg-creme p-4 sm:p-5">
          <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-texte-gris">Montant reçu</div>
          <div className={cn("mt-1.5 text-[2.5rem] font-black leading-none tabular-nums tracking-tres-serre sm:text-[3rem]", r.annule && "line-through decoration-danger decoration-[0.2rem]")}>
            {montant(r.montant)}
            <span className="ml-2 whitespace-nowrap text-[1.125rem] font-extrabold tracking-normal">F CFA</span>
          </div>
          <p className="mt-2 text-[0.9375rem] italic leading-snug text-texte-doux">{enToutesLettres(r.montantEnLettres)}</p>
        </section>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Info titre="Moyen de paiement">{libelleMoyen(r.moyen)}</Info>
          {r.reference ? (
            <Info titre="Référence">
              <span className="font-mono text-[0.875rem]">{r.reference}</span>
            </Info>
          ) : (
            <div />
          )}
          {equipe && r.encaissePar && (
            <Info titre="Encaissé par" className="col-span-2">
              {r.encaissePar}
            </Info>
          )}
        </dl>

        {r.apres && !r.annule && (
          <section>
            <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-texte-gris">Situation après ce versement</div>
            <dl className="mt-2 grid grid-cols-3 divide-x divide-ligne rounded-[1rem] border border-ligne">
              <div className="min-w-0 p-3">
                <dt className="text-[0.75rem] leading-tight text-texte-pale">Total dû</dt>
                <dd className="mt-1 text-[0.9375rem] font-bold tabular-nums">{montant(r.apres.du)}</dd>
              </div>
              <div className="min-w-0 p-3">
                <dt className="text-[0.75rem] leading-tight text-texte-pale">Payé à ce jour</dt>
                <dd className="mt-1 text-[0.9375rem] font-bold tabular-nums">{montant(r.apres.paye)}</dd>
              </div>
              <div className="min-w-0 p-3">
                <dt className="text-[0.75rem] leading-tight text-texte-pale">Reste à payer</dt>
                <dd className={cn("mt-1 text-[0.9375rem] font-black tabular-nums", r.apres.reste <= 0 ? "text-succes" : "text-encre")}>
                  {r.apres.reste <= 0 ? "Soldé" : montant(r.apres.reste)}
                </dd>
              </div>
            </dl>
            <p className="mt-1.5 text-[0.75rem] text-texte-gris">Montants en francs CFA, pour l'année {r.anneeScolaire}.</p>
          </section>
        )}

        <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-dashed border-ligne-forte pt-4">
          <div className="min-w-[10rem] flex-1 text-[0.75rem] leading-relaxed text-texte-gris">
            <p>Reçu émis le {fmtEmis.format(new Date(r.emisLe))}.</p>
            <p>Ce reçu fait foi du paiement. À conserver.</p>
          </div>
          <div className="flex h-[7rem] w-[11rem] shrink-0 flex-col justify-end rounded-[0.875rem] border border-dashed border-texte-gris p-2 text-center font-mono text-[0.625rem] uppercase tracking-wider text-texte-gris">
            Cachet et signature
          </div>
        </footer>
      </div>
    </article>
  );
}

/**
 * Page complète d'un reçu (sans la coquille) : barre d'outils à l'écran
 * (retour, imprimer, WhatsApp pour l'équipe), le reçu seul à l'impression.
 */
export function EcranRecu({ url, retour, equipe = false }: { url: string; retour: string; equipe?: boolean }) {
  const [, naviguer] = useLocation();
  const { data, isLoading, error, refetch } = useQuery<RecuPaiement, ErreurApi>({ queryKey: [url], staleTime: 0 });

  useEffect(() => {
    document.title = data ? `Reçu ${data.numero} · ${data.etudiant.prenom} ${data.etudiant.nom}` : "Reçu de paiement · Campus numérique 2IAE";
  }, [data]);

  // Le reçu s'ouvre souvent dans un nouvel onglet : sans historique, on repart de la liste.
  const revenir = () => {
    if (window.history.length > 1) window.history.back();
    else naviguer(retour);
  };

  return (
    <div className="recu-page min-h-dvh bg-[#EFE7E0] print:min-h-0 print:bg-white">
      <style>{CSS_IMPRESSION}</style>

      <header className="sticky top-0 z-30 border-b border-ligne bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[640px] flex-wrap items-center gap-2 px-4 py-2">
          <button type="button" onClick={revenir} className="flex min-h-[48px] items-center gap-2 pr-2 font-bold text-encre">
            <ArrowLeft className="h-5 w-5" aria-hidden /> Retour
          </button>
          <div className="min-w-0 flex-1 truncate text-right font-mono text-[13px] text-texte-gris sm:text-left">{data?.numero ?? ""}</div>
          {data && (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              {equipe ? (
                <LienWhatsApp href={`https://wa.me/?text=${encodeURIComponent(texteWhatsApp(data))}`} className="min-h-[48px]">
                  <span className="sm:hidden">WhatsApp</span>
                  <span className="hidden sm:inline">Partager sur WhatsApp</span>
                </LienWhatsApp>
              ) : null}
              <Bouton icone={<Printer className="h-4 w-4" />} onClick={() => window.print()} className={cn("min-h-[48px]", !equipe && "col-span-2")}>
                Imprimer
              </Bouton>
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-6 sm:py-10 print:p-0">
        {isLoading ? (
          <div className="mx-auto flex max-w-[35rem] flex-col gap-4 rounded-[24px] bg-white p-6" aria-busy="true" aria-label="Chargement du reçu">
            <div className="h-12 w-2/3 animate-pulse rounded-xl bg-creme" />
            <div className="h-10 w-1/2 animate-pulse rounded-xl bg-creme" />
            <div className="h-28 animate-pulse rounded-2xl bg-creme" />
            <div className="h-20 animate-pulse rounded-2xl bg-creme" />
          </div>
        ) : error || !data ? (
          <div className="mx-auto flex max-w-[35rem] flex-col items-start gap-3 rounded-[24px] bg-white p-6 sm:p-8">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-clair text-orange-fonce">
              <ReceiptText className="h-7 w-7" aria-hidden />
            </span>
            <p className="text-2xl font-black tracking-serre">{error?.statut === 404 ? "Ce reçu est introuvable." : "Le reçu n'a pas pu s'afficher."}</p>
            <p className="text-[15px] text-texte-pale">
              {error?.statut === 404
                ? equipe
                  ? "Le lien est peut-être incomplet, ou ce versement n'est pas dans votre périmètre."
                  : "Le lien est peut-être incomplet. Retrouve tous tes reçus dans « Mon dossier »."
                : (error?.message ?? "Une erreur est survenue.")}
            </p>
            <div className="flex flex-wrap gap-2">
              {error?.statut !== 404 && (
                <Bouton variante="contour" onClick={() => void refetch()} className="min-h-[48px]">
                  Réessayer
                </Bouton>
              )}
              <Bouton variante="doux" onClick={() => naviguer(retour)} className="min-h-[48px]">
                {equipe ? "Aller à la scolarité" : "Aller à mon dossier"}
              </Bouton>
            </div>
          </div>
        ) : (
          <>
            <Recu recu={data} equipe={equipe} />
            <p className="mx-auto mt-4 max-w-[35rem] text-center text-sm text-texte-gris print:hidden">
              {equipe
                ? "Conseil : imprimez à 100 %, sur A4 ou A5. Pour l'envoyer en fichier, choisissez « Enregistrer au format PDF » dans la fenêtre d'impression."
                : "Pour garder ton reçu sur ton téléphone : touche « Imprimer », puis choisis « Enregistrer au format PDF »."}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

const CSS_IMPRESSION = `
@page { margin: 10mm; }
@media print {
  html { font-size: 12px !important; }
  html, body { background: #fff !important; }
  .recu {
    width: 148mm !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    box-shadow: none !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
