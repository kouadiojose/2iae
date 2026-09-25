// Salle live de l'étudiant (mode nuit) : choix honnête de la façon de suivre
// (son + diapos, vidéo, ou compagnon dans la salle de conférence), scène,
// questions votées, sondages, main levée, ressentis, présence par
// battements et « Voici ce que tu as raté » après une coupure.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Hand, LogOut, Radio, Video, Users, Mic, CalendarPlus, Signal } from "lucide-react";
import { get, post, suppr } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { dateEtHeure } from "@/lib/dates";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { CompteARebours } from "@/components/ui/compte-a-rebours";
import { toast, toastErreur } from "@/components/ui/toast";
import { TestMicroCamera } from "@/modules/visio";
import { Scene } from "./scene";
import { PanneauQuestions, PanneauCampus, PanneauAssistant, SondageSuperpose, VignettesSalles, BoutonsRessentis, CarteRattrapage, OngletsPanneau } from "./panneaux";
import { EnTeteLive, FinDeSeance, ChampCode } from "./ui";
import { CONSOMMATION, cleDirect, estimationMo, formatMo, octetsMesuresDepuis, useEtatDirect } from "./outils";
import type { EtatDirectDto, MainDirectDto, ModeSuivi, RattrapageDto, SeanceDetailDto, EmargementDto } from "@shared/schema";

type Panneau = "questions" | "campus" | "assistant";

const cleMode = (id: number) => `campus:live:mode:${id}`;

export default function SalleEtudiant({ seance }: { seance: SeanceDetailDto }) {
  const [mode, setMode] = useState<ModeSuivi | null>(() => {
    const garde = localStorage.getItem(cleMode(seance.id)) as ModeSuivi | null;
    if (garde === "compagnon" && seance.maPresence?.mode !== "salle") return null;
    return garde;
  });
  const choisir = (m: ModeSuivi | null) => {
    setMode(m);
    if (m) localStorage.setItem(cleMode(seance.id), m);
    else localStorage.removeItem(cleMode(seance.id));
  };

  if (seance.statut === "annulee" || seance.statut === "terminee") return <FinDeSeance seance={seance} />;
  if (!mode) return <ChoixMode seance={seance} onChoix={choisir} />;
  return <SalleEnDirect seance={seance} mode={mode} onChangerMode={choisir} />;
}

// ── Écran de préparation : comment suis-tu le cours ? ──────────────────────

