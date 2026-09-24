// /pilotage/ia : ce que coûte l'assistant IA. Consommation par jour sur
// 30 jours et par personne (les 10 plus gros consommateurs), au prix de
// claude-opus-5 (5 $ par million de jetons en entrée, 25 $ en sortie).
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, CircleOff, Table2, BarChart3 } from "lucide-react";
import type { BudgetIa, ConsommationIa } from "@shared/schema";
import { FCFA_PAR_DOLLAR, LIBELLES_ROLES } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Chiffre, Chargement, Erreur, EtatVide, Badge } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { cn } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";

const nombre = new Intl.NumberFormat("fr-FR");
const dollars = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
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
        sousTitre={data ? `30 derniers jours, au prix de ${data.modele} : ${data.prix.entree} $ par million de jetons lus, ${data.prix.sortie} $ par million de jetons écrits.` : "Consommation des 30 derniers jours."}
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
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Chiffres clés">
            <Chiffre libelle="Coût estimé · 30 j" valeur={dollars(data.total.cout)} detail={fcfa(data.total.cout)} ton="orange" />
            <Chiffre libelle="Moyenne par jour" valeur={dollars(data.total.cout / 30)} detail={fcfa(data.total.cout / 30)} />
            <Chiffre libelle="Questions posées" valeur={nombre.format(data.total.requetes)} detail={`quota : ${data.quotaJour} par étudiant et par jour`} />
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

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
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
                  Coût estimé à partir des jetons comptés à chaque réponse. La facture réelle peut différer légèrement (mise en cache des cours, arrondis).
                </p>
              </Carte>
            </section>
          </div>
        </>
      ) : null}
    </Page>
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
              {t.toLocaleString("fr-FR")} $
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
        {jours.map((d, i) =>
          i % Math.ceil(jours.length / Math.max(2, Math.floor(zone.l / 64))) === 0 || i === jours.length - 1 ? (
            <text key={d.jour} x={marge.gauche + i * pasX + pasX / 2} y={hauteur - 8} textAnchor="middle" className="fill-texte-gris font-mono text-[11px]">
              {jourCourt(d.jour)}
            </text>
          ) : null,
        )}
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
      <Badge ton="gris" className="mt-2">
        Prix appliqués : 5 $ / M jetons lus, 25 $ / M jetons écrits
      </Badge>
    </div>
  );
}
