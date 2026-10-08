// Mode salle (« compagnon léger ») du téléphone de l'étudiant émargé dans la
// salle de conférence (chantier C6). Il suit le cours sur l'écran de la salle,
// avec ses camarades : le téléphone ne montre ni vidéo, ni diapo, ni son. Il
// sert à participer : « Tu es compté présent ✓ », le sondage en cours (et les
// questions de rappel du dernier cours, lancées comme des sondages), les
// réactions, les questions au formateur, la discussion, et les campus qui
// émargent, comme sur l'écran de la salle : en taux (part des attendus), sans
// numéro de rang ni campus à 0 (décision D5 : jamais de dernier). Quelques Ko
// par minute : un état au départ, puis le temps réel ; un battement de
// présence par minute, comme les autres modes.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, LogOut, DoorOpen, Signal, VolumeX } from "lucide-react";
import { post } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { heure } from "@/lib/dates";
import { Bouton } from "@/components/ui/bouton";
import { toast, toastErreur } from "@/components/ui/toast";
import { PanneauQuestions, PanneauCampus, BoutonsRessentis, OngletsPanneau, ResultatsParCampus } from "./panneaux";
import { PanneauDiscussion, useNonLusDiscussion } from "./discussion";
import { EnTeteLive, FinDeSeance } from "./ui";
import { ChoixGroupe, VueGroupeEtudiant, monGroupe, useGroupes } from "./groupes";
import { cleDirect, estimationMo, octetsMesuresDepuis, useEtatDirect } from "./outils";
import { SortieDuLive } from "./SortieDuLive";
import { t } from "@shared/textes/direct";
import { classementEmargement, type EmargementSalleDto, type MaPresenceDirectDto } from "@shared/engagement/direct";
import type { EtatDirectDto, ModeSuivi, ResultatsSondageDto, SeanceDetailDto, SondageDto } from "@shared/schema";

type Onglet = "questions" | "discussion" | "campus";
const LETTRES = ["A", "B", "C", "D", "E"];

