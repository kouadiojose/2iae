// /corriger — correction rapide, pensée pour le téléphone du formateur : les
// copies rendues sans note, la plus ancienne en premier, et UN bouton
// « Corriger la plus ancienne ». Chaque copie s'ouvre ensuite seule à l'écran
// (/corriger/:id), et la note part aussitôt chez l'étudiant. 102 copies
// attendaient le 8 octobre : une copie notée vite donne envie de rendre la
// suivante. La correction guidée complète reste dans /corrections.
//
// Décision D2 : seules les copies de SES devoirs forment la file et le bouton
// principal. Celles des exercices du campus (routine du soir) sont à part,
// sous « Exercices du campus · facultatif » : il les corrige s'il le souhaite,
// sans rappel ni compte à rebours.
//
// Correction automatique (8 octobre 2026) : le campus note les copies des
// devoirs qui ont un corrigé validé. Ce qu'il laisse au formateur (copies
// retenues, relectures) et les corrigés à valider ont leurs cartes, ici aussi.
import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, ChevronRight, ClipboardCheck, Send } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte, CarteLien, TitreSection } from "@/components/ui/carte";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { selonNombre, t } from "@shared/textes/enseigner";
import type { CopiesEnAttenteDto } from "@shared/engagement/enseigner";
import { cleFile, copiesPassees, depuis } from "./outils";
import { CartesCorrections } from "./CartesCorrections";

