// Grille de l'emploi du temps, réutilisable partout (back-office, espace
// étudiant et formateur, site public, accueil) :
//   - « ecran »     : la grille du document du service des études (colonnes
//                     Lundi → Samedi, lignes = plages horaires, bande PAUSE,
//                     séminaire sur toute la hauteur) ; sur téléphone, une
//                     liste par jour ;
//   - « compacte »  : toujours la liste par jour, serrée (accueil, encarts) ;
//   - « impression » : le tableau du fac-similé A4 (lettres capitales, case
//                     en diagonale, « P A U S E », « SÉMINAIRE » vertical).
// En mode éditeur (surCaseVide / surCreneau), les cases vides ajoutent un
// créneau et les créneaux s'ouvrent au clic.
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { Plus, Video, UserRound } from "lucide-react";
import type { CreneauDto, SessionDto } from "@shared/schema";
import { cn } from "@/lib/utils";
import { JOURS, disposer, estVertical, hh, hhPapier, minutes, type Disposition, type Placement } from "./outils";

export type VarianteGrille = "ecran" | "impression" | "compacte";

type Props = {
  session: Pick<SessionDto, "creneaux" | "pause">;
  variante?: VarianteGrille;
  /** Met en valeur les créneaux de cet intervenant (le formateur connecté). */
  surligner?: number | null;
  /** Mode éditeur : clic sur une case vide (jour et plage préremplis). */
  surCaseVide?: (jour: number, heureDebut: string, heureFin: string) => void;
  /** Mode éditeur : clic sur un créneau. */
  surCreneau?: (c: CreneauDto) => void;
  className?: string;
};

export function GrilleProgramme({ session, variante = "ecran", surligner, surCaseVide, surCreneau, className }: Props) {
  const d = disposer(session, { lignesParDefaut: Boolean(surCaseVide) });
  if (variante === "impression") return <GrillePapier d={d} className={className} />;
  if (variante === "compacte") return <ListeJours d={d} session={session} surligner={surligner} surCaseVide={surCaseVide} surCreneau={surCreneau} compacte className={className} />;
  return (
    <div className={className}>
      <div className="hidden md:block">
        <GrilleEcran d={d} surligner={surligner} surCaseVide={surCaseVide} surCreneau={surCreneau} />
      </div>
      <div className="md:hidden">
        <ListeJours d={d} session={session} surligner={surligner} surCaseVide={surCaseVide} surCreneau={surCreneau} />
      </div>
    </div>
  );
}

export default GrilleProgramme;

// ── Écran (ordinateur) ─────────────────────────────────────────────────────

const zone = (colonne: number, ligne: number, largeur = 1, hauteur = 1): CSSProperties => ({
  gridColumn: `${colonne + 1} / span ${largeur}`,
  gridRow: `${ligne + 1} / span ${hauteur}`,
});

