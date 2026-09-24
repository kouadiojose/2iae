// /salle — écran de la salle de conférence (kiosque) : plein écran, lisible
// du fond de la salle, AUCUN clic nécessaire. Avant le cours : compte à
// rebours géant, carte des campus qui s'allument, code d'émargement + QR
// renouvelés chaque minute. Pendant : la visio en grand, « M'BATTO A LA
// PAROLE », la question en cours, les résultats des sondages par campus.
// Une petite console en bas sert au responsable de salle. Aucun nom
// d'étudiant n'est jamais affiché ici.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Hand, Minus, Plus, CheckCircle2, CircleAlert, Maximize } from "lucide-react";
import { get, post, put, suppr } from "@/lib/api";
import { useMoiConnecte } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { heure, dateEtHeure, decompte } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { toastErreur, Toasts } from "@/components/ui/toast";
import { Scene } from "./scene";
import { ResultatsParCampus } from "./panneaux";
import { CarteCoteIvoire } from "./CarteCoteIvoire";
import { cleDirect, useEcranAllume, useEtatDirect, useSeance } from "./outils";
import type { CodeSalleDto, EtatDirectDto, MainDirectDto, SeanceDetailDto } from "@shared/schema";
import type { EnCours, SeanceResume } from "@shared/api";

const INCIDENTS = ["Son coupé", "Image figée", "Plus d'électricité", "Plus d'internet", "Salle bruyante"];

export default function PageSalle() {
  const moi = useMoiConnecte();
  useEcranAllume(true);
  const siteParam = Number(new URLSearchParams(window.location.search).get("site")) || null;
  const siteId = moi.role === "salle" || (moi.role === "vie_scolaire" && moi.siteId) ? moi.siteId : siteParam ?? 1;

  const { data: enCours } = useQuery<EnCours>({ queryKey: ["/api/live/en-cours"], refetchInterval: 30_000 });
  const { data: duJour } = useQuery<SeanceResume[]>({ queryKey: ["/api/seances?periode=jour"], refetchInterval: 60_000 });
  // Séance à afficher : celle en direct, sinon la prochaine, sinon la dernière du jour (annulée ou terminée).
  const seanceId = enCours?.enDirect?.id ?? enCours?.prochaine?.id ?? duJour?.[duJour.length - 1]?.id ?? null;

  return (
    <div className="min-h-dvh bg-nuit text-white">
      {seanceId ? <EcranSeance seanceId={seanceId} siteId={siteId} /> : <EcranSansCours siteId={siteId} enCours={enCours} />}
      <Toasts />
    </div>
  );
}

