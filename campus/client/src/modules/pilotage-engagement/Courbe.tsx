// Graphiques du tableau « Engagement et participation » (chantier C8), sans
// bibliothèque : colonnes en HTML (nettes à toutes les largeurs, du téléphone
// de 360 px à l'ordinateur), traits fins, coins arrondis côté données, écart de
// 2 px entre les segments, grille en filets. Chaque colonne est un bouton :
// toucher ou survoler affiche son détail sous le graphique (jamais seulement au
// survol), et un tableau des chiffres reste accessible sans graphique.
import { useEffect, useRef, useState } from "react";
import type { JourActivite, RepartitionPlateformes, SemaineApprentissage, TroisEtats } from "@shared/engagement/indicateurs";
import { PLATEFORMES } from "@shared/engagement/indicateurs";
import { t, selonNombre } from "@shared/textes/engagement";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";

/** Couleurs des séries (validées : écart de couleur suffisant pour les daltoniens, contraste ≥ 3:1 sur blanc). */
export const COULEURS = {
  cours: "#2A78D6",
  sansCours: "#C85F22",
  ouvertSeul: "#E2D8CF",
  present: "#1F8A5B",
  absent: "#C2410C",
  inconnu: "#CFC6BE",
  // Plateformes : rampe ordonnée « téléphone d'abord » (orange, du plus foncé au plus clair), puis gris.
  android_app: "#7C3A12",
  installee: "#B85620",
  mobile: "#E0844A",
  ordinateur: "#8A7F76",
  inconnue: "#E6DCD3",
} as const;

/** Hachures à 45° : la présence inconnue se reconnaît sans la couleur (daltonisme, impression). */
export const HACHURES_INCONNU = `repeating-linear-gradient(45deg, ${COULEURS.inconnu} 0 4px, #E9E2DB 4px 7px)`;

const fmtJourCourt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtJourLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
/** « 8 oct. » pour un jour « AAAA-MM-JJ » (date civile : pas de décalage horaire). */
export const jourCourt = (j: string) => fmtJourCourt.format(new Date(`${j}T12:00:00Z`));
export const jourLongCivil = (j: string) => fmtJourLong.format(new Date(`${j}T12:00:00Z`));
const estLundi = (j: string) => new Date(`${j}T12:00:00Z`).getUTCDay() === 1;

/** Graduation ronde (1, 2, 5, 10, 20, 50…) au-dessus du maximum. */
function plafond(max: number): number {
  if (max <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

export function Legende({ elements, className }: { elements: { couleur: string; libelle: string; fond?: string }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-texte-doux", className)}>
      {elements.map((e) => (
        <li key={e.libelle} className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: e.fond ?? e.couleur }} />
          {e.libelle}
        </li>
      ))}
    </ul>
  );
}

/** Grille de fond : filets fins aux graduations (0, la moitié et le plafond par défaut), avec leurs valeurs. */
function Grille({ max, hauteur, graduations = [max, max / 2, 0] }: { max: number; hauteur: number; graduations?: number[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={{ height: hauteur }}>
      {graduations.map((v) => (
        <div key={v} className="absolute left-0 right-0 border-t border-ligne-douce" style={{ top: hauteur - (v / max) * hauteur }}>
          <span className="absolute -left-7 -top-1.5 w-6 text-right font-mono text-[10px] leading-none text-texte-gris">{String(v).replace(".", ",")}</span>
        </div>
      ))}
    </div>
  );
}

/** Largeur d'un élément, suivie quand l'écran tourne ou que la fenêtre change de taille. */
function useLargeur<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(([e]) => setLargeur(e.contentRect.width));
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return [ref, largeur] as const;
}

/**
 * Repères de l'axe des jours : le premier, le dernier et des lundis espacés d'au
 * moins 64 px (la largeur d'une date et sa marge), pour ne jamais se chevaucher.
 */