function GrilleEcran({ d, surligner, surCaseVide, surCreneau }: { d: Disposition } & Pick<Props, "surligner" | "surCaseVide" | "surCreneau">) {
  const col = (jour: number) => d.jours.indexOf(jour) + 1;
  const editeur = Boolean(surCaseVide || surCreneau);
  return (
    <div
      role="group"
      aria-label="Emploi du temps de la semaine type"
      className="grid gap-px overflow-hidden rounded-2xl border border-ligne bg-ligne"
      style={{
        gridTemplateColumns: `7.5rem repeat(${d.jours.length}, minmax(0, 1fr))`,
        gridTemplateRows: `auto ${d.lignes.map((l) => (l.pause ? "minmax(44px, auto)" : "minmax(118px, auto)")).join(" ")}`,
      }}
    >
      <div aria-hidden className="flex items-end bg-creme px-3 py-3 font-mono text-[11px] uppercase tracking-wider text-texte-gris" style={zone(0, 0)}>
        Heures
      </div>
      {d.jours.map((j) => (
        <div key={j} aria-hidden className="bg-creme px-3 py-3 text-center text-sm font-extrabold uppercase tracking-wide" style={zone(col(j), 0)}>
          {JOURS[j]}
        </div>
      ))}
      {d.lignes.map((l, i) => (
        <div
          key={l.cle}
          aria-hidden
          className={cn("flex flex-col justify-center bg-white px-3 font-mono text-[13px] font-semibold text-texte-doux", l.pause && "bg-creme text-texte-gris")}
          style={zone(0, i + 1)}
        >
          <span>{hh(l.debut)}</span>
          <span className="text-texte-gris">{hh(l.fin)}</span>
        </div>
      ))}
      {d.pauses.map((p) => (
        <div key={`p${p.ligne}-${p.de}`} className="flex items-center justify-center bg-creme" style={zone(p.de + 1, p.ligne + 1, p.a - p.de + 1)}>
          <span className="sr-only">
            Pause de {hh(d.lignes[p.ligne].debut)} à {hh(d.lignes[p.ligne].fin)}
          </span>
          <span aria-hidden className="font-mono text-xs font-semibold uppercase tracking-[0.9em] text-texte-gris">Pause</span>
        </div>
      ))}
      {d.vides.map((v) => {
        const l = d.lignes[v.ligne];
        return (
          <div key={`v${v.jour}-${v.ligne}`} className="bg-white" style={zone(col(v.jour), v.ligne + 1)}>
            {surCaseVide && (
              <button
                type="button"
                onClick={() => surCaseVide(v.jour, l.debut, l.fin)}
                aria-label={`Ajouter un créneau le ${JOURS[v.jour].toLowerCase()} de ${hh(l.debut)} à ${hh(l.fin)}`}
                className="group flex h-full min-h-[118px] w-full items-center justify-center text-texte-gris/50 transition-colors hover:bg-orange-pale hover:text-orange-fonce focus-visible:bg-orange-pale"
              >
                <span className="flex items-center gap-1.5 text-sm font-bold opacity-60 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Plus className="h-4 w-4" /> Ajouter
                </span>
              </button>
            )}
          </div>
        );
      })}
      {d.placements.map((p) => (
        <div key={p.cle} role="group" aria-label={JOURS[p.jour]} className="flex flex-col gap-1.5 bg-white p-1.5" style={zone(col(p.jour), p.debut + 1, 1, p.fin - p.debut + 1)}>
          {p.creneaux.map((c) => (
            <CarteCreneau key={c.id} c={c} vertical={estVertical(p) && p.creneaux.length === 1} surligne={Boolean(surligner && c.intervenant?.id === surligner)} surClic={surCreneau} editeur={editeur} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CarteCreneau({
  c,
  vertical,
  surligne,
  surClic,
  editeur,
  compacte,
}: {
  c: CreneauDto;
  vertical?: boolean;
  surligne?: boolean;
  surClic?: (c: CreneauDto) => void;
  editeur?: boolean;
  compacte?: boolean;
}) {
  const couleur = c.cours?.couleur ?? (c.type === "seminaire" ? "#141414" : "#8A7F76");
  const contenu: ReactNode = vertical ? (
    <span className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center">
      <span className="text-lg font-black uppercase tracking-[0.18em]">{c.libelle}</span>
      <span className="font-mono text-xs text-texte-pale">
        {hh(c.heureDebut)}–{hh(c.heureFin)}
      </span>
      <span className="text-[13px] text-texte-pale">Toute la journée</span>
    </span>
  ) : (
    <span className="flex h-full flex-col gap-1 text-left">
      <span className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-extrabold leading-tight text-encre">{c.libelle}</span>
        {surligne && <span className="shrink-0 rounded-full bg-orange px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-encre">Vous</span>}
      </span>
      <span className="font-mono text-xs text-texte-pale">
        {hh(c.heureDebut)}–{hh(c.heureFin)}
        {c.cours ? ` · ${c.cours.code}` : ""}
      </span>
      {c.intervenantNom && (
        <span className="mt-auto flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-texte-doux">
          <UserRound className="h-3.5 w-3.5 shrink-0 text-texte-gris" aria-hidden />
          <span className="min-w-0">{c.intervenantNom}</span>
        </span>
      )}
      {c.mention && <span className="text-[12.5px] leading-snug text-texte-pale">{c.mention}</span>}
      {editeur && c.type === "cours" && !c.cours && <span className="text-[12.5px] font-semibold text-alerte">Cours à choisir</span>}
      {editeur && c.cours && c.fournisseur && (
        <span className="flex items-center gap-1 font-mono text-[11px] text-texte-gris">
          <Video className="h-3 w-3" aria-hidden /> {c.fournisseur === "daily" ? "Daily" : c.fournisseur === "campus" ? "Visio du campus" : c.fournisseur}
        </span>
      )}
    </span>
  );
  const classes = cn(
    "block h-full w-full rounded-xl border-l-4 px-3 py-2.5 transition-colors",
    vertical ? "bg-[repeating-linear-gradient(135deg,#FBF6F2_0_10px,#F6EEE7_10px_20px)]" : surligne ? "bg-orange-clair ring-2 ring-orange" : "bg-creme/60",
    surClic && "cursor-pointer hover:bg-orange-pale focus-visible:bg-orange-pale",
  );
  if (surClic) {
    return (
      <button type="button" onClick={() => surClic(c)} className={classes} style={{ borderLeftColor: couleur }} aria-label={`Modifier : ${c.libelle}, ${JOURS[c.jour].toLowerCase()} ${hh(c.heureDebut)}–${hh(c.heureFin)}`}>
        {contenu}
      </button>
    );
  }
  return (
    <div className={classes} style={{ borderLeftColor: couleur }}>
      {contenu}
    </div>
  );
}

// ── Liste par jour (téléphone, encarts) ────────────────────────────────────

function ListeJours({
  d,
  session,
  surligner,
  surCaseVide,
  surCreneau,
  compacte,
  className,
}: { d: Disposition; session: Pick<SessionDto, "creneaux" | "pause">; compacte?: boolean; className?: string } & Pick<Props, "surligner" | "surCaseVide" | "surCreneau">) {
  const pause = session.pause;
  const editeur = Boolean(surCaseVide || surCreneau);
  const jours = d.jours.filter((j) => editeur || !compacte || session.creneaux.some((c) => c.jour === j));
  return (
    <div className={cn("flex flex-col", compacte ? "gap-2" : "gap-3", className)}>
      {jours.map((j) => {
        const liste = session.creneaux.filter((c) => c.jour === j).sort((a, b) => minutes(a.heureDebut) - minutes(b.heureDebut));
        const avant = pause ? liste.filter((c) => minutes(c.heureFin) <= minutes(pause.debut)) : liste;
        const apres = pause ? liste.filter((c) => minutes(c.heureDebut) >= minutes(pause.fin)) : [];
        const pendant = pause ? liste.filter((c) => !avant.includes(c) && !apres.includes(c)) : [];
        const montrerPause = Boolean(pause && avant.length && apres.length && !pendant.length);
        if (!liste.length && !editeur) {
          return (
            <div key={j} className="flex items-center justify-between rounded-xl border border-dashed border-ligne px-4 py-2.5 text-sm text-texte-gris">
              <span className="font-bold">{JOURS[j]}</span>
              <span>Pas de cours</span>
            </div>
          );
        }
        const libre = premierePlageLibre(liste, pause);
        return (
          <section key={j} aria-label={JOURS[j]} className={cn("rounded-2xl border border-ligne bg-white", compacte ? "p-3" : "p-4")}>
            <h3 className={cn("mb-2 font-extrabold uppercase tracking-wide", compacte ? "text-[13px]" : "text-sm")}>{JOURS[j]}</h3>
            <div className="flex flex-col gap-2">
              {liste.length === 0 && <p className="text-sm text-texte-gris">Aucun créneau.</p>}
              {[...avant, ...pendant].map((c) => (
                <CarteCreneau key={c.id} c={c} vertical={false} surligne={Boolean(surligner && c.intervenant?.id === surligner)} surClic={surCreneau} editeur={editeur} compacte={compacte} />
              ))}
              {montrerPause && pause && (
                <div className="flex items-center gap-3 px-1 font-mono text-[11px] uppercase tracking-widest text-texte-gris">
                  <span className="h-px flex-1 bg-ligne" />
                  Pause {hh(pause.debut)}–{hh(pause.fin)}
                  <span className="h-px flex-1 bg-ligne" />
                </div>
              )}
              {apres.map((c) => (
                <CarteCreneau key={c.id} c={c} vertical={false} surligne={Boolean(surligner && c.intervenant?.id === surligner)} surClic={surCreneau} editeur={editeur} compacte={compacte} />
              ))}
              {surCaseVide && (
                <button
                  type="button"
                  onClick={() => surCaseVide(j, libre.debut, libre.fin)}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-dashed border-ligne text-sm font-bold text-texte-pale hover:border-orange hover:text-encre"
                >
                  <Plus className="h-4 w-4" /> Ajouter un créneau le {JOURS[j].toLowerCase()}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Plage proposée pour un nouveau créneau un jour donné : le matin s'il est libre, sinon l'après-midi. */
function premierePlageLibre(liste: CreneauDto[], pause: SessionDto["pause"]): { debut: string; fin: string } {
  const plages = [
    { debut: "08:30", fin: pause ? pause.debut : "12:30" },
    { debut: pause ? pause.fin : "13:00", fin: "17:00" },
  ];
  return plages.find((p) => !liste.some((c) => minutes(c.heureDebut) < minutes(p.fin) && minutes(p.debut) < minutes(c.heureFin))) ?? plages[0];
}

// ── Papier (fac-similé du service des études) ──────────────────────────────

const SERIF = "'Times New Roman', Times, 'Liberation Serif', 'Nimbus Roman', FreeSerif, serif";

function GrillePapier({ d, className }: { d: Disposition; className?: string }) {
  const col = (jour: number) => d.jours.indexOf(jour) + 1;
  return (
    <div className={cn("border-[6px] border-double border-black bg-white text-black", className)} style={{ fontFamily: SERIF, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <div
        className="grid h-full bg-black"
        style={{
          gap: "1.4px",
          gridTemplateColumns: `11% repeat(${d.jours.length}, minmax(0, 1fr))`,
          // Hauteurs fixées par proportions (comme le document) : le contenu ne déforme jamais la grille.
          gridTemplateRows: `minmax(0, 0.36fr) ${d.lignes.map((l) => (l.pause ? "minmax(0, 0.4fr)" : "minmax(0, 1fr)")).join(" ")}`,
        }}
      >
        <div className="relative bg-white" style={zone(0, 0)}>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <line x1="0" y1="0" x2="100" y2="100" stroke="black" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="absolute right-[12%] top-[7%] text-[10.5pt] font-bold">JOURS</span>
          <span className="absolute bottom-[5%] left-[4%] text-[10.5pt] font-bold">HEURES</span>
        </div>
        {d.jours.map((j) => (
          <div key={j} className="flex items-center justify-center bg-white text-[11pt] font-bold uppercase" style={zone(col(j), 0)}>
            {JOURS[j].toUpperCase()}
          </div>
        ))}
        {d.lignes.map((l, i) => (
          <div key={l.cle} className="flex items-center justify-center bg-white px-1 text-center text-[10.5pt] font-bold" style={zone(0, i + 1)}>
            {hhPapier(l.debut)}-{hhPapier(l.fin)}
          </div>
        ))}
        {d.pauses.map((p) => (
          <div key={`p${p.ligne}-${p.de}`} className="flex items-center justify-around bg-white px-[8%] text-[12pt] font-bold" style={zone(p.de + 1, p.ligne + 1, p.a - p.de + 1)}>
            {"PAUSE".split("").map((lettre, i) => (
              <span key={i}>{lettre}</span>
            ))}
          </div>
        ))}
        {d.vides.map((v) => (
          <div key={`v${v.jour}-${v.ligne}`} className="bg-white" style={zone(col(v.jour), v.ligne + 1)} />
        ))}
        {d.placements.map((p) => (
          <div key={p.cle} className="flex flex-col items-center justify-center gap-[2.5mm] bg-white px-[2mm] py-[1.5mm] text-center" style={zone(col(p.jour), p.debut + 1, 1, p.fin - p.debut + 1)}>
            {estVertical(p) ? <LettresVerticales texte={p.creneaux[0].libelle} /> : p.creneaux.map((c, i) => <CasePapier key={c.id} c={c} separe={i > 0} placement={p} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function CasePapier({ c, separe, placement }: { c: CreneauDto; separe: boolean; placement: Placement }) {
  const serre = placement.creneaux.length > 1;
  return (
    <Fragment>
      {separe && <span className="my-[1mm] h-px w-3/4 bg-black" aria-hidden />}
      <span className={cn("flex flex-col items-center font-bold uppercase", serre ? "gap-[1mm] text-[9pt]" : "gap-[2.4mm] text-[10.5pt]", "leading-[1.12]")}>
        <span>{c.libelle}</span>
        {c.intervenantNom && <span>{c.intervenantNom}</span>}
        {c.mention && <span>{c.mention}</span>}
      </span>
    </Fragment>
  );
}

/** « SÉMINAIRE » en lettres empilées, très grasses, comme sur le document. */
function LettresVerticales({ texte }: { texte: string }) {
  const lettres = texte.toUpperCase().replace(/\s+/g, "").split("");
  // Lettres larges et très grasses, comme le tampon du document ; plus petites au-delà de 9 lettres.
  const taille = lettres.length <= 9 ? 20 : 15;
  return (
    <span aria-label={texte} className="flex flex-col items-center" style={{ fontFamily: "'Archivo Variable', Archivo, 'Arial Black', 'Liberation Sans', sans-serif", lineHeight: 1.12 }}>
      {lettres.map((l, i) => (
        <span key={i} aria-hidden className="block font-black" style={{ fontSize: `${taille}pt`, transform: "scaleX(2.1)" }}>
          {l}
        </span>
      ))}
    </span>
  );
}
