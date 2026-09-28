// Un étudiant à contacter : les raisons, ce qu'il faut faire, et les trois
// gestes (WhatsApp, dossier, suivi) à portée de pouce.
import { Link } from "wouter";
import { MessageCircle, FolderOpen, NotebookPen, Clock } from "lucide-react";
import type { AContacter } from "@shared/schema";
import { LIBELLES_RAISONS } from "@shared/schema";
import { Badge, Avatar } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import { vuLe, telephoneLisible } from "../outils";

const TON_RAISON = { jamais_active: "alerte", inactif: "orange", lives_manques: "danger", devoir_non_rendu: "gris" } as const;

export function LigneAContacter({ ligne, onSuivi, compacte }: { ligne: AContacter; onSuivi: (e: AContacter["etudiant"]) => void; compacte?: boolean }) {
  const e = ligne.etudiant;
  return (
    <li className="rounded-2xl border border-ligne bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar prenom={e.prenom} nom={e.nom} taille={44} />
        <div className="min-w-0 flex-1">
          <Link href={`/pilotage/etudiants/${e.id}`} className="text-[17px] font-extrabold text-encre no-underline hover:text-orange-fonce">
            {e.prenom} {e.nom}
          </Link>
          <div className="mt-0.5 text-sm text-texte-pale">
            {[e.matricule, e.site ? `Campus ${e.site}` : null].filter(Boolean).join(" · ")}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ligne.raisons.map((r) => (
              <Badge key={r.type} ton={TON_RAISON[r.type]}>
                {LIBELLES_RAISONS[r.type]}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      {!compacte && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-ligne-douce pt-3">
          {ligne.raisons.map((r) => (
            <li key={r.type} className="text-[15px] leading-snug">
              <span className="text-texte-doux">{r.texte}</span>
              <span className="mt-0.5 block font-semibold text-encre">→ {r.action}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-texte-gris">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> Vu sur le campus : {vuLe(ligne.derniereActivite)}
        </span>
        {ligne.dernierSuivi && (
          <span>
            Dernier suivi {vuLe(ligne.dernierSuivi.creeLe)} ({ligne.dernierSuivi.auteur}) : « {ligne.dernierSuivi.texte.slice(0, 80)}
            {ligne.dernierSuivi.texte.length > 80 ? "…" : ""} »
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ligne.whatsapp ? (
          <a
            href={ligne.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-orange px-2 text-sm font-bold text-encre no-underline hover:bg-encre hover:text-white"
            title={`Écrire au ${telephoneLisible(e.telephone)}`}
          >
            <MessageCircle className="h-4 w-4 shrink-0" /> WhatsApp
          </a>
        ) : (
          <span className="flex min-h-[48px] items-center justify-center rounded-xl bg-creme px-2 text-center text-[13px] font-semibold leading-tight text-texte-gris">
            Pas de numéro
          </span>
        )}
        <Link
          href={`/pilotage/etudiants/${e.id}`}
          className={cn("flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-encre px-2 text-sm font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre")}
        >
          <FolderOpen className="h-4 w-4 shrink-0" /> Dossier
        </Link>
        <button
          type="button"
          onClick={() => onSuivi(e)}
          className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-creme px-2 text-sm font-bold text-encre hover:bg-orange-clair"
        >
          <NotebookPen className="h-4 w-4 shrink-0" /> Suivi
        </button>
      </div>
    </li>
  );
}
