// Entonnoir d'un direct (chantier C8) : attendus → en salle / en ligne → ont
// suivi → au seuil officiel → ont participé, puis la présence en trois états,
// et le détail par campus (salle émargée ou non) et par classe de 5 attendus
// ou plus. Mêmes règles que le bilan de séance (/api/seances/:id/bilan).
import { useState } from "react";
import { ChevronDown, CircleCheck, CircleDashed, CalendarClock } from "lucide-react";
import type { LigneEntonnoir, SeanceEntonnoir } from "@shared/engagement/indicateurs";
import { t } from "@shared/textes/engagement";
import { useTextes } from "@/lib/textes";
import { Badge } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import { COULEURS, BarreTroisEtats } from "./Courbe";

const fmtDate = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Abidjan" });
const fmtDateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Abidjan" });

type Etape = { cle: "attendus" | "enSalle" | "enLigne" | "ontSuivi" | "auSeuil" | "ontParticipe"; retrait?: boolean };
const ETAPES: Etape[] = [
  { cle: "attendus" },
  { cle: "enSalle", retrait: true },
  { cle: "enLigne", retrait: true },
  { cle: "ontSuivi" },
  { cle: "auSeuil", retrait: true },
  { cle: "ontParticipe" },
];

function Barres({ l }: { l: LigneEntonnoir }) {
  const tx = useTextes(t);
  return (
    <ul className="flex flex-col gap-1.5">
      {ETAPES.map((e) => {
        const n = l[e.cle];
        const p = l.attendus ? Math.round((n / l.attendus) * 100) : 0;
        return (
          <li key={e.cle} className="grid grid-cols-[8.25rem_1fr] items-center gap-2 text-[13px] sm:grid-cols-[11rem_1fr]">
            {/* Le retrait est sur le libellé seul : toutes les barres partent du même bord. */}
            <span className={cn("leading-tight text-texte-doux", e.retrait && "pl-3")}>{tx(`entonnoir.${e.cle}`)}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 min-w-0 flex-1 rounded-[3px] bg-[#F3EAE2]">
                <span
                  className="block h-full rounded-[3px]"
                  style={{ width: `${l.attendus ? (n / l.attendus) * 100 : 0}%`, background: e.cle === "attendus" ? "#8A7F76" : COULEURS.sansCours }}
                />
              </span>
              <span className="w-[4.25rem] shrink-0 text-right font-bold tabular-nums text-encre">
                {n}
                {e.cle !== "attendus" && <span className="font-normal text-texte-gris"> · {p} %</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function LigneCourte({ l }: { l: LigneEntonnoir }) {
  const tx = useTextes(t);
  return (
    <li className="flex flex-col gap-1 border-t border-ligne-douce py-2 text-[13px] first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-encre">{l.libelle}</span>
        {l.salleEmargee !== null && (
          <Badge ton={l.salleEmargee ? "succes" : "alerte"}>
            {l.salleEmargee ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
            {l.salleEmargee ? tx("entonnoir.salleEmargee") : tx("entonnoir.salleNonEmargee")}
          </Badge>
        )}
      </div>
      <p className="text-texte-pale">
        {l.attendus} {tx("entonnoir.attendus").toLowerCase()} · {l.enSalle} {tx("entonnoir.enSalle").toLowerCase()} · {l.enLigne}{" "}
        {tx("entonnoir.enLigne").toLowerCase()} · {l.ontSuivi} {tx("entonnoir.ontSuivi").toLowerCase()} · {l.ontParticipe}{" "}
        {tx("entonnoir.ontParticipe").toLowerCase()}
      </p>
      <p className="text-texte-gris">{tx("entonnoir.presence", { v: { p: l.presents, a: l.absents, i: l.inconnus } })}</p>
    </li>
  );
}

export function EntonnoirDirect({ s, ouverte = false }: { s: SeanceEntonnoir; ouverte?: boolean }) {
  const tx = useTextes(t);
  const [detail, setDetail] = useState(ouverte);
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4 sm:p-5">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-texte-gris">
          <span>{s.coursCode}</span>
          <span>·</span>
          <span>{tx("entonnoir.tenueLe", { v: { date: fmtDate.format(new Date(s.tenueLe)) } })}</span>
          {s.malDatee && (
            <Badge ton="alerte">
              <CalendarClock className="h-3.5 w-3.5" />
              {tx("entonnoir.prevueLe", { v: { date: fmtDateCourte.format(new Date(s.prevueLe)) } })}
            </Badge>
          )}
          <span>·</span>
          <span>{s.sondages ? tx("entonnoir.sondages", { v: { n: s.sondages } }) : tx("entonnoir.aucunSondage")}</span>
        </div>
        <h3 className="text-base font-extrabold leading-snug">{s.titre}</h3>
      </header>
      <Barres l={s.total} />
      <BarreTroisEtats e={{ presents: s.total.presents, absents: s.total.absents, inconnus: s.total.inconnus, total: s.total.attendus, tauxConnu: null, partInconnue: null }} />
      {(s.campus.length > 0 || s.classes.length > 0) && (
        <div>
          <button
            type="button"
            onClick={() => setDetail((d) => !d)}
            aria-expanded={detail}
            className="flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-texte-doux"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", detail && "rotate-180")} />
            {tx("entonnoir.detail")}
          </button>
          {detail && (
            <div className="grid gap-4 md:grid-cols-2">
              <section>
                <h4 className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">{tx("entonnoir.parCampus")}</h4>
                <ul>
                  {s.campus.map((l) => (
                    <LigneCourte key={l.libelle} l={l} />
                  ))}
                </ul>
              </section>
              {s.classes.length > 0 && (
                <section>
                  <h4 className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">{tx("entonnoir.parClasse")}</h4>
                  <ul>
                    {s.classes.map((l) => (
                      <LigneCourte key={l.libelle} l={l} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