export default function PageCorriger() {
  const tx = useTextes(t);
  const devoir = Number(new URLSearchParams(useSearch()).get("devoir")) || null;
  const { data, isLoading, error, refetch } = useQuery<CopiesEnAttenteDto>({ queryKey: [cleFile(devoir)] });
  const [envoi, setEnvoi] = useState(false);

  // Lien « copies des exercices du campus » de l'accueil : on descend jusqu'à elles.
  useEffect(() => {
    if (!data || window.location.hash !== "#facultatives") return;
    const minuterie = setTimeout(() => document.getElementById("facultatives")?.scrollIntoView({ block: "start" }), 120);
    return () => clearTimeout(minuterie);
  }, [data]);

  if (isLoading) {
    return (
      <Page className="max-w-2xl">
        <Chargement lignes={4} />
      </Page>
    );
  }
  if (error || !data) {
    return (
      <Page className="max-w-2xl">
        <Erreur message={(error as Error)?.message ?? "Erreur"} reessayer={() => void refetch()} />
      </Page>
    );
  }

  // La file : les copies de ses devoirs (ou, avec ?devoir=, celles de ce devoir-là, même facultatif).
  // La plus ancienne d'abord ; celles passées (« Plus tard ») à la fin.
  const base = devoir ? data.copies : data.copies.filter((c) => !c.automatique);
  const ordonner = (liste: typeof data.copies) => [...liste.filter((c) => !copiesPassees.has(c.renduId)), ...liste.filter((c) => copiesPassees.has(c.renduId))];
  const file = ordonner(base);
  const premiere = file[0];
  const enAttente = base.length;
  const suffixe = devoir ? `?devoir=${devoir}` : "";
  const facultatives = devoir ? [] : data.devoirs.filter((g) => g.automatique && g.aCorriger > 0);
  const fileFacultative = ordonner(data.copies.filter((c) => c.automatique));

  async function envoyerPosees() {
    setEnvoi(true);
    try {
      let total = 0;
      for (const g of data!.devoirs.filter((x) => x.aPublier > 0)) {
        const r = await post<{ publiees: number }>(`/api/devoirs/${g.devoirId}/publier-notes`);
        total += r.publiees;
      }
      toast(selonNombre(tx, "corriger.posees.envoyees", total));
      await rafraichir("/api/enseigner", "/api/devoirs", "/api/accueil/formateur");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Page className="max-w-2xl gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">{tx("corriger.etiquette")}</span>
        <h1 className="titre-page">{tx("corriger.titre")}</h1>
        {enAttente > 0 && (
          <p className="text-[15px] text-texte-pale">
            {selonNombre(tx, "corriger.resume", enAttente)} {tx("corriger.ancienne", { v: { duree: depuis(tx, base[0].renduLe) } })}
          </p>
        )}
      </header>

      {premiere ? (
        <LienBouton href={`/corriger/${premiere.renduId}${suffixe}`} taille="lg" className="min-h-[60px] w-full text-[17px]">
          {tx("corriger.commencer")} <ArrowRight className="h-5 w-5" aria-hidden />
        </LienBouton>
      ) : (
        <EtatVide
          icone={data.envoyeesAujourdhui > 0 ? <CheckCircle2 className="h-6 w-6" /> : <ClipboardCheck className="h-6 w-6" />}
          titre={data.envoyeesAujourdhui > 0 ? tx("corriger.bravo") : tx("corriger.vide.titre")}
          texte={data.envoyeesAujourdhui > 0 ? selonNombre(tx, "corriger.aujourdhui", data.envoyeesAujourdhui) : tx("corriger.vide.texte")}
        />
      )}

      {data.totalAPublier > 0 && (
        <Carte className="flex flex-col gap-3 border-orange/60 bg-orange-pale sm:flex-row sm:items-center">
          <p className="flex-1 text-[15px] font-semibold">{selonNombre(tx, "corriger.aPublier", data.totalAPublier)}</p>
          <Bouton variante="contour" icone={<Send className="h-4 w-4" />} chargement={envoi} onClick={() => void envoyerPosees()} className="min-h-[48px]">
            {tx("corriger.envoyerPosees")}
          </Bouton>
        </Carte>
      )}

      {!devoir && <CartesCorrections />}

      {data.devoirs.some((g) => (devoir || !g.automatique) && g.aCorriger > 0) && (
        <section aria-labelledby="titre-par-devoir">
          <TitreSection titre={<span id="titre-par-devoir">{tx("corriger.parDevoir")}</span>} />
          <ul className="flex flex-col gap-2.5">
            {data.devoirs
              .filter((g) => (devoir || !g.automatique) && g.aCorriger > 0)
              .map((g) => {
                const debut = file.find((c) => c.devoirId === g.devoirId);
                return (
                  <li key={g.devoirId}>
                    <CarteLien href={debut ? `/corriger/${debut.renduId}?devoir=${g.devoirId}` : `/corriger?devoir=${g.devoirId}`} className="flex items-center gap-4 px-4 py-3.5">
                      <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange text-lg font-black tabular-nums text-encre")} aria-hidden>
                        {g.aCorriger}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-bold leading-snug">{g.devoirTitre}</span>
                        <span className="text-sm text-texte-pale">
                          <span className="font-mono text-xs font-semibold text-orange-fonce">{g.coursCode}</span> · {selonNombre(tx, "corriger.devoir", g.aCorriger)}
                          {g.plusAncienne && ` · ${tx("corriger.depuis", { v: { duree: depuis(tx, g.plusAncienne) } })}`}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
                    </CarteLien>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {facultatives.length > 0 && (
        <section id="facultatives" aria-labelledby="titre-facultatives" className="flex scroll-mt-20 flex-col gap-2.5">
          <TitreSection titre={<span id="titre-facultatives">{tx("corriger.facultatives.titre")}</span>} />
          <p className="-mt-1 text-sm text-texte-pale">{tx("corriger.facultatives.texte")}</p>
          <ul className="flex flex-col gap-2.5">
            {facultatives.map((g) => {
              const debut = fileFacultative.find((c) => c.devoirId === g.devoirId);
              return (
                <li key={g.devoirId}>
                  <CarteLien href={debut ? `/corriger/${debut.renduId}?devoir=${g.devoirId}` : `/corriger?devoir=${g.devoirId}`} className="flex items-center gap-4 px-4 py-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-creme text-base font-bold tabular-nums text-texte-pale" aria-hidden>
                      {g.aCorriger}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold leading-snug">{g.devoirTitre}</span>
                      <span className="text-sm text-texte-pale">
                        <span className="font-mono text-xs font-semibold">{g.coursCode}</span> · {selonNombre(tx, "corriger.devoir", g.aCorriger)}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
                  </CarteLien>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {devoir && (
        <Link href="/corriger" className="inline-flex min-h-[44px] items-center gap-1 self-start text-[15px] font-bold">
          {tx("corriger.titre")} <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
      <Link href="/corrections" className="inline-flex min-h-[44px] items-center gap-1 self-start text-[15px] font-semibold text-texte-pale">
        {tx("corriger.toutesLesCopies")} <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </Page>
  );
}
