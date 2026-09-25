// Studio du formateur (et vue d'observation de l'équipe) : visio en
// propriétaire, file des mains groupée par campus, questions votées,
// sondages éclair et question éclair IA, baromètre, présences par salle,
// chrono et plan, diapos (← →), sous-titres du navigateur, radio, Plan B.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Hand, Mic, MicOff, Play, Square, LifeBuoy, Ban, Sparkles, Captions, Radio, Plus, Trash2, Clock, Video, VideoOff, Check } from "lucide-react";
import { post, suppr } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { heureDouble } from "@/lib/dates";
import { Bouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { Champ, ZoneTexte, Interrupteur } from "@/components/ui/champs";
import { CompteARebours, useMaintenant } from "@/components/ui/compte-a-rebours";
import { toast, toastErreur } from "@/components/ui/toast";
import { EmetteurRadio, TestMicroCamera } from "@/modules/visio";
import { Scene } from "./scene";
import { PanneauQuestions, PanneauCampus, VignettesSalles, Barometre, ResultatsParCampus, OngletsPanneau } from "./panneaux";
import { EnTeteLive, FinDeSeance } from "./ui";
import { cleDirect, useEcranAllume, useEtatDirect } from "./outils";
import type { EtatDirectDto, MainDirectDto, SeanceDetailDto, SondageDto, ResultatsSondageDto } from "@shared/schema";

type OngletStudio = "mains" | "questions" | "sondages" | "campus";

export default function Studio({ seance, observation = false }: { seance: SeanceDetailDto; observation?: boolean }) {
  const { data: etat } = useEtatDirect(seance.id, true);
  const [onglet, setOnglet] = useState<OngletStudio>("mains");
  const [micro, setMicro] = useState(true);
  const [camera, setCamera] = useState(true);
  const [radio, setRadio] = useState(true);
  const [fluxVisio, setFluxVisio] = useState<MediaStream | null>(null);
  const [confirmation, setConfirmation] = useState<"terminer" | "planb" | "empechement" | null>(null);
  useEcranAllume(!observation);

  const statut = etat?.statut ?? seance.statut;
  const enDirect = statut === "en_direct";
  const flux = useFluxRadio(seance, enDirect && radio && !observation, fluxVisio);

  const agir = async (chemin: string, corps?: unknown, message?: string) => {
    try {
      await post(`/api/seances/${seance.id}/${chemin}`, corps);
      await Promise.all([rafraichir(`/api/seances/${seance.id}`), queryClient.invalidateQueries({ queryKey: cleDirect(seance.id) })]);
      if (message) toast(message);
      return true;
    } catch (e) {
      toastErreur(e);
      return false;
    }
  };

  // Diapos au clavier : ← →
  const changerDiapo = useCallback(
    async (delta: number) => {
      const actuel = queryClient.getQueryData<EtatDirectDto>(cleDirect(seance.id))?.diapo;
      if (!actuel?.total) return;
      const index = Math.min(actuel.total - 1, Math.max(0, actuel.index + delta));
      if (index === actuel.index) return;
      queryClient.setQueryData<EtatDirectDto>(cleDirect(seance.id), (x) => (x ? { ...x, diapo: { ...x.diapo, index, url: seance.diapos[index]?.url ?? x.diapo.url } } : x));
      try {
        await post(`/api/seances/${seance.id}/diapo`, { index });
      } catch (e) {
        toastErreur(e);
      }
    },
    [seance.id, seance.diapos],
  );
  useEffect(() => {
    if (observation) return;
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA" || cible.isContentEditable)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") void changerDiapo(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") void changerDiapo(-1);
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [changerDiapo, observation]);

  if (statut === "annulee" || statut === "terminee") return <FinDeSeance seance={{ ...seance, statut }} />;
  if (!etat) return <div className="min-h-[calc(100dvh-64px)] bg-nuit" aria-busy="true" />;

  const nbMains = etat.mains.length;
  const paroleSiteId = etat.parole?.type === "salle" ? etat.parole.siteId : null;

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-nuit px-3 pb-32 pt-4 text-white sm:px-6 lg:pb-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <EnTeteLive
          seance={seance}
          etat={etat}
          actions={
            observation ? (
              <span className="rounded-full bg-nuit-carte px-3 py-2 font-mono text-xs text-orange-peche">Vue d'observation</span>
            ) : (
              <>
                {statut === "planifiee" ? (
                  <Bouton variante="nuit-actif" icone={<Play className="h-4 w-4" />} onClick={() => agir("demarrer", {}, "Vous êtes en direct dans les cinq campus.")}>
                    Démarrer le direct
                  </Bouton>
                ) : (
                  <Bouton variante="danger" icone={<Square className="h-4 w-4" />} onClick={() => setConfirmation("terminer")}>
                    Terminer
                  </Bouton>
                )}
                <Bouton variante="nuit" icone={<LifeBuoy className="h-4 w-4" />} onClick={() => setConfirmation("planb")}>
                  Plan B
                </Bouton>
                <Bouton variante="nuit" icone={<Ban className="h-4 w-4" />} onClick={() => setConfirmation("empechement")}>
                  Empêchement
                </Bouton>
              </>
            )
          }
        />

        <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_400px] lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Colonne du plan (sous la scène sur les écrans moyens) */}
          <div className="order-3 flex flex-col gap-4 lg:order-3 xl:order-1">
            <ChronoPlan seance={seance} etat={etat} />
            {!observation && (
              <OutilsDiffusion seance={seance} enDirect={enDirect} radio={radio} setRadio={setRadio} fluxRadio={flux} />
            )}
          </div>

          <div className="order-1 flex min-w-0 flex-col gap-3 xl:order-2">
            {statut === "planifiee" && !observation && <Coulisses seance={seance} etat={etat} />}
            <Scene
              seance={seance}
              etat={etat}
              role={observation ? "equipe" : "formateur"}
              micro={!observation && micro}
              camera={!observation && camera}
              onFluxLocal={setFluxVisio}
            />
            <VignettesSalles
              campus={etat.campus}
              paroleSiteId={paroleSiteId}
              onChoisir={observation || !enDirect ? undefined : (c) => donnerParole(seance.id, { siteId: c.siteId })}
            />
            {!observation && (seance.fournisseur === "daily" || seance.fournisseur === "campus" || etat.parole) && !etat.planB && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {(seance.fournisseur === "daily" || seance.fournisseur === "campus") && (
                  <>
                <Bouton variante={micro ? "nuit-actif" : "nuit"} onClick={() => setMicro((m) => !m)} icone={micro ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}>
                  {micro ? "Micro activé" : "Micro coupé"}
                </Bouton>
                <Bouton variante={camera ? "nuit-actif" : "nuit"} onClick={() => setCamera((c) => !c)} icone={camera ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}>
                  {camera ? "Caméra activée" : "Caméra coupée"}
                </Bouton>
                  </>
                )}
                {etat.parole && (
                  <Bouton variante="nuit" onClick={() => reprendreParole(seance.id)}>
                    Reprendre la parole
                  </Bouton>
                )}
              </div>
            )}
            {!observation && <BandeDiapos seance={seance} etat={etat} onChanger={changerDiapo} />}
          </div>

          <aside className="order-2 flex min-h-[520px] flex-col overflow-hidden rounded-[22px] bg-nuit-panneau lg:order-2 xl:order-3">
            <OngletsPanneau
              valeur={onglet}
              onChange={setOnglet}
              options={[
                  { valeur: "mains", libelle: "Mains", compteur: nbMains || undefined },
                  { valeur: "questions", libelle: "Questions", compteur: etat.questions.filter((q) => !q.repondue && !q.masquee).length || undefined },
                  { valeur: "sondages", libelle: "Sondages" },
                  { valeur: "campus", libelle: "Campus" },
                ]}
            />
            {onglet === "mains" && <FileMains seanceId={seance.id} etat={etat} lectureSeule={observation} />}
            {onglet === "questions" && <PanneauQuestions seanceId={seance.id} etat={etat} role={observation ? "equipe" : "formateur"} enDirect={enDirect} />}
            {onglet === "sondages" && <PanneauSondages seance={seance} etat={etat} lectureSeule={observation} />}
            {onglet === "campus" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <PanneauCampus etat={etat} detaille />
                <div className="border-t border-nuit-ligne p-4">
                  <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-orange-peche">Baromètre de compréhension</p>
                  <Barometre barometre={etat.barometre} />
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <ConfirmationTerminer ouverte={confirmation === "terminer"} onFermer={() => setConfirmation(null)} onConfirmer={() => agir("terminer", {}, "Séance terminée. Le bilan est prêt.")} />
      <FenetrePlanB seance={seance} ouverte={confirmation === "planb"} onFermer={() => setConfirmation(null)} onConfirmer={(lien) => agir("plan-b", { lien }, "Tout le monde bascule sur le lien de secours.")} />
      <FenetreEmpechement ouverte={confirmation === "empechement"} onFermer={() => setConfirmation(null)} onConfirmer={(motif) => agir("annuler", { motif }, "Les inscrits et les salles sont prévenus.")} />
    </div>
  );
}

