// Panneaux de la salle live (mode nuit) : questions votées, campus,
// assistant (sous-titres), sondage en superposition, vignettes des salles,
// baromètre et « Voici ce que tu as raté ».
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronUp, Pin, Check, EyeOff, Eye, Flag, Hand, CircleAlert, Send, X, Captions } from "lucide-react";
import { post, patch, suppr } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import { toast, toastErreur } from "@/components/ui/toast";
import { cleDirect, fusionnerQuestion, minutage, RESSENTIS_UI } from "./outils";
import type {
  EtatDirectDto,
  QuestionDirectDto,
  RoleSeance,
  CampusDirectDto,
  SondageDto,
  ResultatsSondageDto,
  RattrapageDto,
  BarometreSiteDto,
} from "@shared/schema";

const LETTRES = ["A", "B", "C", "D", "E"];

// ── Onglets du panneau latéral (boutons de même largeur, comme la maquette) ──

export function OngletsPanneau<T extends string>({ valeur, onChange, options }: { valeur: T; onChange: (v: T) => void; options: { valeur: T; libelle: string; compteur?: number }[] }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-nuit-ligne p-2.5">
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <button
            key={o.valeur}
            role="tab"
            aria-selected={actif}
            onClick={() => onChange(o.valeur)}
            className={cn(
              "flex min-h-11 min-w-0 flex-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2.5 text-[13px] font-bold transition-colors",
              actif ? "bg-orange text-encre" : "text-nuit-doux hover:text-white",
            )}
          >
            <span>{o.libelle}</span>
            {o.compteur ? <span className={cn("rounded-full px-1.5 font-mono text-[11px]", actif ? "bg-encre text-white" : "bg-nuit-ligne text-nuit-doux")}>{o.compteur}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// ── Questions votées ───────────────────────────────────────────────────────

export function PanneauQuestions({ seanceId, etat, role, enDirect }: { seanceId: number; etat: EtatDirectDto; role: RoleSeance; enDirect: boolean }) {
  const [texte, setTexte] = useState("");
  const [anonyme, setAnonyme] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const moderateur = role === "formateur" || role === "equipe";
  const peutPoser = role === "etudiant" && (enDirect || etat.statut === "planifiee");
  const cle = cleDirect(seanceId);

  const envoyer = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = texte.trim();
    if (t.length < 3) return;
    setEnvoi(true);
    try {
      const q = await post<QuestionDirectDto>(`/api/seances/${seanceId}/questions`, { texte: t, anonyme });
      queryClient.setQueryData<EtatDirectDto>(cle, (x) => (x ? fusionnerQuestion(x, q, { mienne: true, jaiVote: true }) : x));
      setTexte("");
      toast(anonyme ? "Question envoyée (anonyme pour tes camarades)." : "Question envoyée.");
    } catch (err) {
      toastErreur(err);
    } finally {
      setEnvoi(false);
    }
  };

  const voter = async (q: QuestionDirectDto) => {
    const ajouter = !q.jaiVote;
    queryClient.setQueryData<EtatDirectDto>(cle, (x) => (x ? fusionnerQuestion(x, { ...q, votes: q.votes + (ajouter ? 1 : -1) }, { jaiVote: ajouter }) : x));
    try {
      const r = ajouter
        ? await post<{ votes: number }>(`/api/seances/${seanceId}/questions/${q.id}/vote`)
        : await suppr<{ votes: number }>(`/api/seances/${seanceId}/questions/${q.id}/vote`);
      queryClient.setQueryData<EtatDirectDto>(cle, (x) => (x ? fusionnerQuestion(x, { ...q, votes: r.votes }, { jaiVote: ajouter }) : x));
    } catch (err) {
      queryClient.setQueryData<EtatDirectDto>(cle, (x) => (x ? fusionnerQuestion(x, q, { jaiVote: q.jaiVote }) : x));
      toastErreur(err);
    }
  };

  const moderer = async (q: QuestionDirectDto, champs: Partial<Pick<QuestionDirectDto, "repondue" | "epinglee" | "masquee">>) => {
    try {
      const maj = await patch<QuestionDirectDto>(`/api/seances/${seanceId}/questions/${q.id}`, champs);
      queryClient.setQueryData<EtatDirectDto>(cle, (x) => (x ? fusionnerQuestion(x, maj) : x));
    } catch (err) {
      toastErreur(err);
    }
  };

  const signaler = async (q: QuestionDirectDto) => {
    try {
      const r = await post<{ message: string }>(`/api/seances/${seanceId}/questions/${q.id}/signaler`);
      toast(r.message, "info");
    } catch (err) {
      toastErreur(err);
    }
  };

  const questions = moderateur ? etat.questions : etat.questions.filter((q) => !q.masquee);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="defile-fin flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3.5" aria-live="polite">
        {!questions.length && (
          <p className="px-2 py-8 text-center text-[15px] leading-relaxed text-nuit-doux">
            {role === "etudiant" ? "Aucune question pour l'instant. Pose la première : tes camarades des cinq campus pourront la voter." : "Les questions des cinq campus s'afficheront ici, triées par votes."}
          </p>
        )}
        {questions.map((q) => (
          <div
            key={q.id}
            className={cn(
              "grid grid-cols-[1fr_auto] items-start gap-2.5 rounded-[14px] bg-nuit-bulle px-3.5 py-3",
              q.epinglee && "ring-2 ring-orange",
              (q.repondue || q.masquee) && "opacity-60",
            )}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-orange">
                {q.epinglee && <Pin className="h-3 w-3" />}
                {q.site ?? "En ligne"}
                {q.auteur ? ` · ${q.auteur}` : q.anonyme ? " · anonyme" : ""}
                {q.mienne && <span className="text-nuit-gris">· ta question</span>}
                {q.repondue && <span className="text-[#6FCF97]">· répondue</span>}
                {q.masquee && <span className="text-nuit-gris">· masquée</span>}
              </span>
              <span className="text-[15px] leading-snug text-nuit-texte">{q.texte}</span>
              {moderateur && (
                <>
                  <span className="font-mono text-[11px] text-nuit-gris">
                    {q.auteurReel}
                    {q.signalements ? ` · signalée ${q.signalements} fois` : ""}
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <ActionQuestion actif={q.repondue} onClick={() => moderer(q, { repondue: !q.repondue })} icone={<Check className="h-3.5 w-3.5" />} libelle={q.repondue ? "Répondue" : "Marquer répondue"} />
                    <ActionQuestion actif={q.epinglee} onClick={() => moderer(q, { epinglee: !q.epinglee })} icone={<Pin className="h-3.5 w-3.5" />} libelle={q.epinglee ? "Affichée en salle" : "Afficher en salle"} />
                    <ActionQuestion actif={q.masquee} onClick={() => moderer(q, { masquee: !q.masquee })} icone={q.masquee ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} libelle={q.masquee ? "Démasquer" : "Masquer"} />
                  </div>
                </>
              )}
              {role === "etudiant" && !q.mienne && !q.repondue && (
                <button onClick={() => signaler(q)} className="mt-0.5 flex w-fit items-center gap-1 text-[12px] text-nuit-gris hover:text-orange" aria-label="Signaler cette question">
                  <Flag className="h-3 w-3" /> Signaler
                </button>
              )}
            </div>
            {role === "etudiant" ? (
              <button
                onClick={() => voter(q)}
                aria-pressed={q.jaiVote}
                aria-label={q.jaiVote ? `Retirer mon vote (${q.votes} votes)` : `Voter pour cette question (${q.votes} votes)`}
                className={cn(
                  "flex min-h-12 min-w-12 flex-col items-center justify-center rounded-[10px] border px-2 font-mono text-[13px] font-semibold transition-colors",
                  q.jaiVote ? "border-orange bg-orange text-encre" : "border-nuit-bord text-nuit-doux hover:border-orange",
                )}
              >
                <ChevronUp className="h-4 w-4" />
                {q.votes}
              </button>
            ) : (
              <span className="flex min-w-12 flex-col items-center rounded-[10px] border border-nuit-bord px-2 py-1.5 font-mono text-[13px] font-semibold text-nuit-doux">
                <ChevronUp className="h-4 w-4" />
                {q.votes}
              </span>
            )}
          </div>
        ))}
      </div>
      {peutPoser && (
        <form onSubmit={envoyer} className="flex flex-col gap-2 border-t border-nuit-ligne p-3">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="question-live">
              Ta question
            </label>
            <input
              id="question-live"
              value={texte}
              onChange={(e) => setTexte(e.target.value.slice(0, 280))}
              placeholder="Poser une question au formateur…"
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-nuit-bord bg-nuit-bulle px-3.5 text-base text-white outline-none placeholder:text-nuit-gris focus:border-orange"
            />
            <Bouton type="submit" variante="nuit-actif" chargement={envoi} disabled={texte.trim().length < 3} aria-label="Envoyer la question" className="min-h-12 px-4">
              <Send className="h-4 w-4" />
            </Bouton>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-nuit-doux">
            <input type="checkbox" checked={anonyme} onChange={(e) => setAnonyme(e.target.checked)} className="h-5 w-5 accent-[#E4793A]" />
            Anonyme pour mes camarades (le formateur voit toujours qui écrit)
          </label>
        </form>
      )}
    </div>
  );
}

