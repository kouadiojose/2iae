// /enseigner/mon-cours/:coursId/examen/nouveau — « Créer un examen » en étapes simples (José, 15 octobre 2026 :
// « maintenant il peut lui aussi créer des examens et donner les critères à l'IA pour la correction »).
//   1. Quel examen ? « Questions à écrire » (l'IA corrige avec vos critères) ou « QCM » (corrigé tout seul).
//   2. Titre et date limite : l'examen est enregistré en brouillon (POST /api/devoirs, publie: false).
//   3. Les questions : écrites, ou proposées par l'IA à partir du cours (POST …/examen/proposer), toujours modifiables.
//   4. (Questions à écrire) Les critères pour l'IA : enregistrés comme corrigé du devoir (validé par le professeur) :
//      après la date limite, la correction automatique existante note chaque copie avec eux.
//   5. Publier (PATCH /api/devoirs/:id { publie: true }), ou garder en brouillon. L'éditeur complet reste à un toucher.
import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, ListChecks, PenLine, Sparkles, Trash2 } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { BandeauCours, GrosBlocProf, GrosBouton, RetourGros } from "@/components/ui/gros-blocs";
import { toast } from "@/components/ui/toast";
import { patch, post, suppr } from "@/lib/api";
import { dateCourte } from "@/lib/dates";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { t as tProf } from "@shared/textes/espace-prof";
import type { DevoirDetailEnseignant } from "@shared/schema";
import type { PropositionExamenDto } from "@shared/espace-prof";
import { useAccueilSimple } from "./simple/blocs";
import { cleResumeCours } from "./simple/blocs-cours";
import { cleVideosExamens } from "./PageVideosExamens";

type Type = "depot" | "quiz";
const CHAMP = "min-h-[60px] w-full rounded-[16px] border-2 border-ligne bg-white px-4 text-[19px] text-encre outline-none focus:border-orange focus:ring-4 focus:ring-orange/20";
const ZONE = "w-full resize-y rounded-[16px] border-2 border-ligne bg-white px-4 py-3 text-[19px] leading-relaxed text-encre outline-none focus:border-orange focus:ring-4 focus:ring-orange/20";

