// /pilotage/ia : ce que coûte l'IA. Le mois en cours face au budget fixé par
// la direction (l'IA se met en pause une fois le budget atteint), les réglages
// (budget, questions par jour), les modèles utilisés, puis la consommation par
// jour sur 30 jours et par personne. Coût réel enregistré à chaque réponse.
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, CircleOff, Table2, BarChart3, Wallet } from "lucide-react";
import type { BudgetIa, ConsommationIa, ReglagesIaDto } from "@shared/schema";
import { FCFA_PAR_DOLLAR, LIBELLES_ROLES } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Chiffre, Chargement, Erreur, EtatVide, BarreProgression } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import { patch } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { toast, toastErreur } from "@/components/ui/toast";
import { Carte, TitreSection } from "@/components/ui/carte";
import { cn } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";

const nombre = new Intl.NumberFormat("fr-FR");
const dollars = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0$`;
const fcfa = (n: number) => `≈ ${nombre.format(Math.round((n * FCFA_PAR_DOLLAR) / 100) * 100)} FCFA`;
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(n));
const jourCourt = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

export default function PageIa() {
  const { data, isLoading, error, refetch } = useQuery<BudgetIa>({ queryKey: ["/api/pilotage/ia"] });
  const [tableau, setTableau] = useState(false);

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Budget IA"
        titre="Budget de l'assistant IA"
        sousTitre="Le budget du mois, les réglages et la consommation des 30 derniers jours, au prix réel de chaque réponse."
      />
      {data && !data.iaDisponible && (
        <div className="flex items-start gap-3 rounded-2xl bg-alerte-clair p-4 text-[15px] text-alerte">
          <CircleOff className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>L'assistant IA n'est pas configuré sur ce campus</strong> (clé ANTHROPIC_API_KEY absente) : aucune dépense n'est possible. Les fonctions IA affichent leur solution de repli ; les chiffres ci-dessous sont ceux déjà enregistrés.
          </p>
        </div>
      )}
      {isLoading ? (
        <Chargement lignes={3} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : data ? (
        <>
          <BudgetDuMois data={data} />

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Chiffres clés">
            <Chiffre libelle="Coût sur 30 jours" valeur={dollars(data.total.cout)} detail={fcfa(data.total.cout)} ton="orange" />
            <Chiffre libelle="Moyenne par jour" valeur={dollars(data.total.cout / 30)} detail={fcfa(data.total.cout / 30)} />
            <Chiffre libelle="Questions posées" valeur={nombre.format(data.total.requetes)} detail={`limite : ${data.reglages.quotaEtudiant} par étudiant et par jour`} />
            <Chiffre libelle="Jetons" valeur={compact(data.total.jetonsEntree + data.total.jetonsSortie)} detail={`${compact(data.total.jetonsEntree)} lus · ${compact(data.total.jetonsSortie)} écrits`} />
          </section>

          <section>
            <TitreSection
              titre="Coût par jour"
              action={
                <Bouton variante="fantome" taille="sm" icone={tableau ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />} onClick={() => setTableau((t) => !t)}>
                  {tableau ? "Voir le graphique" : "Voir le tableau"}
                </Bouton>
              }
            />
            <Carte>
              {data.total.requetes === 0 ? (
                <EtatVide icone={<Sparkles className="h-6 w-6" />} titre="Aucune question à l'assistant ces 30 jours." texte="La consommation apparaîtra ici jour par jour, dès que les étudiants et les formateurs utiliseront l'assistant." />
              ) : tableau ? (
                <TableauJours jours={data.parJour} />
              ) : (
                <Histogramme jours={data.parJour} />
              )}
            </Carte>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section>
              <TitreSection titre="Les 10 plus gros consommateurs" />
              <Carte className="p-0">
                {!data.parPersonne.length ? (
                  <p className="p-5 text-[15px] text-texte-pale">Personne n'a encore utilisé l'assistant.</p>
                ) : (
                  <ol className="divide-y divide-ligne-douce">
                    {data.parPersonne.map((p, i) => (
                      <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="w-5 font-mono text-sm text-texte-gris">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          {p.role === "etudiant" ? (
                            <Link href={`/pilotage/etudiants/${p.id}`} className="font-bold text-encre no-underline hover:text-orange-fonce">
                              {p.prenom} {p.nom}
                            </Link>
                          ) : (
                            <span className="font-bold">
                              {p.prenom} {p.nom}
                            </span>
                          )}
                          <div className="text-[13px] text-texte-gris">
                            {LIBELLES_ROLES[p.role]}
                            {p.site ? ` · ${p.site}` : ""} · {nombre.format(p.requetes)} questions
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F3EAE2]">
                            <div className="h-full rounded-full bg-orange" style={{ width: `${Math.max(2, (p.cout / (data.parPersonne[0]?.cout || 1)) * 100)}%` }} />
                          </div>
                        </div>
                        <span className="font-bold tabular-nums">{dollars(p.cout)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Carte>
            </section>
            <section>
              <TitreSection titre="Par profil" />
              <Carte className="flex flex-col gap-3">
                {!data.parRole.length ? (
                  <p className="text-[15px] text-texte-pale">Rien à afficher pour l'instant.</p>
                ) : (
                  data.parRole.map((r) => <LigneRole key={r.role} libelle={LIBELLES_ROLES[r.role]} c={r} total={data.total.cout} />)
                )}
                <p className="border-t border-ligne-douce pt-3 text-sm text-texte-pale">
                  Coût calculé à chaque réponse, au prix du modèle qui a répondu (lecture du cache comprise). Les journées d'avant le 5 octobre 2026 sont estimées à l'ancien prix unique. La facture d'Anthropic peut différer de quelques centimes.
                </p>
              </Carte>
            </section>
          </div>
        </>
      ) : null}
    </Page>
  );
}

function BudgetDuMois({ data }: { data: BudgetIa }) {
  const m = data.mois;
  const pourcent = Math.round(m.part * 100);
  const nomMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m.mois}-15T12:00:00Z`));
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" aria-label="Budget du mois">
      <Carte className="flex flex-col gap-3">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">
          <Wallet className="h-4 w-4" aria-hidden /> Budget de {nomMois}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-black tabular-nums">{dollars(m.depenseUsd)}</span>
          <span className="text-texte-pale">sur {dollars(m.budgetUsd)} · {pourcent} %</span>
        </div>
        <BarreProgression valeur={pourcent} className="h-2.5" />
        {m.atteint ? (
          <p className="rounded-xl bg-alerte-clair p-3 text-[15px] text-alerte">
            <strong>Budget atteint : l'assistant et la bibliothèque sont en pause</strong> jusqu'au 1er du mois prochain. Relevez le budget ci-contre pour les rouvrir tout de suite.
          </p>
        ) : (
          <p className="text-[15px] text-texte-pale">
            Au rythme actuel, environ <strong className="text-encre">{dollars(m.projectionUsd)}</strong> sur le mois ({fcfa(m.projectionUsd)}). La direction reçoit une alerte à 50 %, 80 % et 100 %. Une fois le budget atteint, l'IA se met en pause jusqu'au 1er du mois suivant.
          </p>
        )}
        <ul className="flex flex-col gap-1.5 border-t border-ligne-douce pt-3 text-sm">
          {data.modeles.map((mo) => (
            <li key={mo.usage} className="flex flex-wrap justify-between gap-x-3">
              <span className="text-texte-pale">{mo.usage}</span>
              <span className="font-semibold">
                {mo.nom} <span className="font-mono text-xs font-normal text-texte-gris">{mo.entree} $ / {mo.sortie} $ par M jetons</span>
              </span>
            </li>
          ))}
        </ul>
      </Carte>
      <ReglagesIa reglages={data.reglages} modifiable={data.modifiable} />
    </section>
  );
}