function BandeauHaut({ seance, siteId }: { seance?: SeanceDetailDto; siteId: number | null }) {
  const maintenant = useMaintenant(1000);
  const site = seance?.sites.find((s) => s.id === siteId);
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-6 pt-5 lg:px-10">
      <div className="flex items-center gap-4">
        <img src="/marque-2iae.svg" alt="2IAE" className="h-10 w-auto rounded bg-white p-1" />
        <span className="font-mono text-sm uppercase tracking-[0.14em] text-nuit-doux lg:text-base">
          {site ? `${site.salleConference} · ${site.nomCourt}` : "Salle de conférence"}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {seance && (
          <span className="flex items-center gap-2 rounded-full bg-[#2A1510] px-4 py-2 font-mono text-sm text-[#FF8A6B]">
            <span className="point-direct" />
            {seance.fournisseur === "daily" ? "Ce cours est enregistré" : "Questions et sous-titres gardés pour le replay"}
          </span>
        )}
        <span className="font-mono text-2xl tabular-nums text-white lg:text-3xl">{heure(maintenant)}</span>
        <button
          onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
          className="rounded-full p-2 text-nuit-gris hover:text-white"
          aria-label="Plein écran"
        >
          <Maximize className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function EcranSansCours({ siteId, enCours }: { siteId: number | null; enCours?: EnCours }) {
  return (
    <>
      <BandeauHaut siteId={siteId} />
      <div className="grid min-h-[80dvh] place-items-center px-6 text-center">
        <div className="flex max-w-3xl flex-col items-center gap-5">
          <span className="etiquette text-orange-peche">Campus numérique 2IAE</span>
          <p className="text-[clamp(36px,5vw,80px)] font-black leading-none tracking-serre">Aucun cours aujourd'hui dans cette salle.</p>
          {enCours?.prochaine ? (
            <p className="text-2xl text-nuit-doux">Prochain live : {enCours.prochaine.titre} · {dateEtHeure(enCours.prochaine.debut)}</p>
          ) : (
            <p className="text-2xl text-nuit-doux">Cet écran s'allumera tout seul avant le prochain live.</p>
          )}
        </div>
      </div>
    </>
  );
}

function EcranSeance({ seanceId, siteId }: { seanceId: number; siteId: number | null }) {
  const { data: seance } = useSeance(seanceId);
  const { data: etat } = useEtatDirect(seanceId, false);
  if (!seance || !etat) return <div className="min-h-dvh" aria-busy="true" />;
  const statut = etat.statut;
  return (
    <div className="flex min-h-dvh flex-col">
      <BandeauHaut seance={seance} siteId={siteId} />
      {statut === "annulee" ? (
        <Message titre="Cours annulé" texte={etat.motifAnnulation ?? seance.motifAnnulation ?? "Le formateur a un empêchement."} seance={seance} />
      ) : statut === "terminee" ? (
        <Message titre="Merci et à bientôt !" texte="Le replay, la transcription et la fiche de révision arrivent dans le cours sur le campus numérique." seance={seance} />
      ) : statut === "planifiee" ? (
        <AvantLeCours seance={seance} etat={etat} siteId={siteId} />
      ) : (
        <PendantLeCours seance={seance} etat={etat} siteId={siteId} />
      )}
      {siteId && (statut === "planifiee" || statut === "en_direct") && <ConsoleResponsable seance={seance} etat={etat} siteId={siteId} />}
    </div>
  );
}

function Message({ titre, texte, seance }: { titre: string; texte: string; seance: SeanceDetailDto }) {
  return (
    <div className="grid flex-1 place-items-center px-6 text-center">
      <div className="flex max-w-4xl flex-col items-center gap-6">
        <span className="font-mono text-xl text-orange-peche">
          {seance.coursCode} · {seance.titre}
        </span>
        <p className="text-[clamp(44px,7vw,110px)] font-black leading-none tracking-serre">{titre}</p>
        <p className="rounded-3xl bg-nuit-carte px-8 py-5 text-[clamp(22px,2.4vw,40px)] font-semibold leading-snug">{texte}</p>
      </div>
    </div>
  );
}

// ── Code d'émargement renouvelé chaque minute ──────────────────────────────

function useCodeSalle(seanceId: number, siteId: number | null, actif: boolean) {
  const [code, setCode] = useState<CodeSalleDto | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (!actif || !siteId) return;
    let minuterie: ReturnType<typeof setTimeout>;
    let fini = false;
    const charger = async () => {
      try {
        const c = await get<CodeSalleDto>(`/api/seances/${seanceId}/code-salle?site=${siteId}`);
        if (fini) return;
        setCode(c);
        setErreur(null);
        minuterie = setTimeout(charger, c.expireDansMs + 400);
      } catch (e) {
        if (fini) return;
        setErreur((e as Error).message);
        minuterie = setTimeout(charger, 20_000);
      }
    };
    void charger();
    return () => {
      fini = true;
      clearTimeout(minuterie);
    };
  }, [seanceId, siteId, actif]);
  return { code, erreur };
}