/** Date du jour + n jours, au format des champs (AAAA-MM-JJ). */
const dansJours = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default function PageCreerExamen({ coursId }: { coursId: string }) {
  const tx = useTextes(tProf);
  const id = Number(coursId);
  const [, naviguer] = useLocation();
  const recherche = useSearch();
  const accueil = useAccueilSimple();
  const c = accueil.data?.cours.find((x) => x.coursId === id);
  const [etape, setEtape] = useState(1);
  const [type, setType] = useState<Type>("depot");
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState(dansJours(7));
  const [heureLimite, setHeureLimite] = useState("23:59");
  const [duree, setDuree] = useState("");
  const [devoirId, setDevoirId] = useState<number | null>(() => {
    const n = Number(new URLSearchParams(recherche).get("devoir"));
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  const [questions, setQuestions] = useState("");
  const [criteres, setCriteres] = useState("");
  const [occupe, setOccupe] = useState<null | "infos" | "ia" | "publier" | "brouillon" | "question">(null);
  const detail = useQuery<DevoirDetailEnseignant>({ queryKey: [`/api/devoirs/${devoirId}`], enabled: Boolean(devoirId) && type === "quiz" });
  const etapes = type === "depot" ? 5 : 4;
  const numero = type === "quiz" && etape === 5 ? 4 : etape;
  const erreur = (e: unknown) => toast(e instanceof Error ? e.message : String(e), "erreur");

  const enregistrerInfos = async () => {
    setOccupe("infos");
    try {
      const dateLimite = new Date(`${date}T${heureLimite || "23:59"}:00Z`).toISOString();
      const corps = { titre: titre.trim(), dateLimite, ...(type === "quiz" && duree ? { dureeMinutes: Number(duree) } : {}) };
      if (devoirId) await patch(`/api/devoirs/${devoirId}`, corps);
      else {
        const r = await post<DevoirDetailEnseignant>("/api/devoirs", { coursId: id, type, consigne: "", publie: false, ...corps });
        setDevoirId(r.devoir.id);
      }
      setEtape(3);
    } catch (e) {
      erreur(e);
    } finally {
      setOccupe(null);
    }
  };

  const proposer = async () => {
    setOccupe("ia");
    try {
      const r = await post<PropositionExamenDto>(`/api/enseigner/mon-cours/${id}/examen/proposer`, { type, nombre: type === "quiz" ? 10 : 5, titre: titre.trim() || undefined });
      if (r.type === "depot") {
        const lignes = r.questions.map((q, i) => `${i + 1}. ${q}`).join("\n\n");
        setQuestions((avant) => (avant.trim() ? `${avant.trim()}\n\n${lignes}` : lignes));
        if (!criteres.trim()) setCriteres(r.criteres);
      } else if (devoirId) {
        for (const q of r.qcm) await post(`/api/devoirs/${devoirId}/questions`, { type: "qcm", enonce: q.enonce, options: q.options, bonnesReponses: [q.bonne], explication: q.explication, points: 1 });
        await rafraichir(`/api/devoirs/${devoirId}`);
      }
    } catch (e) {
      erreur(e);
    } finally {
      setOccupe(null);
    }
  };

  const terminer = async (publier: boolean) => {
    if (!devoirId) return;
    setOccupe(publier ? "publier" : "brouillon");
    try {
      const corps: Record<string, unknown> = {};
      if (type === "depot") {
        corps.consigne = questions.trim();
        if (criteres.trim()) corps.corrige = criteres.trim();
      }
      if (publier) corps.publie = true;
      await patch(`/api/devoirs/${devoirId}`, corps);
      toast(publier ? tx("examen.publie") : tx("examen.garde"));
      await rafraichir(cleVideosExamens(id), cleResumeCours(id), "/api/devoirs");
      naviguer(`/enseigner/mon-cours/${id}/videos-examens`);
    } catch (e) {
      erreur(e);
    } finally {
      setOccupe(null);
    }
  };

  const qcm = detail.data?.questions ?? [];
  const peutSuivre3 = type === "depot" ? Boolean(questions.trim()) : qcm.length > 0;

  return (
    <Page className="gap-6 sm:gap-8">
      <RetourGros href={`/enseigner/mon-cours/${id}/videos-examens`}>{tx("documents.retour")}</RetourGros>
      <BandeauCours couleur={c?.couleur ?? "#E4793A"} etiquette={c?.titre ?? ""} titre={tx("examen.titre")} />
      <div className="flex flex-col gap-2" aria-live="polite">
        <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.14em] text-orange-profond" data-etape={numero}>
          {tx("examen.etape", { v: { n: numero, total: etapes } })}
        </span>
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: etapes }, (_, i) => (
            <span key={i} className={cn("h-2 flex-1 rounded-full", i < numero ? "bg-orange" : "bg-ligne")} />
          ))}
        </div>
      </div>

      {etape === 1 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-sans text-[30px] font-black">{tx("examen.type.titre")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <GrosBlocProf
              testId="type-depot"
              icone={<PenLine className="h-8 w-8" strokeWidth={2.25} />}
              cercle={{ fond: "#141414", icone: "#FFFFFF" }}
              titre={tx("examen.type.depot")}
              texte={tx("examen.type.depot.texte")}
              onClick={() => {
                setType("depot");
                setEtape(2);
              }}
            />
            <GrosBlocProf
              testId="type-quiz"
              icone={<ListChecks className="h-8 w-8" strokeWidth={2.25} />}
              cercle={{ fond: "#FFF1E6", icone: "#A34C17" }}
              titre={tx("examen.type.quiz")}
              texte={tx("examen.type.quiz.texte")}
              onClick={() => {
                setType("quiz");
                setEtape(2);
              }}
            />
          </div>
        </section>
      )}

      {etape === 2 && (
        <section className="flex max-w-3xl flex-col gap-5">
          <h2 className="font-sans text-[30px] font-black">{tx("examen.infos.titre")}</h2>
          <label className="flex flex-col gap-2 text-[19px] font-bold">
            {tx("examen.infos.nom")}
            <input className={CHAMP} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={tx("examen.infos.nom.exemple")} maxLength={200} data-champ="titre" />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-[19px] font-bold">
              {tx("examen.infos.date")}
              <input type="date" className={CHAMP} value={date} min={dansJours(0)} onChange={(e) => setDate(e.target.value)} data-champ="date" />
            </label>
            <label className="flex flex-col gap-2 text-[19px] font-bold">
              {tx("examen.infos.heure")}
              <input type="time" className={CHAMP} value={heureLimite} onChange={(e) => setHeureLimite(e.target.value)} />
            </label>
          </div>
          {type === "quiz" && (
            <label className="flex flex-col gap-2 text-[19px] font-bold">
              {tx("examen.infos.duree")}
              <input type="number" inputMode="numeric" min={1} max={600} className={CHAMP} value={duree} onChange={(e) => setDuree(e.target.value)} />
            </label>
          )}
          <Navigation
            retour={() => setEtape(1)}
            suivant={() => void enregistrerInfos()}
            peutSuivre={titre.trim().length >= 2 && Boolean(date)}
            chargement={occupe === "infos"}
          />
        </section>
      )}

      {etape === 3 && (
        <section className="flex flex-col gap-5">
          <h2 className="font-sans text-[30px] font-black">{tx("examen.questions.titre")}</h2>
          <GrosBlocProf
            testId="ia-propose"
            ton="encre"
            icone={<Sparkles className="h-8 w-8" strokeWidth={2.25} />}
            titre={tx("examen.questions.ia")}
            texte={occupe === "ia" ? tx("examen.questions.ia.attente") : tx("examen.questions.ia.texte")}
            chargement={occupe === "ia"}
            onClick={occupe ? undefined : () => void proposer()}
          />
          {type === "depot" ? (
            <label className="flex flex-col gap-2 text-[19px] font-bold">
              {tx("examen.questions.depot.champ")}
              <textarea className={cn(ZONE, "min-h-[260px]")} value={questions} onChange={(e) => setQuestions(e.target.value)} data-champ="questions" />
            </label>
          ) : (
            <ListeQcm devoirId={devoirId} questions={qcm} occupe={occupe === "question"} setOccupe={(v) => setOccupe(v ? "question" : null)} />
          )}
          <Navigation retour={() => setEtape(2)} suivant={() => setEtape(type === "depot" ? 4 : 5)} peutSuivre={peutSuivre3} />
        </section>
      )}

      {etape === 4 && type === "depot" && (
        <section className="flex max-w-4xl flex-col gap-5">
          <h2 className="font-sans text-[30px] font-black">{tx("examen.criteres.titre")}</h2>
          <p className="text-[20px] text-texte-doux">{tx("examen.criteres.texte")}</p>
          <label className="flex flex-col gap-2 text-[19px] font-bold">
            {tx("examen.criteres.champ")}
            <textarea className={cn(ZONE, "min-h-[240px]")} value={criteres} onChange={(e) => setCriteres(e.target.value)} placeholder={tx("examen.criteres.exemple")} data-champ="criteres" />
          </label>
          <Navigation retour={() => setEtape(3)} suivant={() => setEtape(5)} peutSuivre={Boolean(criteres.trim())} />
        </section>
      )}

      {etape === 5 && (
        <section className="flex max-w-4xl flex-col gap-5">
          <h2 className="font-sans text-[30px] font-black">{tx("examen.publier.titre")}</h2>
          <div className="flex flex-col gap-2 rounded-[24px] border-2 border-ligne bg-white p-6 shadow-carte">
            <p className="flex items-center gap-2 text-[24px] font-black">
              <ClipboardList className="h-6 w-6 text-orange-profond" aria-hidden /> {titre}
            </p>
            <p className="text-[19px]">{tx("examen.resume.limite", { v: { date: `${dateCourte(`${date}T12:00:00Z`)} · ${heureLimite.replace(":", "h")}` } })}</p>
            <p className="text-[19px]">{tx("examen.resume.questions", { v: { n: type === "quiz" ? qcm.length : questions.split(/\n+/).filter((l) => l.trim()).length } })}</p>
            {type === "depot" && (
              <p className="flex items-center gap-2 text-[18px] font-bold text-[#145F3F]">
                <CheckCircle2 className="h-5 w-5" aria-hidden /> {tx("videos.criteres.professeur")}
              </p>
            )}
          </div>
          <p className="text-[20px] text-texte-doux">{type === "depot" ? tx("examen.publier.texte") : tx("examen.publier.quiz")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <GrosBouton onClick={() => void terminer(true)} chargement={occupe === "publier"} disabled={Boolean(occupe)}>
              {tx("examen.publier.bouton")}
            </GrosBouton>
            <GrosBouton ton="contour" onClick={() => void terminer(false)} chargement={occupe === "brouillon"} disabled={Boolean(occupe)}>
              {tx("examen.publier.brouillon")}
            </GrosBouton>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <button type="button" onClick={() => setEtape(type === "depot" ? 4 : 3)} className="min-h-[48px] text-[18px] font-bold underline underline-offset-4">
              {tx("examen.retour")}
            </button>
            {devoirId && (
              <a href={`/enseigner/devoirs/${devoirId}`} className="inline-flex min-h-[48px] items-center text-[18px] font-bold text-orange-profond underline underline-offset-4">
                {tx("examen.editeurComplet")}
              </a>
            )}
          </div>
        </section>
      )}
    </Page>
  );
}