function ReglagesIa({ reglages, modifiable }: { reglages: ReglagesIaDto; modifiable: boolean }) {
  const [budget, setBudget] = useState(String(reglages.budgetMensuelUsd));
  const [etudiant, setEtudiant] = useState(String(reglages.quotaEtudiant));
  const [personnel, setPersonnel] = useState(String(reglages.quotaPersonnel));
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    setBudget(String(reglages.budgetMensuelUsd));
    setEtudiant(String(reglages.quotaEtudiant));
    setPersonnel(String(reglages.quotaPersonnel));
  }, [reglages]);
  const nombreDe = (v: string) => Number(v.replace(",", ".").replace(/\s/g, ""));
  const enregistrer = async () => {
    setEnvoi(true);
    try {
      await patch<ReglagesIaDto>("/api/pilotage/ia/reglages", { budgetMensuelUsd: nombreDe(budget), quotaEtudiant: Math.round(nombreDe(etudiant)), quotaPersonnel: Math.round(nombreDe(personnel)) });
      toast("Réglages de l'IA enregistrés.");
      await rafraichir("/api/pilotage/ia", "/api/ia/etat");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Carte className="flex flex-col gap-3">
      <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">Réglages</h2>
      <Champ libelle="Budget du mois (dollars)" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} disabled={!modifiable} aide={fcfa(nombreDe(budget) || 0)} />
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle="Questions par étudiant et par jour" inputMode="numeric" value={etudiant} onChange={(e) => setEtudiant(e.target.value)} disabled={!modifiable} />
        <Champ libelle="Demandes du personnel par jour" inputMode="numeric" value={personnel} onChange={(e) => setPersonnel(e.target.value)} disabled={!modifiable} />
      </div>
      {modifiable ? (
        <Bouton onClick={() => void enregistrer()} chargement={envoi} className="self-start">
          Enregistrer
        </Bouton>
      ) : (
        <p className="text-sm text-texte-gris">Seule la direction peut modifier ces réglages.</p>
      )}
      <p className="text-sm text-texte-pale">
        Pensez aussi à fixer une limite de dépense dans la console d'Anthropic : c'est le filet de sécurité de la facture, même si le campus se trompait.
      </p>
    </Carte>
  );
}

