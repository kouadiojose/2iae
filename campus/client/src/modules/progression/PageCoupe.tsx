// /coupe — Coupe des campus et des classes (chantier C5), pour tout compte
// connecté. Des taux, jamais des étudiants : aucun nom, aucun rang individuel.
// Étudiant (tutoyé) : la quête de sa classe, les campus et sa ligue ; le rang
// n'est montré que dans la moitié haute, les autres sont listés par ordre
// alphabétique avec leur progression. Équipe (vouvoyée) : tous les chiffres de
// son périmètre, 8 semaines d'historique et le détail des actes par campus.
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Info, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { heure } from "@/lib/dates";
import { Page } from "@/components/layout/coquille";
import { Carte } from "@/components/ui/carte";
import { BarreProgression, Erreur, Squelette } from "@/components/ui/divers";
import { t } from "@shared/textes/progression";
import { FAMILLES, TROPHEES, type CoupeDto, type EntreeCoupe, type ListeCoupe, type Trophee } from "@shared/engagement/progression";
import { rangTexte } from "./donnees";
import { IconeTrophee } from "./Pastilles";

type Tx = typeof t;

export default function PageCoupe() {
  const tx = useTextes(t);
  const { data, error, refetch } = useQuery<CoupeDto>({ queryKey: ["/api/coupe"], staleTime: 5 * 60_000 });
  if (error && !data) {
    return (
      <Page>
        <Erreur message={tx("coupe.erreur")} reessayer={() => void refetch()} />
      </Page>
    );
  }
  if (!data) {
    return (
      <Page>
        <Squelette className="h-10 w-2/3" />
        <Squelette className="h-56" />
        <Squelette className="h-56" />
      </Page>
    );
  }
  const vide = !data.campus.haut.length && !data.campus.autres.length;
  return (
    <Page className="max-w-[1100px] gap-6">
      <header className="flex flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="etiquette">{tx("coupe.semaine", { v: { n: data.semaine.numero } })}</span>
          {data.semaine.essai && <span className="rounded-full bg-orange-clair px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-orange-profond">{tx("coupe.essai")}</span>}
        </span>
        <h1 className="titre-page">{tx("coupe.titre")}</h1>
        <p className="max-w-2xl text-[15px] text-texte-pale">{tx("coupe.principe")}</p>
        {data.personnel && <p className="max-w-2xl text-sm text-texte-gris">{tx("coupe.equipe.intro")}</p>}
      </header>

      {data.semaine.essai && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-orange-clair px-4 py-3 text-[15px] text-texte-doux">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
          {tx("coupe.essai.aide")}
        </p>
      )}

      {vide ? (
        <Carte className="text-[15px] text-texte-pale">{tx("coupe.vide")}</Carte>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            {data.maClasse && <QueteClasse classe={data.maClasse} tx={tx} />}
            <Section titre={tx("coupe.campus.titre")}>
              <Liste liste={data.campus} personnel={data.personnel} moiLibelle={tx("coupe.moi.campus")} tx={tx} />
              {data.campus.bientot.length > 0 && <p className="mt-3 text-sm text-texte-gris">{tx("coupe.bientot", { v: { noms: data.campus.bientot.join(", ") } })}</p>}
            </Section>
            {data.ligues
              .filter((l) => l.haut.length || l.autres.length)
              .map((l) => (
                <Section key={l.ligue} titre={tx("coupe.ligue.titre", { v: { ligue: tx(`ligue.${l.ligue}`) } })}>
                  <Liste liste={l} personnel={data.personnel} moiLibelle={tx("coupe.moi.classe")} tx={tx} />
                </Section>
              ))}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <Trophees data={data} tx={tx} />
            {data.precedente && <Precedente precedente={data.precedente} tx={tx} />}
            <Comment tx={tx} />
            {data.semaine.majLe && <p className="font-mono text-xs text-texte-gris">{tx("coupe.maj", { v: { heure: heure(data.semaine.majLe) } })}</p>}
          </div>
        </div>
      )}

      {data.personnel && data.historique && <Historique historique={data.historique} tx={tx} />}
      {data.personnel && data.actes && <Actes actes={data.actes} tx={tx} />}
    </Page>
  );
}

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-extrabold">{titre}</h2>
      {children}
    </section>
  );
}

