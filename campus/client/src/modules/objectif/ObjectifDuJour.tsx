// Objectif du jour de l'étudiant (chantier C2), dans l'emplacement posé par
// le socle commun (C0) sur l'accueil, sous une LimiteSilencieuse :
//   - variante « grande » : à la place de la carte « À jour » quand rien
//     n'est urgent ; la carte « À jour » reste le repli (rien à proposer,
//     erreur ou pas de réseau) ;
//   - variante « ligne » : sous la carte « À faire maintenant ». Une ligne
//     repliée quand cette carte est urgente (live, devoir sous 24 h, message,
//     retard) ; la carte entière quand elle ne l'est pas (devoir à plus de
//     24 h, le cas courant avec les devoirs de la routine du soir).
// Trois lignes au plus, choisies par le serveur et figées pour la journée ;
// chacune se coche toute seule (GET /api/objectif-du-jour, gardé 60 s).
// « À retenir » se lit sur place, sans charger de page.
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Check, ChevronDown, ChevronRight, ClipboardList, Layers, Lightbulb, ListChecks, RotateCcw, Target } from "lucide-react";
import { post } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { Squelette } from "@/components/ui/divers";
import { formaterDate, type Traducteur } from "@shared/textes";
import { t, type CleObjectif } from "@shared/textes/objectif";
import { ecartJours, jourLocal } from "@shared/engagement/calendrier";
import { deCours, type AccueilEtudiantSuivi, type ElementObjectifDto, type ObjectifDuJourDto } from "@shared/engagement/objectif";
// Préchargement de la révision (C1) : seul import vers un autre chantier hors emplacements (ENGAGEMENT.md).
import { prechargerRevision } from "@/modules/revision/prechargerRevision";
import { JourValide } from "./JourValide";

const CLE = "/api/objectif-du-jour";

/** La ligne touchée mène ailleurs : au retour sur l'accueil, l'objectif sera relu (sans requête tout de suite). */
const marquerARelire = () => void queryClient.invalidateQueries({ queryKey: [CLE], refetchType: "none" });

/** Note l'ouverture d'une ligne sans autre trace (« À retenir », cours complet) ; sans réseau, rien n'est perdu d'important. */
function noterOuverture(cle: string) {
  void post<ObjectifDuJourDto>(`${CLE}/ouvert`, { cle }).then(
    (d) => queryClient.setQueryData([CLE], d),
    () => undefined,
  );
}

export function ObjectifDuJour({ variante, repli }: { variante: "grande" | "ligne"; repli?: ReactNode }) {
  const { data, isLoading } = useQuery<ObjectifDuJourDto>({ queryKey: [CLE], staleTime: 60_000, retry: 1 });
  // Urgence de la carte « À faire maintenant », lue dans le cache de l'accueil (aucune requête de plus).
  const { data: accueil } = useQuery<AccueilEtudiantSuivi>({ queryKey: ["/api/accueil"], enabled: false });
  const carteUrgente = accueil ? accueil.aFaire.urgence === "haute" || accueil.aFaire.urgence === "moyenne" : true;
  const revisionAFaire = Boolean(data?.elements.some((e) => e.type === "revision" && !e.fait));
  useEffect(() => {
    if (revisionAFaire) prechargerRevision();
  }, [revisionAFaire]);

  if (isLoading) return variante === "grande" ? <Squelette className="h-64 rounded-[24px]" /> : null;
  if (!data || !data.elements.length) return repli ? <>{repli}</> : null;
  return variante === "grande" || !carteUrgente ? <CarteObjectif objectif={data} /> : <LigneObjectif objectif={data} />;
}

// ── Variante « grande » ────────────────────────────────────────────────────