function ActionQuestion({ actif, onClick, icone, libelle }: { actif: boolean; onClick: () => void; icone: ReactNode; libelle: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-[12px] font-bold transition-colors",
        actif ? "bg-orange text-encre" : "bg-nuit-ligne text-nuit-doux hover:text-white",
      )}
    >
      {icone}
      {libelle}
    </button>
  );
}

// ── Campus : présences par salle et en ligne ───────────────────────────────

export function PanneauCampus({ etat, detaille }: { etat: EtatDirectDto; detaille?: boolean }) {
  return (
    <div className="defile-fin flex min-h-0 flex-1 flex-col overflow-y-auto p-3.5">
      {etat.campus.map((c) => (
        <div key={c.siteId} className="flex items-center justify-between gap-3 border-b border-nuit-ligne px-1.5 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-[15px] font-bold text-white">
              <span className={cn("h-2 w-2 rounded-full", c.salleConnectee ? "bg-[#6FCF97]" : "bg-nuit-bord")} aria-hidden />
              {c.nomCourt}
              {c.mainLevee && <Hand className="h-4 w-4 text-orange" aria-label="main levée" />}
            </span>
            <span className="text-[12px] text-nuit-gris">
              {c.salle}
              {detaille && c.prete ? " · salle prête" : ""}
              {!c.salleConnectee ? " · écran non connecté" : ""}
            </span>
            {c.incident && (
              <span className="flex items-center gap-1 text-[12px] font-bold text-orange">
                <CircleAlert className="h-3.5 w-3.5" /> {c.incident}
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 font-mono text-[12px] text-nuit-doux">
            <span>{c.emarges} en salle</span>
            {detaille && <span className="text-nuit-gris">{c.effectif !== null ? `effectif ${c.effectif}` : "effectif non déclaré"}</span>}
            {c.enLigne > 0 && <span className="text-nuit-gris">+ {c.enLigne} en ligne</span>}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between px-1.5 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold text-white">En ligne</span>
          <span className="text-[12px] text-nuit-gris">Téléphone et ordinateur</span>
        </div>
        <span className="font-mono text-[12px] text-nuit-doux">{etat.enLigne} connectés</span>
      </div>
    </div>
  );
}

// ── Assistant : sous-titres en direct ──────────────────────────────────────

export function PanneauAssistant({ etat, iaDisponible }: { etat: EtatDirectDto; iaDisponible: boolean }) {
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [etat.sousTitres.length]);
  return (
    <div className="defile-fin flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4" aria-live="polite">
      <span className="flex items-center gap-2 font-mono text-[11px] text-orange-peche">
        <Captions className="h-3.5 w-3.5" /> Sous-titres en direct
      </span>
      {!etat.sousTitres.length && (
        <p className="text-[14px] leading-relaxed text-nuit-doux">
          Quand le formateur active les sous-titres, ses phrases s'écrivent ici en direct. Pratique quand le son de la salle est mauvais.
        </p>
      )}
      {etat.sousTitres.map((s) => (
        <div key={s.id} className="grid grid-cols-[48px_1fr] gap-2.5 text-[15px] leading-snug">
          <span className="font-mono text-[12px] text-nuit-gris">{minutage(s.t)}</span>
          <span className="text-nuit-texte">{s.texte}</span>
        </div>
      ))}
      <div ref={fin} />
      <span className="text-[12px] leading-relaxed text-nuit-gris">
        La transcription et la fiche de révision{iaDisponible ? " (préparée par l'assistant, relue par le formateur)" : ""} seront jointes au replay dans le cours.
      </span>
    </div>
  );
}

// ── Résultats d'un sondage, par campus ─────────────────────────────────────

export function ResultatsParCampus({ sondage, resultats, grand }: { sondage: SondageDto; resultats: ResultatsSondageDto; grand?: boolean }) {
  const total = Math.max(1, resultats.total);
  const bonne = sondage.bonneReponse;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {sondage.options.map((o, i) => {
          const pct = Math.round((resultats.parOption[i] / total) * 100);
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className={cn("flex items-baseline justify-between gap-3", grand ? "text-[clamp(18px,1.8vw,30px)]" : "text-[14px]")}>
                <span className={cn("font-bold text-white", bonne === i && "text-[#6FCF97]")}>
                  {LETTRES[i]}. {o} {bonne === i && "✓"}
                </span>
                <span className="shrink-0 whitespace-nowrap font-mono text-nuit-doux">{pct} %</span>
              </div>
              <div className={cn("overflow-hidden rounded-full bg-nuit-ligne", grand ? "h-4" : "h-2.5")}>
                <div className={cn("h-full rounded-full transition-[width] duration-500", bonne === i ? "bg-[#6FCF97]" : "bg-orange")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {resultats.parSite.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-nuit-gris">Par campus</span>
          {resultats.parSite.map((s) => {
            const pctBonne = bonne !== null && s.total ? Math.round((s.parOption[bonne] / s.total) * 100) : null;
            return (
              <div key={s.site} className={cn("grid grid-cols-[minmax(90px,auto)_1fr_auto] items-center gap-3", grand ? "text-[clamp(16px,1.5vw,26px)]" : "text-[13px]")}>
                <span className="font-bold text-white">{s.site}</span>
                <div className={cn("flex overflow-hidden rounded-full bg-nuit-ligne", grand ? "h-4" : "h-2")}>
                  {s.parOption.map((n, i) => (
                    <div
                      key={i}
                      className={cn("h-full", bonne === i ? "bg-[#6FCF97]" : ["bg-orange", "bg-orange-peche", "bg-[#A89E95]", "bg-[#C85F22]", "bg-[#EDE6E0]"][i])}
                      style={{ width: `${(n / Math.max(1, s.total)) * 100}%` }}
                    />
                  ))}
                </div>
                <span className="whitespace-nowrap font-mono text-nuit-doux">{pctBonne !== null ? `${pctBonne} % juste` : `${s.total} rép.`}</span>
              </div>
            );
          })}
        </div>
      )}
      <span className="font-mono text-[12px] text-nuit-gris">
        {resultats.total} réponse{resultats.total > 1 ? "s" : ""}
      </span>
    </div>
  );
}

// ── Sondage en superposition (étudiant) ────────────────────────────────────

export function SondageSuperpose({ seanceId, etat }: { seanceId: number; etat: EtatDirectDto }) {
  const s = etat.sondage;
  const [ferme, setFerme] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState<number | null>(null);
  if (!s || ferme === s.id) return null;
  const aVote = s.monChoix !== null;
  const repondre = async (choix: number) => {
    setEnvoi(choix);
    try {
      const r = await post<SondageDto & { resultats: ResultatsSondageDto | null }>(`/api/seances/${seanceId}/sondages/${s.id}/repondre`, { choix });
      queryClient.setQueryData<EtatDirectDto>(cleDirect(seanceId), (x) => (x ? { ...x, sondage: { ...s, monChoix: choix }, resultats: r.resultats ?? x.resultats } : x));
    } catch (err) {
      toastErreur(err);
    } finally {
      setEnvoi(null);
    }
  };
  return (
    <div className="fixed inset-x-0 bottom-[76px] z-40 flex justify-center p-3 sm:absolute sm:inset-0 sm:bottom-0 sm:items-center sm:bg-black/60 sm:p-6" role="dialog" aria-modal="false" aria-label="Sondage">
      <div className="animate-monte flex max-h-[70dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-[24px] border border-nuit-bord bg-nuit-panneau p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-orange-peche">
            {s.ouvert ? "Sondage en direct" : "Résultats du sondage"} {s.parIa && "· question proposée par l'IA, validée par le formateur"}
          </span>
          <button onClick={() => setFerme(s.id)} className="-m-2 rounded-full p-2 text-nuit-doux hover:text-white" aria-label="Fermer le sondage">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xl font-extrabold leading-snug text-white">{s.question}</p>
        {s.ouvert && !aVote ? (
          <div className="grid gap-2.5">
            {s.options.map((o, i) => (
              <button
                key={i}
                onClick={() => repondre(i)}
                disabled={envoi !== null}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-nuit-carte px-4 text-left text-base font-bold text-white transition-colors hover:bg-orange hover:text-encre disabled:opacity-60"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange font-mono text-encre">{LETTRES[i]}</span>
                {o}
              </button>
            ))}
          </div>
        ) : (
          <>
            {aVote && s.ouvert && <p className="text-[15px] font-semibold text-[#6FCF97]">✓ Réponse envoyée : {LETTRES[s.monChoix!]}. Les résultats arrivent en direct.</p>}
            {etat.resultats ? <ResultatsParCampus sondage={s} resultats={etat.resultats} /> : <p className="text-sm text-nuit-doux">Résultats bientôt.</p>}
            {!s.ouvert && s.explication && <p className="rounded-xl bg-nuit-carte p-3 text-[15px] leading-relaxed text-nuit-texte">{s.explication}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Vignettes des cinq salles ──────────────────────────────────────────────

export function VignettesSalles({
  campus,
  paroleSiteId,
  onChoisir,
  compactes,
}: {
  campus: CampusDirectDto[];
  paroleSiteId?: number | null;
  onChoisir?: (c: CampusDirectDto) => void;
  /** La scène montre déjà l'image des salles (visio du campus) : une simple rangée d'étiquettes, sans doublon d'images. */
  compactes?: boolean;
}) {
  if (compactes) {
    return (
      <div className="flex flex-wrap gap-2">
        {campus.map((c) => {
          const aLaParole = paroleSiteId === c.siteId;
          const Balise = onChoisir ? "button" : "div";
          return (
            <Balise
              key={c.siteId}
              {...(onChoisir ? { type: "button" as const, onClick: () => onChoisir(c), "aria-label": `Donner la parole à ${c.nomCourt}` } : {})}
              className={cn(
                "inline-flex min-h-12 items-center gap-2 rounded-full border-2 bg-nuit-carte px-3.5 text-left text-[13px] transition-colors",
                aLaParole || c.mainLevee ? "border-orange" : "border-nuit-ligne",
                onChoisir && "hover:border-orange-peche",
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", c.salleConnectee ? "bg-[#6FCF97]" : "bg-nuit-bord")} title={c.salleConnectee ? "Écran connecté" : "Écran non connecté"} />
              <span className="font-bold text-white">{c.nomCourt}</span>
              <span className="font-mono text-[11px] text-nuit-gris">{c.emarges} en salle</span>
              {c.incident && <span className="rounded-md bg-direct px-1.5 py-0.5 text-[10px] font-bold text-white">Incident</span>}
              {aLaParole ? (
                <span className="rounded-[7px] bg-orange px-1.5 py-0.5 text-[11px] font-extrabold text-encre">Parole</span>
              ) : c.mainLevee ? (
                <span className="rounded-[7px] bg-orange px-1.5 py-0.5 text-[11px] font-extrabold text-encre">Main</span>
              ) : null}
            </Balise>
          );
        })}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {campus.map((c) => {
        const aLaParole = paroleSiteId === c.siteId;
        const Balise = onChoisir ? "button" : "div";
        return (
          <Balise
            key={c.siteId}
            {...(onChoisir ? { onClick: () => onChoisir(c), "aria-label": `Donner la parole à ${c.nomCourt}` } : {})}
            className={cn(
              "relative aspect-[16/10] overflow-hidden rounded-[14px] border-2 bg-nuit-carte text-left transition-colors",
              aLaParole || c.mainLevee ? "border-orange" : "border-nuit-ligne",
              onChoisir && "hover:border-orange-peche",
            )}
          >
            <span className="absolute right-2 top-2 font-mono text-[11px] text-nuit-gris">{c.emarges} en salle</span>
            <span className={cn("absolute left-2 top-2.5 h-2 w-2 rounded-full", c.salleConnectee ? "bg-[#6FCF97]" : "bg-nuit-bord")} title={c.salleConnectee ? "Écran connecté" : "Écran non connecté"} />
            {c.incident && <span className="absolute left-2 top-7 rounded-md bg-direct px-1.5 py-0.5 text-[10px] font-bold text-white">Incident</span>}
            <span className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1.5">
              <span className="truncate rounded-[7px] bg-black/70 px-2 py-1 text-[12px] font-bold text-white">{c.nomCourt}</span>
              {aLaParole ? (
                <span className="rounded-[7px] bg-orange px-1.5 py-1 text-[11px] font-extrabold text-encre">Parole</span>
              ) : c.mainLevee ? (
                <span className="rounded-[7px] bg-orange px-1.5 py-1 text-[11px] font-extrabold text-encre">Main</span>
              ) : null}
            </span>
          </Balise>
        );
      })}
    </div>
  );
}

// ── Baromètre (formateur) et ressentis (étudiant) ──────────────────────────

export function Barometre({ barometre }: { barometre: BarometreSiteDto[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {barometre.map((b) => {
        const total = Math.max(1, b.total);
        const perdus = Math.round(((b.perdu + b.lent) / total) * 100);
        return (
          <div key={b.site} className="grid grid-cols-[112px_1fr_auto] items-center gap-2.5 text-[13px]">
            <span className="truncate font-bold text-white">{b.site}</span>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-nuit-ligne" aria-label={`${b.site} : ${b.compris} compris, ${b.perdu} perdus, ${b.lent} plus lentement, ${b.bravo} bravo`}>
              <div className="h-full bg-[#6FCF97]" style={{ width: `${((b.compris + b.bravo) / total) * 100}%` }} />
              <div className="h-full bg-orange" style={{ width: `${(b.lent / total) * 100}%` }} />
              <div className="h-full bg-direct" style={{ width: `${(b.perdu / total) * 100}%` }} />
            </div>
            <span className={cn("font-mono text-[12px]", b.total && perdus >= 30 ? "font-bold text-direct" : "text-nuit-gris")}>
              {b.total ? `${perdus} % perdus` : "—"}
            </span>
          </div>
        );
      })}
      <span className="text-[11px] text-nuit-gris">5 dernières minutes · vert : compris · orange : plus lentement · rouge : perdu</span>
    </div>
  );
}

export function BoutonsRessentis({ seanceId }: { seanceId: number }) {
  const [dernier, setDernier] = useState<string | null>(null);
  const envoyer = async (ressenti: string) => {
    try {
      await post(`/api/seances/${seanceId}/ressentis`, { ressenti });
      setDernier(ressenti);
      toast("Merci, le formateur le voit (sans ton nom).", "info");
    } catch (err) {
      toastErreur(err);
    }
  };
  return (
    <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:justify-center" role="group" aria-label="Ton ressenti">
      {RESSENTIS_UI.map((r) => (
        <button
          key={r.valeur}
          onClick={() => envoyer(r.valeur)}
          aria-pressed={dernier === r.valeur}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] px-2 text-[13px] font-bold leading-tight transition-colors sm:min-h-12 sm:flex-row sm:gap-1.5 sm:px-3.5 sm:text-[14px]",
            dernier === r.valeur ? "bg-orange text-encre" : "bg-nuit-carte text-white hover:bg-nuit-ligne",
          )}
        >
          <span aria-hidden className="text-lg sm:text-base">
            {r.emoji}
          </span>
          {r.libelle}
        </button>
      ))}
    </div>
  );
}

// ── « Voici ce que tu as raté » ────────────────────────────────────────────

export function CarteRattrapage({ rattrapage, onFermer }: { rattrapage: RattrapageDto; onFermer: () => void }) {
  const phrases = rattrapage.sousTitres.slice(-8);
  const repondues = rattrapage.questions.filter((q) => q.repondue);
  return (
    <div className="animate-monte rounded-[22px] bg-orange p-5 text-encre" role="status">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider">Pendant ta coupure · {rattrapage.minutesManquees} min</span>
          <p className="text-xl font-black tracking-serre">Voici ce que tu as raté</p>
        </div>
        <button onClick={onFermer} className="-m-2 rounded-full p-2 hover:bg-orange-fonce/20" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
      </div>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-snug">
        {rattrapage.diapos.length > 0 && <li>Diapos {rattrapage.diapos.map((d) => d.index + 1).join(", ")}</li>}
        {phrases.map((s) => (
          <li key={s.id}>
            <span className="font-mono text-[12px]">{minutage(s.t)}</span> {s.texte}
          </li>
        ))}
        {repondues.map((q) => (
          <li key={q.id}>
            Question répondue : « {q.texte} »
          </li>
        ))}
        {rattrapage.sondages.map((s) => (
          <li key={s.id}>Sondage : {s.question}</li>
        ))}
        {!phrases.length && !repondues.length && !rattrapage.diapos.length && !rattrapage.sondages.length && <li>Rien de marquant : le cours reprend là où tu l'as laissé.</li>}
      </ul>
      <Bouton variante="encre" className="mt-4" onClick={onFermer}>
        C'est bon, je reprends
      </Bouton>
    </div>
  );
}