function QueteClasse({ classe, tx }: { classe: NonNullable<CoupeDto["maClasse"]>; tx: Tx }) {
  if (!classe.classee) return <Carte className="text-[15px] text-texte-doux">{tx("coupe.maClasse.petite")}</Carte>;
  const reste = Math.max(0, classe.objectifEquipe - classe.participants);
  return (
    <Carte className="flex flex-col gap-3 border-orange bg-orange-pale">
      <span className="font-mono text-xs uppercase tracking-wider text-orange-fonce">{tx("coupe.maClasse.titre")}</span>
      <p className="text-lg font-extrabold leading-snug">{classe.nom}</p>
      <p className="text-[15px] font-bold">{tx("coupe.maClasse.quete", { v: { p: classe.participants, i: classe.inscrits } })}</p>
      <div className="relative">
        <BarreProgression valeur={(classe.participants / Math.max(1, classe.inscrits)) * 100} ton={reste === 0 ? "succes" : "orange"} className="h-2.5" />
        {/* Repère des 70 % (trophée Équipe). */}
        <span className="absolute -top-1 h-[18px] w-0.5 rounded bg-encre" style={{ left: "70%" }} aria-hidden />
      </div>
      <p className="text-[15px] text-texte-doux">{reste === 0 ? tx("coupe.maClasse.atteint") : tx("coupe.maClasse.reste", { v: { n: reste } })}</p>
    </Carte>
  );
}

function Progression({ n, personnel, tx }: { n: number | null; personnel: boolean; tx: Tx }) {
  if (n === null) return null;
  if (n > 0)
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-succes">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden />
        {tx("coupe.hausse", { v: { n } })}
      </span>
    );
  // Une baisse n'est montrée qu'à l'équipe.
  if (!personnel) return null;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-texte-gris">
      {n < 0 ? <TrendingDown className="h-3.5 w-3.5" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
      {n < 0 ? `${String(n).replace("-", "−")} pts` : "="}
    </span>
  );
}

function Liste({ liste, personnel, moiLibelle, tx }: { liste: ListeCoupe; personnel: boolean; moiLibelle: string; tx: Tx }) {
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {liste.haut.map((e) => (
          <Ligne key={e.id} e={e} personnel={personnel} moiLibelle={moiLibelle} tx={tx} />
        ))}
      </ol>
      {liste.autres.length > 0 &&
        (personnel ? (
          // Équipe : les classes de moins de 5 étudiants, repliées (elles comptent pour leur campus).
          <details className="group mt-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold text-texte-doux">
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
              {tx("coupe.horsClassement.voir", { v: { n: liste.autres.length } })}
            </summary>
            <p className="mb-2 text-xs text-texte-gris">{tx("coupe.horsClassement")}</p>
            <ul className="flex flex-col gap-2">
              {liste.autres.map((e) => (
                <Ligne key={e.id} e={e} personnel moiLibelle={moiLibelle} tx={tx} />
              ))}
            </ul>
          </details>
        ) : (
          <>
            <p className="mt-2 text-sm text-texte-pale">{tx("coupe.autres")}</p>
            <ul className="flex flex-col divide-y divide-ligne-douce rounded-2xl border border-ligne bg-white px-4">
              {liste.autres.map((e) => (
                <li key={e.id} className={cn("flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2", e.moi && "font-bold")}>
                  <span className="min-w-0">
                    {e.nom}
                    {e.moi && <Moi libelle={moiLibelle} />}
                  </span>
                  {e.progression ? <Progression n={e.progression} personnel={false} tx={tx} /> : <span className="text-sm text-texte-gris">{tx("coupe.relance")}</span>}
                </li>
              ))}
            </ul>
          </>
        ))}
    </div>
  );
}