function BlocCode({ seance, siteId, compact }: { seance: SeanceDetailDto; siteId: number | null; compact?: boolean }) {
  const ouvert = seance.statut === "en_direct" || new Date(seance.debut).getTime() - maintenantServeur() < 60 * 60_000;
  const { code, erreur } = useCodeSalle(seance.id, siteId, ouvert);
  const maintenant = useMaintenant(1000);
  const restant = 60 - Math.floor((maintenant / 1000) % 60);
  if (!ouvert) {
    return (
      <div className="rounded-[28px] bg-nuit-panneau p-6">
        <p className="font-mono text-sm uppercase tracking-wider text-orange-peche">Émargement</p>
        <p className="mt-2 text-2xl font-bold text-nuit-doux">Le code s'affichera une heure avant le début.</p>
      </div>
    );
  }
  if (!code) return <div className="rounded-[28px] bg-nuit-panneau p-6 text-xl text-nuit-doux">{erreur ?? "Chargement du code…"}</div>;
  const chemin = code.url.replace(/^https?:\/\//, "").replace(/\/emargement\/\d+$/, "/emargement");
  return (
    <div className={cn("flex gap-6 rounded-[28px] bg-nuit-panneau", compact ? "flex-col p-5" : "flex-col p-7 xl:flex-row xl:items-center")}>
      <div className="flex flex-1 flex-col gap-3">
        <p className="font-mono text-sm uppercase tracking-[0.14em] text-orange-peche">Émargement · {code.salle}</p>
        <p className={cn("font-black tabular-nums leading-none tracking-[0.12em] text-white", compact ? "text-[clamp(56px,6vw,96px)]" : "text-[clamp(88px,11vw,200px)]")} aria-live="polite">
          {code.code.split("").join(" ")}
        </p>
        <div className="h-2.5 overflow-hidden rounded-full bg-nuit-ligne" aria-hidden>
          <div className="h-full rounded-full bg-orange transition-[width] duration-1000 ease-linear" style={{ width: `${(restant / 60) * 100}%` }} />
        </div>
        <p className={cn("text-nuit-doux", compact ? "text-base" : "text-xl")}>
          Tape ce code dans le campus, ou scanne le QR. Il change chaque minute.
          {!compact && <span className="block font-mono text-base text-nuit-gris">{chemin}</span>}
        </p>
      </div>
      <div className={cn("shrink-0 rounded-2xl bg-white p-3", compact ? "w-40 self-center" : "w-56 self-center")} dangerouslySetInnerHTML={{ __html: code.qrSvg }} aria-label={`QR d'émargement, code ${code.code}`} role="img" />
    </div>
  );
}

function CompteursEmarges({ etat, grand }: { etat: EtatDirectDto; grand?: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {etat.campus.map((c) => (
        <div key={c.siteId} className={cn("rounded-2xl p-3 text-center", c.salleConnectee ? "bg-nuit-carte" : "bg-nuit-panneau")}>
          <div className={cn("font-black tabular-nums text-white", grand ? "text-5xl" : "text-3xl")}>{c.emarges}</div>
          <div className={cn("mt-1 truncate font-bold", grand ? "text-base" : "text-sm", c.salleConnectee ? "text-orange-peche" : "text-nuit-gris")}>{c.nomCourt}</div>
        </div>
      ))}
    </div>
  );
}

// ── Avant le cours ─────────────────────────────────────────────────────────

/** Compte à rebours lisible du fond de la salle. */
function GrandCompteARebours({ cible }: { cible: string }) {
  const d = decompte(cible, useMaintenant(1000));
  const p = (n: number) => String(n).padStart(2, "0");
  const cases = [
    ...(d.jours ? [{ v: String(d.jours), l: d.jours > 1 ? "jours" : "jour" }] : []),
    { v: p(d.heures), l: "heures" },
    { v: p(d.minutes), l: "min" },
    { v: p(d.secondes), l: "sec" },
  ];
  return (
    <div className="flex max-w-3xl gap-3" aria-label="Compte à rebours">
      {cases.map((c) => (
        <div key={c.l} className="flex-1 rounded-[20px] bg-[#242120] px-3 py-4 text-center">
          <div className="text-[clamp(44px,5.2vw,100px)] font-black leading-none tabular-nums">{c.v}</div>
          <div className="mt-2 font-mono text-sm uppercase tracking-wider text-nuit-gris">{c.l}</div>
        </div>
      ))}
    </div>
  );
}

function AvantLeCours({ seance, etat, siteId }: { seance: SeanceDetailDto; etat: EtatDirectDto; siteId: number | null }) {
  const ville = seance.formateur?.localisation?.split(",")[0] ?? null;
  const maintenant = useMaintenant(1000);
  const avantDebutMin = (new Date(seance.debut).getTime() - maintenant) / 60_000;
  return (
    <main className="grid flex-1 gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:px-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-lg text-orange-peche">{seance.coursCode} · {avantDebutMin < 10 ? "La salle ouvre, installez-vous" : "Prochain cours"}</span>
          <h1 className="text-[clamp(40px,4.6vw,84px)] font-black leading-[0.98] tracking-serre">{seance.titre}</h1>
          <p className="text-[clamp(20px,1.8vw,30px)] text-nuit-doux">
            {seance.formateur ? `${seance.formateur.prenom} ${seance.formateur.nom}` : "Formateur"}
            {ville ? `, depuis ${ville}` : ""} · début {heure(seance.debut)}
          </p>
        </div>
        <GrandCompteARebours cible={seance.debut} />
        <div className="max-w-2xl">
          <CarteCoteIvoire campus={etat.campus} villeFormateur={ville} />
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <BlocCode seance={seance} siteId={siteId} />
        <div className="flex flex-col gap-3">
          <p className="font-mono text-sm uppercase tracking-[0.14em] text-nuit-gris">Émargés par campus</p>
          <CompteursEmarges etat={etat} grand />
        </div>
      </div>
    </main>
  );
}

// ── Pendant le cours ───────────────────────────────────────────────────────

function PendantLeCours({ seance, etat, siteId }: { seance: SeanceDetailDto; etat: EtatDirectDto; siteId: number | null }) {
  const aLaParole = etat.parole?.type === "salle" && etat.parole.siteId === siteId;
  const questionEnCours = etat.questions.find((q) => q.epinglee && !q.masquee);
  const derniereLigne = etat.sousTitres[etat.sousTitres.length - 1];
  const sondage = etat.sondage;
  return (
    <main className="grid flex-1 gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,30%)] lg:px-10">
      <div className="flex min-w-0 flex-col gap-4">
        {aLaParole && (
          <div className="animate-monte rounded-[22px] bg-orange px-6 py-4 text-center text-[clamp(26px,3vw,52px)] font-black uppercase tracking-serre text-encre" role="alert">
            C'est à vous : passez le micro
          </div>
        )}
        <div className="relative">
          <Scene seance={seance} etat={etat} role="salle" micro={aLaParole} camera grand className="min-h-[58vh]" />
          {derniereLigne && seance.fournisseur !== "demo" && (
            <div className="pointer-events-none absolute inset-x-8 bottom-8 flex justify-center">
              <p className="max-w-5xl rounded-2xl bg-black/75 px-6 py-3 text-center text-[clamp(22px,2.4vw,40px)] font-semibold leading-snug">{derniereLigne.texte}</p>
            </div>
          )}
        </div>
        {questionEnCours && (
          <div className="animate-monte rounded-[24px] bg-creme p-6 text-encre">
            <p className="font-mono text-lg uppercase tracking-wider text-orange-fonce">Question de {questionEnCours.site ?? "la classe en ligne"}</p>
            <p className="mt-2 text-[clamp(28px,3vw,56px)] font-black leading-tight tracking-serre">{questionEnCours.texte}</p>
          </div>
        )}
      </div>
      <aside className="flex flex-col gap-5">
        {sondage && (
          <div className="rounded-[24px] bg-nuit-panneau p-6">
            <p className="font-mono text-sm uppercase tracking-wider text-orange-peche">{sondage.ouvert ? "Sondage en cours · réponds sur ton téléphone" : "Résultats du sondage"}</p>
            <p className="mb-4 mt-2 text-[clamp(24px,2vw,40px)] font-black leading-tight">{sondage.question}</p>
            {etat.resultats ? <ResultatsParCampus sondage={sondage} resultats={etat.resultats} grand /> : null}
          </div>
        )}
        <BlocCode seance={seance} siteId={siteId} compact />
        <CompteursEmarges etat={etat} />
      </aside>
    </main>
  );
}

// ── Console du responsable de salle ────────────────────────────────────────

function ConsoleResponsable({ seance, etat, siteId }: { seance: SeanceDetailDto; etat: EtatDirectDto; siteId: number }) {
  const moi = useMoiConnecte();
  const campus = etat.campus.find((c) => c.siteId === siteId);
  const [effectif, setEffectif] = useState<number | null>(campus?.effectif ?? null);
  const [incidents, setIncidents] = useState(false);
  useEffect(() => setEffectif(campus?.effectif ?? null), [campus?.effectif]);
  const mainSalle: MainDirectDto | undefined = useMemo(() => etat.mains.find((m) => m.pourSalle && m.siteId === siteId), [etat.mains, siteId]);
  const peutLever = moi.role === "salle" || moi.role === "vie_scolaire";
  const enDirect = etat.statut === "en_direct";

  const declarer = async (corps: { nombre?: number; prete?: boolean; incident?: string | null }) => {
    try {
      await put(`/api/seances/${seance.id}/effectifs/${siteId}`, corps);
    } catch (e) {
      toastErreur(e);
    }
  };
  const main = async () => {
    try {
      const mains = mainSalle ? await suppr<MainDirectDto[]>(`/api/seances/${seance.id}/mains`) : await post<MainDirectDto[]>(`/api/seances/${seance.id}/mains`);
      queryClient.setQueryData<EtatDirectDto>(cleDirect(seance.id), (x) => (x ? { ...x, mains } : x));
    } catch (e) {
      toastErreur(e);
    }
  };
  const bouton = "flex min-h-12 items-center gap-2 rounded-2xl px-4 text-[15px] font-bold transition-colors";
  return (
    <footer className="sticky bottom-0 mt-auto border-t border-nuit-ligne bg-nuit-panneau/95 px-4 py-3 backdrop-blur lg:px-10">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-center gap-2.5">
        <span className="mr-2 hidden font-mono text-[12px] uppercase tracking-wider text-nuit-gris md:inline">Responsable de salle</span>
        {peutLever && (
          <button onClick={main} disabled={!enDirect} className={cn(bouton, mainSalle ? "bg-orange text-encre" : "bg-nuit-carte text-white hover:bg-nuit-ligne", !enDirect && "opacity-50")}>
            <Hand className="h-5 w-5" /> {mainSalle ? "Main de la salle levée" : "Lever la main de la salle"}
          </button>
        )}
        <div className="flex items-center gap-1 rounded-2xl bg-nuit-carte p-1">
          <button
            onClick={() => {
              const n = Math.max(0, (effectif ?? 0) - 1);
              setEffectif(n);
              void declarer({ nombre: n });
            }}
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-nuit-ligne"
            aria-label="Retirer une personne de l'effectif"
          >
            <Minus className="h-5 w-5" />
          </button>
          <span className="min-w-[110px] text-center text-[15px] font-bold">Effectif : {effectif ?? "—"}</span>
          <button
            onClick={() => {
              const n = (effectif ?? 0) + 1;
              setEffectif(n);
              void declarer({ nombre: n });
            }}
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-nuit-ligne"
            aria-label="Ajouter une personne à l'effectif"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <button onClick={() => declarer({ prete: !campus?.prete })} className={cn(bouton, campus?.prete ? "bg-[#1F3A2B] text-[#6FCF97]" : "bg-nuit-carte text-white hover:bg-nuit-ligne")}>
          <CheckCircle2 className="h-5 w-5" /> {campus?.prete ? "Salle prête" : "Déclarer la salle prête"}
        </button>
        {campus?.incident ? (
          <button onClick={() => declarer({ incident: null })} className={cn(bouton, "bg-direct text-white")}>
            <CircleAlert className="h-5 w-5" /> {campus.incident} · résolu ?
          </button>
        ) : (
          <div className="relative">
            <button onClick={() => setIncidents((v) => !v)} className={cn(bouton, "bg-nuit-carte text-white hover:bg-nuit-ligne")} aria-expanded={incidents}>
              <CircleAlert className="h-5 w-5 text-orange" /> Incident
            </button>
            {incidents && (
              <div className="absolute bottom-14 right-0 z-10 flex w-64 flex-col gap-1 rounded-2xl border border-nuit-bord bg-nuit-panneau p-2 shadow-2xl">
                {INCIDENTS.map((i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setIncidents(false);
                      void declarer({ incident: i });
                    }}
                    className="min-h-11 rounded-xl px-3 text-left text-[15px] font-semibold hover:bg-nuit-carte"
                  >
                    {i}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
