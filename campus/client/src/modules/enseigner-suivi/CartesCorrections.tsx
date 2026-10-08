// Emplacement « Correction des copies » sur l'accueil du formateur (/enseigner), sous la prochaine séance
// (correction automatique, décision de José du 8 octobre 2026). Des cartes seulement quand il y a quelque
// chose à faire : « Corrigés à valider (n) », avec l'heure où le premier sera tenu pour bon, « Copies à
// revoir (n) » et « Relectures demandées (n) ». Rien à faire : une seule ligne discrète qui le dit.
// Même requête que « Après la séance » (ResumeEnseigner.corriges) : un seul appel au serveur.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, ChevronRight, ClipboardCheck, MessageSquareQuote, TriangleAlert, type LucideIcon } from "lucide-react";
import { CarteLien } from "@/components/ui/carte";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { texteEcheance } from "@/modules/evaluations/composants/CorrectionCampus";
import { selonNombre, t } from "@shared/textes/corrections";
import type { ResumeEnseigner } from "@shared/engagement/enseigner";

export function CartesCorrections() {
  const tx = useTextes(t);
  const maintenant = useMaintenant(60_000);
  const { data } = useQuery<ResumeEnseigner>({ queryKey: ["/api/enseigner/apres-seance"], staleTime: 60_000 });
  const c = data?.corriges;
  if (!c) return null;

  if (!c.aValider && !c.aRevoir && !c.relectures) {
    return (
      <Link href="/enseigner/corriges" className="-my-3 flex min-h-[48px] items-center gap-2 text-sm font-semibold text-texte-pale no-underline hover:text-encre">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-succes" aria-hidden />
        <span className="flex-1">{tx("accueil.calme")}</span>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
      </Link>
    );
  }

  return (
    <section aria-labelledby="titre-corrections-campus" className="flex flex-col gap-2.5">
      <h2 id="titre-corrections-campus" className="text-xl font-extrabold">
        {tx("accueil.titre")}
      </h2>
      {c.aValider > 0 && (
        <Carte
          href="/enseigner/corriges"
          n={c.aValider}
          icone={ClipboardCheck}
          titre={selonNombre(tx, "accueil.corriges", c.aValider)}
          texte={c.prochaineEcheance ? texteEcheance(tx, c.prochaineEcheance, maintenant) : tx("accueil.corriges.texte")}
          principale
        />
      )}
      {c.relectures > 0 && (
        <Carte href="/enseigner/a-revoir#relectures" n={c.relectures} icone={MessageSquareQuote} titre={selonNombre(tx, "accueil.relectures", c.relectures)} texte={tx("accueil.relectures.texte")} />
      )}
      {c.aRevoir > 0 && (
        <Carte href="/enseigner/a-revoir#copies" n={c.aRevoir} icone={TriangleAlert} titre={selonNombre(tx, "accueil.aRevoir", c.aRevoir)} texte={tx("accueil.aRevoir.texte")} />
      )}
    </section>
  );
}

function Carte({ href, n, icone: Icone, titre, texte, principale }: { href: string; n: number; icone: LucideIcon; titre: string; texte: string; principale?: boolean }) {
  return (
    <CarteLien href={href} className={cn("flex items-center gap-4 px-4 py-3.5", principale && "border-orange bg-orange-pale")}>
      <span
        className={cn("relative grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-black tabular-nums", principale ? "bg-orange text-encre" : "bg-creme text-encre")}
        aria-hidden
      >
        {n}
        <Icone className={cn("absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white p-0.5", principale ? "text-orange-fonce" : "text-texte-pale")} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[16px] font-extrabold leading-snug">{titre}</span>
        <span className="text-[13px] leading-snug text-texte-pale">{texte}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
    </CarteLien>
  );
}