/** « ton campus », « ta classe » : la personne repère le sien sans qu'aucun étudiant soit nommé. */
function Moi({ libelle }: { libelle: string }) {
  return <span className="ml-1.5 whitespace-nowrap rounded-full bg-orange-clair px-2 py-0.5 font-mono text-[11px] font-normal text-orange-profond">{libelle}</span>;
}

function Ligne({ e, personnel, moiLibelle, tx }: { e: EntreeCoupe; personnel: boolean; moiLibelle: string; tx: Tx }) {
  const d = e.detail;
  return (
    <li className={cn("flex flex-col gap-2 rounded-2xl border bg-white px-4 py-3", e.moi ? "border-orange" : "border-ligne")}>
      <div className="flex items-center gap-3">
        {e.rang !== null ? (
          <span className={cn("grid h-10 min-w-10 shrink-0 place-items-center rounded-full px-1.5 font-mono text-sm font-bold", e.rang === 1 ? "bg-encre text-white" : "bg-creme text-encre")}>
            {rangTexte(tx, e.rang)}
          </span>
        ) : (
          <span className="h-10 w-10 shrink-0" aria-hidden />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold leading-snug">
            {e.nom}
            {e.moi && <Moi libelle={moiLibelle} />}
          </span>
          <span className="text-[13px] text-texte-pale">
            {e.participation !== null && tx("coupe.participation", { v: { n: e.participation } })}
            {e.presence !== null && ` · ${tx("coupe.presence", { v: { n: e.presence } })}`}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          {e.score !== null && <span className="text-2xl font-black tabular-nums">{tx("coupe.score", { v: { n: e.score } })}</span>}
          <Progression n={e.progression} personnel={personnel} tx={tx} />
        </span>
      </div>
      {e.trophees.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 pl-[52px]">
          {e.trophees.map((tr) => (
            <li key={tr} className="inline-flex items-center gap-1 rounded-full bg-orange-clair px-2.5 py-1 text-xs font-bold text-orange-profond">
              <IconeTrophee trophee={tr} className="h-3.5 w-3.5" />
              {tx(`trophee.${tr}`)}
            </li>
          ))}
        </ul>
      )}
      {personnel && d && (
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 border-t border-ligne-douce pt-2 text-[12px] leading-tight sm:grid-cols-5">
          <Chiffre libelle={tx("coupe.col.inscrits")} valeur={String(d.inscrits)} />
          <Chiffre libelle={tx("coupe.col.participation")} valeur={`${d.participants}/${d.inscrits}`} />
          <Chiffre libelle={tx("coupe.col.assidus")} valeur={String(d.assidus)} />
          <Chiffre libelle={tx("coupe.col.points")} valeur={String(d.pointsMoyens)} />
          <Chiffre libelle={tx("coupe.col.presence")} valeur={e.presence === null ? tx("coupe.nonMesure") : d.seances === 1 ? tx("coupe.seances1") : tx("coupe.seances", { v: { n: d.seances } })} large />
        </dl>
      )}
    </li>
  );
}

function Chiffre({ libelle, valeur, large }: { libelle: string; valeur: string; large?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col", large && "col-span-2 sm:col-span-1")}>
      <dt className="text-texte-gris">{libelle}</dt>
      <dd className="font-mono font-bold tabular-nums">{valeur}</dd>
    </div>
  );
}

function Trophees({ data, tx }: { data: CoupeDto; tx: Tx }) {
  const toutes = [data.campus, ...data.ligues].flatMap((l) => [...l.haut, ...l.autres]);
  const tenants = (tr: Trophee) => toutes.filter((e) => e.trophees.includes(tr)).map((e) => e.nom);
  return (
    <Carte className="flex flex-col gap-3">
      <h2 className="text-xl font-extrabold">{tx("coupe.trophees.titre")}</h2>
      {data.semaine.essai && <p className="text-sm text-texte-pale">{tx("coupe.trophees.essai")}</p>}
      <ul className="flex flex-col gap-3">
        {TROPHEES.map((tr) => {
          const noms = tenants(tr);
          return (
            <li key={tr} className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-encre text-orange">
                <IconeTrophee trophee={tr} className="h-5 w-5" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-bold">{tx(`trophee.${tr}`)}</span>
                <span className="text-[13px] text-texte-pale">{tx(`trophee.${tr}.desc`)}</span>
                {!data.semaine.essai && (
                  <span className="text-[13px] text-texte-doux">{noms.length ? tx("coupe.trophees.enTete", { v: { noms: noms.join(", ") } }) : tx("coupe.trophees.personne")}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}

function Precedente({ precedente, tx }: { precedente: NonNullable<CoupeDto["precedente"]>; tx: Tx }) {
  if (!precedente.laureats.length) return <p className="text-sm text-texte-pale">{tx("coupe.precedente.aucun", { v: { n: precedente.numero } })}</p>;
  return (
    <Carte className="flex flex-col gap-2">
      <h2 className="text-lg font-extrabold">{tx("coupe.precedente", { v: { n: precedente.numero } })}</h2>
      <ul className="flex flex-col gap-1.5 text-[15px]">
        {precedente.laureats.map((l) => (
          <li key={`${l.trophee}|${l.portee}|${l.nom}`} className="flex items-center gap-2">
            <IconeTrophee trophee={l.trophee} className="h-4 w-4 shrink-0 text-orange-fonce" />
            <span className="min-w-0">
              <span className="font-bold">{tx(`trophee.${l.trophee}`)}</span> · {l.nom}
            </span>
          </li>
        ))}
      </ul>
    </Carte>
  );
}

function Comment({ tx }: { tx: Tx }) {
  return (
    <details className="group rounded-2xl border border-ligne bg-white p-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-lg font-extrabold">
        <Info className="h-5 w-5 text-orange-fonce" aria-hidden />
        {tx("coupe.comment.titre")}
      </summary>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] text-texte-doux">
        <li>{tx("coupe.comment.participer")}</li>
        <li>{tx("coupe.comment.salle")}</li>
        <li>{tx("coupe.comment.classes")}</li>
        <li>{tx("coupe.principe")}</li>
      </ul>
    </details>
  );
}

function Historique({ historique, tx }: { historique: NonNullable<CoupeDto["historique"]>; tx: Tx }) {
  return (
    <Section titre={tx("coupe.historique.titre")}>
      <div className="overflow-x-auto rounded-2xl border border-ligne bg-white">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-ligne-douce text-left font-mono text-texte-gris">
              <th className="sticky left-0 bg-white px-3 py-2 font-normal">{tx("coupe.historique.col")}</th>
              {/* La semaine en cours d'abord : elle reste visible sur un téléphone. */}
              {[...historique.semaines].reverse().map((s) => (
                <th key={s.iso} className="px-2 py-2 text-right font-normal">
                  S{s.numero}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historique.lignes.map((l) => (
              <tr key={`${l.portee}:${l.id}`} className={cn("border-b border-ligne-douce last:border-0", l.portee === "campus" && "font-bold")}>
                <td className="sticky left-0 max-w-[180px] truncate bg-white px-3 py-2" title={l.nom}>
                  {l.nom}
                </td>
                {[...l.scores].reverse().map((s, i) => (
                  <td key={i} className="px-2 py-2 text-right font-mono tabular-nums">
                    {s === null ? "·" : `${s} %`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Actes({ actes, tx }: { actes: NonNullable<CoupeDto["actes"]>; tx: Tx }) {
  return (
    <Section titre={tx("coupe.actes.titre")}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {actes.map((c) => {
          const familles = FAMILLES.filter((f) => (c.actes[f] ?? 0) > 0);
          return (
            <li key={c.id} className="rounded-2xl border border-ligne bg-white p-4">
              <p className="font-bold">{c.nom}</p>
              {familles.length ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {familles.map((f) => (
                    <li key={f} className="rounded-full bg-creme px-2.5 py-1 text-xs">
                      {tx(`famille.${f}`)} <span className="font-mono font-bold">{c.actes[f]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-texte-pale">{tx("coupe.actes.aucun")}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