function CarteObjectif({ objectif }: { objectif: ObjectifDuJourDto }) {
  const tx = useTextes(t);
  const valide = Boolean(objectif.valideLe);
  // Un seul arbre, validé ou non : une ligne dépliée (« À retenir ») le reste quand le jour se valide.
  return (
    <section
      aria-labelledby="titre-objectif"
      className={cn("flex flex-col gap-4 rounded-[24px] p-5 sm:p-7", valide ? "bg-encre text-white" : "border border-ligne bg-white")}
    >
      {valide ? (
        <JourValide />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h2 id="titre-objectif" className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-texte-pale">
            <Target className="h-4 w-4 text-orange-fonce" aria-hidden />
            {tx("objectif.titre")}
          </h2>
          <span className="rounded-full bg-orange-clair px-3 py-1 font-mono text-[13px] font-bold tabular-nums text-orange-fonce">
            {tx("objectif.compteur", { v: { faits: objectif.faits, total: objectif.total } })}
          </span>
        </div>
      )}
      {!valide && <Segments faits={objectif.faits} total={objectif.total} />}
      <Lignes objectif={objectif} sombre={valide} />
      {!valide && <p className="text-[13px] text-texte-gris">{tx("objectif.aide")}</p>}
    </section>
  );
}

/** Une barre par ligne : ce qui est fait, d'un coup d'œil. */
function Segments({ faits, total }: { faits: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < faits ? "bg-succes" : "bg-ligne")} />
      ))}
    </div>
  );
}

// ── Variante « ligne » ─────────────────────────────────────────────────────