function LigneRole({ libelle, c, total }: { libelle: string; c: ConsommationIa; total: number }) {
  const part = total > 0 ? Math.round((c.cout / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold">{libelle}</span>
        <span className="tabular-nums">
          {dollars(c.cout)} <span className="text-sm text-texte-gris">· {part} %</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F3EAE2]">
        <div className="h-full rounded-full bg-orange" style={{ width: `${part}%` }} />
      </div>
      <div className="mt-1 text-[13px] text-texte-gris">{nombre.format(c.requetes)} questions</div>
    </div>
  );
}

/** Graduations « propres » de l'axe : 0, 0,5, 1, 1,5… */
function graduations(max: number): number[] {
  if (max <= 0) return [0];
  const brut = max / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? brut;
  const n = Math.ceil(max / pas);
  return Array.from({ length: n + 1 }, (_, i) => Math.round(i * pas * 1000) / 1000);
}

/** Histogramme d'une seule série (le coût du jour) : barres fines, info-bulle au survol et au clavier. */
function Histogramme({ jours }: { jours: BudgetIa["parJour"] }) {
  const boite = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(600);
  const [survol, setSurvol] = useState<number | null>(null);
  useEffect(() => {
    const el = boite.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setLargeur(Math.max(280, e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hauteur = 220;
  const marge = { gauche: 44, droite: 8, haut: 12, bas: 28 };
  const ticks = graduations(Math.max(...jours.map((j) => j.cout), 0.01));
  const max = ticks[ticks.length - 1] || 1;
  const zone = { l: largeur - marge.gauche - marge.droite, h: hauteur - marge.haut - marge.bas };
  const pasX = zone.l / jours.length;
  const barre = Math.min(24, Math.max(3, pasX - 2));
  const y = (v: number) => marge.haut + zone.h - (v / max) * zone.h;
  const j = survol !== null ? jours[survol] : null;

  return (
    <div ref={boite} className="relative">
      <svg width={largeur} height={hauteur} role="img" aria-label="Coût estimé de l'assistant IA par jour, sur 30 jours" className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={marge.gauche} x2={largeur - marge.droite} y1={y(t)} y2={y(t)} stroke="#EFE7E0" strokeWidth={1} />
            <text x={marge.gauche - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-texte-gris font-mono text-[11px]">
              {t.toLocaleString("fr-FR")}{"\u00a0"}$
            </text>
          </g>
        ))}
        {jours.map((d, i) => {
          const x = marge.gauche + i * pasX + (pasX - barre) / 2;
          const h = Math.max(d.cout > 0 ? 2 : 0, (d.cout / max) * zone.h);
          const r = Math.min(4, barre / 2, h);
          const base = marge.haut + zone.h;
          // Extrémité arrondie de 4 px, carrée sur la ligne de base.
          const chemin = h > 0 ? `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barre - r} Q${x + barre},${base - h} ${x + barre},${base - h + r} V${base} Z` : "";
          return (
            <g key={d.jour}>
              {chemin && <path d={chemin} className={cn(survol === i ? "fill-orange-fonce" : "fill-orange")} />}
              <rect
                x={marge.gauche + i * pasX}
                y={marge.haut}
                width={pasX}
                height={zone.h}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${jourCourt(d.jour)} : ${dollars(d.cout)}, ${d.requetes} questions`}
                onPointerEnter={() => setSurvol(i)}
                onPointerLeave={() => setSurvol(null)}
                onFocus={() => setSurvol(i)}
                onBlur={() => setSurvol(null)}
                className="cursor-crosshair outline-none"
              />
            </g>
          );
        })}
        <line x1={marge.gauche} x2={largeur - marge.droite} y1={marge.haut + zone.h} y2={marge.haut + zone.h} stroke="#E6DCD3" strokeWidth={1} />
        {jours.map((d, i) => {
          // Étiquettes régulières, calées sur le dernier jour (toujours affiché, aligné à droite).
          const pas = Math.ceil(jours.length / Math.max(2, Math.floor(zone.l / 84)));
          const dernier = i === jours.length - 1;
          if ((jours.length - 1 - i) % pas !== 0) return null;
          return (
            <text
              key={d.jour}
              x={dernier ? largeur - marge.droite : marge.gauche + i * pasX + pasX / 2}
              y={hauteur - 8}
              textAnchor={dernier ? "end" : "middle"}
              className="fill-texte-gris font-mono text-[11px]"
            >
              {jourCourt(d.jour)}
            </text>
          );
        })}
      </svg>
      {j && survol !== null && (
        <div
          className="pointer-events-none absolute z-10 min-w-[150px] rounded-xl border border-ligne bg-white px-3 py-2 text-sm shadow-carte"
          style={{ left: Math.min(largeur - 160, Math.max(0, marge.gauche + survol * pasX - 60)), top: 0 }}
          role="status"
        >
          <div className="text-lg font-black tabular-nums">{dollars(j.cout)}</div>
          <div className="text-texte-pale">{jourCourt(j.jour)} · {j.requetes} questions</div>
          <div className="font-mono text-xs text-texte-gris">
            {compact(j.jetonsEntree)} lus · {compact(j.jetonsSortie)} écrits
          </div>
        </div>
      )}
    </div>
  );
}

function TableauJours({ jours }: { jours: BudgetIa["parJour"] }) {
  const actifs = [...jours].reverse().filter((j) => j.requetes > 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[15px]">
        <thead className="font-mono text-xs uppercase tracking-wider text-texte-gris">
          <tr>
            <th className="py-2 pr-3">Jour</th>
            <th className="py-2 pr-3 text-right">Questions</th>
            <th className="py-2 pr-3 text-right">Jetons lus</th>
            <th className="py-2 pr-3 text-right">Jetons écrits</th>
            <th className="py-2 text-right">Coût</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ligne-douce tabular-nums">
          {actifs.map((j) => (
            <tr key={j.jour}>
              <td className="py-2 pr-3">{jourCourt(j.jour)}</td>
              <td className="py-2 pr-3 text-right">{nombre.format(j.requetes)}</td>
              <td className="py-2 pr-3 text-right">{nombre.format(j.jetonsEntree)}</td>
              <td className="py-2 pr-3 text-right">{nombre.format(j.jetonsSortie)}</td>
              <td className="py-2 text-right font-bold">{dollars(j.cout)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {actifs.length < jours.length && <p className="mt-2 text-sm text-texte-gris">Les jours sans aucune question sont omis.</p>}
    </div>
  );
}
