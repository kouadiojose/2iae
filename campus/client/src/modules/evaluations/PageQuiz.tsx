// /quiz/:id : l'interrogation sur téléphone. Consignes et durée, puis UNE
// question par écran, gros boutons, points de progression et chrono tenu par
// le serveur. Chaque réponse part aussitôt (et reste gardée sur le téléphone
// si le réseau coupe) : on reprend où on en était. Pas d'assistant IA ici.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CloudOff, Clock, ListChecks, Timer, RotateCcw, PauseCircle, Trophy } from "lucide-react";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { Markdown } from "@/components/ui/markdown";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { toastErreur } from "@/components/ui/toast";
import { useMoiConnecte } from "@/lib/auth";
import { post, put, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { duree } from "@/lib/dates";
import { cn, pluriel } from "@/lib/utils";
import type { DevoirDetail, DevoirDetailEtudiant, QuizEnCours, ResultatQuiz, QuestionEleve } from "@shared/schema";
import { CorrectionQuiz } from "./composants/CorrectionQuiz";
import { LETTRES, nombre, dateEtHeureCourte } from "./outils";

type Reponses = Record<string, (number | string)[]>;

/** Cadre nu de l'interrogation (pas de barre d'onglets : on se concentre). */
function Cadre({ children, entete }: { children: React.ReactNode; entete?: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-20 border-b border-ligne-douce bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">{entete}</div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}

export default function PageQuiz({ id }: { id: string }) {
  useMoiConnecte();
  const devoirId = Number(id);
  const { data, isLoading, error, refetch } = useQuery<DevoirDetail>({ queryKey: ["/api/devoirs", devoirId], enabled: Number.isInteger(devoirId) });
  const [enCours, setEnCours] = useState<QuizEnCours | null>(null);
  const [resultat, setResultat] = useState<ResultatQuiz | null>(null);
  const [depart, setDepart] = useState(false);

  const commencer = useCallback(async () => {
    setDepart(true);
    try {
      setResultat(null);
      setEnCours(await post<QuizEnCours>(`/api/quiz/${devoirId}/commencer`));
    } catch (e) {
      toastErreur(e);
      void refetch();
    } finally {
      setDepart(false);
    }
  }, [devoirId, refetch]);

  const fin = useCallback(
    (r: ResultatQuiz) => {
      setEnCours(null);
      setResultat(r);
      void rafraichir("/api/devoirs", "/api/notes");
    },
    [],
  );

  const retour = (
    <Link href="/devoirs" className="flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-texte-pale no-underline hover:text-encre">
      <ArrowLeft className="h-4 w-4" /> Mes devoirs
    </Link>
  );

  if (isLoading) {
    return (
      <Cadre entete={retour}>
        <Chargement lignes={3} />
      </Cadre>
    );
  }
  if (error || !data) {
    return (
      <Cadre entete={retour}>
        <Erreur message={(error as Error)?.message ?? "Interrogation introuvable."} reessayer={() => void refetch()} />
      </Cadre>
    );
  }
  if (data.vue === "enseignant") return <Redirect to={`/enseigner/devoirs/${devoirId}`} replace />;
  if (data.devoir.type !== "quiz") return <Redirect to={`/devoirs/${devoirId}`} replace />;

  if (enCours) return <Passage enCours={enCours} onFin={fin} />;
  if (resultat) return <Resultat r={resultat} d={data} onRecommencer={() => void commencer()} depart={depart} retour={retour} />;
  return <Accueil d={data} onCommencer={() => void commencer()} depart={depart} retour={retour} />;
}

// ── Avant de commencer ─────────────────────────────────────────────────────

function Accueil({ d, onCommencer, depart, retour }: { d: DevoirDetailEtudiant; onCommencer: () => void; depart: boolean; retour: React.ReactNode }) {
  const maintenant = useMaintenant(30_000);
  const { devoir } = d;
  const q = d.quiz!;
  const close = new Date(devoir.dateLimite).getTime() <= maintenant;
  const restantes = Math.max(0, q.tentativesMax - q.tentativesFaites);
  const faits = [
    { icone: <ListChecks className="h-5 w-5" />, texte: pluriel(q.nbQuestions, "question") },
    { icone: <Timer className="h-5 w-5" />, texte: devoir.dureeMinutes ? `${devoir.dureeMinutes} minutes` : "Sans chrono" },
    { icone: <RotateCcw className="h-5 w-5" />, texte: q.tentativesMax > 1 ? `${q.tentativesMax} tentatives` : "Une seule tentative" },
    { icone: <Clock className="h-5 w-5" />, texte: `Avant le ${dateEtHeureCourte(devoir.dateLimite)}` },
  ];

  let action: React.ReactNode;
  if (q.enCours) {
    action = (
      <Bouton taille="lg" pleineLargeur className="min-h-[64px] text-[17px]" onClick={onCommencer} chargement={depart} icone={<ArrowRight className="h-5 w-5" />}>
        Reprendre l'interrogation
      </Bouton>
    );
  } else if (!q.nbQuestions) {
    action = <p className="rounded-2xl bg-creme p-4 text-[15px] text-texte-doux">Cette interrogation n'est pas encore prête. Reviens un peu plus tard.</p>;
  } else if (close || restantes === 0) {
    action = null;
  } else {
    action = (
      <Bouton taille="lg" pleineLargeur className="min-h-[64px] text-[17px]" onClick={onCommencer} chargement={depart}>
        {q.tentativesFaites ? `Refaire l'interrogation (tentative ${q.tentativesFaites + 1} sur ${q.tentativesMax})` : "Commencer l'interrogation"}
      </Bouton>
    );
  }

  return (
    <Cadre entete={<>{retour}<span className="font-mono text-xs text-texte-gris">{devoir.coursCode}</span></>}>
      <div className="flex flex-col gap-2">
        <span className="etiquette">Interrogation · {devoir.coursCode}</span>
        <h1 className="titre-page">{devoir.titre}</h1>
      </div>
      <ul className="grid grid-cols-2 gap-2.5">
        {faits.map((f) => (
          <li key={f.texte} className="flex items-center gap-2.5 rounded-2xl bg-creme px-3.5 py-3 text-[15px] font-semibold">
            <span className="text-orange-fonce">{f.icone}</span>
            {f.texte}
          </li>
        ))}
      </ul>

      {q.meilleureNote !== null && (
        <div className="flex items-center justify-between gap-4 rounded-[24px] bg-encre p-5 text-white">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-orange-peche">{q.tentativesMax > 1 ? "Ta meilleure note" : "Ta note"}</div>
            <div className="text-[44px] font-black leading-none tracking-tres-serre tabular-nums">
              {nombre(q.meilleureNote)}
              <span className="text-xl text-nuit-gris">/{nombre(devoir.bareme)}</span>
            </div>
          </div>
          <Trophy className="h-10 w-10 text-orange" />
        </div>
      )}

      {q.enCours && q.enCours.finPrevueLe && (
        <p className="rounded-2xl bg-orange-clair p-4 text-[15px] text-orange-profond">
          Tu avais commencé : le chrono a continué pendant la coupure. Tes réponses déjà envoyées sont gardées.
        </p>
      )}

      {action}

      {!close && q.nbQuestions > 0 && restantes > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-ligne p-4 text-[15px] text-texte-doux">
          <strong className="text-encre">Comment ça se passe</strong>
          <span>• Une question par écran. Touche ta réponse : elle est enregistrée aussitôt.</span>
          <span>• Si le réseau coupe, pas de panique : tu reprendras où tu en étais. Le chrono, lui, continue.</span>
          <span className="flex items-center gap-1.5">
            <PauseCircle className="h-4 w-4 shrink-0 text-orange-fonce" /> L'assistant IA est en pause pendant l'interrogation.
          </span>
        </div>
      )}

      {devoir.consigne.trim() && (
        <div className="rounded-2xl bg-creme p-4">
          <Markdown source={devoir.consigne} className="[&>:first-child]:mt-0 [&>:last-child]:mb-0" />
        </div>
      )}

      {(close || restantes === 0) && q.tentativesFaites === 0 && !q.enCours && (
        <EtatVide titre="L'interrogation est close." texte="La date limite est passée sans tentative de ta part. Si tu as eu un problème, écris à ton formateur." />
      )}

      {q.correction ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-extrabold">Correction</h2>
          <CorrectionQuiz questions={q.correction} />
        </section>
      ) : q.tentativesFaites > 0 && q.correctionLe ? (
        <p className="text-center text-sm text-texte-gris">La correction détaillée sera visible après le {dateEtHeureCourte(q.correctionLe)}.</p>
      ) : null}
    </Cadre>
  );
}

// ── Pendant l'interrogation ────────────────────────────────────────────────

const cleLocale = (tentativeId: number) => `campus:quiz:${tentativeId}`;

function lireLocal(tentativeId: number): { reponses: Reponses; enAttente: number[] } {
  try {
    const brut = localStorage.getItem(cleLocale(tentativeId));
    if (brut) return JSON.parse(brut);
  } catch {
    /* rien de gardé */
  }
  return { reponses: {}, enAttente: [] };
}

function Passage({ enCours, onFin }: { enCours: QuizEnCours; onFin: (r: ResultatQuiz) => void }) {
  const { tentative, questions, devoir } = enCours;
  const [reponses, setReponses] = useState<Reponses>(() => {
    const local = lireLocal(tentative.id);
    // Les réponses gardées sur le téléphone mais pas encore arrivées l'emportent.
    const fusion = { ...tentative.reponses };
    for (const qid of local.enAttente) if (local.reponses[qid]) fusion[qid] = local.reponses[qid];
    return fusion;
  });
  const [enAttente, setEnAttente] = useState<Set<number>>(() => new Set(lireLocal(tentative.id).enAttente));
  const [envoiEnCours, setEnvoiEnCours] = useState<Set<number>>(new Set());
  const [index, setIndex] = useState(() => {
    const premiere = questions.findIndex((q) => !(tentative.reponses[String(q.id)]?.length));
    return premiere === -1 ? 0 : premiere;
  });
  const [confirmer, setConfirmer] = useState(false);
  const [finEnCours, setFinEnCours] = useState(false);
  const [erreurFin, setErreurFin] = useState<string | null>(null);
  const termine = useRef(false);
  const maintenant = useMaintenant(1000);

  const finMs = tentative.finPrevueLe ? new Date(tentative.finPrevueLe).getTime() : null;
  const restant = finMs ? Math.max(0, Math.floor((finMs - maintenant) / 1000)) : null;

  // Garde tout sur le téléphone à chaque changement.
  useEffect(() => {
    try {
      localStorage.setItem(cleLocale(tentative.id), JSON.stringify({ reponses, enAttente: [...enAttente] }));
    } catch {
      /* stockage indisponible */
    }
  }, [reponses, enAttente, tentative.id]);

  const envoyerReponse = useCallback(
    async (questionId: number, reponse: (number | string)[]) => {
      setEnvoiEnCours((s) => new Set(s).add(questionId));
      try {
        await put(`/api/quiz/tentatives/${tentative.id}/reponse`, { questionId, reponse });
        setEnAttente((s) => {
          const n = new Set(s);
          n.delete(questionId);
          return n;
        });
        return true;
      } catch (e) {
        if (e instanceof ErreurApi && e.statut === 409) {
          // Temps écoulé : le serveur a terminé l'interrogation avec les réponses reçues.
          void terminer(true);
          return false;
        }
        setEnAttente((s) => new Set(s).add(questionId));
        return false;
      } finally {
        setEnvoiEnCours((s) => {
          const n = new Set(s);
          n.delete(questionId);
          return n;
        });
      }
    },
    // terminer() ne dépend que de références stables (tentative, onFin, refs).
    [tentative.id],
  );

  // Réponses restées sur le téléphone : on réessaie régulièrement et au retour du réseau.
  const reponsesRef = useRef(reponses);
  reponsesRef.current = reponses;
  const attenteRef = useRef(enAttente);
  attenteRef.current = enAttente;
  const vider = useCallback(async () => {
    for (const qid of [...attenteRef.current]) {
      const r = reponsesRef.current[String(qid)];
      if (r) await envoyerReponse(qid, r);
    }
  }, [envoyerReponse]);
  useEffect(() => {
    const t = setInterval(() => void vider(), 8000);
    window.addEventListener("online", vider);
    void vider();
    return () => {
      clearInterval(t);
      window.removeEventListener("online", vider);
    };
  }, [vider]);

  async function terminer(horsDelai = false) {
    if (termine.current) return;
    termine.current = true;
    setConfirmer(false);
    setFinEnCours(true);
    setErreurFin(null);
    try {
      if (!horsDelai) await vider();
      const r = await post<ResultatQuiz>(`/api/quiz/tentatives/${tentative.id}/terminer`);
      try {
        localStorage.removeItem(cleLocale(tentative.id));
      } catch {
        /* rien */
      }
      onFin(r);
    } catch (e) {
      termine.current = false;
      setErreurFin(
        e instanceof ErreurApi && e.statut === 0
          ? "Pas de réseau pour terminer. Tes réponses sont gardées : réessaie dès que le réseau revient (sinon l'interrogation se terminera toute seule à la fin du temps)."
          : (e as Error).message,
      );
    } finally {
      setFinEnCours(false);
    }
  }

  // Fin du chrono : on termine automatiquement.
  useEffect(() => {
    if (restant === 0 && !termine.current) void terminer(true);
  }, [restant]);

  const q = questions[index];
  const cle = String(q.id);
  const maReponse = reponses[cle] ?? [];
  const repondues = questions.filter((x) => reponses[String(x.id)]?.length).length;

  function choisir(question: QuestionEleve, valeur: number | string) {
    let nouvelle: (number | string)[];
    if (question.type === "choix_multiple") {
      const actuelle = (reponses[String(question.id)] ?? []).map(Number);
      const v = Number(valeur);
      nouvelle = actuelle.includes(v) ? actuelle.filter((x) => x !== v) : [...actuelle, v].sort((a, b) => a - b);
    } else if (question.type === "reponse_courte") {
      nouvelle = String(valeur).trim() ? [String(valeur)] : [];
    } else nouvelle = [Number(valeur)];
    setReponses((r) => ({ ...r, [String(question.id)]: nouvelle }));
    setEnAttente((s) => new Set(s).add(question.id));
    void envoyerReponse(question.id, nouvelle);
  }

  const urgent = restant !== null && restant <= 60;
  const etatEnvoi = enAttente.has(q.id) && !envoiEnCours.has(q.id) ? "attente" : envoiEnCours.has(q.id) ? "envoi" : maReponse.length ? "ok" : null;

  return (
    <Cadre
      entete={
        <>
          <span className="flex flex-col leading-tight">
            <span className="font-mono text-[11px] text-texte-gris">{devoir.coursCode} · Interrogation</span>
            <span className="max-w-[55vw] truncate text-[15px] font-bold">{devoir.titre}</span>
          </span>
          {restant !== null ? (
            <span
              className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-2 font-mono text-[17px] font-semibold tabular-nums", urgent ? "bg-direct text-white" : "bg-encre text-white")}
              role="timer"
              aria-label={`Temps restant : ${duree(restant)}`}
            >
              <Timer className="h-4 w-4" />
              {duree(restant)}
            </span>
          ) : (
            <span className="rounded-full bg-creme px-3 py-1.5 font-mono text-xs text-texte-pale">Sans chrono</span>
          )}
        </>
      }
    >
      {enCours.reprise && index === questions.findIndex((x) => !(tentative.reponses[String(x.id)]?.length)) && (
        <p className="rounded-2xl bg-orange-clair px-4 py-3 text-[15px] text-orange-profond">On reprend où tu en étais : tes réponses précédentes sont gardées.</p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-bold">
            Question {index + 1} sur {questions.length}
          </span>
          <span className="font-mono text-xs text-texte-gris">{pluriel(repondues, "réponse")}</span>
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label="Aller à une question">
          {questions.map((x, i) => {
            const faite = Boolean(reponses[String(x.id)]?.length);
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Question ${i + 1}${faite ? ", répondue" : ""}`}
                aria-current={i === index ? "step" : undefined}
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full font-mono text-[13px] font-semibold transition-colors",
                  i === index ? "bg-encre text-white ring-2 ring-orange ring-offset-2" : faite ? "bg-orange text-encre" : "bg-creme text-texte-gris",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </nav>
      </div>

      <section key={q.id} className="flex flex-col gap-4 animate-apparait" aria-live="polite">
        <h1 className="text-[21px] font-extrabold leading-snug tracking-[-0.01em] sm:text-2xl">{q.enonce}</h1>
        <p className="font-mono text-xs uppercase tracking-wider text-texte-gris">
          {q.type === "choix_multiple" ? "Plusieurs réponses possibles" : q.type === "vrai_faux" ? "Vrai ou faux ?" : q.type === "reponse_courte" ? "Écris ta réponse" : "Une seule réponse"}
          {q.points !== 1 && ` · ${nombre(q.points)} points`}
        </p>

        {q.type === "reponse_courte" ? (
          <ReponseCourte key={q.id} valeur={String(maReponse[0] ?? "")} onValider={(v) => choisir(q, v)} />
        ) : (
          <div className={cn("grid gap-2.5", q.type === "vrai_faux" && "grid-cols-2")}>
            {q.options.map((o, j) => {
              const choisie = maReponse.map(Number).includes(j);
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() => choisir(q, j)}
                  aria-pressed={choisie}
                  className={cn(
                    "flex min-h-[64px] items-center gap-3.5 rounded-2xl border-2 px-4 py-3 text-left text-[17px] font-semibold transition-colors",
                    choisie ? "border-orange bg-orange text-encre" : "border-ligne bg-white text-encre hover:border-orange",
                    q.type === "vrai_faux" && "justify-center text-center text-lg",
                  )}
                >
                  {q.type !== "vrai_faux" && (
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center font-mono text-sm",
                        q.type === "choix_multiple" ? "rounded-lg" : "rounded-full",
                        choisie ? "bg-encre text-white" : "bg-creme text-texte-doux",
                      )}
                    >
                      {choisie && q.type === "choix_multiple" ? <Check className="h-4 w-4" /> : LETTRES[j]}
                    </span>
                  )}
                  <span className="flex-1">{o}</span>
                </button>
              );
            })}
          </div>
        )}

        <p className="min-h-[24px] text-sm" aria-live="polite">
          {etatEnvoi === "ok" && (
            <span className="inline-flex items-center gap-1.5 text-succes">
              <Check className="h-4 w-4" /> Réponse enregistrée
            </span>
          )}
          {etatEnvoi === "envoi" && <span className="text-texte-gris">Enregistrement…</span>}
          {etatEnvoi === "attente" && (
            <span className="inline-flex items-center gap-1.5 text-orange-profond">
              <CloudOff className="h-4 w-4" /> Pas de réseau : réponse gardée sur ton téléphone, elle partira toute seule.
            </span>
          )}
        </p>
      </section>

      {erreurFin && <Erreur message={erreurFin} reessayer={() => void terminer()} />}

      <div className="sticky bottom-0 -mx-4 flex gap-2.5 border-t border-ligne-douce bg-white/95 px-4 py-3 backdrop-blur bas-sur">
        <Bouton variante="contour" className="min-h-[56px] px-4" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} aria-label="Question précédente">
          <ArrowLeft className="h-5 w-5" />
        </Bouton>
        {index < questions.length - 1 ? (
          <Bouton taille="lg" className="min-h-[56px] flex-1" onClick={() => setIndex((i) => i + 1)} icone={<ArrowRight className="h-5 w-5" />}>
            Question suivante
          </Bouton>
        ) : (
          <Bouton taille="lg" variante="encre" className="min-h-[56px] flex-1" onClick={() => setConfirmer(true)} chargement={finEnCours}>
            Terminer l'interrogation
          </Bouton>
        )}
      </div>
      {index < questions.length - 1 && (
        <button type="button" onClick={() => setConfirmer(true)} className="-mt-3 min-h-[44px] self-center text-[15px] font-semibold text-texte-pale underline underline-offset-4 hover:text-encre">
          J'ai fini, terminer maintenant
        </button>
      )}

      <Fenetre
        ouverte={confirmer}
        onFermer={() => setConfirmer(false)}
        titre="Terminer l'interrogation ?"
        description={
          repondues < questions.length
            ? `Tu as répondu à ${repondues} question${repondues > 1 ? "s" : ""} sur ${questions.length}. Une fois terminée, tu ne pourras plus changer tes réponses.`
            : "Tu as répondu à toutes les questions. Une fois terminée, tu ne pourras plus changer tes réponses."
        }
        pied={
          <>
            <Bouton variante="contour" onClick={() => setConfirmer(false)}>
              Revenir aux questions
            </Bouton>
            <Bouton onClick={() => void terminer()} chargement={finEnCours}>
              Oui, terminer
            </Bouton>
          </>
        }
      />
    </Cadre>
  );
}

function ReponseCourte({ valeur, onValider }: { valeur: string; onValider: (v: string) => void }) {
  const [texte, setTexte] = useState(valeur);
  const valider = () => {
    if (texte.trim() !== valeur.trim()) onValider(texte);
  };
  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        valider();
      }}
    >
      <input
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        onBlur={valider}
        placeholder="Ta réponse"
        autoComplete="off"
        enterKeyHint="done"
        className="min-h-[60px] w-full rounded-2xl border-2 border-ligne bg-white px-4 text-lg outline-none focus:border-orange"
        aria-label="Ta réponse"
      />
      <Bouton type="submit" variante="encre" className="min-h-[52px]" disabled={!texte.trim() || texte.trim() === valeur.trim()}>
        Enregistrer ma réponse
      </Bouton>
    </form>
  );
}

// ── Après ──────────────────────────────────────────────────────────────────

function Resultat({ r, d, onRecommencer, depart, retour }: { r: ResultatQuiz; d: DevoirDetailEtudiant; onRecommencer: () => void; depart: boolean; retour: React.ReactNode }) {
  const maintenant = useMaintenant(30_000);
  const close = new Date(d.devoir.dateLimite).getTime() <= maintenant;
  return (
    <Cadre entete={retour}>
      <section className="flex flex-col items-center gap-3 rounded-[28px] bg-encre px-5 py-9 text-center text-white animate-monte">
        <span className="font-mono text-xs uppercase tracking-wider text-orange-peche">Interrogation terminée</span>
        <div className="text-[72px] font-black leading-none tracking-tres-serre tabular-nums">
          {nombre(r.note)}
          <span className="text-3xl text-nuit-gris">/{nombre(r.bareme)}</span>
        </div>
        <p className="text-[15px] text-nuit-doux">
          {nombre(r.score)} point{r.score > 1 ? "s" : ""} sur {nombre(r.total)}
          {r.meilleureNote > r.note && ` · ta meilleure note (${nombre(r.meilleureNote)}/${nombre(r.bareme)}) est gardée`}
        </p>
        {r.horsDelai && <p className="rounded-xl bg-nuit-carte px-3 py-2 text-sm text-nuit-texte">Le temps était écoulé : tes réponses déjà enregistrées ont été corrigées.</p>}
      </section>

      {r.tentativesRestantes > 0 && !close && (
        <Bouton variante="contour" taille="lg" pleineLargeur className="min-h-[56px]" onClick={onRecommencer} chargement={depart} icone={<RotateCcw className="h-5 w-5" />}>
          Refaire (encore {pluriel(r.tentativesRestantes, "tentative")})
        </Bouton>
      )}

      {r.correction ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-extrabold">Correction</h2>
          <CorrectionQuiz questions={r.correction} />
        </section>
      ) : r.correctionLe ? (
        <p className="rounded-2xl bg-creme p-4 text-center text-[15px] text-texte-doux">
          La correction détaillée sera visible après le {dateEtHeureCourte(r.correctionLe)}, quand tout le monde aura terminé.
        </p>
      ) : null}

      <LienBouton href="/devoirs" taille="lg" className="min-h-[56px] w-full">
        Revenir à mes devoirs
      </LienBouton>
    </Cadre>
  );
}