function LigneObjectif({ objectif }: { objectif: ObjectifDuJourDto }) {
  const tx = useTextes(t);
  const [ouvert, setOuvert] = useState(false);
  const valide = Boolean(objectif.valideLe);
  const prochain = objectif.elements.find((e) => !e.fait);
  return (
    <section className="-mt-3 rounded-2xl border border-ligne bg-white">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", valide ? "bg-succes text-white" : "bg-orange-clair text-orange-fonce")}>
          {valide ? <Check className="h-5 w-5" aria-hidden /> : <Target className="h-5 w-5" aria-hidden />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold leading-snug">
            {valide ? tx("objectif.ligneValide") : tx("objectif.ligne", { v: { faits: objectif.faits, total: objectif.total } })}
          </span>
          {prochain && !ouvert && <span className="truncate text-sm text-texte-pale">{libelles(prochain, objectif.jour, tx).titre}</span>}
        </span>
        <span className="sr-only">{ouvert ? tx("objectif.masquer") : tx("objectif.voir")}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-texte-gris transition-transform", ouvert && "rotate-180")} aria-hidden />
      </button>
      {ouvert && (
        <div className="border-t border-ligne-douce px-4 pb-2">
          <Lignes objectif={objectif} />
        </div>
      )}
    </section>
  );
}

// ── Les lignes ─────────────────────────────────────────────────────────────

function Lignes({ objectif, sombre }: { objectif: ObjectifDuJourDto; sombre?: boolean }) {
  return (
    <ul className={cn("flex flex-col divide-y", sombre ? "divide-nuit-ligne" : "divide-ligne-douce")}>
      {objectif.elements.map((e) => (
        <li key={e.cle}>
          <LigneElement element={e} jour={objectif.jour} sombre={sombre} />
        </li>
      ))}
    </ul>
  );
}

const ICONES = { revision: Layers, rattrapage: RotateCcw, retenir: Lightbulb } as const;

function LigneElement({ element: e, jour, sombre }: { element: ElementObjectifDto; jour: string; sombre?: boolean }) {
  const tx = useTextes(t);
  const [deplie, setDeplie] = useState(false);
  const { titre, detail } = libelles(e, jour, tx);
  const Icone = e.type === "devoir" ? (e.genre === "quiz" ? ListChecks : ClipboardList) : ICONES[e.type];

  const pastille = (
    <span
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full",
        e.fait ? "bg-succes text-white" : sombre ? "bg-nuit-carte text-orange" : "bg-creme text-orange-fonce",
      )}
    >
      {e.fait ? <Check className="h-5 w-5" aria-label={tx("objectif.fait")} /> : <Icone className="h-5 w-5" aria-hidden />}
    </span>
  );
  const textes = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={cn("font-bold leading-snug", e.fait && (sombre ? "text-nuit-doux" : "text-texte-pale"))}>{titre}</span>
      <span className={cn("text-sm leading-snug", sombre ? "text-nuit-gris" : "text-texte-pale")}>{detail}</span>
    </span>
  );
  const classeLigne = cn("group flex min-h-[64px] w-full items-center gap-3 py-2.5 text-left no-underline", sombre ? "text-white hover:text-white" : "text-encre hover:text-encre");

  // « À retenir » : les points se lisent sur place ; les ouvrir coche la ligne.
  if (e.type === "retenir") {
    const basculer = () => {
      if (!deplie && !e.fait) noterOuverture(e.cle);
      setDeplie((d) => !d);
    };
    return (
      <>
        <button type="button" onClick={basculer} aria-expanded={deplie} className={classeLigne}>
          {pastille}
          {textes}
          <ChevronDown className={cn("h-5 w-5 shrink-0 text-texte-gris transition-transform", deplie && "rotate-180")} aria-hidden />
        </button>
        {deplie && (
          <div className={cn("mb-3 flex flex-col gap-2 rounded-2xl p-4", sombre ? "bg-nuit-carte" : "bg-encre text-white")}>
            <ul className="flex flex-col gap-1.5">
              {(e.points ?? []).map((p, n) => (
                <li key={n} className="flex gap-2 text-[15px] font-semibold leading-snug">
                  <span className="text-orange" aria-hidden>
                    •
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <Link href={e.lien} onClick={marquerARelire} className="mt-1 inline-flex min-h-[44px] items-center gap-1 self-start text-[15px] font-bold text-orange hover:text-orange-peche">
              {tx("retenir.tout")} <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        )}
      </>
    );
  }

  const toucher = () => {
    // Le cours complet ouvert pour rattraper n'a pas encore d'autre trace : on la note.
    if (e.type === "rattrapage" && !e.fait && e.ko !== null) noterOuverture(e.cle);
    else marquerARelire();
  };
  return (
    <>
      <Link href={e.lien} onClick={toucher} className={classeLigne}>
        {pastille}
        {textes}
        <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
      </Link>
      {e.type === "rattrapage" && !e.fait && <p className={cn("-mt-1 pb-2.5 pl-14 text-[13px]", sombre ? "text-nuit-gris" : "text-texte-gris")}>{tx("rattrapage.emarger")}</p>}
    </>
  );
}

/** Titre et détail d'une ligne, composés avec le dictionnaire (shared/textes/objectif.ts). */
function libelles(e: ElementObjectifDto, jour: string, tx: Traducteur<CleObjectif>): { titre: string; detail: string } {
  switch (e.type) {
    case "revision":
      return { titre: tx("revision.titre"), detail: tx("revision.detail", { v: { min: e.minutes } }) };
    case "rattrapage": {
      const ecart = ecartJours(jourLocal(e.debut), jour);
      const quand = ecart <= 0 ? tx("quand.aujourdhui") : ecart === 1 ? tx("quand.hier") : tx("quand.jour", { v: { jour: jourDeLaSemaine(e.debut) } });
      return {
        titre: tx("rattrapage.titre", { v: { cours: e.coursTitre, quand } }),
        detail: e.ko !== null ? tx("rattrapage.complet", { v: { min: e.minutes, ko: e.ko } }) : tx("rattrapage.replay"),
      };
    }
    case "retenir":
      return { titre: tx("retenir.titre", { v: { deCours: deCours(e.coursTitre) } }), detail: tx("retenir.detail", { v: { min: e.minutes } }) };
    case "devoir": {
      if (e.genre === "quiz") {
        return {
          titre: tx("devoir.quiz", { v: { deCours: deCours(e.coursTitre) } }),
          detail: tx("devoir.quizDetail", { v: { n: e.questions ?? 0, min: e.minutes ?? 0 } }),
        };
      }
      const ecart = ecartJours(jour, jourLocal(e.dateLimite));
      const quand = ecart <= 0 ? tx("devoir.aujourdhui") : ecart === 1 ? tx("devoir.demain") : jourDeLaSemaine(e.dateLimite);
      return { titre: tx("devoir.depot", { v: { deCours: deCours(e.coursTitre) } }), detail: tx("devoir.depotDetail", { v: { quand } }) };
    }
  }
}

/** « mercredi » (heure d'Abidjan). */
const jourDeLaSemaine = (d: string) => formaterDate(d, { style: "jour" }).split(" ")[0] ?? "";