export function CompagnonSalle({ seance, onChangerMode }: { seance: SeanceDetailDto; onChangerMode: (m: ModeSuivi | null) => void }) {
  const moi = useMoiConnecte();
  const tx = useTextes(t);
  const [onglet, setOnglet] = useState<Onglet>("questions");
  const nonLus = useNonLusDiscussion(seance.id, false, moi.id, onglet === "discussion");
  const { data: etat } = useEtatDirect(seance.id, false, undefined, { leger: true });
  const { data: presence } = useQuery<MaPresenceDirectDto>({ queryKey: [`/api/seances/${seance.id}/ma-presence`], staleTime: 5 * 60_000 });
  // Campus du cours et leurs attendus (dénominateur du taux), lus une fois : quelques octets.
  const { data: infos } = useQuery<EmargementSalleDto>({ queryKey: [`/api/seances/${seance.id}/emargement-salle`], staleTime: 10 * 60_000 });
  const [sortie, setSortie] = useState<{ minutes: number; mo: number } | null>(null);
  const arrivee = useRef(Date.now());
  const enDirect = (etat?.statut ?? seance.statut) === "en_direct";

  // Travail en groupes : le groupe se retrouve sur l'écran de la salle, le téléphone garde la discussion du groupe.
  const groupeId = useRef<number | null>(null);
  const { data: groupes } = useGroupes(seance.id, (type, d) => {
    if (type === "groupes:annonce" && groupeId.current) toast(`Message du formateur : ${d.texte}`, "info");
  });
  const groupe = enDirect ? monGroupe(groupes) : null;
  useEffect(() => {
    groupeId.current = groupe?.id ?? null;
  }, [groupe?.id]);

  // Un battement par minute pendant le direct (comme les autres modes), arrêté dès la sortie.
  useEffect(() => {
    if (!enDirect || sortie) return;
    const battre = () => void post(`/api/seances/${seance.id}/presence`, { mode: "compagnon" }).catch(() => undefined);
    battre();
    const id = setInterval(battre, 60_000);
    return () => clearInterval(id);
  }, [enDirect, sortie, seance.id]);

  if (sortie) {
    return (
      <SortieDuLive
        seance={seance}
        mode="compagnon"
        minutes={sortie.minutes}
        mo={sortie.mo}
        mesure={false}
        enDirect={enDirect}
        onRevenir={() => setSortie(null)}
      />
    );
  }
  if (!etat) return <div className="min-h-[calc(100dvh-64px)] bg-nuit" aria-busy="true" />;
  if (etat.statut === "terminee" || etat.statut === "annulee") return <FinDeSeance seance={{ ...seance, statut: etat.statut, motifAnnulation: etat.motifAnnulation }} />;

  const quitter = () => {
    const secondes = (Date.now() - arrivee.current) / 1000;
    setSortie({ minutes: Math.round(secondes / 60), mo: Math.max(estimationMo("compagnon", secondes), octetsMesuresDepuis(arrivee.current) / 1_000_000) });
  };
  const site = presence?.site ?? seance.monSite?.nomCourt ?? null;
  // Comme l'écran de la salle : campus avec au moins un émargé, triés par taux, sans rang (shared/engagement/direct.ts).
  const monSite = seance.monSite?.id ?? null;
  const campusDuCours = classementEmargement(etat.campus, infos?.sitesDuCours ?? null, infos?.attendus ?? null);

  return (
    <div className="relative min-h-[calc(100dvh-64px)] bg-nuit px-3 pb-32 pt-4 text-white sm:px-6 lg:pb-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-3.5">
        <EnTeteLive seance={seance} etat={etat} mode="compagnon" />

        <div className="flex items-start gap-3 rounded-[20px] bg-[#1F3A2B] p-4" role="status">
          <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-[#6FCF97]" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-[19px] font-black leading-tight text-[#6FCF97]">{tx("compagnon.present")}</p>
            {site && presence?.arriveeSalle && <p className="text-[14px] font-semibold text-white">{tx("compagnon.present.detail", { v: { site, heure: heure(presence.arriveeSalle) } })}</p>}
            <p className="flex items-center gap-1.5 text-[13px] text-nuit-doux">
              <VolumeX className="h-3.5 w-3.5" /> {tx("compagnon.son")}
            </p>
          </div>
        </div>

        {!enDirect && <p className="rounded-[18px] bg-nuit-panneau p-4 text-[15px] font-semibold">{tx("compagnon.aVenir", { v: { heure: heure(seance.debut) } })}</p>}

        {campusDuCours.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-nuit-gris">{tx("compagnon.classement")}</p>
            <ul className="flex flex-wrap gap-1.5">
              {campusDuCours.map((c) => (
                <li key={c.siteId} className={cn("rounded-full px-3 py-1.5 text-[13px] font-extrabold", c.siteId === monSite ? "bg-orange text-encre" : "bg-nuit-carte text-white")}>
                  {c.nomCourt} <span className="tabular-nums">{c.taux === null ? c.emarges : tx("salle.qr.taux", { v: { n: c.taux } })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {groupe && groupes ? (
          <VueGroupeEtudiant seance={seance} groupes={groupes} groupe={groupe} moiId={moi.id} mode="compagnon" />
        ) : (
          <>
            {enDirect && groupes?.session?.choixLibre && <ChoixGroupe seanceId={seance.id} groupes={groupes} />}
            {etat.sondage && <SondageEnLigne seanceId={seance.id} etat={etat} />}
            {enDirect && (
              <div className="flex flex-col gap-1.5">
                <p className="font-mono text-[11px] uppercase tracking-wider text-nuit-gris">{tx("compagnon.reagir")}</p>
                <BoutonsRessentis seanceId={seance.id} />
              </div>
            )}
            <section className="flex min-h-[380px] flex-col overflow-hidden rounded-[22px] bg-nuit-panneau">
              <OngletsPanneau
                valeur={onglet}
                onChange={setOnglet}
                options={[
                  { valeur: "questions", libelle: tx("compagnon.onglet.questions"), compteur: etat.questions.length || undefined },
                  { valeur: "discussion", libelle: tx("compagnon.onglet.discussion"), compteur: nonLus || undefined },
                  { valeur: "campus", libelle: tx("compagnon.onglet.campus") },
                ]}
              />
              {onglet === "questions" && <PanneauQuestions seanceId={seance.id} etat={etat} role="etudiant" enDirect={enDirect} />}
              {onglet === "discussion" && (
                <PanneauDiscussion seanceId={seance.id} role="etudiant" moiId={moi.id} ouverte={etat.statut === "planifiee" || etat.statut === "en_direct"} mode={etat.chatMode} formateur={seance.formateur} />
              )}
              {onglet === "campus" && <PanneauCampus etat={etat} />}
            </section>
          </>
        )}

        <div className="flex flex-col items-center gap-2 pt-1">
          <p className="flex items-center gap-1.5 text-center text-[13px] text-nuit-gris">
            <Signal className="h-3.5 w-3.5" /> {tx("compagnon.donnees")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Bouton variante="nuit" onClick={() => onChangerMode(null)} icone={<DoorOpen className="h-4 w-4" />} className="min-h-12">
              {tx("compagnon.plusEnSalle")}
            </Bouton>
            <Bouton variante="danger" onClick={quitter} icone={<LogOut className="h-4 w-4" />} className="min-h-12">
              {tx("compagnon.quitter")}
            </Bouton>
          </div>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {etat.parole ? `${etat.parole.libelle} a la parole` : ""}
      </span>
    </div>
  );
}

/** Le sondage en cours (ou ses résultats), dans la page : sur le téléphone de la salle, c'est l'essentiel. */
function SondageEnLigne({ seanceId, etat }: { seanceId: number; etat: EtatDirectDto }) {
  const tx = useTextes(t);
  const s = etat.sondage;
  const [envoi, setEnvoi] = useState<number | null>(null);
  if (!s) return null;
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
    <section className={cn("animate-monte flex flex-col gap-3 rounded-[22px] p-4", s.ouvert ? "bg-nuit-panneau ring-2 ring-orange" : "bg-nuit-panneau")} aria-label="Sondage">
      <span className="font-mono text-[11px] uppercase tracking-wider text-orange-peche">{s.ouvert ? tx("compagnon.sondage") : tx("compagnon.sondage.resultats")}</span>
      {s.parIa && <span className="-mt-2 text-[12px] text-nuit-gris">{tx("compagnon.sondage.ia")}</span>}
      <p className="text-[19px] font-extrabold leading-snug">{s.question}</p>
      {s.ouvert && !aVote ? (
        <div className="grid gap-2">
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
          {aVote && s.ouvert && <p className="text-[15px] font-semibold text-[#6FCF97]">{tx("compagnon.sondage.envoye", { v: { lettre: LETTRES[s.monChoix!] } })}</p>}
          {etat.resultats ? <ResultatsParCampus sondage={s} resultats={etat.resultats} /> : <p className="text-sm text-nuit-doux">{tx("compagnon.sondage.bientot")}</p>}
          {!s.ouvert && s.explication && <p className="rounded-xl bg-nuit-carte p-3 text-[15px] leading-relaxed text-nuit-texte">{s.explication}</p>}
        </>
      )}
    </section>
  );
}
