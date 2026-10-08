// Objectif du jour de l'étudiant (chantier C2), dans l'emplacement posé par
// le socle commun (C0) sur l'accueil, sous une LimiteSilencieuse :
//   - variante « grande » : la grande carte de l'accueil quand rien n'est
//     urgent (« À jour », ou devoir dû dans plus de 24 h, le cas courant avec
//     les devoirs de la routine du soir) ; la carte « À faire maintenant »
//     reste le repli (rien à proposer, erreur ou pas de réseau) ;
//   - variante « ligne » : une ligne repliée sous la carte urgente « À faire
//     maintenant » (live, devoir sous 24 h, message, retard). Son aperçu ne
//     répète pas l'action de cette carte : un même devoir n'apparaît qu'une
//     fois sur l'accueil (les lignes « Ensuite » écartent aussi ceux de
//     l'objectif, PageAccueil.tsx).
// Trois lignes au plus, choisies par le serveur et figées pour la journée ;
// chacune se coche toute seule (GET /api/objectif-du-jour, gardé 60 s), après
// un vrai travail : seule « À retenir », qui se lit sur place sans charger de
// page, se coche à l'ouverture.
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
import {
  ENTRAINEMENT_PRET,
  deCours,
  type AccueilEtudiantSuivi,
  type ElementObjectifDto,
  type Entrainement,
  type ObjectifDuJourDto,
} from "@shared/engagement/objectif";
// Préchargement de la révision (C1) : seul import vers un autre chantier hors emplacements (ENGAGEMENT.md).
import { prechargerRevision } from "@/modules/revision/prechargerRevision";
import { JourValide } from "./JourValide";

const CLE = "/api/objectif-du-jour";

/** La ligne touchée mène ailleurs : au retour sur l'accueil, l'objectif sera relu (sans requête tout de suite). */
const marquerARelire = () => void queryClient.invalidateQueries({ queryKey: [CLE], refetchType: "none" });

/** Note la lecture de « À retenir » (seule ligne sans autre trace) ; sans réseau, rien n'est perdu d'important. */
function noterOuverture(cle: string) {
  void post<ObjectifDuJourDto>(`${CLE}/ouvert`, { cle }).then(
    (d) => queryClient.setQueryData([CLE], d),
    () => undefined,
  );
}

export function ObjectifDuJour({ variante, repli }: { variante: "grande" | "ligne"; repli?: ReactNode }) {
  const { data, isLoading } = useQuery<ObjectifDuJourDto>({ queryKey: [CLE], staleTime: 60_000, retry: 1 });
  // Lien de la carte « À faire maintenant », lu dans le cache de l'accueil (aucune requête de plus).
  const { data: accueil } = useQuery<AccueilEtudiantSuivi>({ queryKey: ["/api/accueil"], enabled: false });
  const revisionAFaire = Boolean(data?.elements.some((e) => e.type === "revision" && !e.fait));
  useEffect(() => {
    if (revisionAFaire) prechargerRevision();
  }, [revisionAFaire]);

  if (isLoading) return variante === "grande" ? <Squelette className="h-64 rounded-[24px]" /> : null;
  if (!data || !data.elements.length) return repli ? <>{repli}</> : null;
  return variante === "grande" ? <CarteObjectif objectif={data} /> : <LigneObjectif objectif={data} lienCarte={accueil?.aFaire.lien ?? null} />;
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

function LigneObjectif({ objectif, lienCarte }: { objectif: ObjectifDuJourDto; lienCarte: string | null }) {
  const tx = useTextes(t);
  const [ouvert, setOuvert] = useState(false);
  const valide = Boolean(objectif.valideLe);
  // L'aperçu ne répète pas la carte du dessus : la prochaine ligne à faire qui n'est pas elle.
  const restants = objectif.elements.filter((e) => !e.fait);
  const prochain = restants.find((e) => e.lien !== lienCarte);
  const apercu = prochain ? libelles(prochain, objectif.jour, tx).titre : restants.length ? tx("objectif.resteCarte") : null;
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
          {apercu && !ouvert && <span className="truncate text-sm text-texte-pale">{apercu}</span>}
        </span>
        <span className="sr-only">{ouvert ? tx("objectif.masquer") : tx("objectif.voir")}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-texte-gris transition-transform", ouvert && "rotate-180")} aria-hidden />
      </button>
      {ouvert && (
        <div className="border-t border-ligne-douce px-4 pb-2">
          <Lignes objectif={objectif} lienCarte={lienCarte} />
        </div>
      )}
    </section>
  );
}