// ── Parole ─────────────────────────────────────────────────────────────────

async function donnerParole(seanceId: number, corps: { mainId?: number; siteId?: number }) {
  try {
    await post(`/api/seances/${seanceId}/parole`, corps);
  } catch (e) {
    toastErreur(e);
  }
}
async function reprendreParole(seanceId: number) {
  try {
    await suppr(`/api/seances/${seanceId}/parole`);
  } catch (e) {
    toastErreur(e);
  }
}

function FileMains({ seanceId, etat, lectureSeule }: { seanceId: number; etat: EtatDirectDto; lectureSeule: boolean }) {
  const maintenant = useMaintenant(1000);
  const groupes = useMemo(() => {
    const parSite = new Map<string, MainDirectDto[]>();
    for (const m of etat.mains) parSite.set(m.site ?? "En ligne", [...(parSite.get(m.site ?? "En ligne") ?? []), m]);
    return [...parSite.entries()];
  }, [etat.mains]);
  const plusTard = async (m: MainDirectDto) => {
    try {
      await post(`/api/seances/${seanceId}/mains/${m.id}/baisser`);
    } catch (e) {
      toastErreur(e);
    }
  };
  return (
    <div className="defile-fin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
      {etat.parole && (
        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-orange p-3.5 text-encre">
          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase">A la parole · {Math.max(0, Math.round((maintenant - new Date(etat.parole.depuis).getTime()) / 1000))} s</span>
            <span className="text-lg font-black">{etat.parole.libelle}</span>
          </div>
          {!lectureSeule && (
            <Bouton variante="encre" taille="sm" onClick={() => reprendreParole(seanceId)}>
              Reprendre
            </Bouton>
          )}
        </div>
      )}
      {!groupes.length && (
        <p className="px-2 py-8 text-center text-[15px] leading-relaxed text-nuit-doux">
          Aucune main levée. Les salles et les étudiants en ligne lèvent la main depuis leur écran ; vous pouvez aussi cliquer sur la vignette d'une salle pour lui donner la parole.
        </p>
      )}
      {groupes.map(([site, mains]) => (
        <div key={site} className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-orange-peche">{site}</span>
          {mains.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-nuit-bulle px-3.5 py-2.5">
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 text-[15px] font-bold">
                  <Hand className="h-4 w-4 shrink-0 text-orange" />
                  <span className="truncate">{m.pourSalle ? `${m.nom} (salle)` : `${m.nom} (en ligne)`}</span>
                </span>
                <span className="font-mono text-[11px] text-nuit-gris">
                  depuis {Math.max(0, Math.round((maintenant - new Date(m.leveeLe).getTime()) / 1000))} s{m.pasEncoreParle ? " · " : ""}
                  {m.pasEncoreParle && <span className="text-[#6FCF97]">pas encore parlé</span>}
                </span>
              </div>
              {!lectureSeule && (
                <div className="flex shrink-0 gap-1.5">
                  <Bouton variante="nuit-actif" taille="sm" onClick={() => donnerParole(seanceId, { mainId: m.id })}>
                    Parole
                  </Bouton>
                  <Bouton variante="nuit" taille="sm" onClick={() => plusTard(m)}>
                    Plus tard
                  </Bouton>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Sondages ───────────────────────────────────────────────────────────────

type SondageListe = SondageDto & { resultats: ResultatsSondageDto | null };
type Proposition = { question: string; options: string[]; bonneReponse: number | null; explication: string | null };

function PanneauSondages({ seance, etat, lectureSeule }: { seance: SeanceDetailDto; etat: EtatDirectDto; lectureSeule: boolean }) {
  const cle = [`/api/seances/${seance.id}/sondages`];
  const [liste, setListe] = useState<SondageListe[] | null>(null);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [bonne, setBonne] = useState<number | null>(null);
  const [propositions, setPropositions] = useState<Proposition[] | null>(null);
  const [iaEnCours, setIaEnCours] = useState(false);
  const enDirect = etat.statut === "en_direct";

  const charger = useCallback(async () => {
    const r = await queryClient.fetchQuery<SondageListe[]>({ queryKey: cle, staleTime: 0 });
    setListe(r);
  }, [seance.id]);
  useEffect(() => {
    void charger();
  }, [charger, etat.sondage?.id, etat.sondage?.ouvert]);

  const lancer = async (corps: { question: string; options: string[]; bonneReponse?: number | null; explication?: string | null; parIa?: boolean }) => {
    try {
      await post(`/api/seances/${seance.id}/sondages`, { ...corps, lancer: enDirect });
      toast(enDirect ? "Sondage lancé dans les cinq campus." : "Sondage préparé : lancez-le pendant le direct.");
      setQuestion("");
      setOptions(["", ""]);
      setBonne(null);
      setPropositions(null);
      await charger();
    } catch (e) {
      toastErreur(e);
    }
  };
  const ouvrir = async (id: number) => {
    try {
      await post(`/api/seances/${seance.id}/sondages/${id}/ouvrir`);
      await charger();
    } catch (e) {
      toastErreur(e);
    }
  };
  const fermer = async (id: number) => {
    try {
      await post(`/api/seances/${seance.id}/sondages/${id}/fermer`);
      await charger();
    } catch (e) {
      toastErreur(e);
    }
  };
  const questionEclair = async () => {
    setIaEnCours(true);
    try {
      const r = await post<{ questions: Proposition[] }>(`/api/seances/${seance.id}/question-eclair`);
      setPropositions(r.questions);
    } catch (e) {
      toastErreur(e);
    } finally {
      setIaEnCours(false);
    }
  };

  const ouvert = etat.sondage?.ouvert ? etat.sondage : null;
  const prepares = (liste ?? []).filter((s) => !s.ouvertLe);
  const passes = (liste ?? []).filter((s) => s.ouvertLe && !s.ouvert);
  const optionsValides = options.map((o) => o.trim()).filter(Boolean);

  return (
    <div className="defile-fin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3.5">
      {ouvert && (
        <div className="flex flex-col gap-3 rounded-[16px] border border-orange bg-nuit-bulle p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-orange">En cours · {etat.resultats?.total ?? 0} réponses</span>
            {!lectureSeule && (
              <Bouton variante="nuit-actif" taille="sm" onClick={() => fermer(ouvert.id)}>
                Fermer et montrer
              </Bouton>
            )}
          </div>
          <p className="text-[16px] font-extrabold">{ouvert.question}</p>
          {etat.resultats && <ResultatsParCampus sondage={ouvert} resultats={etat.resultats} />}
        </div>
      )}

      {!lectureSeule && (
        <div className="flex flex-col gap-2.5 rounded-[16px] bg-nuit-bulle p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-orange-peche">Question éclair</span>
            <Bouton
              variante="nuit"
              taille="sm"
              icone={<Sparkles className="h-4 w-4" />}
              chargement={iaEnCours}
              disabled={!seance.iaDisponible}
              onClick={questionEclair}
              title={seance.iaDisponible ? "3 questions tirées des 10 dernières minutes" : "Assistant IA non configuré"}
            >
              Proposée par l'IA
            </Bouton>
          </div>
          {!seance.iaDisponible && <p className="text-[12px] text-nuit-gris">L'assistant IA n'est pas configuré sur ce campus : saisissez votre question ci-dessous.</p>}
          {propositions && (
            <div className="flex flex-col gap-2">
              <span className="text-[12px] text-nuit-gris">Proposé par l'IA · relisez avant de lancer</span>
              {propositions.map((p, i) => (
                <div key={i} className="flex flex-col gap-1.5 rounded-xl bg-nuit-carte p-3">
                  <p className="text-[14px] font-bold">{p.question}</p>
                  <ul className="text-[13px] text-nuit-doux">
                    {p.options.map((o, j) => (
                      <li key={j} className={cn(j === p.bonneReponse && "font-bold text-[#6FCF97]")}>
                        {String.fromCharCode(65 + j)}. {o}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-1.5">
                    <Bouton variante="nuit-actif" taille="sm" onClick={() => lancer({ ...p, parIa: true })}>
                      {enDirect ? "Lancer" : "Préparer"}
                    </Bouton>
                    <Bouton
                      variante="nuit"
                      taille="sm"
                      onClick={() => {
                        setQuestion(p.question);
                        setOptions(p.options);
                        setBonne(p.bonneReponse);
                        setPropositions(null);
                      }}
                    >
                      Modifier
                    </Bouton>
                  </div>
                </div>
              ))}
            </div>
          )}
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Votre question…"
            aria-label="Question du sondage"
            className="min-h-11 rounded-xl border border-nuit-bord bg-nuit-carte px-3 text-[15px] text-white outline-none placeholder:text-nuit-gris focus:border-orange"
          />
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => setBonne(bonne === i ? null : i)}
                className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-sm", bonne === i ? "bg-[#6FCF97] text-encre" : "bg-nuit-ligne text-nuit-doux")}
                aria-label={bonne === i ? `Réponse ${String.fromCharCode(65 + i)} : bonne réponse` : `Marquer ${String.fromCharCode(65 + i)} comme bonne réponse`}
              >
                {bonne === i ? <Check className="h-4 w-4" /> : String.fromCharCode(65 + i)}
              </button>
              <input
                value={o}
                onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Réponse ${String.fromCharCode(65 + i)}`}
                aria-label={`Réponse ${String.fromCharCode(65 + i)}`}
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-nuit-bord bg-nuit-carte px-3 text-[14px] text-white outline-none placeholder:text-nuit-gris focus:border-orange"
              />
              {options.length > 2 && (
                <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="p-2 text-nuit-gris hover:text-white" aria-label="Retirer cette réponse">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {options.length < 5 && (
              <Bouton variante="nuit" taille="sm" icone={<Plus className="h-4 w-4" />} onClick={() => setOptions([...options, ""])}>
                Réponse
              </Bouton>
            )}
            <Bouton
              variante="nuit-actif"
              taille="sm"
              disabled={question.trim().length < 3 || optionsValides.length < 2}
              onClick={() => lancer({ question: question.trim(), options: optionsValides, bonneReponse: bonne !== null && bonne < optionsValides.length ? bonne : null })}
            >
              {enDirect ? "Lancer le sondage" : "Préparer"}
            </Bouton>
          </div>
          <span className="text-[11px] text-nuit-gris">Touchez une lettre pour indiquer la bonne réponse (facultatif).</span>
        </div>
      )}

      {prepares.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-nuit-gris">Préparés</span>
          {prepares.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-[14px] bg-nuit-bulle px-3.5 py-2.5">
              <span className="min-w-0 text-[14px] font-semibold">{s.question}</span>
              {!lectureSeule && (
                <Bouton variante="nuit-actif" taille="sm" disabled={!enDirect} onClick={() => ouvrir(s.id)}>
                  Lancer
                </Bouton>
              )}
            </div>
          ))}
        </div>
      )}
      {passes.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-nuit-gris">Déjà lancés</span>
          {passes.map((s) => (
            <details key={s.id} className="rounded-[14px] bg-nuit-bulle px-3.5 py-2.5">
              <summary className="cursor-pointer text-[14px] font-semibold">
                {s.question} <span className="font-mono text-[11px] text-nuit-gris">· {s.resultats?.total ?? 0} rép.</span>
              </summary>
              {s.resultats && (
                <div className="pt-3">
                  <ResultatsParCampus sondage={s} resultats={s.resultats} />
                </div>
              )}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chrono et plan de séance ───────────────────────────────────────────────

function ChronoPlan({ seance, etat }: { seance: SeanceDetailDto; etat: EtatDirectDto }) {
  const maintenant = useMaintenant(1000);
  const demarree = etat.demarreeLe ? new Date(etat.demarreeLe).getTime() : null;
  const ecouleMin = demarree ? (maintenant - demarree) / 60_000 : 0;
  const finPrevue = (demarree ?? new Date(seance.debut).getTime()) + seance.dureeMinutes * 60_000;
  const resteMin = Math.round((finPrevue - maintenant) / 60_000);
  let cumul = 0;
  const etapes = seance.plan.map((e) => {
    const debut = cumul;
    cumul += e.minutes ?? 0;
    return { ...e, debut, fin: cumul };
  });
  const courante = demarree ? etapes.findIndex((e) => ecouleMin < e.fin) : -1;
  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-nuit-panneau p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-orange-peche">
          <Clock className="h-3.5 w-3.5" /> Chrono
        </span>
        {demarree && resteMin < 0 && <span className="rounded-md bg-direct px-2 py-0.5 font-mono text-[11px] font-bold text-white">+{-resteMin} MIN</span>}
      </div>
      {demarree ? (
        <div className="text-[44px] font-black leading-none tabular-nums tracking-serre">
          {resteMin >= 0 ? resteMin : 0}
          <span className="ml-2 text-base font-bold tracking-normal text-nuit-gris">min restantes</span>
        </div>
      ) : (
        <CompteARebours cible={seance.debut} />
      )}
      <span className="font-mono text-[11px] text-nuit-gris">Fin prévue {heureDouble(finPrevue)}</span>
      {etapes.length > 0 ? (
        <ol className="flex flex-col gap-1.5">
          {etapes.map((e, i) => (
            <li key={i} className={cn("flex flex-col gap-1 rounded-xl px-3 py-2", i === courante ? "bg-orange text-encre" : "bg-nuit-bulle text-nuit-texte", courante > i && "opacity-50")}>
              <span className="flex items-center justify-between gap-2 text-[14px] font-bold">
                <span>
                  {i + 1}. {e.titre}
                </span>
                {e.minutes ? <span className="font-mono text-[11px]">{e.minutes} min</span> : null}
              </span>
              {i === courante && e.minutes ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-encre/20">
                  <div className="h-full bg-encre" style={{ width: `${Math.min(100, ((ecouleMin - e.debut) / e.minutes) * 100)}%` }} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[13px] text-nuit-gris">Aucun plan minuté. Ajoutez-le dans la préparation de la séance.</p>
      )}
    </div>
  );
}

// ── Diapos ─────────────────────────────────────────────────────────────────

function BandeDiapos({ seance, etat, onChanger }: { seance: SeanceDetailDto; etat: EtatDirectDto; onChanger: (delta: number) => void }) {
  if (!seance.diapos.length) {
    return (
      <p className="rounded-[18px] bg-nuit-panneau p-4 text-center text-[14px] text-nuit-doux">
        Pas de diapos pour cette séance.{" "}
        <a href={`/enseigner/seances/${seance.id}`} className="font-bold text-orange-peche">
          Déposer mes diapos
        </a>{" "}
        : elles s'affichent en image légère chez tous les étudiants.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-[18px] bg-nuit-panneau p-3">
      <div className="flex items-center justify-between gap-2">
        <Bouton variante="nuit" taille="sm" onClick={() => onChanger(-1)} disabled={etat.diapo.index === 0} icone={<ChevronLeft className="h-5 w-5" />} aria-label="Diapo précédente" className="min-h-11 min-w-11" />
        <span className="font-mono text-[12px] text-orange-peche">
          Diapo {etat.diapo.index + 1} / {etat.diapo.total} · touches ← →
        </span>
        <Bouton variante="nuit-actif" taille="sm" onClick={() => onChanger(1)} disabled={etat.diapo.index >= etat.diapo.total - 1} icone={<ChevronRight className="h-5 w-5" />} aria-label="Diapo suivante" className="min-h-11 min-w-11" />
      </div>
      <div className="defile-fin flex gap-2 overflow-x-auto pb-1">
        {seance.diapos.map((d) => (
          <button
            key={d.fichierId}
            onClick={() => onChanger(d.index - etat.diapo.index)}
            className={cn("relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border-2", d.index === etat.diapo.index ? "border-orange" : d.index === etat.diapo.index + 1 ? "border-orange-peche/50" : "border-transparent")}
            aria-label={`Aller à la diapo ${d.index + 1}`}
          >
            <img src={d.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Coulisses : avant le direct ────────────────────────────────────────────

function Coulisses({ seance, etat }: { seance: SeanceDetailDto; etat: EtatDirectDto }) {
  const pretes = etat.campus.filter((c) => c.salleConnectee || c.prete).length;
  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-nuit-panneau p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-extrabold">Coulisses · {pretes}/5 salles prêtes</span>
        <span className="font-mono text-[12px] text-nuit-gris">Les étudiants entrent 30 min avant le début</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {etat.campus.map((c) => (
          <span key={c.siteId} className={cn("rounded-full px-3 py-1.5 text-[13px] font-bold", c.salleConnectee || c.prete ? "bg-[#1F3A2B] text-[#6FCF97]" : "bg-nuit-ligne text-nuit-gris")}>
            {c.salleConnectee || c.prete ? "✓" : "…"} {c.nomCourt}
          </span>
        ))}
      </div>
      <details className="rounded-xl bg-nuit-bulle p-3">
        <summary className="cursor-pointer text-[14px] font-bold">Tester mon micro et ma caméra</summary>
        <div className="pt-3">
          <TestMicroCamera camera nuit />
        </div>
      </details>
      {seance.fournisseur === "demo" && <p className="text-[13px] text-nuit-gris">Séance de démonstration : pas de visio, tout le reste fonctionne (questions, mains, sondages, émargement).</p>}
    </div>
  );
}

// ── Diffusion : radio et sous-titres ───────────────────────────────────────

/** Flux micro de la radio : celui de la visio du campus, ou un micro séparé pour les autres fournisseurs. */
function useFluxRadio(seance: SeanceDetailDto, actif: boolean, fluxVisio: MediaStream | null): MediaStream | null {
  const [fluxSepare, setFluxSepare] = useState<MediaStream | null>(null);
  const besoinSepare = actif && seance.fournisseur !== "campus" && seance.fournisseur !== "demo";
  useEffect(() => {
    if (!besoinSepare || !navigator.mediaDevices?.getUserMedia) return;
    let flux: MediaStream | null = null;
    let annule = false;
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      .then((f) => {
        if (annule) f.getTracks().forEach((t) => t.stop());
        else {
          flux = f;
          setFluxSepare(f);
        }
      })
      .catch(() => toast("Micro indisponible pour la radio : vérifiez l'autorisation du navigateur.", "erreur"));
    return () => {
      annule = true;
      flux?.getTracks().forEach((t) => t.stop());
      setFluxSepare(null);
    };
  }, [besoinSepare]);
  if (!actif) return null;
  return seance.fournisseur === "campus" ? fluxVisio : fluxSepare;
}

type Reconnaissance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function OutilsDiffusion({ seance, enDirect, radio, setRadio, fluxRadio }: { seance: SeanceDetailDto; enDirect: boolean; radio: boolean; setRadio: (v: boolean) => void; fluxRadio: MediaStream | null }) {
  const [sousTitres, setSousTitres] = useState(false);
  const [provisoire, setProvisoire] = useState("");
  const Classe = typeof window !== "undefined" ? ((window as unknown as { SpeechRecognition?: new () => Reconnaissance; webkitSpeechRecognition?: new () => Reconnaissance }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Reconnaissance }).webkitSpeechRecognition) : undefined;
  const reco = useRef<Reconnaissance | null>(null);
  const tampon = useRef<{ texte: string }[]>([]);

  // Sous-titres : reconnaissance vocale du navigateur (fr-FR), envoyés par lots toutes les 4 s.
  useEffect(() => {
    if (!sousTitres || !enDirect || !Classe) return;
    let actif = true;
    const r = new Classe();
    r.lang = "fr-FR";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) tampon.current.push({ texte: res[0].transcript.trim() });
        else interim += res[0].transcript;
      }
      setProvisoire(interim);
    };
    // Elle s'arrête souvent dans les silences : on la relance.
    r.onend = () => {
      if (actif) {
        try {
          r.start();
        } catch {
          /* déjà relancée */
        }
      }
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") {
        actif = false;
        setSousTitres(false);
        toast("Autorisez le micro pour les sous-titres.", "erreur");
      }
    };
    try {
      r.start();
    } catch {
      /* rien */
    }
    reco.current = r;
    const envoi = setInterval(() => {
      const lignes = tampon.current.filter((l) => l.texte).splice(0, 20);
      tampon.current = [];
      if (lignes.length) void post(`/api/seances/${seance.id}/sous-titres`, { lignes }).catch(() => undefined);
    }, 4000);
    return () => {
      actif = false;
      clearInterval(envoi);
      r.onend = null;
      r.stop();
      reco.current = null;
    };
  }, [sousTitres, enDirect, seance.id]);

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-nuit-panneau p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="flex items-center gap-2 text-[15px] font-bold">
            <Radio className="h-4 w-4 text-orange" /> Radio pour les étudiants en ligne
          </span>
          <span className="text-[12px] text-nuit-gris">Votre voix en son léger (≈ 15 Mo/h) : des centaines d'étudiants en 3G/4G.</span>
        </div>
        <Interrupteur actif={radio} onChange={setRadio} libelle="Radio pour les étudiants en ligne" />
      </div>
      {seance.fournisseur === "demo" && radio && <span className="text-[12px] text-nuit-gris">Pas de radio en démonstration (aucun micro utilisé).</span>}
      <EmetteurRadio seanceId={seance.id} flux={fluxRadio} actif={radio && enDirect && Boolean(fluxRadio)} />
      <div className="flex items-start justify-between gap-3 border-t border-nuit-ligne pt-3">
        <div className="flex flex-col">
          <span className="flex items-center gap-2 text-[15px] font-bold">
            <Captions className="h-4 w-4 text-orange" /> Sous-titres <span className="rounded bg-nuit-ligne px-1.5 font-mono text-[10px] text-nuit-doux">bêta</span>
          </span>
          <span className="text-[12px] text-nuit-gris">
            {Classe ? "Reconnaissance vocale de votre navigateur, en français. Un micro-casque aide beaucoup." : "Ouvrez le studio avec Chrome ou Edge pour activer les sous-titres."}
          </span>
        </div>
        <Interrupteur actif={sousTitres} onChange={(v) => (Classe && enDirect ? setSousTitres(v) : toast(Classe ? "Les sous-titres démarrent avec le direct." : "Sous-titres indisponibles dans ce navigateur.", "info"))} libelle="Sous-titres" />
      </div>
      {sousTitres && provisoire && <p className="rounded-xl bg-nuit-bulle p-2.5 text-[13px] italic text-nuit-doux">{provisoire}</p>}
    </div>
  );
}

// ── Fenêtres de confirmation ───────────────────────────────────────────────

function ConfirmationTerminer({ ouverte, onFermer, onConfirmer }: { ouverte: boolean; onFermer: () => void; onConfirmer: () => Promise<boolean> }) {
  const [envoi, setEnvoi] = useState(false);
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Terminer le direct ?"
      description="Les cinq salles et les étudiants en ligne sont prévenus. Le bilan et la fiche de révision vous attendent ensuite."
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Continuer le cours
          </Bouton>
          <Bouton
            variante="danger"
            chargement={envoi}
            onClick={async () => {
              setEnvoi(true);
              if (await onConfirmer()) onFermer();
              setEnvoi(false);
            }}
          >
            Terminer le direct
          </Bouton>
        </>
      }
    />
  );
}

function FenetrePlanB({ seance, ouverte, onFermer, onConfirmer }: { seance: SeanceDetailDto; ouverte: boolean; onFermer: () => void; onConfirmer: (lien: string) => Promise<boolean> }) {
  const [lien, setLien] = useState(seance.lienSecours ?? "");
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => setLien(seance.lienSecours ?? ""), [seance.lienSecours]);
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Basculer sur le Plan B ?"
      description="Les cinq salles et tous les étudiants reçoivent l'ordre d'ouvrir ce lien. Questions, sondages et émargement continuent sur le campus."
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton
            chargement={envoi}
            disabled={!/^https?:\/\//.test(lien)}
            onClick={async () => {
              setEnvoi(true);
              if (await onConfirmer(lien)) onFermer();
              setEnvoi(false);
            }}
          >
            Basculer tout le monde
          </Bouton>
        </>
      }
    >
      <Champ libelle="Lien de secours (Zoom, Meet, Teams, Jitsi)" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://meet.google.com/…" inputMode="url" />
    </Fenetre>
  );
}

function FenetreEmpechement({ ouverte, onFermer, onConfirmer }: { ouverte: boolean; onFermer: () => void; onConfirmer: (motif: string) => Promise<boolean> }) {
  const [motif, setMotif] = useState("Le formateur a un empêchement. La séance sera reprogrammée.");
  const [envoi, setEnvoi] = useState(false);
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Signaler un empêchement"
      description="La séance est annulée : les inscrits sont prévenus et le message s'affiche sur les écrans des salles."
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Retour
          </Bouton>
          <Bouton
            variante="danger"
            chargement={envoi}
            disabled={motif.trim().length < 3}
            onClick={async () => {
              setEnvoi(true);
              if (await onConfirmer(motif.trim())) onFermer();
              setEnvoi(false);
            }}
          >
            Annuler la séance
          </Bouton>
        </>
      }
    >
      <ZoneTexte libelle="Message aux étudiants et aux salles" value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} />
    </Fenetre>
  );
}