function ChoixMode({ seance, onChoix }: { seance: SeanceDetailDto; onChoix: (m: ModeSuivi) => void }) {
  const moi = useMoiConnecte();
  const [choix, setChoix] = useState<ModeSuivi>(moi.preferences?.modeSuivi === "salle" ? "compagnon" : moi.preferences?.donneesReduites === false && moi.preferences?.modeSuivi === "ordinateur" ? "video" : "radio");
  const [code, setCode] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurCode, setErreurCode] = useState<string | null>(null);
  const [micOk, setMicOk] = useState(false);
  const dejaEnSalle = seance.maPresence?.mode === "salle";

  const entrer = async () => {
    if (choix !== "compagnon" || dejaEnSalle) return onChoix(choix);
    setEnvoi(true);
    setErreurCode(null);
    try {
      const r = await post<EmargementDto>("/api/emargement", { code });
      if (r.seanceId !== seance.id) {
        setErreurCode(`Ce code est celui d'une autre séance (${r.titre}).`);
        return;
      }
      toast(`✓ Présent · ${r.site}`);
      await queryClient.invalidateQueries({ queryKey: [`/api/seances/${seance.id}`] });
      onChoix("compagnon");
    } catch (e) {
      setErreurCode((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  const options: { m: ModeSuivi; icone: ReactNode; recommande?: boolean }[] = [
    { m: "radio", icone: <Radio className="h-6 w-6" />, recommande: true },
    { m: "video", icone: <Video className="h-6 w-6" /> },
    { m: "compagnon", icone: <Users className="h-6 w-6" /> },
  ];

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-nuit px-4 pb-32 pt-6 text-white sm:px-7 lg:pb-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <EnTeteLive seance={seance} />
        {seance.statut === "planifiee" && (
          <div className="flex flex-col gap-3 rounded-[22px] bg-nuit-panneau p-5">
            <span className="font-mono text-xs text-nuit-gris">Début · {dateEtHeure(seance.debut)}</span>
            <CompteARebours cible={seance.debut} />
            <a href={`/api/agenda/seances/${seance.id}.ics`} className="flex items-center gap-2 text-sm font-bold text-orange-peche hover:text-white">
              <CalendarPlus className="h-4 w-4" /> Ajouter à mon agenda
            </a>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black tracking-serre">Comment suis-tu le cours ?</h2>
          <p className="text-[15px] text-nuit-doux">La consommation est indiquée honnêtement : à la sortie, on te dira combien le cours t'a coûté.</p>
        </div>
        <div className="grid gap-3" role="radiogroup" aria-label="Façon de suivre le cours">
          {options.map(({ m, icone, recommande }) => {
            const c = CONSOMMATION[m];
            const actif = choix === m;
            return (
              <button
                key={m}
                role="radio"
                aria-checked={actif}
                onClick={() => setChoix(m)}
                className={cn(
                  "flex min-h-[84px] items-start gap-4 rounded-[20px] border-2 p-4 text-left transition-colors",
                  actif ? "border-orange bg-nuit-carte" : "border-nuit-ligne bg-nuit-panneau hover:border-nuit-bord",
                )}
              >
                <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-full", actif ? "bg-orange text-encre" : "bg-nuit-ligne text-orange")}>{icone}</span>
                <span className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
                    {c.titre}
                    {recommande && <span className="rounded-full bg-orange px-2 py-0.5 font-mono text-[11px] font-normal text-encre">recommandé en 4G</span>}
                  </span>
                  <span className="font-mono text-[13px] text-orange-peche">{c.resume}</span>
                  <span className="text-[14px] leading-snug text-nuit-doux">{c.detail}</span>
                </span>
              </button>
            );
          })}
        </div>

        {choix === "compagnon" && !dejaEnSalle && (
          <div className="flex flex-col gap-3 rounded-[22px] bg-nuit-panneau p-5">
            <p className="text-[15px] font-bold">Tape le code à 4 chiffres affiché sur l'écran de la salle.</p>
            <ChampCode valeur={code} onChange={setCode} nuit />
            {erreurCode && <p className="text-[14px] font-semibold text-[#FF8A6B]" role="alert">{erreurCode}</p>}
            <p className="text-[13px] text-nuit-gris">Le code change chaque minute. Ta présence est enregistrée pour ta salle.</p>
          </div>
        )}
        {choix === "compagnon" && dejaEnSalle && <p className="rounded-[18px] bg-nuit-panneau p-4 text-[15px] font-bold text-[#6FCF97]">✓ Tu es déjà émargé dans ta salle.</p>}

        {choix === "video" && (
          <div className="flex flex-col gap-2 rounded-[22px] bg-nuit-panneau p-5">
            <p className="text-[15px] font-bold">Vérifie ton son avant d'entrer</p>
            <p className="text-[13px] text-nuit-gris">Ton micro reste coupé : il ne s'ouvre que si le formateur te donne la parole.</p>
            <TestMicroCamera camera={false} nuit onPret={setMicOk} />
            {micOk && <p className="text-[13px] font-semibold text-[#6FCF97]">✓ Son vérifié</p>}
          </div>
        )}

        <Bouton taille="lg" pleineLargeur onClick={entrer} chargement={envoi} disabled={choix === "compagnon" && !dejaEnSalle && code.length !== 4}>
          {choix === "compagnon" ? (dejaEnSalle ? "Suivre depuis la salle" : "Valider ma présence en salle") : "Entrer dans la classe"}
        </Bouton>
      </div>
    </div>
  );
}

// ── La salle en direct ─────────────────────────────────────────────────────

function SalleEnDirect({ seance, mode, onChangerMode }: { seance: SeanceDetailDto; mode: ModeSuivi; onChangerMode: (m: ModeSuivi | null) => void }) {
  const moi = useMoiConnecte();
  const [panneau, setPanneau] = useState<Panneau>("questions");
  const [rattrapage, setRattrapage] = useState<RattrapageDto | null>(null);
  const [sortie, setSortie] = useState<{ mo: number; mesure: boolean; minutes: number } | null>(null);
  const [octetsVisio, setOctetsVisio] = useState(0);
  const [octetsRadio, setOctetsRadio] = useState(0);
  const arrivee = useRef(Date.now());
  const dernierBattement = useRef<number>(Date.now());
  const { data: etat } = useEtatDirect(seance.id, false);

  const enDirect = (etat?.statut ?? seance.statut) === "en_direct";
  const maMain: MainDirectDto | undefined = etat?.mains[0];
  const jaiLaParole = etat?.parole?.type === "etudiant" && etat.parole.utilisateurId === moi.id;

  // Présence : un battement par minute pendant le direct ; au retour d'une coupure de plus de 2 min, le rattrapage.
  useEffect(() => {
    if (!enDirect) return;
    let actif = true;
    const battre = async () => {
      try {
        await post(`/api/seances/${seance.id}/presence`, { mode });
        const absence = Date.now() - dernierBattement.current;
        if (absence > 2 * 60_000 && actif) {
          const depuis = new Date(dernierBattement.current).toISOString();
          const r = await get<RattrapageDto>(`/api/seances/${seance.id}/rattrapage?depuis=${encodeURIComponent(depuis)}`);
          setRattrapage(r);
        }
        dernierBattement.current = Date.now();
      } catch {
        /* hors réseau : on réessaie à la prochaine minute, les minutes ne sont pas perdues */
      }
    };
    void battre();
    const id = setInterval(battre, 60_000);
    const auRetour = () => void battre();
    window.addEventListener("online", auRetour);
    return () => {
      actif = false;
      clearInterval(id);
      window.removeEventListener("online", auRetour);
    };
  }, [enDirect, mode, seance.id]);

  const leverMain = async () => {
    try {
      const mains = maMain ? await suppr<MainDirectDto[]>(`/api/seances/${seance.id}/mains`) : await post<MainDirectDto[]>(`/api/seances/${seance.id}/mains`);
      queryClient.setQueryData<EtatDirectDto>(cleDirect(seance.id), (x) => (x ? { ...x, mains } : x));
      toast(maMain ? "Main baissée." : "Main levée : le formateur la voit dans sa file.", "info");
    } catch (e) {
      toastErreur(e);
    }
  };

  const quitter = () => {
    const secondes = (Date.now() - arrivee.current) / 1000;
    const mesures = octetsMesuresDepuis(arrivee.current) + octetsVisio + octetsRadio;
    const estime = estimationMo(mode, secondes);
    // Mesure réelle quand la visio ou la radio a compté ses octets ; sinon estimation selon le mode.
    const mesure = octetsVisio > 0 || octetsRadio > 0;
    setSortie({ mo: mesure ? mesures / 1_000_000 : Math.max(estime, mesures / 1_000_000), mesure, minutes: Math.round(secondes / 60) });
  };

  const surVisio = useCallback((o: number) => setOctetsVisio(o), []);
  const surRadio = useCallback((o: number) => setOctetsRadio(o), []);

  if (sortie) {
    return (
      <div className="grid min-h-[calc(100dvh-64px)] place-items-center bg-nuit px-4 pb-28 text-white">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <span className="etiquette text-orange-peche">À bientôt</span>
          <p className="text-3xl font-black tracking-serre">Ce cours t'a coûté environ {formatMo(sortie.mo)}.</p>
          <p className="text-[15px] text-nuit-doux">
            {sortie.mesure ? "Consommation mesurée sur ton téléphone" : `Estimation pour le mode « ${CONSOMMATION[mode].titre} »`} · {sortie.minutes} min de cours.
            {mode === "radio" && " En vidéo, c'est environ dix fois plus."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Bouton variante="nuit" onClick={() => setSortie(null)}>
              Revenir dans la classe
            </Bouton>
            <LienBouton href="/direct">Terminer</LienBouton>
          </div>
        </div>
      </div>
    );
  }

  if (!etat) return <div className="min-h-[calc(100dvh-64px)] bg-nuit" aria-busy="true" />;
  if (etat.statut === "terminee" || etat.statut === "annulee") return <FinDeSeance seance={{ ...seance, statut: etat.statut, motifAnnulation: etat.motifAnnulation }} />;

  const micro = jaiLaParole && mode === "video";
  const panneaux = (
    <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-[22px] bg-nuit-panneau lg:min-h-0">
      <OngletsPanneau
        valeur={panneau}
        onChange={setPanneau}
        options={[
            { valeur: "questions", libelle: "Questions", compteur: etat.questions.length || undefined },
            { valeur: "campus", libelle: "Campus" },
            { valeur: "assistant", libelle: "Assistant" },
          ]}
      />
      {panneau === "questions" && <PanneauQuestions seanceId={seance.id} etat={etat} role="etudiant" enDirect={enDirect} />}
      {panneau === "campus" && <PanneauCampus etat={etat} />}
      {panneau === "assistant" && <PanneauAssistant etat={etat} iaDisponible={seance.iaDisponible} />}
    </aside>
  );

  return (
    <div className="relative min-h-[calc(100dvh-64px)] bg-nuit px-3 pb-32 pt-4 text-white sm:px-6 lg:pb-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
        <EnTeteLive seance={seance} etat={etat} mode={mode} />
        {rattrapage && <CarteRattrapage rattrapage={rattrapage} onFermer={() => setRattrapage(null)} />}
        {!enDirect && (
          <div className="flex flex-col gap-3 rounded-[22px] bg-nuit-panneau p-5">
            <p className="text-lg font-extrabold">Le formateur n'a pas encore ouvert la classe.</p>
            <CompteARebours cible={seance.debut} />
            <p className="text-[14px] text-nuit-doux">Tu peux déjà poser tes questions : elles l'attendront.</p>
          </div>
        )}
        {jaiLaParole && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-orange p-4 text-encre" role="alert">
            <span className="flex items-center gap-2 text-lg font-black">
              <Mic className="h-5 w-5" /> {mode === "video" ? "Tu as la parole : ton micro est ouvert." : "Le formateur te donne la parole."}
            </span>
            {mode !== "video" && (
              <Bouton variante="encre" onClick={() => onChangerMode("video")}>
                Ouvrir mon micro
              </Bouton>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Scene seance={seance} etat={etat} role="etudiant" mode={mode} micro={micro} onConsommationVisio={surVisio} onConsommationRadio={surRadio} />
            {mode === "video" ? (
              <div className="hidden sm:block">
                <VignettesSalles campus={etat.campus} paroleSiteId={etat.parole?.type === "salle" ? etat.parole.siteId : null} />
              </div>
            ) : null}
            <p className="font-mono text-[12px] leading-relaxed text-nuit-gris sm:hidden">
              En direct avec {etat.campus.map((c) => `${c.nomCourt} ${c.emarges}`).join(" · ")} · en ligne {etat.enLigne}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Bouton variante={maMain ? "nuit-actif" : "nuit"} onClick={leverMain} disabled={!enDirect} icone={<Hand className="h-4 w-4" />} className="min-h-12">
                {maMain ? "Main levée" : "Lever la main"}
              </Bouton>
              <Bouton variante="danger" onClick={quitter} icone={<LogOut className="h-4 w-4" />} className="min-h-12">
                Quitter
              </Bouton>
            </div>
            {enDirect && <BoutonsRessentis seanceId={seance.id} />}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-nuit-gris">
              <span className="flex items-center gap-1.5">
                <Signal className="h-3.5 w-3.5" /> {CONSOMMATION[mode].titre} · {CONSOMMATION[mode].resume}
              </span>
              <button onClick={() => onChangerMode(null)} className="font-bold text-orange-peche underline-offset-2 hover:underline">
                Changer de mode
              </button>
            </div>
          </div>
          {panneaux}
        </div>
      </div>
      {etat.sondage && <SondageSuperpose seanceId={seance.id} etat={etat} />}
      <span className="sr-only" aria-live="polite">
        {etat.parole ? `${etat.parole.libelle} a la parole` : ""}
      </span>
    </div>
  );
}