// ── Les lignes ─────────────────────────────────────────────────────────────

function Lignes({ objectif, sombre, lienCarte = null }: { objectif: ObjectifDuJourDto; sombre?: boolean; lienCarte?: string | null }) {
  return (
    <ul className={cn("flex flex-col divide-y", sombre ? "divide-nuit-ligne" : "divide-ligne-douce")}>
      {objectif.elements.map((e) => (
        <li key={e.cle}>
          <LigneElement element={e} jour={objectif.jour} sombre={sombre} enCarte={!e.fait && e.lien === lienCarte} />
        </li>
      ))}
    </ul>
  );
}

const ICONES = { revision: Layers, rattrapage: RotateCcw, retenir: Lightbulb } as const;

function LigneElement({ element: e, jour, sombre, enCarte }: { element: ElementObjectifDto; jour: string; sombre?: boolean; enCarte?: boolean }) {
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

  // Déjà la grande carte « À faire maintenant » juste au-dessus : la ligne la désigne sans répéter son bouton.
  if (enCarte) {
    return (
      <div className={classeLigne}>
        {pastille}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-bold leading-snug">{titre}</span>
          <span className="text-sm leading-snug text-texte-pale">{tx("objectif.dansCarte")}</span>
        </span>
      </div>
    );
  }

  // Révision, rattrapage, devoir : la ligne se coche au retour, d'après le travail fait (jamais au toucher).
  const note = !e.fait ? (e.type === "rattrapage" ? tx("rattrapage.emarger") : e.type === "devoir" ? phraseEntrainement(e.entrainement, tx) : null) : null;
  return (
    <>
      <Link href={e.lien} onClick={marquerARelire} className={classeLigne}>
        {pastille}
        {textes}
        <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
      </Link>
      {note && <p className={cn("-mt-1 pb-2.5 pl-14 text-[13px] leading-snug", sombre ? "text-nuit-gris" : "text-texte-gris")}>{note}</p>}
    </>
  );
}

/** Interrogation de la routine du soir : l'entraînement fait sur son cours complet (rien pour les autres devoirs). */
function phraseEntrainement(s: Entrainement | undefined, tx: Traducteur<CleObjectif>): string | null {
  if (s === undefined) return null;
  if (!s) return tx("devoir.sansEntrainement");
  return tx(s.score / s.total >= ENTRAINEMENT_PRET ? "devoir.pret" : "devoir.revoir", { v: { score: s.score, total: s.total } });
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
      const ecart = ecartJours(jour, jourLocal(e.dateLimite));
      const quand = ecart <= 0 ? tx("devoir.aujourdhui") : ecart === 1 ? tx("devoir.demain") : jourDeLaSemaine(e.dateLimite);
      if (e.genre === "quiz") {
        return {
          titre: tx("devoir.quiz", { v: { deCours: deCours(e.coursTitre) } }),
          detail: tx("devoir.quizDetail", { v: { n: e.questions ?? 0, min: e.minutes ?? 0, quand } }),
        };
      }
      return { titre: tx("devoir.depot", { v: { deCours: deCours(e.coursTitre) } }), detail: tx("devoir.depotDetail", { v: { quand } }) };
    }
  }
}

/** « mercredi » (heure d'Abidjan). */
const jourDeLaSemaine = (d: string) => formaterDate(d, { style: "jour" }).split(" ")[0] ?? "";