function reperes(jours: { jour: string }[], largeur: number): number[] {
  const n = jours.length;
  const pas = Math.max(2, Math.ceil(largeur > 0 ? (n * 64) / largeur : n / 4));
  const liste = [0];
  for (let i = 1; i < n - 1; i++) if (estLundi(jours[i].jour) && i - liste[liste.length - 1] >= pas && n - 1 - i >= pas) liste.push(i);
  if (n > 1) liste.push(n - 1);
  return liste;
}

// ── Étudiants actifs jour par jour ─────────────────────────────────────────

export function CourbeJours({ jours }: { jours: JourActivite[] }) {
  const tx = useTextes(t);
  const [choisi, setChoisi] = useState<string | null>(null);
  const hauteur = 168;
  const total = (j: JourActivite) => Math.max(j.ouverts ?? 0, j.apprenantsCours + j.apprenantsSansCours);
  const max = plafond(Math.max(1, ...jours.map(total)));
  const actif = jours.find((j) => j.jour === choisi) ?? jours.at(-1);
  // « 1 action », « 2 actions » : chaque nombre accordé.
  const detail = (j: JourActivite) => {
    const ac = selonNombre(tx, "courbe.actions", j.apprenantsCours);
    const asc = selonNombre(tx, "courbe.actions", j.apprenantsSansCours);
    return j.ouverts === null
      ? tx("courbe.detailSansOuverture", { v: { jour: jourLongCivil(j.jour), ac, asc } })
      : tx("courbe.detail", { v: { jour: jourLongCivil(j.jour), ac, asc, o: selonNombre(tx, "courbe.ouvertures", total(j)) } });
  };
  const etroit = jours.length > 45;
  const [axe, largeurAxe] = useLargeur<HTMLDivElement>();
  return (
    <figure className="flex flex-col gap-3">
      <Legende
        elements={[
          { couleur: COULEURS.cours, libelle: tx("courbe.cours") },
          { couleur: COULEURS.sansCours, libelle: tx("courbe.sansCours") },
          { couleur: COULEURS.ouvertSeul, libelle: tx("courbe.ouvertSeul") },
        ]}
      />
      <div className="relative pl-7">
        <div className="relative" style={{ height: hauteur }}>
          <Grille max={max} hauteur={hauteur} />
          <div className="absolute inset-0 flex items-end" role="list">
            {jours.map((j) => {
              const h = (n: number) => (n / max) * hauteur;
              const seul = Math.max(0, (j.ouverts ?? 0) - j.apprenantsCours - j.apprenantsSansCours);
              const selection = actif?.jour === j.jour;
              return (
                <button
                  key={j.jour}
                  type="button"
                  role="listitem"
                  aria-label={detail(j)}
                  aria-pressed={selection}
                  onClick={() => setChoisi(j.jour)}
                  onMouseEnter={() => setChoisi(j.jour)}
                  onFocus={() => setChoisi(j.jour)}
                  className={cn("group relative h-full min-w-0 flex-1 rounded-t-[4px] outline-none", etroit ? "px-px" : "px-[1px] sm:px-[3px]", selection && "bg-creme")}
                >
                  <span className="mx-auto flex h-full w-full max-w-6 flex-col-reverse">
                  {/* Empilement du bas vers le haut : jour de cours, jour sans cours, ouverture seule. */}
                  {[
                    { n: j.apprenantsCours, c: COULEURS.cours },
                    { n: j.apprenantsSansCours, c: COULEURS.sansCours },
                    { n: seul, c: COULEURS.ouvertSeul },
                  ]
                    .filter((s) => s.n > 0)
                    .map((s, i, liste) => (
                      <span
                        key={s.c}
                        className={cn("block w-full shrink-0", i < liste.length - 1 && "mt-[2px]", i === liste.length - 1 && "rounded-t-[4px]")}
                        style={{ height: Math.max(2, h(s.n) - (i < liste.length - 1 ? 2 : 0)), background: s.c }}
                      />
                    ))}
                  </span>
                  {j.ouverts === null && <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-ligne" />}
                  <span aria-hidden className="absolute inset-0 group-focus-visible:ring-2 group-focus-visible:ring-orange" />
                </button>
              );
            })}
          </div>
        </div>
        <div ref={axe} aria-hidden className="relative mt-1.5 h-3 font-mono text-[10px] leading-none text-texte-gris">
          {reperes(jours, largeurAxe).map((i, k, liste) => (
            <span
              key={jours[i].jour}
              className="absolute whitespace-nowrap"
              style={
                k === 0
                  ? { left: 0 }
                  : k === liste.length - 1
                    ? { right: 0 }
                    : { left: `${((i + 0.5) / jours.length) * 100}%`, transform: "translateX(-50%)" }
              }
            >
              {jourCourt(jours[i].jour)}
            </span>
          ))}
        </div>
      </div>
      {actif && (
        <figcaption className="rounded-xl bg-creme px-3 py-2 text-sm text-texte-doux" aria-live="polite">
          {detail(actif)}
        </figcaption>
      )}
      <details className="text-sm">
        <summary className="min-h-[44px] cursor-pointer py-2 font-bold text-texte-doux">{tx("commun.voirChiffres")}</summary>
        <div className="max-h-72 overflow-auto rounded-xl border border-ligne">
          <table className="w-full text-left text-[13px] tabular-nums">
            <thead className="sticky top-0 bg-creme font-mono text-[11px] uppercase text-texte-gris">
              <tr>
                <th className="px-2 py-1.5">{tx("courbe.colonneJour")}</th>
                <th className="px-2 py-1.5">{tx("courbe.cours")}</th>
                <th className="px-2 py-1.5">{tx("courbe.sansCours")}</th>
                <th className="px-2 py-1.5">{tx("courbe.colonneOuverts")}</th>
                <th className="px-2 py-1.5">{tx("courbe.colonneAvecCours")}</th>
                <th className="px-2 py-1.5">{tx("courbe.colonneInscrits")}</th>
              </tr>
            </thead>
            <tbody>
              {[...jours].reverse().map((j) => (
                <tr key={j.jour} className="border-t border-ligne-douce">
                  <td className="whitespace-nowrap px-2 py-1">{jourCourt(j.jour)}</td>
                  <td className="px-2 py-1">{j.apprenantsCours}</td>
                  <td className="px-2 py-1">{j.apprenantsSansCours}</td>
                  <td className="px-2 py-1">{j.ouverts === null ? "–" : total(j)}</td>
                  <td className="px-2 py-1">{j.attendusCours}</td>
                  <td className="px-2 py-1">{j.inscrits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

// ── Jours d'apprentissage, semaine par semaine ─────────────────────────────

export function ColonnesSemaines({ semaines, cible = 3 }: { semaines: SemaineApprentissage[]; cible?: number }) {
  const tx = useTextes(t);
  const hauteur = 132;
  const max = 7;
  const [choisie, setChoisie] = useState<string | null>(null);
  const active = semaines.find((s) => s.lundi === choisie);
  const virgule = (n: number) => String(n).replace(".", ",");
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">{tx("principal.graphique")}</figcaption>
      <div className="relative pl-6">
        <div className="relative" style={{ height: hauteur }}>
          <Grille max={max} hauteur={hauteur} graduations={[max, 0]} />
          {/* Cible : un filet plein en encre, nommé. */}
          <div aria-hidden className="pointer-events-none absolute left-0 right-0 border-t border-encre/60" style={{ top: hauteur - (cible / max) * hauteur }}>
            <span className="absolute -top-4 right-0 font-mono text-[10px] text-texte-doux">{tx("principal.cible")}</span>
          </div>
          <div className="absolute inset-0 flex items-end justify-around gap-[2px]">
            {semaines.map((s) => {
              const v = s.mediane;
              return (
                <button
                  key={s.lundi}
                  type="button"
                  onClick={() => setChoisie(s.lundi)}
                  onMouseEnter={() => setChoisie(s.lundi)}
                  onFocus={() => setChoisie(s.lundi)}
                  aria-label={`${jourCourt(s.lundi)} : ${v === null ? "–" : virgule(v)} · ${tx("principal.auMoins3")} ${s.auMoins3.taux ?? "–"} %`}
                  className="flex h-full w-full max-w-12 flex-col items-center justify-end outline-none focus-visible:ring-2 focus-visible:ring-orange"
                >
                  <span className="mb-1 text-xs font-bold text-encre">{v === null ? "–" : virgule(v)}</span>
                  <span
                    className="block w-full max-w-6 rounded-t-[4px]"
                    style={{
                      height: v === null ? 0 : Math.max(2, (v / max) * hauteur),
                      background: COULEURS.sansCours,
                      opacity: s.enCours ? 0.45 : 1,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
        <div aria-hidden className="mt-1.5 flex justify-around gap-[2px] font-mono text-[10px] text-texte-gris">
          {semaines.map((s) => (
            <span key={s.lundi} className="w-full max-w-12 text-center">
              {s.enCours ? tx("principal.enCours") : jourCourt(s.lundi)}
            </span>
          ))}
        </div>
      </div>
      {active && (
        <p className="rounded-xl bg-creme px-3 py-2 text-sm text-texte-doux" aria-live="polite">
          {jourCourt(active.lundi)} : {active.inscrits} inscrits · {tx("principal.auMoins1")} {active.auMoins1.taux ?? "–"} % · {tx("principal.auMoins3")}{" "}
          {active.auMoins3.taux ?? "–"} %
        </p>
      )}
    </figure>
  );
}

// ── Barres de répartition (trois états, plateformes) ───────────────────────

/** Barre horizontale empilée, 2 px d'écart entre les segments ; la légende porte les nombres. */
export function BarreEmpilee({ segments, libelle }: { segments: { n: number; couleur: string; fond?: string; libelle: string }[]; libelle: string }) {
  const total = segments.reduce((s, x) => s + x.n, 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-[4px] bg-[#F3EAE2]" role="img" aria-label={libelle}>
        {total > 0 &&
          segments
            .filter((s) => s.n > 0)
            .map((s) => <span key={s.libelle} className="h-full" style={{ width: `${(s.n / total) * 100}%`, background: s.fond ?? s.couleur }} />)}
      </div>
      <Legende elements={segments.map((s) => ({ couleur: s.couleur, fond: s.fond, libelle: `${s.libelle} : ${s.n}${total ? ` (${Math.round((s.n / total) * 100)} %)` : ""}` }))} />
    </div>
  );
}

export function BarreTroisEtats({ e }: { e: TroisEtats }) {
  const tx = useTextes(t);
  return (
    <BarreEmpilee
      libelle={tx("entonnoir.presence", { v: { p: e.presents, a: e.absents, i: e.inconnus } })}
      segments={[
        { n: e.presents, couleur: COULEURS.present, libelle: tx("presence.presents") },
        { n: e.absents, couleur: COULEURS.absent, libelle: tx("presence.absents") },
        { n: e.inconnus, couleur: COULEURS.inconnu, fond: HACHURES_INCONNU, libelle: tx("presence.inconnus") },
      ]}
    />
  );
}

export function BarrePlateformes({ p }: { p: RepartitionPlateformes }) {
  const tx = useTextes(t);
  const cles = [...PLATEFORMES, "inconnue"] as const;
  return (
    <BarreEmpilee
      libelle={tx("plateformes.titre")}
      segments={cles.map((c) => ({ n: p[c], couleur: COULEURS[c], libelle: tx(`plateformes.${c}`) }))}
    />
  );
}

/**
 * Un seul cadre « pas encore mesuré » pour les chiffres d'une section qui dépendent d'une fonction
 * pas encore en ligne (table d'un autre chantier absente) : jamais 0 %, jamais une erreur.
 */
export function PasEncoreMesure({ titres }: { titres: string[] }) {
  const tx = useTextes(t);
  if (!titres.length) return null;
  return (
    <div className="rounded-2xl border border-dashed border-ligne bg-white p-4">
      <div className="font-mono text-xs uppercase tracking-wider text-texte-gris">{tx("commun.pasEncoreMesure")}</div>
      <p className="mt-1 text-[15px] font-bold text-encre">{titres.join(" · ")}</p>
      <p className="mt-1 text-sm text-texte-pale">{tx("commun.pasEncoreMesure.texte")}</p>
    </div>
  );
}
