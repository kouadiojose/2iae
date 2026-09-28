// /assistant/preparer-seance — le formateur donne un sujet et une durée ;
// l'assistant propose un plan minuté, 3 sondages éclair et un QCM de sortie.
// Tout reste un brouillon « Proposé par l'IA » : rien n'est publié ni
// enregistré dans une séance sans que le formateur le reprenne.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarClock, Copy, Check, RotateCcw, BarChart3, ListChecks, Clock } from "lucide-react";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Carte } from "@/components/ui/carte";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Selection } from "@/components/ui/champs";
import { Badge, EtatVide, Erreur, Squelette } from "@/components/ui/divers";
import type { PreparationSeance } from "@shared/schema/ext-ia";
import { useEtatIa, useCoursAssistant, blocageDe } from "./api-ia";
import { BandeauBlocage, EtiquetteIa } from "./composants";
import { copier } from "./voix";

const DUREES = [45, 60, 90, 120, 180];

/** « 1 h 30 » */
function enHeures(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** « 00:45 » : minute de début de l'étape depuis le début du live. */
const horodatage = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** La préparation en texte, pour la coller dans le plan de la séance ou un document. */
function enTexte(p: PreparationSeance, cours: string): string {
  let t = 0;
  const lettres = (i: number) => String.fromCharCode(65 + i);
  return [
    `${p.titre} (${cours} · ${enHeures(p.dureeMinutes)})`,
    p.objectif,
    "",
    "PLAN",
    ...p.plan.map((e) => {
      const ligne = `${horodatage(t)} ${e.titre} (${e.minutes} min) : ${e.deroule}`;
      t += e.minutes;
      return ligne;
    }),
    "",
    "SONDAGES ÉCLAIR",
    ...p.sondages.flatMap((s, i) => [
      `${i + 1}. ${s.question}`,
      ...s.options.map((o, j) => `   ${lettres(j)}. ${o}${s.bonneReponse === j ? " (bonne réponse)" : ""}`),
    ]),
    "",
    "QCM DE SORTIE",
    ...p.qcmSortie.flatMap((q, i) => [
      `${i + 1}. ${q.question}`,
      ...q.options.map((o, j) => `   ${lettres(j)}. ${o}${q.bonneReponse === j ? " (bonne réponse)" : ""}`),
      `   Explication : ${q.explication}`,
    ]),
    "",
    "Proposé par l'IA, relu par le formateur.",
  ].join("\n");
}

export default function PagePreparerSeance() {
  const { data: etat } = useEtatIa();
  const coursQ = useCoursAssistant();
  const mesCours = useMemo(() => (coursQ.data ?? []).filter((c) => c.enseignant), [coursQ.data]);
  const [coursId, setCoursId] = useState<number | null>(null);
  const [sujet, setSujet] = useState("");
  const [duree, setDuree] = useState(90);
  const [prep, setPrep] = useState<PreparationSeance | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (coursId !== null || !mesCours.length) return;
    // Venu de la préparation d'une séance (/assistant/preparer-seance?cours=12) : ce cours d'abord.
    const demande = Number(new URLSearchParams(window.location.search).get("cours"));
    setCoursId(mesCours.some((c) => c.id === demande) ? demande : mesCours[0].id);
  }, [mesCours, coursId]);

  const blocage = blocageDe(etat);
  const coursChoisi = mesCours.find((c) => c.id === coursId);

  const proposer = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!coursId || sujet.trim().length < 3 || blocage) return;
    setChargement(true);
    setErreur(null);
    try {
      const p = await post<PreparationSeance>("/api/ia/preparer-seance", { coursId, sujet: sujet.trim(), dureeMinutes: duree });
      setPrep(p);
      void rafraichir("/api/ia/etat");
      requestAnimationFrame(() => document.getElementById("preparation")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setChargement(false);
    }
  };

  const total = prep?.plan.reduce((s, e) => s + e.minutes, 0) ?? 0;
  let debut = 0;

  return (
    <Page className="max-w-4xl">
      <Link href="/assistant" className="-ml-2 inline-flex min-h-12 w-fit items-center gap-2 rounded-xl px-2 text-[15px] font-bold text-texte-doux no-underline hover:bg-creme hover:text-encre">
        <ArrowLeft className="h-5 w-5" /> L'assistant
      </Link>
      <EnTetePage
        etiquette="Assistant IA · outil du formateur"
        titre="Préparer une séance"
        sousTitre="Donnez un sujet et une durée : l'assistant propose un plan minuté, 3 sondages éclair et un QCM de sortie, en s'appuyant sur vos leçons. Tout reste un brouillon à relire."
      />
      <BandeauBlocage etat={etat} enseignant />

      {coursQ.isLoading ? (
        <Squelette className="h-64" />
      ) : !mesCours.length ? (
        <EtatVide icone={<CalendarClock className="h-6 w-6" />} titre="Aucun cours à préparer" texte="Les cours que vous enseignez apparaîtront ici dès qu'ils vous seront attribués par la direction des études." />
      ) : (
        <Carte className="p-5 sm:p-7">
          <form onSubmit={(e) => void proposer(e)} className="flex flex-col gap-4">
            <Selection libelle="Cours" value={coursId ?? ""} onChange={(e) => setCoursId(Number(e.target.value))}>
              {mesCours.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.titre}
                </option>
              ))}
            </Selection>
            <Champ
              libelle="Sujet de la séance"
              placeholder="Ex. : rédiger une bonne consigne pour une IA"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              maxLength={500}
              aide="Une phrase suffit. Précisez si vous voulez insister sur un point ou un exemple."
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">Durée du live</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Durée du live">
                {DUREES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={duree === d}
                    onClick={() => setDuree(d)}
                    className={cn(
                      "min-h-12 rounded-xl border px-4 font-mono text-sm transition-colors",
                      duree === d ? "border-encre bg-encre text-white" : "border-ligne bg-white text-encre hover:border-orange",
                    )}
                  >
                    {enHeures(d)}
                  </button>
                ))}
              </div>
            </div>
            {erreur && <Erreur message={erreur} />}
            <Bouton type="submit" taille="lg" chargement={chargement} disabled={Boolean(blocage) || sujet.trim().length < 3} className="self-start" icone={<CalendarClock className="h-5 w-5" />}>
              {prep ? "Proposer une autre préparation" : "Proposer une préparation"}
            </Bouton>
            {chargement && <p className="text-[15px] text-texte-pale">L'assistant prépare votre séance, cela prend souvent 20 à 40 secondes…</p>}
          </form>
        </Carte>
      )}

      {prep && (
        <div id="preparation" className="flex scroll-mt-24 flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <EtiquetteIa className="self-start" texte="Proposé par l'IA · brouillon" />
              <h2 className="text-[28px] font-black leading-tight tracking-serre">{prep.titre}</h2>
              {prep.objectif && <p className="max-w-2xl text-base text-texte-pale">{prep.objectif}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Bouton variante="contour" icone={<RotateCcw className="h-4 w-4" />} onClick={() => void proposer()} chargement={chargement} disabled={Boolean(blocage)}>
                Autre proposition
              </Bouton>
              <Bouton
                icone={copie ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                onClick={async () => {
                  if (await copier(enTexte(prep, coursChoisi?.code ?? ""))) {
                    setCopie(true);
                    setTimeout(() => setCopie(false), 2000);
                  }
                }}
              >
                {copie ? "Copiée" : "Copier la préparation"}
              </Bouton>
            </div>
          </div>

          <section className="flex flex-col gap-3 rounded-[24px] border border-ligne bg-white p-5 sm:p-6" aria-labelledby="titre-plan">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="titre-plan" className="flex items-center gap-2 text-xl font-extrabold">
                <Clock className="h-5 w-5 text-orange-fonce" /> Plan minuté
              </h3>
              <Badge ton={total === prep.dureeMinutes ? "succes" : "alerte"}>
                {enHeures(total)} / {enHeures(prep.dureeMinutes)}
              </Badge>
            </div>
            <ol className="flex flex-col">
              {prep.plan.map((e, i) => {
                const depart = debut;
                debut += e.minutes;
                return (
                  <li key={i} className="grid grid-cols-[56px_1fr] gap-3 border-t border-ligne-douce py-3 first:border-t-0">
                    <span className="pt-0.5 font-mono text-sm text-orange-fonce">{horodatage(depart)}</span>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-base font-extrabold">{e.titre}</span>
                        <span className="font-mono text-xs text-texte-gris">{e.minutes} min</span>
                      </div>
                      <p className="text-[15px] leading-relaxed text-texte-doux">{e.deroule}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="titre-sondages">
            <h3 id="titre-sondages" className="flex items-center gap-2 text-xl font-extrabold">
              <BarChart3 className="h-5 w-5 text-orange-fonce" /> Sondages éclair
            </h3>
            <div className="grid gap-3 md:grid-cols-3">
              {prep.sondages.map((s, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-2xl bg-creme p-4">
                  <span className="font-mono text-xs text-texte-gris">{s.bonneReponse === null ? "Opinion" : "Compréhension"}</span>
                  <p className="text-base font-bold leading-snug">{s.question}</p>
                  <ul className="flex flex-col gap-1.5">
                    {s.options.map((o, j) => (
                      <li key={j} className={cn("rounded-xl px-3 py-2 text-[15px]", s.bonneReponse === j ? "bg-succes-clair font-bold text-encre" : "bg-white text-texte-doux")}>
                        {String.fromCharCode(65 + j)}. {o}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="titre-qcm">
            <h3 id="titre-qcm" className="flex items-center gap-2 text-xl font-extrabold">
              <ListChecks className="h-5 w-5 text-orange-fonce" /> QCM de sortie
            </h3>
            <ol className="flex flex-col gap-3">
              {prep.qcmSortie.map((q, i) => (
                <li key={i} className="flex flex-col gap-2 rounded-2xl border border-ligne bg-white p-4">
                  <p className="text-base font-bold leading-snug">
                    {i + 1}. {q.question}
                  </p>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((o, j) => (
                      <li key={j} className={cn("rounded-xl px-3 py-2 text-[15px]", q.bonneReponse === j ? "bg-succes-clair font-bold text-encre" : "bg-creme text-texte-doux")}>
                        {String.fromCharCode(65 + j)}. {o}
                      </li>
                    ))}
                  </ul>
                  {q.explication && <p className="text-[14px] leading-relaxed text-texte-pale">{q.explication}</p>}
                </li>
              ))}
            </ol>
          </section>

          <p className="rounded-2xl bg-creme px-4 py-3 text-[14px] leading-relaxed text-texte-pale">
            Brouillon proposé par l'IA : relisez-le, puis reprenez le plan et les sondages dans le studio de votre séance. Rien n'est envoyé aux étudiants depuis cette page.
          </p>
        </div>
      )}
    </Page>
  );
}