function Navigation({ retour, suivant, peutSuivre, chargement }: { retour: () => void; suivant: () => void; peutSuivre: boolean; chargement?: boolean }) {
  const tx = useTextes(tProf);
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <GrosBouton onClick={suivant} disabled={!peutSuivre} chargement={chargement}>
        {tx("examen.suivant")}
      </GrosBouton>
      <GrosBouton ton="contour" onClick={retour}>
        {tx("examen.retour")}
      </GrosBouton>
    </div>
  );
}

/** Les questions du QCM (enregistrées dans le devoir) : les voir, en écrire une, en retirer une. */
function ListeQcm({
  devoirId,
  questions,
  occupe,
  setOccupe,
}: {
  devoirId: number | null;
  questions: DevoirDetailEnseignant["questions"];
  occupe: boolean;
  setOccupe: (v: boolean) => void;
}) {
  const tx = useTextes(tProf);
  const [ouvert, setOuvert] = useState(false);
  const [enonce, setEnonce] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [bonne, setBonne] = useState(0);
  const ajouter = async () => {
    if (!devoirId) return;
    const remplies = options.map((o) => o.trim()).filter(Boolean);
    setOccupe(true);
    try {
      await post(`/api/devoirs/${devoirId}/questions`, { type: "qcm", enonce: enonce.trim(), options: remplies, bonnesReponses: [Math.min(bonne, remplies.length - 1)], points: 1 });
      setEnonce("");
      setOptions(["", "", "", ""]);
      setBonne(0);
      setOuvert(false);
      await rafraichir(`/api/devoirs/${devoirId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erreur");
    } finally {
      setOccupe(false);
    }
  };
  const retirer = async (qid: number) => {
    if (!devoirId) return;
    try {
      await suppr(`/api/devoirs/${devoirId}/questions/${qid}`);
      await rafraichir(`/api/devoirs/${devoirId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erreur");
    }
  };
  return (
    <div className="flex flex-col gap-3" data-liste-qcm={questions.length}>
      {!questions.length && <p className="text-[19px] text-texte-doux">{tx("examen.questions.aucune")}</p>}
      {questions.map((q, i) => (
        <article key={q.id} className="rounded-[20px] border-2 border-ligne bg-white p-4 shadow-carte" data-question={q.id}>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-clair text-[16px] font-black text-orange-profond">{i + 1}</span>
            <p className="flex-1 text-[19px] font-bold">{q.enonce}</p>
            <button type="button" onClick={() => void retirer(q.id)} className="inline-flex min-h-[44px] items-center gap-1 px-2 text-[15px] font-bold text-[#B42318]" aria-label={`${tx("examen.questions.retirer")} ${i + 1}`}>
              <Trash2 className="h-4 w-4" aria-hidden /> {tx("examen.questions.retirer")}
            </button>
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-1 pl-12 sm:grid-cols-2">
            {q.options.map((o, j) => (
              <li key={j} className={cn("text-[17px]", q.bonnesReponses.map(Number).includes(j) ? "font-bold text-[#145F3F]" : "text-texte-doux")}>
                {q.bonnesReponses.map(Number).includes(j) ? "✓ " : "· "}
                {o}
              </li>
            ))}
          </ul>
        </article>
      ))}
      {ouvert ? (
        <div className="flex flex-col gap-3 rounded-[22px] border-2 border-orange bg-creme p-5">
          <label className="flex flex-col gap-2 text-[18px] font-bold">
            {tx("examen.questions.enonce")}
            <textarea className={cn(ZONE, "min-h-[90px]")} value={enonce} onChange={(e) => setEnonce(e.target.value)} />
          </label>
          {options.map((o, j) => (
            <div key={j} className="flex items-center gap-3">
              <input type="radio" name="bonne" checked={bonne === j} onChange={() => setBonne(j)} className="h-6 w-6 accent-[#16774C]" aria-label={`${tx("examen.questions.bonne")} : ${tx("examen.questions.option", { v: { n: j + 1 } })}`} />
              <input
                className={CHAMP}
                value={o}
                placeholder={tx("examen.questions.option", { v: { n: j + 1 } })}
                onChange={(e) => setOptions(options.map((x, k) => (k === j ? e.target.value : x)))}
              />
            </div>
          ))}
          <p className="text-[16px] text-texte-doux">{tx("examen.questions.bonne.aide")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <GrosBouton onClick={() => void ajouter()} chargement={occupe} disabled={!enonce.trim() || options.filter((x) => x.trim()).length < 2}>
              {tx("examen.questions.enregistrer")}
            </GrosBouton>
            <GrosBouton ton="contour" onClick={() => setOuvert(false)}>
              {tx("documents.annuler")}
            </GrosBouton>
          </div>
        </div>
      ) : (
        <GrosBouton ton="contour" onClick={() => setOuvert(true)} icone={<PenLine className="h-6 w-6" aria-hidden />}>
          {tx("examen.questions.ajouter")}
        </GrosBouton>
      )}
    </div>
  );
}
